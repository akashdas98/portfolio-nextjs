import assert from "node:assert/strict";
import test from "node:test";
import { createGeometryDeliveryBroker, selectDeliveredGeometry, PCB_GEOMETRY_BATCH_LIMIT } from "../lib/pcb/geometry-delivery.ts";
import { parsePcbBatchRegions, selectPcbPathBatch, selectPcbPaths, MAX_PCB_BATCH_REGIONS } from "../lib/pcb/spatial.ts";
import { waitForTouchPreparation } from "../lib/pcb/touch-preparation.ts";
import { buildPcbGeometryUrl } from "../lib/pcb/bootstrap.ts";

const region = (x = 0, y = 0, width = 10, height = 10) => ({ x, y, width, height });
const path = (source, left, top, right, bottom) => ({ source, left, top, right, bottom });
const paths = [path("first", -5, 0, 0, 3), path("second", 3, 3, 15, 9), path("third", 20, 20, 40, 40)];
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("bootstrap matches native preload mode without allowing credentialed redirects", async () => {
  const seen = [];
  const broker = createGeometryDeliveryBroker({ fetcher: async (url, init) => {
    seen.push({ url, init });
    return { ok: true, json: async () => ({ paths: [] }) };
  } });
  await broker.loadBootstrap("source", region());
  assert.equal(seen[0].url.startsWith("/api/pcb?"), true);
  assert.equal(seen[0].init.mode, "no-cors");
  assert.equal(seen[0].init.credentials, "include");
  assert.equal(seen[0].init.redirect, "error");
  await broker.load("source", region(200));
  assert.equal(seen[1].init.mode, undefined);
  assert.equal(seen[1].init.credentials, undefined);
});
const body = (value) => ({ ok: true, json: async () => value });
function fixture(options = {}) {
  const requests = [];
  const broker = createGeometryDeliveryBroker({ timeoutMs: 500, ...options, fetcher(input, init) {
    return new Promise((resolve, reject) => {
      const request = { input, signal: init.signal, credentials: init.credentials, resolve, reject };
      requests.push(request);
      init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
    });
  } });
  return { broker, requests };
}

function batchQuery(regions) { return new URLSearchParams({ regions: JSON.stringify(regions) }); }

test("batched bounds selection deduplicates objects and preserves exact original order", () => {
  const regions = [region(), region(10, 0), region(100, 100), region()];
  const index = { width: 100, height: 100, paths };
  const batch = selectPcbPathBatch(index, regions);
  assert.deepEqual(batch.paths, paths.slice(0, 2));
  regions.forEach((r, i) => {
    const selected = batch.regions[i].map((j) => batch.paths[j]);
    assert.deepEqual(selected, selectPcbPaths(index, r));
    assert.deepEqual(selectDeliveredGeometry(paths, r), selected);
  });
  assert.strictEqual(batch.paths[0], paths[0]);
  assert.equal(PCB_GEOMETRY_BATCH_LIMIT, MAX_PCB_BATCH_REGIONS);
});

test("batch query permits bounded numeric regions and rejects malformed, mixed and oversized input", () => {
  const valid = [region(-3.5, -6), region(0, 0, 65_536, 65_536)];
  assert.deepEqual(parsePcbBatchRegions(batchQuery(valid)), valid);
  for (const value of [[], Array(9).fill(region()), null, [null], [{ ...region(), extra: 1 }],
    [{ ...region(), x: "0" }], [region(0, 0, 0)], [region(100_001)], [region(0, 0, 65_537)]]) {
    assert.throws(() => parsePcbBatchRegions(batchQuery(value)), /PCB|regions|numeric/);
  }
  const mixed = batchQuery([region()]); mixed.set("x", "0");
  assert.throws(() => parsePcbBatchRegions(mixed), /without single-region/);
  const duplicate = batchQuery([region()]); duplicate.append("regions", "[]");
  assert.throws(() => parsePcbBatchRegions(duplicate), /one regions/);
  assert.throws(() => parsePcbBatchRegions(new URLSearchParams({ regions: "[" })), /JSON/);
  assert.throws(() => parsePcbBatchRegions(new URLSearchParams({ regions: " ".repeat(5000) + "[]" })), /too large/);
});

test("single wire request remains compatible; fulfilled covering geometry satisfies later requests", async () => {
  const { broker, requests } = fixture();
  const full = broker.load("source-a", region(-10, -10, 100, 100));
  const query = new URL(requests[0].input, "http://local").searchParams;
  assert.equal(query.get("source"), "source-a"); assert.equal(query.get("x"), "-10");
  assert.equal(query.has("regions"), false);
  requests[0].resolve(body({ paths })); await full;
  const selected = await broker.load("source-a", region());
  assert.deepEqual(selected, paths.slice(0, 2)); assert.equal(requests.length, 1);
  assert.strictEqual(selected[0], paths[0]);
  const foreign = broker.load("source-b", region());
  assert.equal(requests.length, 2); requests[1].resolve(body({ paths: [] })); await foreign;
});

test("larger fulfillment rescues pending narrower consumers before aborting redundant transport", async () => {
  const { broker, requests } = fixture();
  const narrow = broker.load("a", region());
  const full = broker.load("a", region(-10, -10, 100, 100));
  requests[1].resolve(body({ paths }));
  assert.deepEqual(await narrow, paths.slice(0, 2)); await full;
  assert.equal(requests[0].signal.aborted, true);
  await tick();
  assert.deepEqual(await broker.load("a", region()), paths.slice(0, 2));
  assert.equal(requests.length, 2, "aborted redundant rejection cannot evict fulfilled cache data");
});

test("a covering result resolves a stalled batch's per-region promises and outer wait", async () => {
  const { broker, requests } = fixture();
  const regions = [region(), region(20, 20)];
  const batch = broker.loadBatch("a", regions);
  const full = broker.load("a", region(-10, -10, 100, 100));
  requests[1].resolve(body({ paths }));
  assert.deepEqual(await batch, regions.map((r) => selectDeliveredGeometry(paths, r)));
  await full; assert.equal(requests[0].signal.aborted, true);
});

test("partially covered batch keeps its transport alive until every consumer is fulfilled", async () => {
  const { broker, requests } = fixture();
  const regions = [region(), region(20, 20)];
  const batch = broker.loadBatch("a", regions);
  const coveringFirst = broker.load("a", region(-5, -5, 20, 20));
  requests[1].resolve(body({ paths: paths.slice(0, 2) })); await coveringFirst;
  assert.equal(requests[0].signal.aborted, false);
  requests[0].resolve(body({ paths, regions: [[0, 1], [2]] }));
  assert.deepEqual(await batch, [paths.slice(0, 2), paths.slice(2)]);
});

test("per-region handles expose fulfilled and covered entries before stalled peers", async () => {
  const { broker, requests } = fixture();
  const cached = broker.load("a", region());
  requests[0].resolve(body({ paths: paths.slice(0, 2) })); await cached;
  const handles = broker.loadBatchHandles("a", [region(), region(20, 20), region(200, 200)]);
  assert.deepEqual(await handles[0].promise, paths.slice(0, 2));
  const covering = broker.load("a", region(15, 15, 30, 30));
  requests[2].resolve(body({ paths: paths.slice(2) })); await covering;
  assert.deepEqual(await handles[1].promise, paths.slice(2));
  assert.equal(requests[1].signal.aborted, false, "unresolved peer retains the batch");
  handles.forEach((handle) => handle.release());
  assert.equal(requests[1].signal.aborted, true);
  await assert.rejects(handles[2].promise, /interest released/);
});

test("releasing static handles preserves exact shared and bootstrap consumers", async () => {
  const { broker, requests } = fixture();
  const handles = broker.loadBatchHandles("a", [region(), region(20, 20)]);
  const shared = broker.load("a", region());
  const duplicate = broker.loadBatchHandles("a", [region(20, 20)]);
  handles.forEach((handle) => handle.release());
  assert.equal(requests[0].signal.aborted, false);
  duplicate[0].release(); duplicate[0].release();
  await assert.rejects(handles[1].promise, /interest released/);
  assert.equal(requests[0].signal.aborted, false, "shared interaction still owns one region");
  requests[0].resolve(body({ paths, regions: [[0, 1], [2]] }));
  assert.deepEqual(await shared, paths.slice(0, 2));
  const bootstrap = broker.loadBootstrap("b", region(-16, -16, 100, 100));
  const contained = broker.loadBatchHandles("b", [region()]);
  contained[0].release();
  assert.equal(requests[1].signal.aborted, false);
  requests[1].resolve(body({ paths })); await bootstrap;
});

test("canceling one touch wait never aborts shared acquisition or another consumer", async () => {
  const { broker, requests } = fixture();
  const shared = broker.load("a", region());
  const same = broker.load("a", region()); assert.strictEqual(shared, same);
  const cancellation = new AbortController();
  const touch = waitForTouchPreparation(shared, cancellation.signal);
  cancellation.abort(new Error("superseded")); await assert.rejects(touch, /superseded/);
  assert.equal(requests[0].signal.aborted, false);
  requests[0].resolve(body({ paths: paths.slice(0, 2) }));
  assert.deepEqual(await same, paths.slice(0, 2));
});

test("batch wire restores ordered arrays while sharing deduplicated path objects", async () => {
  const { broker, requests } = fixture();
  const batched = broker.loadBatch("a", [region(), region(10, 0)]);
  const query = new URL(requests[0].input, "http://local").searchParams;
  assert.equal(query.has("x"), false); assert.equal(JSON.parse(query.get("regions")).length, 2);
  requests[0].resolve(body({ paths: paths.slice(0, 2), regions: [[0, 1], [1]] }));
  const result = await batched;
  assert.deepEqual(result, [paths.slice(0, 2), paths.slice(1, 2)]);
  assert.strictEqual(result[0][1], result[1][0]);
  assert.deepEqual(await broker.loadBatch("a", [region(), region(10, 0)]), result);
  assert.equal(requests.length, 1);
});

test("malformed response fails only its delivery and is evicted without retry", async () => {
  const { broker, requests } = fixture();
  const bad = broker.loadBatch("a", [region()]); const rejection = assert.rejects(bad, /path order/);
  const other = broker.load("b", region());
  requests[0].resolve(body({ paths, regions: [[1, 0]] })); await rejection;
  requests[1].resolve(body({ paths: [] })); await other;
  const retried = broker.load("a", region()); assert.equal(requests.length, 3);
  requests[2].resolve(body({ paths: [] })); await retried;
});

test("cache eviction and late failure cannot delete a newer entry with the same key", async () => {
  const { broker, requests } = fixture({ cacheLimit: 1 });
  const obsolete = broker.load("a", region()); const failed = assert.rejects(obsolete, /500/);
  const middle = broker.load("b", region());
  const current = broker.load("a", region());
  requests[0].resolve({ ok: false, status: 500 }); await failed;
  assert.strictEqual(broker.load("a", region()), current);
  requests[1].resolve(body({ paths: [] })); requests[2].resolve(body({ paths: [] }));
  await Promise.all([middle, current]); assert.equal(broker.cacheSize, 1);
});

test("the cache remains at128 while evicted pending callers still receive their results", async () => {
  const { broker, requests } = fixture();
  const waiting = Array.from({ length: 135 }, (_, x) => broker.load(`source-${x}`, region()));
  assert.equal(broker.cacheSize, 128);
  requests.forEach((request) => request.resolve(body({ paths: [] })));
  await Promise.all(waiting); assert.equal(broker.cacheSize, 128);
});

test("a response-body stall retries once then rejects within bounded transport lifetime", async () => {
  const requests = [];
  const broker = createGeometryDeliveryBroker({ timeoutMs: 10, fetcher: async (_, init) => {
    requests.push(init.signal); return { ok: true, json: () => new Promise(() => {}) };
  } });
  await assert.rejects(broker.load("a", region()), /timed out/);
  assert.equal(requests.length, 2); assert.ok(requests.every((signal) => signal.aborted));
  assert.equal(broker.cacheSize, 0);
});

test("timeout retry can recover and network failure retries at most once", async () => {
  let calls = 0;
  const broker = createGeometryDeliveryBroker({ timeoutMs: 10, fetcher: async () => {
    calls += 1; return calls === 1 ? { ok: true, json: () => new Promise(() => {}) } : body({ paths: [] });
  } });
  assert.deepEqual(await broker.load("a", region()), []); assert.equal(calls, 2);
  let failures = 0;
  const broken = createGeometryDeliveryBroker({ fetcher: async () => { failures += 1; throw new TypeError("offline"); } });
  await assert.rejects(broken.load("a", region()), /offline/); assert.equal(failures, 2);
});

test("a covering result rescues consumers while a retried body is stalled", async () => {
  let calls = 0;
  const broker = createGeometryDeliveryBroker({ timeoutMs: 15, fetcher: async (input) => {
    calls += 1;
    const query = new URL(input, "http://local").searchParams;
    return query.get("width") === "100" ? body({ paths }) : { ok: true, json: () => new Promise(() => {}) };
  } });
  const pending = broker.load("a", region());
  await new Promise((resolve) => setTimeout(resolve, 20));
  const covering = broker.load("a", region(-10, -10, 100, 100));
  assert.deepEqual(await pending, paths.slice(0, 2)); await covering;
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(calls, 3);
  assert.deepEqual(await broker.load("a", region()), paths.slice(0, 2));
});

test("invalid client batches cannot leave allocated pending promises", () => {
  const { broker, requests } = fixture();
  assert.throws(() => broker.loadBatch("a", []), /between 1 and 8/);
  assert.throws(() => broker.loadBatch("a", Array(9).fill(region())), /between 1 and 8/);
  assert.throws(() => broker.loadBatch("a", [region(), region(0, 0, -1)]), /Invalid/);
  assert.equal(requests.length, 0); assert.equal(broker.cacheSize, 0);
});

test("explicit pending bootstrap covers a tile batch with one exact preload URL", async () => {
  const { broker, requests } = fixture();
  const coverage = region(-16, -16, 100, 100);
  const bootstrap = broker.loadBootstrap("a", coverage);
  const regions = [region(), region(20, 20), region(60, 60)];
  const tiles = broker.loadBatch("a", regions);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].input, buildPcbGeometryUrl("a", coverage));
  assert.equal(requests[0].credentials, "include", "match same-origin native preload credentials");
  requests[0].resolve(body({ paths }));
  assert.deepEqual(await bootstrap, paths);
  const selected = await tiles;
  assert.deepEqual(selected, regions.map((r) => selectDeliveredGeometry(paths, r)));
  assert.strictEqual(selected[0][0], paths[0]);
  assert.strictEqual(selected[1][0], paths[2]);
});

test("out-of-band and foreign-source requests start while bootstrap is pending", async () => {
  const { broker, requests } = fixture();
  const bootstrap = broker.loadBootstrap("a", region(-16, -16, 100, 100));
  const outside = broker.load("a", region(200, 200));
  const foreign = broker.load("b", region());
  assert.equal(requests.length, 3);
  requests[1].resolve(body({ paths: [] })); requests[2].resolve(body({ paths: [] }));
  await Promise.all([outside, foreign]);
  requests[0].resolve(body({ paths })); await bootstrap;
});

test("mixed tile batches request only uncovered regions without waiting for bootstrap", async () => {
  const { broker, requests } = fixture();
  const bootstrap = broker.loadBootstrap("a", region(-16, -16, 100, 100));
  const regions = [region(), region(200, 200), region(20, 20)];
  const batch = broker.loadBatch("a", regions);
  assert.equal(requests.length, 2);
  const sent = JSON.parse(new URL(requests[1].input, "http://local").searchParams.get("regions"));
  assert.deepEqual(sent, [regions[1]]);
  requests[1].resolve(body({ paths: [], regions: [[]] }));
  requests[0].resolve(body({ paths })); await bootstrap;
  assert.deepEqual(await batch, [paths.slice(0, 2), [], paths.slice(2)]);
});

test("bootstrap and evicted contained consumers reject together and can retry", async () => {
  const { broker, requests } = fixture({ cacheLimit: 1 });
  const coverage = region(-16, -16, 100, 100);
  const bootstrap = broker.loadBootstrap("a", coverage);
  const first = broker.load("a", region());
  const second = broker.load("a", region(20, 20));
  const failed = [bootstrap, first, second].map((waiting) => assert.rejects(waiting, /503/));
  assert.equal(requests.length, 1);
  requests[0].resolve({ ok: false, status: 503 }); await Promise.all(failed);
  assert.equal(broker.cacheSize, 0);
  const retry = broker.loadBootstrap("a", coverage);
  const tile = broker.load("a", region());
  assert.equal(requests.length, 2);
  requests[1].resolve(body({ paths }));
  await retry; assert.deepEqual(await tile, paths.slice(0, 2));
});

test("bootstrap transient retry retains attached contained consumers", async () => {
  const { broker, requests } = fixture();
  const coverage = region(-16, -16, 100, 100);
  const bootstrap = broker.loadBootstrap("a", coverage);
  const tile = broker.load("a", region());
  requests[0].reject(new TypeError("temporary offline")); await tick();
  assert.equal(requests.length, 2);
  assert.equal(requests[1].input, requests[0].input);
  requests[1].resolve(body({ paths }));
  await bootstrap; assert.deepEqual(await tile, paths.slice(0, 2));
});

test("evicting pending bootstrap and tiles cannot orphan their successful deliveries", async () => {
  const { broker, requests } = fixture({ cacheLimit: 1 });
  const bootstrap = broker.loadBootstrap("a", region(-16, -16, 100, 100));
  const first = broker.load("a", region());
  const second = broker.load("a", region(20, 20));
  const outside = broker.load("b", region());
  assert.equal(requests.length, 2);
  requests[0].resolve(body({ paths }));
  requests[1].resolve(body({ paths: [] }));
  await Promise.all([bootstrap, outside]);
  assert.deepEqual(await first, paths.slice(0, 2));
  assert.deepEqual(await second, paths.slice(2));
  assert.equal(broker.cacheSize, 1);
});

test("pending interaction coverage never holds critical tiles or bootstrap", async () => {
  const { broker, requests } = fixture();
  const interaction = broker.load("a", region(-100, -100, 500, 500));
  const tile = broker.load("a", region());
  assert.equal(requests.length, 2, "ordinary pending coverage is not reused");
  const bootstrap = broker.loadBootstrap("a", region(-16, -16, 100, 100));
  const laterTile = broker.load("a", region(20, 20));
  assert.equal(requests.length, 3, "only the explicit bootstrap holds its contained tile");
  requests[2].resolve(body({ paths }));
  await bootstrap;
  assert.deepEqual(await tile, paths.slice(0, 2));
  assert.deepEqual(await laterTile, paths.slice(2));
  assert.equal(requests[1].signal.aborted, true);
  assert.equal(requests[0].signal.aborted, false);
  requests[0].resolve(body({ paths })); await interaction;
});
