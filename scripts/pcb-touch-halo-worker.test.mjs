import assert from "node:assert/strict";
import test from "node:test";
import { createTouchHaloWorker } from "../lib/pcb/touch-halo-worker.ts";

test("superseding a halo job never forces the next region onto input-thread shadows", async () => {
  const previous = {
    Worker: globalThis.Worker,
    ImageBitmap: globalThis.ImageBitmap,
    OffscreenCanvas: globalThis.OffscreenCanvas,
    createImageBitmap: globalThis.createImageBitmap,
    window: globalThis.window,
  };
  const instances = [];
  class Bitmap {
    closed = false;
    close() { this.closed = true; }
  }
  class MockWorker {
    constructor() {
      this.jobs = [];
      this.terminated = false;
      instances.push(this);
    }
    postMessage(message) {
      if (message.kind === "probe") {
        queueMicrotask(() => this.onmessage({ data: { kind: "probe", supported: true } }));
      } else {
        this.jobs.push(message);
      }
    }
    terminate() { this.terminated = true; }
    complete(index) {
      const output = new Bitmap();
      this.onmessage({ data: {
        kind: "decorated", id: this.jobs[index].id,
        output, workerMs: 1, calls: [],
      } });
      return output;
    }
  }
  Object.assign(globalThis, {
    Worker: MockWorker,
    ImageBitmap: Bitmap,
    OffscreenCanvas: class {},
    createImageBitmap: async () => new Bitmap(),
    window: globalThis,
  });
  const halo = createTouchHaloWorker();
  try {
    halo.start();
    await Promise.resolve();
    const options = {
      width: 8, height: 8, coreColor: "white", pixelRatio: 1,
      haloColor: "pink", blur: 2, passes: 3,
    };
    const firstController = new AbortController();
    const first = halo.decorate({}, options, firstController.signal);
    await Promise.resolve();
    assert.equal(instances[0].jobs.length, 1);
    firstController.abort(new Error("superseded"));
    await assert.rejects(first, /superseded/);
    assert.equal(instances[0].terminated, true);

    const second = halo.decorate({}, options, new AbortController().signal);
    for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();
    assert.equal(instances.length, 2, "the obsolete job is cancelled in a replacement worker");
    assert.equal(instances[1].jobs.length, 1, "probe wait must not choose the Canvas fallback");
    const output = instances[1].complete(0);
    assert.equal((await second)?.output, output);
  } finally {
    halo.dispose();
    Object.assign(globalThis, previous);
  }
});

test("worker-owned region preparation sends paths once and returns both tones", async () => {
  const previous = {
    Worker: globalThis.Worker,
    ImageBitmap: globalThis.ImageBitmap,
    OffscreenCanvas: globalThis.OffscreenCanvas,
    createImageBitmap: globalThis.createImageBitmap,
    window: globalThis.window,
  };
  class Bitmap { close() {} }
  let worker;
  class MockWorker {
    constructor() { worker = this; }
    postMessage(message) {
      if (message.kind === "probe") {
        queueMicrotask(() => this.onmessage({ data: {
          kind: "probe", supported: true, regionSupported: true,
        } }));
      } else {
        this.request = message;
      }
    }
    terminate() {}
  }
  Object.assign(globalThis, {
    Worker: MockWorker,
    ImageBitmap: Bitmap,
    OffscreenCanvas: class {},
    createImageBitmap: async () => { throw new Error("main-thread bitmap copy used"); },
    window: globalThis,
  });
  const halo = createTouchHaloWorker();
  try {
    const request = {
      paths: [{ data: "M0 0H1V1Z", fill: "white", stroke: "none" }],
      maskWidth: 8,
      maskHeight: 8,
      transform: [1, 0, 0, 1, 0, 0],
      tones: ["blue", "pink"].map((tone) => ({
        tone, width: 8, height: 8, coreColor: "white", pixelRatio: 1,
        haloColor: tone, blur: 2, passes: 3,
      })),
    };
    const work = halo.decorateRegion(request, new AbortController().signal);
    for (let turn = 0; turn < 5 && !worker?.request; turn += 1) await Promise.resolve();
    assert.equal(worker.request.kind, "decorate-region");
    assert.equal(worker.request.paths.length, 1);
    assert.deepEqual(worker.request.tones.map((item) => item.tone), ["blue", "pink"]);
    const outputs = ["blue", "pink"].map((tone) => ({ tone, output: new Bitmap(), calls: [] }));
    worker.onmessage({ data: {
      kind: "decorated-region", id: worker.request.id, outputs, workerMs: 4,
    } });
    const result = await work;
    assert.equal(result.outputs.length, 2);
    assert.equal(result.workerMs, 4);
  } finally {
    halo.dispose();
    Object.assign(globalThis, previous);
  }
});
