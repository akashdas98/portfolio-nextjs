import { readFile, writeFile } from "node:fs/promises";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  throw new Error(
    "Usage: node scripts/attach-pcb-depth-definition.mjs <semantic.svg> <output.svg>",
  );
}

const GRAPHIC_TAGS = "path|polyline|polygon|line|circle|rect";
const DEPTH_OFFSET_CSS_PX = 1;

const readAttrs = (text) =>
  Object.fromEntries(
    [...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [
      match[1],
      match[2],
    ]),
  );

function replaceRootAttr(root, name, value) {
  const pattern = new RegExp(`\\s${name}="[^"]*"`);
  if (pattern.test(root)) return root.replace(pattern, ` ${name}="${value}"`);
  return root.replace(/>$/, ` ${name}="${value}">`);
}

function removeRootAttr(root, name) {
  return root.replace(new RegExp(`\\s${name}="[^"]*"`, "g"), "");
}

function immutablePrimitiveSignature(tag) {
  const match = tag.match(/^<([\w:-]+)\b([^>]*)\/>$/);
  if (!match) throw new Error("Expected a self-closing semantic primitive.");
  const attrs = readAttrs(match[2]);
  delete attrs.fill;
  delete attrs.stroke;
  return JSON.stringify([match[1], attrs]);
}

const source = await readFile(input, "utf8");
const rootMatch = source.match(/^<svg\b([^>]*)>/);
if (!rootMatch) throw new Error("Missing SVG root.");
const rootAttrs = readAttrs(rootMatch[1]);
if (
  rootAttrs["data-schema"] !== "pcb-art-semantic-svg" ||
  rootAttrs["data-schema-version"] !== "1.0"
) {
  throw new Error("Expected a prepared PCB semantic SVG v1.0 asset.");
}

let body;
if (
  rootAttrs["data-static-depth"] === "baked-v1" ||
  rootAttrs["data-depth-schema"] === "translated-source-v1"
) {
  const sourceGroup = '<g id="pcb-semantic-source" class="pcb-semantic-source">';
  const bodyStart = source.indexOf(sourceGroup);
  const bodyEnd = source.lastIndexOf("</g></svg>");
  if (bodyStart < 0 || bodyEnd < bodyStart) {
    throw new Error("The existing semantic source group is malformed.");
  }
  body = source.slice(bodyStart + sourceGroup.length, bodyEnd);
} else {
  const bodyStart = rootMatch[0].length;
  const bodyEnd = source.lastIndexOf("</svg>");
  if (bodyEnd < bodyStart) throw new Error("Missing SVG closing tag.");
  body = source.slice(bodyStart, bodyEnd);
}

const originalPrimitiveTags = [
  ...body.matchAll(new RegExp(`<(?:${GRAPHIC_TAGS})\\b[^>]*\\/>`, "g")),
].map((match) => match[0]);
body = body
  .replaceAll("var(--pcb-paint, url(#pcb-static-tone-map))", "#d8eef8")
  .replaceAll("var(--pcb-negative, #101319)", "#101319");

let primitiveCount = 0;
body.replace(
  new RegExp(`<(${GRAPHIC_TAGS})\\b([^>]*)\\/>`, "g"),
  (tag, _kind, attrText) => {
    const attrs = readAttrs(attrText);
    if (!attrs.id || !attrs.class?.split(/\s+/).includes("pcb-primitive")) {
      throw new Error("Every semantic primitive must retain its renderer identity.");
    }
    const originalTag = originalPrimitiveTags[primitiveCount];
    if (
      !originalTag ||
      immutablePrimitiveSignature(tag) !== immutablePrimitiveSignature(originalTag)
    ) {
      throw new Error(`Immutable primitive identity changed for ${attrs.id}.`);
    }
    primitiveCount += 1;
    return tag;
  },
);

const declaredCount = Number(rootAttrs["data-semantic-primitive-count"]);
if (primitiveCount !== declaredCount) {
  throw new Error(
    `Semantic primitive count mismatch: declared ${declaredCount}, found ${primitiveCount}.`,
  );
}

let root = rootMatch[0];
for (const attr of [
  "data-static-depth",
  "data-static-page-width",
  "data-static-page-height",
  "data-static-depth-offset",
]) {
  root = removeRootAttr(root, attr);
}
root = replaceRootAttr(root, "data-depth-schema", "translated-source-v1");
root = replaceRootAttr(
  root,
  "data-depth-offset-css-px",
  String(DEPTH_OFFSET_CSS_PX),
);

const depthDefinition = `<g id="pcb-depth-geometry" class="pcb-depth-geometry" data-role="depth-geometry" data-direction="down" visibility="hidden"><use id="pcb-depth-source" href="#pcb-semantic-source"/></g>`;
const outputSource = `${root}${depthDefinition}<g id="pcb-semantic-source" class="pcb-semantic-source">${body}</g></svg>`;

await writeFile(output, outputSource.replace(/>\s+</g, "><").trim());
console.log(
  `attached one non-rendered depth identity to ${primitiveCount} unchanged semantic primitives`,
);
