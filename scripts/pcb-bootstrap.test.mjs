import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { HOME_PCB_SOURCE, HOME_PCB_REVISION } from "../lib/pcb/home-identity.ts";
import {
  buildPcbGeometryUrl,
  createPcbBootstrap,
  PCB_BOOTSTRAP_PADDING,
  PCB_BOOTSTRAP_SOURCE_HEIGHT,
} from "../lib/pcb/bootstrap.ts";

test("home revision identifies the actual immutable bytes and every bootstrap URL", async () => {
  const bytes = await readFile(new URL("../public/pcb-backgrounds/home-lens.svg", import.meta.url));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), HOME_PCB_REVISION);
  const query = new URL(createPcbBootstrap(HOME_PCB_SOURCE, 2400, 11789).href, "https://site.example").searchParams;
  assert.equal(query.get("v"), HOME_PCB_REVISION);
});

test("bootstrap coverage is a bounded source band with conservative edge padding", () => {
  const bootstrap = createPcbBootstrap("/pcb-backgrounds/home-lens.svg", 2400, 11789);
  assert.deepEqual(bootstrap.region, { x: -16, y: -16, width: 2432, height: 2080 });
  assert.equal(PCB_BOOTSTRAP_SOURCE_HEIGHT, 2048);
  assert.equal(PCB_BOOTSTRAP_PADDING, 16);
  assert.deepEqual(createPcbBootstrap("short", 100, 80).region,
    { x: -16, y: -16, width: 132, height: 112 });
  assert.equal(createPcbBootstrap("maximum", 50_000, 50_000).region.width, 50_032);
});

test("the single-region URL is deterministic and preserves source identity exactly", () => {
  const source = "https://storage.example/asset.0123456789abcdef0123.svg?name=a&value=b c";
  const bootstrap = createPcbBootstrap(source, 2400, 11789);
  assert.equal(bootstrap.href, buildPcbGeometryUrl(source,
    { height: 2080, width: 2432, y: -16, x: -16 }));
  const query = new URL(bootstrap.href, "https://site.example").searchParams;
  assert.deepEqual([...query.keys()], ["source", "x", "y", "width", "height"]);
  assert.equal(query.get("source"), source);
  assert.equal(query.has("regions"), false);
});

test("invalid dimensions and wire bounds fail before acquisition", () => {
  for (const dimension of [0, -1, 50_001, Infinity, NaN, "2400", null]) {
    assert.throws(() => createPcbBootstrap("source", dimension, 100), /dimensions/);
    assert.throws(() => createPcbBootstrap("source", 100, dimension), /dimensions/);
  }
  const region = { x: 0, y: 0, width: 10, height: 10 };
  for (const source of ["", null, "x".repeat(4097)]) {
    assert.throws(() => buildPcbGeometryUrl(source, region), /request/);
  }
  for (const invalid of [null, { ...region, x: 100_001 }, { ...region, y: NaN },
    { ...region, width: 0 }, { ...region, height: 65_537 }]) {
    assert.throws(() => buildPcbGeometryUrl("source", invalid), /request/);
  }
});
