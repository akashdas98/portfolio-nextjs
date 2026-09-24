import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function installedPlaywright() {
  const links = path.join(process.env.LOCALAPPDATA ?? "", "ms-playwright", ".links");
  for (const name of await readdir(links)) {
    const core = (await readFile(path.join(links, name), "utf8")).trim();
    const modulePath = path.join(path.dirname(core), "playwright", "index.mjs");
    try { return await import(pathToFileURL(modulePath).href); } catch {}
  }
  throw new Error("No linked Playwright installation was found.");
}

const { webkit, chromium } = await installedPlaywright();
const origin = process.argv[2] ?? "http://127.0.0.1:3000";
const extraQuery = [
  process.argv.includes("--capture") ? "pcb-capture=1" : "",
  process.argv.includes("--trails-off") ? "pcb-trails=off" : "",
  process.argv.includes("--underlay-off") ? "pcb-underlay=off" : "",
].filter(Boolean).map((value) => `&${value}`).join("");
const useChromium = process.argv.includes("--chromium");
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await (useChromium ? chromium : webkit).launch(
  useChromium && existsSync(chrome)
    ? { headless: true, executablePath: chrome }
    : { headless: true },
);

async function replay(label, scrollY, viewport, hideStatic = false) {
  const context = await browser.newContext({
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    screen: viewport,
    viewport,
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const totals = {};
    window.__pcbCosts = totals;
    for (const method of ["drawImage", "fill", "stroke", "fillRect", "clearRect"]) {
      const original = CanvasRenderingContext2D.prototype[method];
      CanvasRenderingContext2D.prototype[method] = function (...args) {
        const start = performance.now();
        try { return original.apply(this, args); }
        finally {
          const key = `${method}:${this.shadowBlur ? "shadow" : "plain"}:${this.canvas.width}x${this.canvas.height}`;
          const entry = totals[key] ??= { count: 0, total: 0, max: 0 };
          const elapsed = performance.now() - start;
          entry.count++; entry.total += elapsed; entry.max = Math.max(entry.max, elapsed);
        }
      };
    }
  });
  await page.goto(`${origin}/${process.argv.includes("--no-debug")
    ? `?pcb-probe=1${extraQuery}` : `?pcb-debug=1${extraQuery}`}`, { waitUntil: "networkidle" });
  if (process.argv[3] === "capabilities") {
    const capabilities = await page.evaluate(async () => {
      const main = {
        offscreenCanvas: typeof OffscreenCanvas,
        path2D: typeof Path2D,
        createImageBitmap: typeof createImageBitmap,
      };
      const source = `onmessage = () => {
        const result = { offscreenCanvas: typeof OffscreenCanvas, path2D: typeof Path2D,
          createImageBitmap: typeof createImageBitmap };
        try {
          const canvas = new OffscreenCanvas(32, 32);
          const context = canvas.getContext('2d');
          context.shadowBlur = 8;
          const path = new Path2D('M4 4L28 28');
          context.stroke(path);
          result.twoD = !!context;
          result.shadowBlur = context.shadowBlur;
        } catch (error) { result.error = String(error); }
        postMessage(result);
      }`;
      const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
      try {
        const worker = new Worker(url);
        return await new Promise((resolve) => {
          const timer = setTimeout(() => { worker.terminate(); resolve({ main, worker: "timeout" }); }, 3000);
          worker.onmessage = (event) => { clearTimeout(timer); worker.terminate(); resolve({ main, worker: event.data }); };
          worker.onerror = (event) => { clearTimeout(timer); worker.terminate(); resolve({ main, worker: event.message }); };
          worker.postMessage(null);
        });
      } finally { URL.revokeObjectURL(url); }
    });
    await context.close();
    return { label, capabilities };
  }
  if (hideStatic) {
    await page.locator(".public-circuit-art").evaluate((art) => {
      art.style.display = "none";
    });
  }
  if (process.argv.includes("--hide-scene")) {
    await page.addStyleTag({ content: ".public-circuit-art,.public-circuit-page > section{visibility:hidden!important}" });
  }
  if (process.argv.includes("--hide-content")) {
    await page.addStyleTag({ content: ".public-circuit-page > section{visibility:hidden!important}" });
  }
  if (process.argv.includes("--hide-art")) {
    await page.addStyleTag({ content: ".public-circuit-art{visibility:hidden!important}" });
  }
  if (process.argv.includes("--art-auto")) {
    await page.addStyleTag({ content: ".public-circuit-art-vector{will-change:auto!important}" });
  }
  if (process.argv.includes("--promote-sections")) {
    await page.addStyleTag({ content: ".public-circuit-page > section{will-change:transform!important}" });
  }
  if (process.argv.includes("--page-unisolated")) {
    await page.addStyleTag({ content: ".public-circuit-page{isolation:auto!important;overflow:visible!important}" });
  }
  if (process.argv.includes("--glow-top")) {
    await page.addStyleTag({ content: ".public-circuit-touch-main{z-index:999!important}" });
  }
  if (process.argv.includes("--promote-art")) {
    await page.addStyleTag({ content: ".public-circuit-art{will-change:transform!important;transform:translateZ(0)!important}" });
  }
  if (process.argv.includes("--content-visibility")) {
    await page.addStyleTag({ content: ".public-circuit-page > section{content-visibility:auto;contain-intrinsic-size:auto 1000px}" });
  }
  if (process.argv.includes("--tile-visibility")) {
    await page.addStyleTag({ content: ".public-circuit-art-vector{content-visibility:auto}" });
  }
  if (process.argv.includes("--underlay-filter-off")) {
    await page.addStyleTag({ content: ".public-circuit-page .circuit-text-underlay-shadow,.public-circuit-page .button-secondary::before{filter:none!important}" });
  }
  if (process.argv.includes("--promote-underlay")) {
    await page.addStyleTag({ content: ".public-circuit-page .circuit-text-underlay-shadow{will-change:filter!important}" });
  }
  if (process.argv.includes("--underlay-transform")) {
    await page.addStyleTag({ content: ".public-circuit-page .circuit-text-underlay-shadow{transform:translateZ(0)!important}" });
  }
  if (process.argv.includes("--section-contain")) {
    await page.addStyleTag({ content: ".public-circuit-page > section{contain:paint;overflow-clip-margin:64px}" });
  }
  if (process.argv.includes("--contain-service")) {
    await page.addStyleTag({ content: ".public-circuit-page > #services{contain:paint;overflow-clip-margin:64px}" });
  }
  if (process.argv.includes("--raster-art") || process.argv.includes("--raster-art-2x")) {
    await page.evaluate(async (ratio) => {
      const images = [...document.querySelectorAll(".public-circuit-art-vector")];
      await Promise.all(images.map((image) => image.decode().catch(() => {})));
      for (const image of images) {
        const width = Math.round(parseFloat(image.style.width));
        const height = Math.round(parseFloat(image.style.height));
        if (!width || !height) continue;
        const canvas = document.createElement("canvas");
        canvas.className = image.className;
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        canvas.style.cssText = image.style.cssText;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        image.after(canvas);
        image.style.visibility = "hidden";
      }
    }, process.argv.includes("--raster-art-2x") ? 2 : 1);
  }
  if (label.includes("no-underlay")) {
    await page.addStyleTag({ content: ".circuit-text-underlay-shadow{filter:none!important}" });
  }
  if (label.includes("promote-underlay")) {
    await page.addStyleTag({ content: ".circuit-text-underlay-shadow{will-change:transform!important}" });
  }
  if (label.includes("filter-layer")) {
    await page.addStyleTag({ content: ".circuit-text-underlay-shadow{will-change:filter!important}" });
  }
  if (label.includes("content-visibility")) {
    await page.addStyleTag({ content: ".public-circuit-page > section{content-visibility:auto;contain-intrinsic-size:auto 1000px}" });
  }
  if (label.includes("static-auto")) {
    await page.addStyleTag({ content: ".public-circuit-art-vector{will-change:auto!important}" });
  }
  if (label.includes("shadow-layout-contain")) {
    await page.addStyleTag({ content: ".circuit-text-underlay-shadow{contain:layout style!important}" });
  }
  if (label.includes("shadow-transform")) {
    await page.addStyleTag({ content: ".circuit-text-underlay-shadow{transform:translateZ(0)!important}" });
  }
  if (label.includes("section-paint-contain")) {
    await page.addStyleTag({ content: ".public-circuit-page > section{contain:paint;overflow-clip-margin:64px}" });
  }
  await page.evaluate((top) => scrollTo(0, top), scrollY);
  await page.waitForTimeout(["trace-services", "trace-warm"].includes(process.argv[3]) ? 2000 : 100);
  await page.evaluate(() => {
    const target = document.elementFromPoint(195, 360) ?? document.body;
    Object.defineProperty(window, "__pcbProbeTouch", { configurable: true, value: (
      type, clientX, clientY, identifier = 1,
    ) => {
      const touch = typeof document.createTouch === "function"
        ? document.createTouch(
          window, target, identifier,
          clientX + scrollX, clientY + scrollY,
          clientX, clientY, clientX, clientY,
          1, 1, 0, 1,
        )
        : new Touch({
          identifier, target, clientX, clientY,
          pageX: clientX + scrollX, pageY: clientY + scrollY,
          screenX: clientX, screenY: clientY,
        });
      const ending = type === "touchend" || type === "touchcancel";
      const active = ending ? [] : [touch];
      const event = typeof document.createTouchList === "function"
        ? new Event(type, { bubbles: true, cancelable: true, composed: true })
        : new TouchEvent(type, {
          bubbles: true, cancelable: true, composed: true,
          changedTouches: [touch], targetTouches: active, touches: active,
        });
      if (typeof document.createTouchList === "function") Object.defineProperties(event, {
        changedTouches: { value: document.createTouchList(touch) },
        targetTouches: { value: ending ? document.createTouchList() : document.createTouchList(touch) },
        touches: { value: ending ? document.createTouchList() : document.createTouchList(touch) },
      });
      target.dispatchEvent(event);
    }});
  });

  const samples = [];
  const pointAt = (index) => ({
    x: 45 + ((index * 23) % 300),
    y: 260 + Math.sin(index / 5) * 95,
  });
  const first = pointAt(0);
  await page.evaluate(({ x, y }) => window.__pcbProbeTouch("touchstart", x, y), first);
  await page.waitForSelector(".public-circuit-touch-canvas");
  if (process.argv.includes("--nest-glow-art")) {
    await page.evaluate(() => {
      const art = document.querySelector(".public-circuit-art");
      for (const canvas of document.querySelectorAll(".public-circuit-touch-canvas")) art.append(canvas);
    });
  }
  if (process.argv[3] === "cancel-handoff") {
    await page.evaluate(({ x, y }) => window.__pcbProbeTouch("touchend", x, y), first);
    await page.waitForTimeout(50);
    const result = await page.evaluate(async () => {
      const page = document.querySelector("[data-public-circuit]");
      const canvas = document.querySelector(".public-circuit-touch-canvas:not(.public-circuit-touch-main)");
      const pointer = (type, x) => page.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, composed: true,
        pointerId: 17, pointerType: "touch", isPrimary: true,
        clientX: x, clientY: 300,
      }));
      const visibleOrigin = () => {
        const main = [...document.querySelectorAll(".public-circuit-touch-main")]
          .find((surface) => surface.style.visibility === "visible");
        return main ? main.style.transform.match(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px/)?.slice(1).map(Number) : null;
      };
      pointer("pointerdown", 200);
      for (let frame = 0; frame < 300 && canvas.dataset.geometryStatus !== "ready"; frame++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      pointer("pointermove", 210);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const before = visibleOrigin();
      pointer("pointercancel", 210);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      window.__pcbProbeTouch("touchmove", 240, 320);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const after = visibleOrigin();
      const status = canvas.dataset.geometryStatus;
      window.__pcbProbeTouch("touchend", 240, 320);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => setTimeout(resolve, 120));
      const afterRelease = [...document.querySelectorAll("body > div")].at(-1)?.textContent?.match(/gesture=([^ ]+)/)?.[1];
      return { before, after, deltaX: before && after ? after[0] - before[0] : null,
        deltaY: before && after ? after[1] - before[1] : null, status,
        afterRelease,
        mains: [...document.querySelectorAll(".public-circuit-touch-main")]
          .map((surface) => ({ visibility: surface.style.visibility, transform: surface.style.transform })),
        overlay: [...document.querySelectorAll("body > div")].at(-1)?.textContent?.slice(0, 200) };
    });
    await context.close();
    if (result.deltaX !== 30 || result.deltaY !== 0 || result.afterRelease !== "hold") {
      throw new Error(`Native-scroll handoff lost touch motion: ${JSON.stringify(result)}`);
    }
    return { label, ...result };
  }
  if (process.argv[3] === "scroll-layout") {
    const states = await page.evaluate(async () => {
      const debug = document.querySelector("[aria-hidden='true'][style*='2147483647']");
      const states = [];
      window.__pcbProbeTouch("touchmove", 200, 300);
      for (let index = 0; index <= 40; index++) {
        scrollTo(0, index * 100);
        window.__pcbProbeTouch("touchmove", 200, 300);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        states.push({ y: scrollY, layout: debug?.dataset.layoutVersion,
          pageHeight: debug?.dataset.pageHeight, viewportHeight: debug?.dataset.viewportHeight });
      }
      return states;
    });
    await context.close();
    return { label, first: states[0], last: states.at(-1), versions: [...new Set(states.map((s) => s.layout))], heights: [...new Set(states.map((s) => s.pageHeight))] };
  }
  if (process.argv[3] === "scroll-motion") {
    const result = await page.evaluate(async () => {
      const canvas = document.querySelector(".public-circuit-touch-canvas");
      const samples = [];
      let prior = performance.now();
      for (let index = 1; index <= 90; index++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const now = performance.now();
        scrollBy(0, 8);
        window.__pcbProbeTouch("touchmove", 200, 320);
        samples.push({ gap: now - prior,
          lag: Number(canvas.dataset.publicationLag ?? -1),
          frame: Number(canvas.dataset.frameCost ?? -1),
          age: Number(canvas.dataset.preparationAge ?? -1),
          status: canvas.dataset.geometryStatus });
        prior = now;
      }
      const values = (key) => samples.map((sample) => sample[key]);
      const p95 = (key) => values(key).sort((a,b) => a-b)[Math.floor(samples.length * .95)];
      return { scrollY, lagMax: Math.max(...values("lag")), lagP95: p95("lag"),
        frameP95: p95("frame"), gapP95: p95("gap"), ageMax: Math.max(...values("age")),
        retainedFrames: samples.filter((sample) => sample.status === "retained-preparing").length };
    });
    await context.close();
    return { label, ...result };
  }
  if (process.argv[3] === "tone-transition") {
    const states = [];
    for (const [clientY, expectedTones] of [[260, "blue"], [460, "blue,pink"], [680, "blue,pink"], [960, "pink"]]) {
      await page.evaluate((y) => window.__pcbProbeTouch("touchmove", 200, y), clientY);
      await page.waitForFunction((expected) => {
        const canvas = document.querySelector(".public-circuit-touch-canvas");
        return canvas?.dataset.requiredTones === expected &&
          canvas.dataset.geometryStatus === "ready" && canvas.dataset.publicationLag === "0";
      }, expectedTones, { timeout: 5000 });
      states.push(await page.locator(".public-circuit-touch-canvas").first().evaluate(
        (canvas) => ({
          tones: canvas.dataset.preparedTones,
          visible: [...document.querySelectorAll(".public-circuit-touch-main")]
            .filter((main) => getComputedStyle(main).visibility === "visible").length,
          lag: canvas.dataset.publicationLag,
          timing: canvas.dataset.preparationTiming,
        }),
      ));
      if (expectedTones === "blue,pink" && clientY === 680 &&
          process.argv.includes("--screenshot")) {
        await page.waitForTimeout(150);
        await page.screenshot({ path: ".tmp-pcb-mixed-tone.png" });
      }
    }
    await context.close();
    return { label, states };
  }
  if (["trace", "trace-underlay", "trace-services", "tone", "landscape-service-trace"].includes(process.argv[3])) {
    const steady = process.argv.includes("--steady");
    if (steady) await page.waitForFunction(() =>
      document.querySelector(".public-circuit-touch-canvas")?.dataset.geometryStatus === "ready",
    );
    if (steady) await page.waitForTimeout(1000);
    const result = await page.evaluate(async ({ steady, movingDiv }) => {
      const canvas = document.querySelector(".public-circuit-touch-canvas");
      const probeDiv = movingDiv ? document.createElement("div") : null;
      if (probeDiv) {
        probeDiv.style.cssText = "position:absolute;top:0;left:0;z-index:1;width:420px;height:420px;pointer-events:none;contain:strict;will-change:transform;background:radial-gradient(circle,rgba(255,240,248,.8),transparent 45%)";
        document.querySelector("[data-public-circuit]").append(probeDiv);
      }
      const samples = [];
      let prior = performance.now();
      for (let index = 1; index <= 70; index++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const now = performance.now();
        const x = steady ? 45 + Math.sin(index / 7) * 18 : 45 + ((index * 23) % 300);
        const y = steady ? 260 + Math.sin(index / 11) * 3 : 260 + Math.sin(index / 5) * 95;
        window.__pcbProbeTouch("touchmove", x, y);
        if (probeDiv) probeDiv.style.transform = `translate3d(${x - 210}px,${scrollY + y - 210}px,0)`;
        samples.push({
          gap: now - prior,
          lag: Number(canvas.dataset.publicationLag ?? -1),
          frame: Number(canvas.dataset.frameCost ?? -1),
          age: Number(canvas.dataset.preparationAge ?? -1),
          status: canvas.dataset.geometryStatus,
          misses: Number(canvas.dataset.geometryMisses ?? 0),
          preparationStarts: Number(canvas.dataset.preparationStarts ?? 0),
          preparationStage: canvas.dataset.preparationStage ?? "unknown",
        });
        prior = now;
      }
      const values = (field) => samples.map((sample) => sample[field]);
      const quantile = (field, q) => {
        const sorted = values(field).sort((a, b) => a - b);
        return Math.round(sorted[Math.floor(q * (sorted.length - 1))]);
      };
      probeDiv?.remove();
      return {
        viewport: [innerWidth, innerHeight],
        pageHeight: document.querySelector("[data-public-circuit]").offsetHeight,
        artTiles: document.querySelectorAll(".public-circuit-art-vector").length,
        preparedTones: canvas.dataset.preparedTones,
        preparedPixelRatios: canvas.dataset.preparedPixelRatios,
        maximumLag: Math.max(...values("lag")),
        lagP95: quantile("lag", .95),
        frameP95: quantile("frame", .95),
        frameMax: Math.max(...values("frame")),
        gapP95: quantile("gap", .95),
        gapMax: Math.round(Math.max(...values("gap"))),
        ageMax: Math.max(...values("age")),
        retainedFrames: samples.filter((sample) => sample.status === "retained-preparing").length,
        misses: samples.at(-1).misses,
        preparationStartDelta: samples.at(-1).preparationStarts - samples[0].preparationStarts,
        preparationStages: [...new Set(samples.map((sample) => sample.preparationStage))],
      };
    }, { steady, movingDiv: process.argv.includes("--moving-div") });
    await page.waitForFunction(() => {
      const canvas = document.querySelector(".public-circuit-touch-canvas");
      return canvas?.dataset.geometryStatus === "ready" && canvas.dataset.publicationLag === "0";
    }, null, { timeout: 5000 }).catch(() => {});
    result.settledTones = await page.locator(".public-circuit-touch-canvas").first().evaluate(
      (canvas) => canvas.dataset.preparedTones,
    );
    await context.close();
    return { label, ...result };
  }
  if (process.argv[3] === "stall") {
    await page.waitForFunction(() => document.querySelector(".public-circuit-touch-canvas")?.dataset.geometryStatus === "ready");
    let blocked = false;
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    await page.route("**/api/pcb?*", async (route) => {
      if (!blocked) { blocked = true; await gate; }
      await route.continue();
    });
    await page.evaluate(() => window.__pcbProbeTouch("touchmove", 700, 400));
    await page.waitForFunction(() => document.querySelector(".public-circuit-touch-canvas")?.dataset.preparationStage === "network");
    const started = performance.now();
    await page.evaluate(() => window.__pcbProbeTouch("touchmove", 400, 700));
    let publishedBeforeRelease = false;
    try {
      await page.waitForFunction(() => {
        const canvas = document.querySelector(".public-circuit-touch-canvas");
        return canvas?.dataset.geometryStatus === "ready" && canvas.dataset.publicationLag === "0";
      }, null, { timeout: 3000 });
      publishedBeforeRelease = true;
    } finally {
      release();
      await page.unrouteAll({ behavior: "wait" });
    }
    const elapsed = performance.now() - started;
    await context.close();
    if (!publishedBeforeRelease) throw new Error("Latest point blocked by obsolete request");
    return { label, publishedBeforeRelease, elapsedMs: elapsed };
  }
  let previousAt = performance.now();
  for (let index = 1; index <= 180; index += 1) {
    const point = pointAt(index);
    const startedAt = performance.now();
    await page.evaluate(({ x, y }) => window.__pcbProbeTouch("touchmove", x, y), point);
    await page.waitForTimeout(16);
    const state = await page.locator(".public-circuit-touch-canvas").first().evaluate((canvas) => ({
      aborts: Number(canvas.dataset.preparationAborts ?? 0),
      lag: Number(canvas.dataset.publicationLag ?? -1),
      misses: Number(canvas.dataset.geometryMisses ?? 0),
      stage: canvas.dataset.preparationStage ?? "unknown",
      status: canvas.dataset.geometryStatus ?? "unknown",
      timing: canvas.dataset.preparationTiming ?? "none",
      preparationCall: canvas.dataset.preparationCall ?? "none",
      frameCost: Number(canvas.dataset.frameCost ?? -1),
    }));
    const now = performance.now();
    samples.push({ ...state, dispatchMs: now - startedAt, intervalMs: now - previousAt });
    previousAt = now;
  }
  const last = pointAt(180);
  await page.evaluate(({ x, y }) => window.__pcbProbeTouch("touchend", x, y), last);
  if (process.argv.includes("--capture")) await page.waitForTimeout(650);
  const costs = await page.evaluate(() => Object.entries(window.__pcbCosts)
    .sort((a, b) => b[1].total - a[1].total).slice(0, 12));
  await context.close();

  const values = (field) => samples.map((sample) => sample[field]);
  const stages = Object.fromEntries(Array.from(new Set(values("stage"))).map(
    (stage) => [stage, samples.filter((sample) => sample.stage === stage).length],
  ));
  const percentile = (rows, key) => {
    const sorted = rows.map((row) => row[key]).sort((a, b) => a - b);
    return sorted[Math.floor((sorted.length - 1) * .95)] ?? 0;
  };
  const readySamples = samples.filter((sample) => sample.status === "ready");
  const preparingSamples = samples.filter((sample) => sample.status !== "ready");
  return {
    label,
    costs,
    scrollY,
    maximumLag: Math.max(...values("lag")),
    maximumMisses: Math.max(...values("misses")),
    maximumDispatchMs: Math.max(...values("dispatchMs")),
    maximumIntervalMs: Math.max(...values("intervalMs")),
    retainedPreparingFrames: samples.filter((sample) => sample.status === "retained-preparing").length,
    readySamples: readySamples.length,
    readyIntervalP95: percentile(readySamples, "intervalMs"),
    readyDispatchP95: percentile(readySamples, "dispatchMs"),
    readyFrameCostP95: percentile(readySamples, "frameCost"),
    preparingIntervalP95: percentile(preparingSamples, "intervalMs"),
    stages,
    lastTiming: [...values("timing")].reverse().find((value) => value !== "none") ?? "none",
    lastPreparationCall: [...values("preparationCall")].reverse()
      .find((value) => value !== "none") ?? "none",
  };
}

try {
  const results = [];
  const profile = process.argv[3] ?? "all";
  const scenarios = [
    ["phone-top", 0, { width: 390, height: 844 }, false],
    ["phone-lower", 3_200, { width: 390, height: 844 }, false],
    ["tablet-top", 0, { width: 1024, height: 1194 }, false],
    ["tablet-lower", 3_200, { width: 1024, height: 1194 }, false],
    ["tablet-top-no-static", 0, { width: 1024, height: 1194 }, true],
    ["tablet-lower-no-static", 3_200, { width: 1024, height: 1194 }, true],
    ["tablet-work-interior", 2_400, { width: 1024, height: 1194 }, false],
    ["tablet-service-interior", 3_900, { width: 1024, height: 1194 }, false],
    ["tablet-service-no-static", 3_900, { width: 1024, height: 1194 }, true],
    ["tablet-service-no-underlay", 3_900, { width: 1024, height: 1194 }, false],
    ["tablet-tech", 5_940, { width: 1024, height: 1194 }, false],
    ["tablet-service-matched-portrait", 3_900, { width: 834, height: 1194 }, false],
    ["tablet-tech-matched-portrait", 5_940, { width: 834, height: 1194 }, false],
    ["tablet-service-landscape", 3_900, { width: 1194, height: 834 }, false],
    ["tablet-service-landscape-no-static", 3_900, { width: 1194, height: 834 }, true],
    ["tablet-tech-landscape", 5_940, { width: 1194, height: 834 }, false],
    ["tablet-tech-landscape-no-static", 5_940, { width: 1194, height: 834 }, true],
    ["tablet-tech-no-underlay", 5_940, { width: 1024, height: 1194 }, false],
    ["tablet-service-promote-underlay", 3_900, { width: 1024, height: 1194 }, false],
    ["tablet-tech-promote-underlay", 5_940, { width: 1024, height: 1194 }, false],
    ["tablet-service-filter-layer", 3_900, { width: 1024, height: 1194 }, false],
    ["tablet-service-content-visibility", 3_900, { width: 1024, height: 1194 }, false],
    ["tablet-service-static-auto", 3_900, { width: 1024, height: 1194 }, false],
    ["tablet-service-shadow-layout-contain", 3_900, { width: 1024, height: 1194 }, false],
    ["tablet-service-shadow-transform", 3_900, { width: 1024, height: 1194 }, false],
    ["tablet-service-section-paint-contain", 3_900, { width: 1024, height: 1194 }, false],
    ["phone-tech", 8_740, { width: 390, height: 844 }, false],
  ];
  for (const [label, scrollY, viewport, hideStatic] of scenarios) {
    if (profile === "capabilities") {
      if (!new Set(["tablet-tech", "phone-tech"]).has(label)) continue;
      results.push(await replay(label, scrollY, viewport, hideStatic));
      continue;
    }
    if (profile === "landscape-service") {
      if (label !== "tablet-service-landscape") continue;
      results.push(await replay(label, scrollY, viewport, hideStatic));
      continue;
    }
    if (profile === "cancel-handoff") {
      if (label !== "tablet-service-landscape") continue;
      results.push(await replay(label, scrollY, viewport, hideStatic));
      continue;
    }
    if (profile === "landscape-service-trace") {
      if (label !== "tablet-service-landscape") continue;
      results.push(await replay(label, scrollY, viewport, hideStatic));
      continue;
    }
    if (profile === "stall") {
      if (label !== "tablet-lower") continue;
      results.push(await replay(label, scrollY, viewport, hideStatic));
      continue;
    }
    if (profile === "trace") {
      if (!label.startsWith("tablet-") || label.includes("no-static")) continue;
      results.push(await replay(label, scrollY, viewport, hideStatic));
      continue;
    }
    if (profile === "trace-underlay") {
      if (!/tablet-(service|tech)-(interior|no-underlay|promote-underlay)/.test(label) && label !== "tablet-tech") continue;
      results.push(await replay(label, scrollY, viewport, hideStatic));
      continue;
    }
    if (profile === "trace-services") {
      if (!new Set(["tablet-service-interior", "tablet-service-section-paint-contain"]).has(label)) continue;
      results.push(await replay(label, scrollY, viewport, hideStatic));
      continue;
    }
    if (profile === "tone") {
      if (!new Set(["tablet-tech", "phone-tech"]).has(label)) continue;
      results.push(await replay(label, scrollY, viewport, hideStatic));
      continue;
    }
    if (profile === "landscape") {
      if (!new Set(["tablet-service-interior", "tablet-tech", "tablet-service-landscape", "tablet-tech-landscape"]).has(label)) continue;
      results.push(await replay(label, scrollY, viewport, hideStatic));
      continue;
    }
    if (profile === "matched-rotation") {
      if (!new Set(["tablet-service-matched-portrait", "tablet-tech-matched-portrait", "tablet-service-landscape", "tablet-tech-landscape"]).has(label)) continue;
      results.push(await replay(label, scrollY, viewport, hideStatic));
      continue;
    }
    if (profile === "landscape-static") {
      if (!new Set(["tablet-service-landscape", "tablet-service-landscape-no-static", "tablet-tech-landscape", "tablet-tech-landscape-no-static"]).has(label)) continue;
      results.push(await replay(label, scrollY, viewport, hideStatic));
      continue;
    }
    if (profile === "cost-one-tone") {
      if (!new Set(["tablet-service-interior", "tablet-service-no-static", "phone-lower"]).has(label)) continue;
      results.push(await replay(label, scrollY, viewport, hideStatic));
      continue;
    }
    if (profile === "tone-transition") {
      if (label !== "tablet-tech") continue;
      results.push(await replay(label, scrollY, viewport, hideStatic));
      continue;
    }
    if (profile === "scroll-layout") {
      if (label !== "tablet-top") continue;
      results.push(await replay(label, scrollY, viewport, hideStatic));
      continue;
    }
    if (profile === "scroll-motion") {
      if (!new Set(["phone-top", "phone-lower", "tablet-top", "tablet-service-interior", "tablet-tech"]).has(label)) continue;
      results.push(await replay(label, scrollY, viewport, hideStatic));
      continue;
    }
    if (profile === "underlay") {
      if (!/tablet-(service|tech)-(interior|no-underlay|promote-underlay|^$)/.test(label) && label !== "tablet-tech") continue;
      results.push(await replay(label, scrollY, viewport, hideStatic));
      continue;
    }
    if (profile === "tablet" && (!label.startsWith("tablet-") || label.includes("no-static"))) continue;
    if (profile !== "all" && profile !== "tablet" && !label.startsWith(profile)) continue;
    results.push(await replay(label, scrollY, viewport, hideStatic));
  }
  process.stdout.write(`${JSON.stringify({
    schema: "pcb-touch-playwright-probe",
    platform: os.platform(),
    results,
  }, null, 2)}\n`);
} finally {
  await browser.close();
}
