import { readFile } from "node:fs/promises";

import { parsePcbLensSvg } from "../lib/pcb/spatial.ts";

const [sourceFile, baselineFile, sourceSuffix = "/pcb-backgrounds/home-lens.svg"] = process.argv.slice(2);
if (!sourceFile || !baselineFile) {
  throw new Error(
    "Usage: node --experimental-strip-types scripts/verify-pcb-spatial-baseline.mjs <lens.svg> <browser-baseline.json> [source-url-suffix]",
  );
}

const [source, baselineSource] = await Promise.all([
  readFile(sourceFile, "utf8"),
  readFile(baselineFile, "utf8"),
]);
const parsed = parsePcbLensSvg(source);
const baseline = JSON.parse(baselineSource);
const expected = baseline.find((entry) => entry.source.endsWith(sourceSuffix));
if (!expected || !Array.isArray(expected.bounds)) {
  throw new Error(`No browser bounds found for ${sourceSuffix}.`);
}
if (expected.bounds.length !== parsed.paths.length) {
  throw new Error(`Path count differs: browser ${expected.bounds.length}, parser ${parsed.paths.length}.`);
}

const tolerance = 0.02;
let misses = 0;
let maximumExcess = 0;
let maximumMiss = 0;
const firstMisses = [];
for (let index = 0; index < parsed.paths.length; index += 1) {
  const browser = expected.bounds[index];
  const server = parsed.paths[index];
  if (server.left > browser.left + tolerance || server.top > browser.top + tolerance ||
      server.right < browser.right - tolerance || server.bottom < browser.bottom - tolerance) {
    misses += 1;
    maximumMiss = Math.max(
      maximumMiss,
      server.left - browser.left,
      server.top - browser.top,
      browser.right - server.right,
      browser.bottom - server.bottom,
    );
    if (firstMisses.length < 3) firstMisses.push({ index, browser, server });
  }
  maximumExcess = Math.max(
    maximumExcess,
    browser.left - server.left,
    browser.top - server.top,
    server.right - browser.right,
    server.bottom - browser.bottom,
  );
}

console.log(JSON.stringify({
  paths: parsed.paths.length,
  containmentMisses: misses,
  maximumMiss,
  maximumExcess,
  firstMisses,
}));
if (misses > 0) throw new Error(`${misses} server bounds did not contain the browser baseline.`);
