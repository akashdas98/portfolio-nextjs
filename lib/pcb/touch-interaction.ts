export const TOUCH_HOLD_MS = 6_000;
export const TOUCH_FADE_MS = 700;

export function isPublicTouchEnabled(environment: string | undefined) {
  return environment === "development" || environment === "production";
}

export type TouchInteractionState = {
  activeTouchId: number | null;
  fadeUntil: number | null;
  holdUntil: number | null;
  phase: "idle" | "contact" | "hold" | "fading";
  point: { x: number; y: number } | null;
  revision: number;
};

export type TouchInteractionAction =
  | { type: "contact" | "move"; at: number; id: number; x: number; y: number }
  | { type: "reposition"; at: number; x: number; y: number }
  | { type: "release" | "cancel"; at: number; id: number }
  | { type: "tick"; at: number };

export type TouchFrameSample = {
  clientX: number;
  clientY: number;
  scrollX: number;
  scrollY: number;
};

export type TouchFrameSamplePatch = Partial<TouchFrameSample>;

export type TouchGeometryCoverage = {
  layoutVersion: number;
  region: { x: number; y: number; width: number; height: number };
};

function finite(value: number, name: string) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

export function createTouchInteractionState(): TouchInteractionState {
  return {
    activeTouchId: null,
    fadeUntil: null,
    holdUntil: null,
    phase: "idle",
    point: null,
    revision: 0,
  };
}

export function mergeTouchFrameSample(
  sample: TouchFrameSample,
  patch: TouchFrameSamplePatch,
): TouchFrameSample {
  return { ...sample, ...patch };
}

export function touchPagePoint(
  sample: TouchFrameSample,
  pageDocumentLeft: number,
  pageDocumentTop: number,
) {
  return {
    x: finite(sample.clientX, "sample.clientX") +
      finite(sample.scrollX, "sample.scrollX") -
      finite(pageDocumentLeft, "pageDocumentLeft"),
    y: finite(sample.clientY, "sample.clientY") +
      finite(sample.scrollY, "sample.scrollY") -
      finite(pageDocumentTop, "pageDocumentTop"),
  };
}

export function touchScrollPoint(
  anchor: { x: number; y: number },
  startClientX: number,
  clientX: number,
) {
  return {
    x: finite(anchor.x, "anchor.x") +
      finite(clientX, "clientX") - finite(startClientX, "startClientX"),
    y: finite(anchor.y, "anchor.y"),
  };
}

export function touchGeometryCovers(
  geometry: TouchGeometryCoverage,
  required: TouchGeometryCoverage,
  margin: number | { x: number; y: number } = 0,
) {
  if (geometry.layoutVersion !== required.layoutVersion) return false;
  const marginX = typeof margin === "number" ? margin : margin.x;
  const marginY = typeof margin === "number" ? margin : margin.y;
  const epsilon = 0.001;
  return geometry.region.x <= required.region.x - marginX + epsilon &&
    geometry.region.y <= required.region.y - marginY + epsilon &&
    geometry.region.x + geometry.region.width + epsilon >=
      required.region.x + required.region.width + marginX &&
    geometry.region.y + geometry.region.height + epsilon >=
      required.region.y + required.region.height + marginY;
}

export function advanceTouchInteractionState(
  state: TouchInteractionState,
  at: number,
): TouchInteractionState {
  finite(at, "at");
  if (state.phase === "hold" && state.holdUntil !== null && at >= state.holdUntil) {
    return advanceTouchInteractionState(
      { ...state, phase: "fading", revision: state.revision + 1 },
      at,
    );
  }
  if (state.phase === "fading" && state.fadeUntil !== null && at >= state.fadeUntil) {
    return {
      ...state,
      fadeUntil: null,
      holdUntil: null,
      phase: "idle",
      point: null,
      revision: state.revision + 1,
    };
  }
  return state;
}

export function reduceTouchInteractionState(
  inputState: TouchInteractionState,
  action: TouchInteractionAction,
) {
  const at = finite(action.at, "action.at");
  const state = advanceTouchInteractionState(inputState, at);

  if (action.type === "contact") {
    if (state.activeTouchId !== null) return state;
    return {
      ...state,
      activeTouchId: action.id,
      fadeUntil: null,
      holdUntil: null,
      phase: "contact" as const,
      point: { x: finite(action.x, "action.x"), y: finite(action.y, "action.y") },
      revision: state.revision + 1,
    };
  }

  if (action.type === "move") {
    if (state.phase !== "contact" || state.activeTouchId !== action.id) return state;
    const point = { x: finite(action.x, "action.x"), y: finite(action.y, "action.y") };
    if (state.point?.x === point.x && state.point?.y === point.y) return state;
    return { ...state, point, revision: state.revision + 1 };
  }

  if (action.type === "reposition") {
    if (state.phase === "idle" || !state.point) return state;
    const point = { x: finite(action.x, "action.x"), y: finite(action.y, "action.y") };
    if (state.point.x === point.x && state.point.y === point.y) return state;
    return { ...state, point, revision: state.revision + 1 };
  }

  if (action.type === "release" || action.type === "cancel") {
    if (state.phase !== "contact" || state.activeTouchId !== action.id) return state;
    const holdUntil = at + TOUCH_HOLD_MS;
    return {
      ...state,
      activeTouchId: null,
      fadeUntil: holdUntil + TOUCH_FADE_MS,
      holdUntil,
      phase: "hold" as const,
      revision: state.revision + 1,
    };
  }

  return state;
}

export function touchInteractionPresentation(
  inputState: TouchInteractionState,
  at: number,
) {
  const state = advanceTouchInteractionState(inputState, at);
  if (state.phase === "idle") {
    return { state, mounted: false, opacity: 0, envelopeScale: 0 };
  }
  if (state.phase !== "fading" || state.holdUntil === null) {
    return { state, mounted: true, opacity: 1, envelopeScale: 1 };
  }
  const progress = Math.max(0, Math.min(1, (at - state.holdUntil) / TOUCH_FADE_MS));
  const eased = progress * progress * (3 - 2 * progress);
  return {
    state,
    mounted: true,
    opacity: 1 - eased,
    envelopeScale: 1 - eased,
  };
}
