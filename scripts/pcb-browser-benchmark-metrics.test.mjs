import assert from "node:assert/strict";
import test from "node:test";
import { classifyPixels, distribution, summarizeFrames, summarizeTrace } from "./pcb-browser-benchmark-metrics.mjs";

test("distributions interpolate and preserve zero while excluding unavailable values", () => {
  assert.deepEqual(distribution([100, null, 0, NaN, 20]), { count: 3, min: 0, median: 20, p95: 92, max: 100 });
  assert.equal(distribution([]).median, null);
});
test("unavailability integrates observed left samples and does not invent a trailing interval", () => {
  const report = summarizeFrames([{ at: 0, unavailable: 1, failed: 0 }, { at: 20, unavailable: 1, failed: 1 }, { at: 80, unavailable: 0, failed: 0 }]);
  assert.equal(report.unavailableMs, 80);
  assert.equal(report.over50Ms, 1);
  assert.equal(report.failedFrames, 1);
  assert.equal(summarizeFrames([{ at: 100, unavailable: 1 }]).unavailableMs, 0);
});
test("trace reports thread work without treating nested or parallel events as wall time", () => {
  const report = summarizeTrace([{ name: "Paint", ph: "X", dur: 1000 }, { name: "Paint", ph: "X", dur: 2000 }, { name: "Paint", ph: "B" }]);
  assert.deepEqual(report.Paint, { count: 2, summedThreadDurationMs: 3 });
  assert.equal(report.RasterTask.count, 0);
});
test("pixel classification distinguishes blank, stale, replaced and inconclusive references", () => {
  const matte = Uint8Array.from([128, 144, 160, 128, 144, 160]);
  const old = Uint8Array.from([0, 0, 0, 128, 144, 160]);
  const next = Uint8Array.from([128, 144, 160, 0, 0, 0]);
  assert.equal(classifyPixels(matte, old, next).state, "blank-matte");
  assert.equal(classifyPixels(old, old, next).state, "stale-original");
  assert.equal(classifyPixels(next, old, next).state, "replacement");
  assert.equal(classifyPixels(old, old, old).state, "indeterminate-reference");
  assert.throws(() => classifyPixels([1], [], []), /matching RGB/);
  assert.throws(() => classifyPixels([], [], []), /matching RGB/);
});
