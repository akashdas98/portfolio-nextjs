export const TOUCH_HOLD_MS = 6_000;
export const TOUCH_FADE_MS = 700;

function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

export function createTouchState({ reducedMotion = false } = {}) {
  return {
    activeTouchId: null,
    fadeUntil: null,
    holdUntil: null,
    phase: "idle",
    point: null,
    reducedMotion: Boolean(reducedMotion),
    revision: 0,
  };
}

export function advanceTouchState(state, at) {
  finite(at, "at");
  if (state.phase === "hold" && at >= state.holdUntil) {
    return advanceTouchState({ ...state, phase: "fading", revision: state.revision + 1 }, at);
  }
  if (state.phase === "fading" && at >= state.fadeUntil) {
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

export function reduceTouchState(inputState, action) {
  const at = finite(action.at, "action.at");
  const state = advanceTouchState(inputState, at);
  if (state.reducedMotion) return state;

  if (action.type === "contact") {
    if (state.activeTouchId !== null) return state;
    return {
      ...state,
      activeTouchId: action.id,
      fadeUntil: null,
      holdUntil: null,
      phase: "contact",
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

  if (action.type === "release" || action.type === "cancel") {
    if (state.phase !== "contact" || state.activeTouchId !== action.id) return state;
    const holdUntil = at + TOUCH_HOLD_MS;
    return {
      ...state,
      activeTouchId: null,
      fadeUntil: holdUntil + TOUCH_FADE_MS,
      holdUntil,
      phase: "hold",
      revision: state.revision + 1,
    };
  }

  if (action.type === "tick") return state;
  throw new TypeError(`Unknown touch action: ${action.type}`);
}

export function touchPresentation(inputState, at) {
  const state = advanceTouchState(inputState, at);
  if (state.phase === "idle") return { state, mounted: false, opacity: 0, envelopeScale: 0 };
  if (state.phase !== "fading") return { state, mounted: true, opacity: 1, envelopeScale: 1 };
  const progress = Math.max(0, Math.min(1, (at - state.holdUntil) / TOUCH_FADE_MS));
  const eased = progress * progress * (3 - 2 * progress);
  return { state, mounted: true, opacity: 1 - eased, envelopeScale: 1 - eased };
}
