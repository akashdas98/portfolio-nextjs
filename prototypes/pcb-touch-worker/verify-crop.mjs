import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const directory = path.dirname(fileURLToPath(import.meta.url));
const workerSource = ts.transpileModule(
  await readFile(path.join(directory, "../../lib/pcb/touch-halo-decoration.worker.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText.replace(/export \{\};?\s*$/, "");

const links = path.join(process.env.LOCALAPPDATA ?? "", "ms-playwright", ".links");
let playwright;
for (const name of await readdir(links)) {
  const core = (await readFile(path.join(links, name), "utf8")).trim();
  try {
    playwright = await import(pathToFileURL(path.join(path.dirname(core), "playwright", "index.mjs")).href);
    break;
  } catch { /* Try the next Playwright link. */ }
}
if (!playwright) throw new Error("No linked Playwright installation was found.");
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await playwright.chromium.launch(
  existsSync(chrome) ? { headless: true, executablePath: chrome } : { headless: true },
);
try {
  const page = await browser.newPage();
  const result = await page.evaluate(async (source) => {
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    const worker = new Worker(url);
    try {
      const request = (message, transfer = []) => new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Worker response timed out")), 5000);
        worker.onmessage = ({ data }) => { clearTimeout(timeout); resolve(data); };
        worker.onerror = ({ message: error }) => {
          clearTimeout(timeout);
          reject(new Error(error || "Worker failed"));
        };
        worker.postMessage(message, transfer);
      });
      const width = 384;
      const height = 280;
      const mask = document.createElement("canvas");
      mask.width = width;
      mask.height = height;
      const maskContext = mask.getContext("2d");
      maskContext.strokeStyle = "white";
      maskContext.lineWidth = 3;
      for (let index = 0; index < 40; index += 1) {
        maskContext.beginPath();
        maskContext.moveTo(12 + index * 8, 8);
        maskContext.lineTo(360 - index * 3, 252);
        maskContext.stroke();
      }
      const color = "#edf9ff";
      const halo = "rgb(0 124 255 / 0.95)";
      const core = document.createElement("canvas");
      const first = document.createElement("canvas");
      const second = document.createElement("canvas");
      for (const canvas of [core, first, second]) {
        canvas.width = width;
        canvas.height = height;
      }
      const coreContext = core.getContext("2d");
      coreContext.drawImage(mask, 0, 0, width, height, 0, 0, width, height);
      coreContext.globalCompositeOperation = "source-in";
      coreContext.fillStyle = color;
      coreContext.fillRect(0, 0, width, height);
      let input = core;
      for (let pass = 0; pass < 3; pass += 1) {
        const target = pass % 2 === 0 ? first : second;
        const context = target.getContext("2d");
        context.clearRect(0, 0, width, height);
        context.shadowColor = halo;
        context.shadowBlur = 8.5;
        context.drawImage(input, 0, 0);
        input = target;
      }
      const probe = await request({ kind: "probe" });
      if (!probe.supported) return { unsupported: true };
      const bitmap = await createImageBitmap(mask);
      const response = await request({
          kind: "decorate", id: 1, bitmap, width, height,
          coreColor: color, pixelRatio: 1, haloColor: halo, blur: 8.5, passes: 3,
        }, [bitmap]);
      if (response.kind !== "decorated") throw new Error(response.error);
      const reference = document.createElement("canvas");
      const candidate = document.createElement("canvas");
      reference.width = candidate.width = 180;
      reference.height = candidate.height = 170;
      reference.getContext("2d").drawImage(first, 66, 44, 230, 218, 0, 0, 180, 170);
      candidate.getContext("2d").drawImage(response.output, 66, 44, 230, 218, 0, 0, 180, 170);
      response.output.close();
      const a = reference.getContext("2d").getImageData(0, 0, 180, 170).data;
      const b = candidate.getContext("2d").getImageData(0, 0, 180, 170).data;
      let changed = 0;
      let maxDifference = 0;
      for (let index = 0; index < a.length; index += 1) {
        const difference = Math.abs(a[index] - b[index]);
        if (difference) changed += 1;
        maxDifference = Math.max(maxDifference, difference);
      }
      return { changed, maxDifference };
    } finally {
      worker.terminate();
      URL.revokeObjectURL(url);
    }
  }, workerSource);
  assert.deepEqual(result, { changed: 0, maxDifference: 0 });
  process.stdout.write(`Direct worker ImageBitmap crop matches Canvas: ${JSON.stringify(result)}\n`);
} finally {
  await browser.close();
}
