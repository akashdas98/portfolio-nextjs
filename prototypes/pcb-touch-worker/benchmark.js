/* Standalone browser benchmark; no production imports. */
(() => {
  function makeCore(width, height, ratio) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.strokeStyle = context.fillStyle = "white";
    context.lineCap = context.lineJoin = "round";
    let state = 193713;
    const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let index = 0; index < 680; index++) {
      const x = random() * width;
      const y = random() * height;
      const distance = (28 + random() * 240) * ratio;
      const angle = random() * Math.PI * 2;
      context.lineWidth = (0.7 + random() * 2.6) * ratio;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance);
      context.stroke();
      if (index % 5 === 0) {
        context.beginPath();
        context.arc(x, y, (1.5 + random() * 3) * ratio, 0, 2 * Math.PI);
        context.fill();
      }
    }
    context.globalCompositeOperation = "source-in";
    context.fillStyle = "#9bc9e3";
    context.fillRect(0, 0, width, height);
    return canvas;
  }

  function collectFrames() {
    const gaps = [];
    let running = true;
    let previous;
    const tick = () => {
      const actualNow = performance.now();
      if (previous !== undefined) gaps.push(actualNow - previous);
      previous = actualNow;
      if (running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return { gaps, stop: () => { running = false; } };
  }

  function summarize(values) {
    const sorted = [...values].sort((a, b) => a - b);
    return { count: sorted.length, p95Ms: sorted[Math.floor((sorted.length - 1) * .95)] ?? 0,
      maxMs: sorted.at(-1) ?? 0 };
  }

  function compare(aCanvas, bCanvas) {
    const width = aCanvas.width;
    const height = aCanvas.height;
    const a = aCanvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, width, height).data;
    const b = bCanvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, width, height).data;
    let max = 0, changed = 0, overOne = 0, overFour = 0, nonzeroAlpha = 0;
    for (let offset = 0; offset < a.length; offset += 4) {
      if (a[offset + 3] > 0) nonzeroAlpha++;
      let pixelMax = 0;
      for (let channel = 0; channel < 4; channel++) {
        const aValue = channel === 3 ? a[offset + 3] :
          (a[offset + channel] * a[offset + 3] + 18 * (255 - a[offset + 3])) / 255;
        const bValue = channel === 3 ? b[offset + 3] :
          (b[offset + channel] * b[offset + 3] + 18 * (255 - b[offset + 3])) / 255;
        pixelMax = Math.max(pixelMax, Math.abs(aValue - bValue));
      }
      max = Math.max(max, pixelMax);
      if (pixelMax > .5) changed++;
      if (pixelMax > 1) overOne++;
      if (pixelMax > 4) overFour++;
    }
    return { maxChannel: max, changedPixels: changed, overOne, overFour, nonzeroAlpha };
  }

  function createWorker() {
    const url = URL.createObjectURL(new Blob([window.__pcbWorkerSource], { type: "text/javascript" }));
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    return worker;
  }

  function useWorker(worker, bitmap, width, height, ratio) {
    return new Promise((resolve, reject) => {
      const id = Math.random();
      const timeout = setTimeout(() => reject(new Error("Worker decoration timed out")), 30000);
      worker.onmessage = ({ data }) => {
        if (data.id !== id) return;
        clearTimeout(timeout);
        data.error ? reject(new Error(data.error)) : resolve(data);
      };
      worker.onerror = (error) => { clearTimeout(timeout); reject(new Error(error.message)); };
      worker.postMessage({ id, bitmap, width, height, ratio }, [bitmap]);
    });
  }

  async function runOne(core, ratio, mode, worker) {
    const width = core.width, height = core.height;
    const result = document.createElement("canvas");
    result.width = width; result.height = height;
    const frames = collectFrames();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const started = performance.now();
    let calls = [], workerMs = null, inputBitmapMs = 0, sendMs = 0, returnAndPublishMs = 0;
    if (mode === "main") {
      const first = document.createElement("canvas");
      const second = document.createElement("canvas");
      first.width = second.width = width;
      first.height = second.height = height;
      let source = core;
      for (let pass = 0; pass < 3; pass++) {
        const target = pass % 2 === 0 ? first : second;
        const context = target.getContext("2d");
        context.clearRect(0, 0, width, height);
        context.shadowColor = "rgba(59, 168, 230, 0.72)";
        context.shadowBlur = 8.5 * ratio;
        const callStart = performance.now();
        context.drawImage(source, 0, 0);
        calls.push(performance.now() - callStart);
        source = target;
      }
      const publishStart = performance.now();
      result.getContext("2d").drawImage(first, 0, 0);
      returnAndPublishMs = performance.now() - publishStart;
    } else {
      const inputStart = performance.now();
      const bitmap = await createImageBitmap(core);
      inputBitmapMs = performance.now() - inputStart;
      const sendStart = performance.now();
      const promise = useWorker(worker, bitmap, width, height, ratio);
      sendMs = performance.now() - sendStart;
      const response = await promise;
      workerMs = response.workerMs;
      calls = response.calls;
      const publishStart = performance.now();
      result.getContext("2d").drawImage(response.output, 0, 0);
      response.output.close();
      returnAndPublishMs = performance.now() - publishStart;
    }
    const readyMs = performance.now() - started;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    frames.stop();
    return { mode, readyMs, inputBitmapMs, sendMs, workerMs, returnAndPublishMs,
      calls: summarize(calls), raf: summarize(frames.gaps), canvas: result };
  }

  window.runPcbWorkerBenchmark = async ({ widthCss, heightCss, ratio, repeats }) => {
    if (typeof createImageBitmap !== "function" || typeof Worker !== "function") {
      return { unsupported: { offscreenCanvas: typeof OffscreenCanvas,
        createImageBitmap: typeof createImageBitmap, worker: typeof Worker } };
    }
    const width = Math.round(widthCss * ratio), height = Math.round(heightCss * ratio);
    const core = makeCore(width, height, ratio);
    const worker = createWorker();
    const runs = [];
    let reference, candidate;
    try {
      const workerCapabilities = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Worker capability probe timed out")), 3000);
        worker.onmessage = ({ data }) => { clearTimeout(timeout); resolve(data.capabilities); };
        worker.onerror = (error) => { clearTimeout(timeout); reject(new Error(error.message)); };
        worker.postMessage({ id: "capabilities", capabilities: true });
      });
      if (workerCapabilities.offscreenCanvas !== "function" ||
        workerCapabilities.transferToImageBitmap !== "function") {
        for (let index = 0; index < repeats; index++) {
          const run = await runOne(core, ratio, "main", worker);
          delete run.canvas;
          runs.push(run);
        }
        return { dimensions: { width, height, widthCss, heightCss, ratio },
          capabilities: { mainOffscreenCanvas: typeof OffscreenCanvas, worker: workerCapabilities },
          workerUnsupported: true, runs, difference: null };
      }
      // Warm both paths before recording. Worker startup and JIT are excluded.
      await runOne(core, ratio, "worker", worker);
      await runOne(core, ratio, "main", worker);
      for (let index = 0; index < repeats; index++) {
        for (const mode of index % 2 ? ["worker", "main"] : ["main", "worker"]) {
          const run = await runOne(core, ratio, mode, worker);
          if (mode === "main") reference = run.canvas;
          else candidate = run.canvas;
          delete run.canvas;
          runs.push(run);
        }
      }
      return { dimensions: { width, height, widthCss, heightCss, ratio },
        capabilities: { mainOffscreenCanvas: typeof OffscreenCanvas, worker: workerCapabilities },
        runs, difference: compare(reference, candidate) };
    } finally { worker.terminate(); }
  };
})();
