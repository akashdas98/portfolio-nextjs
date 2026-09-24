import { readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));

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

const scenarios = [
  // Current tablet two-tone prepared surface; 1x is the accepted boundary cap.
  { widthCss: 1092, heightCss: 708, ratio: 1 },
  // Representative larger one-tone surface at the observed 1.4x density.
  { widthCss: 1092, heightCss: 708, ratio: 1.4 },
];
const variants = [
  { interiorCss: 256, guardCss: 0 }, // Positive control: should expose clipped halos.
  { interiorCss: 256, guardCss: 16 },
  { interiorCss: 256, guardCss: 64 },
  { interiorCss: 384, guardCss: 64 },
];
const requested = (process.argv.find((item) => item.startsWith("--browsers=")) ?? "--browsers=chromium,webkit").split("=")[1].split(",");
const localChrome = process.env.PCB_HALO_CHROME_EXECUTABLE ??
  (process.platform === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : "");
const playwright = await installedPlaywright();
const results = [];
for (const browserName of requested) {
  const engine = playwright[browserName];
  if (!engine) throw new Error(`Unknown browser: ${browserName}`);
  let browser;
  try {
    const launchOptions = browserName === "chromium" && existsSync(localChrome)
      ? { headless: true, executablePath: localChrome }
      : { headless: true };
    browser = await engine.launch(launchOptions);
    const page = await browser.newPage();
    await page.goto("about:blank");
    await page.addScriptTag({ path: path.join(directory, "benchmark.js") });
    for (const scenario of scenarios) {
      for (const variant of variants) {
        const result = await page.evaluate((input) => window.runHaloTileBenchmark(input), {
          ...scenario, ...variant,
        });
        results.push({ browser: browserName, ...result });
        console.log(JSON.stringify(results.at(-1)));
      }
    }
    await page.close();
  } catch (error) {
    results.push({ browser: browserName, error: String(error) });
    console.error(`${browserName}: ${error}`);
    process.exitCode = 1;
  } finally {
    await browser?.close();
  }
}
const output = path.join(directory, "results.json");
await writeFile(output, `${JSON.stringify({ createdAt: new Date().toISOString(), results }, null, 2)}\n`);
console.error(`Saved ${output}`);
