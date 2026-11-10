import assert from "node:assert/strict";
import test from "node:test";
import { createGeometryDeliveryBroker } from "../lib/pcb/geometry-delivery.ts";
import { createStaticGeometryWaits, stageStaticGeometry } from "../lib/pcb/static-geometry-waits.ts";

const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test("both obsolete geometry waits yield before old delivery, freeing current viewport demand", async () => {
  const waits = createStaticGeometryWaits();
  const old = [deferred(), deferred()];
  let current = false;
  const workers = old.map((entry) => waits.wait(entry.promise, () => current));
  waits.notify();
  current = true;
  waits.notify();
  assert.deepEqual(await Promise.all(workers), [null, null]);
  const visible = [deferred(), deferred()];
  const next = visible.map((entry) => waits.wait(entry.promise, () => false));
  visible[0].resolve("left"); visible[1].resolve("right");
  assert.deepEqual(await Promise.all(next), [{ value: "left" }, { value: "right" }]);
  // Superseded/released acquisition may reject after a worker has yielded.
  old.forEach((entry) => entry.reject(new Error("released")));
  await tick();
});

test("stationary/background progress waits normally and cancellation drains pending workers", async () => {
  const waits = createStaticGeometryWaits();
  const first = deferred();
  let completed = false;
  const work = waits.wait(first.promise, () => false).then((result) => { completed = true; return result; });
  waits.notify(); await tick(); assert.equal(completed, false);
  first.resolve([]); assert.deepEqual(await work, { value: [] });
  const stalled = deferred();
  const pending = waits.wait(stalled.promise, () => false);
  waits.cancel(); assert.equal(await pending, null);
  stalled.reject(undefined); await tick();
  assert.equal(await waits.wait(Promise.resolve("unused"), () => false), null);
});

test("repeated scroll jumps with stalled bodies stay within16 staged regions and release unused transports", async () => {
  const requests = [];
  const broker = createGeometryDeliveryBroker({ timeoutMs: 60_000, fetcher: async (url, init) => {
    const response = deferred();
    requests.push({ url, signal: init.signal, response });
    // Deliberately ignore abort while reading the body. Broker cancellation
    // must end its own wait rather than rely on fetch/body cooperation.
    return { ok: true, json: () => response.promise };
  } });
  const waits = createStaticGeometryWaits();
  const staged = new Map();
  const active = new Set();
  let visible = new Set();
  let workers = [];
  let shared;
  for (let jump = 0; jump < 30; jump += 1) {
    const regions = Array.from({ length: 8 }, (_, index) => ({ x: jump * 1000 + index * 20, y: 0, width: 10, height: 10 }));
    const keys = regions.map((region) => String(region.x));
    visible = new Set(keys);
    waits.notify();
    if (workers.length) assert.deepEqual(await Promise.all(workers), [null, null]);
    active.clear();
    stageStaticGeometry(staged, active, keys, () => broker.loadBatchHandles("source", regions));
    if (jump === 0) shared = broker.load("source", regions[0]);
    assert.ok(staged.size <= 16);
    // At most two eight-region cohorts plus an explicitly retained interaction
    // consumer. Old shared ownership is outside static staging's budget.
    assert.ok(requests.filter((request) => !request.signal.aborted).length <= 3);
    keys.slice(0, 2).forEach((key) => active.add(key));
    workers = [...active].map((key) => waits.wait(staged.get(key).promise, () => !visible.has(key)));
  }
  assert.equal(requests[0].signal.aborted, false, "independent interaction is preserved");
  const last = requests.at(-1);
  last.response.resolve({ paths: [], regions: Array.from({ length: 8 }, () => []) });
  assert.deepEqual(await Promise.all(workers), [{ value: [] }, { value: [] }]);
  waits.cancel(); staged.forEach((handle) => handle.release()); staged.clear();
  requests[0].response.resolve({ paths: [], regions: Array.from({ length: 8 }, () => []) });
  await shared;
  await tick();
  assert.ok(requests.slice(1, -1).every((request) => request.signal.aborted));
  assert.ok(requests.every((request) => JSON.parse(new URL(request.url, "http://local").searchParams.get("regions")).length <= 8));
});
