import { createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { cpus, platform, tmpdir, totalmem } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";
import sharp from "sharp";
import { parsePcbLensSvg } from "../lib/pcb/spatial.ts";
import { compilePcbDerivatives } from "./pcb-derivative-compiler.mjs";
import { compilePcbSharedDefinitionsCandidate } from "./pcb-shared-definitions-candidate.mjs";
import { createFullLayoutCostComposition, PCB_FULL_LAYOUT_COST_SNAPSHOTS } from "./pcb-full-layout-benchmark.mjs";
import { classifyPixels, distribution, summarizeFrames, summarizeTrace } from "./pcb-browser-benchmark-metrics.mjs";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const execFileAsync = promisify(execFile);
const SOURCE = "public/pcb-backgrounds/home-lens.svg";

// This function is serialized into an otherwise static HTML fixture. Images are
// present in canonical HTML, eager, asynchronous decode, with explicit bounds.
function fixtureInstrumentation() {
  const images = () => [...document.querySelectorAll("img")];
  const decoded = new WeakSet();
  const decodeFailed = new WeakSet();
  const state = (list = images()) => {
    const visible = list.filter((image) => {
      const bounds = image.getBoundingClientRect();
      return bounds.bottom > 0 && bounds.top < innerHeight && bounds.right > 0 && bounds.left < innerWidth;
    });
    return { at: performance.now(), y: scrollY, visible: visible.length,
      unavailable: visible.filter((image) => !decoded.has(image)).length,
      resourceUnavailable: visible.filter((image) => !image.complete || !image.naturalWidth).length,
      failed: visible.filter((image) => decodeFailed.has(image) || (image.complete && !image.naturalWidth)).length };
  };
  const frame = () => new Promise(requestAnimationFrame);
  const bench = window.bench = { frames: [], tiles: [], done: false, replacementDone: false };
  let tracking = true;
  const track = () => {
    if (!tracking) return;
    bench.frames.push(state());
    requestAnimationFrame(track);
  };
  requestAnimationFrame(track);
  const initial = images();
  const initialVisible = initial.filter((image) => image.getBoundingClientRect().top < innerHeight);
  const readiness = initial.map((image, index) => image.decode().then(() => {
    decoded.add(image);
    bench.tiles.push({ index, readyAt: performance.now(), decodeSucceeded: true });
  }, () => {
    decodeFailed.add(image);
    bench.tiles.push({ index, readyAt: performance.now(), decodeSucceeded: false });
  }));
  Promise.all(initialVisible.map((image) => readiness[initial.indexOf(image)])).then(() => {
    bench.firstViewportSettledMs = performance.now();
    bench.firstViewportFailed = initialVisible.filter((image) => decodeFailed.has(image) || !image.naturalWidth).length;
  });
  Promise.all(readiness).then(async () => {
    bench.allTilesSettledMs = performance.now();
    await frame(); await frame();
    tracking = false;
    bench.done = true;
  });
  bench.read = () => ({ firstViewportSettledMs: bench.firstViewportSettledMs,
    firstViewportFailed: bench.firstViewportFailed, allTilesSettledMs: bench.allTilesSettledMs,
    tiles: bench.tiles, frames: bench.frames, viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    resources: performance.getEntriesByType("resource").filter((entry) => entry.initiatorType === "img").map((entry) => ({
      name: entry.name, startTime: entry.startTime, responseEnd: entry.responseEnd,
      duration: entry.duration, transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize, decodedBodySize: entry.decodedBodySize,
    })) });
  bench.traverse = async (durationMs) => {
    const result = {};
    const maximum = document.documentElement.scrollHeight - innerHeight;
    for (const direction of ["down", "return"]) {
      const samples = [];
      const started = performance.now();
      while (true) {
        await frame();
        const elapsed = performance.now() - started;
        const fraction = Math.min(1, elapsed / durationMs);
        scrollTo(0, Math.round(maximum * (direction === "down" ? fraction : 1 - fraction)));
        samples.push(state());
        if (fraction >= 1) break;
      }
      // Include the final scroll's following frame in the observation.
      await frame(); samples.push(state());
      result[direction] = samples;
    }
    return result;
  };
  bench.replace = () => {
    bench.replacementDone = false;
    bench.replacementFrames = [];
    bench.replacementStartedAt = performance.now();
    const next = images().map((image) => {
      const clone = image.cloneNode();
      clone.src = image.src.replace("/original/", "/replacement/");
      image.replaceWith(clone);
      return clone;
    });
    let recording = true;
    const sample = () => {
      bench.replacementFrames.push(state(next));
      if (recording) requestAnimationFrame(sample);
    };
    sample();
    Promise.all(next.map((image) => image.decode().then(() => decoded.add(image), () => decodeFailed.add(image)))).then(async () => {
      bench.replacementSettledAt = performance.now();
      bench.replacementFailed = next.filter((image) => decodeFailed.has(image) || !image.naturalWidth).length;
      await frame(); await frame();
      recording = false;
      bench.replacementDone = true;
    });
    return bench.replacementStartedAt;
  };
}

async function createFixtures(root, snapshots) {
  const source = await readFile(path.join(root, SOURCE), "utf8");
  const index = parsePcbLensSvg(source);
  const sourceSha256 = createHash("sha256").update(source).digest("hex");
  const provenance = ["lib/pcb/spatial.ts", "scripts/pcb-composition-plan.mjs", "scripts/pcb-derivative-compiler.mjs",
    "scripts/pcb-shared-definitions-candidate.mjs", "scripts/pcb-full-layout-benchmark.mjs", "scripts/pcb-browser-cost-benchmark.mjs", "scripts/pcb-browser-benchmark-metrics.mjs"];
  const digest = createHash("sha256");
  for (const filename of provenance) digest.update(filename).update("\0").update((await readFile(path.join(root, filename), "utf8")).replace(/\r\n/g, "\n")).update("\0");
  const compilerSha256 = digest.digest("hex");
  const responses = new Map();
  const layouts = [];
  for (const snapshot of snapshots) {
    const composition = createFullLayoutCostComposition(snapshot, index);
    for (const [variant, compile] of [["baseline", compilePcbDerivatives], ["candidate", compilePcbSharedDefinitionsCandidate]]) {
      const prefix = `/${snapshot.id}/${variant}`;
      let original;
      for (const generation of ["original", "replacement"]) {
        const plan = structuredClone(composition);
        // A distinct but same-sized source projection allows stale-image pixel
        // detection without conflating viewport size, tile count or DPR changes.
        if (generation === "replacement") plan.layout.offsetX += 24;
        const compilation = compile({ source, sourceLabel: SOURCE, compilerSha256,
          composition: plan, expectedCompositionKey: plan.compositionKey, selectionReserveCssPx: 2 });
        if (generation === "original") original = compilation;
        for (const artifact of compilation.artifacts) {
          responses.set(`${prefix}/${generation}/${artifact.id}.svg`, {
            body: gzipSync(artifact.source, { level: 9 }), type: "image/svg+xml", gzip: true,
          });
        }
      }
      const markup = original.artifacts.map((artifact) => {
        const b = artifact.cssBounds;
        return `<img loading="eager" decoding="async" width="${b.width}" height="${b.height}" src="${prefix}/original/${artifact.id}.svg" style="left:${b.x}px;top:${b.y}px;width:${b.width}px;height:${b.height}px">`;
      }).join("");
      const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#8090a0;scroll-behavior:auto}body{width:${snapshot.cssWidth}px;height:${snapshot.cssHeight}px;position:relative}img{position:absolute;display:block}</style>${markup}<script>(${fixtureInstrumentation.toString()})()</script>`;
      responses.set(`${prefix}/`, { body: Buffer.from(html), type: "text/html", gzip: false });
      layouts.push({ snapshot, variant, urlPath: `${prefix}/`, imageCount: original.artifacts.length });
    }
  }
  return { responses, layouts, sourceSha256, compilerSha256 };
}

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.pending = new Map();
    this.events = new Map();
    this.nextId = 0;
    socket.addEventListener("close", () => {
      for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error(`CDP closed during ${pending.method}`)); }
      this.pending.clear();
    });
    socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        clearTimeout(pending.timer);
        if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
        else pending.resolve(message.result);
      } else this.events.get(message.method)?.forEach((callback) => callback(message.params));
    });
  }
  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { socket.close(); reject(new Error(`CDP connection timed out: ${url}`)); }, 10_000);
      socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener("error", (error) => { clearTimeout(timer); reject(error); }, { once: true });
    });
    return new Cdp(socket);
  }
  send(method, params = {}, timeoutMs = 60_000) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method} timed out`)); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer, method });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, callback) {
    if (!this.events.has(method)) this.events.set(method, new Set());
    this.events.get(method).add(callback);
    return () => this.events.get(method)?.delete(callback);
  }
  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  close() { this.socket.close(); }
}

async function launchBrowser(chrome, directory, software) {
  const args = ["--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--hide-scrollbars",
    "--disable-background-networking", "--remote-debugging-port=0", `--user-data-dir=${directory}`, "about:blank"];
  // Windows Chrome otherwise relaunches through an unelevated process and
  // detaches the owned process/stderr handles when invoked by an approved shell.
  if (platform() === "win32") args.push("--do-not-de-elevate");
  if (software) args.push("--disable-gpu");
  const child = spawn(chrome, args, { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (data) => { stderr = (stderr + data).slice(-16_384); });
  let launchError;
  child.on("error", (error) => { launchError = error; });
  const started = Date.now();
  while (!stderr.includes("DevTools listening on ")) {
    if (launchError || child.exitCode !== null || Date.now() - started > 20_000) {
      child.kill();
      throw new Error(`Browser launch failed: ${launchError?.message ?? stderr}`);
    }
    await delay(50);
  }
  const endpoint = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)[1];
  let browser;
  try {
    browser = await Cdp.connect(endpoint);
    const host = new URL(endpoint).host;
    const targets = await (await fetch(`http://${host}/json/list`, { signal: AbortSignal.timeout(5000) })).json();
    const page = await Cdp.connect(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
    return { child, browser, page, args, diagnostics: () => stderr };
  } catch (error) {
    await browser?.send("Browser.close", {}, 2000).catch(() => {});
    browser?.close(); child.kill();
    throw new Error(`${error.message}\n${stderr}`, { cause: error });
  }
}

async function closeBrowser(instance) {
  if (!instance) return;
  await instance.browser.send("Browser.close", {}, 2000).catch(() => {});
  instance.page.close(); instance.browser.close();
  for (let attempt = 0; attempt < 40 && instance.child.exitCode === null; attempt += 1) await delay(50);
  if (instance.child.exitCode === null) instance.child.kill();
}

async function processMemory(browser, page) {
  const processInfo = await browser.send("SystemInfo.getProcessInfo");
  const metrics = await page.send("Performance.getMetrics");
  const jsHeapUsedBytes = metrics.metrics.find((metric) => metric.name === "JSHeapUsedSize")?.value ?? null;
  if (platform() !== "win32") return { jsHeapUsedBytes, osProcessMemory: null, unavailableReason: "OS working/private-byte collection currently implemented only for Windows." };
  const ids = processInfo.processInfo.map((process) => process.id).filter(Number.isSafeInteger);
  try {
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
      `Get-Process -Id ${ids.join(",")} -ErrorAction SilentlyContinue | Select-Object Id,WorkingSet64,PrivateMemorySize64 | ConvertTo-Json -Compress`], { windowsHide: true, timeout: 15_000 });
    const parsed = JSON.parse(stdout);
    const rows = (Array.isArray(parsed) ? parsed : [parsed]).map((row) => ({
      pid: row.Id, type: processInfo.processInfo.find((process) => process.id === row.Id)?.type,
      workingSetBytes: row.WorkingSet64, privateBytes: row.PrivateMemorySize64,
    }));
    return { jsHeapUsedBytes, osProcessMemory: { processes: rows,
      summedWorkingSetBytes: rows.reduce((sum, row) => sum + row.workingSetBytes, 0),
      summedPrivateBytes: rows.reduce((sum, row) => sum + row.privateBytes, 0),
      expectedProcessCount: ids.length, observedProcessCount: rows.length } };
  } catch (error) { return { jsHeapUsedBytes, osProcessMemory: null, unavailableReason: error.message }; }
}

async function traced(browser, operation) {
  const events = [];
  const remove = browser.on("Tracing.dataCollected", (data) => events.push(...data.value));
  let complete;
  const finished = new Promise((resolve) => { complete = resolve; });
  const removeComplete = browser.on("Tracing.tracingComplete", complete);
  let timeout;
  await browser.send("Tracing.start", { categories: "devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame", transferMode: "ReportEvents" });
  try {
    const result = await operation();
    await browser.send("Tracing.end");
    await Promise.race([finished, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("Trace completion timed out")), 15_000); })]);
    return { result, trace: summarizeTrace(events) };
  } finally { clearTimeout(timeout); remove(); removeComplete(); }
}

async function waitFor(page, expression) {
  const started = Date.now();
  while (Date.now() - started < 45_000) {
    if (await page.evaluate(expression).catch(() => false)) return;
    await delay(20);
  }
  throw new Error(`Fixture timed out: ${expression}`);
}

async function screenshot(page) {
  const startedAt = await page.evaluate("performance.now()");
  const image = await page.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const endedAt = await page.evaluate("performance.now()");
  const pixels = await sharp(Buffer.from(image.data, "base64")).removeAlpha().raw().toBuffer();
  return { startedAt, endedAt, pixels };
}

async function trial(instance, url, options) {
  const { page, browser } = instance;
  await page.send("Page.enable");
  await page.send("Network.enable");
  await page.send("Performance.enable");
  await page.send("Emulation.setDeviceMetricsOverride", { width: options.width, height: options.viewportHeight, deviceScaleFactor: options.dpr, mobile: false });
  const memoryBefore = await processMemory(browser, page);
  const navigations = {};
  for (const cache of ["cold", "warm"]) {
    process.stderr.write(`  ${cache} load\n`);
    if (cache === "cold") await page.send("Network.clearBrowserCache");
    else {
      await page.send("Page.navigate", { url: "about:blank" });
      await waitFor(page, "location.href === 'about:blank'");
    }
    const responseEvidence = [];
    const removeResponses = page.on("Network.responseReceived", ({ type, response }) => {
      if (type === "Image") responseEvidence.push({ url: response.url, status: response.status, fromDiskCache: response.fromDiskCache ?? false });
    });
    const read = await traced(browser, async () => {
      await page.send("Page.navigate", { url });
      await waitFor(page, "window.bench?.done === true");
      return page.evaluate("bench.read()");
    });
    removeResponses();
    const viewport = read.result.viewport;
    if (viewport.width !== options.width || viewport.height !== options.viewportHeight || viewport.dpr !== options.dpr) {
      throw new Error(`Fixture viewport/DPR mismatch: ${JSON.stringify(viewport)}`);
    }
    if (read.result.tiles.length !== options.imageCount) throw new Error("Fixture image-readiness sample count mismatch");
    process.stderr.write(`  ${cache} traversal\n`);
    const traversal = await traced(browser, () => page.evaluate(`bench.traverse(${options.traverseMs})`));
    navigations[cache] = { readiness: { ...read.result, frames: summarizeFrames(read.result.frames), tileSettledMs: distribution(read.result.tiles.map((tile) => tile.readyAt)) },
      responses: responseEvidence, loadTrace: read.trace,
      traversal: { down: summarizeFrames(traversal.result.down), return: summarizeFrames(traversal.result.return), trace: traversal.trace },
      memoryAfterTraversal: await processMemory(browser, page) };
  }
  // A separate instrumented visual diagnostic, deliberately excluded from the
  // benchmark timing phases above. Captures have variable latency and do not
  // establish every presented frame or physical-screen blank/stale durations.
  const before = await screenshot(page);
  process.stderr.write("  sampled replacement diagnostic\n");
  const replacementStartedAt = await page.evaluate("bench.replace()");
  const captures = [];
  for (let index = 0; index < 12; index += 1) {
    captures.push(await screenshot(page));
    if (await page.evaluate("bench.replacementDone")) break;
  }
  await waitFor(page, "bench.replacementDone");
  const after = await screenshot(page);
  const replacement = await page.evaluate("({ frames: bench.replacementFrames, settledAt: bench.replacementSettledAt, failed: bench.replacementFailed })");
  return { memoryBefore, navigations, replacement: { policy: "immediate DOM image replacement; cold generation URLs; source projection shifted +24 CSS px",
    startedAt: replacementStartedAt, settledMs: replacement.settledAt - replacementStartedAt,
    failed: replacement.failed, dom: summarizeFrames(replacement.frames),
    screenshotSamples: captures.map((capture) => ({ startMs: capture.startedAt - replacementStartedAt, endMs: capture.endedAt - replacementStartedAt,
      ...classifyPixels(capture.pixels, before.pixels, after.pixels) })),
    settledReference: classifyPixels(after.pixels, before.pixels, after.pixels) } };
}

function aggregate(trials) {
  return ["baseline", "candidate"].map((variant) => ({ variant,
    layouts: [...new Set(trials.map((trial) => trial.snapshot.id))].map((snapshot) => {
      const rows = trials.filter((trial) => trial.variant === variant && trial.snapshot.id === snapshot);
      return { snapshot, navigations: Object.fromEntries(["cold", "warm"].map((cache) => [cache, {
        firstViewportSettledMs: distribution(rows.map((row) => row.navigations[cache].readiness.firstViewportSettledMs)),
        allTilesSettledMs: distribution(rows.map((row) => row.navigations[cache].readiness.allTilesSettledMs)),
        privateBytes: distribution(rows.map((row) => row.navigations[cache].memoryAfterTraversal.osProcessMemory?.summedPrivateBytes)),
        workingSetBytes: distribution(rows.map((row) => row.navigations[cache].memoryAfterTraversal.osProcessMemory?.summedWorkingSetBytes)),
        downFrameP95Ms: distribution(rows.map((row) => row.navigations[cache].traversal.down.intervalMs.p95)),
        returnFrameP95Ms: distribution(rows.map((row) => row.navigations[cache].traversal.return.intervalMs.p95)),
        paintThreadMs: distribution(rows.map((row) => row.navigations[cache].loadTrace.Paint.summedThreadDurationMs)),
        rasterThreadMs: distribution(rows.map((row) => row.navigations[cache].loadTrace.RasterTask.summedThreadDurationMs)),
      }])) };
    }),
  }));
}

async function main() {
  const options = { trials: 3, dpr: 1, viewportHeight: 900, traverseMs: 2000, software: true, layout: "all" };
  for (const argument of process.argv.slice(2)) {
    const match = argument.match(/^--(trials|dpr|viewport-height|traverse-ms|layout)=(.+)$/);
    if (argument === "--gpu") options.software = false;
    else if (match) {
      const key = { "viewport-height": "viewportHeight", "traverse-ms": "traverseMs" }[match[1]] ?? match[1];
      options[key] = key === "layout" ? match[2] : Number(match[2]);
    } else throw new Error(`Unknown argument ${argument}`);
  }
  for (const key of ["trials", "dpr", "viewportHeight", "traverseMs"]) {
    if (!Number.isFinite(options[key]) || options[key] <= 0) throw new Error(`Invalid ${key}`);
  }
  if (!Number.isInteger(options.trials)) throw new Error("Trials must be an integer");
  const snapshots = PCB_FULL_LAYOUT_COST_SNAPSHOTS.filter((snapshot) => options.layout === "all" || snapshot.id === options.layout);
  if (!snapshots.length) throw new Error("Unknown measured layout id");
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const candidates = [process.env.CHROME_PATH, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].filter(Boolean);
  let chrome;
  for (const candidate of candidates) { try { await access(candidate); chrome = candidate; break; } catch {} }
  if (!chrome) throw new Error("Set CHROME_PATH to an installed Chromium executable");
  process.stderr.write("Compiling temporary in-memory baseline/candidate full-layout fixtures...\n");
  const fixtures = await createFixtures(root, snapshots);
  const server = createServer((request, response) => {
    const fixture = fixtures.responses.get(new URL(request.url, "http://localhost").pathname);
    if (!fixture) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { "Content-Type": fixture.type, "Content-Length": fixture.body.length,
      "Cache-Control": fixture.gzip ? "public,max-age=3600,immutable" : "no-store",
      ...(fixture.gzip ? { "Content-Encoding": "gzip" } : {}) });
    response.end(fixture.body);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const tempRoot = await mkdtemp(path.join(tmpdir(), "pcb-browser-cost-"));
  const trials = [];
  const environments = [];
  let active;
  try {
    for (let repetition = 0; repetition < options.trials; repetition += 1) {
      // Alternation limits systematic ordering/thermal bias. Each member gets
      // its own process/profile; warm navigation reuses only its own cache.
      const ordered = repetition % 2 ? [...fixtures.layouts].reverse() : fixtures.layouts;
      for (const fixture of ordered) {
        process.stderr.write(`Trial ${repetition + 1}/${options.trials} ${fixture.snapshot.id} ${fixture.variant}\n`);
        active = await launchBrowser(chrome, path.join(tempRoot, `profile-${repetition}-${fixture.snapshot.id}-${fixture.variant}`), options.software);
        const version = await active.browser.send("Browser.getVersion");
        const info = await active.browser.send("SystemInfo.getInfo").catch((error) => ({ unavailable: error.message }));
        environments.push({ repetition, snapshot: fixture.snapshot.id, variant: fixture.variant, version, gpu: info.gpu ?? info });
        const result = await trial(active, `http://127.0.0.1:${server.address().port}${fixture.urlPath}`, { ...options, width: fixture.snapshot.cssWidth, imageCount: fixture.imageCount });
        trials.push({ repetition, snapshot: fixture.snapshot, variant: fixture.variant, imageCount: fixture.imageCount, ...result });
        await closeBrowser(active); active = null;
      }
    }
    process.stdout.write(`${JSON.stringify({ schema: "pcb-browser-cost-ab-benchmark", schemaVersion: 1, productionContract: false,
      generatedAt: new Date().toISOString(), sourceSha256: fixtures.sourceSha256, compilerSha256: fixtures.compilerSha256, options,
      environment: { platform: platform(), cpu: cpus()[0]?.model, logicalCpus: cpus().length, totalMemoryBytes: totalmem(), chrome,
        requestedPaintPath: options.software ? "headless Chromium --disable-gpu; software paint" : "headless Chromium GPU requested; inspect reported featureStatus", browsers: environments },
      limitations: [
        "Historical page dimensions and one base-tone interval; this is a geometry-only fixture, without foreground app content or glow.",
        "Fresh profiles establish HTTP-cache cold loads, not cold OS file cache, cold hardware, or browser-startup timing. Warm navigation retains the same browser/process and HTTP cache; inspect response evidence.",
        "Image.decode settlement includes request/parse/decode scheduling; it is not isolated decoder CPU time or proof pixels were presented. Failed decodes are reported separately.",
        "Working sets summed across processes double-count shared pages; private bytes measure process commit, not exclusive physical residency or isolated SVG allocation. Samples follow traversal; no peak-memory claim.",
        "Trace complete-event durations are summed thread work and may overlap or nest; they are not elapsed time. Missing event names are zero observed events, not proof of no work.",
        "rAF samples measure main-thread scheduling under programmatic scroll, not compositor presentation, touch latency, physical-device scrolling or dropped display frames.",
        "Replacement screenshots are a separate intrusive sampled diagnostic. Capture time is bounded by start/end timestamps; unsampled blank/stale frames and exact presented durations remain unmeasured. DOM unavailableMs is only left-sampled image.decode readiness, not pixel blanking.",
        "No mobile, WebKit, GPU, production renderer, network latency, lazy-loading, interaction-glow or physical-iPhone conclusion follows from a software Chromium fixture.",
      ], summary: aggregate(trials), trials }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Browser diagnostic: ${active?.diagnostics() ?? "no active browser"}\n`);
    throw error;
  } finally {
    await closeBrowser(active);
    await new Promise((resolve) => server.close(resolve));
    // tempRoot is exclusively owned, produced by mkdtemp, never repository state.
    await rm(tempRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 });
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main();
