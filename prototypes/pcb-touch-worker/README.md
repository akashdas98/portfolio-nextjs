# Touch halo worker experiment

This is an isolated Canvas benchmark. It does not import or change the production touch renderer. Run `node prototypes/pcb-touch-worker/run.mjs` for local Playwright WebKit or add `--browser=chromium` for the supplemental Chrome run. Each command writes a separate `results-*.json` file.

The fixture paints 680 deterministic traces on a 1092 × 708 or 1696 × 1100 mask. Both paths perform the same three sequential blue shadowed `drawImage` passes. The worker path creates an input `ImageBitmap` from the core, transfers it to a dedicated worker, decorates it on two `OffscreenCanvas` surfaces, transfers the output `ImageBitmap` back, and publishes it to a visible-thread Canvas. Four alternating runs follow warmup. The runner records complete request-to-publish time, input bitmap creation, `postMessage` call, worker execution, publish call, per-pass calls, and requestAnimationFrame gaps. Pixel comparison reads both results back and compares alpha plus RGB composited over `#121212`.

## Results, 2026-09-24

The local Playwright WebKit reports version `26.6` but exposes `OffscreenCanvas` as `undefined` in both the page and dedicated worker. `ImageBitmap` exists in the worker. This build cannot execute the proposed worker decoration, so worker latency, transfer cost, and WebKit pixel fidelity are **unmeasured**. The benchmark reports this capability failure explicitly rather than substituting another engine's numbers.

| Local WebKit mask | Main path request-to-publish, four runs | Longest observed RAF gap per run | Main publish call |
| --- | --- | --- | --- |
| 1092 × 708 | 19–24 ms | 22–35 ms | 5–6 ms |
| 1696 × 1100 | 46–53 ms | 57–67 ms | 13–15 ms |

In supplemental local Chrome 153, `OffscreenCanvas` and `transferToImageBitmap` exist in the worker. The final main and worker images match exactly in this fixture at both sizes: zero changed pixels, with 764,647 and 1,641,249 nonzero-alpha pixels respectively. Chrome reports 0.2–0.9 ms command-return times for the main path and 0.2–0.7 ms for the worker path, with no material RAF difference in this fixture. Those times do **not** represent completed GPU paint: Chrome queues the Canvas operations and returns early. They establish API wiring and a limited pixel check, not a useful WebKit performance comparison or physical iPad result.

[WebKit's Safari 16.4 release notes](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/) state that Safari added Offscreen Canvas 2D and worker rendering in that release. The missing API in the local Windows Playwright WebKit build therefore does not imply absence on modern iPad Safari. Production would still need runtime feature detection and a main-thread fallback for older or otherwise unsupported contexts.

## Guarded production candidate

Further local WebKit instrumentation measured individual full-region plain and shadowed Canvas calls up to 223 ms and 232 ms during preparing-frame gaps. The touch renderer now tries a dedicated worker when the page and worker expose the required `OffscreenCanvas` and `ImageBitmap` APIs. It transfers a snapshot of the retained geometry mask, scales and colors the core and performs the same three shadow passes in the worker, and retains the returned `ImageBitmap` for direct live cropping. Unsupported, failed, and timed-out worker paths use the existing main-thread decorator. The worker result is closed when its prepared region is released. Gesture handling and desktop rendering are unchanged.

`node prototypes/pcb-touch-worker/verify-crop.mjs` exercises the production worker algorithm in local Chromium: direct crop from its output bitmap matched a main-thread Canvas crop exactly (zero changed channels). The fixture uses synthetic geometry. The bundled module worker also ran on the actual page through the LAN origin in local Chrome, with zero reported publication lag in four synthetic tablet drag scenarios. Real PCB pixel fidelity, completed GPU work, and physical iPad Safari latency still require verification. Local Playwright WebKit remains on the fallback path because it lacks `OffscreenCanvas`.
