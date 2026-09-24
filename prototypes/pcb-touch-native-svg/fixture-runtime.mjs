import {
  createTouchState,
  reduceTouchState,
  touchPresentation,
} from "./model.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";
const LENS_DIAMETER = 615;
const LENS_RADIUS = LENS_DIAMETER / 2;
const TRAIL_DIAMETER = 260;
const TRAIL_RADIUS = TRAIL_DIAMETER / 2;
const MAX_TRAILS = 8;
const TRAIL_MIN_DISTANCE = 14;
const TRAIL_MIN_INTERVAL = 36;

const fixture = window.__PCB_TOUCH_FIXTURE__;
if (!fixture) throw new Error("Missing PCB touch fixture configuration");

const reducedMotion = fixture.forceReducedMotion ??
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const page = document.querySelector("[data-pcb-page]");
const metrics = {
  cacheHits: 0,
  cacheMisses: 0,
  cleanup: null,
  coldWarmContacts: [],
  eventToCommitMs: [],
  frameGapsMs: [],
  handlerMs: [],
  layoutReads: 0,
  layoutReadsAfterSvgWrite: 0,
  longTasks: [],
  maxPendingFrames: 0,
  maxConcurrentCommits: 0,
  modelMs: [],
  pathCounts: [],
  passiveCaptureListeners: [],
  pointerEventsObserved: 0,
  source: "synthetic renderer-neutral replay and CDP-dispatched Touch Events; not physical-touch proof",
  svgWrites: 0,
  trailEmitted: 0,
  trailPeak: 0,
  writeMs: [],
};

let phase = "idle";
function layoutRead(read) {
  metrics.layoutReads += 1;
  if (phase === "write") metrics.layoutReadsAfterSvgWrite += 1;
  return read();
}

const pageWidth = layoutRead(() => page.clientWidth);
const renderScale = pageWidth / fixture.sourceWidth;
page.style.height = `${fixture.sourceHeight * renderScale}px`;

let state = createTouchState({ reducedMotion });
let disposed = false;
let frameHandle = null;
let framePending = 0;
let commitInFlight = false;
let rerunAfterCommit = false;
let lastFrameAt = null;
let pendingModelAt = 0;
let pendingContact = null;
let lastClientPoint = null;
let currentGeometry = null;
let currentCommittedPoint = null;
let currentCommitAt = Number.NEGATIVE_INFINITY;
let lastTrailAt = Number.NEGATIVE_INFINITY;
let flameTimer = null;
let flameAnimations = [];
const geometryCache = new Map();
const inflightGeometry = new Map();
const trails = [];
const removers = [];

const longTaskObserver = typeof PerformanceObserver === "function" &&
  PerformanceObserver.supportedEntryTypes?.includes("longtask")
  ? new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        metrics.longTasks.push({ duration: entry.duration, startTime: entry.startTime });
      }
    })
  : null;
longTaskObserver?.observe({ entryTypes: ["longtask"] });

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function createPaintSvg(size, prefix, geometryMarkup, geometryTransform, trail = false) {
  const svg = svgElement("svg", {
    "aria-hidden": "true",
    class: trail ? "pcb-touch-trail-paint" : "pcb-touch-live-paint",
    viewBox: `0 0 ${size} ${size}`,
  });
  const envelopeRadius = trail ? TRAIL_RADIUS : 247.5;
  const envelopePaint = !trail && fixture.envelopeContours
    ? fixture.envelopeContours.map((contour) =>
        `<path d="${contour.path}" fill="rgb(${contour.luminance} ${contour.luminance} ${contour.luminance})"/>`,
      ).join("")
    : `<rect width="${size}" height="${size}" fill="url(#${prefix}-envelope)"/>`;
  svg.innerHTML = `
    <defs>
      <radialGradient id="${prefix}-envelope" gradientUnits="userSpaceOnUse" cx="${size / 2}" cy="${size / 2}" r="${envelopeRadius}">
        <stop offset="0" stop-color="white" stop-opacity=".96"/>
        <stop offset=".3" stop-color="white" stop-opacity=".82"/>
        <stop offset=".5" stop-color="white" stop-opacity=".62"/>
        <stop offset=".68" stop-color="white" stop-opacity=".38"/>
        <stop offset=".8" stop-color="white" stop-opacity=".2"/>
        <stop offset=".9" stop-color="white" stop-opacity=".08"/>
        <stop offset=".96" stop-color="white" stop-opacity=".01"/>
        <stop offset="1" stop-color="white" stop-opacity="0"/>
      </radialGradient>
      <mask id="${prefix}-envelope-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${size}" height="${size}" style="mask-type:luminance">
        <g data-envelope-field style="transform-origin:${size / 2}px ${size / 2}px">
          ${envelopePaint}
        </g>
      </mask>
      <mask id="${prefix}-geometry-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${size}" height="${size}" style="mask-type:luminance">
        <g data-geometry-transform transform="${geometryTransform}">${geometryMarkup}</g>
      </mask>
      ${trail ? "" : `<radialGradient id="${prefix}-lobe"><stop offset="0" stop-color="white" stop-opacity=".9"/><stop offset=".52" stop-color="white" stop-opacity=".3"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient>
      <mask id="${prefix}-flame-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${size}" height="${size}" style="mask-type:luminance">
        <rect width="${size}" height="${size}" fill="#979797"/>
        <rect data-global-flicker width="${size}" height="${size}" fill="white" opacity="0" style="mix-blend-mode:screen"/>
        ${Array.from({ length: 10 }, (_, index) => `<circle data-flame-lobe="${index}" cx="${size / 2}" cy="${size / 2}" r="1" fill="url(#${prefix}-lobe)" opacity="0"/>`).join("")}
      </mask>`}
    </defs>
    <g mask="url(#${prefix}-envelope-mask)">
      <g${trail ? "" : ` mask="url(#${prefix}-flame-mask)"`}>
        <g data-halo-band mask="url(#${prefix}-geometry-mask)"><rect width="${size}" height="${size}"/></g>
        <g data-core mask="url(#${prefix}-geometry-mask)"><rect width="${size}" height="${size}"/></g>
      </g>
    </g>`;
  return svg;
}

let shell = null;
let liveSvg = null;
let liveGeometryGroup = null;
let liveEnvelopeField = null;
if (!reducedMotion) {
  shell = document.createElement("div");
  shell.className = "pcb-touch-live";
  shell.hidden = true;
  liveSvg = createPaintSvg(LENS_DIAMETER, "pcb-touch-live", "", "");
  liveGeometryGroup = liveSvg.querySelector("[data-geometry-transform]");
  liveEnvelopeField = liveSvg.querySelector("[data-envelope-field]");
  shell.append(liveSvg);
  page.append(shell);
}

function geometryRequest(point) {
  const cellCss = 96;
  const cellSource = cellCss / renderScale;
  const centerX = point.x / renderScale;
  const centerY = point.y / renderScale;
  const bucketX = Math.floor(centerX / cellSource) * cellSource;
  const bucketY = Math.floor(centerY / cellSource) * cellSource;
  const lensSource = LENS_DIAMETER / renderScale;
  const region = {
    x: bucketX - lensSource / 2,
    y: bucketY - lensSource / 2,
    width: lensSource + cellSource,
    height: lensSource + cellSource,
  };
  const key = [bucketX, bucketY, renderScale].map((value) => value.toFixed(4)).join(":");
  return { key, region };
}

async function loadGeometry(point) {
  const request = geometryRequest(point);
  if (geometryCache.has(request.key)) {
    metrics.cacheHits += 1;
    return { ...geometryCache.get(request.key), cache: "warm" };
  }
  if (inflightGeometry.has(request.key)) return inflightGeometry.get(request.key);
  metrics.cacheMisses += 1;
  const parameters = new URLSearchParams(Object.fromEntries(
    Object.entries(request.region).map(([key, value]) => [key, String(value)]),
  ));
  const promise = fetch(`/geometry?${parameters}`).then(async (response) => {
    if (!response.ok) throw new Error(`Geometry request failed: ${response.status}`);
    const result = await response.json();
    const geometry = {
      cache: "cold",
      key: request.key,
      markup: result.paths.map((path) => path.source).join(""),
      pathCount: result.paths.length,
      sourceIndexes: result.paths.map((path) => path.sourceIndex),
    };
    geometryCache.set(request.key, geometry);
    return geometry;
  }).finally(() => inflightGeometry.delete(request.key));
  inflightGeometry.set(request.key, promise);
  return promise;
}

function setTone(element, y) {
  element.dataset.tone = Math.floor(y / 520) % 2 ? "pink" : "blue";
}

function createTrail(point, geometry, at) {
  if (!currentCommittedPoint) return;
  const distance = Math.hypot(point.x - currentCommittedPoint.x, point.y - currentCommittedPoint.y);
  if (distance < TRAIL_MIN_DISTANCE || at - lastTrailAt < TRAIL_MIN_INTERVAL) return;
  const trailPoint = currentCommittedPoint;
  const snapshot = currentGeometry;
  if (!snapshot) return;
  const id = metrics.trailEmitted;
  const trail = document.createElement("div");
  trail.className = "pcb-touch-trail";
  trail.style.left = `${trailPoint.x - TRAIL_RADIUS}px`;
  trail.style.top = `${trailPoint.y - TRAIL_RADIUS}px`;
  setTone(trail, trailPoint.y);
  const transform = `translate(${-(trailPoint.x - TRAIL_RADIUS)} ${-(trailPoint.y - TRAIL_RADIUS)}) scale(${renderScale})`;
  const svg = createPaintSvg(TRAIL_DIAMETER, `pcb-touch-trail-${id}`, snapshot.markup, transform, true);
  const trailGeometry = svg.querySelector("[data-geometry-transform]");
  trail.append(svg);
  page.append(trail);
  const record = {
    element: trail,
    // `innerHTML` parses trusted source markup into DOM and serializes it in the
    // browser's canonical form (for example, self-closing SVG paths gain closing
    // tags). Capture that exact representation once, then compare it with the
    // same trail DOM later. Hashing raw response text against serialized DOM
    // would report a mutation where only representation changed.
    geometryHash: hashText(trailGeometry.innerHTML),
    geometryKey: snapshot.key,
    pathCount: snapshot.pathCount,
    sourceMarkupHash: hashText(snapshot.markup),
    sourceIndexes: snapshot.sourceIndexes,
  };
  trails.push(record);
  metrics.trailEmitted += 1;
  metrics.trailPeak = Math.max(metrics.trailPeak, trails.length);
  lastTrailAt = at;
  trail.animate(
    [{ opacity: .48, transform: "scale(.92)" }, { opacity: .22, transform: "scale(.98)", offset: .38 }, { opacity: 0, transform: "scale(1.04)" }],
    { duration: 560, easing: "ease-out", fill: "forwards" },
  );
  while (trails.length > MAX_TRAILS) trails.shift().element.remove();
}

function stopFlame() {
  if (flameTimer !== null) clearTimeout(flameTimer);
  flameTimer = null;
  for (const animation of flameAnimations) animation.cancel();
  flameAnimations = [];
  liveSvg?.querySelectorAll("[data-global-flicker],[data-flame-lobe]").forEach((element) => {
    element.style.opacity = "0";
  });
}

let randomState = 0x72f36a91;
function random() {
  randomState ^= randomState << 13;
  randomState ^= randomState >>> 17;
  randomState ^= randomState << 5;
  return (randomState >>> 0) / 0x1_0000_0000;
}

function pulseFlame() {
  if (disposed || state.phase === "idle" || !liveSvg) return;
  const isGlobal = random() < .28;
  const element = isGlobal
    ? liveSvg.querySelector("[data-global-flicker]")
    : liveSvg.querySelector(`[data-flame-lobe="${Math.floor(random() * 10)}"]`);
  if (!element) return;
  const isRise = random() < .56;
  const attack = isGlobal ? 36 + random() * 42 : 45 + random() * 45;
  const fade = isGlobal ? 190 + random() * 250 : 720 + random() * 480;
  if (!isGlobal) {
    const distance = Math.sqrt(random()) * 202;
    const angle = random() * Math.PI * 2;
    element.setAttribute("cx", String(LENS_RADIUS + Math.cos(angle) * distance));
    element.setAttribute("cy", String(LENS_RADIUS + Math.sin(angle) * distance));
    element.setAttribute("r", String(43.2 + random() * 75.6));
  } else {
    element.setAttribute("fill", isRise ? "white" : "black");
    element.style.mixBlendMode = isRise ? "screen" : "multiply";
  }
  const peak = isGlobal ? (isRise ? .16 + random() * .16 : .06 + random() * .06) : 1;
  const animation = element.animate(
    [{ opacity: 0 }, { opacity: peak, offset: attack / (attack + fade) }, { opacity: 0 }],
    { duration: attack + fade, easing: "linear" },
  );
  flameAnimations.push(animation);
  animation.onfinish = () => {
    flameAnimations = flameAnimations.filter((candidate) => candidate !== animation);
    element.style.opacity = "0";
  };
  flameTimer = setTimeout(pulseFlame, 45 + random() * 120);
}

function ensureFlame() {
  if (flameTimer === null && state.phase !== "idle") pulseFlame();
}

function writePresentation(presentation, geometry, modelAt, observedAt) {
  const start = performance.now();
  phase = "write";
  metrics.svgWrites += 1;
  try {
    state = presentation.state;
    if (!presentation.mounted || !state.point || !shell) {
      if (shell) shell.hidden = true;
      stopFlame();
      currentCommittedPoint = null;
      currentGeometry = null;
      return;
    }

    if (geometry) createTrail(state.point, geometry, modelAt);
    shell.hidden = false;
    shell.style.left = `${state.point.x - LENS_RADIUS}px`;
    shell.style.top = `${state.point.y - LENS_RADIUS}px`;
    shell.style.opacity = String(presentation.opacity);
    setTone(shell, state.point.y);
    liveEnvelopeField.style.transform = `scale(${presentation.envelopeScale})`;

    if (geometry && currentGeometry?.key !== geometry.key) {
      liveGeometryGroup.innerHTML = geometry.markup;
    }
    if (geometry) {
      const transform = `translate(${-(state.point.x - LENS_RADIUS)} ${-(state.point.y - LENS_RADIUS)}) scale(${renderScale})`;
      liveGeometryGroup.setAttribute("transform", transform);
      currentGeometry = geometry;
      currentCommittedPoint = { ...state.point };
      currentCommitAt = modelAt;
      metrics.pathCounts.push(geometry.pathCount);
      if (pendingContact) {
        const latency = performance.now() - pendingContact.observedAt;
        metrics.eventToCommitMs.push(latency);
        metrics.coldWarmContacts.push({
          cache: geometry.cache,
          eventToCommitMs: latency,
          modelAt: pendingContact.modelAt,
          pathCount: geometry.pathCount,
        });
        pendingContact = null;
      }
    }
    ensureFlame();
  } finally {
    phase = "idle";
    metrics.writeMs.push(performance.now() - start);
  }
}

async function commitFrame(modelAt, observedAt) {
  const presentation = touchPresentation(state, modelAt);
  const expectedRevision = presentation.state.revision;
  state = presentation.state;
  let geometry = currentGeometry;
  if (presentation.mounted && state.point) {
    const desired = geometryRequest(state.point).key;
    if (geometry?.key !== desired) {
      geometry = await loadGeometry(state.point);
      if (disposed || state.point === null) return;
      if (state.revision !== expectedRevision || geometryRequest(state.point).key !== geometry.key) {
        rerunAfterCommit = true;
        return;
      }
    } else {
      metrics.cacheHits += 1;
      geometry = { ...geometry, cache: "warm" };
    }
  }
  writePresentation(presentation, geometry, modelAt, observedAt);
}

function scheduleFrame(modelAt = performance.now(), observedAt = performance.now()) {
  pendingModelAt = Math.max(pendingModelAt, modelAt);
  if (frameHandle !== null) return;
  framePending += 1;
  metrics.maxPendingFrames = Math.max(metrics.maxPendingFrames, framePending);
  frameHandle = requestAnimationFrame((frameAt) => {
    frameHandle = null;
    framePending -= 1;
    if (lastFrameAt !== null) metrics.frameGapsMs.push(frameAt - lastFrameAt);
    lastFrameAt = frameAt;
    if (commitInFlight) {
      rerunAfterCommit = true;
      return;
    }
    commitInFlight = true;
    metrics.maxConcurrentCommits = Math.max(metrics.maxConcurrentCommits, 1);
    void commitFrame(pendingModelAt, observedAt).finally(() => {
      commitInFlight = false;
      if (rerunAfterCommit) {
        rerunAfterCommit = false;
        scheduleFrame(pendingModelAt, performance.now());
      }
    });
  });
}

function dispatch(action, observedAt = performance.now()) {
  if (disposed) throw new Error("Prototype was cleaned up");
  const started = performance.now();
  const before = state;
  const modelStarted = performance.now();
  state = reduceTouchState(state, action);
  metrics.modelMs.push(performance.now() - modelStarted);
  if (action.type === "contact" && state !== before && state.phase === "contact") {
    pendingContact = { modelAt: action.at, observedAt };
  }
  if (state !== before || action.type === "tick") scheduleFrame(action.at, observedAt);
  metrics.handlerMs.push(performance.now() - started);
  return state;
}

function addTouchListener(type, handler) {
  const options = { capture: true, passive: true };
  window.addEventListener(type, handler, options);
  metrics.passiveCaptureListeners.push(type);
  removers.push(() => window.removeEventListener(type, handler, options));
}

function changedTouch(event, id = state.activeTouchId) {
  return Array.from(event.changedTouches).find((touch) => id === null || touch.identifier === id);
}

function eventAction(event, type) {
  const started = performance.now();
  const touch = changedTouch(event);
  if (!touch) return;
  if (type === "contact" && state.activeTouchId !== null) return;
  if (type === "contact" || type === "move") {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    lastClientPoint = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
    dispatch({ type, at: started, id: touch.identifier, x: touch.clientX + scrollX, y: touch.clientY + scrollY }, started);
  } else {
    dispatch({ type, at: started, id: touch.identifier }, started);
    lastClientPoint = null;
  }
  metrics.handlerMs.push(performance.now() - started);
}

if (!reducedMotion) {
  addTouchListener("touchstart", (event) => eventAction(event, "contact"));
  addTouchListener("touchmove", (event) => eventAction(event, "move"));
  addTouchListener("touchend", (event) => eventAction(event, "release"));
  addTouchListener("touchcancel", (event) => eventAction(event, "cancel"));
  const handleScroll = () => {
    const started = performance.now();
    if (state.phase === "contact" && lastClientPoint) {
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      dispatch({
        type: "move",
        at: started,
        id: lastClientPoint.id,
        x: lastClientPoint.x + scrollX,
        y: lastClientPoint.y + scrollY,
        source: "scroll",
      }, started);
    }
    metrics.handlerMs.push(performance.now() - started);
  };
  window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
  metrics.passiveCaptureListeners.push("scroll");
  removers.push(() => window.removeEventListener("scroll", handleScroll, { capture: true }));
}

function waitForSettled() {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const check = () => {
      if (disposed || (frameHandle === null && !commitInFlight && inflightGeometry.size === 0)) return resolve();
      if (performance.now() - started > 10_000) return reject(new Error("Prototype settlement timed out"));
      setTimeout(check, 5);
    };
    check();
  });
}

window.pcbTouchPrototype = {
  async advance(at) {
    dispatch({ type: "tick", at });
    await waitForSettled();
    return this.snapshot();
  },
  async cleanup() {
    if (disposed) return metrics.cleanup;
    disposed = true;
    if (frameHandle !== null) cancelAnimationFrame(frameHandle);
    frameHandle = null;
    framePending = 0;
    removers.splice(0).forEach((remove) => remove());
    stopFlame();
    longTaskObserver?.disconnect();
    shell?.remove();
    trails.splice(0).forEach((trail) => trail.element.remove());
    metrics.cleanup = {
      activeAnimations: document.getAnimations().filter((animation) => animation.playState === "running").length,
      commitInFlight,
      flameAnimations: flameAnimations.length,
      flameTimer: flameTimer !== null,
      listeners: removers.length,
      pendingFrame: frameHandle !== null,
      trails: trails.length,
    };
    return metrics.cleanup;
  },
  async replay(action) {
    dispatch(action, performance.now());
    await waitForSettled();
    return this.snapshot();
  },
  snapshot() {
    return {
      currentCommitAt,
      metrics: structuredClone(metrics),
      reducedMotion,
      state: structuredClone(state),
      trails: trails.map((trail) => ({
        geometryHash: trail.geometryHash,
        geometryKey: trail.geometryKey,
        liveHash: hashText(trail.element.querySelector("[data-geometry-transform]").innerHTML),
        pathCount: trail.pathCount,
        sourceMarkupHash: trail.sourceMarkupHash,
        sourceIndexes: trail.sourceIndexes,
      })),
      visual: shell ? {
        flameLobes: liveSvg.querySelectorAll("[data-flame-lobe]").length,
        globalFlicker: liveSvg.querySelectorAll("[data-global-flicker]").length,
        haloBands: liveSvg.querySelectorAll("[data-halo-band]").length,
        jitterPaths: liveSvg.querySelectorAll("[data-envelope-contour],[data-edge-wave]").length,
        lensDiameter: LENS_DIAMETER,
      } : null,
    };
  },
};

window.__PCB_TOUCH_READY__ = true;
