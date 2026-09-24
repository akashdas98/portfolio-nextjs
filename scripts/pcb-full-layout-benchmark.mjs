import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  brotliCompressSync,
  constants as zlibConstants,
  gzipSync,
} from "node:zlib";

const {
  BROTLI_MODE_GENERIC,
  BROTLI_PARAM_MODE,
  BROTLI_PARAM_QUALITY,
} = zlibConstants;

import { parsePcbLensSvg } from "../lib/pcb/spatial.ts";
import {
  compilePcbDerivatives,
  MAX_PCB_DERIVATIVE_CSS_DIMENSION,
} from "./pcb-derivative-compiler.mjs";

export const PCB_FULL_LAYOUT_COST_SNAPSHOTS = Object.freeze([
  Object.freeze({ id: "measured-390x10625", cssWidth: 390, cssHeight: 10_625 }),
  Object.freeze({ id: "measured-753x7620", cssWidth: 753, cssHeight: 7_620 }),
  Object.freeze({ id: "measured-1425x7073", cssWidth: 1_425, cssHeight: 7_073 }),
]);

export const PCB_COST_BENCHMARK_SELECTION_RESERVE_CSS_PX = 2;

// These settings make the reported transfer sizes stable across benchmark runs.
// Each derivative and the manifest represent separate HTTP responses, so their
// compressed byte lengths are intentionally summed rather than concatenated.
export const PCB_BENCHMARK_GZIP_OPTIONS = Object.freeze({ level: 9, mtime: 0 });
export const PCB_BENCHMARK_BROTLI_OPTIONS = Object.freeze({
  params: Object.freeze({
    [BROTLI_PARAM_MODE]: BROTLI_MODE_GENERIC,
    [BROTLI_PARAM_QUALITY]: 11,
  }),
});

const SOURCE_FILENAME = "public/pcb-backgrounds/home-lens.svg";
const EXPECTED_SOURCE_WIDTH = 2_400;
const EXPECTED_SOURCE_HEIGHT = 12_082.5;
const PROVENANCE_FILES = [
  "lib/pcb/spatial.ts",
  "scripts/pcb-composition-plan.mjs",
  "scripts/pcb-derivative-compiler.mjs",
  "scripts/pcb-full-layout-benchmark.mjs",
];

function positiveNumber(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive finite number.`);
  }
  return value;
}

function intersects(first, second) {
  return first.right >= second.left && first.left <= second.right &&
    first.bottom >= second.top && first.top <= second.bottom;
}

function sourceQueryBounds(cell, layout, selectionReserveCssPx) {
  return {
    left: (cell.x - layout.offsetX - selectionReserveCssPx) / layout.scale,
    top: (cell.y - layout.offsetY - selectionReserveCssPx) / layout.scale,
    right: (cell.x + cell.width - layout.offsetX + selectionReserveCssPx) / layout.scale,
    bottom: (cell.y + cell.height - layout.offsetY + selectionReserveCssPx) / layout.scale,
  };
}

function roundMetric(value) {
  return Number(value.toFixed(6));
}

function utf8Bytes(value) {
  return new TextEncoder().encode(value);
}

export function compressedByteLengths(value) {
  const bytes = Buffer.from(utf8Bytes(value));
  return {
    gzipBytes: gzipSync(bytes, PCB_BENCHMARK_GZIP_OPTIONS).byteLength,
    brotliBytes: brotliCompressSync(bytes, PCB_BENCHMARK_BROTLI_OPTIONS).byteLength,
  };
}

export function createProductionCoverLayout(canvas, source) {
  const canvasWidth = positiveNumber(canvas.cssWidth, "Canvas width");
  const canvasHeight = positiveNumber(canvas.cssHeight, "Canvas height");
  const sourceWidth = positiveNumber(source.width, "Source width");
  const sourceHeight = positiveNumber(source.height, "Source height");
  const scale = Math.max(canvasWidth / sourceWidth, canvasHeight / sourceHeight);

  return {
    scale,
    offsetX: (canvasWidth - sourceWidth * scale) / 2,
    offsetY: 0,
  };
}

export function createFullLayoutCostComposition(
  snapshot,
  sourceIndex,
  {
    selectionReserveCssPx = PCB_COST_BENCHMARK_SELECTION_RESERVE_CSS_PX,
    tileSize = MAX_PCB_DERIVATIVE_CSS_DIMENSION,
  } = {},
) {
  if (!snapshot || typeof snapshot !== "object") {
    throw new Error("A measured layout snapshot is required.");
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(snapshot.id)) {
    throw new Error("The measured layout snapshot requires a stable lowercase id.");
  }
  const width = positiveNumber(snapshot.cssWidth, "Snapshot CSS width");
  const height = positiveNumber(snapshot.cssHeight, "Snapshot CSS height");
  positiveNumber(tileSize, "Tile size");
  if (tileSize > MAX_PCB_DERIVATIVE_CSS_DIMENSION) {
    throw new Error(`Tile size must be at most ${MAX_PCB_DERIVATIVE_CSS_DIMENSION} CSS px.`);
  }
  if (!Number.isFinite(selectionReserveCssPx) || selectionReserveCssPx < 0) {
    throw new Error("Selection reserve must be a non-negative finite number.");
  }
  if (!sourceIndex || !Array.isArray(sourceIndex.paths)) {
    throw new Error("A parsed PCB source index is required.");
  }

  const layout = createProductionCoverLayout(
    { cssWidth: width, cssHeight: height },
    { width: sourceIndex.width, height: sourceIndex.height },
  );
  const cells = [];
  let row = 0;
  for (let y = 0; y < height; y += tileSize, row += 1) {
    let column = 0;
    for (let x = 0; x < width; x += tileSize, column += 1) {
      const cell = {
        id: `row-${String(row + 1).padStart(2, "0")}-column-${String(column + 1).padStart(2, "0")}`,
        x,
        y,
        width: Math.min(tileSize, width - x),
        height: Math.min(tileSize, height - y),
        empty: false,
      };
      const query = sourceQueryBounds(cell, layout, selectionReserveCssPx);
      cell.empty = !sourceIndex.paths.some((candidate) => intersects(candidate, query));
      cells.push(cell);
    }
  }

  return {
    schemaVersion: 1,
    compositionKey: `home-cost-snapshot-${width}x${height}-v1`,
    canvas: { x: 0, y: 0, width, height },
    layout,
    cells,
    // Exact live section boundaries were not retained with these measurements.
    // One base interval keeps this benchmark honest and cost-focused: it exercises
    // full-height gradient generation without pretending to validate tone fidelity.
    toneIntervals: [{ top: 0, bottom: height, tone: "base" }],
  };
}

export function summarizePcbCostCompilation(compilation) {
  const derivatives = compilation.manifest.derivatives;
  const selectedSourcePaths = new Set(
    derivatives.flatMap((derivative) => derivative.sourcePathIndices),
  );
  const selectedPathReferences = derivatives.reduce(
    (sum, derivative) => sum + derivative.pathCount,
    0,
  );
  const serializedSourcePathCopies = compilation.artifacts.reduce(
    (sum, artifact) => sum + [...artifact.source.matchAll(/<path\b/g)].length,
    0,
  );
  const derivativeBytes = derivatives.reduce(
    (sum, derivative) => sum + derivative.bytes,
    0,
  );
  const manifestBytes = new TextEncoder().encode(compilation.manifestSource).byteLength;
  const derivativeCompression = derivatives.reduce(
    (totals, derivative, index) => {
      const compressed = compressedByteLengths(compilation.artifacts[index].source);
      return {
        gzipBytes: totals.gzipBytes + compressed.gzipBytes,
        brotliBytes: totals.brotliBytes + compressed.brotliBytes,
      };
    },
    { gzipBytes: 0, brotliBytes: 0 },
  );
  const manifestCompression = compressedByteLengths(compilation.manifestSource);
  const uniqueSelectedSourcePathCount = selectedSourcePaths.size;

  return {
    cellCount: derivatives.length,
    artifactCount: compilation.artifacts.length,
    emptyCellCount: derivatives.filter((derivative) => derivative.empty).length,
    derivativeBytes,
    manifestBytes,
    aggregateBytes: derivativeBytes + manifestBytes,
    derivativeGzipBytes: derivativeCompression.gzipBytes,
    derivativeBrotliBytes: derivativeCompression.brotliBytes,
    manifestGzipBytes: manifestCompression.gzipBytes,
    manifestBrotliBytes: manifestCompression.brotliBytes,
    aggregateGzipBytes: derivativeCompression.gzipBytes + manifestCompression.gzipBytes,
    aggregateBrotliBytes: derivativeCompression.brotliBytes + manifestCompression.brotliBytes,
    sourcePathCount: compilation.manifest.source.pathCount,
    uniqueSelectedSourcePathCount,
    sourceCoverage: compilation.manifest.source.pathCount === 0
      ? 0
      : roundMetric(uniqueSelectedSourcePathCount / compilation.manifest.source.pathCount),
    selectedPathReferences,
    crossCellSelectionMultiplier: uniqueSelectedSourcePathCount === 0
      ? 0
      : roundMetric(selectedPathReferences / uniqueSelectedSourcePathCount),
    serializedSourcePathCopies,
    sourcePathDuplicationMultiplier: uniqueSelectedSourcePathCount === 0
      ? 0
      : roundMetric(serializedSourcePathCopies / uniqueSelectedSourcePathCount),
  };
}

export function benchmarkPcbFullLayouts({
  source,
  sourceLabel,
  compilerSha256,
  snapshots = PCB_FULL_LAYOUT_COST_SNAPSHOTS,
  selectionReserveCssPx = PCB_COST_BENCHMARK_SELECTION_RESERVE_CSS_PX,
  compile = compilePcbDerivatives,
  now = () => performance.now(),
}) {
  const parseStartedAt = now();
  const sourceIndex = parsePcbLensSvg(source);
  const sourceParseMs = roundMetric(now() - parseStartedAt);
  const layouts = snapshots.map((snapshot) => {
    const planStartedAt = now();
    const composition = createFullLayoutCostComposition(snapshot, sourceIndex, {
      selectionReserveCssPx,
    });
    const planMs = roundMetric(now() - planStartedAt);
    const compileStartedAt = now();
    const compilation = compile({
      source,
      sourceLabel,
      compilerSha256,
      composition,
      expectedCompositionKey: composition.compositionKey,
      selectionReserveCssPx,
    });
    const compileMs = roundMetric(now() - compileStartedAt);

    return {
      snapshot: { ...snapshot },
      mapping: { ...composition.layout },
      toneModel: "single-base-cost-only",
      ...summarizePcbCostCompilation(compilation),
      timingMs: { plan: planMs, compile: compileMs },
    };
  });

  return {
    schema: "pcb-full-layout-cost-benchmark",
    schemaVersion: 1,
    productionContract: false,
    limitations: [
      "Measured dimensions are historical snapshots, not responsive runtime breakpoints.",
      "The single base-tone interval measures geometry and artifact cost only; it does not validate rendered section-tone fidelity.",
    ],
    source: {
      label: sourceLabel,
      width: sourceIndex.width,
      height: sourceIndex.height,
      pathCount: sourceIndex.paths.length,
      bytes: new TextEncoder().encode(source).byteLength,
      ...compressedByteLengths(source),
    },
    selectionReserveCssPx,
    sourceParseMs,
    layouts,
  };
}

async function benchmarkCompilerSha256(repositoryRoot) {
  const sources = await Promise.all(
    PROVENANCE_FILES.map((filename) => readFile(path.join(repositoryRoot, filename), "utf8")),
  );
  const digest = createHash("sha256");
  PROVENANCE_FILES.forEach((filename, index) => {
    digest.update(filename);
    digest.update("\0");
    digest.update(sources[index].replace(/\r\n/g, "\n"));
    digest.update("\0");
  });
  return digest.digest("hex");
}

async function main() {
  if (process.argv.length !== 2) {
    throw new Error("Usage: node --experimental-strip-types scripts/pcb-full-layout-benchmark.mjs");
  }
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const repositoryRoot = path.resolve(scriptDirectory, "..");
  const source = await readFile(path.join(repositoryRoot, SOURCE_FILENAME), "utf8");
  const compilerSha256 = await benchmarkCompilerSha256(repositoryRoot);
  const report = benchmarkPcbFullLayouts({
    source,
    sourceLabel: SOURCE_FILENAME,
    compilerSha256,
  });
  if (report.source.width !== EXPECTED_SOURCE_WIDTH || report.source.height !== EXPECTED_SOURCE_HEIGHT) {
    throw new Error(
      `Expected the ${EXPECTED_SOURCE_WIDTH}x${EXPECTED_SOURCE_HEIGHT} homepage lens source, received ${report.source.width}x${report.source.height}.`,
    );
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

const invokedFilename = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedFilename === import.meta.url) {
  await main();
}
