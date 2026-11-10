import { spawn, execFile } from "node:child_process";
import { createRequire } from "node:module";
import { createNativeBuild } from "./build-pcb-native.mjs";

const require = createRequire(import.meta.url);
const builder = await createNativeBuild({ watch: true });
const next = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", ...process.argv.slice(2)], {
  stdio: "inherit", windowsHide: true,
});
let stopping;
function stop() {
  return stopping ??= (async () => {
    if (next.exitCode === null && next.signalCode === null && next.pid) {
      if (process.platform === "win32") {
        await new Promise((resolve) => execFile("taskkill", ["/PID", String(next.pid), "/T", "/F"],
          { windowsHide: true }, resolve));
      } else next.kill("SIGTERM");
    }
    await builder.dispose();
  })();
}
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.once(signal, () => { void stop().then(() => { process.exitCode = 0; }); });
}
next.once("error", (error) => {
  console.error(error);
  void stop().then(() => { process.exitCode = 1; });
});
next.once("exit", (code) => { void stop().then(() => { process.exitCode = code ?? 0; }); });
