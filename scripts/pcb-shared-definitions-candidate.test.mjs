import assert from "node:assert/strict";
import test from "node:test";

import { compilePcbDerivatives } from "./pcb-derivative-compiler.mjs";
import {
  compilePcbSharedDefinitionsCandidate,
  PCB_SHARED_DEFINITIONS_CANDIDATE_NAME,
} from "./pcb-shared-definitions-candidate.mjs";

const COMPILER_DIGEST = "b".repeat(64);
const PATHS = [
  '<path class="pcb-lens-geometry" data-source-kinds="positive-fill" fill="white" stroke="none" d="M0 0H8V8H0Z"/>',
  '<path class="pcb-lens-geometry" data-source-kinds="negative-fill-positive-stroke" fill="black" stroke="white" stroke-width="2" d="M2 2H6V6H2Z"/>',
  '<path class="pcb-lens-geometry" data-source-kinds="positive-fill-negative-stroke" fill="white" stroke="black" stroke-width="1" d="M10 0H18V8H10Z"/>',
  ...Array.from(
    { length: 97 },
    (_, index) => `<path class="pcb-lens-geometry" data-source-kinds="padding-${index}" fill="white" stroke="none" d="M${20 + index * 10} 0H${24 + index * 10}V4H${20 + index * 10}Z"/>`,
  ),
];

function input() {
  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 10" data-schema="pcb-art-lens-svg" data-schema-version="1.0" data-source-schema="pcb-art-semantic-svg">${PATHS.join("")}</svg>`,
    sourceLabel: "fixture/mixed-paint-lens.svg",
    compilerSha256: COMPILER_DIGEST,
    expectedCompositionKey: "mixed-paint-1000x10-v1",
    selectionReserveCssPx: 0,
    composition: {
      schemaVersion: 1,
      compositionKey: "mixed-paint-1000x10-v1",
      canvas: { x: 0, y: 0, width: 1000, height: 10 },
      layout: { scale: 1, offsetX: 0, offsetY: 0 },
      cells: [
        { id: "mixed-paint-left", x: 0, y: 0, width: 500, height: 10, empty: false },
        { id: "mixed-paint-right", x: 500, y: 0, width: 500, height: 10, empty: false },
      ],
      toneIntervals: [{ top: 0, bottom: 10, tone: "impact" }],
    },
  };
}

test("shared-definitions candidate is isolated and leaves default output byte-identical", () => {
  const compilationInput = input();
  const before = compilePcbDerivatives(compilationInput);
  const candidate = compilePcbSharedDefinitionsCandidate(compilationInput);
  const after = compilePcbDerivatives(compilationInput);

  assert.equal(after.manifestSource, before.manifestSource);
  assert.equal(after.artifacts[0].source, before.artifacts[0].source);
  assert.equal(candidate.manifest.compiler.name, PCB_SHARED_DEFINITIONS_CANDIDATE_NAME);
  assert.equal(candidate.manifest.compiler.productionContract, false);
  assert.match(
    candidate.artifacts[0].source,
    /data-serialization-candidate="shared-definitions-v1"/,
  );
});

test("candidate serializes every selected source path once and reuses it for depth and main", () => {
  const candidate = compilePcbSharedDefinitionsCandidate(input());
  const artifact = candidate.artifacts[0];
  const selectedPaths = artifact.sourcePathIndices.map((index) => PATHS[index]);

  assert.equal(artifact.pathCount, selectedPaths.length);
  for (const sourcePath of selectedPaths) {
    assert.equal(
      artifact.source.split(sourcePath).length - 1,
      1,
      `Expected exactly one exact serialization of ${sourcePath}`,
    );
  }
  assert.equal((artifact.source.match(/<path\b/g) ?? []).length, selectedPaths.length);
  assert.equal(
    (artifact.source.match(/<use href="#shared-source-path-/g) ?? []).length,
    selectedPaths.length * 2,
  );
  assert.ok(
    artifact.source.indexOf(PATHS[0]) < artifact.source.indexOf(PATHS[1]) &&
      artifact.source.indexOf(PATHS[1]) < artifact.source.indexOf(PATHS[2]),
    "Source path order changed inside the shared definition.",
  );
  assert.match(artifact.source, /id="depth-geometry"[\s\S]*transform="translate\(0 1\) scale\(1\)"/);
  assert.match(artifact.source, /id="main-geometry"[\s\S]*transform="translate\(0 0\) scale\(1\)"/);
  assert.ok(
    artifact.source.indexOf('data-layer="depth"') < artifact.source.indexOf('data-layer="main"'),
    "Depth must paint before main.",
  );
  assert.match(artifact.source, /fill="black" stroke="white"/);
  assert.match(artifact.source, /fill="white" stroke="black"/);
});

test("ordinary cells preserve separate positive paint and global cutout stages through use", () => {
  const compilationInput = input();
  compilationInput.source = compilationInput.source
    .replace('fill="black" stroke="white" stroke-width="2"', 'fill="black" stroke="none"')
    .replace('fill="white" stroke="black" stroke-width="1"', 'fill="white" stroke="none"');
  const artifact = compilePcbSharedDefinitionsCandidate(compilationInput).artifacts[0];
  const selectedPaths = artifact.sourcePathIndices.map((index) =>
    [...compilationInput.source.matchAll(/<path\b[^>]*\/>/g)][index][0]
  );

  assert.match(artifact.source, /id="depth-cutouts"/);
  assert.match(artifact.source, /id="main-cutouts"/);
  assert.match(artifact.source, /--pcb-shared-white:url\(#depth-palette\)/);
  assert.match(artifact.source, /--pcb-shared-white:url\(#main-palette\)/);
  for (const sourcePath of selectedPaths) {
    assert.equal(artifact.source.split(sourcePath).length - 1, 1);
  }
  assert.equal((artifact.source.match(/<path\b/g) ?? []).length, artifact.pathCount);
  assert.equal(
    (artifact.source.match(/<use href="#shared-source-path-/g) ?? []).length,
    artifact.pathCount * 2,
  );
});
