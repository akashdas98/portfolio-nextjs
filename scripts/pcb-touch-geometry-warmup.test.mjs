import assert from "node:assert/strict";
import test from "node:test";
import { touchGeometryRegions, touchViewportGeometryRegion, touchViewportGeometryBand } from "../lib/pcb/touch-canvas.ts";
import { createTouchGeometryWarmup, createTouchGeometryWarmSchedule } from "../lib/pcb/touch-preparation.ts";
import { touchGeometryCovers } from "../lib/pcb/touch-interaction.ts";
import { createGeometryDeliveryBroker } from "../lib/pcb/geometry-delivery.ts";

const tick = () => new Promise((resolve) => setImmediate(resolve));
const contains = (outer, inner) => touchGeometryCovers(
  { layoutVersion: 1, region: outer }, { layoutVersion: 1, region: inner },
);
function contactRegion(point, layout) {
  const { region } = touchGeometryRegions(point, layout, 420, 96);
  region.x = (-layout.renderLeft - 274) / layout.renderScale;
  region.width = (layout.pageWidth + 548) / layout.renderScale;
  return region;
}

test("viewport union covers unchanged full contact requests at every edge and prefetch boundary", () => {
  for (const [pageWidth, height, renderScale, renderLeft, top] of [
    [390, 844, 0.87, -810, 0], [430, 932, 1.125, -1176, 763.25],
    [1024, 768, 0.6, -208, 1650], [1440, 1000, 0.75, -180, -76],
  ]) {
    const layout = { pageWidth, renderScale, renderLeft };
    const warm = touchViewportGeometryRegion({ top, height }, layout, 420, 96, 64, 64);
    for (const y of [top - 64, top, top + 0.001, top + height / 2, top + height, top + height + 64]) {
      for (const x of [0, pageWidth / 2, pageWidth]) {
        const contact = contactRegion({ x, y }, layout);
        assert.equal(contains(warm, contact), true, `${pageWidth}:${x}:${y}`);
        assert.ok(Math.abs(contact.height * renderScale - 708) < 1e-8, "warming never expands contact raster geometry");
        assert.ok(warm.x <= contact.x && warm.y <= contact.y &&
          warm.x + warm.width >= contact.x + contact.width &&
          warm.y + warm.height >= contact.y + contact.height, "strict broker coverage includes every edge");
        assert.ok(Math.abs(contact.width * renderScale - (pageWidth + 548)) < 1e-8);
      }
    }
    // A latest viewport intent is bounded by viewport height and existing
    // bucket reserve, never by complete document height.
    assert.ok(warm.height * renderScale <= height + 708 + 128 + 96 + 1e-8);
    assert.equal(contains(warm, contactRegion({ x: 0, y: top + height + 1024 }, layout)), false);
  }
});

test("scrolling inside a contact bucket keeps the delivery selection stable; crossing updates coverage", () => {
  const layout = { pageWidth: 390, renderScale: 1, renderLeft: 0 };
  const make = (top) => touchViewportGeometryRegion({ top, height: 800 }, layout, 420, 96, 64, 64);
  assert.deepEqual(make(10), make(11));
  const shifted = make(2026);
  assert.equal(contains(shifted, contactRegion({ x: 390, y: 2026 + 800 }, layout)), true);
  assert.equal(contains(make(10), shifted), false);
  assert.throws(() => touchViewportGeometryRegion({ top: 0, height: 0 }, layout, 420, 96, 64, 64), /Invalid/);
});

test("geometry warmup starts without contact and retains metadata without publishing pixels", async () => {
  const loaded = [];
  const warmup = createTouchGeometryWarmup({ load: async (request) => {
    loaded.push(request.key); return [{ source: "plain path data" }];
  } });
  warmup.want({ key: "viewport-a", region: {} }); await tick();
  assert.deepEqual(loaded, ["viewport-a"]);
  assert.equal(warmup.active.key, "viewport-a");
  assert.equal(Object.hasOwn(warmup.active, "paths"), false);
  assert.equal(warmup.running, false); assert.equal(warmup.wanted, null);
  warmup.dispose(); assert.equal(warmup.active, null);
});

test("obsolete unresolved delivery cannot block new viewport intent or contact consumer", async () => {
  const loads = [];
  const deferred = new Map();
  const warmup = createTouchGeometryWarmup({ load(request) {
    loads.push(request.key);
    return new Promise((resolve, reject) => deferred.set(request.key, { resolve, reject }));
  } });
  warmup.want({ key: "old" });
  warmup.want({ key: "intermediate" });
  warmup.want({ key: "new" });
  await tick();
  assert.deepEqual(loads, ["old", "new"], "the obsolete read must not serialize newer intent");
  deferred.get("new").resolve([]); await tick();
  assert.equal(warmup.active.key, "new");
  deferred.get("old").reject(new Error("late shared failure")); await tick();
  assert.equal(warmup.active.key, "new"); warmup.dispose();
});

test("capability/layout clearing cancels only warm wait and leaves shared demand acquisition intact", async () => {
  const requests = [];
  const broker = createGeometryDeliveryBroker({ fetcher(input, init) {
    return new Promise((resolve, reject) => {
      requests.push({ input, signal: init.signal, resolve });
      init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
    });
  } });
  const region = { x: -274, y: -402, width: 938, height: 1668 };
  const warmup = createTouchGeometryWarmup({ load: (request) => broker.load("a", request.region) });
  warmup.want({ key: "layout-a", region });
  const demand = broker.load("a", region);
  warmup.reset(); await tick();
  assert.equal(requests[0].signal.aborted, false);
  requests[0].resolve({ ok: true, json: async () => ({ paths: [] }) });
  assert.deepEqual(await demand, []); assert.equal(warmup.active, null);
  warmup.dispose();
});

test("warm fulfillment rescues narrower contact geometry without changing raster bounds", async () => {
  const requests = [];
  const broker = createGeometryDeliveryBroker({ fetcher(input, init) {
    return new Promise((resolve, reject) => {
      requests.push({ input, signal: init.signal, resolve });
      init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
    });
  } });
  const layout = { pageWidth: 390, renderScale: 1, renderLeft: 0 };
  const warmRegion = touchViewportGeometryRegion({ top: 0, height: 844 }, layout, 420, 96, 64, 64);
  const warmup = createTouchGeometryWarmup({ load: (request) => broker.load("a", request.region) });
  warmup.want({ key: "viewport", region: warmRegion });
  const contact = contactRegion({ x: 390, y: 843 }, layout);
  const pending = broker.load("a", contact);
  const paths = [{ source: "exact", left: 0, top: 800, right: 390, bottom: 900 }];
  requests[0].resolve({ ok: true, json: async () => ({ paths }) });
  assert.deepEqual(await pending, paths); await tick();
  assert.equal(requests[1].signal.aborted, true);
  assert.equal(contact.height, 708);
  const later = await broker.load("a", contactRegion({ x: 0, y: 0 }, layout));
  assert.deepEqual(later, []); assert.equal(requests.length, 2);
  warmup.dispose();
});

test("viewport intents revalidate shared delivery lifetime after metadata was retained", async () => {
  let loads = 0;
  const warmup = createTouchGeometryWarmup({ load: async () => { loads += 1; } });
  const request = { key: "same-viewport" };
  warmup.want(request); await tick();
  warmup.want(request); await tick();
  assert.equal(loads, 2, "retained metadata is not a cache pin or proof of available geometry");
  warmup.dispose();
});


test("stable viewport bands preserve all visible requests and one-band ahead coverage", () => {
  const layout = { pageWidth: 390, renderScale: 0.87, renderLeft: -810 };
  for (const top of [-76, 0, 11, 511.99, 512, 20300]) {
    const band = touchViewportGeometryBand({ top, height: 844 });
    assert.ok(band.top <= top && band.top + band.height >= top + 844 + 512);
    assert.ok(band.height <= 844 + 3 * 512);
    const warm = touchViewportGeometryRegion(band, layout, 420, 96, 64, 64);
    for (const y of [top - 64, top, top + 844, top + 844 + 64]) {
      const contact = contactRegion({ x: 390, y }, layout);
      assert.ok(warm.y <= contact.y && warm.y + warm.height >= contact.y + contact.height);
    }
  }
  assert.deepEqual(touchViewportGeometryBand({ top: 10, height: 844 }), touchViewportGeometryBand({ top: 11, height: 844 }));
});

test("rapid multi-band scroll replaces scheduled intent instead of dispatching per frame", async () => {
  let now = 0; let next = 0; const timers = new Map(); const loads = [];
  const warmup = createTouchGeometryWarmup({ load(request) {
    loads.push(request.key); return new Promise(() => {});
  } });
  let viewport = 0;
  const schedule = createTouchGeometryWarmSchedule({
    warm: () => warmup.want({ key: String(viewport) }),
    timer(callback, delay) {
      const id = ++next; timers.set(id, { callback, due: now + delay });
      return () => timers.delete(id);
    },
  });
  function advance(ms) {
    now += ms;
    for (const [id, pending] of [...timers]) if (pending.due <= now) { timers.delete(id); pending.callback(); }
  }
  schedule.now();
  for (let frame = 1; frame <= 120; frame += 1) {
    viewport = frame * 150; schedule.scroll(); advance(16);
  }
  assert.deepEqual(loads, ["0"], "no obsolete per-frame transport is started during rapid scrolling");
  advance(120); await tick();
  assert.deepEqual(loads, ["0", "18000"], "latest viewport starts without waiting for the obsolete transport");
  viewport = 20000; schedule.scroll(); schedule.clear(); advance(120);
  assert.equal(loads.length, 2, "capability clear removes pending viewport delivery");
  viewport = 21000; schedule.scroll(); schedule.now(); await tick();
  assert.equal(loads.at(-1), "21000", "layout changes may begin immediately");
  schedule.dispose(); warmup.dispose(); advance(1000); await tick();
});
