type ProbeMessage = { kind: "probe" };
type DecorationOptions = {
  width: number;
  height: number;
  coreColor: string;
  pixelRatio: number;
  haloColor: string;
  blur: number;
  passes: number;
};
type DecorateMessage = DecorationOptions & {
  kind: "decorate";
  id: number;
  bitmap: ImageBitmap;
};
type RegionPath = {
  data: string;
  fill: "black" | "none" | "white";
  fillRule: CanvasFillRule;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  miterLimit: number;
  stroke: "black" | "none" | "white";
  strokeWidth: number;
};
type RegionTone = DecorationOptions & { tone: "blue" | "pink" };
type DecorateRegionMessage = {
  kind: "decorate-region";
  id: number;
  paths: RegionPath[];
  maskWidth: number;
  maskHeight: number;
  // The same six values passed to the main-thread mask context.setTransform.
  transform: [number, number, number, number, number, number];
  tones: RegionTone[];
};

function regionSupported() {
  if (typeof Path2D !== "function" || typeof OffscreenCanvas !== "function" ||
      typeof OffscreenCanvas.prototype.transferToImageBitmap !== "function") return false;
  try {
    const canvas = new OffscreenCanvas(1, 1);
    const context = canvas.getContext("2d");
    if (!context) return false;
    context.fillStyle = "white";
    context.fill(new Path2D("M0 0H1V1H0Z"), "nonzero");
    return context.getImageData(0, 0, 1, 1).data[3] === 255;
  } catch {
    return false;
  }
}

function paintRegionPath(context: OffscreenCanvasRenderingContext2D, definition: RegionPath) {
  const path = new Path2D(definition.data);
  if (definition.fill !== "none") {
    context.globalCompositeOperation = definition.fill === "white"
      ? "source-over" : "destination-out";
    context.fillStyle = "white";
    context.fill(path, definition.fillRule);
  }
  if (definition.stroke !== "none") {
    context.globalCompositeOperation = definition.stroke === "white"
      ? "source-over" : "destination-out";
    context.strokeStyle = "white";
    context.lineWidth = definition.strokeWidth;
    context.lineCap = definition.lineCap;
    context.lineJoin = definition.lineJoin;
    context.miterLimit = definition.miterLimit;
    context.stroke(path);
  }
}

function drawRegionMask(request: DecorateRegionMessage) {
  const mask = new OffscreenCanvas(request.maskWidth, request.maskHeight);
  const context = mask.getContext("2d");
  if (!context) throw new Error("Worker Canvas 2D is unavailable.");
  context.setTransform(...request.transform);
  for (const path of request.paths) paintRegionPath(context, path);
  context.globalCompositeOperation = "source-over";
  return mask;
}

function decorateMask(mask: CanvasImageSource, maskWidth: number, maskHeight: number,
  options: DecorationOptions) {
  const { width, height, coreColor, pixelRatio, haloColor, blur, passes } = options;
  const first = new OffscreenCanvas(width, height);
  const second = new OffscreenCanvas(width, height);
  const core = new OffscreenCanvas(width, height);
  const coreContext = core.getContext("2d");
  if (!coreContext) throw new Error("Worker Canvas 2D is unavailable.");
  coreContext.drawImage(mask, 0, 0, maskWidth, maskHeight, 0, 0, width, height);
  coreContext.globalCompositeOperation = "source-in";
  coreContext.fillStyle = coreColor;
  coreContext.fillRect(0, 0, width, height);
  coreContext.globalCompositeOperation = "source-over";
  let source: CanvasImageSource = core;
  const calls: number[] = [];
  for (let pass = 0; pass < passes; pass += 1) {
    const target = pass % 2 === 0 ? first : second;
    const context = target.getContext("2d");
    if (!context) throw new Error("Worker Canvas 2D is unavailable.");
    context.clearRect(0, 0, width, height);
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    context.shadowColor = haloColor;
    context.shadowBlur = blur * pixelRatio;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;
    const started = performance.now();
    context.drawImage(source, 0, 0);
    calls.push(performance.now() - started);
    source = target;
  }
  const final = (passes - 1) % 2 === 0 ? first : second;
  return { output: final.transferToImageBitmap(), calls };
}

self.onmessage = (event: MessageEvent<ProbeMessage | DecorateMessage | DecorateRegionMessage>) => {
  const request = event.data;
  if (request.kind === "probe") {
    self.postMessage({
      kind: "probe",
      supported: typeof OffscreenCanvas === "function" &&
        typeof OffscreenCanvas.prototype.transferToImageBitmap === "function",
      regionSupported: regionSupported(),
    });
    return;
  }

  const { id } = request;
  const startedAt = performance.now();
  if (request.kind === "decorate-region") {
    const outputs: { tone: RegionTone["tone"]; output: ImageBitmap; calls: number[] }[] = [];
    try {
      const mask = drawRegionMask(request);
      for (const tone of request.tones) {
        outputs.push({ tone: tone.tone, ...decorateMask(mask, mask.width, mask.height, tone) });
      }
      self.postMessage({
        kind: "decorated-region", id, outputs,
        workerMs: performance.now() - startedAt,
      }, { transfer: outputs.map(({ output }) => output) });
    } catch (error) {
      for (const { output } of outputs) output.close();
      self.postMessage({ kind: "failed", id, error: String(error) });
    }
    return;
  }

  const { bitmap } = request;
  let output: ImageBitmap | null = null;
  try {
    const decorated = decorateMask(bitmap, bitmap.width, bitmap.height, request);
    output = decorated.output;
    self.postMessage({
      kind: "decorated", id, output, calls: decorated.calls,
      workerMs: performance.now() - startedAt,
    }, { transfer: [output] });
  } catch (error) {
    output?.close();
    self.postMessage({ kind: "failed", id, error: String(error) });
  } finally {
    bitmap.close();
  }
};

export {};
