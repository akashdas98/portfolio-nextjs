/* Isolated worker decoration path. Input and output ImageBitmaps transfer ownership. */
self.onmessage = ({ data }) => {
  if (data.capabilities) {
    self.postMessage({ id: data.id, capabilities: {
      offscreenCanvas: typeof OffscreenCanvas,
      imageBitmap: typeof ImageBitmap,
      transferToImageBitmap: typeof OffscreenCanvas === "function" &&
        typeof OffscreenCanvas.prototype.transferToImageBitmap,
    } });
    return;
  }
  const { id, bitmap, width, height, ratio } = data;
  try {
    const first = new OffscreenCanvas(width, height);
    const second = new OffscreenCanvas(width, height);
    let source = bitmap;
    const calls = [];
    const started = performance.now();
    for (let pass = 0; pass < 3; pass++) {
      const target = pass % 2 === 0 ? first : second;
      const context = target.getContext("2d");
      context.clearRect(0, 0, width, height);
      context.shadowColor = "rgba(59, 168, 230, 0.72)";
      context.shadowBlur = 8.5 * ratio;
      context.shadowOffsetX = 0;
      context.shadowOffsetY = 0;
      const callStart = performance.now();
      context.drawImage(source, 0, 0);
      calls.push(performance.now() - callStart);
      source = target;
    }
    bitmap.close();
    const output = first.transferToImageBitmap();
    self.postMessage({ id, output, workerMs: performance.now() - started, calls }, [output]);
  } catch (error) {
    bitmap.close();
    self.postMessage({ id, error: String(error) });
  }
};
