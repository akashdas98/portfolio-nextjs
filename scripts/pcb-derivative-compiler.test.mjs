import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  compilePcbDerivatives,
  MAX_PCB_DERIVATIVE_CSS_DIMENSION,
} from "./pcb-derivative-compiler.mjs";

const COMPILER_DIGEST = "a".repeat(64);

function pathTag(index, x = index * 10) {
  const paint = index % 3 === 0 ? "black" : "white";
  return `<path class="pcb-lens-geometry" data-source-kinds="fixture-${index}" fill="${paint}" stroke="none" d="M${x} 0H${x + 4}V4H${x}Z"/>`;
}

function lensFixture() {
  const paths = Array.from({ length: 100 }, (_, index) => pathTag(index));
  return {
    paths,
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 100" data-schema="pcb-art-lens-svg" data-schema-version="1.0" data-source-schema="pcb-art-semantic-svg">${paths.join("\n")}</svg>`,
  };
}

function input(source) {
  return {
    source,
    sourceLabel: "fixture/lens.svg",
    compilerSha256: COMPILER_DIGEST,
    expectedCompositionKey: "fixture-28x8-v1",
    selectionReserveCssPx: 2,
    composition: {
      schemaVersion: 1,
      compositionKey: "fixture-28x8-v1",
      canvas: { x: 8, y: 18, width: 28, height: 8 },
      layout: { scale: 0.5, offsetX: 10, offsetY: 20 },
      cells: [{ id: "ordered-region", x: 8, y: 18, width: 28, height: 8, empty: false }],
      toneIntervals: [
        { top: 18, bottom: 22, tone: "base" },
        { top: 22, bottom: 26, tone: "muted" },
      ],
    },
  };
}

function digest(source) {
  return createHash("sha256").update(source).digest("hex");
}

test("compiler output is deterministic and preserves selected source path strings and order", () => {
  const fixture = lensFixture();
  const first = compilePcbDerivatives(input(fixture.source));
  const second = compilePcbDerivatives(input(fixture.source));

  assert.equal(first.manifestSource, second.manifestSource);
  assert.equal(first.artifacts[0].source, second.artifacts[0].source);
  assert.equal(first.manifestSha256, digest(first.manifestSource));
  assert.match(first.manifestFilename, new RegExp(`^manifest\\.${first.manifestSha256.slice(0, 20)}\\.json$`));

  const artifact = first.artifacts[0];
  const emittedPaths = [...artifact.source.matchAll(/<path\b[^>]*\/>/g)].map((match) => match[0]);
  const selectedPaths = artifact.sourcePathIndices.map((index) => fixture.paths[index]);
  for (const selected of selectedPaths) {
    assert.equal(emittedPaths.filter((emitted) => emitted === selected).length, 2);
  }
  assert.deepEqual(artifact.sourcePathIndices, [...artifact.sourcePathIndices].sort((a, b) => a - b));
  assert.ok(emittedPaths.some((source) => source.includes('fill="white"')));
  assert.ok(emittedPaths.some((source) => source.includes('fill="black"')));
});

test("selection reserve is converted from CSS pixels into source coordinates", () => {
  const fixture = lensFixture();
  const compilation = compilePcbDerivatives(input(fixture.source));
  assert.deepEqual(compilation.artifacts[0].sourceQueryBounds, {
    left: -8,
    top: -8,
    right: 56,
    bottom: 16,
  });
  assert.match(compilation.artifacts[0].source, /transform="translate\(2 2\) scale\(0\.5\)"/);

  const oversized = input(fixture.source);
  oversized.composition.canvas.width = MAX_PCB_DERIVATIVE_CSS_DIMENSION + 1;
  oversized.composition.cells[0].width = MAX_PCB_DERIVATIVE_CSS_DIMENSION + 1;
  assert.throws(() => compilePcbDerivatives(oversized), /at most 512/);
});

test("composition identity, coverage, explicit empty cells, and final paint order fail closed", () => {
  const fixture = lensFixture();
  const mismatched = input(fixture.source);
  mismatched.expectedCompositionKey = "fixture-28x8-v2";
  assert.throws(() => compilePcbDerivatives(mismatched), /Unexpected PCB composition key/);

  const gap = input(fixture.source);
  gap.composition.cells[0].width = 27;
  assert.throws(() => compilePcbDerivatives(gap), /completely cover/);

  const compilation = compilePcbDerivatives(input(fixture.source));
  const svg = compilation.artifacts[0].source;
  assert.ok(svg.indexOf('data-layer="depth"') < svg.indexOf('data-layer="main"'));
  assert.match(svg, /id="main-cutouts"/);
  assert.match(svg, /<g data-layer="main" class="pcb-static-main" mask="url\(#main-cutouts\)"><g transform="/);
  assert.doesNotMatch(svg, /data-layer="main"[^>]*mask="url\(#main-cutouts\)"[^>]*transform=/);
  assert.match(svg, /offset="0\.5" stop-color="#0f1115"\/><stop offset="0\.5" stop-color="#090d11"/);

  const withEmptyCell = input(fixture.source);
  withEmptyCell.expectedCompositionKey = "fixture-28x16-v1";
  withEmptyCell.composition.compositionKey = "fixture-28x16-v1";
  withEmptyCell.composition.canvas.height = 16;
  withEmptyCell.composition.cells.push({
    id: "declared-empty", x: 8, y: 26, width: 28, height: 8, empty: true,
  });
  withEmptyCell.composition.toneIntervals = [
    { top: 18, bottom: 26, tone: "base" },
    { top: 26, bottom: 34, tone: "muted" },
  ];
  const emptyCompilation = compilePcbDerivatives(withEmptyCell);
  assert.equal(emptyCompilation.artifacts.length, 1);
  assert.deepEqual(
    emptyCompilation.manifest.derivatives.map(({ id, empty, filename }) => ({ id, empty, filename })),
    [
      { id: "ordered-region", empty: false, filename: emptyCompilation.artifacts[0].filename },
      { id: "declared-empty", empty: true, filename: null },
    ],
  );
});

test("CLI writes byte-identical hashed outputs for identical inputs", async () => {
  const fixture = lensFixture();
  const root = await mkdtemp(path.join(tmpdir(), "pcb-derivative-test-"));
  const sourceFilename = path.join(root, "lens.svg");
  const configFilename = path.join(root, "regions.json");
  const firstOutput = path.join(root, "first");
  const secondOutput = path.join(root, "second");
  await writeFile(sourceFilename, fixture.source, "utf8");
  const config = input(fixture.source);
  delete config.source;
  delete config.compilerSha256;
  await writeFile(configFilename, JSON.stringify(config), "utf8");

  const cli = path.resolve("scripts/compile-pcb-derivatives.mjs");
  const run = (output) => spawnSync(process.execPath, [
    "--experimental-strip-types",
    cli,
    sourceFilename,
    configFilename,
    output,
  ], { encoding: "utf8" });
  const first = run(firstOutput);
  const second = run(secondOutput);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(first.stdout, second.stdout);

  const firstFiles = (await readdir(firstOutput)).sort();
  const secondFiles = (await readdir(secondOutput)).sort();
  assert.deepEqual(firstFiles, secondFiles);
  for (const filename of firstFiles) {
    assert.equal(
      await readFile(path.join(firstOutput, filename), "utf8"),
      await readFile(path.join(secondOutput, filename), "utf8"),
    );
  }

  const report = JSON.parse(first.stdout);
  const manifestSource = await readFile(path.join(firstOutput, report.manifest), "utf8");
  const manifest = JSON.parse(manifestSource);
  assert.equal(report.manifestSha256, digest(manifestSource));
  assert.equal(manifest.compiler.sha256.length, 64);
  const derivativeSource = await readFile(path.join(firstOutput, manifest.derivatives[0].filename), "utf8");
  assert.equal(manifest.derivatives[0].sha256, digest(derivativeSource));
});

test("CLI removes only stale generated artifacts when recompiling an output directory", async () => {
  const fixture = lensFixture();
  const root = await mkdtemp(path.join(tmpdir(), "pcb-derivative-stale-test-"));
  const sourceFilename = path.join(root, "lens.svg");
  const configFilename = path.join(root, "composition.json");
  const output = path.join(root, "output");
  const config = input(fixture.source);
  delete config.source;
  delete config.compilerSha256;
  await writeFile(sourceFilename, fixture.source, "utf8");
  await writeFile(configFilename, JSON.stringify(config), "utf8");
  await mkdir(output);
  await writeFile(path.join(output, "old-region.00000000000000000000.svg"), "stale", "utf8");
  await writeFile(path.join(output, "manifest.00000000000000000000.json"), "stale", "utf8");
  await writeFile(path.join(output, "notes.txt"), "preserve", "utf8");

  const result = spawnSync(process.execPath, [
    "--experimental-strip-types",
    path.resolve("scripts/compile-pcb-derivatives.mjs"),
    sourceFilename,
    configFilename,
    output,
  ], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);

  const report = JSON.parse(result.stdout);
  assert.deepEqual(
    (await readdir(output)).sort(),
    [report.manifest, ...report.derivatives, "notes.txt"].sort(),
  );
  assert.equal(await readFile(path.join(output, "notes.txt"), "utf8"), "preserve");
});

test("homepage representative derivative is bounded and crosses ordered source partitions", async () => {
  const provenanceFiles = [
    ["lib/pcb/spatial.ts", new URL("../lib/pcb/spatial.ts", import.meta.url)],
    ["scripts/pcb-composition-plan.mjs", new URL("./pcb-composition-plan.mjs", import.meta.url)],
    ["scripts/pcb-derivative-compiler.mjs", new URL("./pcb-derivative-compiler.mjs", import.meta.url)],
    ["scripts/compile-pcb-derivatives.mjs", new URL("./compile-pcb-derivatives.mjs", import.meta.url)],
  ];
  const [source, rawConfig, ...provenanceSources] = await Promise.all([
    readFile(new URL("../public/pcb-backgrounds/home-lens.svg", import.meta.url), "utf8"),
    readFile(new URL("./fixtures/pcb-home-derivative-regions.json", import.meta.url), "utf8"),
    ...provenanceFiles.map(([, url]) => readFile(url, "utf8")),
  ]);
  const provenanceHash = createHash("sha256");
  provenanceFiles.forEach(([filename], index) => {
    provenanceHash.update(filename);
    provenanceHash.update("\0");
    provenanceHash.update(provenanceSources[index].replace(/\r\n/g, "\n"));
    provenanceHash.update("\0");
  });
  const config = JSON.parse(rawConfig);
  const compilation = compilePcbDerivatives({
    source,
    sourceLabel: config.sourceLabel,
    compilerSha256: provenanceHash.digest("hex"),
    composition: config.composition,
    expectedCompositionKey: config.expectedCompositionKey,
    selectionReserveCssPx: config.selectionReserveCssPx,
  });
  const artifact = compilation.artifacts[0];
  assert.ok(artifact.pathCount > 1);
  assert.ok(artifact.sourcePathIndices.some((index, position, indices) =>
    position > 0 && index > indices[position - 1] + 1,
  ));
  assert.ok(artifact.source.includes('fill="white"'));
  assert.ok(artifact.source.includes('fill="black"'));
  assert.match(artifact.source, /data-schema="pcb-art-static-region-svg"/);
  assert.ok(artifact.cssBounds.width <= MAX_PCB_DERIVATIVE_CSS_DIMENSION);
  assert.ok(artifact.cssBounds.height <= MAX_PCB_DERIVATIVE_CSS_DIMENSION);

  const sourcePaths = [...source.matchAll(/<path\b[^>]*\/>/g)].map((match) => match[0]);
  const derivativePaths = [...artifact.source.matchAll(/<path\b[^>]*\/>/g)].map((match) => match[0]);
  const selectedPaths = artifact.sourcePathIndices.map((index) => sourcePaths[index]);
  for (const selected of selectedPaths) {
    assert.equal(derivativePaths.filter((emitted) => emitted === selected).length, 2);
  }

  const checkedOutput = new URL("../prototypes/pcb-derivative-compiler/home/", import.meta.url);
  const checkedFiles = (await readdir(checkedOutput)).sort();
  assert.deepEqual(checkedFiles, [artifact.filename, compilation.manifestFilename].sort());
  assert.equal(await readFile(new URL(artifact.filename, checkedOutput), "utf8"), artifact.source);
  assert.equal(
    await readFile(new URL(compilation.manifestFilename, checkedOutput), "utf8"),
    compilation.manifestSource,
  );
});
