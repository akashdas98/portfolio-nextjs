import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function installedPlaywright() {
  const links = path.join(process.env.LOCALAPPDATA ?? "", "ms-playwright", ".links");
  for (const name of await readdir(links)) {
    const core = (await readFile(path.join(links, name), "utf8")).trim();
    try {
      return await import(pathToFileURL(path.join(path.dirname(core), "playwright", "index.mjs")).href);
    } catch {}
  }
  throw new Error("No linked Playwright installation was found.");
}

const { chromium } = await installedPlaywright();
const origin = process.argv[2] ?? "http://192.168.0.100:3000";
const cpuRate = Number(process.argv[3] ?? 1);
const underlayMode = process.argv[5] === "off" ? "off" : "on";
const waitStatic = process.argv[6] === "wait-static";
const trailsMode = process.argv[7] === "off" ? "off" : "on";
const debugMode = process.argv[8] === "off" ? "off" : "on";
const dragPath = process.argv[9] === "one-way" ? "one-way" : "oscillate";
const localChrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PCB_CHROME_PATH ?? (existsSync(localChrome) ? localChrome : undefined),
  args: ["--disable-features=OverscrollHistoryNavigation"],
});
const scrollLevels = process.argv[4]
  ? [Number(process.argv[4])]
  : [0, 2400, 3900, 5940, 6500];

function quantile(values, fraction) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * fraction)] ?? 0;
}

try {
  for (const requestedScrollY of scrollLevels) {
    const context = await browser.newContext({
      viewport: { width: 1024, height: 1194 },
      screen: { width: 1024, height: 1194 },
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(`${origin}/${debugMode === "on" ? `?pcb-debug=1${underlayMode === "off" ? "&pcb-underlay=off" : ""}${trailsMode === "off" ? "&pcb-trails=off" : ""}` : ""}`, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "html,body{overscroll-behavior-x:none}" });
    await page.evaluate((y) => scrollTo(0, y), requestedScrollY);
    await page.waitForTimeout(2000);
    if (waitStatic) {
      await page.waitForFunction(() => document.querySelector(".public-circuit-art")?.dataset.renderState === "ready", null, { timeout: 30000 });
    }
    const actualScrollY = await page.evaluate(() => scrollY);
    const initialArt = await page.locator(".public-circuit-art").evaluate((art) => ({
      state: art.dataset.renderState,
      tiles: art.childElementCount,
      duration: art.dataset.renderDurationMs,
    }));
    const visibleUnderlays = await page.evaluate(() => {
      const boxes = [...document.querySelectorAll(".circuit-text-underlay-shadow")]
        .map((element) => element.getBoundingClientRect())
        .filter((rect) => rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth);
      return {
        count: boxes.length,
        totalBoxPixels: Math.round(boxes.reduce((sum, rect) => sum + rect.width * rect.height, 0)),
      };
    });
    await page.evaluate(() => {
      window.__pcbHorizontalSamples = [];
      window.__pcbHorizontalTouches = [];
      window.__pcbHorizontalFrames = [];
      window.__pcbHorizontalFrameActive = true;
      let previousFrame = 0;
      const recordFrame = (at) => {
        if (!window.__pcbHorizontalFrameActive) return;
        if (previousFrame) window.__pcbHorizontalFrames.push(at - previousFrame);
        previousFrame = at;
        requestAnimationFrame(recordFrame);
      };
      requestAnimationFrame(recordFrame);
      window.addEventListener("touchmove", (event) => {
        window.__pcbHorizontalTouches.push({ x: event.touches[0]?.clientX, y: event.touches[0]?.clientY });
      }, { capture: true, passive: true });
      window.__pcbHorizontalTimer = setInterval(() => {
        const canvas = document.querySelector(".public-circuit-touch-canvas");
        if (!canvas) return;
        window.__pcbHorizontalSamples.push({
          at: performance.now(),
          lag: Number(canvas.dataset.publicationLag ?? -1),
          paint: Number(canvas.dataset.frameCost ?? -1),
          age: Number(canvas.dataset.preparationAge ?? -1),
          status: canvas.dataset.geometryStatus ?? "unknown",
          stage: canvas.dataset.preparationStage ?? "unknown",
          timing: canvas.dataset.preparationTiming ?? "none",
          misses: Number(canvas.dataset.geometryMisses ?? 0),
          preparations: Number(canvas.dataset.preparationStarts ?? 0),
          aborts: Number(canvas.dataset.preparationAborts ?? 0),
          trails: Number(canvas.dataset.trailCount ?? 0),
          trailNodes: document.querySelectorAll(".public-circuit-touch-trail").length,
        });
      }, 16);
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuRate });
    const y = 570;
    const dispatch = (type, x) => cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1, radiusX: 6, radiusY: 6, force: 1 }],
    });
    await dispatch("touchStart", 100);
    for (let index = 1; index <= 120; index += 1) {
      const segment = index % 30;
      const x = dragPath === "one-way" ? 100 + (824 * index) / 120
        : Math.floor(index / 30) % 2 === 0
          ? 100 + (824 * segment) / 30
          : 924 - (824 * segment) / 30;
      await dispatch("touchMove", x);
      await page.waitForTimeout(16);
    }
    await dispatch("touchEnd", 100);
    await page.waitForTimeout(100);
    const { samples, touches, frames } = await page.evaluate(() => {
      clearInterval(window.__pcbHorizontalTimer);
      window.__pcbHorizontalFrameActive = false;
      return { samples: window.__pcbHorizontalSamples, touches: window.__pcbHorizontalTouches,
        frames: window.__pcbHorizontalFrames };
    });
    if (!samples) throw new Error(`Drag lost page state at ${page.url()}`);
    const valid = samples.filter((sample) => sample.lag >= 0);
    const gaps = valid.slice(1).map((sample, i) => sample.at - valid[i].at);
    const lag = valid.map((sample) => sample.lag);
    const paint = valid.map((sample) => sample.paint);
    const stages = Object.fromEntries([...new Set(valid.map((sample) => sample.stage))]
      .map((stage) => [stage, valid.filter((sample) => sample.stage === stage).length]));
    console.log(JSON.stringify({
      requestedScrollY,
      cpuRate,
      underlayMode,
      trailsMode,
      debugMode,
      dragPath,
      rafP95: Math.round(quantile(frames, .95)),
      rafMax: Math.round(Math.max(...frames)),
      actualScrollY,
      initialArt,
      visibleUnderlays,
      touches: touches?.length ?? 0,
      touchFirst: touches?.[0],
      touchLast: touches?.at(-1),
      samples: valid.length,
      lagP95: Math.round(quantile(lag, .95)),
      lagMax: Math.max(...lag),
      lagOver64: lag.filter((value) => value > 64).length,
      intervalP95: Math.round(quantile(gaps, .95)),
      intervalMax: Math.round(Math.max(...gaps)),
      paintP95: Math.round(quantile(paint, .95)),
      paintMax: Math.max(...paint),
      retained: valid.filter((sample) => sample.status === "retained-preparing").length,
      stages,
      lastTiming: valid.at(-1)?.timing,
      misses: valid.at(-1)?.misses,
      preparations: Math.max(...valid.map((sample) => sample.preparations)),
      aborts: Math.max(...valid.map((sample) => sample.aborts)),
      trailCountMax: Math.max(...valid.map((sample) => sample.trails)),
      trailNodesMax: Math.max(...valid.map((sample) => sample.trailNodes)),
      pageErrors,
      canvasState: valid.length === 0 ? await page.locator(".public-circuit-touch-canvas").first().evaluate((canvas) => ({ ...canvas.dataset })) : undefined,
    }));
    await context.close();
  }
} finally {
  await browser.close();
}
