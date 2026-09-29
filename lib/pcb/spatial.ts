export const MAX_PCB_SOURCE_BYTES = 5 * 1024 * 1024;
export const MAX_PCB_REGION_DIMENSION = 65_536;
export const MAX_PCB_SOURCE_COORDINATE = 100_000;

const MAX_PATH_NUMBER = 10_000_000;
const SVG_RENDERER_BOUND_RESERVE = 0.125;
const PATH_COMMANDS = new Set(["M", "L", "H", "V", "C", "S", "Q", "T", "A", "Z"]);
const NUMBER_PATTERN = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
const TOKEN_PATTERN = /[a-zA-Z]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;
const STORAGE_PREFIX = "/storage/v1/object/public/case-study-assets/";

export type PcbBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type PcbPath = PcbBounds & {
  source: string;
};

export type PcbRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PcbSourceTarget =
  | { kind: "local"; pathname: "/pcb-backgrounds/home-lens.svg" }
  | { kind: "remote"; url: string };

export type PcbSpatialIndex = {
  width: number;
  height: number;
  paths: PcbPath[];
};

export class PcbInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PcbInputError";
  }
}

function finitePathNumber(value: string) {
  if (!NUMBER_PATTERN.test(value)) throw new PcbInputError("The SVG path contains an invalid number.");
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || Math.abs(parsed) > MAX_PATH_NUMBER) {
    throw new PcbInputError("The SVG path number is outside the supported range.");
  }
  return parsed;
}

function tokenizePath(data: string) {
  const tokens: string[] = [];
  let previousEnd = 0;
  for (const match of data.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (!/^[\s,]*$/.test(data.slice(previousEnd, index))) {
      throw new PcbInputError("The SVG path contains unsupported syntax.");
    }
    tokens.push(match[0]);
    previousEnd = index + match[0].length;
  }
  if (!/^[\s,]*$/.test(data.slice(previousEnd)) || tokens.length === 0) {
    throw new PcbInputError("The SVG path is empty or malformed.");
  }
  return tokens;
}

function isCommand(token: string | undefined) {
  return token !== undefined && /^[a-zA-Z]$/.test(token);
}

function include(bounds: PcbBounds, x: number, y: number) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new PcbInputError("The SVG path produced non-finite geometry.");
  }
  bounds.left = Math.min(bounds.left, x);
  bounds.top = Math.min(bounds.top, y);
  bounds.right = Math.max(bounds.right, x);
  bounds.bottom = Math.max(bounds.bottom, y);
}

function includeArc(
  bounds: PcbBounds,
  startX: number,
  startY: number,
  rawRadiusX: number,
  rawRadiusY: number,
  rotation: number,
  largeArc: number,
  sweep: number,
  endX: number,
  endY: number,
) {
  include(bounds, startX, startY);
  include(bounds, endX, endY);

  let radiusX = Math.abs(rawRadiusX);
  let radiusY = Math.abs(rawRadiusY);
  if (radiusX === 0 || radiusY === 0 || (startX === endX && startY === endY)) return;

  const angle = (rotation % 360) * Math.PI / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const halfX = (startX - endX) / 2;
  const halfY = (startY - endY) / 2;
  const transformedX = cosine * halfX + sine * halfY;
  const transformedY = -sine * halfX + cosine * halfY;
  const scaleSquared = transformedX * transformedX / (radiusX * radiusX) +
    transformedY * transformedY / (radiusY * radiusY);
  if (scaleSquared > 1) {
    const scale = Math.sqrt(scaleSquared);
    radiusX *= scale;
    radiusY *= scale;
  }

  const radiusXSquared = radiusX * radiusX;
  const radiusYSquared = radiusY * radiusY;
  const numerator = radiusXSquared * radiusYSquared -
    radiusXSquared * transformedY * transformedY -
    radiusYSquared * transformedX * transformedX;
  const denominator = radiusXSquared * transformedY * transformedY +
    radiusYSquared * transformedX * transformedX;
  const direction = largeArc === sweep ? -1 : 1;
  const factor = denominator === 0 ? 0 : direction * Math.sqrt(Math.max(0, numerator / denominator));
  const centerTransformedX = factor * radiusX * transformedY / radiusY;
  const centerTransformedY = factor * -radiusY * transformedX / radiusX;
  const centerX = cosine * centerTransformedX - sine * centerTransformedY + (startX + endX) / 2;
  const centerY = sine * centerTransformedX + cosine * centerTransformedY + (startY + endY) / 2;

  // The complete rotated ellipse is a conservative bound for either selected arc.
  const extentX = Math.hypot(radiusX * cosine, radiusY * sine);
  const extentY = Math.hypot(radiusX * sine, radiusY * cosine);
  include(bounds, centerX - extentX, centerY - extentY);
  include(bounds, centerX + extentX, centerY + extentY);
}

export function getPcbPathBounds(data: string): PcbBounds {
  const tokens = tokenizePath(data);
  const bounds: PcbBounds = {
    left: Number.POSITIVE_INFINITY,
    top: Number.POSITIVE_INFINITY,
    right: Number.NEGATIVE_INFINITY,
    bottom: Number.NEGATIVE_INFINITY,
  };
  let index = 0;
  let command = "";
  let currentX = 0;
  let currentY = 0;
  let subpathX = 0;
  let subpathY = 0;
  let previousCommand = "";
  let cubicControlX = 0;
  let cubicControlY = 0;
  let quadraticControlX = 0;
  let quadraticControlY = 0;

  const readNumber = () => {
    const token = tokens[index];
    if (token === undefined || isCommand(token)) {
      throw new PcbInputError("The SVG path command has missing parameters.");
    }
    index += 1;
    return finitePathNumber(token);
  };
  const absoluteX = (value: number, relative: boolean) => relative ? currentX + value : value;
  const absoluteY = (value: number, relative: boolean) => relative ? currentY + value : value;

  while (index < tokens.length) {
    if (isCommand(tokens[index])) {
      command = tokens[index++];
      if (!PATH_COMMANDS.has(command.toUpperCase())) {
        throw new PcbInputError(`Unsupported SVG path command: ${command}.`);
      }
    } else if (!command || command.toUpperCase() === "Z") {
      throw new PcbInputError("The SVG path requires a command before its parameters.");
    }

    const upper = command.toUpperCase();
    const relative = command !== upper;
    if (upper === "Z") {
      include(bounds, currentX, currentY);
      include(bounds, subpathX, subpathY);
      currentX = subpathX;
      currentY = subpathY;
      previousCommand = "Z";
      command = "";
      continue;
    }

    if (upper === "M") {
      const nextX = absoluteX(readNumber(), relative);
      const nextY = absoluteY(readNumber(), relative);
      currentX = nextX;
      currentY = nextY;
      subpathX = nextX;
      subpathY = nextY;
      include(bounds, currentX, currentY);
      previousCommand = "M";
      command = relative ? "l" : "L";
      continue;
    }

    const startX = currentX;
    const startY = currentY;
    if (upper === "L") {
      currentX = absoluteX(readNumber(), relative);
      currentY = absoluteY(readNumber(), relative);
      include(bounds, startX, startY);
      include(bounds, currentX, currentY);
    } else if (upper === "H") {
      currentX = absoluteX(readNumber(), relative);
      include(bounds, startX, startY);
      include(bounds, currentX, currentY);
    } else if (upper === "V") {
      currentY = absoluteY(readNumber(), relative);
      include(bounds, startX, startY);
      include(bounds, currentX, currentY);
    } else if (upper === "C") {
      const control1X = absoluteX(readNumber(), relative);
      const control1Y = absoluteY(readNumber(), relative);
      const control2X = absoluteX(readNumber(), relative);
      const control2Y = absoluteY(readNumber(), relative);
      const endX = absoluteX(readNumber(), relative);
      const endY = absoluteY(readNumber(), relative);
      include(bounds, startX, startY);
      include(bounds, control1X, control1Y);
      include(bounds, control2X, control2Y);
      include(bounds, endX, endY);
      currentX = endX;
      currentY = endY;
      cubicControlX = control2X;
      cubicControlY = control2Y;
    } else if (upper === "S") {
      const control1X = previousCommand === "C" || previousCommand === "S"
        ? currentX * 2 - cubicControlX
        : currentX;
      const control1Y = previousCommand === "C" || previousCommand === "S"
        ? currentY * 2 - cubicControlY
        : currentY;
      const control2X = absoluteX(readNumber(), relative);
      const control2Y = absoluteY(readNumber(), relative);
      const endX = absoluteX(readNumber(), relative);
      const endY = absoluteY(readNumber(), relative);
      include(bounds, startX, startY);
      include(bounds, control1X, control1Y);
      include(bounds, control2X, control2Y);
      include(bounds, endX, endY);
      currentX = endX;
      currentY = endY;
      cubicControlX = control2X;
      cubicControlY = control2Y;
    } else if (upper === "Q") {
      const controlX = absoluteX(readNumber(), relative);
      const controlY = absoluteY(readNumber(), relative);
      const endX = absoluteX(readNumber(), relative);
      const endY = absoluteY(readNumber(), relative);
      include(bounds, startX, startY);
      include(bounds, controlX, controlY);
      include(bounds, endX, endY);
      currentX = endX;
      currentY = endY;
      quadraticControlX = controlX;
      quadraticControlY = controlY;
    } else if (upper === "T") {
      const controlX = previousCommand === "Q" || previousCommand === "T"
        ? currentX * 2 - quadraticControlX
        : currentX;
      const controlY = previousCommand === "Q" || previousCommand === "T"
        ? currentY * 2 - quadraticControlY
        : currentY;
      const endX = absoluteX(readNumber(), relative);
      const endY = absoluteY(readNumber(), relative);
      include(bounds, startX, startY);
      include(bounds, controlX, controlY);
      include(bounds, endX, endY);
      currentX = endX;
      currentY = endY;
      quadraticControlX = controlX;
      quadraticControlY = controlY;
    } else if (upper === "A") {
      const radiusX = readNumber();
      const radiusY = readNumber();
      const rotation = readNumber();
      const largeArc = readNumber();
      const sweep = readNumber();
      if ((largeArc !== 0 && largeArc !== 1) || (sweep !== 0 && sweep !== 1)) {
        throw new PcbInputError("SVG arc flags must be either 0 or 1.");
      }
      const endX = absoluteX(readNumber(), relative);
      const endY = absoluteY(readNumber(), relative);
      includeArc(bounds, startX, startY, radiusX, radiusY, rotation, largeArc, sweep, endX, endY);
      currentX = endX;
      currentY = endY;
    }

    previousCommand = upper;
    if (upper !== "C" && upper !== "S") {
      cubicControlX = currentX;
      cubicControlY = currentY;
    }
    if (upper !== "Q" && upper !== "T") {
      quadraticControlX = currentX;
      quadraticControlY = currentY;
    }
  }

  if (!Number.isFinite(bounds.left) || !Number.isFinite(bounds.top) ||
      !Number.isFinite(bounds.right) || !Number.isFinite(bounds.bottom)) {
    throw new PcbInputError("The SVG path has no measurable geometry.");
  }
  return bounds;
}

function readAttributes(text: string) {
  const attributes = new Map<string, string>();
  const pattern = /([A-Za-z_:][\w:.-]*)\s*=\s*(["'])(.*?)\2/g;
  let previousEnd = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (!/^\s*$/.test(text.slice(previousEnd, index))) {
      throw new PcbInputError("The SVG contains malformed attributes.");
    }
    const name = match[1];
    if (attributes.has(name)) throw new PcbInputError(`The SVG repeats the ${name} attribute.`);
    attributes.set(name, match[3]);
    previousEnd = index + match[0].length;
  }
  if (!/^\s*$/.test(text.slice(previousEnd))) {
    throw new PcbInputError("The SVG contains malformed attributes.");
  }
  return attributes;
}

function assertOnlyAttributes(attributes: Map<string, string>, allowed: Set<string>) {
  for (const name of attributes.keys()) {
    if (!allowed.has(name)) throw new PcbInputError(`Unsupported SVG attribute: ${name}.`);
  }
}

function positiveSvgNumber(value: string | undefined, name: string, maximum: number) {
  if (!value || !NUMBER_PATTERN.test(value)) throw new PcbInputError(`The SVG ${name} is invalid.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > maximum) {
    throw new PcbInputError(`The SVG ${name} is outside the supported range.`);
  }
  return parsed;
}

function strokePadding(attributes: Map<string, string>) {
  // Keep the same minimum selection reserve used by the browser baseline so
  // fill-only markers and the one-pixel depth copy cannot fall across a tile edge.
  if (attributes.get("stroke") === "none") return 2 + SVG_RENDERER_BOUND_RESERVE;
  const width = positiveSvgNumber(attributes.get("stroke-width") ?? "1", "stroke width", 1_000);
  const lineJoin = attributes.get("stroke-linejoin") ?? "miter";
  const miterLimit = lineJoin === "miter"
    ? positiveSvgNumber(attributes.get("stroke-miterlimit") ?? "4", "stroke miter limit", 100)
    : 2;
  return Math.max(2, width / 2 * Math.max(2, miterLimit)) + SVG_RENDERER_BOUND_RESERVE;
}

export function parsePcbLensSvg(source: string): PcbSpatialIndex {
  if (new TextEncoder().encode(source).byteLength > MAX_PCB_SOURCE_BYTES) {
    throw new PcbInputError("The PCB source exceeds the 5 MB limit.");
  }
  if (/<\s*(?:script|foreignObject|image|use|iframe|object|embed|style|link|a|metadata)\b|\bon[a-z]+\s*=|\b(?:href|xlink:href)\s*=|url\s*\(|<!|<\?/i.test(source)) {
    throw new PcbInputError("The PCB source contains unsupported or unsafe SVG content.");
  }

  const root = source.match(/^\s*<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/);
  if (!root) throw new PcbInputError("The PCB source requires one SVG root.");
  const rootAttributes = readAttributes(root[1]);
  assertOnlyAttributes(rootAttributes, new Set([
    "xmlns", "viewBox", "data-schema", "data-schema-version", "data-source-schema",
  ]));
  if (rootAttributes.get("xmlns") !== "http://www.w3.org/2000/svg" ||
      rootAttributes.get("data-schema") !== "pcb-art-lens-svg" ||
      rootAttributes.get("data-schema-version") !== "1.0" ||
      rootAttributes.get("data-source-schema") !== "pcb-art-semantic-svg") {
    throw new PcbInputError("The PCB source is not a prepared lens SVG v1.0 asset.");
  }
  const viewBox = rootAttributes.get("viewBox")?.trim().split(/[\s,]+/);
  if (!viewBox || viewBox.length !== 4 || viewBox[0] !== "0" || viewBox[1] !== "0") {
    throw new PcbInputError("The PCB source requires a positive 0 0 width height viewBox.");
  }
  const width = positiveSvgNumber(viewBox[2], "viewBox width", 50_000);
  const height = positiveSvgNumber(viewBox[3], "viewBox height", 50_000);

  const body = root[2];
  const paths: PcbPath[] = [];
  const pathPattern = /<path\b([^>]*)\/>/g;
  let previousEnd = 0;
  for (const match of body.matchAll(pathPattern)) {
    const index = match.index ?? 0;
    if (!/^\s*$/.test(body.slice(previousEnd, index))) {
      throw new PcbInputError("The lens SVG may contain only self-closing path elements.");
    }
    const attributes = readAttributes(match[1]);
    assertOnlyAttributes(attributes, new Set([
      "class", "data-source-kinds", "fill", "stroke", "stroke-width",
      "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "fill-rule", "clip-rule", "d",
    ]));
    if (attributes.get("class") !== "pcb-lens-geometry" ||
        !/^[a-z0-9][a-z0-9 -]*$/.test(attributes.get("data-source-kinds") ?? "")) {
      throw new PcbInputError("Every lens path must retain its geometry classification.");
    }
    if (!new Set(["white", "black", "none"]).has(attributes.get("fill") ?? "") ||
        !new Set(["white", "black", "none"]).has(attributes.get("stroke") ?? "")) {
      throw new PcbInputError("The lens path uses unsupported paint.");
    }
    const lineCap = attributes.get("stroke-linecap");
    const lineJoin = attributes.get("stroke-linejoin");
    if ((lineCap && !new Set(["butt", "round", "square"]).has(lineCap)) ||
        (lineJoin && !new Set(["miter", "round", "bevel"]).has(lineJoin)) ||
        (attributes.get("fill-rule") && !new Set(["nonzero", "evenodd"]).has(attributes.get("fill-rule")!)) ||
        (attributes.get("clip-rule") && !new Set(["nonzero", "evenodd"]).has(attributes.get("clip-rule")!))) {
      throw new PcbInputError("The lens path uses unsupported stroke or fill rules.");
    }
    const geometry = getPcbPathBounds(attributes.get("d") ?? "");
    const padding = strokePadding(attributes);
    paths.push({
      source: match[0],
      left: geometry.left - padding,
      top: geometry.top - padding,
      right: geometry.right + padding,
      bottom: geometry.bottom + padding,
    });
    previousEnd = index + match[0].length;
  }
  if (!/^\s*$/.test(body.slice(previousEnd))) {
    throw new PcbInputError("The lens SVG may contain only self-closing path elements.");
  }
  if (paths.length < 100 || paths.length > 2_500) {
    throw new PcbInputError("The lens SVG must contain between 100 and 2,500 paths.");
  }
  return { width, height, paths };
}

export function selectPcbPaths(index: PcbSpatialIndex, region: PcbRegion) {
  const right = region.x + region.width;
  const bottom = region.y + region.height;
  return index.paths.filter((path) =>
    path.right >= region.x && path.left <= right && path.bottom >= region.y && path.top <= bottom,
  );
}

export const MAX_PCB_BATCH_REGIONS = 8;
export const MAX_PCB_BATCH_QUERY_BYTES = 4096;

export function parsePcbBatchRegions(searchParams: URLSearchParams): PcbRegion[] {
  if (searchParams.getAll("regions").length !== 1 ||
    ["x", "y", "width", "height"].some((name) => searchParams.has(name))) {
    throw new PcbInputError("Expected one regions value without single-region fields.");
  }
  const raw = searchParams.get("regions")!;
  if (new TextEncoder().encode(encodeURIComponent(raw)).byteLength > MAX_PCB_BATCH_QUERY_BYTES) {
    throw new PcbInputError("The PCB region batch query is too large.");
  }
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new PcbInputError("The PCB region batch is invalid JSON."); }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > MAX_PCB_BATCH_REGIONS) {
    throw new PcbInputError("PCB batches require between 1 and 8 regions.");
  }
  return parsed.map((region: unknown) => {
    if (!region || typeof region !== "object" || Array.isArray(region) ||
      Object.keys(region).length !== 4 ||
      ["x", "y", "width", "height"].some((name) =>
        typeof (region as Record<string, unknown>)[name] !== "number")) {
      throw new PcbInputError("Every PCB batch region requires four numeric fields.");
    }
    return parsePcbRegion(new URLSearchParams(
      Object.entries(region).map(([name, value]) => [name, String(value)]),
    ));
  });
}

/** Each unchanged path is serialized once, with ordered selections per region. */
export function selectPcbPathBatch(index: PcbSpatialIndex, regions: PcbRegion[]) {
  const paths: PcbPath[] = [];
  const selections: number[][] = regions.map(() => []);
  for (const path of index.paths) {
    const selected = regions.map((region) => path.right >= region.x &&
      path.left <= region.x + region.width && path.bottom >= region.y &&
      path.top <= region.y + region.height);
    if (!selected.some(Boolean)) continue;
    const pathIndex = paths.length;
    paths.push(path);
    selected.forEach((included, regionIndex) => {
      if (included) selections[regionIndex].push(pathIndex);
    });
  }
  return { paths, regions: selections };
}

function parseQueryNumber(value: string | null, name: string) {
  if (value === null || !NUMBER_PATTERN.test(value)) throw new PcbInputError(`Missing or invalid ${name}.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new PcbInputError(`Missing or invalid ${name}.`);
  return parsed;
}

export function parsePcbRegion(searchParams: URLSearchParams): PcbRegion {
  for (const name of ["x", "y", "width", "height"]) {
    if (searchParams.getAll(name).length !== 1) throw new PcbInputError(`Expected one ${name} value.`);
  }
  const x = parseQueryNumber(searchParams.get("x"), "x");
  const y = parseQueryNumber(searchParams.get("y"), "y");
  const width = parseQueryNumber(searchParams.get("width"), "width");
  const height = parseQueryNumber(searchParams.get("height"), "height");
  if (Math.abs(x) > MAX_PCB_SOURCE_COORDINATE || Math.abs(y) > MAX_PCB_SOURCE_COORDINATE) {
    throw new PcbInputError("The PCB region origin is outside the supported range.");
  }
  if (width <= 0 || height <= 0 || width > MAX_PCB_REGION_DIMENSION || height > MAX_PCB_REGION_DIMENSION) {
    throw new PcbInputError("The PCB region dimensions are outside the supported range.");
  }
  if (!Number.isFinite(x + width) || !Number.isFinite(y + height)) {
    throw new PcbInputError("The PCB region is invalid.");
  }
  return { x, y, width, height };
}

export function resolvePcbSource(source: string, configuredSupabaseUrl: string): PcbSourceTarget {
  if (source === "/pcb-backgrounds/home-lens.svg") {
    return { kind: "local", pathname: source };
  }
  if (!source || source.length > 2_048 || !configuredSupabaseUrl) {
    throw new PcbInputError("The PCB source is not allowed.");
  }

  let candidate: URL;
  let configured: URL;
  try {
    candidate = new URL(source);
    configured = new URL(configuredSupabaseUrl);
  } catch {
    throw new PcbInputError("The PCB source is not allowed.");
  }
  if (!new Set(["http:", "https:"]).has(configured.protocol) || candidate.origin !== configured.origin ||
      candidate.username || candidate.password || candidate.search || candidate.hash) {
    throw new PcbInputError("The PCB source is not allowed.");
  }

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(candidate.pathname);
  } catch {
    throw new PcbInputError("The PCB source path is malformed.");
  }
  if (!decodedPath.startsWith(STORAGE_PREFIX) || decodedPath.includes("%") || decodedPath.includes("\\")) {
    throw new PcbInputError("The PCB source must use the public case-study-assets bucket.");
  }
  const objectPath = decodedPath.slice(STORAGE_PREFIX.length);
  const segments = objectPath.split("/");
  if (!/^[a-z0-9][a-z0-9._/-]*\.svg$/.test(objectPath) ||
      segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new PcbInputError("The PCB source object path is invalid.");
  }
  return { kind: "remote", url: candidate.href };
}
