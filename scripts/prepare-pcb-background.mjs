import { readFile, writeFile } from "node:fs/promises";

const [input, output, lensOutput, cellArg = "400"] = process.argv.slice(2);
if (!input || !output || !lensOutput) {
  throw new Error(
    "Usage: node scripts/prepare-pcb-background.mjs <generator.svg> <semantic-output.svg> <lens-output.svg> [cell-size]",
  );
}

const cellSize = Number(cellArg);
if (!Number.isFinite(cellSize) || cellSize <= 0) throw new Error("Cell size must be positive.");

const source = await readFile(input, "utf8");
const GRAPHIC_TAGS = "path|polyline|polygon|line|circle|rect";
const LIGHT_SOURCE = "#e7e1d2";
const LIGHT_SITE = "#d8eef8";
const DARK_SOURCE = "#101319";

const readAttrs = (text) =>
  Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]));
const number = (value) => Number(value ?? 0);
const format = (value) => {
  const normalized = Math.abs(value) < 0.0000005 ? 0 : value;
  return normalized.toFixed(6).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, "");
};
const siteColor = (value) => value?.toLowerCase() === LIGHT_SOURCE ? LIGHT_SITE : value;
const maskColor = (value) => {
  const color = value?.toLowerCase();
  if (!color || color === "none") return "none";
  if (color === LIGHT_SITE || color === LIGHT_SOURCE) return "white";
  if (color === DARK_SOURCE || color === "black" || color === "#000" || color === "#000000") {
    return "black";
  }
  throw new Error(`Unsupported PCB paint color: ${value}`);
};

function setAttr(tag, name, value) {
  const pattern = new RegExp(`\\s${name}="[^"]*"`);
  if (pattern.test(tag)) return tag.replace(pattern, ` ${name}="${value}"`);
  return tag.replace(/\s*\/>$/, ` ${name}="${value}"/>`);
}

function prepareSemanticSvg(raw) {
  const root = raw.match(/<svg\b([^>]*)>/)?.[1];
  if (!root) throw new Error("Missing SVG root.");
  const rootAttrs = readAttrs(root);
  if (
    rootAttrs["data-schema"] !== "pcb-art-semantic-svg" ||
    rootAttrs["data-schema-version"] !== "1.0"
  ) {
    throw new Error("Expected a PCB Art Generator semantic SVG v1.0 export.");
  }
  if (!rootAttrs.viewBox) throw new Error("Missing viewBox.");

  let prepared = raw.replace(/<metadata>[\s\S]*?<\/metadata>/, "");
  prepared = prepared.replace(
    /<rect\b(?=[^>]*(?:class="[^"]*\bpcb-background\b[^"]*"|data-kind="background"))[^>]*\/>/,
    "",
  );

  let primitiveCount = 0;
  prepared = prepared.replace(
    new RegExp(`<(${GRAPHIC_TAGS})\\b([^>]*)\\/>`, "g"),
    (tag, kind, attrText) => {
      const attrs = readAttrs(attrText);
      if (!attrs.id || !attrs.class || !attrs["data-kind"] || !attrs["data-parent-entity-id"]) {
        throw new Error(`Unclassified ${kind} primitive encountered.`);
      }
      primitiveCount += 1;
      let next = tag;
      if (attrs.fill) next = setAttr(next, "fill", siteColor(attrs.fill));
      if (attrs.stroke) next = setAttr(next, "stroke", siteColor(attrs.stroke));
      if (attrs.stroke && attrs.stroke.toLowerCase() !== "none") {
        next = setAttr(next, "stroke-width", "2.1");
        if (["path", "polyline", "line"].includes(kind)) {
          next = setAttr(next, "stroke-linecap", "square");
        }
      }
      return next;
    },
  );

  const declaredCount = Number(rootAttrs["data-semantic-primitive-count"]);
  if (primitiveCount !== declaredCount) {
    throw new Error(`Semantic primitive count mismatch: declared ${declaredCount}, found ${primitiveCount}.`);
  }

  return prepared.replace(/>\s+</g, "><").trim();
}

function points(value) {
  const values = value.trim().split(/[\s,]+/).map(Number);
  return Array.from({ length: values.length / 2 }, (_, index) => [
    values[index * 2],
    values[index * 2 + 1],
  ]);
}

function circlePath(attrs) {
  const cx = number(attrs.cx);
  const cy = number(attrs.cy);
  const radius = number(attrs.r);
  return `M${format(cx - radius)} ${format(cy)}A${format(radius)} ${format(radius)} 0 1 0 ${format(cx + radius)} ${format(cy)}A${format(radius)} ${format(radius)} 0 1 0 ${format(cx - radius)} ${format(cy)}Z`;
}

function rectPath(attrs) {
  const x = number(attrs.x);
  const y = number(attrs.y);
  const width = number(attrs.width);
  const height = number(attrs.height);
  const radius = Math.min(number(attrs.rx), width / 2, height / 2);
  if (!radius) {
    return `M${format(x)} ${format(y)}H${format(x + width)}V${format(y + height)}H${format(x)}Z`;
  }
  return `M${format(x + radius)} ${format(y)}H${format(x + width - radius)}A${format(radius)} ${format(radius)} 0 0 1 ${format(x + width)} ${format(y + radius)}V${format(y + height - radius)}A${format(radius)} ${format(radius)} 0 0 1 ${format(x + width - radius)} ${format(y + height)}H${format(x + radius)}A${format(radius)} ${format(radius)} 0 0 1 ${format(x)} ${format(y + height - radius)}V${format(y + radius)}A${format(radius)} ${format(radius)} 0 0 1 ${format(x + radius)} ${format(y)}Z`;
}

function shapeGeometry(kind, attrs) {
  if (kind === "circle") {
    const cx = number(attrs.cx), cy = number(attrs.cy), radius = number(attrs.r);
    return {
      d: circlePath(attrs),
      bounds: { minX: cx - radius, minY: cy - radius, maxX: cx + radius, maxY: cy + radius },
    };
  }
  if (kind === "rect") {
    const x = number(attrs.x), y = number(attrs.y), width = number(attrs.width), height = number(attrs.height);
    return { d: rectPath(attrs), bounds: { minX: x, minY: y, maxX: x + width, maxY: y + height } };
  }
  if (kind === "line") {
    const x1 = number(attrs.x1), y1 = number(attrs.y1), x2 = number(attrs.x2), y2 = number(attrs.y2);
    return {
      d: `M${format(x1)} ${format(y1)}L${format(x2)} ${format(y2)}`,
      bounds: { minX: Math.min(x1, x2), minY: Math.min(y1, y2), maxX: Math.max(x1, x2), maxY: Math.max(y1, y2) },
    };
  }
  if (kind === "polyline" || kind === "polygon") {
    const coords = points(attrs.points);
    const xs = coords.map(([x]) => x);
    const ys = coords.map(([, y]) => y);
    return {
      d: `M${coords.map(([x, y]) => `${format(x)} ${format(y)}`).join("L")}${kind === "polygon" ? "Z" : ""}`,
      bounds: { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) },
    };
  }
  const startX = number(attrs["data-start-x"]);
  const startY = number(attrs["data-start-y"]);
  const endX = number(attrs["data-end-x"]);
  const endY = number(attrs["data-end-y"]);
  const pad = Math.max(Math.abs(endX - startX), Math.abs(endY - startY), 40);
  return {
    d: attrs.d,
    bounds: {
      minX: Math.min(startX, endX) - pad,
      minY: Math.min(startY, endY) - pad,
      maxX: Math.max(startX, endX) + pad,
      maxY: Math.max(startY, endY) + pad,
    },
  };
}

function prepareLensSvg(semantic) {
  const rootText = semantic.match(/<svg\b([^>]*)>/)?.[1];
  const rootAttrs = readAttrs(rootText ?? "");
  const viewBox = rootAttrs.viewBox;
  if (!viewBox) throw new Error("Missing semantic viewBox.");

  const stack = [{ fill: "black", stroke: "none" }];
  const buckets = new Map();
  const singles = [];
  const tags = new RegExp(`<\\/g\\s*>|<g\\b([^>]*)>|<(${GRAPHIC_TAGS})\\b([^>]*)\\/>`, "g");
  let match;
  while ((match = tags.exec(semantic))) {
    if (match[0].startsWith("</g")) {
      stack.pop();
      continue;
    }
    if (match[0].startsWith("<g")) {
      stack.push({ ...stack.at(-1), ...readAttrs(match[1] ?? "") });
      continue;
    }

    const kind = match[2];
    const own = readAttrs(match[3] ?? "");
    const inherited = { ...stack.at(-1), ...own };
    const geometry = shapeGeometry(kind, own);
    const style = {
      fill: kind === "line" ? "none" : maskColor(inherited.fill ?? "black"),
      stroke: maskColor(inherited.stroke ?? "none"),
    };
    if (style.stroke !== "none") {
      style["stroke-width"] = inherited["stroke-width"] ?? "2.1";
      if (["line", "polyline", "path"].includes(kind)) style["stroke-linecap"] = "square";
    }

    const sourceKind = own["data-kind"];
    const styleKey = JSON.stringify(style);
    const { bounds } = geometry;
    const long = kind === "path" || bounds.maxX - bounds.minX > cellSize * 2 || bounds.maxY - bounds.minY > cellSize * 2;
    const record = { style, d: geometry.d, sourceKinds: new Set([sourceKind]) };
    if (long) {
      singles.push(record);
      continue;
    }
    const cellX = Math.floor(((bounds.minX + bounds.maxX) / 2) / cellSize);
    const cellY = Math.floor(((bounds.minY + bounds.maxY) / 2) / cellSize);
    const key = `${cellX}:${cellY}:${styleKey}`;
    const bucket = buckets.get(key) ?? { style, sourceKinds: new Set(), parts: [] };
    bucket.sourceKinds.add(sourceKind);
    bucket.parts.push(geometry.d);
    buckets.set(key, bucket);
  }

  const records = [
    ...[...buckets.values()].map(({ style, sourceKinds, parts }) => ({ style, sourceKinds, d: parts.join(" ") })),
    ...singles,
  ];
  const isNegative = ({ style }) => style.fill === "black" || style.stroke === "black";
  records.sort((first, second) => Number(isNegative(first)) - Number(isNegative(second)));
  const styleAttrs = (style) =>
    Object.entries(style).map(([key, value]) => ` ${key}="${value}"`).join("");
  const paths = records.map(
    ({ style, sourceKinds, d }) => {
      const kinds = [...sourceKinds].sort().join(" ");
      return `<path class="pcb-lens-geometry" data-source-kinds="${kinds}"${styleAttrs(style)} d="${d}"/>`;
    },
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" data-schema="pcb-art-lens-svg" data-schema-version="1.0" data-source-schema="pcb-art-semantic-svg">${paths.join("")}</svg>`;
}

const semantic = prepareSemanticSvg(source);
const lens = prepareLensSvg(semantic);
await Promise.all([writeFile(output, semantic), writeFile(lensOutput, lens)]);

const semanticPrimitiveCount = (semantic.match(new RegExp(`<(?:${GRAPHIC_TAGS})\\b`, "g")) ?? []).length;
const lensPathCount = (lens.match(/<path\b/g) ?? []).length;
console.log(`preserved ${semanticPrimitiveCount} classified primitives; prepared ${lensPathCount} local lens paths`);
