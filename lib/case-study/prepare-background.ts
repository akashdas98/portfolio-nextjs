import "server-only";

import { createHash } from "node:crypto";

const MAX_SEMANTIC_SVG_BYTES = 25 * 1024 * 1024;
const MAX_LENS_SVG_BYTES = 5 * 1024 * 1024;
const SEMANTIC_ELEMENTS = new Set([
  "svg",
  "g",
  "path",
  "polyline",
  "polygon",
  "line",
  "circle",
  "rect",
]);
const SEMANTIC_GRAPHICS = new Set(["path", "polyline", "polygon", "line", "circle", "rect"]);
const FORBIDDEN_SVG_CONTENT =
  /<\s*(?:script|foreignObject|image|use|iframe|object|embed|style|link|a|metadata)\b|\bon[a-z]+\s*=|\b(?:href|xlink:href)\s*=|url\s*\(|<!|<\?/i;

function readElements(source: string) {
  return [...source.matchAll(/<\/?\s*([a-zA-Z][\w:-]*)\b/g)].map((match) =>
    match[1].toLowerCase(),
  );
}

function readViewBox(source: string) {
  const match = source.match(/\bviewBox=["']\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*["']/i);
  if (!match) throw new Error("The background SVG requires a positive 0 0 width height viewBox.");

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("The background SVG viewBox is invalid.");
  }

  return { width, height, value: `0 0 ${match[1]} ${match[2]}` };
}

function assertSafeSvg(source: string) {
  if (FORBIDDEN_SVG_CONTENT.test(source)) {
    throw new Error("The background SVG contains unsupported or unsafe content.");
  }
}

function assertSemanticSvg(source: string) {
  assertSafeSvg(source);
  if (
    !/\bdata-schema="pcb-art-semantic-svg"/.test(source) ||
    !/\bdata-schema-version="1\.0"/.test(source)
  ) {
    throw new Error("The background must be a prepared PCB semantic SVG v1.0 asset.");
  }
  if (/\b(?:class="[^"]*\bpcb-background\b|data-kind="background")/.test(source)) {
    throw new Error("The prepared semantic SVG must not retain the renderer background canvas.");
  }

  const elements = readElements(source);
  if (!elements.length || elements.some((element) => !SEMANTIC_ELEMENTS.has(element))) {
    throw new Error("The semantic SVG contains an unsupported element.");
  }
  const graphicCount = elements.filter((element) => SEMANTIC_GRAPHICS.has(element)).length;
  const declaredCount = Number(source.match(/\bdata-semantic-primitive-count="(\d+)"/)?.[1]);
  if (graphicCount < 100 || graphicCount > 100_000 || graphicCount !== declaredCount) {
    throw new Error("The semantic SVG primitive count is invalid or does not match its declaration.");
  }

  const primitives = [...source.matchAll(/<(?:path|polyline|polygon|line|circle|rect)\b([^>]*)\/>/g)];
  if (
    primitives.length !== graphicCount ||
    primitives.some((match) =>
      !/\bid="[^"]+"/.test(match[1]) ||
      !/\bclass="[^"]*\bpcb-primitive\b[^"]*"/.test(match[1]) ||
      !/\bdata-kind="[^"]+"/.test(match[1]) ||
      !/\bdata-parent-entity-id="[^"]+"/.test(match[1])
    )
  ) {
    throw new Error("Every semantic SVG primitive must retain its renderer ID and classification.");
  }

  const groupCount = (source.match(/<g\b/g) ?? []).length;
  const declaredGroupCount = Number(source.match(/\bdata-semantic-entity-count="(\d+)"/)?.[1]);
  if (groupCount !== declaredGroupCount) {
    throw new Error("The semantic SVG entity count does not match its declaration.");
  }

  return readViewBox(source);
}

function assertLensSvg(source: string, semanticViewBox: string) {
  assertSafeSvg(source);
  if (
    !/\bdata-schema="pcb-art-lens-svg"/.test(source) ||
    !/\bdata-schema-version="1\.0"/.test(source) ||
    !/\bdata-source-schema="pcb-art-semantic-svg"/.test(source)
  ) {
    throw new Error("The lens must be a prepared PCB lens SVG v1.0 asset.");
  }

  const elements = readElements(source);
  if (!elements.length || elements.some((element) => element !== "svg" && element !== "path")) {
    throw new Error("The lens SVG may contain only its SVG root and local path geometry.");
  }
  const pathCount = (source.match(/<path\b/g) ?? []).length;
  if (pathCount < 100 || pathCount > 2_500) {
    throw new Error("The lens SVG must contain between 100 and 2,500 spatially local paths.");
  }
  if (
    [...source.matchAll(/<path\b([^>]*)\/>/g)].some((match) =>
      !/\bclass="pcb-lens-geometry"/.test(match[1]) ||
      !/\bdata-source-kinds="[^"]+"/.test(match[1])
    )
  ) {
    throw new Error("Every lens path must identify its source geometry classification.");
  }

  if (readViewBox(source).value !== semanticViewBox) {
    throw new Error("The semantic and lens SVG viewBoxes must match exactly.");
  }
}

export async function prepareCaseStudyBackground(semanticFile: File, lensFile: File) {
  if (semanticFile.size <= 0 || semanticFile.size > MAX_SEMANTIC_SVG_BYTES) {
    throw new Error("Prepared semantic background SVGs must be smaller than 25 MB.");
  }
  if (lensFile.size <= 0 || lensFile.size > MAX_LENS_SVG_BYTES) {
    throw new Error("Prepared lens SVGs must be smaller than 5 MB.");
  }

  const [semanticSource, lensSource] = await Promise.all([semanticFile.text(), lensFile.text()]);
  const { width, height, value } = assertSemanticSvg(semanticSource);
  assertLensSvg(lensSource, value);

  const semanticBody = new TextEncoder().encode(semanticSource);
  const lensBody = new TextEncoder().encode(lensSource);
  return {
    semanticBody,
    semanticHash: createHash("sha256").update(semanticBody).digest("hex").slice(0, 20),
    lensBody,
    lensHash: createHash("sha256").update(lensBody).digest("hex").slice(0, 20),
    width,
    height,
  };
}
