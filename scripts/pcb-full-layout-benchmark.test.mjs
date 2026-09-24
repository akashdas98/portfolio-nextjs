import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  benchmarkPcbFullLayouts,
  compressedByteLengths,
  createFullLayoutCostComposition,
  createProductionCoverLayout,
  PCB_FULL_LAYOUT_COST_SNAPSHOTS,
} from "./pcb-full-layout-benchmark.mjs";

const SOURCE_SIZE = { width: 2_400, height: 12_082.5 };

function fullSourceIndex() {
  return {
    ...SOURCE_SIZE,
    paths: [{ left: 0, top: 0, right: SOURCE_SIZE.width, bottom: SOURCE_SIZE.height }],
  };
}

function expectedCellCount(width, height) {
  return Math.ceil(width / 512) * Math.ceil(height / 512);
}

function fixtureSource() {
  const paths = Array.from(
    { length: 100 },
    (_, index) => `<path class="pcb-lens-geometry" data-source-kinds="fixture-${index}" fill="white" stroke="none" d="M0 0H1000V1000H0Z"/>`,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" data-schema="pcb-art-lens-svg" data-schema-version="1.0" data-source-schema="pcb-art-semantic-svg">${paths.join("")}</svg>`;
}

test("measured snapshots form exact bounded grids without becoming runtime breakpoints", () => {
  assert.deepEqual(
    PCB_FULL_LAYOUT_COST_SNAPSHOTS.map(({ cssWidth, cssHeight }) => [cssWidth, cssHeight]),
    [[390, 10_625], [753, 7_620], [1_425, 7_073]],
  );

  for (const snapshot of PCB_FULL_LAYOUT_COST_SNAPSHOTS) {
    const composition = createFullLayoutCostComposition(snapshot, fullSourceIndex());
    assert.equal(composition.canvas.width, snapshot.cssWidth);
    assert.equal(composition.canvas.height, snapshot.cssHeight);
    assert.equal(composition.cells.length, expectedCellCount(snapshot.cssWidth, snapshot.cssHeight));
    assert.equal(
      composition.cells.reduce((area, cell) => area + cell.width * cell.height, 0),
      snapshot.cssWidth * snapshot.cssHeight,
    );
    assert.ok(composition.cells.every((cell) =>
      cell.x >= 0 && cell.y >= 0 &&
      cell.x + cell.width <= snapshot.cssWidth &&
      cell.y + cell.height <= snapshot.cssHeight &&
      cell.width <= 512 && cell.height <= 512
    ));
    assert.deepEqual(composition.toneIntervals, [
      { top: 0, bottom: snapshot.cssHeight, tone: "base" },
    ]);
  }
});

test("snapshot mapping exactly follows the production cover transform", () => {
  for (const snapshot of PCB_FULL_LAYOUT_COST_SNAPSHOTS) {
    const layout = createProductionCoverLayout(snapshot, SOURCE_SIZE);
    const expectedScale = Math.max(
      snapshot.cssWidth / SOURCE_SIZE.width,
      snapshot.cssHeight / SOURCE_SIZE.height,
    );
    assert.equal(layout.scale, expectedScale);
    assert.equal(layout.offsetX, (snapshot.cssWidth - SOURCE_SIZE.width * expectedScale) / 2);
    assert.equal(layout.offsetY, 0);
  }

  assert.equal(createProductionCoverLayout(PCB_FULL_LAYOUT_COST_SNAPSHOTS[2], SOURCE_SIZE).offsetX, 0);
  assert.ok(createProductionCoverLayout(PCB_FULL_LAYOUT_COST_SNAPSHOTS[0], SOURCE_SIZE).offsetX < 0);
  assert.ok(createProductionCoverLayout(PCB_FULL_LAYOUT_COST_SNAPSHOTS[1], SOURCE_SIZE).offsetX < 0);
});

test("cell emptiness uses conservative source bounds before compilation", () => {
  const sourceIndex = {
    width: 1_000,
    height: 1_000,
    paths: [{ left: 10, top: 10, right: 20, bottom: 20 }],
  };
  const composition = createFullLayoutCostComposition(
    { id: "fixture-700x600", cssWidth: 700, cssHeight: 600 },
    sourceIndex,
  );

  assert.deepEqual(
    composition.cells.map(({ id, empty }) => ({ id, empty })),
    [
      { id: "row-01-column-01", empty: false },
      { id: "row-01-column-02", empty: true },
      { id: "row-02-column-01", empty: true },
      { id: "row-02-column-02", empty: true },
    ],
  );
});

test("cost report deterministically counts artifacts, bytes, and serialized path duplication", () => {
  const source = fixtureSource();
  const input = {
    source,
    sourceLabel: "fixture/lens.svg",
    compilerSha256: "a".repeat(64),
    snapshots: [{ id: "measured-600x600", cssWidth: 600, cssHeight: 600 }],
  };
  const timestamps = [0, 5, 6, 8, 9, 20];
  const first = benchmarkPcbFullLayouts({
    ...input,
    now: () => timestamps.shift(),
  });
  const secondTimestamps = [0, 5, 6, 8, 9, 20];
  const second = benchmarkPcbFullLayouts({
    ...input,
    now: () => secondTimestamps.shift(),
  });

  assert.deepEqual(first, second);
  assert.equal(first.productionContract, false);
  assert.equal(first.sourceParseMs, 5);
  assert.equal(first.layouts.length, 1);
  const layout = first.layouts[0];
  assert.equal(layout.cellCount, 4);
  assert.equal(layout.artifactCount, 4);
  assert.equal(layout.emptyCellCount, 0);
  assert.equal(layout.uniqueSelectedSourcePathCount, 100);
  assert.equal(layout.sourceCoverage, 1);
  assert.equal(layout.selectedPathReferences, 400);
  assert.equal(layout.crossCellSelectionMultiplier, 4);
  assert.equal(layout.serializedSourcePathCopies, 800);
  assert.equal(layout.sourcePathDuplicationMultiplier, 8);
  assert.equal(layout.aggregateBytes, layout.derivativeBytes + layout.manifestBytes);
  assert.equal(layout.aggregateGzipBytes, layout.derivativeGzipBytes + layout.manifestGzipBytes);
  assert.equal(layout.aggregateBrotliBytes, layout.derivativeBrotliBytes + layout.manifestBrotliBytes);
  assert.deepEqual(compressedByteLengths("<svg><path d=\"M0 0\"/></svg>"), {
    gzipBytes: 45,
    brotliBytes: 31,
  });
  assert.deepEqual(layout.timingMs, { plan: 2, compile: 11 });
  assert.equal(layout.toneModel, "single-base-cost-only");
});

test("homepage cost snapshots retain deterministic full-layout metric baselines", async () => {
  const source = await readFile(
    new URL("../public/pcb-backgrounds/home-lens.svg", import.meta.url),
    "utf8",
  );
  const report = benchmarkPcbFullLayouts({
    source,
    sourceLabel: "public/pcb-backgrounds/home-lens.svg",
    compilerSha256: "a".repeat(64),
  });

  assert.deepEqual(report.source, {
    label: "public/pcb-backgrounds/home-lens.svg",
    width: 2_400,
    height: 12_082.5,
    pathCount: 754,
    bytes: 3_199_670,
    gzipBytes: 780_267,
    brotliBytes: 586_445,
  });
  assert.deepEqual(
    report.layouts.map((layout) => ({
      size: `${layout.snapshot.cssWidth}x${layout.snapshot.cssHeight}`,
      cellCount: layout.cellCount,
      artifactCount: layout.artifactCount,
      emptyCellCount: layout.emptyCellCount,
      derivativeBytes: layout.derivativeBytes,
      manifestBytes: layout.manifestBytes,
      aggregateBytes: layout.aggregateBytes,
      derivativeGzipBytes: layout.derivativeGzipBytes,
      derivativeBrotliBytes: layout.derivativeBrotliBytes,
      manifestGzipBytes: layout.manifestGzipBytes,
      manifestBrotliBytes: layout.manifestBrotliBytes,
      aggregateGzipBytes: layout.aggregateGzipBytes,
      aggregateBrotliBytes: layout.aggregateBrotliBytes,
      uniqueSelectedSourcePathCount: layout.uniqueSelectedSourcePathCount,
      sourceCoverage: layout.sourceCoverage,
      selectedPathReferences: layout.selectedPathReferences,
      crossCellSelectionMultiplier: layout.crossCellSelectionMultiplier,
      serializedSourcePathCopies: layout.serializedSourcePathCopies,
      sourcePathDuplicationMultiplier: layout.sourcePathDuplicationMultiplier,
    })),
    [
      {
        size: "390x10625",
        cellCount: 21,
        artifactCount: 21,
        emptyCellCount: 0,
        derivativeBytes: 4_356_050,
        manifestBytes: 23_330,
        aggregateBytes: 4_379_380,
        derivativeGzipBytes: 1_086_328,
        derivativeBrotliBytes: 426_644,
        manifestGzipBytes: 3_502,
        manifestBrotliBytes: 2_828,
        aggregateGzipBytes: 1_089_830,
        aggregateBrotliBytes: 429_472,
        uniqueSelectedSourcePathCount: 254,
        sourceCoverage: 0.33687,
        selectedPathReferences: 438,
        crossCellSelectionMultiplier: 1.724409,
        serializedSourcePathCopies: 876,
        sourcePathDuplicationMultiplier: 3.448819,
      },
      {
        size: "753x7620",
        cellCount: 30,
        artifactCount: 30,
        emptyCellCount: 0,
        derivativeBytes: 8_909_514,
        manifestBytes: 36_391,
        aggregateBytes: 8_945_905,
        derivativeGzipBytes: 2_195_668,
        derivativeBrotliBytes: 848_952,
        manifestGzipBytes: 5_109,
        manifestBrotliBytes: 3_958,
        aggregateGzipBytes: 2_200_777,
        aggregateBrotliBytes: 852_910,
        uniqueSelectedSourcePathCount: 478,
        sourceCoverage: 0.633952,
        selectedPathReferences: 892,
        crossCellSelectionMultiplier: 1.866109,
        serializedSourcePathCopies: 1_784,
        sourcePathDuplicationMultiplier: 3.732218,
      },
      {
        size: "1425x7073",
        cellCount: 42,
        artifactCount: 42,
        emptyCellCount: 0,
        derivativeBytes: 13_320_400,
        manifestBytes: 53_145,
        aggregateBytes: 13_373_545,
        derivativeGzipBytes: 3_306_273,
        derivativeBrotliBytes: 1_280_843,
        manifestGzipBytes: 7_018,
        manifestBrotliBytes: 5_297,
        aggregateGzipBytes: 3_313_291,
        aggregateBrotliBytes: 1_286_140,
        uniqueSelectedSourcePathCount: 734,
        sourceCoverage: 0.973475,
        selectedPathReferences: 1_460,
        crossCellSelectionMultiplier: 1.989101,
        serializedSourcePathCopies: 2_920,
        sourcePathDuplicationMultiplier: 3.978202,
      },
    ],
  );
});
