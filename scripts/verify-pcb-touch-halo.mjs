import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, [
  "--experimental-strip-types",
  "--test",
  "--test-name-pattern=browser pixels",
  "scripts/pcb-touch-integration.test.mjs",
], {
  cwd: process.cwd(),
  env: { ...process.env, PCB_TOUCH_BROWSER_PIXELS: "1" },
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
