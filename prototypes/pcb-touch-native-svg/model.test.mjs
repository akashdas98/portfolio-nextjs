import assert from "node:assert/strict";
import test from "node:test";

import {
  TOUCH_FADE_MS,
  TOUCH_HOLD_MS,
  advanceTouchState,
  createTouchState,
  reduceTouchState,
  touchPresentation,
} from "./model.mjs";

const contact = (state, at = 0, id = 7, x = 120, y = 240) =>
  reduceTouchState(state, { type: "contact", at, id, x, y });

test("drag and scroll-only movement share the renderer-neutral coordinate transition", () => {
  let state = contact(createTouchState());
  state = reduceTouchState(state, { type: "move", at: 20, id: 7, x: 145, y: 260, source: "drag" });
  assert.deepEqual(state.point, { x: 145, y: 260 });
  state = reduceTouchState(state, { type: "move", at: 40, id: 7, x: 145, y: 380, source: "scroll" });
  assert.deepEqual(state.point, { x: 145, y: 380 });
  assert.equal(state.phase, "contact");
});

for (const type of ["release", "cancel"]) {
  test(`${type} holds for exactly six seconds then fades for 700ms`, () => {
    let state = contact(createTouchState(), 100);
    state = reduceTouchState(state, { type, at: 250, id: 7 });
    assert.equal(state.phase, "hold");
    assert.equal(state.holdUntil, 250 + TOUCH_HOLD_MS);
    assert.equal(touchPresentation(state, 6_249).opacity, 1);
    assert.equal(touchPresentation(state, 6_250).state.phase, "fading");
    const middle = touchPresentation(state, 6_250 + TOUCH_FADE_MS / 2);
    assert.equal(middle.state.phase, "fading");
    assert.equal(middle.opacity, 0.5);
    assert.equal(middle.envelopeScale, 0.5);
    assert.equal(touchPresentation(state, 6_949).mounted, true);
    assert.equal(touchPresentation(state, 6_950).mounted, false);
  });
}

test("large frame gaps use absolute deadlines instead of accumulating frame deltas", () => {
  let state = contact(createTouchState(), 0);
  state = reduceTouchState(state, { type: "release", at: 10, id: 7 });
  state = advanceTouchState(state, 50_000);
  assert.equal(state.phase, "idle");
  assert.equal(state.point, null);
});

test("secondary contacts cannot steal or move the primary contact", () => {
  let state = contact(createTouchState(), 0, 1, 10, 20);
  const revision = state.revision;
  state = reduceTouchState(state, { type: "contact", at: 1, id: 2, x: 300, y: 400 });
  state = reduceTouchState(state, { type: "move", at: 2, id: 2, x: 500, y: 600 });
  state = reduceTouchState(state, { type: "release", at: 3, id: 2 });
  assert.equal(state.revision, revision);
  assert.equal(state.activeTouchId, 1);
  assert.deepEqual(state.point, { x: 10, y: 20 });
});

test("reactivation during hold or fade replaces the old absolute timeline", () => {
  let state = contact(createTouchState(), 0, 1);
  state = reduceTouchState(state, { type: "release", at: 10, id: 1 });
  state = advanceTouchState(state, 6_020);
  assert.equal(state.phase, "fading");
  state = contact(state, 6_030, 2, 99, 101);
  assert.equal(state.phase, "contact");
  assert.equal(state.holdUntil, null);
  assert.equal(state.fadeUntil, null);
  assert.deepEqual(state.point, { x: 99, y: 101 });
  assert.equal(touchPresentation(state, 99_999).opacity, 1);
});

test("reduced motion excludes interaction state entirely", () => {
  const original = createTouchState({ reducedMotion: true });
  const next = contact(original);
  assert.deepEqual(next, original);
  assert.deepEqual(touchPresentation(next, 1_000), {
    state: original,
    mounted: false,
    opacity: 0,
    envelopeScale: 0,
  });
});
