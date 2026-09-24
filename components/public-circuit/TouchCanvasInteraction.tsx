"use client";

import { useEffect, useRef } from "react";
import {
  BLUE_ENVELOPE_STOPS,
  IMPACT_SECTION_SELECTOR,
  MUTED_SECTION_SELECTOR,
  PINK_ENVELOPE_STOPS,
  POINTER_TRAIL_DURATION,
  loadLensGeometry,
  sectionRanges,
  type EnvelopeStop,
  type LensPath,
  type PublicCircuitBackgroundProps,
  type SourceRegion,
  type ToneRange,
} from "@/components/public-circuit/shared";
import {
  boundedCanvasPixelRatio,
  parseTouchCanvasPath,
  touchCanvasSurfaceOrigin,
  touchDecoratedCrop,
  touchEnvelopeStops,
  touchGeometryRegions,
  touchRequiredTones,
  touchToneIntervals,
  TOUCH_DECORATED_HALO_BLUR,
  TOUCH_DECORATED_HALO_PASSES,
  TOUCH_MASK_MAX_PIXELS,
  TOUCH_VIEWPORT_MAX_PIXELS,
  type TouchCanvasPath,
  type TouchTone,
} from "@/lib/pcb/touch-canvas";
import { createTouchPreparation, publishTouchMainCanvas, waitForTouchPreparation } from "@/lib/pcb/touch-preparation";
import { createTouchHaloWorker } from "@/lib/pcb/touch-halo-worker";
import {
  createTouchInteractionState,
  mergeTouchFrameSample,
  reduceTouchInteractionState,
  touchGeometryCovers,
  touchInteractionPresentation,
  touchPagePoint,
  touchScrollPoint,
  TOUCH_HOLD_MS,
  type TouchFrameSample,
  type TouchInteractionAction,
} from "@/lib/pcb/touch-interaction";
import {
  advanceGlobalFlamePulse,
  DESKTOP_NEUTRAL_FLAME_ALPHA,
  evaluateGlobalFlamePulse,
  type GlobalFlamePulse,
  type GlobalFlamePulseFrame,
} from "@/lib/pcb/global-flame-pulse";
import {
  activeTouchLocalFlames,
  sampleTouchLocalFlame,
  sampleTouchLocalFlameSpawnDelay,
  touchLocalFlameIsActive,
  touchLocalFlamePhaseOpacity,
  TOUCH_LOCAL_FLAME_CONTRACT,
  type TouchLocalFlame,
} from "@/lib/pcb/touch-flame";

const TOUCH_LENS_DIAMETER = 420;
const TOUCH_ENVELOPE_RADIUS = 168;
const TOUCH_TRAIL_DIAMETER = 190;
const TOUCH_TRAIL_RADIUS = TOUCH_TRAIL_DIAMETER / 2;
const TOUCH_TRAIL_LIMIT = 8;
const TOUCH_TRAIL_MIN_DISTANCE = 14;
const TOUCH_TRAIL_MIN_INTERVAL = 36;
const TOUCH_GEOMETRY_CELL_SIZE = 96;
const TOUCH_PREFETCH_MARGIN = 64;
const TOUCH_FULL_WIDTH_GUARD = 64;

type TouchGeometry = {
  key: string;
  layoutVersion: number;
  mask: HTMLCanvasElement;
  maskPixelRatio: number;
  originX: number;
  originY: number;
  region: SourceRegion;
  renderLeft: number;
  renderScale: number;
  sourcePaths?: LensPath[];
};

type TouchDecoratedSurface = {
  canvas: HTMLCanvasElement | ImageBitmap;
  geometry: TouchGeometry;
  pixelRatio: number;
  tone: TouchTone;
};

type PreparedTouchRegion = {
  geometry: TouchGeometry;
  surfaces: Map<TouchTone, TouchDecoratedSurface>;
};

type TouchTrail = {
  bitmap: HTMLCanvasElement;
  createdAt: number;
  point: { x: number; y: number };
};

const TOUCH_CANVAS_CSS = `
.public-circuit-touch-canvas{position:absolute;top:0;left:0;z-index:1;display:block;width:100vw;height:100vh;pointer-events:none;contain:strict;will-change:transform}
.public-circuit-touch-main{width:420px;height:420px;visibility:hidden}
.public-circuit-touch-trail{position:absolute;top:0;left:0;z-index:1;display:block;pointer-events:none;contain:strict;will-change:opacity}
@media (prefers-reduced-motion:reduce){.public-circuit-touch-canvas,.public-circuit-touch-trail{display:none}}
`;

function paintTouchCanvasPath(
  context: CanvasRenderingContext2D,
  definition: TouchCanvasPath,
  path: Path2D,
) {
  if (definition.fill !== "none") {
    context.globalCompositeOperation = definition.fill === "white"
      ? "source-over" : "destination-out";
    context.fillStyle = "white";
    context.fill(path, definition.fillRule);
  }
  if (definition.stroke !== "none") {
    context.globalCompositeOperation = definition.stroke === "white"
      ? "source-over" : "destination-out";
    context.strokeStyle = "white";
    context.lineWidth = definition.strokeWidth;
    context.lineCap = definition.lineCap;
    context.lineJoin = definition.lineJoin;
    context.miterLimit = definition.miterLimit;
    context.stroke(path);
  }
}

async function createTouchGeometryMask(
  paths: LensPath[],
  request: ReturnType<typeof touchGeometryRequest>,
  checkpoint: () => Promise<void>,
  pathCache: Map<string, Path2D>,
) {
  await checkpoint();
  const cssWidth = request.region.width * request.renderScale;
  const cssHeight = request.region.height * request.renderScale;
  const pixelRatio = boundedCanvasPixelRatio(
    cssWidth,
    cssHeight,
    window.devicePixelRatio,
    TOUCH_MASK_MAX_PIXELS,
  );
  const mask = document.createElement("canvas");
  mask.width = Math.max(1, Math.ceil(cssWidth * pixelRatio));
  mask.height = Math.max(1, Math.ceil(cssHeight * pixelRatio));
  const context = mask.getContext("2d");
  if (!context) throw new Error("Canvas 2D is required for touch PCB paint.");
  context.setTransform(
    pixelRatio * request.renderScale,
    0,
    0,
    pixelRatio * request.renderScale,
    -request.region.x * pixelRatio * request.renderScale,
    -request.region.y * pixelRatio * request.renderScale,
  );
  try {
    let batchStartedAt = performance.now();
    for (const path of paths) {
      const definition = parseTouchCanvasPath(path.source);
      let geometry = pathCache.get(definition.data);
      if (geometry) {
        pathCache.delete(definition.data);
      } else {
        geometry = new Path2D(definition.data);
      }
      pathCache.set(definition.data, geometry);
      if (pathCache.size > 256) pathCache.delete(pathCache.keys().next().value!);
      paintTouchCanvasPath(context, definition, geometry);
      if (performance.now() - batchStartedAt >= 4) {
        await checkpoint();
        batchStartedAt = performance.now();
      }
    }
  } catch (error) {
    mask.width = 0;
    mask.height = 0;
    throw error;
  }
  context.globalCompositeOperation = "source-over";
  return { mask, maskPixelRatio: pixelRatio };
}

function touchGeometryRequest(
  point: { x: number; y: number },
  layout: {
    layoutVersion: number;
    renderLeft: number;
    renderScale: number;
    pageWidth: number;
  },
) {
  const { bucketY, region, requiredRegion } = touchGeometryRegions(
    point,
    layout,
    TOUCH_LENS_DIAMETER,
    TOUCH_GEOMETRY_CELL_SIZE,
  );
  // One region spans every horizontal touch position in this page layout.
  // Moving the finger across a single viewport must never evict its own mask
  // and wait for an overlapping full-region rebuild.
  region.x = (-layout.renderLeft - TOUCH_LENS_DIAMETER / 2 - TOUCH_FULL_WIDTH_GUARD) /
    layout.renderScale;
  region.width = (layout.pageWidth + TOUCH_LENS_DIAMETER + 2 * TOUCH_FULL_WIDTH_GUARD) /
    layout.renderScale;
  const key = [
    layout.layoutVersion,
    region.x,
    bucketY,
    layout.renderScale,
    layout.renderLeft,
  ].map((value) => value.toFixed(4)).join(":");
  return { ...layout, key, region, requiredRegion };
}

export function TouchCanvasInteraction({
  imageUrl,
  lensImageUrl = imageUrl,
  sourceWidth,
  sourceHeight,
}: PublicCircuitBackgroundProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const anchor = anchorRef.current;
    const page = anchor?.closest<HTMLElement>("[data-public-circuit]");
    if (!anchor || !page || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const pageElement = page;
    // Diagnostic URL switches must not alter public production rendering.
    const debugParams = new URLSearchParams(
      process.env.NODE_ENV === "development" ? window.location.search : "",
    );
    const diagnosticEnabled = debugParams.get("pcb-debug") === "1" ||
      debugParams.get("pcb-probe") === "1";
    const captureEnabled = debugParams.get("pcb-capture") === "1";
    const diagnosticTrailsOff = diagnosticEnabled &&
      debugParams.get("pcb-trails") === "off";
    let state = createTouchInteractionState();
    let disposed = false;
    let styleElement: HTMLStyleElement | null = null;
    let debugElement: HTMLDivElement | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let viewportContext: CanvasRenderingContext2D | null = null;
    const mainCanvases: HTMLCanvasElement[] = [];
    const pathCache = new Map<string, Path2D>();
    const haloWorker = createTouchHaloWorker();
    // Probe worker Canvas support before first contact. Otherwise the first
    // geometry request can outrun the probe and run large shadow passes on the
    // input thread even when the worker is supported.
    haloWorker.start();
    let mainFront: number | null = null;
    const envelopeCanvas = document.createElement("canvas");
    const flameCanvas = document.createElement("canvas");
    const initialEnvelopeContext = envelopeCanvas.getContext("2d");
    const initialFlameContext = flameCanvas.getContext("2d");
    if (!initialEnvelopeContext || !initialFlameContext) return;
    const envelopeContext: CanvasRenderingContext2D = initialEnvelopeContext;
    const flameContext: CanvasRenderingContext2D = initialFlameContext;
    let currentPoint: { x: number; y: number } | null = null;
    let frame: number | null = null;
    let lastRenderAt = Number.NEGATIVE_INFINITY;
    let pendingAt = 0;
    let holdTimer: number | null = null;
    let trackedTouchId: number | null = null;
    let pointerTouchActive = false;
    let scrollTouchPointerId: number | null = null;
    let scrollNativeTouchId: number | null = null;
    let scrollTouchAnchor: { point: { x: number; y: number }; clientX: number } | null = null;
    let pendingTouchId: number | null = null;
    let pendingPagePoint: { x: number; y: number } | null = null;
    let touchSample: TouchFrameSample | null = null;
    let pendingTouchPhase: "contact" | "move" | "release" | "cancel" | null = null;
    let pendingTouchAt = 0;
    let inputDirty = false;
    let presentationDirty = false;
    let pageDocumentLeft = 0;
    let pageDocumentTop = 0;
    let viewportScrollX = window.scrollX;
    let viewportScrollY = window.scrollY;
    let pageWidth = 0;
    let pageHeight = 0;
    let renderLeft = 0;
    let renderScale = 1;
    let layoutVersion = 0;
    let mutedRanges: ToneRange[] = [];
    let impactRanges: ToneRange[] = [];
    let viewportPixelRatio = 1;
    let surfacePageLeft = 0;
    let surfacePageTop = 0;
    let lastTrailAt = Number.NEGATIVE_INFINITY;
    let nextFlameAt = 0;
    let globalFlamePulse: GlobalFlamePulse | null = null;
    let geometryMisses = 0;
    let preparationStage = "idle";
    let preparationAborts = 0;
    let preparationStarts = 0;
    let lastPreparationTiming = "none";
    let lastPreparationCall = "none";
    let lastPreparationCallAt = 0;
    let peakPreparationCallMs = 0;
    let preparationStarted = 0;
    let lastFrameCost = 0;
    let lastDebugUpdate = 0;
    let peakDebugLag = 0;
    let lastTouchEventAt = 0;
    let lastScrollEventAt = 0;
    let lastTouchDeliveryLag = 0;
    let lastScrollDeliveryLag = 0;
    let lastFrameAt = 0;
    let lastFrameGap = 0;
    let pointerCancels = 0;
    let pointerMoves = 0;
    let fallbackMoves = 0;
    let gestureScrollStart = window.scrollY;
    let gestureScrollDelta = 0;
    let retryPreparationAt = 0;
    let diagnosticUnderlayStyle: HTMLStyleElement | null = null;
    const captureFrames: Array<Record<string, number | string>> = [];
    let captureUploadTimer: number | null = null;

    function uploadCapture() {
      if (!captureEnabled || captureFrames.length === 0) return;
      const frames = captureFrames.splice(0);
      void fetch("/api/pcb-touch-capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          schema: "pcb-touch-device-capture-v1",
          at: new Date().toISOString(),
          viewport: [window.innerWidth, window.innerHeight],
          devicePixelRatio: window.devicePixelRatio,
          visualScale: window.visualViewport?.scale ?? 1,
          pointerCancels,
          pointerMoves,
          fallbackMoves,
          preparationStarts,
          preparationAborts,
          geometryMisses,
          frames,
        }),
      }).catch(() => {});
    }

    function scheduleCaptureUpload() {
      if (!captureEnabled) return;
      if (captureUploadTimer !== null) window.clearTimeout(captureUploadTimer);
      captureUploadTimer = window.setTimeout(() => {
        captureUploadTimer = null;
        uploadCapture();
      }, 300);
    }
    const steadyEnvelopes = new Map<TouchTone, HTMLCanvasElement>();
    const preparation = createTouchPreparation({
      prepare: prepareTouchRegion,
      release: releaseTouchRegion,
      ready: () => { presentationDirty = true; scheduleFrame(); },
      failed: () => { retryPreparationAt = performance.now() + 500; },
      cancelled: () => { preparationAborts += 1; },
    });
    const trails: TouchTrail[] = [];
    const flameSlots: Array<TouchLocalFlame | null> = Array.from(
      { length: TOUCH_LOCAL_FLAME_CONTRACT.slotCount },
      () => null,
    );

    function resizeViewportCanvas() {
      if (!canvas) return;
      const width = Math.max(1, window.innerWidth);
      const height = Math.max(1, window.innerHeight);
      viewportPixelRatio = boundedCanvasPixelRatio(
        width,
        height,
        window.devicePixelRatio,
        TOUCH_VIEWPORT_MAX_PIXELS,
      );
      canvas.width = 1;
      canvas.height = 1;
      viewportContext = canvas.getContext("2d");
      canvas.dataset.pixelRatio = viewportPixelRatio.toFixed(3);
    }

    function positionViewportCanvas() {
      if (!canvas) return;
      const origin = touchCanvasSurfaceOrigin(
        viewportScrollX,
        viewportScrollY,
        pageDocumentLeft,
        pageDocumentTop,
      );
      surfacePageLeft = origin.x;
      surfacePageTop = origin.y;
      canvas.style.transform = `translate3d(${origin.x}px,${origin.y}px,0)`;
    }

    function rebuildLayout() {
      const pageRect = pageElement.getBoundingClientRect();
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      viewportScrollX = scrollX;
      viewportScrollY = scrollY;
      pageDocumentLeft = pageRect.left + scrollX;
      pageDocumentTop = pageRect.top + scrollY;
      pageWidth = pageRect.width;
      pageHeight = pageElement.offsetHeight;
      renderScale = Math.max(pageWidth / sourceWidth, pageHeight / sourceHeight);
      renderLeft = (pageWidth - sourceWidth * renderScale) / 2;
      mutedRanges = sectionRanges(pageElement, pageDocumentTop, MUTED_SECTION_SELECTOR);
      impactRanges = sectionRanges(pageElement, pageDocumentTop, IMPACT_SECTION_SELECTOR);
      layoutVersion += 1;
      if (debugElement) {
        debugElement.dataset.layoutVersion = String(layoutVersion);
        debugElement.dataset.pageHeight = String(pageHeight);
        debugElement.dataset.viewportHeight = String(window.innerHeight);
      }
      preparation.reset();
      clearSteadyEnvelopes();
      for (const trail of trails.splice(0)) trail.bitmap.remove();
      resizeViewportCanvas();
      positionViewportCanvas();
      inputDirty = touchSample !== null && state.phase !== "idle";
      presentationDirty = state.phase !== "idle";
      scheduleFrame();
    }

    function ensureShell() {
      if (canvas && viewportContext) return;
      styleElement = document.createElement("style");
      styleElement.dataset.publicCircuitTouchStyle = "canvas";
      styleElement.textContent = TOUCH_CANVAS_CSS;
      pageElement.append(styleElement);
      canvas = document.createElement("canvas");
      canvas.className = "public-circuit-touch-canvas";
      canvas.hidden = true;
      canvas.setAttribute("aria-hidden", "true");
      pageElement.append(canvas);
      for (let index = 0; index < 2; index += 1) {
        const main = document.createElement("canvas");
        main.className = "public-circuit-touch-canvas public-circuit-touch-main";
        main.dataset.touchMain = String(index);
        main.setAttribute("aria-hidden", "true");
        main.style.visibility = "hidden";
        pageElement.append(main);
        mainCanvases.push(main);
      }
      resizeViewportCanvas();
      positionViewportCanvas();
    }

    function geometryRequest(point: { x: number; y: number }) {
      const request = touchGeometryRequest(point, { layoutVersion, renderLeft, renderScale, pageWidth });
      const tones = touchRequiredTones(
        point.y, TOUCH_LENS_DIAMETER, mutedRanges, impactRanges,
      );
      return { ...request, key: `${request.key}:${tones.join(",")}`, tones };
    }

    function releaseTouchRegion(prepared: PreparedTouchRegion) {
      prepared.geometry.mask.width = 0;
      prepared.geometry.mask.height = 0;
      for (const surface of prepared.surfaces.values()) {
        releaseDecoratedSurface(surface);
      }
      prepared.surfaces.clear();
    }

    function releaseDecoratedSurface(surface: TouchDecoratedSurface) {
      if (surface.canvas instanceof HTMLCanvasElement) {
        surface.canvas.width = 0;
        surface.canvas.height = 0;
      } else {
        surface.canvas.close();
      }
    }

    async function decorateRegionInWorker(
      paths: LensPath[],
      request: ReturnType<typeof geometryRequest>,
      tones: TouchTone[],
      pixelRatio: number,
      signal: AbortSignal,
    ) {
      const cssWidth = request.region.width * request.renderScale;
      const cssHeight = request.region.height * request.renderScale;
      const maskRatio = boundedCanvasPixelRatio(
        cssWidth, cssHeight, window.devicePixelRatio, TOUCH_MASK_MAX_PIXELS,
      );
      const result = await haloWorker.decorateRegion({
        paths: paths.map((path) => parseTouchCanvasPath(path.source)),
        maskWidth: Math.max(1, Math.ceil(cssWidth * maskRatio)),
        maskHeight: Math.max(1, Math.ceil(cssHeight * maskRatio)),
        transform: [
          maskRatio * request.renderScale, 0, 0,
          maskRatio * request.renderScale,
          -request.region.x * maskRatio * request.renderScale,
          -request.region.y * maskRatio * request.renderScale,
        ],
        tones: tones.map((tone) => {
          const colors = toneColors(tone);
          return {
            tone,
            width: Math.max(1, Math.ceil(cssWidth * pixelRatio)),
            height: Math.max(1, Math.ceil(cssHeight * pixelRatio)),
            coreColor: colors.core,
            pixelRatio,
            haloColor: colors.halo,
            blur: TOUCH_DECORATED_HALO_BLUR,
            passes: TOUCH_DECORATED_HALO_PASSES,
          };
        }),
      }, signal);
      if (result && (debugElement || captureEnabled)) {
        lastPreparationCall = `worker-region:${Math.round(result.workerMs)}ms send:${Math.round(result.sendMs)}ms`;
        lastPreparationCallAt = performance.now();
      }
      return { result, maskRatio };
    }

    async function createDecoratedSurface(
      geometry: TouchGeometry,
      tone: TouchTone,
      pixelRatio: number,
      checkpoint: () => Promise<void>,
      signal: AbortSignal,
    ) {
      await checkpoint();
      const colors = toneColors(tone);
      const width = Math.max(1, Math.ceil(
        geometry.region.width * geometry.renderScale * pixelRatio,
      ));
      const height = Math.max(1, Math.ceil(
        geometry.region.height * geometry.renderScale * pixelRatio,
      ));
      // Transfer a snapshot of the retained mask. On supported engines the
      // scale/color copy and all three full-region shadows run in the worker.
      const workerResult = await haloWorker.decorate(geometry.mask, {
          width,
          height,
          coreColor: colors.core,
          pixelRatio,
          haloColor: colors.halo,
          blur: TOUCH_DECORATED_HALO_BLUR,
          passes: TOUCH_DECORATED_HALO_PASSES,
        }, signal);
      if (workerResult) {
        try {
          await checkpoint();
          if (debugElement || captureEnabled) {
            lastPreparationCall = `worker:${Math.round(workerResult.workerMs)}ms bitmap:${Math.round(workerResult.bitmapMs)}ms send:${Math.round(workerResult.sendMs)}ms`;
            lastPreparationCallAt = performance.now();
          }
          // A live crop can draw an ImageBitmap directly. Ownership moves to
          // the prepared region, which closes it on replacement or disposal.
          return {
            canvas: workerResult.output, geometry, pixelRatio, tone,
          } satisfies TouchDecoratedSurface;
        } catch (error) {
          workerResult.output.close();
          throw error;
        }
      }

      // Allocate fallback raster surfaces only if the worker is unavailable.
      const core = document.createElement("canvas");
      const decorated = document.createElement("canvas");
      const scratch = document.createElement("canvas");
      for (const surface of [core, decorated, scratch]) {
          surface.width = width;
          surface.height = height;
      }
      const coreContext = core.getContext("2d");
      const decoratedContext = decorated.getContext("2d");
      const scratchContext = scratch.getContext("2d");
      if (!coreContext || !decoratedContext || !scratchContext) {
        for (const surface of [core, decorated, scratch]) {
          surface.width = 0;
          surface.height = 0;
        }
        throw new Error("Canvas 2D is required for decorated touch PCB paint.");
      }
      try {
        const coreStartedAt = debugElement || captureEnabled ? performance.now() : 0;
        coreContext.drawImage(
          geometry.mask,
          0, 0, geometry.mask.width, geometry.mask.height,
          0, 0, core.width, core.height,
        );
        if (debugElement || captureEnabled) {
          const callMs = performance.now() - coreStartedAt;
          peakPreparationCallMs = Math.max(peakPreparationCallMs, callMs);
          lastPreparationCall = `${tone}-core:${Math.round(callMs)}ms`;
          lastPreparationCallAt = performance.now();
        }
        coreContext.globalCompositeOperation = "source-in";
        coreContext.fillStyle = colors.core;
        coreContext.fillRect(0, 0, core.width, core.height);
        coreContext.globalCompositeOperation = "source-over";

        let source = core;
        for (let pass = 0; pass < TOUCH_DECORATED_HALO_PASSES; pass += 1) {
          await checkpoint();
          const target = pass % 2 === 0 ? decorated : scratch;
          const targetContext = pass % 2 === 0 ? decoratedContext : scratchContext;
          targetContext.setTransform(1, 0, 0, 1, 0, 0);
          targetContext.globalCompositeOperation = "source-over";
          targetContext.clearRect(0, 0, target.width, target.height);
          targetContext.globalAlpha = 1;
          targetContext.shadowColor = colors.halo;
          // Canvas shadowBlur is twice the Gaussian sigma. CSS drop-shadow's
          // third length is sigma, so 8.5 reproduces the desktop 4.25px pass.
          targetContext.shadowBlur = TOUCH_DECORATED_HALO_BLUR * pixelRatio;
          targetContext.shadowOffsetX = 0;
          targetContext.shadowOffsetY = 0;
          const drawStartedAt = debugElement || captureEnabled ? performance.now() : 0;
          targetContext.drawImage(source, 0, 0);
          if (debugElement || captureEnabled) {
            const callMs = performance.now() - drawStartedAt;
            peakPreparationCallMs = Math.max(peakPreparationCallMs, callMs);
            lastPreparationCall = `${tone}-${pass + 1}:${Math.round(callMs)}ms`;
            lastPreparationCallAt = performance.now();
          }
          source = target;
        }
        core.width = 0;
        core.height = 0;
        scratch.width = 0;
        scratch.height = 0;
        return {
          canvas: decorated,
          geometry,
          pixelRatio,
          tone,
        } satisfies TouchDecoratedSurface;
      } catch (error) {
        for (const surface of [core, decorated, scratch]) {
          surface.width = 0;
          surface.height = 0;
        }
        throw error;
      }
    }

    let preparationTimer: number | null = null;
    let resumePreparation: (() => void) | null = null;

    async function prepareTouchRegion(
      request: ReturnType<typeof geometryRequest>,
      isCurrent: () => boolean,
      signal: AbortSignal,
    ): Promise<PreparedTouchRegion> {
      haloWorker.start();
      preparationStarts += 1;
      const preparationStartedAt = performance.now();
      preparationStarted = preparationStartedAt;
      let geometryLoadedAt = preparationStartedAt;
      let maskReadyAt = preparationStartedAt;
      // A tablet boundary needs two complete decorated regions. Keep their
      // combined shadow raster within a CSS-pixel budget; phone composition
      // retains its existing density and the final lens still paints at the
      // viewport ratio.
      const pixelRatio = request.tones.length > 1 &&
        window.matchMedia("(min-width: 651px)").matches
        ? Math.min(viewportPixelRatio, 1)
        : viewportPixelRatio;
      const checkpoint = async () => {
        if (disposed || !isCurrent()) throw new Error("Touch preparation was superseded.");
        // A task boundary gives input and paint a turn between bounded stages.
        await new Promise<void>((resolve, reject) => {
          const abort = () => {
            if (preparationTimer !== null) window.clearTimeout(preparationTimer);
            preparationTimer = null;
            resumePreparation = null;
            reject(signal.reason);
          };
          signal.addEventListener("abort", abort, { once: true });
          resumePreparation = resolve;
          preparationTimer = window.setTimeout(() => {
            signal.removeEventListener("abort", abort);
            preparationTimer = null;
            resumePreparation = null;
            resolve();
          }, 0);
        });
        if (!disposed) {
          if (reducePendingInput()) presentationDirty = true;
          updatePreparationIntent();
        }
        if (!isCurrent() || request.layoutVersion !== layoutVersion) {
          throw new Error("Touch preparation was superseded.");
        }
      };
      preparationStage = "yield";
      await checkpoint();
      const reusable = preparation.active;
      const missingTones = reusable && geometryCoversRequest(reusable.geometry, request)
        ? request.tones.filter((tone) => !reusable.surfaces.has(tone))
        : [];
      if (reusable && missingTones.length > 0) {
        const additions = new Map<TouchTone, TouchDecoratedSurface>();
        try {
          preparationStage = "extend-tone";
          const sourcePaths = reusable.geometry.sourcePaths;
          // A tone added to retained geometry must use that geometry's mask
          // coordinates. The current request bucket may already have moved.
          const retainedRequest = {
            ...request,
            region: reusable.geometry.region,
            renderLeft: reusable.geometry.renderLeft,
            renderScale: reusable.geometry.renderScale,
          };
          const workerExtension = sourcePaths
            ? await decorateRegionInWorker(sourcePaths, retainedRequest, missingTones, pixelRatio, signal)
            : null;
          if (workerExtension?.result) {
            for (const output of workerExtension.result.outputs) {
              additions.set(output.tone, {
                canvas: output.output, geometry: reusable.geometry,
                pixelRatio, tone: output.tone,
              });
            }
          } else {
            if (sourcePaths && reusable.geometry.mask.width === 0) {
              const rebuilt = await createTouchGeometryMask(sourcePaths, retainedRequest, checkpoint, pathCache);
              reusable.geometry.mask = rebuilt.mask;
              reusable.geometry.maskPixelRatio = rebuilt.maskPixelRatio;
            }
            for (const tone of missingTones) {
              additions.set(tone, await createDecoratedSurface(
                reusable.geometry, tone, pixelRatio, checkpoint, signal,
              ));
            }
          }
          await checkpoint();
          // Crops use each surface's own pixel ratio. Retaining the first tone
          // avoids a synchronous full-region resample at a section boundary.
          for (const [tone, surface] of additions) reusable.surfaces.set(tone, surface);
          lastPreparationTiming = `net=0 mask=0 deco=${Math.round(performance.now() - preparationStartedAt)}ms`;
          preparationStage = "ready";
          return reusable;
        } catch (error) {
          preparationStage = "aborted";
          for (const surface of additions.values()) releaseDecoratedSurface(surface);
          throw error;
        }
      }
      preparationStage = "network";
      const paths = await waitForTouchPreparation(loadLensGeometry(lensImageUrl, request.region), signal);
      const pathCount = paths.length;
      geometryLoadedAt = performance.now();
      await checkpoint();
      // Keep expensive full-region mask raster and halo passes inside the
      // worker when its Path2D probe passed. No main-thread ImageBitmap copy.
      preparationStage = "worker-mask";
      const workerRegion = await decorateRegionInWorker(
        paths, request, request.tones, pixelRatio, signal,
      );
      if (workerRegion.result) {
        const mask = document.createElement("canvas");
        const geometry: TouchGeometry = {
          key: request.key,
          layoutVersion: request.layoutVersion,
          mask,
          maskPixelRatio: workerRegion.maskRatio,
          originX: request.renderLeft + request.region.x * request.renderScale,
          originY: request.region.y * request.renderScale,
          region: request.region,
          renderLeft: request.renderLeft,
          renderScale: request.renderScale,
          sourcePaths: paths,
        };
        const prepared: PreparedTouchRegion = { geometry, surfaces: new Map() };
        try {
          for (const output of workerRegion.result.outputs) {
            prepared.surfaces.set(output.tone, {
              canvas: output.output,
              geometry,
              pixelRatio,
              tone: output.tone,
            });
          }
          await checkpoint();
          lastPreparationTiming = `paths=${pathCount} net=${Math.round(geometryLoadedAt - preparationStartedAt)} worker=${Math.round(performance.now() - geometryLoadedAt)}ms`;
          preparationStage = "ready";
          return prepared;
        } catch (error) {
          releaseTouchRegion(prepared);
          throw error;
        }
      }
      // Unsupported worker Path2D retains the original Canvas fallback.
      preparationStage = "mask";
      const mask = await createTouchGeometryMask(paths, request, checkpoint, pathCache);
      maskReadyAt = performance.now();
      const geometry: TouchGeometry = {
        key: request.key,
        layoutVersion: request.layoutVersion,
        ...mask,
        originX: request.renderLeft + request.region.x * request.renderScale,
        originY: request.region.y * request.renderScale,
        region: request.region,
        renderLeft: request.renderLeft,
        renderScale: request.renderScale,
      };
      const prepared: PreparedTouchRegion = { geometry, surfaces: new Map() };
      try {
        preparationStage = "decorate";
        for (const tone of request.tones) {
          prepared.surfaces.set(tone,
            await createDecoratedSurface(geometry, tone, pixelRatio, checkpoint, signal));
        }
        await checkpoint();
        const finishedAt = performance.now();
        lastPreparationTiming = `paths=${pathCount} net=${Math.round(geometryLoadedAt - preparationStartedAt)} mask=${Math.round(maskReadyAt - geometryLoadedAt)} deco=${Math.round(finishedAt - maskReadyAt)}ms`;
        preparationStage = "ready";
        return prepared;
      } catch (error) {
        preparationStage = "aborted";
        releaseTouchRegion(prepared);
        throw error;
      }
    }

    function geometryCoversRequest(
      geometry: TouchGeometry | null,
      request: ReturnType<typeof geometryRequest>,
      margin: number | { x: number; y: number } = 0,
    ) {
      const sourceMargin = typeof margin === "number"
        ? margin / request.renderScale
        : { x: margin.x / request.renderScale, y: margin.y / request.renderScale };
      return geometry !== null && touchGeometryCovers(
        geometry,
        { layoutVersion: request.layoutVersion, region: request.requiredRegion },
        sourceMargin,
      );
    }

    function preparedCoversRequest(
      prepared: PreparedTouchRegion | null,
      request: ReturnType<typeof geometryRequest>,
      margin: number | { x: number; y: number } = 0,
    ) {
      return prepared !== null &&
        geometryCoversRequest(prepared.geometry, request, margin) &&
        request.tones.every((tone) => prepared.surfaces.has(tone));
    }

    function preparedCoversPrefetch(
      prepared: PreparedTouchRegion | null,
      request: ReturnType<typeof geometryRequest>,
    ) {
      return preparedCoversRequest(prepared, request, {
        x: 0,
        y: TOUCH_PREFETCH_MARGIN,
      });
    }

    function updatePreparationIntent() {
      if (state.phase === "idle" || !state.point) { preparation.want(null); return; }
      const request = geometryRequest(state.point);
      const active = preparation.active;
      if (preparedCoversPrefetch(active, request)) {
        preparation.want(null);
        return;
      }
      const wanted = preparation.wanted;
      if (wanted && request.tones.every((tone) => wanted.tones.includes(tone)) && touchGeometryCovers(wanted, {
        layoutVersion, region: request.requiredRegion,
      })) return;
      if (performance.now() < retryPreparationAt) return;
      if (!preparedCoversRequest(active, request)) geometryMisses += 1;
      preparation.want(request);
    }

    function clearSteadyEnvelopes() {
      for (const surface of steadyEnvelopes.values()) {
        surface.width = 0;
        surface.height = 0;
      }
      steadyEnvelopes.clear();
    }

    function ensureMaskCanvases(size: number) {
      const pixels = Math.max(1, Math.ceil(TOUCH_LENS_DIAMETER * viewportPixelRatio));
      if (envelopeCanvas.width !== pixels || envelopeCanvas.height !== pixels) {
        clearSteadyEnvelopes();
        envelopeCanvas.width = pixels;
        envelopeCanvas.height = pixels;
        flameCanvas.width = pixels;
        flameCanvas.height = pixels;
      }
      return Math.max(1, Math.ceil(size * viewportPixelRatio));
    }

    function paintEnvelopeMask(
      size: number,
      radius: number,
      stops: EnvelopeStop[],
      tone: TouchTone,
    ) {
      const steady = size === TOUCH_LENS_DIAMETER && radius === TOUCH_ENVELOPE_RADIUS;
      const cached = steady ? steadyEnvelopes.get(tone) : null;
      if (cached) return cached;
      const center = size / 2;
      const pixels = size * viewportPixelRatio;
      envelopeContext.setTransform(1, 0, 0, 1, 0, 0);
      envelopeContext.globalCompositeOperation = "source-over";
      envelopeContext.clearRect(0, 0, pixels, pixels);
      const gradient = envelopeContext.createRadialGradient(
        center * viewportPixelRatio,
        center * viewportPixelRatio,
        0,
        center * viewportPixelRatio,
        center * viewportPixelRatio,
        Math.max(1, radius * viewportPixelRatio),
      );
      for (const stop of stops) {
        gradient.addColorStop(stop.offset, `rgb(255 255 255 / ${stop.opacity})`);
      }
      gradient.addColorStop(1, "rgb(255 255 255 / 0)");
      envelopeContext.fillStyle = gradient;
      envelopeContext.fillRect(0, 0, pixels, pixels);
      if (!steady) return envelopeCanvas;
      const surface = document.createElement("canvas");
      surface.width = envelopeCanvas.width;
      surface.height = envelopeCanvas.height;
      const context = surface.getContext("2d");
      if (!context) return envelopeCanvas;
      context.drawImage(envelopeCanvas, 0, 0);
      steadyEnvelopes.set(tone, surface);
      return surface;
    }

    function paintFlameMask(
      size: number,
      globalPulseFrame: GlobalFlamePulseFrame,
      activeFlames: TouchLocalFlame[],
      at: number,
      enabled: boolean,
    ) {
      const pixels = size * viewportPixelRatio;
      flameContext.setTransform(1, 0, 0, 1, 0, 0);
      flameContext.globalCompositeOperation = "source-over";
      flameContext.clearRect(0, 0, pixels, pixels);
      flameContext.fillStyle = `rgb(255 255 255 / ${
        enabled ? DESKTOP_NEUTRAL_FLAME_ALPHA : 1
      })`;
      flameContext.fillRect(0, 0, pixels, pixels);
      if (!enabled) return;

      flameContext.globalCompositeOperation = globalPulseFrame.mode === "rise"
        ? "source-over" : "destination-out";
      flameContext.fillStyle = `rgb(255 255 255 / ${globalPulseFrame.opacity})`;
      flameContext.fillRect(0, 0, pixels, pixels);

      for (const flame of activeFlames) {
        const strength = touchLocalFlamePhaseOpacity(flame, at);
        flameContext.globalCompositeOperation = flame.mode === "rise"
          ? "source-over" : "destination-out";
        const lobe = flameContext.createRadialGradient(
          flame.x * viewportPixelRatio,
          flame.y * viewportPixelRatio,
          0,
          flame.x * viewportPixelRatio,
          flame.y * viewportPixelRatio,
          flame.radius * viewportPixelRatio,
        );
        lobe.addColorStop(0, `rgb(255 255 255 / ${flame.peakOpacity * strength})`);
        lobe.addColorStop(0.2, `rgb(255 255 255 / ${flame.peakOpacity * 0.82 * strength})`);
        lobe.addColorStop(0.52, `rgb(255 255 255 / ${flame.peakOpacity * 0.34 * strength})`);
        lobe.addColorStop(0.8, `rgb(255 255 255 / ${flame.peakOpacity * 0.075 * strength})`);
        lobe.addColorStop(1, "rgb(255 255 255 / 0)");
        flameContext.fillStyle = lobe;
        flameContext.fillRect(
          (flame.x - flame.radius) * viewportPixelRatio,
          (flame.y - flame.radius) * viewportPixelRatio,
          flame.radius * 2 * viewportPixelRatio,
          flame.radius * 2 * viewportPixelRatio,
        );
      }
      flameContext.globalCompositeOperation = "source-over";
    }

    function toneColors(tone: TouchTone) {
      return tone === "pink"
        ? { halo: "rgb(223 58 148 / 0.95)", core: "#fff0f8" }
        : { halo: "rgb(0 124 255 / 0.95)", core: "#edf9ff" };
    }

    function paintSample(
      context: CanvasRenderingContext2D,
      geometry: TouchGeometry,
      point: { x: number; y: number },
      size: number,
      envelopeRadius: number,
      opacity: number,
      at: number,
      activeFlames: TouchLocalFlame[] = [],
      globalPulseFrame: GlobalFlamePulseFrame = { mode: "rise", opacity: 0 },
      destination?: { left: number; top: number },
      flameEnabled = true,
    ) {
      const radius = size / 2;
      const sampleLeft = point.x - radius;
      const sampleTop = point.y - radius;
      const clientLeft = destination?.left ?? sampleLeft - surfacePageLeft;
      const clientTop = destination?.top ?? sampleTop - surfacePageTop;
      const samplePixels = ensureMaskCanvases(size);
      const intervals = touchToneIntervals(
        sampleTop,
        sampleTop + size,
        mutedRanges,
        impactRanges,
      );
      const prepared = preparation.active;
      if (!prepared || prepared.geometry !== geometry ||
          intervals.some((interval) => !prepared.surfaces.has(interval.tone))) return false;
      paintFlameMask(size, globalPulseFrame, activeFlames, at, flameEnabled);

      for (const interval of intervals) {
        const surface = prepared.surfaces.get(interval.tone)!;
        const stripTop = interval.top - sampleTop;
        const stripHeight = interval.bottom - interval.top;
        const stops = touchEnvelopeStops(interval.tone, {
          blue: BLUE_ENVELOPE_STOPS,
          pink: PINK_ENVELOPE_STOPS,
        });
        const envelope = paintEnvelopeMask(size, envelopeRadius, stops, interval.tone);
        const { sourceX, sourceY } = touchDecoratedCrop(
          sampleLeft, sampleTop, size,
          geometry.originX, geometry.originY, surface.pixelRatio,
        );
        context.save();
        context.beginPath();
        context.rect(
          clientLeft,
          clientTop + stripTop,
          size,
          stripHeight,
        );
        context.clip();
        context.globalAlpha = opacity;
        context.drawImage(
          surface.canvas,
          sourceX,
          sourceY + stripTop * surface.pixelRatio,
          size * surface.pixelRatio,
          stripHeight * surface.pixelRatio,
          clientLeft, clientTop + stripTop, size, stripHeight,
        );
        context.globalCompositeOperation = "destination-in";
        context.drawImage(
          flameCanvas,
          0, stripTop * viewportPixelRatio,
          samplePixels, stripHeight * viewportPixelRatio,
          clientLeft, clientTop + stripTop, size, stripHeight,
        );
        context.drawImage(
          envelope,
          0, stripTop * viewportPixelRatio,
          samplePixels, stripHeight * viewportPixelRatio,
          clientLeft, clientTop + stripTop, size, stripHeight,
        );
        context.restore();
      }
      return true;
    }

    function updateFlames(at: number) {
      for (let index = 0; index < flameSlots.length; index += 1) {
        const flame = flameSlots[index];
        if (flame && !touchLocalFlameIsActive(flame, at)) {
          flameSlots[index] = null;
        }
      }
      if (at >= nextFlameAt) {
        const availableSlots = flameSlots.flatMap((flame, index) =>
          flame === null ? [index] : []
        );
        const selectedSlot = availableSlots[
          Math.floor(Math.random() * availableSlots.length)
        ];
        if (selectedSlot !== undefined) {
          flameSlots[selectedSlot] = sampleTouchLocalFlame(
            selectedSlot,
            at,
            TOUCH_LENS_DIAMETER,
          );
        }
        nextFlameAt = at + sampleTouchLocalFlameSpawnDelay();
      }
      globalFlamePulse = advanceGlobalFlamePulse(globalFlamePulse, at);
      return {
        global: evaluateGlobalFlamePulse(globalFlamePulse, at),
        local: activeTouchLocalFlames(flameSlots, at),
      };
    }

    function createTrail(point: { x: number; y: number }, at: number) {
      const prepared = preparation.active;
      const currentGeometry = prepared?.geometry ?? null;
      if (!currentPoint || !preparedCoversRequest(prepared, geometryRequest(currentPoint))) {
        return;
      }
      if (!currentGeometry) return;
      const distance = Math.hypot(point.x - currentPoint.x, point.y - currentPoint.y);
      if (distance < TOUCH_TRAIL_MIN_DISTANCE || at - lastTrailAt < TOUCH_TRAIL_MIN_INTERVAL) {
        return;
      }
      const trailPoint = currentPoint;
      const padding = 24;
      const bitmap = document.createElement("canvas");
      bitmap.width = Math.ceil((TOUCH_TRAIL_DIAMETER + padding * 2) * viewportPixelRatio);
      bitmap.height = bitmap.width;
      const context = bitmap.getContext("2d");
      if (!context) return;
      context.setTransform(viewportPixelRatio, 0, 0, viewportPixelRatio, 0, 0);
      paintSample(
        context,
        currentGeometry,
        trailPoint,
        TOUCH_TRAIL_DIAMETER,
        TOUCH_TRAIL_RADIUS,
        1,
        at,
        [],
        { mode: "rise", opacity: 0 },
        { left: padding, top: padding },
        false,
      );
      bitmap.className = "public-circuit-touch-trail";
      bitmap.style.width = `${TOUCH_TRAIL_DIAMETER + padding * 2}px`;
      bitmap.style.height = `${TOUCH_TRAIL_DIAMETER + padding * 2}px`;
      bitmap.style.transform = `translate3d(${
        trailPoint.x - TOUCH_TRAIL_RADIUS - padding
      }px,${trailPoint.y - TOUCH_TRAIL_RADIUS - padding}px,0)`;
      pageElement.append(bitmap);
      trails.push({ bitmap, createdAt: at, point: { ...trailPoint } });
      lastTrailAt = at;
      while (trails.length > TOUCH_TRAIL_LIMIT) {
        const expired = trails.shift();
        expired?.bitmap.remove();
      }
    }

    function writePresentation(
      presentation: ReturnType<typeof touchInteractionPresentation>,
      geometry: TouchGeometry | null,
      at: number,
    ) {
      state = presentation.state;
      ensureShell();
      if (!canvas || !viewportContext) return;
      if (!presentation.mounted || !state.point) {
        scrollTouchAnchor = null;
        canvas.hidden = true;
        for (const main of mainCanvases) main.style.visibility = "hidden";
        mainFront = null;
        for (const trail of trails.splice(0)) trail.bitmap.remove();
        flameSlots.fill(null);
        nextFlameAt = 0;
        globalFlamePulse = null;
        currentPoint = null;
        return;
      }
      if (!diagnosticTrailsOff && geometry && state.phase === "contact") createTrail(state.point, at);
      canvas.hidden = true;
      for (let index = trails.length - 1; index >= 0; index -= 1) {
        const age = at - trails[index].createdAt;
        if (age >= POINTER_TRAIL_DURATION) {
          trails[index].bitmap.remove();
          trails.splice(index, 1);
          continue;
        }
        const progress = Math.max(0, age / POINTER_TRAIL_DURATION);
        trails[index].bitmap.style.opacity = String(
          0.48 * (1 - progress) * (1 - progress),
        );
      }
      // Only a fully painted back canvas may take ownership of the origin.
      // Coverage misses keep the front anchored to its last published page point.
      const active = preparation.active?.geometry ?? null;
      const paintGeometry = geometry ?? (currentPoint &&
        preparedCoversRequest(preparation.active, geometryRequest(currentPoint)) ? active : null);
      const paintPoint = geometry ? state.point : currentPoint;
      for (const main of mainCanvases) main.style.opacity = String(presentation.opacity);
      if (paintGeometry && paintPoint) {
        const flameFrame = updateFlames(at);
        let painted = false;
        const paintBack = (back: number) => {
          const target = mainCanvases[back];
          const pixels = Math.ceil(TOUCH_LENS_DIAMETER * viewportPixelRatio);
          if (target.width !== pixels || target.height !== pixels) {
            target.width = pixels;
            target.height = pixels;
          }
          const mainContext = target.getContext("2d");
          if (!mainContext) return false;
          mainContext.setTransform(1, 0, 0, 1, 0, 0);
          mainContext.clearRect(0, 0, target.width, target.height);
          mainContext.setTransform(viewportPixelRatio, 0, 0, viewportPixelRatio, 0, 0);
          painted = paintSample(
            mainContext, paintGeometry, paintPoint,
            TOUCH_LENS_DIAMETER,
            TOUCH_ENVELOPE_RADIUS * presentation.envelopeScale,
            1, at, flameFrame.local, flameFrame.global,
            { left: 0, top: 0 },
          );
          return painted;
        };
        mainFront = publishTouchMainCanvas(
          mainCanvases, mainFront, paintPoint, TOUCH_LENS_DIAMETER, paintBack,
        );
        if (painted) currentPoint = { ...paintPoint };
      }
      canvas.dataset.geometryCacheSize = String(preparation.active ? 1 : 0);
      canvas.dataset.preparedTones = [...(preparation.active?.surfaces.keys() ?? [])].join(",");
      if (debugElement) canvas.dataset.preparedPixelRatios =
        [...(preparation.active?.surfaces.values() ?? [])]
          .map((surface) => `${surface.tone}:${surface.pixelRatio.toFixed(2)}`).join(",");
      canvas.dataset.requiredTones = geometryRequest(state.point).tones.join(",");
      canvas.dataset.geometryMisses = String(geometryMisses);
      canvas.dataset.geometryStatus = geometry
        ? preparation.wanted ? "ready-preparing" : "ready"
        : mainFront === null ? "cold-miss" : "retained-preparing";
      canvas.dataset.trailCount = String(trails.length);
      if (debugElement) {
        const lag = state.point && currentPoint
          ? Math.round(Math.hypot(state.point.x - currentPoint.x, state.point.y - currentPoint.y))
          : state.point ? -1 : 0;
        const pendingAge = preparation.running ? Math.round(performance.now() - preparationStarted) : 0;
        const fingerGap = touchSample && currentPoint
          ? Math.round(Math.hypot(
            touchSample.clientX - (currentPoint.x + pageDocumentLeft - window.scrollX),
            touchSample.clientY - (currentPoint.y + pageDocumentTop - window.scrollY),
          )) : 0;
        peakDebugLag = Math.max(peakDebugLag, lag);
        if (at - lastDebugUpdate >= 100) {
          debugElement.textContent = [
            `PCB ${canvas.dataset.geometryStatus} lag=${lag}px peak=${peakDebugLag}px blur=${diagnosticUnderlayStyle ? "off" : "on"} trails=${diagnosticTrailsOff ? "off" : "on"}`,
            `gesture=${pointerTouchActive ? "pointer" : scrollTouchPointerId !== null ? "scroll-touch" : state.phase} pc=${pointerCancels} pm=${pointerMoves} tf=${fallbackMoves} pageDy=${Math.round(gestureScrollDelta)}px`,
            `finger=${fingerGap}px raf=${lastFrameGap}ms paint=${lastFrameCost}ms`,
            `tone=${canvas.dataset.requiredTones}/${canvas.dataset.preparedTones} ${preparationStage} age=${pendingAge}ms`,
            `touch=${Math.round(at - lastTouchEventAt)}ms input=${lastTouchDeliveryLag}ms`,
            `scroll=${Math.round(at - lastScrollEventAt)}ms input=${lastScrollDeliveryLag}ms miss=${geometryMisses} prep=${preparationStarts} abort=${preparationAborts}`,
            `layout=${layoutVersion} h=${pageHeight} vw=${window.innerWidth} vh=${window.innerHeight} scale=${window.visualViewport?.scale.toFixed(2) ?? "1"} dpr=${viewportPixelRatio.toFixed(2)} ${lastPreparationTiming}`,
            `prepCall=${lastPreparationCall} peak=${Math.round(peakPreparationCallMs)}ms ago=${lastPreparationCallAt ? Math.round(at - lastPreparationCallAt) : -1}ms`,
          ].join("\n");
          lastDebugUpdate = at;
          peakDebugLag = 0;
        }
        canvas.dataset.publicationLag = String(lag);
        canvas.dataset.preparationStage = preparationStage;
        canvas.dataset.preparationAborts = String(preparationAborts);
        canvas.dataset.preparationStarts = String(preparationStarts);
        canvas.dataset.preparationTiming = lastPreparationTiming;
        canvas.dataset.preparationCall = lastPreparationCall;
        canvas.dataset.preparationCallAge = String(
          lastPreparationCallAt ? Math.round(at - lastPreparationCallAt) : -1,
        );
        canvas.dataset.preparationAge = String(pendingAge);
        canvas.dataset.frameCost = String(lastFrameCost);
      }
    }

    function commitFrame(at: number) {
      const presentation = touchInteractionPresentation(state, at);
      state = presentation.state;
      let geometry: TouchGeometry | null = null;
      if (presentation.mounted && state.point) {
        const request = geometryRequest(state.point);
        const active = preparation.active;
        if (preparedCoversRequest(active, request)) geometry = active!.geometry;
      }
      updatePreparationIntent();
      const paintStarted = performance.now();
      writePresentation(presentation, geometry, at);
      lastFrameCost = Math.round(performance.now() - paintStarted);
      if (state.phase !== "idle" || trails.length > 0) scheduleFrame(performance.now());
    }

    function scheduleFrame(at = performance.now()) {
      pendingAt = Math.max(pendingAt, at);
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        if (debugElement || captureEnabled) {
          const now = performance.now();
          lastFrameGap = lastFrameAt ? Math.round(now - lastFrameAt) : 0;
          lastFrameAt = now;
        }
        const inputChanged = reducePendingInput();
        const minFrameInterval = state.phase === "contact" ? 16 : 32;
        const animationDue = state.phase !== "idle" && pendingAt - lastRenderAt >= minFrameInterval;
        const shouldPresent = inputChanged || presentationDirty || animationDue;
        presentationDirty = false;
        if (shouldPresent) {
          lastRenderAt = pendingAt;
          commitFrame(pendingAt);
        } else if (state.phase !== "idle") {
          scheduleFrame(performance.now());
        }
        if (captureEnabled && captureFrames.length < 400 && state.phase === "contact") {
          const fingerGap = touchSample && currentPoint
            ? Math.round(Math.hypot(
                touchSample.clientX - (currentPoint.x + pageDocumentLeft - window.scrollX),
                touchSample.clientY - (currentPoint.y + pageDocumentTop - window.scrollY),
              )) : -1;
          captureFrames.push({
            t: Math.round(performance.now()),
            gap: lastFrameGap,
            paint: lastFrameCost,
            fingerGap,
            inputAge: lastTouchEventAt ? Math.round(performance.now() - lastTouchEventAt) : -1,
            inputDelivery: lastTouchDeliveryLag,
            phase: state.phase,
            status: canvas?.dataset.geometryStatus ?? "none",
            tone: canvas?.dataset.requiredTones ?? "none",
            prepared: canvas?.dataset.preparedTones ?? "none",
            prep: preparationStage,
            prepCall: lastPreparationCall,
            starts: preparationStarts,
            aborts: preparationAborts,
            misses: geometryMisses,
            scrollY: window.scrollY,
          });
        }
      });
    }

    function reduceAction(action: TouchInteractionAction) {
      const previous = state;
      state = reduceTouchInteractionState(state, action);
      if (action.type === "contact" && state !== previous) {
        if (holdTimer !== null) window.clearTimeout(holdTimer);
        holdTimer = null;
        ensureShell();
      }
      if ((action.type === "release" || action.type === "cancel") && state !== previous) {
        if (holdTimer !== null) window.clearTimeout(holdTimer);
        holdTimer = window.setTimeout(() => {
          holdTimer = null;
          reduceAction({ type: "tick", at: performance.now() });
          presentationDirty = true;
          scheduleFrame();
        }, TOUCH_HOLD_MS);
      }
      return state !== previous;
    }

    function reducePendingInput() {
      if (!inputDirty || !touchSample) return false;
      inputDirty = false;
      const point = pendingPagePoint ??
        touchPagePoint(touchSample, pageDocumentLeft, pageDocumentTop);
      pendingPagePoint = null;
      const phase = pendingTouchPhase;
      const id = pendingTouchId ?? state.activeTouchId;
      pendingTouchPhase = null;
      pendingTouchId = null;
      let changed = false;

      if (phase === "contact" || phase === "move") {
        if (id === null) return false;
        changed = reduceAction({
          type: state.activeTouchId === null ? "contact" : "move",
          at: pendingTouchAt,
          id,
          ...point,
        });
      } else if (phase === "release" || phase === "cancel") {
        if (id === null) return false;
        if (state.activeTouchId === null) {
          changed = reduceAction({ type: "contact", at: pendingTouchAt, id, ...point });
        } else {
          changed = reduceAction({ type: "move", at: pendingTouchAt, id, ...point }) || changed;
        }
        changed = reduceAction({ type: phase, at: pendingTouchAt, id }) || changed;
      } else {
        changed = reduceAction({ type: "reposition", at: pendingAt, ...point });
      }
      return changed;
    }

    function changedTouch(event: TouchEvent, id = trackedTouchId) {
      return Array.from(event.changedTouches).find(
        (touch) => id === null || touch.identifier === id,
      );
    }

    function handleTouch(event: TouchEvent, type: "contact" | "move" | "release" | "cancel") {
      if (pointerTouchActive) return;
      if (scrollTouchAnchor && scrollTouchPointerId !== null) {
        const touch = changedTouch(event, scrollNativeTouchId);
        if (!touch) return;
        if (type === "move" && (debugElement || captureEnabled)) fallbackMoves += 1;
        if (scrollNativeTouchId === null) scrollNativeTouchId = touch.identifier;
        const at = performance.now();
        if (debugElement || captureEnabled) {
          lastTouchEventAt = at;
          const delivery = at - event.timeStamp;
          lastTouchDeliveryLag = delivery >= 0 && delivery < 60_000
            ? Math.round(delivery) : -1;
        }
        touchSample = {
          clientX: touch.clientX,
          clientY: touch.clientY,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
        };
        pendingPagePoint = touchScrollPoint(
          scrollTouchAnchor.point, scrollTouchAnchor.clientX, touch.clientX,
        );
        pendingTouchId = scrollTouchPointerId;
        pendingTouchAt = at;
        if (type === "move" && pendingTouchPhase === "contact") {
          // Keep the initial contact when scrolling starts before its first frame.
        } else {
          pendingTouchPhase = type;
        }
        inputDirty = true;
        if (type === "release" || type === "cancel") {
          scrollTouchPointerId = null;
          scrollNativeTouchId = null;
        }
        scheduleFrame(at);
        if (type === "release" || type === "cancel") scheduleCaptureUpload();
        return;
      }
      const touch = changedTouch(event);
      if (!touch || (type === "contact" && trackedTouchId !== null)) return;
      if (type === "contact") {
        scrollTouchAnchor = null;
        scrollTouchPointerId = null;
        scrollNativeTouchId = null;
      }
      const at = performance.now();
      if (debugElement || captureEnabled) {
        lastTouchEventAt = at;
        const delivery = at - event.timeStamp;
        lastTouchDeliveryLag = delivery >= 0 && delivery < 60_000
          ? Math.round(delivery) : -1;
      }
      if (type === "contact") trackedTouchId = touch.identifier;
      if (type !== "contact" && touch.identifier !== trackedTouchId) return;
      const nextSample = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      };
      viewportScrollX = nextSample.scrollX;
      viewportScrollY = nextSample.scrollY;
      touchSample = touchSample
        ? mergeTouchFrameSample(touchSample, nextSample)
        : nextSample;
      pendingTouchId = touch.identifier;
      pendingTouchAt = at;
      if (type === "move" && pendingTouchPhase === "contact") {
        // Preserve the uncommitted contact while taking its latest coordinates.
      } else {
        pendingTouchPhase = type;
      }
      inputDirty = true;
      if (type === "release" || type === "cancel") {
        trackedTouchId = null;
      }
      scheduleFrame(at);
      if (type === "release" || type === "cancel") scheduleCaptureUpload();
    }

    function handlePointerTouch(event: PointerEvent, type: "contact" | "move" | "release" | "cancel") {
      if (event.pointerType !== "touch") return;
      if (type === "contact") {
        if (pointerTouchActive) return;
        pointerTouchActive = true;
        if (debugElement || captureEnabled) {
          pointerMoves = 0;
          fallbackMoves = 0;
          gestureScrollStart = window.scrollY;
          gestureScrollDelta = 0;
          peakPreparationCallMs = 0;
        }
        trackedTouchId = event.pointerId;
        scrollTouchAnchor = null;
        scrollTouchPointerId = null;
        scrollNativeTouchId = null;
      } else if (!pointerTouchActive || event.pointerId !== trackedTouchId) {
        return;
      }
      if (type === "move" && (debugElement || captureEnabled)) pointerMoves += 1;
      const at = performance.now();
      if (debugElement || captureEnabled) {
        lastTouchEventAt = at;
        const delivery = at - event.timeStamp;
        lastTouchDeliveryLag = delivery >= 0 && delivery < 60_000
          ? Math.round(delivery) : -1;
      }
      const nextSample = {
        clientX: event.clientX,
        clientY: event.clientY,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      };
      viewportScrollX = nextSample.scrollX;
      viewportScrollY = nextSample.scrollY;
      touchSample = touchSample
        ? mergeTouchFrameSample(touchSample, nextSample)
        : nextSample;
      pendingTouchId = event.pointerId;
      pendingPagePoint = null;
      pendingTouchAt = at;
      pendingTouchPhase = type;
      inputDirty = true;
      if (type === "release" || type === "cancel") {
        pointerTouchActive = false;
        trackedTouchId = null;
      }
      scheduleFrame(at);
      if (type === "release" || type === "cancel") scheduleCaptureUpload();
    }

    const listenerOptions: AddEventListenerOptions = { capture: true, passive: true };
    const onTouchStart = (event: TouchEvent) => handleTouch(event, "contact");
    const onTouchMove = (event: TouchEvent) => handleTouch(event, "move");
    const onTouchEnd = (event: TouchEvent) => handleTouch(event, "release");
    const onTouchCancel = (event: TouchEvent) => handleTouch(event, "cancel");
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        try { pageElement.setPointerCapture(event.pointerId); } catch {}
        handlePointerTouch(event, "contact");
      }
    };
    const onPointerMove = (event: PointerEvent) => handlePointerTouch(event, "move");
    const onPointerUp = (event: PointerEvent) => handlePointerTouch(event, "release");
    const onPointerCancel = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || !pointerTouchActive ||
          event.pointerId !== trackedTouchId) return;
      if (debugElement || captureEnabled) pointerCancels += 1;
      if (touchSample) {
        // Pointer cancellation hands native panning to Safari, but the finger
        // remains down. Keep the interaction in contact until Touch Events
        // report the actual lift, so horizontal drift still reaches the glow.
        const anchorPoint = pendingPagePoint ??
          touchPagePoint(touchSample, pageDocumentLeft, pageDocumentTop);
        scrollTouchAnchor = {
          point: anchorPoint,
          clientX: touchSample.clientX,
        };
      }
      if (scrollTouchAnchor) {
        scrollTouchPointerId = event.pointerId;
        scrollNativeTouchId = null;
        pointerTouchActive = false;
        trackedTouchId = null;
        pendingPagePoint = scrollTouchAnchor.point;
        pendingTouchId = event.pointerId;
        pendingTouchAt = performance.now();
        pendingTouchPhase = "move";
        inputDirty = true;
        scheduleFrame(pendingTouchAt);
        return;
      }
      handlePointerTouch(event, "cancel");
    };
    const onScroll = (event: Event) => {
      if (debugElement && (pointerTouchActive || scrollTouchAnchor)) {
        gestureScrollDelta = window.scrollY - gestureScrollStart;
      }
      if (scrollTouchAnchor) return;
      if (!touchSample || (state.phase === "idle" && pendingTouchPhase === null)) return;
      const at = performance.now();
      if (debugElement) {
        lastScrollEventAt = at;
        const delivery = at - event.timeStamp;
        lastScrollDeliveryLag = delivery >= 0 && delivery < 60_000
          ? Math.round(delivery) : -1;
      }
      viewportScrollX = window.scrollX;
      viewportScrollY = window.scrollY;
      positionViewportCanvas();
      touchSample = mergeTouchFrameSample(touchSample, {
        scrollX: viewportScrollX,
        scrollY: viewportScrollY,
      });
      inputDirty = true;
      scheduleFrame(at);
    };
    if (debugParams.get("pcb-debug") === "1") {
      if (debugParams.get("pcb-underlay") === "off") {
        diagnosticUnderlayStyle = document.createElement("style");
        diagnosticUnderlayStyle.dataset.pcbDiagnosticUnderlay = "off";
        diagnosticUnderlayStyle.textContent = ".public-circuit-page .circuit-text-underlay-shadow,.public-circuit-page .button-secondary::before{filter:none!important}";
        document.head.append(diagnosticUnderlayStyle);
      }
      debugElement = document.createElement("div");
      debugElement.style.cssText = "position:fixed!important;left:8px!important;bottom:8px!important;z-index:2147483647!important;display:block!important;max-width:calc(100vw - 16px)!important;overflow:hidden!important;white-space:pre!important;padding:6px 8px!important;background:#000!important;color:#0f0!important;font:12px/1.3 monospace!important;pointer-events:none!important;contain:layout paint style!important";
      debugElement.setAttribute("aria-hidden", "true");
      debugElement.textContent = `PCB touch idle — touch once${diagnosticUnderlayStyle ? " (underlay blur off)" : ""}${diagnosticTrailsOff ? " (trails off)" : ""}`;
      document.body.append(debugElement);
    }
    rebuildLayout();
    const resizeObserver = new ResizeObserver(rebuildLayout);
    resizeObserver.observe(pageElement);
    window.addEventListener("touchstart", onTouchStart, listenerOptions);
    window.addEventListener("touchmove", onTouchMove, listenerOptions);
    window.addEventListener("touchend", onTouchEnd, listenerOptions);
    window.addEventListener("touchcancel", onTouchCancel, listenerOptions);
    pageElement.addEventListener("pointerdown", onPointerDown, listenerOptions);
    pageElement.addEventListener("pointermove", onPointerMove, listenerOptions);
    pageElement.addEventListener("pointerup", onPointerUp, listenerOptions);
    pageElement.addEventListener("pointercancel", onPointerCancel, listenerOptions);
    window.addEventListener("scroll", onScroll, listenerOptions);

    return () => {
      disposed = true;
      if (captureUploadTimer !== null) window.clearTimeout(captureUploadTimer);
      uploadCapture();
      if (frame !== null) window.cancelAnimationFrame(frame);
      if (holdTimer !== null) window.clearTimeout(holdTimer);
      resizeObserver.disconnect();
      window.removeEventListener("touchstart", onTouchStart, listenerOptions);
      window.removeEventListener("touchmove", onTouchMove, listenerOptions);
      window.removeEventListener("touchend", onTouchEnd, listenerOptions);
      window.removeEventListener("touchcancel", onTouchCancel, listenerOptions);
      pageElement.removeEventListener("pointerdown", onPointerDown, listenerOptions);
      pageElement.removeEventListener("pointermove", onPointerMove, listenerOptions);
      pageElement.removeEventListener("pointerup", onPointerUp, listenerOptions);
      pageElement.removeEventListener("pointercancel", onPointerCancel, listenerOptions);
      window.removeEventListener("scroll", onScroll, listenerOptions);
      canvas?.remove();
      diagnosticUnderlayStyle?.remove();
      for (const main of mainCanvases) {
        main.remove();
        main.width = 0;
        main.height = 0;
      }
      styleElement?.remove();
      debugElement?.remove();
      for (const trail of trails.splice(0)) trail.bitmap.remove();
      flameSlots.fill(null);
      preparation.dispose();
      haloWorker.dispose();
      pathCache.clear();
      if (preparationTimer !== null) window.clearTimeout(preparationTimer);
      resumePreparation?.();
      clearSteadyEnvelopes();
      for (const surface of [envelopeCanvas, flameCanvas]) {
        surface.width = 0;
        surface.height = 0;
      }
    };
  }, [lensImageUrl, sourceHeight, sourceWidth]);

  return <span ref={anchorRef} hidden aria-hidden="true" />;
}
