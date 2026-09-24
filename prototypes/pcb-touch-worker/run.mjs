import { readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
async function installedPlaywright() {
  const links = path.join(process.env.LOCALAPPDATA ?? "", "ms-playwright", ".links");
  for (const name of await readdir(links)) {
    const core = (await readFile(path.join(links, name), "utf8")).trim();
    try { return await import(pathToFileURL(path.join(path.dirname(core), "playwright", "index.mjs")).href); }
    catch { /* Try another installed link. */ }
  }
  throw new Error("No linked Playwright installation was found.");
}

const playwright = await installedPlaywright();
const browserName = (process.argv.find((arg) => arg.startsWith("--browser=")) ?? "--browser=webkit").split("=")[1];
if (!playwright[browserName]) throw new Error(`Unknown browser: ${browserName}`);
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const launchOptions = browserName === "chromium" && existsSync(chrome)
  ? { headless: true, executablePath: chrome } : { headless: true };
const browser = await playwright[browserName].launch(launchOptions);
const results = [];
const source = await readFile(path.join(directory, "worker.js"), "utf8");
try {
  for (const scenario of [
    { widthCss: 1092, heightCss: 708, ratio: 1, repeats: 4 },
    { widthCss: 1696, heightCss: 1100, ratio: 1, repeats: 4 },
  ]) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    try {
      await page.goto("about:blank");
      await page.evaluate((value) => { window.__pcbWorkerSource = value; }, source);
      await page.addScriptTag({ path: path.join(directory, "benchmark.js") });
      const result = await page.evaluate((input) => window.runPcbWorkerBenchmark(input), scenario);
      results.push(result);
      console.log(JSON.stringify(result));
    } finally { await page.close(); }
  }
} finally { await browser.close(); }
await writeFile(path.join(directory, `results-${browserName}.json`), `${JSON.stringify({
  createdAt: new Date().toISOString(), engine: `Playwright ${browserName}`, browserVersion: browser.version(), results,
}, null, 2)}\n`);
