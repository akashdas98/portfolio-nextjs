import { IMPACT_SECTION_SELECTOR, MUTED_SECTION_SELECTOR, SPECIAL_IMPACT_SECTION_SELECTOR, sectionRanges, type ToneRange } from "./tone-ranges.ts";
import { createPcbBootstrap } from "./bootstrap.ts";
import { getBrowserGeometryDelivery } from "./browser-geometry.ts";
import type { GeometryHandle } from "./geometry-delivery.ts";
import { createStaticGeometryWaits, stageStaticGeometry } from "./static-geometry-waits.ts";

type StaticToneLayout = {
  impact: ToneRange[];
  muted: ToneRange[];
  specialImpact: ToneRange[];
};

type StaticPalette = {
  base: string;
  impact: string;
  muted: string;
};

const STATIC_DEPTH_OFFSET = 1;
const STATIC_VECTOR_TILE_SIZE = 512;
const STATIC_RASTER_MAX_PIXEL_RATIO = 3;
const STATIC_SPECIAL_IMPACT_MAIN_COLOR = "#0c3264";
const STATIC_MAIN_COLORS: StaticPalette = {
  base: "#0f1115",
  muted: "#090d11",
  impact: "#0e325f",
};
const STATIC_DEPTH_COLORS: StaticPalette = {
  base: "#1c2126",
  muted: "#252e35",
  impact: "#315686",
};

function paletteStops(
  pageHeight: number,
  tones: StaticToneLayout,
  palette: StaticPalette,
  specialImpactColor = palette.impact,
) {
  const clamp = (value: number) => Math.max(0, Math.min(pageHeight, value));
  const boundaries = Array.from(
    new Set([
      0,
      pageHeight,
      ...tones.muted.flatMap((range) => [clamp(range.top), clamp(range.bottom)]),
      ...tones.impact.flatMap((range) => [clamp(range.top), clamp(range.bottom)]),
      ...(specialImpactColor === palette.impact
        ? []
        : tones.specialImpact.flatMap((range) => [clamp(range.top), clamp(range.bottom)])),
    ]),
  ).sort((first, second) => first - second);
  const intervals = boundaries.slice(0, -1).map((top, index) => {
    const bottom = boundaries[index + 1];
    const midpoint = top + (bottom - top) / 2;
    const color = tones.specialImpact.some(
      (range) => midpoint >= range.top && midpoint < range.bottom,
    )
      ? specialImpactColor
      : tones.impact.some(
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

export type StaticCircuitOptions = { lensImageUrl: string; sourceHeight: number; sourceWidth: number };

/** Own only the host's readiness attributes and its dedicated shadow surface. */
export function mountStaticCircuit(artElement: HTMLElement, surface: HTMLElement, pageElement: HTMLElement,
  { lensImageUrl, sourceHeight, sourceWidth }: StaticCircuitOptions) {
  const geometry = getBrowserGeometryDelivery();
  artElement.dataset.renderState = "initializing";
  const bootstrap = createPcbBootstrap(lensImageUrl, sourceWidth, sourceHeight);
  // Matches the server preload exactly. Only this explicitly registered
  // early acquisition may cover pending tile consumers in the shared broker.
  void geometry.loadBootstrap(bootstrap.source, bootstrap.region).catch(() => {});
  let renderVersion = 0;
  let layoutFrame: number | null = null;
  let previousLayoutKey = "";
  const allocatedObjectUrls = new Set<string>();
  let checkViewport = () => {};
  let cancelGeometry = () => {};
  let notifyGeometry = () => {};
  const paintFrames = new Set<number>();

  function publishViewportReady() {
    if (artElement.dataset.viewportState !== "ready") {
      if (artElement.dataset.startupEntrance === undefined) {
        // Sample the autonomous gate before changing any readiness attribute.
        // Its computed visibility also reflects the CSS-only eight-second escape.
        const skeleton = pageElement.querySelector<HTMLElement>(".public-loading-skeleton--art");
        const gate = skeleton ? window.getComputedStyle(skeleton) : null;
        artElement.dataset.startupEntrance = gate && gate.display !== "none" &&
          gate.visibility !== "hidden" && gate.visibility !== "collapse" ? "ready" : "expired";
      }
      artElement.dataset.viewportState = "ready";
      artElement.dataset.firstViewportMs ??= String(Math.round(performance.now()));
    }
    artElement.dataset.currentViewportState = "ready";
    artElement.dispatchEvent(new CustomEvent("pcb:viewport-ready", { bubbles: true }));
  }

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
      specialImpact: sectionRanges(
        pageElement,
        pageDocumentTop,
        SPECIAL_IMPACT_SECTION_SELECTOR,
      ),
    };
    const layoutKey = JSON.stringify({
      pageWidth: Math.round(pageWidth * 10) / 10,
      pageHeight,
      tones,
    });
    if (layoutKey === previousLayoutKey) return;
    previousLayoutKey = layoutKey;
    const previousLayoutComplete = artElement.dataset.renderState === "ready";
    cancelGeometry();
    const version = ++renderVersion;
    const renderStartedAt = performance.now();
    artElement.dataset.renderState = "rendering-vector";
    const width = Math.max(1, pageWidth);
    const height = Math.max(1, pageHeight);
    const mainStops = paletteStops(height, tones, STATIC_MAIN_COLORS, STATIC_SPECIAL_IMPACT_MAIN_COLOR);
    const depthStops = paletteStops(height, tones, STATIC_DEPTH_COLORS);
    const tileElements: HTMLElement[] = [];
    const retainedObjectUrls = new Set<string>();
    const pixelRatio = Math.min(
      STATIC_RASTER_MAX_PIXEL_RATIO,
      Math.max(1, window.devicePixelRatio || 1),
    );
    const initialLayout = !previousLayoutComplete || surface.childElementCount === 0;
    let replaceStartupTiles = initialLayout && surface.childElementCount > 0;
    function releaseUnpublishedFallbacks() {
      const mountedUrls = new Set(Array.from(surface.querySelectorAll("img"), (image) => image.src));
      for (const url of retainedObjectUrls) {
        if (mountedUrls.has(url)) continue;
        URL.revokeObjectURL(url);
        allocatedObjectUrls.delete(url);
      }
    }
    const tiles: Array<{ top: number; left: number }> = [];
    for (let top = 0; top < height; top += STATIC_VECTOR_TILE_SIZE) {
      for (let left = 0; left < width; left += STATIC_VECTOR_TILE_SIZE) {
        tiles.push({ top, left });
      }
    }
    const allTiles = [...tiles];
    const decoded = new Map<string, HTMLElement>();
    const published = new Set<string>();
    const key = (tile: { top: number; left: number }) => `${tile.top}:${tile.left}`;
    const visibleTiles = () => {
      const viewportTop = window.scrollY - pageDocumentTop;
      return allTiles.filter((tile) => tile.top < viewportTop + window.innerHeight &&
        tile.top + STATIC_VECTOR_TILE_SIZE > viewportTop);
    };
    let publication = 0;
    let failed = false;
    let pendingPublication = "";
    const afterPaint = (callback: () => void) => {
      const frame = requestAnimationFrame(() => {
        paintFrames.delete(frame);
        const next = requestAnimationFrame(() => {
          paintFrames.delete(next);
          if (version === renderVersion) callback();
        });
        paintFrames.add(next);
      });
      paintFrames.add(frame);
    };
    checkViewport = () => {
      if (version !== renderVersion || failed || !initialLayout) return;
      const visible = visibleTiles();
      if (!visible.every((tile) => decoded.has(key(tile)))) {
        artElement.dataset.currentViewportState = "pending";
        publication += 1;
        pendingPublication = "";
        return;
      }
      const additions = visible.filter((tile) => !published.has(key(tile)));
      if (!additions.length && artElement.dataset.currentViewportState === "ready") return;
      const signature = visible.map(key).join("|");
      if (!additions.length && pendingPublication === signature) return;
      pendingPublication = signature;
      for (const tile of additions) published.add(key(tile));
      const elements = additions.map((tile) => decoded.get(key(tile))!);
      if (replaceStartupTiles) {
        surface.replaceChildren(...elements);
        replaceStartupTiles = false;
      } else surface.append(...elements);
      const currentPublication = ++publication;
      afterPaint(() => {
        if (currentPublication !== publication) return;
        publishViewportReady();
      });
    };
    checkViewport();
    // Fetch a bounded regional cohort before decoding it. This removes a
    // network round trip per tile without requesting the entire source.
    const prepared = new Map<string, GeometryHandle>();
    const activeTiles = new Set<string>();
    const geometryWaits = createStaticGeometryWaits();
    const releaseGeometry = () => {
      geometryWaits.cancel();
      prepared.forEach((handle) => handle.release());
      prepared.clear();
    };
    cancelGeometry = releaseGeometry;
    notifyGeometry = () => geometryWaits.notify();
    const region = ({ top, left }: { top: number; left: number }) => ({
      x: (left - renderLeft - 1) / renderScale,
      y: (top - STATIC_DEPTH_OFFSET - 1) / renderScale,
      width: (Math.min(STATIC_VECTOR_TILE_SIZE, width - left) + 2) / renderScale,
      height: (Math.min(STATIC_VECTOR_TILE_SIZE, height - top) + STATIC_DEPTH_OFFSET + 2) / renderScale,
    });
    // First paint is local: decoding below-fold art cannot hold the viewport
    // hostage. Replacement layouts remain atomic so resizing never mixes two
    // differently aligned projections. At most two local resources are in flight.
    async function renderTiles() {
      while (tiles.length && version === renderVersion && !failed) {
        const viewportTop = window.scrollY - pageDocumentTop;
        tiles.sort((a, b) => {
          const distance = (tile: { top: number }) => Math.max(
            0, viewportTop - tile.top - STATIC_VECTOR_TILE_SIZE,
            tile.top - viewportTop - window.innerHeight,
          );
          return distance(a) - distance(b) || a.top - b.top || a.left - b.left;
        });
        const selected = tiles.shift()!;
        activeTiles.add(key(selected));
        const { top, left } = selected;
        const tileWidth = Math.min(STATIC_VECTOR_TILE_SIZE, width - left);
        const tileHeight = Math.min(STATIC_VECTOR_TILE_SIZE, height - top);
        if (!prepared.has(key(selected))) {
          const visibleKeys = new Set(visibleTiles().map(key));
          const selectedVisible = visibleKeys.has(key(selected));
          const cohort = [selected, ...tiles.filter((tile) => !prepared.has(key(tile)) &&
            (!selectedVisible || visibleKeys.has(key(tile)))).slice(0, 7)];
          // Make room before acquisition. Releasing abandoned interest also
          // aborts its transport when no other shared consumer needs it.
          stageStaticGeometry(prepared, activeTiles, cohort.map(key), () =>
            geometry.loadBatchHandles(lensImageUrl, cohort.map(region)));
        }
        const handle = prepared.get(key(selected))!;
        const result = await geometryWaits.wait(handle.promise, () => {
          const visibleKeys = new Set(visibleTiles().map(key));
          return !visibleKeys.has(key(selected)) && tiles.some((tile) => visibleKeys.has(key(tile)));
        });
        activeTiles.delete(key(selected));
        if (version !== renderVersion || failed) return;
        if (!result) {
          tiles.push(selected);
          continue;
        }
        prepared.delete(key(selected));
        handle.release();
        const localPaths = result.value;
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
        let tileElement: HTMLElement = image;
        try {
          await image.decode();
          if (version !== renderVersion || failed) {
            URL.revokeObjectURL(objectUrl);
            allocatedObjectUrls.delete(objectUrl);
            return;
          }
          // A decoded SVG is needed only once. Keep the authored projection
          // exactly as-is, then display its same-size pixel snapshot so drag
          // frames do not repaint the SVG mask and gradients.
          try {
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(tileWidth * pixelRatio));
            canvas.height = Math.max(1, Math.round(tileHeight * pixelRatio));
            const context = canvas.getContext("2d");
            if (context) {
              context.drawImage(image, 0, 0, canvas.width, canvas.height);
              canvas.className = image.className;
              canvas.style.cssText = image.style.cssText;
              tileElement = canvas;
            }
          } catch {
            // If this browser cannot snapshot a tile, retain the decoded SVG
            // rather than publish a blank canvas.
          }
          if (tileElement === image) {
            retainedObjectUrls.add(objectUrl);
          } else {
            image.removeAttribute("src");
            URL.revokeObjectURL(objectUrl);
            allocatedObjectUrls.delete(objectUrl);
          }
        } catch (error) {
          URL.revokeObjectURL(objectUrl);
          allocatedObjectUrls.delete(objectUrl);
          throw error;
        }
        tileElements.push(tileElement);
        if (initialLayout) {
          decoded.set(key(selected), tileElement);
          checkViewport();
        }
      }
    }
    function failLayout(error: unknown) {
      if (failed || version !== renderVersion) return;
      failed = true;
      releaseGeometry();
      publication += 1;
      pendingPublication = "";
      previousLayoutKey = "";
      artElement.dataset.renderState = "error";
      artElement.dataset.viewportState = "failed";
      artElement.dataset.currentViewportState = "failed";
      artElement.dataset.renderError = error instanceof Error ? error.message : "PCB projection failed.";
      releaseUnpublishedFallbacks();
      // A rejected critical tile cannot wait behind the other worker's
      // unrelated below-fold fetches before releasing the existing fallback.
      artElement.dispatchEvent(new CustomEvent("pcb:viewport-ready", { bubbles: true }));
    }
    await Promise.all([renderTiles().catch(failLayout), renderTiles().catch(failLayout)]);
    releaseGeometry();
    if (version !== renderVersion) {
      // Replacement candidates are never mounted until the full set is ready.
      // A superseded layout must not retain their SVG fallback resources.
      releaseUnpublishedFallbacks();
      return;
    }
    if (failed) {
      releaseUnpublishedFallbacks();
      return;
    }

    surface.replaceChildren(...tileElements);
    afterPaint(publishViewportReady);
    artElement.classList.add("is-ready");
    artElement.dataset.renderState = "ready";
    artElement.dataset.renderDurationMs = String(
      Math.round((performance.now() - renderStartedAt) * 10) / 10,
    );
    for (const url of allocatedObjectUrls) {
      if (!retainedObjectUrls.has(url)) {
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
  const onScroll = () => { checkViewport(); notifyGeometry(); };
  window.addEventListener("scroll", onScroll, { passive: true });
  scheduleLayout();

  return () => {
    renderVersion += 1;
    cancelGeometry();
    if (layoutFrame !== null) window.cancelAnimationFrame(layoutFrame);
    resizeObserver.disconnect();
    window.removeEventListener("resize", scheduleLayout);
    window.removeEventListener("scroll", onScroll);
    paintFrames.forEach((frame) => cancelAnimationFrame(frame));
    surface.replaceChildren();
    allocatedObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  };
}
