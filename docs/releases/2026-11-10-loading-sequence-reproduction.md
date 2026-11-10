# Full loading-sequence reproduction — 2026-11-10

Follow-up causal experiments and root-correction constraints: `2026-11-10-loading-root-cause.md`. The recording below remains the user-visible evidence; it is not a completed fix.

The complete reported presentation is now recorded in the public production homepage: approximately five seconds of visible skeleton, then completed page content without PCB, then PCB another six to seven seconds later. It repeated three times under the stated controlled conditions. **The natural day-later trigger is not established.** The separate raw HTTP/2 stall is not a substitute for this full sequence.

## Latest recorded sequence

| Stage | Navigation age | User-visible consequence |
| --- | ---: | --- |
| First visible skeleton sample | 3.051s | Skeleton on screen; no PCB/content |
| Skeleton expiration observed | 8.024s | Approximately 4.974s of visible skeleton |
| Canonical content appears | 8.075s | Artwork still pending; no PCB tiles |
| Content fully visible | 8.475s | Complete page, PCB absent |
| First populated PCB canvases | 14.950s | PCB arrives 6.875s after content starts, 6.475s after full content |

Earlier matching runs measured skeleton-to-content5.303s/5.440s and content-to-PCB6.750s/6.529s. Those earlier summary fields were named `visibleSkeletonMs` but actually measured first skeleton sample to first content; the viewer now separately derives skeleton expiration. Sample spacing is approximately50ms. Original JPEG frames visually confirm all three stages, beyond logical readiness attributes.

Local ignored evidence:

- Replay/scrub viewer and three keyframes: `artifacts/loading-diagnosis-2026-11-08/recorded-sequence.html`.
- Compact phase/body/script evidence: `matched-sequence-summary.json` in that directory.
- Selected raw record: `sequence-visible-idle-background-controlled-slow-incognito-2026-11-09T19-07-46.273Z/result.json`, adjacent unmodified JPEG frames and `netlog.json`.
- Earlier matches: directories ending `2026-11-09T19-01-30.721Z` and `2026-11-09T19-05-32.967Z`.
- Reproducer: `sequence-reproduction.mjs`; viewer builder: `build-sequence-viewer.mjs`.

## Conditions and limits

Chrome incognito, production `https://freebirdakash.vercel.app/`, actual1440×883 viewport. The test used24,000bytes/s download throughput and150ms latency through CDP network emulation. The isolated browser window began minimized and was shown at DOMContentLoaded, with **zero additional hidden wait** in the matching runs. Foreground focus was kept active during the controlled recording. There were no fixed request holds, response substitutions, artwork changes or application changes.

These conditions reproduce the visible failure; they are not evidence that the user's connection was24KB/s or that the original visit used the same window lifecycle. Ordinary returning-home/case, incognito and history runs did not capture the severe unthrottled symptom. Do not assign the natural episode to bandwidth, a browser profile, an extension, Vercel or an ISP from this result.

The third match avoids hidden-page measurement side effects: its sampler immediately returns while hidden, without reading computed styles, element bounds or animation state. It still reproduces the complete sequence. Nullable animation times, start times, pending and play state are preserved. Initial `Number(null)` values in earlier probes must not be described as a proved animation-clock jump or browser bug.

## Causal trace of this reproduction

At content release8.075s, artwork is `pending`; main startup failure/readiness fields are absent. **CSS releases the content before application hydration.** A later JavaScript `failed/deadline` marker cannot have caused that earlier release.

Renderer effects appear around12.728s. The native bootstrap correctly begins acquisition at0.431s and receives headers at0.656s, but its body does not finish until14.867s. Six nonblank canvases appear at14.950s, approximately83ms afterward. The earlier match similarly showed React's core chunk completing12.800s, renderer effects12.851s, bootstrap body14.987s and nonblank canvases15.093s.

Thus the sequence in these runs combines **CSS's autonomous escape, late hydration, and prolonged body transfer**. Body completion is the final limiting boundary once hydration is available. The frames/pixels do not support slow SVG paint, canvas context loss or viewport queue starvation as the cause of these matching runs. Scroll remains at0. A passive worker-chunk cancellation is recorded; it is not an application page exception or evidence that first-paint geometry failed.

The eight-second CSS boundary is not eight seconds of observed skeleton. In the earlier record, shortly after first foreground exposure the running animation already has about3.09s elapsed, and expires around document-age8s. Frames confirm the shorter visible interval. Keep animation age, first actual presentation, content entrance and PCB paint as separate measurements.

## Reproduction-harness correction

Earlier Playwright launches disabled back/forward caching and background behaviors through their default flags. Removing flags alone was insufficient: Playwright also enables focus emulation on its own protocol session. Several attempted background tests continued to report `visibilityState="visible"`; those are **invalid as hidden-page tests**.

The corrected reproducer launches installed Chrome normally into an isolated test profile, then attaches using `connectOverCDP(..., { noDefaults: true })`. It verifies actual hidden/visible state before recording. Controlled runs explicitly record the later foreground-focus override. No user normal profile or global browser setting was changed. A normal history test with back/forward caching enabled recorded `pageshow.persisted=true` and retained populated canvas pixels.

## State and next work

The user's immediate request to reproduce the full visible sequence has a concrete recorded result, with controlled limits stated. Parent loading correction remains open: do not call the original natural revisit explained or the website fixed. Follow the complete critical path and preserve the exact artwork, PCB-first healthy reveal, two-frame publication, native interactions, progressive enhancement and bounded failure escape. Increasing the timeout alone is not a root correction.

No application source, build, server, CMS or deployment changed. Capture clients and browsers are closed. Windows administrator packet capture was neither approved nor launched; its pending permission request is not a prerequisite for this browser reproduction. Prior transport/queue evidence and the prepared helper remain in `2026-11-09-loading-recurrence.md`; user steering made the complete visible sequence the immediate priority.

Allocation remained Sol/high for the independent clock/paint/hydration audit: substantive cross-boundary judgment justified the model, and causal/observer-effect tracing justified effort. Parent owned browser recording and qualitative frame verification. Both axes were reassessed and unchanged; no cost savings are claimed.
