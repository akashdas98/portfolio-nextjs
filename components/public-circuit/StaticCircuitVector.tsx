"use client";

import { useEffect, useRef } from "react";
import {
  IMPACT_SECTION_SELECTOR,
  MUTED_SECTION_SELECTOR,
  SPECIAL_IMPACT_SECTION_SELECTOR,
  loadLensGeometry,
  sectionRanges,
  type ToneRange,
} from "@/components/public-circuit/shared";

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

export function StaticCircuitVector({
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
      const initialLayout = artElement.childElementCount === 0;
      function releaseUnpublishedFallbacks() {
        if (initialLayout) return;
        for (const url of retainedObjectUrls) {
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
            if (version !== renderVersion) {
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
            artElement.append(tileElement);
            if (!artElement.dataset.firstTileMs) {
              artElement.dataset.firstTileMs = String(Math.round(performance.now()));
            }
          }
        }
      }
      const results = await Promise.allSettled([renderTiles(), renderTiles()]);
      if (version !== renderVersion) {
        // Replacement candidates are never mounted until the full set is ready.
        // A superseded layout must not retain their SVG fallback resources.
        releaseUnpublishedFallbacks();
        return;
      }
      const failure = results.find((result) => result.status === "rejected");
      if (failure?.status === "rejected") {
        // Keep the previous layout or any decoded initial tiles. A later layout
        // retry or unmount releases its resources.
        releaseUnpublishedFallbacks();
        previousLayoutKey = "";
        artElement.dataset.renderState = "error";
        artElement.dataset.renderError = failure.reason instanceof Error
          ? failure.reason.message : "PCB projection failed.";
        return;
      }

      artElement.replaceChildren(...tileElements);
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
