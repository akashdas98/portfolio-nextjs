import assert from "node:assert/strict";
import test from "node:test";
import {
  createEnvelopeDirections,
  envelopeContourPath,
  evaluateEnvelopeDisplacements,
} from "../lib/pcb/envelope-evaluator.ts";

const config = {
  baseRadius: 247.5,
  directions: createEnvelopeDirections(256),
  maxDisplacement: 54,
  tinyMaxDisplacement: 14,
  warpStart: 0.68,
};
const wave = {
  active: true,
  amplitude: 12,
  angle: 0,
  attackDuration: 100,
  decayDuration: 200,
  startedAt: 0,
  wavelength: 20,
};

test("evaluation is deterministic and bounded", () => {
  const first = evaluateEnvelopeDisplacements([], [wave], 100, config);
  const second = evaluateEnvelopeDisplacements([], [wave], 100, config);
  assert.deepEqual(first, second);
  assert.equal(first.length, 256);
  assert.ok(Math.max(...first) <= config.tinyMaxDisplacement);
  assert.ok(Math.max(...first) > 0);
});

test("inactive waves leave the resting contour unchanged", () => {
  const displacement = evaluateEnvelopeDisplacements([{ ...wave, active: false }], [], 100, config);
  assert.ok(displacement.every((value) => value === 0));
  const path = envelopeContourPath(1, displacement, 307.5, config);
  assert.match(path, /^M555\.00 307\.50L/);
  assert.ok(path.endsWith("Z"));
});
