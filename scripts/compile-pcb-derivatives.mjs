import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compilePcbDerivatives } from "./pcb-derivative-compiler.mjs";

const usage = "Usage: node --experimental-strip-types scripts/compile-pcb-derivatives.mjs <lens.svg> <composition.json> <output-directory>";
const [sourceFilename, configFilename, outputDirectory] = process.argv.slice(2);
if (!sourceFilename || !configFilename || !outputDirectory || process.argv.length !== 5) {
  throw new Error(usage);
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const provenanceFiles = [
  "lib/pcb/spatial.ts",
  "scripts/pcb-composition-plan.mjs",
  "scripts/pcb-derivative-compiler.mjs",
  "scripts/compile-pcb-derivatives.mjs",
];
const GENERATED_ARTIFACT_PATTERN = /^(?:manifest|[a-z0-9]+(?:-[a-z0-9]+)*)\.[a-f0-9]{20}\.(?:json|svg)$/;

const [source, rawConfig, ...provenanceSources] = await Promise.all([
  readFile(sourceFilename, "utf8"),
  readFile(configFilename, "utf8"),
  ...provenanceFiles.map((filename) => readFile(path.join(repositoryRoot, filename))),
]);
const config = JSON.parse(rawConfig);
const provenanceHash = createHash("sha256");
provenanceFiles.forEach((filename, index) => {
  provenanceHash.update(filename);
  provenanceHash.update("\0");
  // Git may materialize text with platform-specific line endings. Normalize
  // compiler sources so one commit has one provenance digest everywhere.
  provenanceHash.update(provenanceSources[index].toString("utf8").replace(/\r\n/g, "\n"));
  provenanceHash.update("\0");
});

const compilation = compilePcbDerivatives({
  source,
  sourceLabel: config.sourceLabel,
  compilerSha256: provenanceHash.digest("hex"),
  composition: config.composition,
  expectedCompositionKey: config.expectedCompositionKey,
  selectionReserveCssPx: config.selectionReserveCssPx,
});

await mkdir(outputDirectory, { recursive: true });
await Promise.all(compilation.artifacts.map((artifact) =>
  writeFile(path.join(outputDirectory, artifact.filename), artifact.source, { encoding: "utf8" }),
));
await writeFile(
  path.join(outputDirectory, compilation.manifestFilename),
  compilation.manifestSource,
  { encoding: "utf8" },
);

const expectedFiles = new Set([
  compilation.manifestFilename,
  ...compilation.artifacts.map((artifact) => artifact.filename),
]);
const staleFiles = (await readdir(outputDirectory)).filter((filename) =>
  GENERATED_ARTIFACT_PATTERN.test(filename) && !expectedFiles.has(filename)
);
await Promise.all(staleFiles.map((filename) => unlink(path.join(outputDirectory, filename))));

process.stdout.write(`${JSON.stringify({
  manifest: compilation.manifestFilename,
  manifestSha256: compilation.manifestSha256,
  derivatives: compilation.artifacts.map((artifact) => artifact.filename),
})}\n`);
