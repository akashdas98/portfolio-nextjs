import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { benchmarkPcbFullLayouts } from "./pcb-full-layout-benchmark.mjs";
import { compilePcbSharedDefinitionsCandidate } from "./pcb-shared-definitions-candidate.mjs";

const SOURCE_FILENAME = "public/pcb-backgrounds/home-lens.svg";
const PROVENANCE_FILES = [
  "lib/pcb/spatial.ts",
  "scripts/pcb-composition-plan.mjs",
  "scripts/pcb-derivative-compiler.mjs",
  "scripts/pcb-shared-definitions-candidate.mjs",
  "scripts/pcb-full-layout-benchmark.mjs",
  "scripts/pcb-shared-definitions-benchmark.mjs",
];

function percentReduction(baseline, candidate) {
  return Number((((baseline - candidate) / baseline) * 100).toFixed(6));
}

export function comparePcbSharedDefinitions({ source, sourceLabel, compilerSha256 }) {
  const baseline = benchmarkPcbFullLayouts({ source, sourceLabel, compilerSha256 });
  const candidate = benchmarkPcbFullLayouts({
    source,
    sourceLabel,
    compilerSha256,
    compile: compilePcbSharedDefinitionsCandidate,
  });
  return {
    schema: "pcb-shared-definitions-ab-benchmark",
    schemaVersion: 1,
    productionContract: false,
    candidate: "shared-definitions-v1",
    source: baseline.source,
    layouts: baseline.layouts.map((before, index) => {
      const after = candidate.layouts[index];
      return {
        snapshot: before.snapshot,
        baseline: before,
        candidate: after,
        reduction: {
          aggregateBytes: before.aggregateBytes - after.aggregateBytes,
          aggregatePercent: percentReduction(before.aggregateBytes, after.aggregateBytes),
          aggregateGzipBytes: before.aggregateGzipBytes - after.aggregateGzipBytes,
          aggregateGzipPercent: percentReduction(
            before.aggregateGzipBytes,
            after.aggregateGzipBytes,
          ),
          aggregateBrotliBytes: before.aggregateBrotliBytes - after.aggregateBrotliBytes,
          aggregateBrotliPercent: percentReduction(
            before.aggregateBrotliBytes,
            after.aggregateBrotliBytes,
          ),
          serializedSourcePathCopies:
            before.serializedSourcePathCopies - after.serializedSourcePathCopies,
        },
      };
    }),
  };
}

async function provenanceSha256(repositoryRoot) {
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
    throw new Error("Usage: node --experimental-strip-types scripts/pcb-shared-definitions-benchmark.mjs");
  }
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const source = await readFile(path.join(repositoryRoot, SOURCE_FILENAME), "utf8");
  const compilerSha256 = await provenanceSha256(repositoryRoot);
  process.stdout.write(`${JSON.stringify(comparePcbSharedDefinitions({
    source,
    sourceLabel: SOURCE_FILENAME,
    compilerSha256,
  }), null, 2)}\n`);
}

const invokedFilename = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedFilename === import.meta.url) await main();
