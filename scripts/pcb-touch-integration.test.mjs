import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { pathToFileURL } from "node:url";

import {
  boundedCanvasPixelRatio,
  cacheTouchDecoratedSurface,
  clearTouchDecoratedSurfaces,
  evictOldestTouchGeometry,
  parseTouchCanvasPath,
  touchCanvasSurfaceOrigin,
  touchDecoratedCrop,
  touchDecoratedSurfaceKey,
  touchEnvelopeStops,
  touchGeometryRegions,
  touchToneIntervals,
  touchRequiredTones,
  TOUCH_DECORATED_HALO_BLUR,
  TOUCH_DECORATED_HALO_PASSES,
  TOUCH_DECORATED_REGION_CACHE_LIMIT,
  TOUCH_GEOMETRY_CACHE_LIMIT,
  TOUCH_MASK_MAX_PIXELS,
} from "../lib/pcb/touch-canvas.ts";
import {
  createTouchInteractionState,
  isPublicTouchEnabled,
  mergeTouchFrameSample,
  reduceTouchInteractionState,
  touchGeometryCovers,
  touchInteractionPresentation,
  touchPagePoint,
  touchScrollPoint,
  TOUCH_FADE_MS,
  TOUCH_HOLD_MS,
} from "../lib/pcb/touch-interaction.ts";
import {
  advanceGlobalFlamePulse,
  compositeFlameAlpha,
  DESKTOP_NEUTRAL_FLAME_ALPHA,
  evaluateGlobalFlamePulse,
  globalFlamePulseAlpha,
  sampleGlobalFlamePulse,
  GLOBAL_FLAME_PULSE_CONTRACT,
} from "../lib/pcb/global-flame-pulse.ts";
import {
  activeTouchLocalFlames,
  sampleTouchLocalFlame,
  sampleTouchLocalFlameSpawnDelay,
  touchLocalFlamePhaseOpacity,
  TOUCH_LOCAL_FLAME_CONTRACT,
} from "../lib/pcb/touch-flame.ts";

test("touch global flame samples the frozen desktop pulse contract", () => {
  assert.deepEqual(GLOBAL_FLAME_PULSE_CONTRACT, {
    attackMax: 78,
    attackMin: 36,
    dipOpacityMax: 0.12,
    dipOpacityMin: 0.06,
    fadeMax: 440,
    fadeMin: 190,
    gapMax: 165,
    gapMin: 45,
    riseOpacityMax: 0.32,
    riseOpacityMin: 0.16,
    riseProbability: 0.56,
  });

  const riseValues = [0.55, 1, 1, 1, 1];
  const rise = sampleGlobalFlamePulse(100, () => riseValues.shift());
  assert.deepEqual(rise, {
    attackDuration: 78,
    fadeDuration: 440,
    gapDuration: 165,
    mode: "rise",
    peakOpacity: 0.32,
    startedAt: 100,
  });

  const dipValues = [0.56, 0, 0, 0, 0];
  const dip = sampleGlobalFlamePulse(200, () => dipValues.shift());
  assert.deepEqual(dip, {
    attackDuration: 36,
    fadeDuration: 190,
    gapDuration: 45,
    mode: "dip",
    peakOpacity: 0.06,
    startedAt: 200,
  });
});

test("touch global flame follows desktop attack, shoulder, fade, and gap phases", () => {
  const pulse = {
    attackDuration: 36,
    fadeDuration: 190,
    gapDuration: 45,
    mode: "rise",
    peakOpacity: 0.16,
    startedAt: 0,
  };
  const shoulderAt = (pulse.attackDuration + pulse.fadeDuration) * 0.58;

  assert.deepEqual(evaluateGlobalFlamePulse(pulse, 0), { mode: "rise", opacity: 0 });
  assert.equal(evaluateGlobalFlamePulse(pulse, 18).opacity, 0.08);
  assert.equal(evaluateGlobalFlamePulse(pulse, 36).opacity, 0.16);
  assert.ok(Math.abs(
    evaluateGlobalFlamePulse(pulse, shoulderAt).opacity - 0.16 * 0.48,
  ) < 1e-12);
  assert.equal(evaluateGlobalFlamePulse(pulse, 226).opacity, 0);
  assert.strictEqual(advanceGlobalFlamePulse(pulse, 270), pulse,
    "the completed pulse must remain idle through the sampled gap");

  const nextValues = [0.56, 1, 1, 1, 1];
  const next = advanceGlobalFlamePulse(pulse, 271, () => nextValues.shift());
  assert.equal(next.mode, "dip");
  assert.equal(next.startedAt, 271);
  assert.equal(next.peakOpacity, 0.12);
});

test("touch global flame uses the desktop neutral, screen, and multiply equations", () => {
  assert.equal(DESKTOP_NEUTRAL_FLAME_ALPHA, 151 / 255);
  assert.equal(
    globalFlamePulseAlpha({ mode: "rise", opacity: 0 }),
    DESKTOP_NEUTRAL_FLAME_ALPHA,
  );
  assert.equal(
    globalFlamePulseAlpha({ mode: "dip", opacity: 0.1 }),
    DESKTOP_NEUTRAL_FLAME_ALPHA * 0.9,
  );
  assert.equal(
    globalFlamePulseAlpha({ mode: "rise", opacity: 0.2 }),
    DESKTOP_NEUTRAL_FLAME_ALPHA +
      (1 - DESKTOP_NEUTRAL_FLAME_ALPHA) * 0.2,
  );
  assert.equal(compositeFlameAlpha(0.4, { mode: "rise", opacity: 0.25 }), 0.55);
  assert.ok(Math.abs(
    compositeFlameAlpha(0.4, { mode: "dip", opacity: 0.25 }) - 0.3,
  ) < 1e-12);
});

test("local flame sampling preserves the desktop contract at touch scale", () => {
  assert.equal(TOUCH_LOCAL_FLAME_CONTRACT.slotCount, 10);
  assert.equal(TOUCH_LOCAL_FLAME_CONTRACT.riseProbability, 0.6);
  assert.deepEqual([
    TOUCH_LOCAL_FLAME_CONTRACT.spawnDelayMin,
    TOUCH_LOCAL_FLAME_CONTRACT.spawnDelayMax,
  ], [72, 168]);

  const rise = sampleTouchLocalFlame(4, 100, 420, () => 0);
  assert.deepEqual({
    attackDuration: rise.attackDuration,
    fadeDuration: rise.fadeDuration,
    mode: rise.mode,
    peakOpacity: rise.peakOpacity,
    slot: rise.slot,
    startedAt: rise.startedAt,
    x: rise.x,
    y: rise.y,
  }, {
    attackDuration: 45,
    fadeDuration: 720,
    mode: "rise",
    peakOpacity: 0.8200000000000001,
    slot: 4,
    startedAt: 100,
    x: 210,
    y: 210,
  });
  assert.ok(Math.abs(rise.radius - 43.2 * 420 / 615) < 1e-12);
  assert.equal(sampleTouchLocalFlameSpawnDelay(() => 0), 72);
  assert.equal(sampleTouchLocalFlameSpawnDelay(() => 1), 168);
});

test("local flame phases and mixed slots retain desktop timing and stable order", () => {
  const base = {
    attackDuration: 50,
    fadeDuration: 1_000,
    peakOpacity: 0.8,
    radius: 40,
    startedAt: 100,
    x: 210,
    y: 210,
  };
  const rise = { ...base, mode: "rise", slot: 2 };
  const dip = { ...base, mode: "dip", slot: 7 };
  assert.equal(touchLocalFlamePhaseOpacity(rise, 100), 0);
  assert.equal(touchLocalFlamePhaseOpacity(rise, 125), 0.5);
  assert.equal(touchLocalFlamePhaseOpacity(rise, 150), 1);
  assert.equal(touchLocalFlamePhaseOpacity(rise, 450), 0.72);
  assert.equal(touchLocalFlamePhaseOpacity(rise, 850), 0.34);
  assert.equal(touchLocalFlamePhaseOpacity(rise, 1_150), 0);

  const ordered = activeTouchLocalFlames([
    null, null, rise, null, null, null, null, dip, null, null,
  ], 200);
  assert.deepEqual(ordered.map((flame) => [flame.slot, flame.mode]), [
    [2, "rise"],
    [7, "dip"],
  ]);
  const mixed = ordered.reduce(
    (alpha, flame) => compositeFlameAlpha(alpha, {
      mode: flame.mode,
      opacity: flame.peakOpacity * touchLocalFlamePhaseOpacity(flame, 200),
    }),
    DESKTOP_NEUTRAL_FLAME_ALPHA,
  );
  const riseFirst = compositeFlameAlpha(DESKTOP_NEUTRAL_FLAME_ALPHA, {
    mode: "rise", opacity: 0.8 * 0.9533333333333334,
  });
  assert.equal(mixed, compositeFlameAlpha(riseFirst, {
    mode: "dip", opacity: 0.8 * 0.9533333333333334,
  }));
});

test("touch tone selects the matching independent envelope profile", () => {
  const profiles = { blue: { id: "blue" }, pink: { id: "pink" } };
  assert.strictEqual(touchEnvelopeStops("blue", profiles), profiles.blue);
  assert.strictEqual(touchEnvelopeStops("pink", profiles), profiles.pink);
  assert.strictEqual(touchEnvelopeStops("impact", profiles), profiles.blue);
});

test("approved touch integration is enabled in public builds and excluded from tests", () => {
  assert.equal(isPublicTouchEnabled("development"), true);
  assert.equal(isPublicTouchEnabled("production"), true);
  assert.equal(isPublicTouchEnabled("test"), false);
  assert.equal(isPublicTouchEnabled(undefined), false);
});

test("integrated touch lifecycle holds for six seconds and fades opacity and size together", () => {
  let state = createTouchInteractionState();
  state = reduceTouchInteractionState(state, {
    type: "contact", at: 100, id: 7, x: 20, y: 30,
  });
  state = reduceTouchInteractionState(state, {
    type: "move", at: 150, id: 7, x: 25, y: 42,
  });
  state = reduceTouchInteractionState(state, { type: "release", at: 200, id: 7 });

  assert.equal(touchInteractionPresentation(state, 200 + TOUCH_HOLD_MS - 1).opacity, 1);
  const middle = touchInteractionPresentation(
    state,
    200 + TOUCH_HOLD_MS + TOUCH_FADE_MS / 2,
  );
  assert.equal(middle.state.phase, "fading");
  assert.equal(middle.opacity, 0.5);
  assert.equal(middle.envelopeScale, 0.5);
  assert.equal(
    touchInteractionPresentation(state, 200 + TOUCH_HOLD_MS + TOUCH_FADE_MS).mounted,
    false,
  );
});

test("cancel holds the last point and a new contact replaces the pending fade", () => {
  let state = createTouchInteractionState();
  state = reduceTouchInteractionState(state, {
    type: "contact", at: 0, id: 1, x: 10, y: 15,
  });
  state = reduceTouchInteractionState(state, { type: "cancel", at: 50, id: 1 });
  assert.deepEqual(state.point, { x: 10, y: 15 });

  state = reduceTouchInteractionState(state, {
    type: "contact", at: 80, id: 2, x: 40, y: 60,
  });
  assert.equal(state.phase, "contact");
  assert.equal(state.holdUntil, null);
  assert.equal(state.fadeUntil, null);
  assert.deepEqual(state.point, { x: 40, y: 60 });
});

test("unrelated fingers never enter or mutate the active touch lifecycle", () => {
  let state = createTouchInteractionState();
  state = reduceTouchInteractionState(state, {
    type: "contact", at: 0, id: 3, x: 5, y: 6,
  });
  const active = state;
  state = reduceTouchInteractionState(state, {
    type: "move", at: 10, id: 4, x: 50, y: 60,
  });
  state = reduceTouchInteractionState(state, { type: "release", at: 20, id: 4 });
  assert.strictEqual(state, active);
});

test("touch and scroll samples coalesce to one canonical point in either callback order", () => {
  const initial = { clientX: 100, clientY: 300, scrollX: 0, scrollY: 500 };
  const touchThenScroll = mergeTouchFrameSample(
    mergeTouchFrameSample(initial, { clientY: 340 }),
    { scrollY: 460 },
  );
  const scrollThenTouch = mergeTouchFrameSample(
    mergeTouchFrameSample(initial, { scrollY: 460 }),
    { clientY: 340 },
  );
  const first = touchPagePoint(touchThenScroll, 0, 0);
  const second = touchPagePoint(scrollThenTouch, 0, 0);
  assert.deepEqual(first, { x: 100, y: 800 });
  assert.deepEqual(second, first);

  let state = createTouchInteractionState();
  state = reduceTouchInteractionState(state, {
    type: "contact", at: 0, id: 1, x: 100, y: 800,
  });
  const unchanged = reduceTouchInteractionState(state, {
    type: "move", at: 16, id: 1, ...first,
  });
  assert.strictEqual(unchanged, state, "cancelled client/scroll deltas must schedule no paint work");
});

test("native vertical pan keeps the glow on one page location with only horizontal touch drift", () => {
  const anchor = { x: 180, y: 920 };
  const duringScroll = touchScrollPoint(anchor, 120, 124);
  assert.deepEqual(duringScroll, { x: 184, y: 920 });
  assert.deepEqual(touchScrollPoint(anchor, 120, 120), anchor);

  let state = reduceTouchInteractionState(createTouchInteractionState(), {
    type: "contact", at: 0, id: 7, ...anchor,
  });
  state = reduceTouchInteractionState(state, {
    type: "move", at: 16, id: 7, ...duringScroll,
  });
  assert.equal(state.phase, "contact");
  assert.deepEqual(state.point, duringScroll);
  state = reduceTouchInteractionState(state, { type: "release", at: 32, id: 7 });
  assert.equal(state.phase, "hold");
});

test("the bounded Canvas surface and PCB geometry share page-local scroll coordinates", () => {
  const origin = touchCanvasSurfaceOrigin(12, 840, 4, 120);
  assert.deepEqual(origin, { x: 8, y: 720 });

  const geometryPagePoint = { x: 180, y: 1030 };
  assert.deepEqual({
    x: geometryPagePoint.x - origin.x,
    y: geometryPagePoint.y - origin.y,
  }, { x: 172, y: 310 });
});

test("hold and fade may reanchor to scroll while keeping the final client point fixed", () => {
  let state = createTouchInteractionState();
  state = reduceTouchInteractionState(state, {
    type: "contact", at: 0, id: 1, x: 100, y: 300,
  });
  state = reduceTouchInteractionState(state, { type: "release", at: 10, id: 1 });
  state = reduceTouchInteractionState(state, {
    type: "reposition", at: 500, x: 100, y: 460,
  });
  assert.equal(state.phase, "hold");
  assert.deepEqual(state.point, { x: 100, y: 460 });
  assert.equal(touchInteractionPresentation(state, 6_009).opacity, 1);
});

test("geometry responses are accepted by current coverage and layout, not interaction revision", () => {
  const geometry = {
    layoutVersion: 3,
    region: { x: 100, y: 200, width: 900, height: 900 },
  };
  assert.equal(touchGeometryCovers(geometry, {
    layoutVersion: 3,
    region: { x: 250, y: 350, width: 615, height: 615 },
  }), true);
  assert.equal(touchGeometryCovers(geometry, {
    layoutVersion: 4,
    region: { x: 250, y: 350, width: 615, height: 615 },
  }), false, "a response from a replaced layout must be rejected");
  assert.equal(touchGeometryCovers(geometry, {
    layoutVersion: 3,
    region: { x: 500, y: 650, width: 615, height: 615 },
  }), false, "a delayed response that no longer covers the lens must be rejected");
});

test("tone is selected for every rendered interval rather than sampled at the lens center", () => {
  assert.deepEqual(touchToneIntervals(0, 300, [{ top: 100, bottom: 220 }], []), [
    { top: 0, bottom: 100, tone: "blue" },
    { top: 100, bottom: 220, tone: "pink" },
    { top: 220, bottom: 300, tone: "blue" },
  ]);
  assert.deepEqual(
    touchToneIntervals(80, 240, [{ top: 100, bottom: 220 }], [{ top: 170, bottom: 190 }]),
    [
      { top: 80, bottom: 100, tone: "blue" },
      { top: 100, bottom: 170, tone: "pink" },
      { top: 170, bottom: 190, tone: "blue" },
      { top: 190, bottom: 220, tone: "pink" },
      { top: 220, bottom: 240, tone: "blue" },
    ],
    "impact pixels must remain blue even inside a muted ancestor",
  );
  assert.deepEqual(
    touchToneIntervals(80, 240, [{ top: 100, bottom: 220 }], [{ top: 170, bottom: 190 }], [{ top: 170, bottom: 190 }]),
    [
      { top: 80, bottom: 100, tone: "blue" },
      { top: 100, bottom: 170, tone: "pink" },
      { top: 170, bottom: 190, tone: "impact" },
      { top: 190, bottom: 220, tone: "pink" },
      { top: 220, bottom: 240, tone: "blue" },
    ],
  );
});

test("tablet short tone band does not decorate off-lens colors", () => {
  const muted = [{ top: 4843, bottom: 5906 }, { top: 6520, bottom: 7597 }];
  assert.deepEqual(touchRequiredTones(6200, 420, muted, []), ["blue"]);
  assert.deepEqual(touchRequiredTones(6050, 420, muted, []), ["pink", "blue"]);
  assert.deepEqual(touchRequiredTones(6450, 420, muted, []), ["blue", "pink"]);
  assert.deepEqual(touchRequiredTones(9000, 420,
    [{ top: 7000, bottom: 8601 }, { top: 9417, bottom: 10625 }], []), ["blue"]);
});

test("regional mask resources have hard cache and pixel ceilings", () => {
  const cache = new Map();
  for (let index = 0; index < TOUCH_GEOMETRY_CACHE_LIMIT + 5; index += 1) {
    evictOldestTouchGeometry(cache);
    cache.set(String(index), index);
  }
  assert.equal(cache.size, TOUCH_GEOMETRY_CACHE_LIMIT);
  assert.deepEqual([...cache.keys()], ["5", "6", "7", "8"]);
  const ratio = boundedCanvasPixelRatio(1000, 1000, 4, TOUCH_MASK_MAX_PIXELS);
  assert.ok(ratio <= 2);
  assert.ok(1000 * 1000 * ratio * ratio <= TOUCH_MASK_MAX_PIXELS + 1);
});

test("decorated geometry retains only the current and one preparatory region", () => {
  const cache = new Map();
  const regionOrder = [];
  const released = [];
  const release = (surface) => released.push(surface.id);
  const add = (geometryKey, tone) => cacheTouchDecoratedSurface(
    cache,
    regionOrder,
    geometryKey,
    tone,
    { id: `${geometryKey}:${tone}` },
    release,
    "current",
  );

  add("current", "blue");
  add("current", "pink");
  add("next", "blue");
  assert.equal(regionOrder.length, TOUCH_DECORATED_REGION_CACHE_LIMIT);
  add("new-next", "blue");
  assert.deepEqual(regionOrder, ["current", "new-next"]);
  assert.equal(cache.has(touchDecoratedSurfaceKey("current", "blue")), true);
  assert.equal(cache.has(touchDecoratedSurfaceKey("current", "pink")), true);
  assert.equal(cache.has(touchDecoratedSurfaceKey("next", "blue")), false);
  assert.deepEqual(released, ["next:blue"]);

  clearTouchDecoratedSurfaces(cache, regionOrder, release);
  assert.equal(cache.size, 0);
  assert.deepEqual(regionOrder, []);
  assert.deepEqual(released.sort(), [
    "current:blue", "current:pink", "new-next:blue", "next:blue",
  ]);
});

test("decorated crops preserve page alignment and regional halo padding", () => {
  const layout = { renderLeft: -30, renderScale: 2 };
  const lensDiameter = 420;
  const cellSize = 96;
  const point = { x: -30 + (12 * 48 + 47.999) * 2, y: (8 * 48 + 47.999) * 2 };
  const { region, requiredRegion } = touchGeometryRegions(
    point,
    layout,
    lensDiameter,
    cellSize,
  );
  const cssMargins = {
    bottom: (region.y + region.height - requiredRegion.y - requiredRegion.height) *
      layout.renderScale,
    left: (requiredRegion.x - region.x) * layout.renderScale,
    right: (region.x + region.width - requiredRegion.x - requiredRegion.width) *
      layout.renderScale,
    top: (requiredRegion.y - region.y) * layout.renderScale,
  };
  for (const margin of Object.values(cssMargins)) {
    assert.ok(margin >= cellSize - 0.01);
    assert.ok(margin > TOUCH_DECORATED_HALO_PASSES * TOUCH_DECORATED_HALO_BLUR);
  }

  assert.deepEqual(
    touchDecoratedCrop(240, 690, 420, 144, 594, 1.5),
    { sourceX: 144, sourceY: 144, sourceSize: 630 },
  );
});

test("prepared SVG paths retain thin stroke geometry for Canvas Path2D", () => {
  assert.deepEqual(
    parseTouchCanvasPath('<path fill="none" stroke="white" stroke-width="2.1" stroke-linecap="square" d="M10 10L90 90"/>'),
    {
      data: "M10 10L90 90",
      fill: "none",
      fillRule: "nonzero",
      lineCap: "square",
      lineJoin: "miter",
      miterLimit: 4,
      stroke: "white",
      strokeWidth: 2.1,
    },
  );
});

test("integration uses one owned bounded Canvas backend without SVG trail cloning", async () => {
  const orchestrator = await readFile(
    new URL("../components/PublicCircuitBackground.tsx", import.meta.url),
    "utf8",
  );
  const touchComponent = (await readFile(
    new URL("../components/public-circuit/TouchCanvasInteraction.tsx", import.meta.url),
    "utf8",
  )).replace(/\r\n/g, "\n");
  assert.doesNotMatch(orchestrator, /async function commitFrame/);
  assert.doesNotMatch(orchestrator, /await loadTouchGeometry/);
  assert.match(touchComponent, /className = "public-circuit-touch-canvas"/);
  assert.match(touchComponent, /public-circuit-touch-canvas\{position:absolute/,
    "the surface must compositor-scroll with the page between iOS callbacks");
  assert.doesNotMatch(touchComponent, /public-circuit-touch-canvas\{[^}]*mix-blend-mode/,
    "the complete Canvas must use the desktop lens's normal page compositing");
  assert.doesNotMatch(touchComponent, /public-circuit-touch-canvas\{position:fixed/,
    "a fixed surface drifts from compositor-scrolled PCB geometry on iOS");
  assert.match(touchComponent, /touchCanvasSurfaceOrigin\(/);
  assert.match(touchComponent, /new Path2D\(definition\.data\)/);
  assert.match(touchComponent, /touchToneIntervals\(/);
  assert.match(touchComponent, /const TOUCH_LENS_DIAMETER = 420/,
    "phone touch radius must remain smaller than the 615px desktop lens");
  assert.match(touchComponent, /const TOUCH_ENVELOPE_RADIUS = 168/);
  assert.match(touchComponent, /function createDecoratedSurface/);
  assert.equal(TOUCH_DECORATED_HALO_PASSES, 3);
  assert.match(touchComponent, /pass < TOUCH_DECORATED_HALO_PASSES/,
    "touch must reproduce the desktop triple drop-shadow profile");
  assert.match(touchComponent, /halo: "rgb\(223 58 148 \/ 0\.95\)"/);
  assert.match(touchComponent, /halo: "rgb\(0 124 255 \/ 0\.95\)"/,
    "the Canvas shadow color must retain the desktop 0.95 alpha");
  assert.equal(TOUCH_DECORATED_HALO_BLUR, 8.5);
  assert.match(touchComponent, /shadowBlur = TOUCH_DECORATED_HALO_BLUR \* pixelRatio/,
    "Canvas shadowBlur must be twice the desktop CSS Gaussian sigma");
  assert.doesNotMatch(touchComponent, /TOUCH_HALO_BAND_OFFSETS/,
    "touch must not add a hard halo band that differs from desktop");
  assert.match(touchComponent, /bitmap: HTMLCanvasElement|trails\.push\(\{ bitmap,/);
  assert.match(touchComponent, /createTouchPreparation\(/);
  const maskAllocator = touchComponent.slice(
    touchComponent.indexOf("function ensureMaskCanvases"),
    touchComponent.indexOf("function paintFlameMask"),
  );
  assert.match(maskAllocator, /LENS_DIAMETER \* viewportPixelRatio/);
  assert.doesNotMatch(touchComponent, /workCanvas\.width\s*=.*size|workCanvas\.height\s*=.*size/,
    "live paint must not resize a full lens work canvas every frame");
  assert.match(touchComponent, /trails\[index\]\.bitmap/,
    "trail geometry must be rasterized once and only composited while fading");
  assert.doesNotMatch(touchComponent, /createElementNS|cloneNode|createTouchPaintSvg|mountTouchGeometry/);
  assert.doesNotMatch(touchComponent, /\.animate\(/);
  assert.doesNotMatch(touchComponent, /<filter|feGaussianBlur/);
  assert.match(touchComponent, /length: TOUCH_LOCAL_FLAME_CONTRACT\.slotCount/,
    "touch must retain ten stable local flame slots");
  assert.match(touchComponent, /flameContext\.globalCompositeOperation = flame\.mode === "rise"\s*\? "source-over" : "destination-out"/s,
    "ordered local rises and dips must use screen-equivalent and multiply-equivalent alpha operations");
  assert.doesNotMatch(touchComponent, /Math\.sin\(at/,
    "the global pulse must not regress to final-opacity sinusoidal modulation");
  assert.match(touchComponent, /main\.style\.opacity = String\(presentation\.opacity\)/,
    "the lifecycle fade must stay separate from the envelope pulse");
  assert.match(touchComponent, /pink: PINK_ENVELOPE_STOPS/,
    "pink sections must not reuse the blue envelope profile");
  const samplePainter = touchComponent.slice(
    touchComponent.indexOf("function paintSample"),
    touchComponent.indexOf("function updateFlames"),
  );
  assert.ok(
    samplePainter.indexOf("touchDecoratedCrop") <
      samplePainter.indexOf("context.drawImage(") &&
    samplePainter.indexOf("context.drawImage(") <
      samplePainter.indexOf('context.globalCompositeOperation = "destination-in"') &&
    samplePainter.indexOf('context.globalCompositeOperation = "destination-in"') <
      samplePainter.indexOf("context.drawImage(\n          flameCanvas") &&
    samplePainter.indexOf("context.drawImage(\n          flameCanvas") <
      samplePainter.indexOf("context.drawImage(\n          envelope"),
    "each prepared tone strip must be clipped and masked with flame then envelope",
  );
  assert.equal(samplePainter.match(/context\.drawImage\(/g)?.length, 3,
    "each tone strip must draw one prepared surface and two masks");
  assert.doesNotMatch(samplePainter, /TOUCH_DECORATED_HALO_BLUR|shadowColor = colors\.halo/,
    "live lens and trail paint must never reconstruct the halo");
  assert.doesNotMatch(samplePainter, /shadowBlur/,
    "live lens and trail paint must perform no shadow blur work");
  assert.match(touchComponent, /for \(const tone of request\.tones\)/,
    "decorated resources must follow the palettes required by the visible lens");
  assert.match(touchComponent, /preparation\.dispose\(\)/,
    "layout and disposal must release decorated backing stores");
  assert.doesNotMatch(touchComponent, /globalFlamePulseBaseOpacity|globalCompositeOperation = "lighter"/,
    "flame must remain independent instead of being added into the tone envelope");
});

test("static, desktop SVG, and touch Canvas retain independent ownership", async () => {
  const [orchestrator, staticComponent, desktopComponent, touchComponent, shared, globalCss] =
    await Promise.all([
      readFile(new URL("../components/PublicCircuitBackground.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/public-circuit/StaticCircuitVector.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/public-circuit/DesktopCircuitInteraction.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/public-circuit/TouchCanvasInteraction.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/public-circuit/shared.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    ]);

  assert.match(orchestrator, /<StaticCircuitVector/);
  assert.match(orchestrator, /<DesktopCircuitInteraction/);
  assert.match(orchestrator, /<TouchCanvasInteraction/);
  assert.doesNotMatch(orchestrator, /function (?:renderLayout|commitFrame)/);
  assert.match(staticComponent, /export function StaticCircuitVector/);
  assert.doesNotMatch(staticComponent, /TouchCanvas|DesktopCircuitInteraction/);
  assert.match(desktopComponent, /export function DesktopCircuitInteraction/);
  assert.doesNotMatch(desktopComponent, /TouchCanvas/);
  assert.match(touchComponent, /export function TouchCanvasInteraction/);
  assert.match(globalCss, /\.public-circuit-page\s*\{[^}]*touch-action:\s*pan-y pinch-zoom/s,
    "initial CSS must reserve horizontal drag while retaining pinch zoom");
  assert.doesNotMatch(touchComponent, /touch-action:/,
    "injecting touch-action after contact cannot change the active gesture");
  assert.match(touchComponent, /handlePointerTouch/,
    "touch glow must use pointer events for direct gesture delivery");
  assert.match(touchComponent, /setPointerCapture/,
    "active touch pointer must remain captured during horizontal drag");
  assert.doesNotMatch(touchComponent, /<svg/);
  assert.equal(
    [staticComponent, desktopComponent, touchComponent, shared]
      .filter((source) => /function loadLensGeometry/.test(source)).length,
    1,
  );
});

const chrome = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((candidate) => candidate && existsSync(candidate));

test("browser pixels include a colored halo outside the geometry mask", {
  skip: process.env.PCB_TOUCH_BROWSER_PIXELS !== "1"
    ? "run through verify:pcb-touch-halo"
    : chrome ? false : "Chromium is not installed",
}, async () => {
  const { default: sharp } = await import("sharp");
  const size = 120;
  const html = `<!doctype html><style>html,body{margin:0;width:${size}px;height:${size}px;overflow:hidden;background:#000}canvas{display:block}</style><canvas width="${size}" height="${size}"></canvas><script>
    const context=document.querySelector('canvas').getContext('2d');
    const trace=new Path2D('M60 10V110');
    context.lineWidth=2.1;context.lineCap='square';context.strokeStyle='#007cff';context.shadowColor='#007cff';context.shadowBlur=12;context.globalAlpha=.78;context.stroke(trace);
    context.shadowBlur=4.5;context.globalAlpha=.98;context.stroke(trace);
    context.shadowColor='transparent';context.shadowBlur=0;context.globalAlpha=1;context.strokeStyle='#edf9ff';context.stroke(trace);
  </script>`;
  const directory = await mkdtemp(path.join(tmpdir(), "pcb-touch-halo-"));
  const fixturePath = path.join(directory, "fixture.html");
  const screenshotPath = path.join(directory, "fixture.png");
  try {
    await writeFile(fixturePath, html, "utf8");
    const result = spawnSync(chrome, [
      "--headless=new",
      "--disable-background-networking",
      "--disable-extensions",
      "--disable-gpu",
      "--enable-unsafe-swiftshader",
      "--use-angle=swiftshader",
      "--do-not-de-elevate",
      "--hide-scrollbars",
      "--no-default-browser-check",
      "--no-first-run",
      `--user-data-dir=${path.join(directory, "profile")}`,
      `--window-size=${size},${size}`,
      "--run-all-compositor-stages-before-draw",
      "--virtual-time-budget=2000",
      `--screenshot=${screenshotPath}`,
      pathToFileURL(fixturePath).href,
    ], { encoding: "utf8", timeout: 15_000 });
    assert.equal(result.status, 0, result.stderr);
    const { data, info } = await sharp(screenshotPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const sample = (x, y) => Array.from(data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3));
    const outside = sample(54, 60);
    const core = sample(60, 60);
    assert.ok(outside[2] >= 8, `expected exterior halo brightness, received ${outside}`);
    assert.ok(outside[2] >= outside[0] + 20, `expected saturated blue exterior, received ${outside}`);
    assert.ok(core[0] >= 220 && core[1] >= 220 && core[2] >= 220,
      `expected near-white core, received ${core}`);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
