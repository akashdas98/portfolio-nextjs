import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { cpus, platform, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

import { parsePcbLensSvg, selectPcbPaths } from "../lib/pcb/spatial.ts";
import { createEnvelopeDirections, envelopeContourPath } from "../lib/pcb/envelope-evaluator.ts";

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.pending = new Map();
    this.events = new Map();
    this.nextId = 0;
    socket.addEventListener("close", () => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error(`CDP closed during ${pending.method}`));
      }
      this.pending.clear();
    });
    socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
        else pending.resolve(message.result);
      } else {
        for (const listener of this.events.get(message.method) ?? []) listener(message.params);
      }
    });
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`CDP connection timed out: ${url}`)), 10_000);
      socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    return new Cdp(socket);
  }

  send(method, params = {}, timeoutMs = 30_000) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, timeoutMs);
      this.pending.set(id, { method, reject, resolve, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const response = await this.send("Runtime.evaluate", {
      awaitPromise: true,
      expression,
      returnByValue: true,
    });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  }

  close() {
    this.socket.close();
  }
}

async function launchChrome(executable, profile) {
  const args = [
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-extensions",
    "--disable-gpu",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ];
  if (platform() === "win32") args.push("--do-not-de-elevate");
  const child = spawn(executable, args, { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr = (stderr + chunk).slice(-32_768); });
  const started = Date.now();
  while (!stderr.includes("DevTools listening on ")) {
    if (child.exitCode !== null || Date.now() - started > 20_000) {
      child.kill();
      throw new Error(`Chrome launch failed: ${stderr}`);
    }
    await delay(40);
  }
  const browser = await Cdp.connect(stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)[1]);
  const endpoint = new URL(stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)[1]);
  const targets = await (await fetch(`http://${endpoint.host}/json/list`)).json();
  const page = await Cdp.connect(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
  return { browser, child, page, stderr: () => stderr };
}

async function closeChrome(instance) {
  if (!instance) return;
  await instance.browser.send("Browser.close", {}, 2_000).catch(() => {});
  instance.page.close();
  instance.browser.close();
  for (let index = 0; index < 40 && instance.child.exitCode === null; index += 1) await delay(50);
  if (instance.child.exitCode === null) instance.child.kill();
}

async function waitFor(page, expression, timeoutMs = 15_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await page.evaluate(expression).catch(() => false)) return;
    await delay(15);
  }
  throw new Error(`Fixture timed out: ${expression}`);
}

async function createFixture() {
  const directory = path.join(root, "prototypes", "pcb-touch-native-svg");
  const [source, runtime, model, css] = await Promise.all([
    readFile(path.join(root, "public", "pcb-backgrounds", "home-lens.svg"), "utf8"),
    readFile(path.join(directory, "fixture-runtime.mjs")),
    readFile(path.join(directory, "model.mjs")),
    readFile(path.join(directory, "fixture.css")),
  ]);
  const index = parsePcbLensSvg(source);
  const envelopeConfig = {
    baseRadius: 247.5,
    directions: createEnvelopeDirections(256),
    maxDisplacement: 54,
    tinyMaxDisplacement: 14,
    warpStart: .68,
  };
  const restingDisplacements = new Array(256).fill(0);
  const envelopeStops = [[0, .96], [.08, .94], [.3, .82], [.5, .62], [.68, .38], [.8, .2], [.9, .08], [.96, .01], [1, 0]];
  const opacityAt = (offset) => {
    const upperIndex = envelopeStops.findIndex(([position]) => position >= offset);
    if (upperIndex <= 0) return envelopeStops[0][1];
    const [upperOffset, upperOpacity] = envelopeStops[upperIndex];
    const [lowerOffset, lowerOpacity] = envelopeStops[upperIndex - 1];
    return lowerOpacity + (upperOpacity - lowerOpacity) * (offset - lowerOffset) / (upperOffset - lowerOffset);
  };
  const envelopeContours = Array.from({ length: 128 }, (_, contourIndex) => {
    const offset = (128 - contourIndex) / 128;
    return {
      luminance: Math.round(opacityAt(offset - 1 / 256) * 255),
      path: envelopeContourPath(offset, restingDisplacements, 307.5, envelopeConfig),
    };
  });
  const html = Buffer.from(`<!doctype html>
    <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
    <link rel="stylesheet" href="/fixture.css"></head><body><main data-pcb-page><img class="pcb-source" src="/source.svg" alt=""></main>
    <script>window.__PCB_TOUCH_FIXTURE__={sourceWidth:${index.width},sourceHeight:${index.height},envelopeContours:${JSON.stringify(envelopeContours)},forceReducedMotion:new URLSearchParams(location.search).has("reduced")}</script>
    <script type="module" src="/fixture-runtime.mjs"></script></body></html>`);
  return { css, html, index, model, runtime, source: Buffer.from(source) };
}

function send(response, status, type, body, cache = "no-store") {
  response.writeHead(status, {
    "Cache-Control": cache,
    "Content-Length": body.byteLength,
    "Content-Type": type,
  });
  response.end(body);
}

async function deterministicReplay(page) {
  const replay = (action) => page.evaluate(`pcbTouchPrototype.replay(${JSON.stringify(action)})`);
  let snapshot = await replay({ type: "contact", at: 0, id: 1, x: 195, y: 420 });
  assert.equal(snapshot.state.phase, "contact");
  assert.equal(snapshot.metrics.coldWarmContacts[0].cache, "cold");
  assert.equal(snapshot.visual.lensDiameter, 615);
  assert.equal(snapshot.visual.flameLobes, 10);
  assert.equal(snapshot.visual.globalFlicker, 1);
  assert.equal(snapshot.visual.haloBands, 1);
  assert.equal(snapshot.visual.jitterPaths, 0);
  assert.ok(snapshot.metrics.pathCounts.at(-1) > 0);

  snapshot = await replay({ type: "contact", at: 1, id: 2, x: 360, y: 800 });
  assert.equal(snapshot.state.activeTouchId, 1);
  assert.deepEqual(snapshot.state.point, { x: 195, y: 420 });

  snapshot = await replay({ type: "move", source: "drag", at: 100, id: 1, x: 290, y: 485 });
  assert.deepEqual(snapshot.state.point, { x: 290, y: 485 });
  assert.ok(snapshot.metrics.trailEmitted >= 1);
  const firstTrail = snapshot.trails[0];
  assert.equal(firstTrail.geometryHash, firstTrail.liveHash);
  assert.equal(firstTrail.pathCount, firstTrail.sourceIndexes.length);
  assert.ok(firstTrail.sourceIndexes.every((value, index, values) => index === 0 || value > values[index - 1]));

  snapshot = await replay({ type: "move", source: "scroll", at: 200, id: 1, x: 290, y: 700 });
  assert.deepEqual(snapshot.state.point, { x: 290, y: 700 });
  assert.ok(snapshot.metrics.trailEmitted >= 2);
  assert.equal(snapshot.trails[0].geometryHash, firstTrail.geometryHash);
  assert.equal(snapshot.trails[0].liveHash, firstTrail.liveHash);

  snapshot = await replay({ type: "release", at: 300, id: 1 });
  assert.equal(snapshot.state.phase, "hold");
  snapshot = await page.evaluate("pcbTouchPrototype.advance(6299)");
  assert.equal(snapshot.state.phase, "hold");
  snapshot = await page.evaluate("pcbTouchPrototype.advance(6300)");
  assert.equal(snapshot.state.phase, "fading");
  snapshot = await page.evaluate("pcbTouchPrototype.advance(6999)");
  assert.equal(snapshot.state.phase, "fading");
  snapshot = await page.evaluate("pcbTouchPrototype.advance(7000)");
  assert.equal(snapshot.state.phase, "idle");

  snapshot = await replay({ type: "contact", at: 7_100, id: 3, x: 195, y: 420 });
  assert.equal(snapshot.metrics.coldWarmContacts.at(-1).cache, "warm");
  snapshot = await replay({ type: "cancel", at: 7_200, id: 3 });
  assert.equal(snapshot.state.phase, "hold");
  snapshot = await page.evaluate("pcbTouchPrototype.advance(13250)");
  assert.equal(snapshot.state.phase, "fading");
  snapshot = await replay({ type: "contact", at: 13_260, id: 4, x: 240, y: 460 });
  assert.equal(snapshot.state.phase, "contact");
  assert.equal(snapshot.state.holdUntil, null);
  assert.equal(snapshot.state.fadeUntil, null);

  assert.equal(snapshot.metrics.layoutReadsAfterSvgWrite, 0);
  assert.equal(snapshot.metrics.maxPendingFrames, 1);
  assert.equal(snapshot.metrics.maxConcurrentCommits, 1);
  assert.ok(snapshot.metrics.cacheMisses >= 1);
  assert.ok(snapshot.metrics.cacheHits >= 1);
  assert.ok(snapshot.metrics.eventToCommitMs.every(Number.isFinite));
  assert.ok(snapshot.metrics.handlerMs.length > 0);
  assert.ok(snapshot.metrics.modelMs.length > 0);
  assert.ok(snapshot.metrics.writeMs.length > 0);
  assert.ok(Array.isArray(snapshot.metrics.frameGapsMs));
  assert.ok(Array.isArray(snapshot.metrics.longTasks));
  assert.ok(snapshot.metrics.pathCounts.every((count) => count > 0 && count < fixturePathCount));
  return snapshot;
}

let fixturePathCount = 0;

async function main() {
  const fixture = await createFixture();
  fixturePathCount = fixture.index.paths.length;
  const sourceIndexes = new Map(fixture.index.paths.map((entry, index) => [entry, index]));
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname === "/") return send(response, 200, "text/html; charset=utf-8", fixture.html);
    if (url.pathname === "/fixture.css") return send(response, 200, "text/css; charset=utf-8", fixture.css);
    if (url.pathname === "/fixture-runtime.mjs") return send(response, 200, "text/javascript; charset=utf-8", fixture.runtime);
    if (url.pathname === "/model.mjs") return send(response, 200, "text/javascript; charset=utf-8", fixture.model);
    if (url.pathname === "/source.svg") return send(response, 200, "image/svg+xml", fixture.source, "public,max-age=3600,immutable");
    if (url.pathname === "/geometry") {
      const region = Object.fromEntries(["x", "y", "width", "height"].map((name) => [name, Number(url.searchParams.get(name))]));
      if (Object.values(region).some((value) => !Number.isFinite(value)) || region.width <= 0 || region.height <= 0 || region.width > 10_000 || region.height > 10_000) {
        return send(response, 400, "text/plain", Buffer.from("Invalid geometry region"));
      }
      const selected = selectPcbPaths(fixture.index, region);
      const body = Buffer.from(JSON.stringify({
        paths: selected.map((entry) => ({ source: entry.source, sourceIndex: sourceIndexes.get(entry) })),
      }));
      return send(response, 200, "application/json", body);
    }
    return send(response, 404, "text/plain", Buffer.from("Not found"));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  let chrome;
  for (const candidate of candidates) {
    try { await access(candidate); chrome = candidate; break; } catch {}
  }
  if (!chrome) throw new Error("Set CHROME_PATH to an installed Chromium executable");

  const tempRoot = await mkdtemp(path.join(tmpdir(), "pcb-touch-native-svg-"));
  let browser;
  try {
    browser = await launchChrome(chrome, path.join(tempRoot, "profile"));
    const { page } = browser;
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 2,
      height: 844,
      mobile: true,
      screenHeight: 844,
      screenWidth: 390,
      width: 390,
    });
    await page.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    const url = `http://127.0.0.1:${server.address().port}/`;
    await page.send("Page.navigate", { url });
    await waitFor(page, "window.__PCB_TOUCH_READY__ === true");
    const replay = await deterministicReplay(page);
    const screenshot = await page.send("Page.captureScreenshot", { captureBeyondViewport: false, format: "png" });
    assert.ok(screenshot.data.length > 1_000, "visual fixture screenshot must contain rendered pixels");
    const cleanup = await page.evaluate("pcbTouchPrototype.cleanup()");
    assert.deepEqual(cleanup, {
      activeAnimations: 0,
      commitInFlight: false,
      flameAnimations: 0,
      flameTimer: false,
      listeners: 0,
      pendingFrame: false,
      trails: 0,
    });

    await page.send("Page.navigate", { url });
    await waitFor(page, "window.__PCB_TOUCH_READY__ === true");
    await page.send("Input.dispatchTouchEvent", {
      touchPoints: [{ id: 11, x: 180, y: 300, radiusX: 2, radiusY: 2, force: 1 }],
      type: "touchStart",
    });
    await waitFor(page, "pcbTouchPrototype.snapshot().state.phase === 'contact'");
    const beforeScroll = await page.evaluate("pcbTouchPrototype.snapshot().state.point.y");
    await page.evaluate("scrollTo(0, 160)");
    await waitFor(page, `pcbTouchPrototype.snapshot().state.point.y > ${beforeScroll}`);
    const eventSnapshot = await page.evaluate("pcbTouchPrototype.snapshot()");
    assert.deepEqual(eventSnapshot.metrics.passiveCaptureListeners.sort(), ["scroll", "touchcancel", "touchend", "touchmove", "touchstart"]);
    await page.send("Input.dispatchTouchEvent", { touchPoints: [], type: "touchEnd" });
    await waitFor(page, "pcbTouchPrototype.snapshot().state.phase === 'hold'");
    await page.evaluate("pcbTouchPrototype.cleanup()");

    await page.send("Page.navigate", { url: `${url}?reduced=1` });
    await waitFor(page, "window.__PCB_TOUCH_READY__ === true");
    const reduced = await page.evaluate("pcbTouchPrototype.replay({type:'contact',at:0,id:1,x:100,y:100})");
    assert.equal(reduced.reducedMotion, true);
    assert.equal(reduced.state.phase, "idle");
    assert.equal(reduced.visual, null);
    assert.deepEqual(reduced.metrics.passiveCaptureListeners, []);
    const reducedCleanup = await page.evaluate("pcbTouchPrototype.cleanup()");
    assert.equal(reducedCleanup.pendingFrame, false);
    assert.equal(reducedCleanup.commitInFlight, false);

    process.stdout.write(`${JSON.stringify({
      schema: "pcb-touch-native-svg-prototype-verification",
      schemaVersion: 1,
      productionContract: false,
      environment: {
        browser: await browser.browser.send("Browser.getVersion"),
        chrome,
        cpu: cpus()[0]?.model,
        platform: platform(),
        requestedPaintPath: "headless Chromium --disable-gpu; software paint",
      },
      evidence: {
        cacheHits: replay.metrics.cacheHits,
        cacheMisses: replay.metrics.cacheMisses,
        coldWarmContacts: replay.metrics.coldWarmContacts,
        eventToCommitMs: replay.metrics.eventToCommitMs,
        frameGapCount: replay.metrics.frameGapsMs.length,
        handlerSamples: replay.metrics.handlerMs.length,
        layoutReadsAfterSvgWrite: replay.metrics.layoutReadsAfterSvgWrite,
        longTasks: replay.metrics.longTasks,
        maxPendingFrames: replay.metrics.maxPendingFrames,
        maxConcurrentCommits: replay.metrics.maxConcurrentCommits,
        modelSamples: replay.metrics.modelMs.length,
        pathCounts: replay.metrics.pathCounts,
        screenshotBytes: Math.floor(screenshot.data.length * .75),
        trailEmitted: replay.metrics.trailEmitted,
        trailPeak: replay.metrics.trailPeak,
        writeSamples: replay.metrics.writeMs.length,
      },
      limitations: [
        "CDP touch injection and renderer-neutral deterministic replay are synthetic evidence, not physical iPhone/WebKit proof.",
        "Headless Chromium screenshots establish that the native SVG composition painted, not physical display latency or compositor presentation.",
        "The standalone fixture does not change or benchmark the production renderer, static compiler, PCG, or Next.js output.",
      ],
    }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Browser diagnostic: ${browser?.stderr() ?? "browser not started"}\n`);
    throw error;
  } finally {
    await closeChrome(browser);
    await new Promise((resolve) => server.close(resolve));
    await rm(tempRoot, { force: true, maxRetries: 20, recursive: true, retryDelay: 100 });
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main();
