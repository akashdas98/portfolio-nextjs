import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createTouchPreparation, publishTouchMainCanvas, waitForTouchPreparation } from "../lib/pcb/touch-preparation.ts";
import { touchGeometryCovers } from "../lib/pcb/touch-interaction.ts";
import { touchGeometryRegions } from "../lib/pcb/touch-canvas.ts";

const flush = () => new Promise((resolve) => setImmediate(resolve));

test("an obsolete unresolved network request cannot block a cached latest region", async () => {
  let finishObsolete;
  const network = new Promise((resolve) => { finishObsolete = resolve; });
  const rasterized = [];
  const published = [];
  const controller = createTouchPreparation({
    async prepare(request, isCurrent, signal) {
      const paths = await waitForTouchPreparation(
        request.key === "slow" ? network : Promise.resolve("cached paths"), signal,
      );
      assert.equal(isCurrent(), true);
      rasterized.push(paths);
      return request;
    },
    release() {},
    ready() { published.push(controller.active.key); },
  });
  controller.want({ key: "slow" });
  controller.want({ key: "cached" });
  await flush();
  assert.deepEqual(published, ["cached"], "latest publication must not wait for obsolete network completion");
  finishObsolete("obsolete paths");
  await flush();
  assert.deepEqual(rasterized, ["cached paths"]);
  assert.deepEqual(published, ["cached"]);
  controller.dispose();
});
function fixture() {
  const jobs = [];
  const released = [];
  const ready = [];
  const failed = [];
  const controller = createTouchPreparation({
    prepare(request, isCurrent) {
      return new Promise((resolve, reject) => {
        jobs.push({ request, isCurrent, resolve, reject });
      });
    },
    release: (prepared) => released.push(prepared.key),
    ready: () => ready.push(controller.active.key),
    failed: (error) => failed.push(error.message),
  });
  return { controller, jobs, released, ready, failed };
}

test("cancelled consumers neither abort shared work nor surface late rejection", async () => {
  let fail;
  const shared = new Promise((resolve, reject) => { fail = reject; });
  const cancellation = new AbortController();
  const waiting = waitForTouchPreparation(shared, cancellation.signal);
  cancellation.abort(new Error("superseded"));
  await assert.rejects(waiting, /superseded/);
  fail(new Error("late network failure"));
  await flush();
  const alreadyCancelled = new AbortController();
  alreadyCancelled.abort(new Error("disposed"));
  await assert.rejects(waitForTouchPreparation(Promise.reject(new Error("late")), alreadyCancelled.signal), /disposed/);
  await flush();
});

test("active preparation survives delay, failure, and replacement until fully ready", async () => {
  const { controller, jobs, released, ready, failed } = fixture();
  controller.want({ key: "a" });
  jobs[0].resolve({ key: "a" });
  await flush();
  controller.want({ key: "b" });
  assert.equal(controller.active.key, "a");
  assert.deepEqual(released, []);
  jobs[1].reject(new Error("decoration failed"));
  await flush();
  assert.equal(controller.active.key, "a");
  assert.deepEqual(released, []);
  assert.deepEqual(failed, ["decoration failed"]);
  controller.want({ key: "c" });
  jobs[2].resolve({ key: "c" });
  await flush();
  assert.equal(controller.active.key, "c");
  assert.deepEqual(ready, ["a", "c"]);
  assert.deepEqual(released, ["a"]);
  controller.dispose();
  assert.deepEqual(released, ["a", "c"]);
});

test("adding a tone may publish the same active region without releasing its geometry", async () => {
  const { controller, jobs, released, ready } = fixture();
  controller.want({ key: "blue" });
  jobs[0].resolve({ key: "region", tones: ["blue"] });
  await flush();
  const active = controller.active;
  controller.want({ key: "blue,pink" });
  active.tones.push("pink");
  jobs[1].resolve(active);
  await flush();
  assert.equal(controller.active, active);
  assert.deepEqual(active.tones, ["blue", "pink"]);
  assert.deepEqual(released, []);
  assert.deepEqual(ready, ["region", "region"]);
  controller.dispose();
  assert.deepEqual(released, ["region"]);
});

test("rapid crossings replace only latest intent and reject obsolete results before raster", async () => {
  const { controller, jobs, released, ready } = fixture();
  controller.want({ key: "first" });
  for (let crossing = 0; crossing < 100; crossing += 1) {
    controller.want({ key: `crossing-${crossing}` });
  }
  assert.equal(jobs.length, 1, "at most one async preparation may own resources");
  assert.equal(jobs[0].isCurrent(), false, "stale response must not enter raster/blur");
  assert.equal(controller.wanted.key, "crossing-99");
  jobs[0].resolve({ key: "first" });
  await flush();
  assert.deepEqual(released, ["first"]);
  assert.deepEqual(ready, []);
  assert.equal(jobs.length, 2);
  assert.equal(jobs[1].request.key, "crossing-99");
  jobs[1].resolve({ key: "crossing-99" });
  await flush();
  assert.equal(controller.active.key, "crossing-99");
  assert.deepEqual(ready, ["crossing-99"]);
  controller.dispose();
});

test("A/B/A intent ordering and layout reset never resurrect old asynchronous work", async () => {
  const { controller, jobs, ready, released } = fixture();
  controller.want({ key: "a" });
  controller.want({ key: "b" });
  controller.want({ key: "a" });
  assert.equal(jobs[0].isCurrent(), false, "matching keys cannot revive an obsolete epoch");
  jobs[0].resolve({ key: "a-old" });
  await flush();
  controller.reset();
  controller.want({ key: "new-layout" });
  jobs[1].resolve({ key: "a-after-reset" });
  await flush();
  jobs[2].resolve({ key: "new-layout" });
  await flush();
  assert.deepEqual(ready, ["new-layout"]);
  assert.deepEqual(released, ["a-old", "a-after-reset"]);
  controller.dispose();
});

test("returning to safe active coverage cancels queued work without releasing active", async () => {
  const { controller, jobs, ready, released } = fixture();
  controller.want({ key: "a" });
  jobs[0].resolve({ key: "a" });
  await flush();
  controller.want({ key: "b" });
  controller.want(null);
  assert.equal(jobs[1].isCurrent(), false);
  jobs[1].resolve({ key: "b" });
  await flush();
  assert.equal(controller.active.key, "a");
  assert.deepEqual(ready, ["a"]);
  assert.deepEqual(released, ["b"]);
  controller.dispose();
});

test("disposal releases late results and prevents callbacks or queued work", async () => {
  const { controller, jobs, ready, released } = fixture();
  controller.want({ key: "a" });
  controller.want({ key: "b" });
  controller.dispose();
  controller.want({ key: "c" });
  jobs[0].resolve({ key: "a" });
  await flush();
  assert.equal(controller.active, null);
  assert.equal(controller.wanted, null);
  assert.equal(controller.running, false);
  assert.equal(jobs.length, 1);
  assert.deepEqual(ready, []);
  assert.deepEqual(released, ["a"]);
});

test("wide horizontal coverage prefetches early without re-preparing a fresh region", () => {
  const layout = { renderLeft: -37, renderScale: 1.7 };
  const regionsAt = (x, y) => touchGeometryRegions({ x: layout.renderLeft + x, y }, layout, 420, 96);
  const initial = regionsAt(95, 95);
  assert.equal(Math.round((initial.region.width - initial.requiredRegion.width) * layout.renderScale), 7 * 96);
  assert.equal(Math.round((initial.region.height - initial.requiredRegion.height) * layout.renderScale), 3 * 96);
  const active = { layoutVersion: 1, region: initial.region };
  const required = (x, y) => ({ layoutVersion: 1, region: regionsAt(x, y).requiredRegion });
  assert.notEqual(initial.bucketX, regionsAt(97, 95).bucketX);
  const directionalMargin = { x: 192 / layout.renderScale, y: 64 / layout.renderScale };
  assert.equal(touchGeometryCovers(active, required(95, 95), directionalMargin), true);
  assert.equal(touchGeometryCovers(active, required(97, 95), directionalMargin), true);
  assert.equal(touchGeometryCovers(active, required(160, 95)), true);
  assert.equal(touchGeometryCovers(active, required(160, 95), directionalMargin), true);
  assert.equal(touchGeometryCovers(active, required(200, 95), directionalMargin), false);
  assert.equal(touchGeometryCovers(active, required(290, 95)), true);
  assert.equal(touchGeometryCovers(active, required(400, 95)), false);
});

test("atomic publication paints hidden back before position/show and preserves front on misses", () => {
  const events = [];
  const pixels = [null, null];
  const surfaces = [0, 1].map((index) => ({
    style: new Proxy({ visibility: "hidden", transform: "" }, {
      set(target, field, value) {
        if (field === "visibility" && value === "visible") {
          assert.ok(pixels[index], "pixels must exist before publication");
          assert.equal(target.transform, pixels[index].origin);
        }
        events.push([index, field, value]);
        target[field] = value;
        return true;
      },
    }),
  }));
  let front = publishTouchMainCanvas(surfaces, null, { x: 300, y: 500 }, 420, (back) => {
    pixels[back] = { origin: "translate3d(90px,290px,0)" };
    return true;
  });
  assert.equal(front, 0);
  const published = structuredClone({ style: { ...surfaces[0].style }, pixels: pixels[0] });
  events.splice(0);
  for (const paint of [() => false, () => { throw new Error("lost context"); }]) {
    front = publishTouchMainCanvas(surfaces, front, { x: 900, y: 1200 }, 420, paint);
    assert.equal(front, 0);
    assert.deepEqual({ style: { ...surfaces[0].style }, pixels: pixels[0] }, published);
  }
  assert.deepEqual(events, []);
  front = publishTouchMainCanvas(surfaces, front, { x: 900, y: 1200 }, 420, (back) => {
    assert.equal(surfaces[0].style.visibility, "visible");
    assert.equal(surfaces[back].style.visibility, "hidden");
    pixels[back] = { origin: "translate3d(690px,990px,0)" };
    return true;
  });
  assert.equal(front, 1);
  assert.deepEqual(events.map((event) => event.slice(0, 2)), [
    [1, "transform"], [1, "visibility"], [0, "visibility"],
  ]);
});

test("renderer keeps main publication separate from trails and bounds warm flame work", async () => {
  const source = await readFile(new URL("../components/public-circuit/TouchCanvasInteraction.tsx", import.meta.url), "utf8");
  assert.match(source, /index < 2/);
  assert.match(source, /public-circuit-touch-main\{width:420px;height:420px;visibility:hidden\}/);
  assert.match(source, /publishTouchMainCanvas\(/);
  assert.doesNotMatch(source, /const geometryCache|pendingGeometry|decoratedRegionOrder/);
  assert.match(source, /preparedCoversPrefetch\(active, request\)/);
  assert.match(source, /await createTouchGeometryMask\(paths, request, checkpoint, pathCache\)/);
  assert.match(source, /if \(pathCache\.size > 256\) pathCache\.delete/);
  assert.match(source, /pass < TOUCH_DECORATED_HALO_PASSES; pass \+= 1\) \{\s*await checkpoint\(\)/);
  assert.match(source, /performance\.now\(\) - batchStartedAt >= 4/);
  assert.match(source, /steadyEnvelopes\.get\(tone\)/);
  assert.match(source, /flameContext\.fillRect\(\s*\(flame\.x - flame\.radius\)/);
  assert.match(source, /pageElement\.append\(bitmap\)/,
    "trail bitmaps must be independently composited instead of using a tablet viewport canvas");
  assert.doesNotMatch(source, /clearRect\(0, 0, canvas\.width, canvas\.height\)/,
    "touch trails must not clear the full high-DPR viewport every frame");
  const scroll = source.slice(source.indexOf("const onScroll ="), source.indexOf("rebuildLayout();", source.indexOf("const onScroll =")));
  assert.doesNotMatch(scroll, /mainCanvases|mainFront/, "scroll must never translate stale masked main pixels");
  assert.match(source, /preparation\.dispose\(\)/);
  assert.match(source, /resumePreparation\?\.\(\)/);
  assert.match(source, /clearSteadyEnvelopes\(\)/);
  assert.match(source, /for \(const trail of trails\.splice\(0\)\) trail\.bitmap\.remove\(\)/,
    "layout rebuild must release old composited trail layers");
});
