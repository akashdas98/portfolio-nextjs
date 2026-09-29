import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getPcbPathBounds,
  parsePcbLensSvg,
  parsePcbRegion,
  resolvePcbSource,
  selectPcbPaths,
} from "../lib/pcb/spatial.ts";

const pathTag = (data, attributes = "") =>
  `<path class="pcb-lens-geometry" data-source-kinds="local-trace" fill="none" stroke="white" stroke-width="2"${attributes} d="${data}"/>`;

function lensFixture(firstPath, remainingPath = pathTag("M1000 1000L1010 1010")) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50000 50000" data-schema="pcb-art-lens-svg" data-schema-version="1.0" data-source-schema="pcb-art-semantic-svg">${firstPath}${Array.from({ length: 99 }, () => remainingPath).join("")}</svg>`;
}

test("path bounds support relative and repeated line commands", () => {
  assert.deepEqual(getPcbPathBounds("M10 10 l5 0 0 5 h-20 v-20"), {
    left: -5,
    top: -5,
    right: 15,
    bottom: 15,
  });
  assert.deepEqual(getPcbPathBounds("M1 2 3 4 5 6Z"), {
    left: 1,
    top: 2,
    right: 5,
    bottom: 6,
  });
});

test("cubic and quadratic control hulls include reflected smooth controls", () => {
  assert.deepEqual(getPcbPathBounds("M0 0 C10 20 20 20 30 0 S50 -20 60 0"), {
    left: 0,
    top: -20,
    right: 60,
    bottom: 20,
  });
  assert.deepEqual(getPcbPathBounds("M0 0 Q10 20 20 0 T40 0"), {
    left: 0,
    top: -20,
    right: 40,
    bottom: 20,
  });
});

test("arc bounds conservatively cover full circles, adjusted radii, and rotation", () => {
  assert.deepEqual(getPcbPathBounds("M0 0 A10 10 0 0 1 20 0"), {
    left: 0,
    top: -10,
    right: 20,
    bottom: 10,
  });
  assert.deepEqual(getPcbPathBounds("M0 0 A1 1 0 0 0 10 0"), {
    left: 0,
    top: -5,
    right: 10,
    bottom: 5,
  });

  const radius = 10 / Math.sqrt(2);
  const rotated = getPcbPathBounds(`M${-radius} ${-radius} A10 20 45 0 1 ${radius} ${radius}`);
  const extent = Math.sqrt(250);
  assert.ok(Math.abs(rotated.left + extent) < 1e-9);
  assert.ok(Math.abs(rotated.top + extent) < 1e-9);
  assert.ok(Math.abs(rotated.right - extent) < 1e-9);
  assert.ok(Math.abs(rotated.bottom - extent) < 1e-9);
});

test("lens parsing preserves exact path source and adds conservative stroke bounds", () => {
  const original = pathTag("M10 20H30", " stroke-linecap=\"square\"");
  const parsed = parsePcbLensSvg(lensFixture(original));
  assert.equal(parsed.width, 50_000);
  assert.equal(parsed.height, 50_000);
  assert.equal(parsed.paths[0].source, original);
  assert.deepEqual(
    { left: parsed.paths[0].left, top: parsed.paths[0].top, right: parsed.paths[0].right, bottom: parsed.paths[0].bottom },
    { left: 5.875, top: 15.875, right: 34.125, bottom: 24.125 },
  );
  assert.deepEqual(selectPcbPaths(parsed, { x: 5, y: 19, width: 1, height: 2 }), [parsed.paths[0]]);
  assert.equal(selectPcbPaths(parsed, { x: 4, y: 19, width: 1, height: 2 }).length, 0);

  const fillOnly = pathTag("M10 20H30").replace('fill="none" stroke="white" stroke-width="2"', 'fill="white" stroke="none"');
  const fillParsed = parsePcbLensSvg(lensFixture(fillOnly));
  assert.deepEqual(
    { left: fillParsed.paths[0].left, top: fillParsed.paths[0].top, right: fillParsed.paths[0].right, bottom: fillParsed.paths[0].bottom },
    { left: 7.875, top: 17.875, right: 32.125, bottom: 22.125 },
  );
});

test("all supported command families accept compact separators and exponents", () => {
  const bounds = getPcbPathBounds(
    "M1e1,10L20,20H25V30C25,35 30,35 30,30S35,25 40,30Q45,35 50,30T60,30A5,8 30 0 1 70,40z",
  );
  for (const value of Object.values(bounds)) assert.ok(Number.isFinite(value));
  assert.ok(bounds.left <= 10 && bounds.right >= 70 && bounds.top <= 10 && bounds.bottom >= 40);
});

test("invalid or unsupported path data rejects the whole source", () => {
  assert.throws(() => getPcbPathBounds("M0 0R10 10"), /missing parameters|Unsupported/);
  assert.throws(() => getPcbPathBounds("M0 0L10"), /missing parameters/);
  assert.throws(() => getPcbPathBounds("M0 0A10 10 0 2 0 20 0"), /flags/);
  assert.throws(() => parsePcbLensSvg(lensFixture(pathTag("M0 0Lbad"))), /malformed|missing|unsupported/i);
});

test("lens validation rejects executable, nested, transformed, and unclassified content", () => {
  assert.throws(() => parsePcbLensSvg(lensFixture(pathTag("M0 0L1 1")) + "<script/>"), /root|unsafe/i);
  assert.throws(
    () => parsePcbLensSvg(lensFixture(pathTag("M0 0L1 1", " transform=\"scale(2)\""))),
    /Unsupported SVG attribute/,
  );
  assert.throws(
    () => parsePcbLensSvg(lensFixture(pathTag("M0 0L1 1").replace("local-trace", ""))),
    /classification/,
  );
  assert.throws(
    () => parsePcbLensSvg(lensFixture(pathTag("M0 0L1 1")).replace("pcb-art-lens-svg", "other")),
    /prepared lens/,
  );
});

test("source allowlist accepts the homepage asset and configured public Storage bucket", () => {
  const configured = "https://portfolio.supabase.co";
  assert.deepEqual(resolvePcbSource("/pcb-backgrounds/home-lens.svg", ""), {
    kind: "local",
    pathname: "/pcb-backgrounds/home-lens.svg",
  });
  const valid = "https://portfolio.supabase.co/storage/v1/object/public/case-study-assets/delivery/lens-v1.svg";
  assert.deepEqual(resolvePcbSource(valid, configured), { kind: "remote", url: valid });
  for (const invalid of [
    "/pcb-backgrounds/../secret.svg",
    "https://other.supabase.co/storage/v1/object/public/case-study-assets/delivery/lens.svg",
    "https://portfolio.supabase.co/storage/v1/object/public/other/delivery/lens.svg",
    "https://user@portfolio.supabase.co/storage/v1/object/public/case-study-assets/delivery/lens.svg",
    "https://portfolio.supabase.co/storage/v1/object/public/case-study-assets/%2e%2e/lens.svg",
    "https://portfolio.supabase.co/storage/v1/object/public/case-study-assets/delivery/lens.svg?download=1",
  ]) {
    assert.throws(() => resolvePcbSource(invalid, configured), /not allowed|bucket|path/);
  }
});

test("region validation permits negative edges and full source queries but rejects abuse", () => {
  assert.deepEqual(parsePcbRegion(new URLSearchParams({ x: "-5.5", y: "-10", width: "50008", height: "50008" })), {
    x: -5.5,
    y: -10,
    width: 50_008,
    height: 50_008,
  });
  assert.throws(() => parsePcbRegion(new URLSearchParams({ x: "0", y: "0", width: "65537", height: "1" })), /dimensions/);
  assert.throws(() => parsePcbRegion(new URLSearchParams({ x: "Infinity", y: "0", width: "1", height: "1" })), /invalid/);
  const duplicate = new URLSearchParams({ x: "0", y: "0", width: "1", height: "1" });
  duplicate.append("x", "2");
  assert.throws(() => parsePcbRegion(duplicate), /one x/);
});

test("the immutable homepage lens corpus parses without altering any path source", async () => {
  const source = await readFile(new URL("../public/pcb-backgrounds/home-lens.svg", import.meta.url), "utf8");
  const parsed = parsePcbLensSvg(source);
  const originals = [...source.matchAll(/<path\b[^>]*\/>/g)].map((match) => match[0]);
  assert.equal(parsed.paths.length, originals.length);
  assert.ok(parsed.paths.length >= 100);
  assert.deepEqual(parsed.paths.map((path) => path.source), originals);
  for (const path of parsed.paths) {
    assert.ok([path.left, path.top, path.right, path.bottom].every(Number.isFinite));
    assert.ok(path.left <= path.right && path.top <= path.bottom);
  }
});
