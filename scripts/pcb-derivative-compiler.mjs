import { createHash } from "node:crypto";

import { parsePcbLensSvg } from "../lib/pcb/spatial.ts";

export const PCB_DERIVATIVE_COMPILER_NAME = "portfolio-pcb-derivative-compiler";
export const PCB_DERIVATIVE_COMPILER_VERSION = "0.1.0-prototype";
export const MAX_PCB_DERIVATIVE_CSS_DIMENSION = 512;

const MAX_REGIONS = 64;
const MAX_SCALE = 1_000;
const MAX_RESERVE_CSS_PX = 64;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const REGION_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function utf8Bytes(value) {
  return new TextEncoder().encode(value).byteLength;
}

function finiteNumber(value, name) {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite.`);
  return value;
}

function positiveNumber(value, name, maximum) {
  finiteNumber(value, name);
  if (value <= 0 || value > maximum) {
    throw new Error(`${name} must be greater than zero and at most ${maximum}.`);
  }
  return value;
}

function formatNumber(value) {
  const normalized = Object.is(value, -0) || Math.abs(value) < 1e-12 ? 0 : value;
  return Number(normalized.toPrecision(15)).toString();
}

function intersects(first, second) {
  return first.right >= second.left && first.left <= second.right &&
    first.bottom >= second.top && first.top <= second.bottom;
}

function validateRegion(region, ids) {
  if (!region || typeof region !== "object") throw new Error("Every region must be an object.");
  if (!REGION_ID_PATTERN.test(region.id)) {
    throw new Error(`Region id ${JSON.stringify(region.id)} must be a lowercase kebab-case token.`);
  }
  if (ids.has(region.id)) throw new Error(`Region id ${region.id} is duplicated.`);
  ids.add(region.id);
  finiteNumber(region.x, `Region ${region.id} x`);
  finiteNumber(region.y, `Region ${region.id} y`);
  positiveNumber(region.width, `Region ${region.id} width`, MAX_PCB_DERIVATIVE_CSS_DIMENSION);
  positiveNumber(region.height, `Region ${region.id} height`, MAX_PCB_DERIVATIVE_CSS_DIMENSION);
}

function sourceQueryBounds(
  region,
  layout,
  reserve,
) {
  return {
    left: (region.x - layout.offsetX - reserve) / layout.scale,
    top: (region.y - layout.offsetY - reserve) / layout.scale,
    right: (region.x + region.width - layout.offsetX + reserve) / layout.scale,
    bottom: (region.y + region.height - layout.offsetY + reserve) / layout.scale,
  };
}

function derivativeSvg(
  input,
  region,
  sourceSha256,
  pathSources,
) {
  const translateX = input.layout.offsetX - region.x;
  const translateY = input.layout.offsetY - region.y;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${formatNumber(region.width)}" height="${formatNumber(region.height)}" viewBox="0 0 ${formatNumber(region.width)} ${formatNumber(region.height)}"`,
    ` data-schema="pcb-art-region-svg" data-schema-version="0.1" data-source-schema="pcb-art-lens-svg"`,
    ` data-source-sha256="${sourceSha256}" data-compiler-sha256="${input.compilerSha256}" data-region-id="${region.id}">`,
    `<g transform="translate(${formatNumber(translateX)} ${formatNumber(translateY)}) scale(${formatNumber(input.layout.scale)})">`,
    ...pathSources,
    "</g></svg>",
  ].join("");
}

export function compilePcbDerivatives(input) {
  if (typeof input.source !== "string") throw new Error("The PCB source must be text.");
  if (typeof input.sourceLabel !== "string" || !input.sourceLabel || input.sourceLabel.length > 2_048) {
    throw new Error("The source label must contain between 1 and 2,048 characters.");
  }
  if (typeof input.compilerSha256 !== "string" || !SHA256_PATTERN.test(input.compilerSha256)) {
    throw new Error("The compiler provenance must be a full lowercase SHA-256 digest.");
  }
  const layout = input.layout;
  if (!layout || typeof layout !== "object") throw new Error("The compiler requires a layout mapping.");
  positiveNumber(layout.scale, "Layout scale", MAX_SCALE);
  finiteNumber(layout.offsetX, "Layout offsetX");
  finiteNumber(layout.offsetY, "Layout offsetY");
  finiteNumber(input.selectionReserveCssPx, "Selection reserve");
  if (input.selectionReserveCssPx < 0 || input.selectionReserveCssPx > MAX_RESERVE_CSS_PX) {
    throw new Error(`Selection reserve must be between zero and ${MAX_RESERVE_CSS_PX} CSS px.`);
  }
  if (!Array.isArray(input.regions) || input.regions.length === 0 || input.regions.length > MAX_REGIONS) {
    throw new Error(`The compiler requires between 1 and ${MAX_REGIONS} regions.`);
  }

  const ids = new Set();
  for (const region of input.regions) validateRegion(region, ids);

  const parsed = parsePcbLensSvg(input.source);
  const sourceSha256 = sha256(input.source);
  const artifacts = input.regions.map((region) => {
    const query = sourceQueryBounds(region, layout, input.selectionReserveCssPx);
    const sourcePathIndices = [];
    const pathSources = [];
    parsed.paths.forEach((path, index) => {
      if (!intersects(path, query)) return;
      sourcePathIndices.push(index);
      pathSources.push(path.source);
    });
    if (pathSources.length === 0) {
      throw new Error(`Region ${region.id} does not intersect any source paths.`);
    }

    const source = derivativeSvg(input, region, sourceSha256, pathSources);
    const digest = sha256(source);
    return {
      id: region.id,
      filename: `${region.id}.${digest.slice(0, 20)}.svg`,
      source,
      sha256: digest,
      bytes: utf8Bytes(source),
      pathCount: pathSources.length,
      sourcePathIndices,
      cssBounds: { ...region },
      sourceQueryBounds: query,
    };
  });

  const manifest = {
    schema: "pcb-art-derivative-manifest",
    schemaVersion: "0.1",
    source: {
      label: input.sourceLabel,
      sha256: sourceSha256,
      bytes: utf8Bytes(input.source),
      schema: "pcb-art-lens-svg",
      width: parsed.width,
      height: parsed.height,
      pathCount: parsed.paths.length,
    },
    compiler: {
      name: PCB_DERIVATIVE_COMPILER_NAME,
      version: PCB_DERIVATIVE_COMPILER_VERSION,
      sha256: input.compilerSha256,
    },
    layout: {
      scale: layout.scale,
      offsetX: layout.offsetX,
      offsetY: layout.offsetY,
      selectionReserveCssPx: input.selectionReserveCssPx,
    },
    derivatives: artifacts.map((artifact) => ({
      id: artifact.id,
      filename: artifact.filename,
      sha256: artifact.sha256,
      bytes: artifact.bytes,
      pathCount: artifact.pathCount,
      sourcePathIndices: artifact.sourcePathIndices,
      cssBounds: artifact.cssBounds,
      sourceQueryBounds: artifact.sourceQueryBounds,
    })),
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
