/** Optional halo pass. The regular Canvas decorator remains the fallback. */
import type { TouchCanvasPath, TouchTone } from "./touch-canvas";

export function createTouchHaloWorker() {
  type WorkerResult = {
    output: ImageBitmap;
    workerMs: number;
    calls: number[];
  };
  type Result = WorkerResult & { bitmapMs: number; sendMs: number };
  type Pending = {
    resolve: (result: WorkerResult | null) => void;
    cleanup: () => void;
  };
  type RegionResult = {
    outputs: Array<{ tone: TouchTone; output: ImageBitmap; calls: number[] }>;
    workerMs: number;
    sendMs: number;
  };
  type RegionPending = {
    resolve: (result: RegionResult | null) => void;
    cleanup: () => void;
    sendMs: number;
  };
  let worker: Worker | null = null;
  let ready = false;
  let regionReady = false;
  let unavailable = false;
  let disposed = false;
  let probeTimer: number | null = null;
  let nextId = 0;
  const pending = new Map<number, Pending>();
  const regionPending = new Map<number, RegionPending>();
  const probeWaiters = new Set<(supported: boolean) => void>();

  function finishProbe(supported: boolean) {
    for (const resolve of probeWaiters) resolve(supported);
    probeWaiters.clear();
  }

  function stop(permanent: boolean) {
    if (probeTimer !== null) window.clearTimeout(probeTimer);
    probeTimer = null;
    worker?.terminate();
    worker = null;
    ready = false;
    regionReady = false;
    finishProbe(false);
    if (permanent) unavailable = true;
    for (const entry of pending.values()) {
      entry.cleanup();
      entry.resolve(null);
    }
    pending.clear();
    for (const entry of regionPending.values()) {
      entry.cleanup();
      entry.resolve(null);
    }
    regionPending.clear();
  }

  function start() {
    if (worker || unavailable || disposed) return;
    if (typeof Worker !== "function" || typeof createImageBitmap !== "function" ||
        typeof OffscreenCanvas !== "function") {
      unavailable = true;
      return;
    }
    try {
      const next = new Worker(new URL("./touch-halo-decoration.worker.ts", import.meta.url), {
        type: "module",
      });
      worker = next;
      next.onmessage = (event: MessageEvent) => {
        if (worker !== next) return;
        const message = event.data;
        if (message?.kind === "probe") {
          if (probeTimer !== null) window.clearTimeout(probeTimer);
          probeTimer = null;
          if (message.supported === true) {
            ready = true;
            regionReady = message.regionSupported === true;
            finishProbe(true);
          }
          else stop(true);
          return;
        }
        const entry = pending.get(message?.id);
        const regionEntry = regionPending.get(message?.id);
        if (regionEntry) {
          regionPending.delete(message.id);
          regionEntry.cleanup();
          if (message.kind === "decorated-region" && Array.isArray(message.outputs)) {
            regionEntry.resolve({
              outputs: message.outputs,
              workerMs: message.workerMs,
              sendMs: regionEntry.sendMs,
            });
          } else {
            stop(true);
            regionEntry.resolve(null);
          }
          return;
        }
        if (!entry) {
          if (typeof ImageBitmap === "function" && message?.output instanceof ImageBitmap) {
            message.output.close();
          }
          if (Array.isArray(message?.outputs)) {
            for (const item of message.outputs) {
              if (typeof ImageBitmap === "function" && item?.output instanceof ImageBitmap) {
                item.output.close();
              }
            }
          }
          return;
        }
        pending.delete(message.id);
        entry.cleanup();
        if (message.kind === "decorated" && message.output instanceof ImageBitmap) {
          entry.resolve({
            output: message.output,
            workerMs: message.workerMs,
            calls: message.calls,
          });
        } else {
          stop(true);
          entry.resolve(null);
        }
      };
      next.onerror = () => stop(true);
      next.postMessage({ kind: "probe" });
      probeTimer = window.setTimeout(() => stop(true), 1000);
    } catch {
      stop(true);
    }
  }

  async function decorate(
    mask: HTMLCanvasElement,
    options: {
      width: number;
      height: number;
      coreColor: string;
      pixelRatio: number;
      haloColor: string;
      blur: number;
      passes: number;
    },
    signal: AbortSignal,
  ): Promise<Result | null> {
    start();
    if (!ready && worker) {
      // Do not run full-region shadows on the input thread merely because the
      // worker's capability probe has not answered yet (including after a
      // superseded job restarts the worker).
      const supported = await new Promise<boolean>((resolve, reject) => {
        const settle = (value: boolean) => {
          signal.removeEventListener("abort", abort);
          resolve(value);
        };
        const abort = () => {
          probeWaiters.delete(settle);
          reject(signal.reason);
        };
        probeWaiters.add(settle);
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) abort();
      });
      if (!supported) return null;
    }
    if (!ready || !worker) return null;
    let bitmap: ImageBitmap;
    const bitmapStartedAt = performance.now();
    try {
      bitmap = await createImageBitmap(mask);
    } catch {
      stop(true);
      return null;
    }
    if (signal.aborted || disposed) {
      bitmap.close();
      throw signal.reason;
    }
    const target = worker;
    const bitmapMs = performance.now() - bitmapStartedAt;
    return new Promise<Result | null>((resolve, reject) => {
      const id = ++nextId;
      const timer = window.setTimeout(() => stop(true), 3000);
      const abort = () => {
        pending.delete(id);
        window.clearTimeout(timer);
        // Cancel the obsolete GPU work. The next request awaits the replacement
        // worker's probe instead of falling back to input-thread shadows.
        stop(false);
        reject(signal.reason);
      };
      let sendMs = 0;
      pending.set(id, {
        resolve: (result) => resolve(result ? { ...result, bitmapMs, sendMs } : null),
        cleanup: () => {
          signal.removeEventListener("abort", abort);
          window.clearTimeout(timer);
        },
      });
      signal.addEventListener("abort", abort, { once: true });
      try {
        const sendStartedAt = performance.now();
        target.postMessage({
          kind: "decorate", id, bitmap,
          ...options,
        }, [bitmap]);
        sendMs = performance.now() - sendStartedAt;
      } catch {
        bitmap.close();
        pending.delete(id);
        signal.removeEventListener("abort", abort);
        window.clearTimeout(timer);
        stop(true);
        resolve(null);
      }
    });
  }

  async function decorateRegion(
    request: {
      paths: TouchCanvasPath[];
      maskWidth: number;
      maskHeight: number;
      transform: [number, number, number, number, number, number];
      tones: Array<{
        tone: TouchTone;
        width: number;
        height: number;
        coreColor: string;
        pixelRatio: number;
        haloColor: string;
        blur: number;
        passes: number;
      }>;
    },
    signal: AbortSignal,
  ): Promise<RegionResult | null> {
    start();
    if (!ready && worker) {
      const supported = await new Promise<boolean>((resolve, reject) => {
        const settle = (value: boolean) => {
          signal.removeEventListener("abort", abort);
          resolve(value);
        };
        const abort = () => {
          probeWaiters.delete(settle);
          reject(signal.reason);
        };
        probeWaiters.add(settle);
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) abort();
      });
      if (!supported) return null;
    }
    if (!regionReady || !worker) return null;
    if (signal.aborted || disposed) throw signal.reason;
    const target = worker;
    return new Promise<RegionResult | null>((resolve, reject) => {
      const id = ++nextId;
      const timer = window.setTimeout(() => stop(true), 3000);
      const abort = () => {
        regionPending.delete(id);
        window.clearTimeout(timer);
        stop(false);
        reject(signal.reason);
      };
      const entry: RegionPending = {
        resolve,
        sendMs: 0,
        cleanup: () => {
          signal.removeEventListener("abort", abort);
          window.clearTimeout(timer);
        },
      };
      regionPending.set(id, entry);
      signal.addEventListener("abort", abort, { once: true });
      try {
        const sendStartedAt = performance.now();
        target.postMessage({ kind: "decorate-region", id, ...request });
        entry.sendMs = performance.now() - sendStartedAt;
      } catch {
        regionPending.delete(id);
        entry.cleanup();
        stop(true);
        resolve(null);
      }
    });
  }

  return {
    start,
    decorate,
    decorateRegion,
    dispose() { disposed = true; stop(true); },
  };
}
