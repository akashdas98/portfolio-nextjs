export const TOUCH_GEOMETRY_CACHE_LIMIT = 4;
export const TOUCH_DECORATED_REGION_CACHE_LIMIT = 2;
export const TOUCH_DECORATED_HALO_PASSES = 3;
export const TOUCH_DECORATED_HALO_BLUR = 8.5;
export const TOUCH_MASK_MAX_PIXELS = 1_200_000;
export const TOUCH_VIEWPORT_MAX_PIXELS = 2_400_000;
export const TOUCH_MAX_PIXEL_RATIO = 2;

export type TouchTone = "blue" | "pink";

export type TouchToneRange = {
  bottom: number;
  top: number;
};

export type TouchToneInterval = TouchToneRange & {
  tone: TouchTone;
};

export type TouchRegion = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export function touchGeometryRegions(
  point: { x: number; y: number },
  layout: { renderLeft: number; renderScale: number },
  lensDiameter: number,
  cellSize: number,
) {
  const cellSource = cellSize / layout.renderScale;
  const centerX = (point.x - layout.renderLeft) / layout.renderScale;
  const centerY = point.y / layout.renderScale;
  const bucketX = Math.floor(centerX / cellSource) * cellSource;
  const bucketY = Math.floor(centerY / cellSource) * cellSource;
  const lensSource = lensDiameter / layout.renderScale;
  return {
    bucketX,
    bucketY,
    region: {
      // Horizontal travel needs enough prepared coverage to finish the next
      // exact-geometry region before a fast drag reaches this one's edge.
      x: bucketX - lensSource / 2 - cellSource * 3,
      y: bucketY - lensSource / 2 - cellSource,
      width: lensSource + cellSource * 7,
      height: lensSource + cellSource * 3,
    },
    requiredRegion: {
      x: centerX - lensSource / 2,
      y: centerY - lensSource / 2,
      width: lensSource,
      height: lensSource,
    },
  };
}

export function touchDecoratedCrop(
  sampleLeft: number,
  sampleTop: number,
  size: number,
  surfaceOriginX: number,
  surfaceOriginY: number,
  surfacePixelRatio: number,
) {
  return {
    sourceX: (sampleLeft - surfaceOriginX) * surfacePixelRatio,
    sourceY: (sampleTop - surfaceOriginY) * surfacePixelRatio,
    sourceSize: size * surfacePixelRatio,
  };
}

export function touchDecoratedSurfaceKey(geometryKey: string, tone: TouchTone) {
  return `${geometryKey}:${tone}`;
}

export function cacheTouchDecoratedSurface<T>(
  cache: Map<string, T>,
  regionOrder: string[],
  geometryKey: string,
  tone: TouchTone,
  surface: T,
  release: (surface: T) => void,
  protectedGeometryKey?: string,
) {
  const key = touchDecoratedSurfaceKey(geometryKey, tone);
  const replaced = cache.get(key);
  if (replaced && replaced !== surface) release(replaced);
  cache.set(key, surface);

  const existingIndex = regionOrder.indexOf(geometryKey);
  if (existingIndex >= 0) regionOrder.splice(existingIndex, 1);
  regionOrder.push(geometryKey);

  while (regionOrder.length > TOUCH_DECORATED_REGION_CACHE_LIMIT) {
    const evictionIndex = regionOrder.findIndex(
      (candidate) => candidate !== protectedGeometryKey,
    );
    const resolvedIndex = evictionIndex >= 0 ? evictionIndex : 0;
    const evictedGeometryKey = regionOrder.splice(resolvedIndex, 1)[0];
    for (const evictedTone of ["blue", "pink"] as const) {
      const evicted = cache.get(touchDecoratedSurfaceKey(evictedGeometryKey, evictedTone));
      if (!evicted) continue;
      cache.delete(touchDecoratedSurfaceKey(evictedGeometryKey, evictedTone));
      release(evicted);
    }
  }
}

export function clearTouchDecoratedSurfaces<T>(
  cache: Map<string, T>,
  regionOrder: string[],
  release: (surface: T) => void,
) {
  for (const surface of cache.values()) release(surface);
  cache.clear();
  regionOrder.splice(0);
}

export function touchEnvelopeStops<T>(
  tone: TouchTone,
  profiles: { blue: T; pink: T },
) {
  return profiles[tone];
}

export type TouchCanvasPath = {
  data: string;
  fill: "black" | "none" | "white";
  fillRule: CanvasFillRule;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  miterLimit: number;
  stroke: "black" | "none" | "white";
  strokeWidth: number;
};

function attribute(source: string, name: string) {
  return source.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
}

export function parseTouchCanvasPath(source: string): TouchCanvasPath {
  const fill = attribute(source, "fill") ?? "none";
  const stroke = attribute(source, "stroke") ?? "none";
  const data = attribute(source, "d") ?? "";
  if (!new Set(["black", "none", "white"]).has(fill) ||
      !new Set(["black", "none", "white"]).has(stroke) || !data) {
    throw new TypeError("Touch geometry contains unsupported paint or path data.");
  }
  return {
    data,
    fill: fill as TouchCanvasPath["fill"],
    fillRule: attribute(source, "fill-rule") === "evenodd" ? "evenodd" : "nonzero",
    lineCap: (attribute(source, "stroke-linecap") ?? "butt") as CanvasLineCap,
    lineJoin: (attribute(source, "stroke-linejoin") ?? "miter") as CanvasLineJoin,
    miterLimit: Number(attribute(source, "stroke-miterlimit") ?? 4),
    stroke: stroke as TouchCanvasPath["stroke"],
    strokeWidth: Number(attribute(source, "stroke-width") ?? 1),
  };
}

export function boundedCanvasPixelRatio(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
  maxPixels: number,
) {
  const area = Math.max(1, cssWidth * cssHeight);
  return Math.max(1, Math.min(
    TOUCH_MAX_PIXEL_RATIO,
    Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1,
    Math.sqrt(maxPixels / area),
  ));
}

export function touchCanvasSurfaceOrigin(
  scrollX: number,
  scrollY: number,
  pageDocumentLeft: number,
  pageDocumentTop: number,
) {
  return {
    x: scrollX - pageDocumentLeft,
    y: scrollY - pageDocumentTop,
  };
}

function contains(ranges: TouchToneRange[], value: number) {
  return ranges.some((range) => value >= range.top && value < range.bottom);
}

export function touchToneIntervals(
  top: number,
  bottom: number,
  muted: TouchToneRange[],
  impact: TouchToneRange[],
) {
  const boundaries = Array.from(new Set([
    top,
    bottom,
    ...muted.flatMap((range) => [
      Math.max(top, Math.min(bottom, range.top)),
      Math.max(top, Math.min(bottom, range.bottom)),
    ]),
    ...impact.flatMap((range) => [
      Math.max(top, Math.min(bottom, range.top)),
      Math.max(top, Math.min(bottom, range.bottom)),
    ]),
  ])).sort((first, second) => first - second);

  return boundaries.slice(0, -1).flatMap<TouchToneInterval>((intervalTop, index) => {
    const intervalBottom = boundaries[index + 1];
    if (intervalBottom <= intervalTop) return [];
    const midpoint = intervalTop + (intervalBottom - intervalTop) / 2;
    return [{
      top: intervalTop,
      bottom: intervalBottom,
      // Impact intentionally shares the saturated blue palette with base and
      // overrides a muted ancestor at the exact pixels it occupies.
      tone: contains(impact, midpoint)
        ? "blue"
        : contains(muted, midpoint) ? "pink" : "blue",
    }];
  });
}

/** Prepare only palettes that the visible lens can paint at this point. */
export function touchRequiredTones(
  pointY: number,
  lensDiameter: number,
  muted: TouchToneRange[],
  impact: TouchToneRange[],
) {
  return Array.from(new Set(touchToneIntervals(
    pointY - lensDiameter / 2,
    pointY + lensDiameter / 2,
    muted,
    impact,
  ).map((interval) => interval.tone)));
}

export function evictOldestTouchGeometry<T>(cache: Map<string, T>) {
  while (cache.size >= TOUCH_GEOMETRY_CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) return;
    cache.delete(oldest);
  }
}
