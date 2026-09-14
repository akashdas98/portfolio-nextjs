"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";

type PublicCircuitBackgroundProps = {
  imageUrl: string;
  lensImageUrl?: string;
  sourceWidth: number;
  sourceHeight: number;
};

const LENS_DIAMETER = 615;
const LENS_RADIUS = LENS_DIAMETER / 2;
const BASE_ENVELOPE_RADIUS = 247.5;
const MUTED_SECTION_SELECTOR = ".case-section-muted, .selected-work-section, .about-section, .contact-section";
const IMPACT_SECTION_SELECTOR = ".case-impact-section";
const STATIC_DEPTH_OFFSET = 1;
const STATIC_VECTOR_TILE_SIZE = 512;
const STATIC_MAIN_COLORS: StaticPalette = {
  base: "#0f1115",
  muted: "#090d11",
  impact: "#0e325f",
};
const STATIC_DEPTH_COLORS: StaticPalette = {
  base: "#1c2126",
  muted: "#29323a",
  impact: "#315686",
};

const lensGeometryCache = new Map<string, Promise<LensPath[]>>();

type SourceRegion = { x: number; y: number; width: number; height: number };

type LensPath = {
  source: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type ToneRange = {
  bottom: number;
  top: number;
};

type StaticToneLayout = {
  impact: ToneRange[];
  muted: ToneRange[];
};

type StaticPalette = {
  base: string;
  impact: string;
  muted: string;
};

type EnvelopeStop = {
  offset: number;
  opacity: number;
};

type FlameLobe = {
  circle: SVGCircleElement;
  core: SVGStopElement;
  inner: SVGStopElement;
  shoulder: SVGStopElement;
  tail: SVGStopElement;
  animation: Animation | null;
};

type EdgeLeak = {
  active: boolean;
  amplitude: number;
  angle: number;
  attackDuration: number;
  decayDuration: number;
  startedAt: number;
  wavelength: number;
};

const BLUE_ENVELOPE_STOPS: EnvelopeStop[] = [
  { offset: 0, opacity: 0.96 },
  { offset: 0.08, opacity: 0.94 },
  { offset: 0.3, opacity: 0.82 },
  { offset: 0.5, opacity: 0.62 },
  { offset: 0.68, opacity: 0.38 },
  { offset: 0.8, opacity: 0.2 },
  { offset: 0.9, opacity: 0.08 },
  { offset: 0.96, opacity: 0.01 },
];

const PINK_ENVELOPE_STOPS: EnvelopeStop[] = [
  { offset: 0, opacity: 0.94 },
  { offset: 0.08, opacity: 0.92 },
  { offset: 0.3, opacity: 0.8 },
  { offset: 0.5, opacity: 0.6 },
  { offset: 0.68, opacity: 0.37 },
  { offset: 0.8, opacity: 0.19 },
  { offset: 0.9, opacity: 0.075 },
  { offset: 0.96, opacity: 0.01 },
];

const LOCAL_FLAME_LOBE_COUNT = 10;
const LOCAL_FLAME_LOBES = Array.from(
  { length: LOCAL_FLAME_LOBE_COUNT },
  (_, index) => index,
);
const FLAME_RADIUS_SCALE = 1.8;
const FLAME_MIN_RADIUS = 24 * FLAME_RADIUS_SCALE;
const FLAME_RADIUS_RANGE = 42 * FLAME_RADIUS_SCALE;
const FLAME_LOWER_SIZE_BAND = 0.3;
const FLAME_LOWER_SIZE_PROBABILITY = 0.09;
const FLAME_SPAWN_MIN_DELAY = 72;
const FLAME_SPAWN_DELAY_RANGE = 96;
const EDGE_LEAK_COUNT = 12;
// Four times as many sites distribute the smaller jitters around the perimeter.
const EDGE_TINY_SITE_COUNT = 192;
const EDGE_TINY_LAYERS = 2;
const EDGE_LEAKS = Array.from(
  { length: EDGE_LEAK_COUNT },
  (_, index) => index,
);
const EDGE_LEAK_ATTACK_MIN_DURATION = 22 * 5;
const EDGE_LEAK_ATTACK_DURATION_RANGE = 34 * 5;
const EDGE_LEAK_DECAY_MIN_DURATION = EDGE_LEAK_ATTACK_MIN_DURATION;
const EDGE_LEAK_DECAY_DURATION_RANGE =
  (EDGE_LEAK_ATTACK_MIN_DURATION + EDGE_LEAK_ATTACK_DURATION_RANGE) * 5 -
  EDGE_LEAK_DECAY_MIN_DURATION;
const EDGE_LEAK_SPAWN_MIN_DELAY = 70;
const EDGE_LEAK_SPAWN_DELAY_RANGE = 70;
const EDGE_LARGE_WAVE_PROBABILITY = 0.24;
const EDGE_TINY_FAST_PROBABILITY = 0.8;
const EDGE_TINY_CYCLE_MULTIPLIER = 3.6;
const EDGE_TINY_DURATION_SCALE = 5 / 3;
const EDGE_TINY_MAX_AMPLITUDE = 14;
const EDGE_TINY_MAX_WAVELENGTH = 20;
const EDGE_MAX_DISPLACEMENT = 54;
const POINTER_FOLLOW_RATE = 0.52;
const POINTER_FOLLOW_EPSILON = 0.25;
const POINTER_TRAIL_COUNT = 8;
const POINTER_TRAIL_INTERVAL = 28;
const POINTER_TRAIL_MIN_DISTANCE = 5;
const POINTER_TRAIL_DIAMETER = 260;
const POINTER_TRAIL_DURATION = 560;
const POINTER_TRAILS = Array.from(
  { length: POINTER_TRAIL_COUNT },
  (_, index) => index,
);
const ENVELOPE_WARP_START = 0.68;
// Nested luminance contours transport the envelope itself; no additive edge patch.
const ENVELOPE_CONTOURS = Array.from({ length: 128 }, (_, index) => {
  const offset = (128 - index) / 128;
  const radius = offset * BASE_ENVELOPE_RADIUS;
  return {
    offset,
    path: `M${LENS_RADIUS - radius} ${LENS_RADIUS}a${radius} ${radius} 0 1 0 ${radius * 2} 0a${radius} ${radius} 0 1 0 ${-radius * 2} 0Z`,
    blue: envelopeOpacityAt(BLUE_ENVELOPE_STOPS, offset - 1 / 256),
    pink: envelopeOpacityAt(PINK_ENVELOPE_STOPS, offset - 1 / 256),
  };
});
const ENVELOPE_DIRECTIONS = Array.from({ length: 256 }, (_, index) => {
  const angle = (index / 256) * Math.PI * 2;
  return { angle, x: Math.cos(angle), y: Math.sin(angle) };
});

function sampleTinyWave(wave: EdgeLeak, timestamp: number, seedPhase = false) {
  const fast = Math.random() < EDGE_TINY_FAST_PROBABILITY;
  wave.active = true;
  // Shared size makes small and large silhouettes distinct, with mild aspect variation.
  const size = 0.2 + 0.8 * Math.random();
  wave.amplitude = EDGE_TINY_MAX_AMPLITUDE * size;
  wave.wavelength = EDGE_TINY_MAX_WAVELENGTH * size * (0.85 + Math.random() * 0.15);
  wave.attackDuration = ((fast ? 35 : 70) + Math.random() * (fast ? 35 : 50)) *
    EDGE_TINY_DURATION_SCALE;
  wave.decayDuration = ((fast ? 110 : 210) + Math.random() * (fast ? 100 : 150)) *
    EDGE_TINY_DURATION_SCALE;
  // The 3.6x cycle offsets the 5/3 duration scale, preserving the preceding
  // absolute renewal interval while the visible attack and decay stay slower.
  const cycleDuration = (wave.attackDuration + wave.decayDuration) * EDGE_TINY_CYCLE_MULTIPLIER;
  wave.startedAt = timestamp - (seedPhase ? Math.random() * cycleDuration : 0);
}

function envelopeDisplacements(leaks: EdgeLeak[], timestamp: number, tinyWaves: EdgeLeak[] = []) {
  const displacements = new Array<number>(ENVELOPE_DIRECTIONS.length).fill(0);
  const step = Math.PI * 2 / ENVELOPE_DIRECTIONS.length;
  function addWave(wave: EdgeLeak, limit: number) {
    if (!wave.active) return;
    const elapsed = timestamp - wave.startedAt;
    const progress = elapsed <= wave.attackDuration
      ? elapsed / wave.attackDuration
      : 1 - (elapsed - wave.attackDuration) / wave.decayDuration;
    const amplitude = wave.amplitude * smoothStep(progress);
    const halfAngle = wave.wavelength / BASE_ENVELOPE_RADIUS;
    // Visit only the few directions inside this wave, not every wave at every angle.
    const first = Math.ceil((wave.angle - halfAngle) / step);
    const last = Math.floor((wave.angle + halfAngle) / step);
    for (let sample = first; sample <= last; sample += 1) {
      const index = (sample % displacements.length + displacements.length) % displacements.length;
      const distance = Math.abs(sample * step - wave.angle) / halfAngle;
      const weight = (1 - distance * distance) ** 3;
      displacements[index] += (1 - displacements[index] / limit) * amplitude * weight;
    }
  }
  // Dense tiny waves stay tiny even where they overlap; large waves keep their range.
  tinyWaves.forEach((wave) => addWave(wave, EDGE_TINY_MAX_AMPLITUDE));
  leaks.forEach((wave) => addWave(wave, EDGE_MAX_DISPLACEMENT));
  return displacements;
}

function envelopeContourRadius(offset: number, displacement: number) {
  const radius = offset * BASE_ENVELOPE_RADIUS;
  const distance = Math.max(0, Math.min(EDGE_MAX_DISPLACEMENT, displacement));
  const edgeWeight = smoothStep((offset - ENVELOPE_WARP_START) / (0.8 - ENVELOPE_WARP_START));
  const outerProgress = Math.max(0, (offset - ENVELOPE_WARP_START) / (1 - ENVELOPE_WARP_START));
  // Every jitter transports shape and luminance through the same contour map.
  // Advancing the brighter shoulder contours within the warped edge raises its
  // average brightness; the untouched contour luminances still fade to zero.
  // The quadratic transport is monotone at full strength, and its blend scales
  // linearly with displacement, including the compact lateral/temporal falloff.
  const brightnessTransport = BASE_ENVELOPE_RADIUS * (1 - ENVELOPE_WARP_START) *
    outerProgress * (1 - outerProgress);
  return radius + distance * edgeWeight +
    (distance / EDGE_MAX_DISPLACEMENT) * brightnessTransport;
}

function envelopeContourPath(contour: typeof ENVELOPE_CONTOURS[number], displacements: number[]) {
  const baseRadius = contour.offset * BASE_ENVELOPE_RADIUS;
  const displacementScale = envelopeContourRadius(contour.offset, 1) - baseRadius;
  return ENVELOPE_DIRECTIONS.map(({ x, y }, index) => {
    const radius = baseRadius + displacementScale * displacements[index];
    return `${index === 0 ? "M" : "L"}${(LENS_RADIUS + x * radius).toFixed(2)} ${(LENS_RADIUS + y * radius).toFixed(2)}`;
  }).join("") + "Z";
}

function sampleFlameRadius() {
  const isLowerSize = Math.random() < FLAME_LOWER_SIZE_PROBABILITY;
  const normalizedSize = isLowerSize
    ? Math.random() * FLAME_LOWER_SIZE_BAND
    : FLAME_LOWER_SIZE_BAND +
      Math.random() * (1 - FLAME_LOWER_SIZE_BAND);

  return FLAME_MIN_RADIUS + normalizedSize * FLAME_RADIUS_RANGE;
}

function envelopeOpacityAt(stops: EnvelopeStop[], offset: number) {
  const completeStops = [...stops, { offset: 1, opacity: 0 }];
  const upperIndex = completeStops.findIndex((stop) => stop.offset >= offset);
  if (upperIndex <= 0) return completeStops[0]?.opacity ?? 0;
  const upper = completeStops[upperIndex];
  const lower = completeStops[upperIndex - 1];
  const span = upper.offset - lower.offset;
  const progress = span === 0 ? 0 : (offset - lower.offset) / span;
  return lower.opacity + (upper.opacity - lower.opacity) * progress;
}

function smoothStep(progress: number) {
  const clamped = Math.max(0, Math.min(1, progress));
  return clamped * clamped * (3 - 2 * clamped);
}

function rectPath(top: number, bottom: number, width = LENS_DIAMETER) {
  return `M0 ${top}H${width}V${bottom}H0Z`;
}

function loadLensGeometry(url: string, region: SourceRegion) {
  const params = new URLSearchParams({ source: url });
  for (const [name, value] of Object.entries(region)) params.set(name, String(value));
  const key = params.toString();
  const cached = lensGeometryCache.get(key);
  if (cached) return cached;
  // The server indexes the immutable source once. A device receives only the
  // exact paths needed for its current tile or interaction, with measured-space
  // conservative bounds; it never parses a hidden full-page SVG for getBBox.
  const request = fetch(`/api/pcb?${key}`).then(async (response) => {
    if (!response.ok) throw new Error(`PCB projection failed: ${response.status}`);
    const result = await response.json() as { paths: LensPath[] };
    return result.paths;
  }).catch((error) => {
    lensGeometryCache.delete(key);
    throw error;
  });
  if (lensGeometryCache.size >= 128) {
    const oldest = lensGeometryCache.keys().next().value;
    if (oldest !== undefined) lensGeometryCache.delete(oldest);
  }
  lensGeometryCache.set(key, request);
  return request;
}

function sectionRanges(
  page: HTMLElement,
  pageDocumentTop: number,
  selector: string,
) {
  return Array.from(page.querySelectorAll<HTMLElement>(":scope > section"))
    .filter((section) => section.matches(selector))
    .map((section) => {
      const rect = section.getBoundingClientRect();
      return {
        top: rect.top + window.scrollY - pageDocumentTop,
        bottom: rect.bottom + window.scrollY - pageDocumentTop,
      };
    });
}

function paletteStops(
  pageHeight: number,
  tones: StaticToneLayout,
  palette: StaticPalette,
) {
  const clamp = (value: number) => Math.max(0, Math.min(pageHeight, value));
  const boundaries = Array.from(
    new Set([
      0,
      pageHeight,
      ...tones.muted.flatMap((range) => [clamp(range.top), clamp(range.bottom)]),
      ...tones.impact.flatMap((range) => [clamp(range.top), clamp(range.bottom)]),
    ]),
  ).sort((first, second) => first - second);
  const intervals = boundaries.slice(0, -1).map((top, index) => {
    const bottom = boundaries[index + 1];
    const midpoint = top + (bottom - top) / 2;
    const color = tones.impact.some(
      (range) => midpoint >= range.top && midpoint < range.bottom,
    )
      ? palette.impact
      : tones.muted.some(
            (range) => midpoint >= range.top && midpoint < range.bottom,
          )
        ? palette.muted
        : palette.base;

    return { bottom, color, top };
  });

  return intervals
    .flatMap((interval, index) => {
      const topOffset = interval.top / pageHeight;
      const bottomOffset = interval.bottom / pageHeight;
      const previousColor = intervals[index - 1]?.color;
      return [
        ...(previousColor && previousColor !== interval.color
          ? [`<stop offset="${topOffset}" stop-color="${previousColor}"/>`]
          : []),
        `<stop offset="${topOffset}" stop-color="${interval.color}"/>`,
        `<stop offset="${bottomOffset}" stop-color="${interval.color}"/>`,
      ];
    })
    .join("");
}

function StaticCircuitVector({
  lensImageUrl,
  semanticImageUrl,
  sourceHeight,
  sourceWidth,
}: {
  lensImageUrl: string;
  semanticImageUrl: string;
  sourceHeight: number;
  sourceWidth: number;
}) {
  const artRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const art = artRef.current;
    const page = art?.closest<HTMLElement>("[data-public-circuit]");
    if (!art || !page) return;

    const artElement = art;
    const pageElement = page;
    artElement.dataset.renderState = "initializing";
    let renderVersion = 0;
    let layoutFrame: number | null = null;
    let previousLayoutKey = "";
    const allocatedObjectUrls = new Set<string>();

    async function renderLayout() {
      const pageRect = pageElement.getBoundingClientRect();
      const pageWidth = pageRect.width;
      const pageHeight = pageElement.offsetHeight;
      const pageDocumentTop = pageRect.top + window.scrollY;
      const renderScale = Math.max(
        pageWidth / sourceWidth,
        pageHeight / sourceHeight,
      );
      const renderLeft = (pageWidth - sourceWidth * renderScale) / 2;
      const tones: StaticToneLayout = {
        muted: sectionRanges(
          pageElement,
          pageDocumentTop,
          MUTED_SECTION_SELECTOR,
        ),
        impact: sectionRanges(
          pageElement,
          pageDocumentTop,
          IMPACT_SECTION_SELECTOR,
        ),
      };
      const layoutKey = JSON.stringify({
        pageWidth: Math.round(pageWidth * 10) / 10,
        pageHeight,
        tones,
      });
      if (layoutKey === previousLayoutKey) return;
      previousLayoutKey = layoutKey;
      const version = ++renderVersion;
      const renderStartedAt = performance.now();
      artElement.dataset.renderState = "rendering-vector";
      const width = Math.max(1, pageWidth);
      const height = Math.max(1, pageHeight);
      const mainStops = paletteStops(height, tones, STATIC_MAIN_COLORS);
      const depthStops = paletteStops(height, tones, STATIC_DEPTH_COLORS);
      const objectUrls: string[] = [];
      const images: HTMLImageElement[] = [];
      const initialLayout = artElement.childElementCount === 0;
      const tiles: Array<{ top: number; left: number }> = [];
      for (let top = 0; top < height; top += STATIC_VECTOR_TILE_SIZE) {
        for (let left = 0; left < width; left += STATIC_VECTOR_TILE_SIZE) {
          tiles.push({ top, left });
        }
      }
      // First paint is local: decoding below-fold art cannot hold the viewport
      // hostage. Replacement layouts remain atomic so resizing never mixes two
      // differently aligned projections. At most two local resources are in flight.
      async function renderTiles() {
        while (tiles.length && version === renderVersion) {
          const viewportTop = window.scrollY - pageDocumentTop;
          tiles.sort((a, b) => {
            const distance = (tile: { top: number }) => Math.max(
              0, viewportTop - tile.top - STATIC_VECTOR_TILE_SIZE,
              tile.top - viewportTop - window.innerHeight,
            );
            return distance(a) - distance(b) || a.top - b.top || a.left - b.left;
          });
          const { top, left } = tiles.shift()!;
          const tileWidth = Math.min(STATIC_VECTOR_TILE_SIZE, width - left);
          const tileHeight = Math.min(STATIC_VECTOR_TILE_SIZE, height - top);
          const localPaths = await loadLensGeometry(lensImageUrl, {
            x: (left - renderLeft - 1) / renderScale,
            y: (top - STATIC_DEPTH_OFFSET - 1) / renderScale,
            width: (tileWidth + 2) / renderScale,
            height: (tileHeight + STATIC_DEPTH_OFFSET + 2) / renderScale,
          });
          if (version !== renderVersion) return;
          const positive = localPaths.filter((path) => !path.source.includes('="black"'))
            .map((path) => path.source).join("");
          const negative = localPaths.filter((path) => path.source.includes('="black"'))
            .map((path) => path.source).join("");
          // A mixed-paint path must retain the original ordered luminance
          // semantics. Normal prepared assets separate positive and cutout paths.
          const mixedPaint = localPaths.some((path) => path.source.includes('="black"') && path.source.includes('="white"'));
          const bounds = `x="${left}" y="${top}" width="${tileWidth}" height="${tileHeight}"`;
          let definitions = "";
          let paint = "";
          for (const layer of ["depth", "main"] as const) {
            const offset = layer === "depth" ? STATIC_DEPTH_OFFSET : 0;
            const transform = `translate(${renderLeft} ${offset}) scale(${renderScale})`;
            const maskBody = mixedPaint
              ? `<g transform="${transform}">${localPaths.map((path) => path.source).join("")}</g>`
              : `<rect ${bounds} fill="white"/><g transform="${transform}">${negative}</g>`;
            definitions += `<mask id="${layer}" ${bounds} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" style="mask-type:luminance">${maskBody}</mask>`;
            // Put the palette in the same coordinate space as its direct paint.
            definitions += `<linearGradient id="${layer}-palette" x1="0" y1="${mixedPaint ? 0 : -offset / renderScale}" x2="0" y2="${mixedPaint ? height : (height - offset) / renderScale}" gradientUnits="userSpaceOnUse">${layer === "depth" ? depthStops : mainStops}</linearGradient>`;
            paint += mixedPaint
              ? `<rect ${bounds} fill="url(#${layer}-palette)" mask="url(#${layer})"/>`
              : `<g mask="url(#${layer})"><g transform="${transform}">${positive.replaceAll('="white"', `="url(#${layer}-palette)"`)}</g></g>`;
          }
          const projection = `<svg xmlns="http://www.w3.org/2000/svg" width="${tileWidth}" height="${tileHeight}" viewBox="${left} ${top} ${tileWidth} ${tileHeight}" preserveAspectRatio="none"><defs>${definitions}</defs>${paint}</svg>`;
          const objectUrl = URL.createObjectURL(new Blob([projection], { type: "image/svg+xml" }));
          objectUrls.push(objectUrl);
          allocatedObjectUrls.add(objectUrl);
          const image = document.createElement("img");
          image.className = "public-circuit-art-vector";
          image.alt = "";
          image.decoding = "async";
          image.draggable = false;
          image.style.top = `${top}px`;
          image.style.left = `${left}px`;
          image.style.width = `${tileWidth}px`;
          image.style.height = `${tileHeight}px`;
          image.style.bottom = "auto";
          image.style.right = "auto";
          image.src = objectUrl;
          images.push(image);
          await image.decode();
          if (version !== renderVersion) return;
          if (initialLayout) {
            artElement.append(image);
            if (!artElement.dataset.firstTileMs) {
              artElement.dataset.firstTileMs = String(Math.round(performance.now()));
            }
          }
        }
      }
      const results = await Promise.allSettled([renderTiles(), renderTiles()]);
      if (version !== renderVersion) return;
      const failure = results.find((result) => result.status === "rejected");
      if (failure?.status === "rejected") {
        // Keep the previous layout or any decoded initial tiles. A later layout
        // retry or unmount releases all allocated resources, including failures.
        previousLayoutKey = "";
        artElement.dataset.renderState = "error";
        artElement.dataset.renderError = failure.reason instanceof Error
          ? failure.reason.message : "PCB projection failed.";
        return;
      }

      artElement.replaceChildren(...images);
      artElement.classList.add("is-ready");
      artElement.dataset.renderState = "ready";
      artElement.dataset.renderDurationMs = String(
        Math.round((performance.now() - renderStartedAt) * 10) / 10,
      );
      for (const url of allocatedObjectUrls) {
        if (!objectUrls.includes(url)) {
          URL.revokeObjectURL(url);
          allocatedObjectUrls.delete(url);
        }
      }
    }

    function scheduleLayout() {
      if (layoutFrame !== null) return;
      layoutFrame = window.requestAnimationFrame(() => {
        layoutFrame = null;
        void renderLayout();
      });
    }

    const resizeObserver = new ResizeObserver(scheduleLayout);
    resizeObserver.observe(pageElement);
    window.addEventListener("resize", scheduleLayout);
    scheduleLayout();

    return () => {
      renderVersion += 1;
      if (layoutFrame !== null) window.cancelAnimationFrame(layoutFrame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleLayout);
      artElement.replaceChildren();
      allocatedObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [lensImageUrl, sourceHeight, sourceWidth]);

  return (
    <div
      ref={artRef}
      className="public-circuit-art"
      data-semantic-source={semanticImageUrl}
      aria-hidden="true"
    />
  );
}

type InitialPointerInput = {
  clientX: number;
  clientY: number;
  pointerType: string;
};

export function PublicCircuitBackground(props: PublicCircuitBackgroundProps) {
  const [interactionMounted, setInteractionMounted] = useState(false);
  const initialInput = useRef<InitialPointerInput | null>(null);
  useEffect(() => {
    if (interactionMounted || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    function requestPointerInteraction(event: PointerEvent) {
      if (event.pointerType === "touch") return;
      initialInput.current = {
        clientX: event.clientX,
        clientY: event.clientY,
        pointerType: event.pointerType,
      };
      setInteractionMounted(true);
    }
    function leavePointer() {
      initialInput.current = null;
    }
    // The initial server/client tree contains only the static art host. The
    // decorative interaction shell is an enhancement, mounted once on demand;
    // capture the first input so mounting cannot discard that interaction.
    const warmup = window.matchMedia("(hover: hover) and (pointer: fine)").matches
      ? window.setTimeout(() => setInteractionMounted(true), 1_200) : null;
    window.addEventListener("pointermove", requestPointerInteraction, { passive: true });
    window.addEventListener("pointerleave", leavePointer);
    return () => {
      if (warmup !== null) window.clearTimeout(warmup);
      window.removeEventListener("pointermove", requestPointerInteraction);
      window.removeEventListener("pointerleave", leavePointer);
    };
  }, [interactionMounted]);
  return <>
    <StaticCircuitVector
      lensImageUrl={props.lensImageUrl ?? props.imageUrl}
      semanticImageUrl={props.imageUrl}
      sourceHeight={props.sourceHeight}
      sourceWidth={props.sourceWidth}
    />
    {interactionMounted && <CircuitInteraction {...props} initialInput={initialInput} />}
  </>;
}

function CircuitInteraction({
  imageUrl,
  lensImageUrl = imageUrl,
  sourceWidth,
  sourceHeight,
  initialInput,
}: PublicCircuitBackgroundProps & { initialInput: RefObject<InitialPointerInput | null> }) {
  const instanceId = useId().replaceAll(":", "");
  const lensRef = useRef<SVGSVGElement>(null);
  const blueEnvelopeRef = useRef<SVGGElement>(null);
  const pinkEnvelopeRef = useRef<SVGGElement>(null);
  const pointerTrailRefs = useRef<Array<HTMLDivElement | null>>([]);
  const globalFlameRef = useRef<SVGRectElement>(null);
  const geometryTransformRef = useRef<SVGGElement>(null);
  const geometryRef = useRef<SVGGElement>(null);
  const baseClipRef = useRef<SVGPathElement>(null);
  const mutedClipRef = useRef<SVGPathElement>(null);
  const blueEnvelopeMaskId = `${instanceId}-circuit-blue-envelope-mask`;
  const pinkEnvelopeMaskId = `${instanceId}-circuit-pink-envelope-mask`;
  const localFlameMaskId = `${instanceId}-circuit-local-flame-mask`;
  const geometrySourceId = `${instanceId}-circuit-geometry-source`;
  const pointerTrailEnvelopeMaskIds = POINTER_TRAILS.map(
    (index) => `${instanceId}-circuit-trail-envelope-${index}`,
  );
  const pointerTrailGeometryMaskIds = POINTER_TRAILS.map(
    (index) => `${instanceId}-circuit-trail-geometry-${index}`,
  );
  const localFlameGradientIds = LOCAL_FLAME_LOBES.map(
    (index) => `${instanceId}-circuit-local-flame-${index}`,
  );
  const baseClipId = `${instanceId}-circuit-base-tone`;
  const geometryMaskId = `${instanceId}-circuit-geometry`;
  const mutedClipId = `${instanceId}-circuit-muted-tone`;

  useEffect(() => {
    const lens = lensRef.current;
    const blueEnvelope = blueEnvelopeRef.current;
    const pinkEnvelope = pinkEnvelopeRef.current;
    const globalFlame = globalFlameRef.current;
    const geometryTransform = geometryTransformRef.current;
    const geometry = geometryRef.current;
    const baseClip = baseClipRef.current;
    const mutedClip = mutedClipRef.current;
    const page = lens?.closest<HTMLElement>("[data-public-circuit]");
    if (
      !lens ||
      !blueEnvelope ||
      !pinkEnvelope ||
      !globalFlame ||
      !geometryTransform ||
      !geometry ||
      !baseClip ||
      !mutedClip ||
      !page
    ) {
      return;
    }

    const pageElement = page;
    const lensElement = lens;
    const globalFlameElement = globalFlame;
    const geometryTransformElement = geometryTransform;
    const geometryElement = geometry;
    const baseClipElement = baseClip;
    const mutedClipElement = mutedClip;
    const baseToneElement = lensElement.querySelector<SVGGElement>('[data-circuit-tone="base"]');
    const mutedToneElement = lensElement.querySelector<SVGGElement>('[data-circuit-tone="muted"]');
    const pointerTrails = pointerTrailRefs.current.filter(
      (trail): trail is HTMLDivElement => trail !== null,
    );
    const pointerTrailAnimations: Array<Animation | null> = pointerTrails.map(() => null);
    const flameLobes: FlameLobe[] = Array.from(
      lensElement.querySelectorAll<SVGCircleElement>("[data-flame-lobe]"),
    )
      .map<FlameLobe | null>((circle) => {
        const index = circle.dataset.flameLobe;
        const core = lensElement.querySelector<SVGStopElement>(
          `[data-flame-core="${index}"]`,
        );
        const inner = lensElement.querySelector<SVGStopElement>(
          `[data-flame-inner="${index}"]`,
        );
        const shoulder = lensElement.querySelector<SVGStopElement>(
          `[data-flame-shoulder="${index}"]`,
        );
        const tail = lensElement.querySelector<SVGStopElement>(
          `[data-flame-tail="${index}"]`,
        );

        return core && inner && shoulder && tail
          ? { circle, core, inner, shoulder, tail, animation: null }
          : null;
      })
      .filter((lobe): lobe is FlameLobe => lobe !== null);
    const edgeLeaks: EdgeLeak[] = EDGE_LEAKS.map(() => ({
      active: false,
      amplitude: 0,
      angle: 0,
      attackDuration: 0,
      decayDuration: 0,
      startedAt: 0,
      wavelength: 0,
    }));
    const envelopeContours = ENVELOPE_CONTOURS.map((contour, index) => ({
      ...contour,
      elements: Array.from(
        lensElement.querySelectorAll<SVGPathElement>(
          `[data-envelope-contour="${index}"]`,
        ),
      ),
    }));
    function resetEnvelope() {
      envelopeContours.forEach(({ elements, path }) => {
        elements.forEach((element) => element.setAttribute("d", path));
      });
    }
    const tinyWaves: EdgeLeak[] = Array.from(
      { length: EDGE_TINY_SITE_COUNT * EDGE_TINY_LAYERS },
      (_, index) => ({
        active: false, amplitude: 0,
        angle: ((index % EDGE_TINY_SITE_COUNT) / EDGE_TINY_SITE_COUNT) * Math.PI * 2,
        attackDuration: 0, decayDuration: 0, startedAt: 0, wavelength: 0,
      }),
    );
    let flameTimer: number | null = null;
    let edgeLeakTimer: number | null = null;
    let edgeEnvelopeFrame: number | null = null;
    let globalFlameTimer: number | null = null;
    let globalFlameAnimation: Animation | null = null;
    let layoutFrame: number | null = null;
    let pointerFrame: number | null = null;
    let pageDocumentLeft = 0;
    let pageDocumentTop = 0;
    let renderLeft = 0;
    let renderScale = 1;
    let geometryReady = false;
    let pageLayoutWidth = 0;
    let pageLayoutHeight = 0;
    let previousLensPosition = "";
    let previousLensClip = "";
    let scrollLeft = window.scrollX;
    let scrollTop = window.scrollY;
    let geometryVersion = 0;
    let previousGeometryLayout = "";
    let lensPaths: { geometry: LensPath; element: SVGPathElement; visible: boolean }[] = [];
    let disposed = false;
    const enableLens = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let latestClientX = -LENS_DIAMETER;
    let latestClientY = -LENS_DIAMETER;
    let renderedClientX: number | null = null;
    let renderedClientY: number | null = null;
    let interactionMode: "none" | "mouse" = "none";
    let pointerTrailEnabled = false;
    let lensWarmupTimer: number | null = null;
    let nextPointerTrail = 0;
    let lastPointerTrailAt = 0;
    let lastPointerTrailX = -LENS_DIAMETER;
    let lastPointerTrailY = -LENS_DIAMETER;
    let toneRanges: ToneRange[] = [];
    let previousBaseClip = "";
    let previousMutedClip = "";

    function stopFlame() {
      if (flameTimer !== null) {
        window.clearTimeout(flameTimer);
        flameTimer = null;
      }
      if (edgeLeakTimer !== null) {
        window.clearTimeout(edgeLeakTimer);
        edgeLeakTimer = null;
      }
      if (globalFlameTimer !== null) {
        window.clearTimeout(globalFlameTimer);
        globalFlameTimer = null;
      }
      globalFlameAnimation?.cancel();
      globalFlameAnimation = null;
      globalFlameElement.style.opacity = "0";

      flameLobes.forEach((lobe) => {
        lobe.animation?.cancel();
        lobe.animation = null;
        lobe.circle.style.opacity = "0";
      });
      edgeLeaks.forEach((lobe) => {
        lobe.active = false;
      });
      tinyWaves.forEach((wave) => { wave.active = false; });
      resetEnvelope();
      if (edgeEnvelopeFrame !== null) {
        window.cancelAnimationFrame(edgeEnvelopeFrame);
        edgeEnvelopeFrame = null;
      }
    }

    function stopPointerTrail() {
      pointerTrailAnimations.forEach((animation, index) => {
        animation?.cancel();
        pointerTrailAnimations[index] = null;
        const paint = pointerTrails[index]?.firstElementChild as HTMLElement | null;
        if (paint) paint.style.opacity = "0";
      });
      lastPointerTrailAt = 0;
      lastPointerTrailX = -LENS_DIAMETER;
      lastPointerTrailY = -LENS_DIAMETER;
    }

    function hideLens() {
      stopFlame();
      stopPointerTrail();
      interactionMode = "none";
      pointerTrailEnabled = false;
      renderedClientX = null;
      renderedClientY = null;
      lensElement.style.removeProperty("transition");
      lensElement.style.removeProperty("opacity");
      lensElement.classList.remove("is-active", "is-trailing");
    }

    function emitPointerTrail(clientX: number, clientY: number, localY: number) {
      const timestamp = performance.now();
      if (
        timestamp - lastPointerTrailAt < POINTER_TRAIL_INTERVAL ||
        Math.hypot(clientX - lastPointerTrailX, clientY - lastPointerTrailY) <
          POINTER_TRAIL_MIN_DISTANCE
      ) {
        return;
      }

      const index = nextPointerTrail;
      const trail = pointerTrails[index];
      const paint = trail?.firstElementChild as SVGSVGElement | null;
      const geometryTransform = trail?.querySelector<SVGGElement>(
        "[data-pointer-trail-geometry]",
      );
      if (!trail || !paint || !geometryTransform) return;
      nextPointerTrail = (nextPointerTrail + 1) % pointerTrails.length;
      lastPointerTrailAt = timestamp;
      lastPointerTrailX = clientX;
      lastPointerTrailY = clientY;
      trail.style.transform = `translate3d(${clientX - POINTER_TRAIL_DIAMETER / 2}px, ${clientY - POINTER_TRAIL_DIAMETER / 2}px, 0)`;
      const localX = clientX + scrollLeft - pageDocumentLeft;
      geometryTransform.setAttribute(
        "transform",
        `translate(${-(localX - POINTER_TRAIL_DIAMETER / 2)} ${-(localY - POINTER_TRAIL_DIAMETER / 2)})`,
      );
      trail.dataset.tone = toneRanges.some(
        (range) => localY >= range.top && localY <= range.bottom,
      )
        ? "muted"
        : "base";
      pointerTrailAnimations[index]?.cancel();
      const animation = paint.animate(
        [
          { opacity: 0.48, transform: "scale(0.92)", offset: 0 },
          { opacity: 0.22, transform: "scale(0.98)", offset: 0.38 },
          { opacity: 0, transform: "scale(1.04)", offset: 1 },
        ],
        { duration: POINTER_TRAIL_DURATION, easing: "ease-out" },
      );
      pointerTrailAnimations[index] = animation;
      animation.onfinish = () => {
        if (pointerTrailAnimations[index] !== animation) return;
        pointerTrailAnimations[index] = null;
        paint.style.opacity = "0";
      };
    }

    function paintFlame() {
      flameTimer = null;
      const availableLobes = flameLobes.filter(
        (lobe) => lobe.animation === null,
      );
      const lobe =
        availableLobes[Math.floor(Math.random() * availableLobes.length)];

      if (lobe) {
        const maximumDistance = BASE_ENVELOPE_RADIUS * 0.82;
        const centralPlacement = Math.random() < 0.4;
        const placementRadius = centralPlacement ? 72 : maximumDistance;
        const distance = Math.sqrt(Math.random()) * placementRadius;
        const angle = Math.random() * Math.PI * 2;
        const centralBoost = Math.max(0, 1 - distance / 72);
        const isRise = Math.random() < 0.6;
        const opacity = isRise
          ? Math.min(1, 0.78 + Math.random() * 0.18 + centralBoost * 0.04)
          : 0.057 + Math.random() * 0.05 + centralBoost * 0.043;
        const color = isRise ? "#fff" : "#000";
        const attackDuration = 45 + Math.random() * 45;
        const fadeDuration = 720 + Math.random() * 480;
        const totalDuration = attackDuration + fadeDuration;
        const attackOffset = attackDuration / totalDuration;

        lobe.circle.style.mixBlendMode = isRise ? "screen" : "multiply";
        lobe.circle.setAttribute(
          "cx",
          String(LENS_RADIUS + Math.cos(angle) * distance),
        );
        lobe.circle.setAttribute(
          "cy",
          String(LENS_RADIUS + Math.sin(angle) * distance),
        );
        lobe.circle.setAttribute("r", String(sampleFlameRadius()));
        lobe.core.setAttribute("stop-color", color);
        lobe.core.setAttribute("stop-opacity", opacity.toFixed(3));
        lobe.inner.setAttribute("stop-color", color);
        lobe.inner.setAttribute(
          "stop-opacity",
          (opacity * 0.82).toFixed(3),
        );
        lobe.shoulder.setAttribute("stop-color", color);
        lobe.shoulder.setAttribute(
          "stop-opacity",
          (opacity * 0.34).toFixed(3),
        );
        lobe.tail.setAttribute("stop-color", color);
        lobe.tail.setAttribute(
          "stop-opacity",
          (opacity * 0.075).toFixed(3),
        );

        lobe.circle.style.opacity = "0";
        const animation = lobe.circle.animate(
          [
            { opacity: 0, offset: 0 },
            { opacity: 1, offset: attackOffset },
            { opacity: 0.72, offset: attackOffset + (1 - attackOffset) * 0.3 },
            { opacity: 0.34, offset: attackOffset + (1 - attackOffset) * 0.7 },
            { opacity: 0, offset: 1 },
          ],
          {
            duration: totalDuration,
            easing: "linear",
          },
        );
        lobe.animation = animation;
        animation.onfinish = () => {
          if (lobe.animation !== animation) return;
          lobe.animation = null;
          lobe.circle.style.opacity = "0";
        };
      }

      flameTimer = window.setTimeout(
        paintFlame,
        FLAME_SPAWN_MIN_DELAY + Math.random() * FLAME_SPAWN_DELAY_RANGE,
      );
    }

    function paintEdgeEnvelope(timestamp: number) {
      edgeEnvelopeFrame = null;
      edgeLeaks.forEach((leak) => {
        if (timestamp - leak.startedAt >= leak.attackDuration + leak.decayDuration) {
          leak.active = false;
        }
      });
      tinyWaves.forEach((wave) => {
        if (!wave.active || timestamp - wave.startedAt >= (wave.attackDuration + wave.decayDuration) * EDGE_TINY_CYCLE_MULTIPLIER) {
          sampleTinyWave(wave, timestamp, !wave.active);
        }
      });
      const displacements = envelopeDisplacements(edgeLeaks, timestamp, tinyWaves);
      envelopeContours.forEach((contour) => {
        if (contour.offset <= ENVELOPE_WARP_START) return;
        const path = envelopeContourPath(contour, displacements);
        contour.elements.forEach((element) => element.setAttribute("d", path));
      });
      edgeEnvelopeFrame = window.requestAnimationFrame(paintEdgeEnvelope);
    }

    function paintEdgeLeak() {
      edgeLeakTimer = null;
      // Tiny waves renew independently in the frame loop; this timer owns large waves.
      if (Math.random() < EDGE_LARGE_WAVE_PROBABILITY) {
        const leak = edgeLeaks.find((candidate) => !candidate.active);
        if (leak) {
          leak.active = true;
          leak.angle = Math.random() * Math.PI * 2;
          leak.wavelength = 9.75 + Math.random() * 23.25;
          leak.amplitude = 15 + Math.random() * 39;
          leak.attackDuration = EDGE_LEAK_ATTACK_MIN_DURATION + Math.random() * EDGE_LEAK_ATTACK_DURATION_RANGE;
          leak.decayDuration = EDGE_LEAK_DECAY_MIN_DURATION + Math.random() * EDGE_LEAK_DECAY_DURATION_RANGE;
          leak.startedAt = performance.now();
        }
      }
      if (edgeEnvelopeFrame === null) {
        edgeEnvelopeFrame = window.requestAnimationFrame(paintEdgeEnvelope);
      }

      edgeLeakTimer = window.setTimeout(
        paintEdgeLeak,
        EDGE_LEAK_SPAWN_MIN_DELAY +
          Math.random() * EDGE_LEAK_SPAWN_DELAY_RANGE,
      );
    }

    function paintGlobalFlame() {
      globalFlameTimer = null;
      const isRise = Math.random() < 0.56;
      const peakOpacity = isRise
        ? 0.16 + Math.random() * 0.16
        : 0.06 + Math.random() * 0.06;
      const attackDuration = 36 + Math.random() * 42;
      const fadeDuration = 190 + Math.random() * 250;
      const totalDuration = attackDuration + fadeDuration;

      globalFlameElement.setAttribute("fill", isRise ? "#fff" : "#000");
      globalFlameElement.style.mixBlendMode = isRise ? "screen" : "multiply";
      globalFlameElement.style.opacity = "0";

      const animation = globalFlameElement.animate(
        [
          { opacity: 0, offset: 0 },
          { opacity: peakOpacity, offset: attackDuration / totalDuration },
          { opacity: peakOpacity * 0.48, offset: 0.58 },
          { opacity: 0, offset: 1 },
        ],
        {
          duration: totalDuration,
          easing: "linear",
        },
      );
      globalFlameAnimation = animation;
      animation.onfinish = () => {
        if (globalFlameAnimation !== animation) return;
        globalFlameAnimation = null;
        globalFlameElement.style.opacity = "0";
        globalFlameTimer = window.setTimeout(
          paintGlobalFlame,
          45 + Math.random() * 120,
        );
      };
    }

    function startFlame() {
      if (flameTimer === null) paintFlame();
      if (edgeLeakTimer === null) paintEdgeLeak();
      if (globalFlameTimer === null && globalFlameAnimation === null) {
        paintGlobalFlame();
      }
    }

    function rebuildLayout() {
      const pageRect = pageElement.getBoundingClientRect();
      scrollLeft = window.scrollX;
      scrollTop = window.scrollY;
      pageDocumentLeft = pageRect.left + scrollLeft;
      pageDocumentTop = pageRect.top + scrollTop;

      const pageWidth = pageRect.width;
      const pageHeight = pageElement.offsetHeight;
      pageLayoutWidth = pageWidth;
      pageLayoutHeight = pageHeight;
      renderScale = Math.max(pageWidth / sourceWidth, pageHeight / sourceHeight);
      renderLeft = (pageWidth - sourceWidth * renderScale) / 2;
      if (enableLens && interactionMode !== "none") {
        void rebuildLensGeometry(pageWidth, pageHeight, renderScale, renderLeft);
      }

      const mutedSections = Array.from(
        pageElement.querySelectorAll<HTMLElement>(":scope > section"),
      ).filter((section) => section.matches(MUTED_SECTION_SELECTOR));
      toneRanges = mutedSections.map((section) => {
        const sectionRect = section.getBoundingClientRect();

        return {
          top: sectionRect.top + window.scrollY - pageDocumentTop,
          bottom: sectionRect.bottom + window.scrollY - pageDocumentTop,
        };
      });
    }

    async function rebuildLensGeometry(width: number, height: number, scale: number, offset: number) {
      const key = `${width}:${height}:full`;
      if (key === previousGeometryLayout) return;
      previousGeometryLayout = key;
      const version = ++geometryVersion;
      geometryReady = false;
      try {
        const paths = await loadLensGeometry(lensImageUrl, {
          x: -4,
          y: -4,
          width: sourceWidth + 8,
          height: sourceHeight + 8,
        });
        if (disposed || version !== geometryVersion) return;
        geometryElement.innerHTML = paths.map((path) => path.source).join("");
        lensPaths = Array.from(
          geometryElement.querySelectorAll<SVGPathElement>("path"),
          (element, index) => {
            element.style.display = "none";
            return { geometry: paths[index], element, visible: false };
          },
        );
        geometryElement.setAttribute("transform", `translate(${offset} 0) scale(${scale})`);
        geometryReady = true;
        if (latestClientX > -LENS_DIAMETER) schedulePointerPaint();
      } catch {
        if (version === geometryVersion) {
          previousGeometryLayout = "";
          geometryReady = false;
          hideLens();
        }
      }
    }

    function scheduleLayoutRefresh() {
      if (layoutFrame !== null) return;
      layoutFrame = window.requestAnimationFrame(() => {
        layoutFrame = null;
        rebuildLayout();
      });
    }

    function ensureLensGeometry() {
      if (!enableLens) return;
      void rebuildLensGeometry(pageLayoutWidth, pageLayoutHeight, renderScale, renderLeft);
    }

    function updateToneClips(lensTop: number) {
      const overlaps = toneRanges
        .map((range) => ({
          top: Math.max(0, range.top - lensTop),
          bottom: Math.min(LENS_DIAMETER, range.bottom - lensTop),
        }))
        .filter((range) => range.bottom > range.top)
        .sort((first, second) => first.top - second.top);

      let cursor = 0;
      let basePath = "";
      let mutedPath = "";
      overlaps.forEach((range) => {
        if (range.top > cursor) basePath += rectPath(cursor, range.top);
        mutedPath += rectPath(range.top, range.bottom);
        cursor = Math.max(cursor, range.bottom);
      });
      if (cursor < LENS_DIAMETER) {
        basePath += rectPath(cursor, LENS_DIAMETER);
      }

      if (basePath !== previousBaseClip) {
        baseClipElement.setAttribute("d", basePath);
        if (baseToneElement) baseToneElement.style.display = basePath ? "" : "none";
        previousBaseClip = basePath;
      }
      if (mutedPath !== previousMutedClip) {
        mutedClipElement.setAttribute("d", mutedPath);
        if (mutedToneElement) mutedToneElement.style.display = mutedPath ? "" : "none";
        previousMutedClip = mutedPath;
      }
    }

    function paintPointer() {
      pointerFrame = null;
      if (interactionMode === "none") return;

      if (renderedClientX === null || renderedClientY === null) {
        renderedClientX = latestClientX;
        renderedClientY = latestClientY;
      }

      const distanceX = latestClientX - renderedClientX;
      const distanceY = latestClientY - renderedClientY;
      const isFollowing = Math.hypot(distanceX, distanceY) > POINTER_FOLLOW_EPSILON;
      if (isFollowing) {
        renderedClientX += distanceX * POINTER_FOLLOW_RATE;
        renderedClientY += distanceY * POINTER_FOLLOW_RATE;
      } else {
        renderedClientX = latestClientX;
        renderedClientY = latestClientY;
      }

      const localX = renderedClientX + scrollLeft - pageDocumentLeft;
      const localY = renderedClientY + scrollTop - pageDocumentTop;
      const lensLeft = localX - LENS_RADIUS;
      const lensTop = localY - LENS_RADIUS;

      const position = `translate3d(${renderedClientX - LENS_RADIUS}px, ${renderedClientY - LENS_RADIUS}px, 0)`;
      if (position !== previousLensPosition) {
        lensElement.style.transform = position;
        previousLensPosition = position;
      }
      const clip = `inset(${Math.max(0, -lensTop)}px ${Math.max(0, lensLeft + LENS_DIAMETER - pageLayoutWidth)}px ${Math.max(0, lensTop + LENS_DIAMETER - pageLayoutHeight)}px ${Math.max(0, -lensLeft)}px)`;
      if (clip !== previousLensClip) {
        lensElement.style.clipPath = clip;
        previousLensClip = clip;
      }
      geometryTransformElement.setAttribute(
        "transform",
        `translate(${-lensLeft} ${-lensTop})`,
      );
      const sourceLeft = (lensLeft - renderLeft) / renderScale;
      const sourceTop = lensTop / renderScale;
      const sourceSize = LENS_DIAMETER / renderScale;
      lensPaths.forEach((path) => {
        const visible = path.geometry.right >= sourceLeft &&
          path.geometry.left <= sourceLeft + sourceSize &&
          path.geometry.bottom >= sourceTop && path.geometry.top <= sourceTop + sourceSize;
        if (visible !== path.visible) {
          path.element.style.display = visible ? "" : "none";
          path.visible = visible;
        }
      });
      updateToneClips(lensTop);

      if (geometryReady) {
        lensElement.classList.add("is-active");
        lensElement.classList.toggle("is-trailing", isFollowing);
        if (isFollowing && pointerTrailEnabled) {
          emitPointerTrail(renderedClientX, renderedClientY, localY);
        }
      }
      if (isFollowing) schedulePointerPaint();
    }

    function schedulePointerPaint() {
      if (pointerFrame === null) {
        pointerFrame = window.requestAnimationFrame(paintPointer);
      }
    }

    function activatePointer(clientX: number, clientY: number, pointerType: string) {
      if (pointerType === "touch") return;
      lensElement.style.removeProperty("transition");
      lensElement.style.removeProperty("opacity");
      interactionMode = "mouse";
      pointerTrailEnabled = pointerType === "mouse";
      latestClientX = clientX;
      latestClientY = clientY;
      ensureLensGeometry();
      schedulePointerPaint();
      startFlame();
    }

    function handlePointerMove(event: PointerEvent) {
      activatePointer(event.clientX, event.clientY, event.pointerType);
    }

    function handleScroll() {
      // Read before animation-frame SVG writes; reading scroll offsets after
      // path mutations forces synchronous style/layout during the same frame.
      scrollLeft = window.scrollX;
      scrollTop = window.scrollY;
      if (interactionMode === "mouse") {
        schedulePointerPaint();
      }
    }

    function handlePointerLeave(event: PointerEvent) {
      if (event.pointerType === "touch") {
        return;
      }
      hideLens();
    }

    rebuildLayout();
    const resizeObserver = new ResizeObserver(scheduleLayoutRefresh);
    resizeObserver.observe(pageElement);
    window.addEventListener("resize", scheduleLayoutRefresh);

    if (!enableLens) {
      return () => {
        if (layoutFrame !== null) window.cancelAnimationFrame(layoutFrame);
        resizeObserver.disconnect();
        window.removeEventListener("resize", scheduleLayoutRefresh);
      };
    }

    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      lensWarmupTimer = window.setTimeout(ensureLensGeometry, 1_200);
    }
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("scroll", handleScroll, { passive: true });
    const firstInput = initialInput.current;
    // Strict Mode repeats effect setup/cleanup in development. Clear the replay
    // only after setup survives that cycle, otherwise the first contact is lost.
    const clearInitialInput = window.setTimeout(() => { initialInput.current = null; }, 0);
    if (firstInput) {
      activatePointer(firstInput.clientX, firstInput.clientY, firstInput.pointerType);
    }

    return () => {
      window.clearTimeout(clearInitialInput);
      disposed = true;
      hideLens();
      if (lensWarmupTimer !== null) window.clearTimeout(lensWarmupTimer);
      if (layoutFrame !== null) window.cancelAnimationFrame(layoutFrame);
      if (pointerFrame !== null) window.cancelAnimationFrame(pointerFrame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleLayoutRefresh);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("scroll", handleScroll);
      geometryVersion += 1;
      geometryElement.replaceChildren();
    };
  }, [initialInput, lensImageUrl, sourceHeight, sourceWidth]);

  return (
    <>
      {POINTER_TRAILS.map((index) => (
        <div
          key={index}
          ref={(element) => {
            pointerTrailRefs.current[index] = element;
          }}
          className="public-circuit-pointer-trail"
          aria-hidden="true"
        >
          <svg
            className="public-circuit-pointer-trail-paint"
            viewBox={`0 0 ${POINTER_TRAIL_DIAMETER} ${POINTER_TRAIL_DIAMETER}`}
          >
            <defs>
              <radialGradient id={pointerTrailEnvelopeMaskIds[index]}>
                <stop offset="0" stopColor="#fff" stopOpacity="0.92" />
                <stop offset="0.42" stopColor="#fff" stopOpacity="0.58" />
                <stop offset="0.72" stopColor="#fff" stopOpacity="0.2" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </radialGradient>
              <mask
                id={pointerTrailGeometryMaskIds[index]}
                x="0" y="0" width={POINTER_TRAIL_DIAMETER} height={POINTER_TRAIL_DIAMETER}
                maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse"
                style={{ maskType: "luminance" }}
              >
                <g data-pointer-trail-geometry>
                  <use href={`#${geometrySourceId}`} />
                </g>
              </mask>
              <mask
                id={`${pointerTrailEnvelopeMaskIds[index]}-mask`}
                x="0"
                y="0"
                width={POINTER_TRAIL_DIAMETER}
                height={POINTER_TRAIL_DIAMETER}
                maskUnits="userSpaceOnUse"
                maskContentUnits="userSpaceOnUse"
                style={{ maskType: "luminance" }}
              >
                <rect
                  width={POINTER_TRAIL_DIAMETER}
                  height={POINTER_TRAIL_DIAMETER}
                  fill={`url(#${pointerTrailEnvelopeMaskIds[index]})`}
                />
              </mask>
            </defs>
            <g mask={`url(#${pointerTrailEnvelopeMaskIds[index]}-mask)`}>
              <g className="public-circuit-pointer-trail-glow">
                <g mask={`url(#${pointerTrailGeometryMaskIds[index]})`}>
                  <rect className="public-circuit-pointer-trail-core" width={POINTER_TRAIL_DIAMETER} height={POINTER_TRAIL_DIAMETER} />
                </g>
              </g>
            </g>
          </svg>
        </div>
      ))}
      <svg
        ref={lensRef}
        className="public-circuit-glow-lens"
        viewBox={`0 0 ${LENS_DIAMETER} ${LENS_DIAMETER}`}
        aria-hidden="true"
      >
        <defs>
          {LOCAL_FLAME_LOBES.map((index) => (
            <radialGradient
              key={index}
              id={localFlameGradientIds[index]}
              gradientUnits="objectBoundingBox"
              cx="0.5"
              cy="0.5"
              r="0.5"
            >
              <stop
                data-flame-core={index}
                offset="0"
                stopColor="#fff"
                stopOpacity="0"
              />
              <stop
                data-flame-inner={index}
                offset="0.2"
                stopColor="#fff"
                stopOpacity="0"
              />
              <stop
                data-flame-shoulder={index}
                offset="0.52"
                stopColor="#fff"
                stopOpacity="0"
              />
              <stop
                data-flame-tail={index}
                offset="0.8"
                stopColor="#fff"
                stopOpacity="0"
              />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
          ))}
          <mask
            id={blueEnvelopeMaskId}
            x="0"
            y="0"
            width={LENS_DIAMETER}
            height={LENS_DIAMETER}
            maskUnits="userSpaceOnUse"
            maskContentUnits="userSpaceOnUse"
            style={{ maskType: "luminance" }}
          >
            <g ref={blueEnvelopeRef}>
              {ENVELOPE_CONTOURS.map((contour, index) => (
                <path
                  key={index}
                  data-envelope-contour={index}
                  d={contour.path}
                  fill={`rgb(${contour.blue * 255} ${contour.blue * 255} ${contour.blue * 255})`}
                />
              ))}
            </g>
          </mask>
          <mask
            id={pinkEnvelopeMaskId}
            x="0"
            y="0"
            width={LENS_DIAMETER}
            height={LENS_DIAMETER}
            maskUnits="userSpaceOnUse"
            maskContentUnits="userSpaceOnUse"
            style={{ maskType: "luminance" }}
          >
            <g ref={pinkEnvelopeRef}>
              {ENVELOPE_CONTOURS.map((contour, index) => (
                <path
                  key={index}
                  data-envelope-contour={index}
                  d={contour.path}
                  fill={`rgb(${contour.pink * 255} ${contour.pink * 255} ${contour.pink * 255})`}
                />
              ))}
            </g>
          </mask>
          <mask
            id={localFlameMaskId}
            x="0"
            y="0"
            width={LENS_DIAMETER}
            height={LENS_DIAMETER}
            maskUnits="userSpaceOnUse"
            maskContentUnits="userSpaceOnUse"
            style={{ maskType: "luminance" }}
          >
            <rect
              width={LENS_DIAMETER}
              height={LENS_DIAMETER}
              fill="#979797"
            />
            <rect
              ref={globalFlameRef}
              data-flame-global
              width={LENS_DIAMETER}
              height={LENS_DIAMETER}
              fill="#fff"
              style={{ opacity: 0, mixBlendMode: "screen" }}
            />
            {LOCAL_FLAME_LOBES.map((index) => (
              <circle
                key={index}
                data-flame-lobe={index}
                cx={LENS_RADIUS}
                cy={LENS_RADIUS}
                r="1"
                fill={`url(#${localFlameGradientIds[index]})`}
                style={{ opacity: 0 }}
              />
            ))}
          </mask>
          <mask id={geometryMaskId} x="0" y="0" width={LENS_DIAMETER} height={LENS_DIAMETER}
            maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" style={{ maskType: "luminance" }}>
            <g ref={geometryTransformRef}>
              <g ref={geometryRef} id={geometrySourceId} />
            </g>
          </mask>
          <clipPath id={baseClipId}>
            <path ref={baseClipRef} />
          </clipPath>
          <clipPath id={mutedClipId}>
            <path ref={mutedClipRef} />
          </clipPath>
        </defs>
        <g>
          <g
            data-circuit-tone="base"
            clipPath={`url(#${baseClipId})`}
            mask={`url(#${blueEnvelopeMaskId})`}
          >
            <g mask={`url(#${localFlameMaskId})`}>
              <g data-circuit-halo="blue">
                <g mask={`url(#${geometryMaskId})`}>
                  <rect width={LENS_DIAMETER} height={LENS_DIAMETER} fill="#edf9ff" />
                </g>
              </g>
            </g>
          </g>
          <g
            data-circuit-tone="muted"
            style={{ display: "none" }}
            clipPath={`url(#${mutedClipId})`}
            mask={`url(#${pinkEnvelopeMaskId})`}
          >
            <g mask={`url(#${localFlameMaskId})`}>
              <g data-circuit-halo="pink">
                <g mask={`url(#${geometryMaskId})`}>
                  <rect width={LENS_DIAMETER} height={LENS_DIAMETER} fill="#fff0f8" />
                </g>
              </g>
            </g>
          </g>
        </g>
      </svg>
    </>
  );
}
