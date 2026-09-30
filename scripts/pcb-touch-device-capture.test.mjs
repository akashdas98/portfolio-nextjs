import assert from "node:assert/strict";
import test from "node:test";
import { createTouchDeviceCaptureBuffer, serializeTouchDeviceCapture, isTouchDeviceCapture, TOUCH_DEVICE_CAPTURE_BODY_LIMIT } from "../lib/pcb/touch-device-capture.ts";

test("raw-only capture keeps newest bounded evidence and reports discarded records", () => {
  const capture = createTouchDeviceCaptureBuffer(4);
  for (let id = 0; id < 8; id += 1) capture.add({ eventId: id, eventType: "scroll" });
  assert.equal(capture.size, 4); assert.equal(capture.dropped, 4);
  assert.deepEqual(capture.drain().map(record => record.eventId), [4, 5, 6, 7]);
  assert.equal(capture.size, 0);
});

test("combined legacy frames and raw records fit upload limit while retaining latest contact", () => {
  const frames = Array.from({ length: 400 }, (_, id) => ({ id, sample: "x".repeat(1000) }));
  const events = Array.from({ length: 256 }, (_, id) => ({ eventId: id, eventType: id === 255 ? "pointerdown" : "scroll", sample: "x".repeat(1000) }));
  const body = serializeTouchDeviceCapture({ schema: "pcb-touch-device-capture-v1", frames, events });
  assert.ok(body.length <= TOUCH_DEVICE_CAPTURE_BODY_LIMIT);
  const payload = JSON.parse(body);
  assert.equal(payload.events.at(-1).eventType, "pointerdown");
  assert.ok(payload.trimmedFrames > 0); assert.ok(payload.trimmedEvents > 0);
  assert.equal(isTouchDeviceCapture(payload), true);
  assert.equal(frames.length, 400); assert.equal(events.length, 256);
});

test("v1 legacy and raw-only uploads remain valid; malformed or oversized records are rejected", () => {
  assert.equal(isTouchDeviceCapture({ schema: "pcb-touch-device-capture-v1", frames: [{ phase: "contact", t: 10 }] }), true);
  assert.equal(isTouchDeviceCapture({ schema: "pcb-touch-device-capture-v1", frames: [], events: [{ eventType: "touchstart", touches: "[[1,2,3]]" }], rawCounts: { "trusted:touchstart": 1 } }), true);
  assert.equal(isTouchDeviceCapture({ schema: "pcb-touch-device-capture-v1", events: Array(257).fill({ t: 0 }) }), false);
  assert.equal(isTouchDeviceCapture({ schema: "pcb-touch-device-capture-v1", events: [{ touches: [] }] }), false);
  assert.equal(isTouchDeviceCapture({ schema: "wrong" }), false);
});
