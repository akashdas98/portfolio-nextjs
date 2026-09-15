export const PCB_COMPOSITION_PLAN_SCHEMA_VERSION = 1;

const MAX_CELLS = 64;
const MAX_CELL_DIMENSION = 512;
const MAX_COMPOSITION_DIMENSION = 50_000;
const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9][0-9]*$/;
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TONES = new Set(["base", "muted", "impact"]);

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

function rectanglesOverlap(first, second) {
  return first.x < second.x + second.width && first.x + first.width > second.x &&
    first.y < second.y + second.height && first.y + first.height > second.y;
}

export function createPcbCompositionPlan(input, expectedCompositionKey) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("The PCB composition plan must be an object.");
  }
  if (input.schemaVersion !== PCB_COMPOSITION_PLAN_SCHEMA_VERSION) {
    throw new Error(`The PCB composition plan must use schemaVersion ${PCB_COMPOSITION_PLAN_SCHEMA_VERSION}.`);
  }
  if (typeof expectedCompositionKey !== "string" || !KEY_PATTERN.test(expectedCompositionKey)) {
    throw new Error("The compiler requires an explicit expected composition key.");
  }
  if (input.compositionKey !== expectedCompositionKey || !KEY_PATTERN.test(input.compositionKey)) {
    throw new Error(`Unexpected PCB composition key ${JSON.stringify(input.compositionKey)}.`);
  }

  const canvas = input.canvas;
  if (!canvas || typeof canvas !== "object" || Array.isArray(canvas)) {
    throw new Error("The PCB composition plan requires a canvas.");
  }
  finiteNumber(canvas.x, "Composition canvas x");
  finiteNumber(canvas.y, "Composition canvas y");
  positiveNumber(canvas.width, "Composition canvas width", MAX_COMPOSITION_DIMENSION);
  positiveNumber(canvas.height, "Composition canvas height", MAX_COMPOSITION_DIMENSION);

  const layout = input.layout;
  if (!layout || typeof layout !== "object" || Array.isArray(layout)) {
    throw new Error("The PCB composition plan requires a layout mapping.");
  }
  positiveNumber(layout.scale, "Layout scale", 1_000);
  finiteNumber(layout.offsetX, "Layout offsetX");
  finiteNumber(layout.offsetY, "Layout offsetY");

  if (!Array.isArray(input.cells) || input.cells.length === 0 || input.cells.length > MAX_CELLS) {
    throw new Error(`The PCB composition plan requires between 1 and ${MAX_CELLS} cells.`);
  }
  const ids = new Set();
  const canvasRight = canvas.x + canvas.width;
  const canvasBottom = canvas.y + canvas.height;
  let coveredArea = 0;
  input.cells.forEach((cell, index) => {
    if (!cell || typeof cell !== "object" || Array.isArray(cell)) {
      throw new Error("Every PCB composition cell must be an object.");
    }
    if (!ID_PATTERN.test(cell.id) || ids.has(cell.id)) {
      throw new Error(`PCB composition cell id ${JSON.stringify(cell.id)} is invalid or duplicated.`);
    }
    ids.add(cell.id);
    finiteNumber(cell.x, `Cell ${cell.id} x`);
    finiteNumber(cell.y, `Cell ${cell.id} y`);
    positiveNumber(cell.width, `Cell ${cell.id} width`, MAX_CELL_DIMENSION);
    positiveNumber(cell.height, `Cell ${cell.id} height`, MAX_CELL_DIMENSION);
    if (typeof cell.empty !== "boolean") {
      throw new Error(`Cell ${cell.id} must explicitly declare whether it is empty.`);
    }
    if (cell.x < canvas.x || cell.y < canvas.y ||
        cell.x + cell.width > canvasRight || cell.y + cell.height > canvasBottom) {
      throw new Error(`Cell ${cell.id} lies outside the composition canvas.`);
    }
    for (let previous = 0; previous < index; previous += 1) {
      if (rectanglesOverlap(cell, input.cells[previous])) {
        throw new Error(`Cells ${input.cells[previous].id} and ${cell.id} overlap.`);
      }
    }
    coveredArea += cell.width * cell.height;
  });
  if (Math.abs(coveredArea - canvas.width * canvas.height) > 1e-6) {
    throw new Error("PCB composition cells must completely cover the canvas without gaps.");
  }

  if (!Array.isArray(input.toneIntervals) || input.toneIntervals.length === 0) {
    throw new Error("The PCB composition plan requires tone intervals.");
  }
  let toneCursor = canvas.y;
  input.toneIntervals.forEach((interval) => {
    if (!interval || typeof interval !== "object" || Array.isArray(interval) || !TONES.has(interval.tone)) {
      throw new Error("Every tone interval requires a supported tone.");
    }
    finiteNumber(interval.top, `Tone ${interval.tone} top`);
    finiteNumber(interval.bottom, `Tone ${interval.tone} bottom`);
    if (interval.top !== toneCursor || interval.bottom <= interval.top || interval.bottom > canvasBottom) {
      throw new Error("Tone intervals must be ordered and completely cover the canvas height.");
    }
    toneCursor = interval.bottom;
  });
  if (toneCursor !== canvasBottom) {
    throw new Error("Tone intervals must be ordered and completely cover the canvas height.");
  }

  return {
    schemaVersion: PCB_COMPOSITION_PLAN_SCHEMA_VERSION,
    compositionKey: input.compositionKey,
    canvas: { ...canvas },
    layout: { ...layout },
    cells: input.cells.map((cell) => ({ ...cell })),
    toneIntervals: input.toneIntervals.map((interval) => ({ ...interval })),
  };
}
