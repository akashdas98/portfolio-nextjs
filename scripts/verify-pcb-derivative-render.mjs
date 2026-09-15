import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

import sharp from "sharp";

import { compilePcbDerivatives } from "./pcb-derivative-compiler.mjs";

const DPR = 4;
const SIZE = 512;
const MATTE = "#8090a0";
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const PALETTES = {
  main: { base: "#0f1115", muted: "#090d11", impact: "#0e325f" },
  depth: { base: "#1c2126", muted: "#29323a", impact: "#315686" },
};

function recolor(source, color) {
  return source.replaceAll('="white"', `="${color}"`);
}

function referenceSvg(sourcePaths, composition, { monochrome = false, positiveOnly = false } = {}) {
  const positive = sourcePaths.filter((source) => !source.includes('="black"'));
  const negative = sourcePaths.filter((source) => source.includes('="black"'));
  const { canvas, layout, toneIntervals } = composition;
  const bounds = `x="0" y="0" width="${canvas.width}" height="${canvas.height}"`;
  const definitions = [];
  const paint = [];

  for (const layer of ["depth", "main"]) {
    const depthOffset = layer === "depth" ? 1 : 0;
    const transform = `translate(${layout.offsetX - canvas.x} ${layout.offsetY - canvas.y + depthOffset}) scale(${layout.scale})`;
    if (!positiveOnly) {
      definitions.push(
        `<mask id="${layer}-reference-cutouts" ${bounds} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" style="mask-type:luminance"><rect ${bounds} fill="white"/><g transform="${transform}">${negative.join("")}</g></mask>`,
      );
    }
    toneIntervals.forEach((interval, index) => {
      const top = interval.top - canvas.y;
      const height = interval.bottom - interval.top;
      definitions.push(
        `<clipPath id="${layer}-tone-${index}" clipPathUnits="userSpaceOnUse"><rect x="0" y="${top}" width="${canvas.width}" height="${height}"/></clipPath>`,
      );
      const color = monochrome ? "#ffffff" : PALETTES[layer][interval.tone];
      const mask = positiveOnly ? "" : ` mask="url(#${layer}-reference-cutouts)"`;
      paint.push(
        `<g data-layer="${layer}" clip-path="url(#${layer}-tone-${index})"${mask}><g transform="${transform}">${positive.map((item) => recolor(item, color)).join("")}</g></g>`,
      );
    });
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}"><defs>${definitions.join("")}</defs>${paint.join("")}</svg>`;
}

function monochromeCandidate(source) {
  return source.replace(/#[0-9a-f]{6}/gi, "#ffffff");
}

async function findChrome() {
  const { access } = await import("node:fs/promises");
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
  throw new Error("Chrome/Edge was not found. Set CHROME_PATH to a Chromium executable.");
}

async function waitForFile(filename) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      const details = await stat(filename);
      if (details.size > 0) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Chromium exited without producing ${filename}.`);
}

async function renderSvg(chrome, root, name, svg, background) {
  const svgPath = path.join(root, `${name}.svg`);
  const htmlPath = path.join(root, `${name}.html`);
  const pngPath = path.join(root, `${name}.png`);
  await writeFile(svgPath, svg, "utf8");
  await writeFile(
    htmlPath,
    `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:${SIZE}px;height:${SIZE}px;overflow:hidden;background:${background}}img{display:block;width:${SIZE}px;height:${SIZE}px}</style><img src="${pathToFileURL(svgPath).href}">`,
    "utf8",
  );
  const profile = path.join(root, `profile-${name}`);
  const result = spawnSync(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--disable-extensions",
    "--hide-scrollbars",
    `--force-device-scale-factor=${DPR}`,
    `--window-size=${SIZE},${SIZE}`,
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=1000",
    `--user-data-dir=${profile}`,
    `--screenshot=${pngPath}`,
    pathToFileURL(htmlPath).href,
  ], { encoding: "utf8", timeout: 30_000 });
  assert.equal(result.status, 0, `Chromium failed for ${name}: ${result.stderr || result.stdout}`);
  await waitForFile(pngPath);
  const image = sharp(pngPath).removeAlpha();
  const metadata = await image.metadata();
  assert.equal(metadata.width, SIZE * DPR, `${name} width did not honor DPR ${DPR}`);
  assert.equal(metadata.height, SIZE * DPR, `${name} height did not honor DPR ${DPR}`);
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 3);
  return data;
}

async function renderMosaic(chrome, root, name, artifacts, monochrome) {
  const htmlPath = path.join(root, `${name}.html`);
  const pngPath = path.join(root, `${name}.png`);
  const images = [];
  for (const artifact of artifacts) {
    const svgPath = path.join(root, `${name}-${artifact.id}.svg`);
    await writeFile(svgPath, monochrome ? monochromeCandidate(artifact.source) : artifact.source, "utf8");
    images.push(`<img src="${pathToFileURL(svgPath).href}" style="left:${artifact.cssBounds.x - 448}px;top:${artifact.cssBounds.y - 2048}px;width:${artifact.cssBounds.width}px;height:${artifact.cssBounds.height}px">`);
  }
  await writeFile(
    htmlPath,
    `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:${SIZE}px;height:${SIZE}px;overflow:hidden;background:${monochrome ? "#000" : MATTE}}img{display:block;position:absolute}</style>${images.join("")}`,
    "utf8",
  );
  const result = spawnSync(chrome, [
    "--headless=new", "--disable-gpu", "--disable-extensions", "--hide-scrollbars",
    `--force-device-scale-factor=${DPR}`, `--window-size=${SIZE},${SIZE}`,
    "--run-all-compositor-stages-before-draw", "--virtual-time-budget=1000",
    `--user-data-dir=${path.join(root, `profile-${name}`)}`,
    `--screenshot=${pngPath}`, pathToFileURL(htmlPath).href,
  ], { encoding: "utf8", timeout: 30_000 });
  assert.equal(result.status, 0, `Chromium failed for ${name}: ${result.stderr || result.stdout}`);
  await waitForFile(pngPath);
  const image = sharp(pngPath).removeAlpha();
  const metadata = await image.metadata();
  assert.deepEqual([metadata.width, metadata.height], [SIZE * DPR, SIZE * DPR]);
  return (await image.raw().toBuffer({ resolveWithObject: true })).data;
}

function compareRgb(actual, expected, label) {
  assert.equal(actual.length, expected.length);
  let squared = 0;
  let overThree = 0;
  const channelDiffs = new Uint8Array(actual.length);
  let maximum = 0;
  for (let index = 0; index < actual.length; index += 1) {
    const difference = Math.abs(actual[index] - expected[index]);
    channelDiffs[index] = difference;
    squared += difference * difference;
    maximum = Math.max(maximum, difference);
    if (index % 3 === 0 && Math.max(
      difference,
      Math.abs(actual[index + 1] - expected[index + 1]),
      Math.abs(actual[index + 2] - expected[index + 2]),
    ) > 3) overThree += 1;
  }
  channelDiffs.sort();
  const p99 = channelDiffs[Math.floor(channelDiffs.length * 0.99)];
  const rmse = Math.sqrt(squared / actual.length);
  const pixelFraction = overThree / (actual.length / 3);
  assert.ok(p99 <= 2, `${label}: p99 channel difference ${p99} > 2`);
  assert.ok(rmse <= 0.5, `${label}: RGB RMSE ${rmse.toFixed(4)} > 0.5`);
  // A one-pixel antialias sample can choose opposite sides of a hard clip edge;
  // the population and RMSE bounds below keep that exception strictly local.
  assert.ok(maximum <= 32, `${label}: maximum channel difference ${maximum} > 32`);
  assert.ok(pixelFraction <= 0.0005, `${label}: ${(pixelFraction * 100).toFixed(4)}% pixels differ by >3`);
  return { maximum, p99, pixelFraction, rmse };
}

function whiteCoverage(rgb, pixel) {
  return (rgb[pixel * 3] + rgb[pixel * 3 + 1] + rgb[pixel * 3 + 2]) / (3 * 255);
}

function compareOccupancy(actual, expected, label) {
  let symmetric = 0;
  const pixels = actual.length / 3;
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    if ((whiteCoverage(actual, pixel) >= 0.125) !== (whiteCoverage(expected, pixel) >= 0.125)) symmetric += 1;
  }
  const fraction = symmetric / pixels;
  assert.ok(fraction <= 0.0002, `${label}: occupancy symmetric difference ${(fraction * 100).toFixed(4)}% > 0.02%`);
  return fraction;
}

function assertCutouts(candidateMask, referenceMask, positiveMask) {
  let cutoutPixels = 0;
  let preserved = 0;
  for (let pixel = 0; pixel < candidateMask.length / 3; pixel += 1) {
    if (whiteCoverage(positiveMask, pixel) >= 0.98 && whiteCoverage(referenceMask, pixel) <= 0.02) {
      cutoutPixels += 1;
      if (whiteCoverage(candidateMask, pixel) <= 0.02) preserved += 1;
    }
  }
  assert.ok(cutoutPixels >= 16 * DPR * DPR, `Cutout probe population is too small: ${cutoutPixels}`);
  assert.ok(preserved / cutoutPixels >= 0.995, `Only ${(preserved / cutoutPixels * 100).toFixed(3)}% of cutout cores remain empty`);
  return { cutoutPixels, preservedFraction: preserved / cutoutPixels };
}

function rgb(hex) {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
}

function assertTones(candidate, candidateMask, composition) {
  const allColors = Object.values(PALETTES).flatMap((palette) => Object.entries(palette));
  const counts = {};
  for (const interval of composition.toneIntervals) {
    const top = Math.ceil((interval.top - composition.canvas.y) * DPR) + DPR * 2;
    const bottom = Math.floor((interval.bottom - composition.canvas.y) * DPR) - DPR * 2;
    const allowed = [rgb(PALETTES.main[interval.tone]), rgb(PALETTES.depth[interval.tone])];
    let expectedCore = 0;
    let foreignCore = 0;
    let opaqueCore = 0;
    for (let y = top; y < bottom; y += 1) {
      for (let x = 0; x < SIZE * DPR; x += 1) {
        const pixel = y * SIZE * DPR + x;
        if (whiteCoverage(candidateMask, pixel) < 0.98) continue;
        opaqueCore += 1;
        const actual = [candidate[pixel * 3], candidate[pixel * 3 + 1], candidate[pixel * 3 + 2]];
        if (allowed.some((color) => color.every((value, channel) => Math.abs(value - actual[channel]) <= 1))) expectedCore += 1;
        const foreign = allColors.filter(([tone]) => tone !== interval.tone).map(([, color]) => rgb(color));
        if (foreign.some((color) => color.every((value, channel) => Math.abs(value - actual[channel]) <= 1))) {
          foreignCore += 1;
        }
      }
    }
    assert.ok(expectedCore >= 16 * DPR * DPR, `${interval.tone} tone has too few opaque probe pixels: ${expectedCore}`);
    assert.ok(
      foreignCore / opaqueCore <= 0.001,
      `${interval.tone} interval classifies ${(foreignCore / opaqueCore * 100).toFixed(4)}% of opaque cores as a foreign tone`,
    );
    counts[interval.tone] = expectedCore;
  }
  return counts;
}

function assertSeamBands(mosaicMask, referenceMask, seams) {
  const width = SIZE * DPR;
  const band = 2 * DPR;
  const reports = {};
  for (const seam of seams) {
    let mismatches = 0;
    let samples = 0;
    const center = seam.value * DPR;
    const missingByCrossAxis = new Uint8Array(width);
    for (let y = 0; y < width; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const axis = seam.axis === "x" ? x : y;
        if (Math.abs(axis - center) >= band) continue;
        const pixel = y * width + x;
        if ((whiteCoverage(mosaicMask, pixel) >= 0.125) !== (whiteCoverage(referenceMask, pixel) >= 0.125)) mismatches += 1;
        if (whiteCoverage(referenceMask, pixel) >= 0.5 && whiteCoverage(mosaicMask, pixel) < 0.125) {
          missingByCrossAxis[seam.axis === "x" ? y : x] = 1;
        }
        samples += 1;
      }
    }
    const fraction = mismatches / samples;
    let longestMissingRun = 0;
    let currentRun = 0;
    for (const missing of missingByCrossAxis) {
      currentRun = missing ? currentRun + 1 : 0;
      longestMissingRun = Math.max(longestMissingRun, currentRun);
    }
    assert.ok(fraction <= 0.002, `${seam.axis}=${seam.value} seam mismatch ${(fraction * 100).toFixed(4)}% > 0.2%`);
    assert.ok(longestMissingRun < 2 * DPR, `${seam.axis}=${seam.value} has a ${(longestMissingRun / DPR).toFixed(2)} CSS px missing run`);
    reports[`${seam.axis}${seam.value}`] = { fraction, longestMissingRunCssPx: longestMissingRun / DPR };
  }
  return reports;
}

const root = await mkdtemp(path.join(tmpdir(), "pcb-render-equivalence-"));
const chrome = await findChrome();
const source = await readFile(new URL("../public/pcb-backgrounds/home-lens.svg", import.meta.url), "utf8");
const config = JSON.parse(await readFile(new URL("./fixtures/pcb-home-derivative-regions.json", import.meta.url), "utf8"));
const sourcePaths = [...source.matchAll(/<path\b[^>]*\/>/g)].map((match) => match[0]);
assert.equal(sourcePaths.length, 754, "The independent oracle requires the complete prepared source path population.");
const checkedOutput = new URL("../prototypes/pcb-derivative-compiler/home/", import.meta.url);
const checkedFiles = await readdir(checkedOutput);
const manifestFilename = checkedFiles.find((filename) => /^manifest\.[a-f0-9]{20}\.json$/.test(filename));
const derivativeFilename = checkedFiles.find((filename) => /^home-midpage-cross-partitions\.[a-f0-9]{20}\.svg$/.test(filename));
assert.ok(manifestFilename, "The checked output must contain one hashed manifest.");
assert.ok(derivativeFilename, "The checked output must contain one hashed derivative.");
assert.equal(checkedFiles.length, 2, "The checked output must contain only its manifest and derivative.");
const checkedManifest = await readFile(new URL(manifestFilename, checkedOutput), "utf8");
const checkedDerivative = await readFile(new URL(derivativeFilename, checkedOutput), "utf8");
const compilerSha256 = JSON.parse(checkedManifest).compiler.sha256;
const compile = (composition, key) => compilePcbDerivatives({
  source,
  sourceLabel: config.sourceLabel,
  compilerSha256,
  composition,
  expectedCompositionKey: key,
  selectionReserveCssPx: config.selectionReserveCssPx,
});

const fixtureA = compile(config.composition, config.expectedCompositionKey);
assert.equal(fixtureA.manifestSource, checkedManifest, "Checked manifest is not reproducible.");
assert.equal(fixtureA.artifacts[0].source, checkedDerivative, "Checked derivative is not reproducible.");

const fixtureBComposition = {
  ...config.composition,
  compositionKey: "home-512-seam-grid-v1",
  cells: [
    { id: "seam-north-west", x: 448, y: 2048, width: 241, height: 271, empty: false },
    { id: "seam-north-east", x: 689, y: 2048, width: 271, height: 271, empty: false },
    { id: "seam-south-west", x: 448, y: 2319, width: 241, height: 241, empty: false },
    { id: "seam-south-east", x: 689, y: 2319, width: 271, height: 241, empty: false },
  ],
};
const fixtureB = compile(fixtureBComposition, fixtureBComposition.compositionKey);
assert.equal(fixtureB.artifacts.length, 4, "The seam fixture unexpectedly contains an empty cell.");

const reference = referenceSvg(sourcePaths, config.composition);
const referenceMaskSvg = referenceSvg(sourcePaths, config.composition, { monochrome: true });
const positiveMaskSvg = referenceSvg(sourcePaths, config.composition, { monochrome: true, positiveOnly: true });
const [candidateA, candidateAMask, referencePixels, referenceMask, positiveMask] = await Promise.all([
  renderSvg(chrome, root, "candidate-a", fixtureA.artifacts[0].source, MATTE),
  renderSvg(chrome, root, "candidate-a-mask", monochromeCandidate(fixtureA.artifacts[0].source), "#000"),
  renderSvg(chrome, root, "reference", reference, MATTE),
  renderSvg(chrome, root, "reference-mask", referenceMaskSvg, "#000"),
  renderSvg(chrome, root, "positive-mask", positiveMaskSvg, "#000"),
]);
const [candidateB, candidateBMask] = await Promise.all([
  renderMosaic(chrome, root, "candidate-b", fixtureB.artifacts, false),
  renderMosaic(chrome, root, "candidate-b-mask", fixtureB.artifacts, true),
]);

const report = {
  chrome,
  dpr: DPR,
  fixtureA: {
    rgb: compareRgb(candidateA, referencePixels, "fixture A vs all-source reference"),
    occupancyDifference: compareOccupancy(candidateAMask, referenceMask, "fixture A vs all-source reference"),
    cutouts: assertCutouts(candidateAMask, referenceMask, positiveMask),
    tones: assertTones(candidateA, candidateAMask, config.composition),
  },
  fixtureB: {
    rgb: compareRgb(candidateB, referencePixels, "fixture B mosaic vs all-source reference"),
    occupancyDifference: compareOccupancy(candidateBMask, referenceMask, "fixture B mosaic vs all-source reference"),
    monolithRgb: compareRgb(candidateB, candidateA, "fixture B mosaic vs fixture A monolith"),
    seamBands: assertSeamBands(candidateBMask, referenceMask, [
      { axis: "x", value: 241 },
      { axis: "y", value: 271 },
    ]),
  },
  sourcePathCount: sourcePaths.length,
  tempArtifacts: "removed after successful verification",
};
await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
console.log(JSON.stringify(report, null, 2));
