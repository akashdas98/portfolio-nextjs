"use client";

import { useEffect, useId, useRef, type RefObject } from "react";
import {
  createEnvelopeDirections,
  envelopeContourPath,
  evaluateEnvelopeDisplacements,
  smoothStep,
  type EnvelopeEvaluatorConfig,
  type EnvelopeWave,
} from "@/lib/pcb/envelope-evaluator";
import {
  BLUE_ENVELOPE_STOPS,
  IMPACT_SECTION_SELECTOR,
  LENS_DIAMETER,
  LENS_RADIUS,
  MUTED_SECTION_SELECTOR,
  PINK_ENVELOPE_STOPS,
  POINTER_TRAIL_DURATION,
  loadLensGeometry,
  sampleFlameRadius,
  type EnvelopeStop,
  type InitialPointerInput,
  type LensPath,
  type PublicCircuitBackgroundProps,
  type ToneRange,
} from "@/components/public-circuit/shared";

const BASE_ENVELOPE_RADIUS = 247.5;

type FlameLobe = {
  circle: SVGCircleElement;
  core: SVGStopElement;
  inner: SVGStopElement;
  shoulder: SVGStopElement;
  tail: SVGStopElement;
  animation: Animation | null;
};

type EdgeLeak = EnvelopeWave;

const LOCAL_FLAME_LOBE_COUNT = 10;
const LOCAL_FLAME_LOBES = Array.from(
  { length: LOCAL_FLAME_LOBE_COUNT },
  (_, index) => index,
);
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
// A slot must remain available for the full 560ms decay at the fastest
// permitted sampling rate; recycling it early makes fast mouse trails vanish.
const POINTER_TRAIL_INTERVAL = 36;
const POINTER_TRAIL_COUNT = Math.ceil(POINTER_TRAIL_DURATION / POINTER_TRAIL_INTERVAL);
const POINTER_TRAIL_MIN_DISTANCE = 14;
const POINTER_TRAIL_DIAMETER = 260;
const POINTER_TRAILS = Array.from(
  { length: POINTER_TRAIL_COUNT },
  (_, index) => index,
);
const ENVELOPE_WARP_START = 0.68;

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
const ENVELOPE_DIRECTIONS = createEnvelopeDirections(256);
const ENVELOPE_EVALUATOR_CONFIG: EnvelopeEvaluatorConfig = {
  baseRadius: BASE_ENVELOPE_RADIUS,
  directions: ENVELOPE_DIRECTIONS,
  maxDisplacement: EDGE_MAX_DISPLACEMENT,
  tinyMaxDisplacement: EDGE_TINY_MAX_AMPLITUDE,
  warpStart: ENVELOPE_WARP_START,
};

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

function rectPath(top: number, bottom: number, width = LENS_DIAMETER) {
  return `M0 ${top}H${width}V${bottom}H0Z`;
}

export function DesktopCircuitInteraction({
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
    const pointerTrailCreatedAt: Array<number | null> = pointerTrails.map(() => null);
    let pointerTrailFrame: number | null = null;
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
      if (pointerTrailFrame !== null) {
        window.cancelAnimationFrame(pointerTrailFrame);
        pointerTrailFrame = null;
      }
      pointerTrailCreatedAt.forEach((_, index) => {
        pointerTrailCreatedAt[index] = null;
        const paint = pointerTrails[index]?.firstElementChild as HTMLElement | null;
        if (paint) paint.style.opacity = "0";
        pointerTrails[index]?.querySelector("[data-pointer-trail-geometry]")?.replaceChildren();
      });
      lastPointerTrailAt = 0;
      lastPointerTrailX = -LENS_DIAMETER;
      lastPointerTrailY = -LENS_DIAMETER;
    }

    function paintPointerTrails(at: number) {
      pointerTrailFrame = null;
      let active = false;
      pointerTrailCreatedAt.forEach((createdAt, index) => {
        if (createdAt === null) return;
        const age = at - createdAt;
        const paint = pointerTrails[index]?.firstElementChild as HTMLElement | null;
        if (age >= POINTER_TRAIL_DURATION || !paint) {
          pointerTrailCreatedAt[index] = null;
          if (paint) paint.style.opacity = "0";
          pointerTrails[index]?.querySelector("[data-pointer-trail-geometry]")?.replaceChildren();
          return;
        }
        const remaining = 1 - Math.max(0, age / POINTER_TRAIL_DURATION);
        paint.style.opacity = String(0.48 * remaining * remaining);
        active = true;
      });
      if (active) pointerTrailFrame = window.requestAnimationFrame(paintPointerTrails);
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
      ) return;
      const index = nextPointerTrail;
      const trail = pointerTrails[index];
      const paint = trail?.firstElementChild as SVGSVGElement | null;
      const geometryTransform = trail?.querySelector<SVGGElement>(
        "[data-pointer-trail-geometry]",
      );
      if (!trail || !paint || !geometryTransform) return;
      // The lens culls paths in its live source as it moves. A <use> of that
      // source therefore changes old trail samples during fast mouse motion.
      // Freeze the visible ordered paths here, as touch freezes trail pixels.
      const snapshot = document.createElementNS("http://www.w3.org/2000/svg", "g");
      snapshot.setAttribute("transform", geometryElement.getAttribute("transform") ?? "");
      for (const path of lensPaths) {
        if (!path.visible) continue;
        const copy = path.element.cloneNode(true) as SVGPathElement;
        copy.removeAttribute("id");
        snapshot.append(copy);
      }
      if (!snapshot.childNodes.length) return;
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
      geometryTransform.replaceChildren(snapshot);
      trail.dataset.tone = toneRanges.some(
        (range) => localY >= range.top && localY <= range.bottom,
      )
        ? "muted"
        : "base";
      pointerTrailCreatedAt[index] = timestamp;
      paint.style.opacity = "0.48";
      if (pointerTrailFrame === null) {
        pointerTrailFrame = window.requestAnimationFrame(paintPointerTrails);
      }
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
      const displacements = evaluateEnvelopeDisplacements(
        edgeLeaks,
        tinyWaves,
        timestamp,
        ENVELOPE_EVALUATOR_CONFIG,
      );
      envelopeContours.forEach((contour) => {
        if (contour.offset <= ENVELOPE_WARP_START) return;
        const path = envelopeContourPath(
          contour.offset,
          displacements,
          LENS_RADIUS,
          ENVELOPE_EVALUATOR_CONFIG,
        );
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
                <g data-pointer-trail-geometry />
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
