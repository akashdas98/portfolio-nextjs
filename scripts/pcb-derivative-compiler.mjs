import { createHash } from "node:crypto";

import { parsePcbLensSvg } from "../lib/pcb/spatial.ts";
import { createPcbCompositionPlan } from "./pcb-composition-plan.mjs";

export const PCB_DERIVATIVE_COMPILER_NAME = "portfolio-pcb-derivative-compiler";
export const PCB_DERIVATIVE_COMPILER_VERSION = "0.2.0-prototype";
export const MAX_PCB_DERIVATIVE_CSS_DIMENSION = 512;

const MAX_RESERVE_CSS_PX = 64;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const DEPTH_OFFSET_CSS_PX = 1;
const STATIC_PALETTES = {
  main: { base: "#0f1115", muted: "#090d11", impact: "#0e325f" },
  depth: { base: "#1c2126", muted: "#29323a", impact: "#315686" },
};

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

function paletteStops(plan, palette) {
  return plan.toneIntervals.flatMap((interval, index) => {
    const topOffset = (interval.top - plan.canvas.y) / plan.canvas.height;
    const bottomOffset = (interval.bottom - plan.canvas.y) / plan.canvas.height;
    const color = palette[interval.tone];
    const previous = plan.toneIntervals[index - 1];
    const previousColor = previous ? palette[previous.tone] : null;
    return [
      ...(previousColor && previousColor !== color
        ? [`<stop offset="${formatNumber(topOffset)}" stop-color="${previousColor}"/>`]
        : []),
      `<stop offset="${formatNumber(topOffset)}" stop-color="${color}"/>`,
      `<stop offset="${formatNumber(bottomOffset)}" stop-color="${color}"/>`,
    ];
  }).join("");
}

function derivativeSvg(
  input,
  plan,
  cell,
  sourceSha256,
  pathSources,
) {
  const positive = pathSources.filter((source) => !source.includes('="black"'));
  const negative = pathSources.filter((source) => source.includes('="black"'));
  const mixedPaint = pathSources.some((source) => source.includes('="black"') && source.includes('="white"'));
  const mainStops = paletteStops(plan, STATIC_PALETTES.main);
  const depthStops = paletteStops(plan, STATIC_PALETTES.depth);
  const bounds = `x="0" y="0" width="${formatNumber(cell.width)}" height="${formatNumber(cell.height)}"`;
  let definitions = "";
  let paint = "";
  for (const layer of ["depth", "main"]) {
    const depthOffset = layer === "depth" ? DEPTH_OFFSET_CSS_PX : 0;
    const transform = `translate(${formatNumber(plan.layout.offsetX - cell.x)} ${formatNumber(plan.layout.offsetY - cell.y + depthOffset)}) scale(${formatNumber(plan.layout.scale)})`;
    const gradientTop = (plan.canvas.y - plan.layout.offsetY - depthOffset) / plan.layout.scale;
    const gradientBottom = gradientTop + plan.canvas.height / plan.layout.scale;
    definitions += `<linearGradient id="${layer}-palette" x1="0" y1="${formatNumber(gradientTop)}" x2="0" y2="${formatNumber(gradientBottom)}" gradientUnits="userSpaceOnUse">${layer === "depth" ? depthStops : mainStops}</linearGradient>`;
    if (mixedPaint) {
      definitions += `<mask id="${layer}-geometry" ${bounds} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" style="mask-type:luminance"><g transform="${transform}">${pathSources.join("")}</g></mask>`;
      paint += `<rect data-layer="${layer}" ${bounds} fill="url(#${layer}-palette)" mask="url(#${layer}-geometry)"/>`;
    } else {
      definitions += `<mask id="${layer}-cutouts" ${bounds} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" style="mask-type:luminance"><rect ${bounds} fill="white"/><g transform="${transform}">${negative.join("")}</g></mask>`;
      paint += `<g data-layer="${layer}" class="pcb-static-${layer}" mask="url(#${layer}-cutouts)"><g transform="${transform}">${positive.join("")}</g></g>`;
    }
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${formatNumber(cell.width)}" height="${formatNumber(cell.height)}" viewBox="0 0 ${formatNumber(cell.width)} ${formatNumber(cell.height)}"`,
    ` data-schema="pcb-art-static-region-svg" data-schema-version="0.2" data-source-schema="pcb-art-lens-svg"`,
    ` data-source-sha256="${sourceSha256}" data-compiler-sha256="${input.compilerSha256}" data-composition-key="${plan.compositionKey}" data-region-id="${cell.id}">`,
    `<style>.pcb-static-depth [fill="white"]{fill:url(#depth-palette)}.pcb-static-depth [stroke="white"]{stroke:url(#depth-palette)}.pcb-static-main [fill="white"]{fill:url(#main-palette)}.pcb-static-main [stroke="white"]{stroke:url(#main-palette)}</style>`,
    `<defs>${definitions}</defs>${paint}</svg>`,
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
  const plan = createPcbCompositionPlan(input.composition, input.expectedCompositionKey);
  finiteNumber(input.selectionReserveCssPx, "Selection reserve");
  if (input.selectionReserveCssPx < 0 || input.selectionReserveCssPx > MAX_RESERVE_CSS_PX) {
    throw new Error(`Selection reserve must be between zero and ${MAX_RESERVE_CSS_PX} CSS px.`);
  }
  const parsed = parsePcbLensSvg(input.source);
  const sourceSha256 = sha256(input.source);
  const cells = plan.cells.map((cell) => {
    const query = sourceQueryBounds(cell, plan.layout, input.selectionReserveCssPx);
    const sourcePathIndices = [];
    const pathSources = [];
    parsed.paths.forEach((path, index) => {
      if (!intersects(path, query)) return;
      sourcePathIndices.push(index);
      pathSources.push(path.source);
    });
    const empty = pathSources.length === 0;
    if (empty !== cell.empty) {
      throw new Error(`Cell ${cell.id} declared empty=${cell.empty} but compiled empty=${empty}.`);
    }
    if (empty) {
      return {
        id: cell.id, empty: true, filename: null, source: null, sha256: null,
        bytes: 0, pathCount: 0, sourcePathIndices, cssBounds: { ...cell },
        sourceQueryBounds: query,
      };
    }
    const source = derivativeSvg(input, plan, cell, sourceSha256, pathSources);
    const digest = sha256(source);
    return {
      id: cell.id,
      empty: false,
      filename: `${cell.id}.${digest.slice(0, 20)}.svg`,
      source,
      sha256: digest,
      bytes: utf8Bytes(source),
      pathCount: pathSources.length,
      sourcePathIndices,
      cssBounds: { ...cell },
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
    composition: {
      ...plan,
      selectionReserveCssPx: input.selectionReserveCssPx,
    },
    derivatives: cells.map((artifact) => ({
      id: artifact.id,
      empty: artifact.empty,
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
    artifacts: cells.filter((cell) => !cell.empty),
  };
}
