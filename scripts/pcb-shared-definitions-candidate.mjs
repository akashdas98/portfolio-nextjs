import { createHash } from "node:crypto";

import { parsePcbLensSvg } from "../lib/pcb/spatial.ts";
import { compilePcbDerivatives } from "./pcb-derivative-compiler.mjs";

export const PCB_SHARED_DEFINITIONS_CANDIDATE_NAME =
  "portfolio-pcb-shared-definitions-candidate";
export const PCB_SHARED_DEFINITIONS_CANDIDATE_VERSION = "0.1.0-candidate";

const LAYER_NAMES = ["depth", "main"];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function utf8Bytes(value) {
  return new TextEncoder().encode(value).byteLength;
}

function formatNumber(value) {
  const normalized = Object.is(value, -0) || Math.abs(value) < 1e-12 ? 0 : value;
  return Number(normalized.toPrecision(15)).toString();
}

function sharedDefinitionsSvg(baselineSource, plan, artifact, pathSources) {
  const opening = baselineSource.match(/^<svg\b[^>]*>/)?.[0];
  const gradients = [...baselineSource.matchAll(/<linearGradient\b[\s\S]*?<\/linearGradient>/g)]
    .map((match) => match[0]);
  if (!opening || gradients.length !== LAYER_NAMES.length) {
    throw new Error(`Could not recover the validated paint definitions for ${artifact.id}.`);
  }

  const cell = artifact.cssBounds;
  const bounds = `x="0" y="0" width="${formatNumber(cell.width)}" height="${formatNumber(cell.height)}"`;
  const mixedPaint = pathSources.some((source) =>
    source.includes('="black"') && source.includes('="white"')
  );
  const pathDefinitions = pathSources.map((source, index) =>
    `<g id="shared-source-path-${index}">${source}</g>`
  );
  const references = pathSources.map((source, index) => ({
    source,
    use: `<use href="#shared-source-path-${index}"/>`,
  }));
  const positiveUses = references
    .filter(({ source }) => !source.includes('="black"'))
    .map(({ use }) => use);
  const negativeUses = references
    .filter(({ source }) => source.includes('="black"'))
    .map(({ use }) => use);
  const masks = LAYER_NAMES.map((layer) => {
    const depthOffset = layer === "depth" ? 1 : 0;
    const transform = `translate(${formatNumber(plan.layout.offsetX - cell.x)} ${formatNumber(plan.layout.offsetY - cell.y + depthOffset)}) scale(${formatNumber(plan.layout.scale)})`;
    return mixedPaint
      ? `<mask id="${layer}-geometry" ${bounds} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" style="mask-type:luminance"><g transform="${transform}">${references.map(({ use }) => use).join("")}</g></mask>`
      : `<mask id="${layer}-cutouts" ${bounds} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" style="mask-type:luminance"><rect ${bounds} fill="white"/><g transform="${transform}">${negativeUses.join("")}</g></mask>`;
  });
  const paint = LAYER_NAMES.map((layer) => {
    if (mixedPaint) {
      return `<rect data-layer="${layer}" ${bounds} fill="url(#${layer}-palette)" mask="url(#${layer}-geometry)"/>`;
    }
    const depthOffset = layer === "depth" ? 1 : 0;
    const transform = `translate(${formatNumber(plan.layout.offsetX - cell.x)} ${formatNumber(plan.layout.offsetY - cell.y + depthOffset)}) scale(${formatNumber(plan.layout.scale)})`;
    return `<g data-layer="${layer}" mask="url(#${layer}-cutouts)"><g transform="${transform}" style="--pcb-shared-white:url(#${layer}-palette)">${positiveUses.join("")}</g></g>`;
  });

  // Source paint remains authoritative inside the luminance masks: white
  // contributes geometry, black removes it, and mixed fill/stroke paths retain
  // both roles. The palette is applied only by the two output rectangles.
  return [
    opening.replace(
      />$/,
      ` data-serialization-candidate="shared-definitions-v1">`,
    ),
    `<style>[fill="white"]{fill:var(--pcb-shared-white,white)}[stroke="white"]{stroke:var(--pcb-shared-white,white)}</style>`,
    `<defs>${gradients.join("")}<g id="shared-source-definitions">${pathDefinitions.join("")}</g>${masks.join("")}</defs>`,
    paint.join(""),
    "</svg>",
  ].join("");
}

/**
 * Non-production A/B candidate. The established compiler remains the sole
 * validator and selector; this wrapper changes only per-cell serialization.
 */
export function compilePcbSharedDefinitionsCandidate(input) {
  const baseline = compilePcbDerivatives(input);
  const parsed = parsePcbLensSvg(input.source);
  const artifacts = baseline.artifacts.map((artifact) => {
    const pathSources = artifact.sourcePathIndices.map((index) => parsed.paths[index].source);
    const source = sharedDefinitionsSvg(
      artifact.source,
      baseline.manifest.composition,
      artifact,
      pathSources,
    );
    const digest = sha256(source);
    return {
      ...artifact,
      filename: `${artifact.id}.${digest.slice(0, 20)}.svg`,
      source,
      sha256: digest,
      bytes: utf8Bytes(source),
    };
  });
  const artifactById = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
  const manifest = {
    ...baseline.manifest,
    compiler: {
      name: PCB_SHARED_DEFINITIONS_CANDIDATE_NAME,
      version: PCB_SHARED_DEFINITIONS_CANDIDATE_VERSION,
      sha256: input.compilerSha256,
      productionContract: false,
    },
    derivatives: baseline.manifest.derivatives.map((derivative) => {
      const artifact = artifactById.get(derivative.id);
      return artifact
        ? {
            ...derivative,
            filename: artifact.filename,
            sha256: artifact.sha256,
            bytes: artifact.bytes,
          }
        : derivative;
    }),
  };
  const manifestSource = `${JSON.stringify(manifest, null, 2)}\n`;
  const manifestSha256 = sha256(manifestSource);
  return {
    manifest,
    manifestFilename: `manifest.${manifestSha256.slice(0, 20)}.json`,
    manifestSource,
    manifestSha256,
    artifacts,
  };
}
