import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { gzipSync } from "node:zlib";
import test from "node:test";

import { createPcbIndexLoader, PCB_INDEX_CHUNK_CHARACTERS } from "../lib/pcb/persistent-index.ts";
import { parsePcbLensSvg, selectPcbPaths, selectPcbPathBatch } from "../lib/pcb/spatial.ts";

function fixture() {
  const entries = new Map();
  const pending = new Map();
  const writes = [];
  let invalidations = 0;
  const cache = {
    async getOrCreate(key, tag, create) {
      if (entries.has(key)) return structuredClone(entries.get(key).value);
      if (pending.has(key)) return pending.get(key);
      const promise = Promise.resolve().then(create).then((value) => {
        const serialized = JSON.stringify(value);
        assert.ok(Buffer.byteLength(serialized) < 2 * 1024 * 1024, "every actual serialized cache entry fits Next's ceiling");
        writes.push(key);
        entries.set(key, { tag, value: JSON.parse(serialized) });
        return value;
      }).finally(() => pending.delete(key));
      pending.set(key, promise);
      return promise;
    },
    invalidate(tag) {
      invalidations += 1;
      for (const [key, entry] of entries) if (entry.tag === tag) entries.delete(key);
    },
  };
  return { cache, entries, writes, get invalidations() { return invalidations; } };
}

function indexFixture() {
  const path = (d) => `<path class="pcb-lens-geometry" data-source-kinds="local-trace" fill="none" stroke="white" stroke-width="2" d="${d}"/>`;
  // Unicode whitespace is valid SVG whitespace and must survive byte-for-byte.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2400 12000" data-schema="pcb-art-lens-svg" data-schema-version="1.0" data-source-schema="pcb-art-semantic-svg">${Array.from({ length: 100 }, (_, i) => path(`M${i}\u2003${i}L${i + 50} ${i + 60}`)).join("")}</svg>`;
  return parsePcbLensSvg(svg);
}

let largeIndex;
function largeFixture() {
  // A single incompressible path representation crosses cache chunks. Splitting
  // paths instead would reproduce the same oversized-item bug for this input.
  return largeIndex ??= {
    ...indexFixture(),
    paths: indexFixture().paths.map((path, index) => index ? path : {
      ...path, source: randomBytes(2_000_000).toString("base64") + "\u2003é",
    }),
  };
}

test("a fresh process-equivalent loader reuses one persisted compressed index with exact geometry, Unicode and order", async () => {
  const f = fixture();
  const original = indexFixture();
  let derivations = 0;
  const cold = await createPcbIndexLoader(f.cache).load("immutable-a", async () => { derivations += 1; return original; }, true);
  const fresh = await createPcbIndexLoader(f.cache).load("immutable-a", async () => { throw Error("Storage and parser must not run on a persistent hit"); }, true);
  assert.equal(derivations, 1);
  assert.deepEqual(cold, original);
  assert.deepEqual(fresh, original);
  assert.equal(f.entries.size, 1, "small compressed indexes stay in one bounded entry");
  const regions = [{ x: -2, y: 0, width: 50, height: 70 }, { x: 80, y: 80, width: 70, height: 80 }];
  assert.deepEqual(selectPcbPathBatch(fresh, regions), selectPcbPathBatch(original, regions));
  regions.forEach((region) => assert.deepEqual(selectPcbPaths(fresh, region), selectPcbPaths(original, region)));
});

test("large single paths are encoded across bounded chunks, published before their manifest and reused without derivation", async () => {
  const f = fixture();
  const original = largeFixture();
  await createPcbIndexLoader(f.cache).load("large", async () => original, true);
  const manifest = [...f.entries.entries()].find(([key]) => key.endsWith(":manifest"));
  assert.ok(manifest[1].value.chunks >= 3);
  assert.equal(f.writes.at(-1), manifest[0]);
  for (const [key, entry] of f.entries) if (!key.endsWith(":manifest")) assert.ok(entry.value.length <= PCB_INDEX_CHUNK_CHARACTERS);
  const restored = await createPcbIndexLoader(f.cache).load("large", async () => { throw Error("unexpected fetch"); }, true);
  assert.deepEqual(restored, original);
});

test("a missing chunk is rebuilt once for concurrent callers without discarding good persisted chunks", async () => {
  const f = fixture();
  await createPcbIndexLoader(f.cache).load("large", async () => largeFixture(), true);
  const chunkKeys = [...f.entries.keys()].filter((key) => !key.endsWith(":manifest"));
  f.entries.delete(chunkKeys[0]);
  f.entries.delete(chunkKeys[1]);
  let derivations = 0;
  const loader = createPcbIndexLoader(f.cache);
  const derive = async () => { derivations += 1; await new Promise((resolve) => setImmediate(resolve)); return largeFixture(); };
  const results = await Promise.all(Array.from({ length: 12 }, () => loader.load("large", derive, true)));
  assert.equal(derivations, 1);
  assert.equal(f.invalidations, 0);
  results.forEach((result) => assert.deepEqual(result, largeFixture()));
});

test("an interrupted chunk write cannot publish a manifest; a fresh loader recovers partial persistence", async () => {
  const f = fixture();
  let fail = true;
  const interrupted = {
    ...f.cache,
    getOrCreate(key, tag, create) {
      if (fail && key.endsWith(":1")) throw Error("chunk write interrupted");
      return f.cache.getOrCreate(key, tag, create);
    },
  };
  assert.deepEqual(await createPcbIndexLoader(interrupted).load("large", async () => largeFixture(), true), largeFixture());
  assert.equal([...f.entries.keys()].some((key) => key.endsWith(":manifest")), false);
  fail = false;
  assert.deepEqual(await createPcbIndexLoader(interrupted).load("large", async () => largeFixture(), true), largeFixture());
  assert.equal([...f.entries.keys()].some((key) => key.endsWith(":manifest")), true);
  assert.deepEqual(await createPcbIndexLoader(f.cache).load("large", async () => { throw Error("unexpected source read"); }, true), largeFixture());
});

test("corrupt manifests, gzip bodies, digests and chunks repair once from the authorized parser", async () => {
  for (const corruption of ["manifest", "gzip", "digest", "chunk"]) {
    const f = fixture();
    const original = corruption === "chunk" ? largeFixture() : indexFixture();
    await createPcbIndexLoader(f.cache).load("source", async () => original, true);
    const manifest = [...f.entries.entries()].find(([key]) => key.endsWith(":manifest"))[1].value;
    if (corruption === "manifest") manifest.source = "wrong-source";
    if (corruption === "gzip") manifest.inline = "x".repeat(manifest.encodedCharacters);
    if (corruption === "digest") manifest.digest = "0".repeat(64);
    if (corruption === "chunk") [...f.entries.entries()].find(([key]) => !key.endsWith(":manifest"))[1].value = "invalid";
    let derivations = 0;
    const restored = await createPcbIndexLoader(f.cache).load("source", async () => { derivations += 1; return original; }, true);
    assert.deepEqual(restored, original, corruption);
    assert.equal(derivations, 1, corruption);
    assert.equal(f.invalidations, 1, corruption);
  }
});

test("evicted chunks plus changed bytes at one immutable URL never combine old and new source versions", async () => {
  const f = fixture();
  const original = largeFixture();
  await createPcbIndexLoader(f.cache).load("source", async () => original, true);
  const key = [...f.entries.keys()].find((candidate) => !candidate.endsWith(":manifest"));
  f.entries.delete(key);
  const replacement = { ...original, paths: original.paths.map((path, index) => index ? path : { ...path, source: path.source + "replacement" }) };
  let derivations = 0;
  const result = await createPcbIndexLoader(f.cache).load("source", async () => { derivations += 1; return replacement; }, true);
  assert.deepEqual(result, replacement);
  assert.equal(derivations, 1);
  assert.equal(f.invalidations, 1);
});

test("a malformed decoded index is rejected even with a matching content digest", async () => {
  const f = fixture();
  await createPcbIndexLoader(f.cache).load("source", async () => indexFixture(), true);
  const manifest = [...f.entries.values()][0].value;
  const bytes = Buffer.from(JSON.stringify({ width: 1, height: 2, paths: [] }));
  const { createHash } = await import("node:crypto");
  manifest.inline = gzipSync(bytes).toString("base64");
  manifest.bytes = bytes.length;
  manifest.encodedCharacters = manifest.inline.length;
  manifest.digest = createHash("sha256").update(bytes).digest("hex");
  assert.deepEqual(await createPcbIndexLoader(f.cache).load("source", async () => indexFixture(), true), indexFixture());
  assert.equal(f.invalidations, 1);
});

test("network/parser failures are evicted, and cache-backend failure still serves one validated source result", async () => {
  const f = fixture();
  const loader = createPcbIndexLoader(f.cache);
  let attempts = 0;
  const derive = async () => { if (++attempts === 1) throw Error("source unavailable"); return indexFixture(); };
  await assert.rejects(loader.load("source", derive, true), /source unavailable/);
  assert.equal(loader.memorySize, 0);
  assert.deepEqual(await loader.load("source", derive, true), indexFixture());
  assert.equal(attempts, 2);
  let fallbackCalls = 0;
  const failing = createPcbIndexLoader({ getOrCreate: async () => { throw Error("cache backend unavailable"); }, invalidate() {} });
  assert.deepEqual(await failing.load("source", async () => { fallbackCalls += 1; return indexFixture(); }, true), indexFixture());
  assert.equal(fallbackCalls, 1);
});

test("nonpersistent reads do not touch Next cache and the process promise cache remains bounded", async () => {
  const f = fixture();
  const loader = createPcbIndexLoader(f.cache, { memoryLimit: 2 });
  let calls = 0;
  const derive = async () => { calls += 1; return indexFixture(); };
  const first = loader.load("local-a", derive, false);
  assert.strictEqual(first, loader.load("local-a", derive, false));
  await first;
  await loader.load("local-b", derive, false);
  await loader.load("local-c", derive, false);
  assert.equal(loader.memorySize, 2);
  await loader.load("local-a", derive, false);
  assert.equal(calls, 4);
  assert.equal(f.entries.size, 0);
});
