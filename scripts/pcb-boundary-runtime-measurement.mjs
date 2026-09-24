import { spawn } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import { platform, tmpdir } from "node:os";
import path from "node:path";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.pending = new Map();
    this.events = new Map();
    this.nextId = 0;
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
      const timer = setTimeout(() => reject(new Error(`CDP connection timed out: ${url}`)), 10_000);
      socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    return new Cdp(socket);
  }

  send(method, params = {}, timeoutMs = 60_000) {
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

  on(method, callback) {
    if (!this.events.has(method)) this.events.set(method, new Set());
    this.events.get(method).add(callback);
    return () => this.events.get(method)?.delete(callback);
  }

  async evaluate(expression, returnByValue = true) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue,
    });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return returnByValue ? result.result.value : result.result;
  }

  close() { this.socket.close(); }
}

async function waitFor(page, expression, timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await page.evaluate(expression)) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${expression}`);
}

async function launchBrowser(chrome, profile) {
  const args = [
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-gpu",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
    "--do-not-de-elevate",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ];
  const child = spawn(chrome, args, { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (data) => { stderr = (stderr + data).slice(-16_384); });
  const started = Date.now();
  while (!stderr.includes("DevTools listening on ")) {
    if (child.exitCode !== null || Date.now() - started > 20_000) {
      child.kill();
      throw new Error(`Browser launch failed: ${stderr}`);
    }
    await delay(50);
  }
  const endpoint = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)[1];
  const browser = await Cdp.connect(endpoint);
  const targets = await (await fetch(`http://${new URL(endpoint).host}/json/list`)).json();
  const page = await Cdp.connect(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
  return { browser, child, page, stderr: () => stderr };
}

async function closeBrowser(instance) {
  if (!instance) return;
  await instance.browser.send("Browser.close", {}, 2_000).catch(() => {});
  instance.page.close();
  instance.browser.close();
  for (let index = 0; index < 40 && instance.child.exitCode === null; index += 1) await delay(50);
  if (instance.child.exitCode === null) instance.child.kill();
}

async function listeners(page, expression) {
  const remote = await page.evaluate(expression, false);
  const result = await page.send("DOMDebugger.getEventListeners", { objectId: remote.objectId });
  const relevant = new Set([
    "pointerleave", "pointermove", "resize", "scroll",
    "touchcancel", "touchend", "touchmove", "touchstart",
  ]);
  return result.listeners
    .filter((listener) => relevant.has(listener.type))
    .reduce((summary, listener) => {
      const key = `${listener.type}|capture=${listener.useCapture}|passive=${listener.passive}`;
      summary[key] = (summary[key] ?? 0) + 1;
      return summary;
    }, {});
}

async function listenerSnapshot(page) {
  const [windowListeners, documentListeners] = await Promise.all([
    listeners(page, "window"),
    listeners(page, "document"),
  ]);
  return { window: windowListeners, document: documentListeners };
}

const snapshotExpression = `(() => {
  const art = document.querySelector('.public-circuit-art');
  const canvas = document.querySelector('.public-circuit-touch-canvas');
  const scripts = performance.getEntriesByType('resource').filter((entry) =>
    entry.initiatorType === 'script' || /\\/_next\\/static\\/.*\\.js(?:\\?|$)/.test(entry.name));
  const uniqueScripts = [...new Map(scripts.map((entry) => [entry.name, entry])).values()];
  return {
    staticState: art?.dataset.renderState ?? null,
    staticTiles: document.querySelectorAll('.public-circuit-art-vector').length,
    staticCanvasPixels: [...document.querySelectorAll('canvas.public-circuit-art-vector')]
      .reduce((sum, tile) => sum + tile.width * tile.height, 0),
    staticFallbackImages: document.querySelectorAll('img.public-circuit-art-vector').length,
    touchCanvasDom: document.querySelectorAll('.public-circuit-touch-canvas').length,
    touchCanvasHidden: canvas?.hidden ?? null,
    touchGeometryCacheSize: Number(canvas?.dataset.geometryCacheSize ?? 0),
    touchGeometryMisses: Number(canvas?.dataset.geometryMisses ?? 0),
    touchTrailCount: Number(canvas?.dataset.trailCount ?? 0),
    desktopLensDom: document.querySelectorAll('.public-circuit-glow-lens').length,
    desktopTrailSvgDom: document.querySelectorAll('.public-circuit-pointer-trail-paint').length,
    allCanvasDom: document.querySelectorAll('canvas').length,
    allSvgDom: document.querySelectorAll('svg').length,
    trackedResources: window.__pcbResourceProbe?.snapshot() ?? null,
    clientJs: {
      requests: uniqueScripts.length,
      transferBytes: uniqueScripts.reduce((sum, entry) => sum + entry.transferSize, 0),
      encodedBodyBytes: uniqueScripts.reduce((sum, entry) => sum + entry.encodedBodySize, 0),
      decodedBodyBytes: uniqueScripts.reduce((sum, entry) => sum + entry.decodedBodySize, 0),
      urls: uniqueScripts.map((entry) => entry.name),
    },
  };
})()`;

async function snapshot(page, browser, collectGarbage = false) {
  if (collectGarbage) await page.send("HeapProfiler.collectGarbage");
  return page.evaluate(snapshotExpression);
}

async function touch(page, type, points) {
  await page.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: points.map(([x, y], index) => ({ x, y, id: index + 1, radiusX: 1, radiusY: 1, force: 1 })),
  });
}

async function main() {
  const options = { label: "unlabeled", url: "http://127.0.0.1:3417/" };
  for (const argument of process.argv.slice(2)) {
    const match = argument.match(/^--(label|url)=(.+)$/);
    if (!match) throw new Error(`Unknown argument ${argument}`);
    options[match[1]] = match[2];
  }
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  let chrome;
  for (const candidate of candidates) {
    try { await access(candidate); chrome = candidate; break; } catch {}
  }
  if (!chrome) throw new Error("No supported Chromium executable found.");

  const profileRoot = await mkdtemp(path.join(tmpdir(), "pcb-boundary-measurement-"));
  let active;
  let requestPhase = "initial";
  const geometryRequests = [];
  try {
    active = await launchBrowser(chrome, profileRoot);
    const { browser, page } = active;
    await page.send("Page.enable");
    await page.send("Network.enable");
    await page.send("Runtime.enable");
    await page.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await page.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
      const canvases = [];
      const svgs = [];
      const createElement = Document.prototype.createElement;
      const createElementNS = Document.prototype.createElementNS;
      Document.prototype.createElement = function(name, ...args) {
        const element = createElement.call(this, name, ...args);
        if (String(name).toLowerCase() === 'canvas') canvases.push(new WeakRef(element));
        return element;
      };
      Document.prototype.createElementNS = function(namespace, name, ...args) {
        const element = createElementNS.call(this, namespace, name, ...args);
        if (String(name).toLowerCase() === 'svg') svgs.push(new WeakRef(element));
        return element;
      };
      Object.defineProperty(window, '__pcbResourceProbe', { value: {
        snapshot: () => ({
          canvasCreated: canvases.length,
          canvasAlive: canvases.filter((reference) => reference.deref()).length,
          svgCreated: svgs.length,
          svgAlive: svgs.filter((reference) => reference.deref()).length,
        }),
      }});
    })();` });
    page.on("Network.requestWillBeSent", ({ request }) => {
      const parsed = new URL(request.url);
      if (parsed.pathname === "/api/pcb") geometryRequests.push({ phase: requestPhase, url: request.url });
    });
    await page.send("Network.clearBrowserCache");
    await page.send("Page.navigate", { url: options.url });
    await waitFor(page, "document.querySelector('[data-public-circuit]') !== null");
    await waitFor(page, "['ready','error'].includes(document.querySelector('.public-circuit-art')?.dataset.renderState)");
    const initial = await snapshot(page, browser, true);
    initial.listeners = await listenerSnapshot(page);

    requestPhase = "touch";
    const touchCacheSamples = [];
    await touch(page, "touchStart", [[120, 240]]);
    await waitFor(page, "document.querySelector('.public-circuit-touch-canvas') !== null");
    await waitFor(page, "document.querySelector('.public-circuit-touch-canvas')?.dataset.geometryStatus === 'ready'");
    touchCacheSamples.push(await snapshot(page, browser));
    const desktopAfterTouchPointer = touchCacheSamples[0].desktopLensDom;
    for (const point of [[380, 300], [680, 380], [980, 460], [1280, 540], [900, 620]]) {
      await touch(page, "touchMove", [point]);
      await delay(180);
      await waitFor(page, "document.querySelector('.public-circuit-touch-canvas')?.dataset.geometryStatus === 'ready'");
      touchCacheSamples.push(await snapshot(page, browser));
    }
    const touchBeforeMouse = await snapshot(page, browser);

    requestPhase = "hybrid-mouse";
    await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 720, y: 420, pointerType: "mouse" });
    await waitFor(page, "document.querySelectorAll('.public-circuit-glow-lens').length === 1");
    await delay(500);
    const hybridActive = await snapshot(page, browser);
    hybridActive.listeners = await listenerSnapshot(page);

    requestPhase = "settle";
    await touch(page, "touchEnd", []);
    // Do not accept an intermediate hidden frame while another geometry commit
    // is pending. The accepted lifecycle owns a fixed 6s hold plus 700ms fade.
    await delay(7_000);
    await waitFor(page, "document.querySelector('.public-circuit-touch-canvas')?.hidden === true", 9_000);
    await page.evaluate("window.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }))");
    await delay(100);
    const settled = await snapshot(page, browser, true);

    await page.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    await waitFor(page, "document.querySelectorAll('.public-circuit-touch-canvas, .public-circuit-touch-trail, .public-circuit-glow-lens').length === 0");
    const reducedMotion = await snapshot(page, browser);

    const requestsByPhase = Object.fromEntries(["initial", "touch", "hybrid-mouse", "settle"].map((phase) => {
      const urls = geometryRequests.filter((request) => request.phase === phase).map((request) => request.url);
      return [phase, { requests: urls.length, uniqueRequests: new Set(urls).size }];
    }));
    const version = await browser.send("Browser.getVersion");
    const report = {
      schema: "pcb-boundary-runtime-measurement",
      schemaVersion: 1,
      label: options.label,
      generatedAt: new Date().toISOString(),
      environment: { browser: version.product, userAgent: version.userAgent, platform: platform(), viewport: "1440x900@1", touchEmulation: true, softwarePaint: true },
      checkpoints: { initial, touchBeforeMouse, hybridActive, settled },
      geometry: {
        requestsByPhase,
        maxObservedTouchCacheSize: Math.max(...touchCacheSamples.map((sample) => sample.touchGeometryCacheSize)),
        maxObservedTouchMisses: Math.max(...touchCacheSamples.map((sample) => sample.touchGeometryMisses)),
        sharedPromiseCacheLimit: 128,
        touchGeometryCacheLimit: 4,
      },
      hybridIsolation: {
        desktopMountedAfterTouchPointer: desktopAfterTouchPointer,
        desktopMountedAfterMousePointer: hybridActive.desktopLensDom,
        touchMissesBeforeMouse: touchBeforeMouse.touchGeometryMisses,
        touchMissesAfterMouse: hybridActive.touchGeometryMisses,
        threeTouchCanvasesDuringHybrid: hybridActive.touchCanvasDom === 3,
      },
      reducedMotion: {
        touchCanvases: reducedMotion.touchCanvasDom,
        desktopLenses: reducedMotion.desktopLensDom,
        touchTrails: reducedMotion.touchTrailCount,
      },
      limitations: [
        "One fresh-profile software-Chromium run per artifact; this is bounded comparative evidence, not a distribution or physical-device latency result.",
        "Client bytes are Resource Timing encoded/decoded body sizes for delivered JavaScript; transferBytes includes protocol overhead and is reported separately.",
        "WeakRef counts after forced GC show reachable DOM-created Canvas/SVG wrappers, not GPU allocations or complete browser-process memory.",
        "Touch emulation plus an explicit mouse event exercises lifecycle ownership in Chromium; it does not replace the already accepted physical-phone behavior check.",
      ],
    };
    process.stdout.write(`${JSON.stringify(report)}\n`);
  } catch (error) {
    process.stderr.write(`${active?.stderr() ?? "no browser diagnostic"}\n`);
    throw error;
  } finally {
    await closeBrowser(active);
    await rm(profileRoot, { force: true, recursive: true, maxRetries: 20, retryDelay: 100 });
  }
}

await main();
