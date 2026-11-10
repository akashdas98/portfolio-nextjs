# Loading initiation follow-up — 2026-11-08

Continues [the initial reproduction](2026-11-08-loading-diagnosis.md). User clarified: both homepage and case studies, desktop Chrome and Edge, regular and incognito sessions. The user requires the intended PCB-first reveal unchanged and a root-cause correction. Do not implement the earlier suggested content-first timeout behavior on the strength of this investigation.

## Scope and result

Read-only application investigation with browser-local instrumentation and controlled network/CPU experiments. No application code, production settings, deployment, CMS, browser profile, or local server changed. No connected browser surfaces were available through computer-use inventory, so the affected user's live tab could not be inspected.

The reported long startup now reproduces **without fixed request-delay injection**, on a bandwidth-constrained connection. This identifies a real sequential download path and measurable speculative-transfer contention. It does **not** establish that the user's intermittent episodes are bandwidth constrained, or that this is their sole initiating cause. No natural unthrottled 8–10s episode was captured; a full root-cause diagnosis of that episode remains open.

## Additional measurements

37 new browser scenarios: eight fresh Chromium visits across all four routes, eight fresh Edge visits across those routes, six CPU/DPR/resize/scroll/freeze/history scenarios, five bandwidth scenarios, two low-bandwidth/input scenarios, four controlled A/B comparisons, and four subsequent browser network-log runs. These supplement the earlier fourteen tests. Twelve anonymous API reads separately compared cache hits and misses, with identical response hashes per route.

| Test | Measured result |
| --- | --- |
| Eight unthrottled fresh Chromium contexts | PCB viewport readiness 0.52–2.68s; no JavaScript page errors. |
| Eight unthrottled fresh Edge contexts | Readiness 0.55–0.91s; no JavaScript page errors. |
| Slowest natural home trace | Request start 440ms, headers 1997ms, JSON complete 2592ms, first decode 2599ms, viewport ready 2684ms. Most delay precedes decoding. |
| CPU 6× slower, DPR3, home | Ready 3.60s; maximum tile decode 172ms and snapshot draw 25ms. Does not reproduce prolonged missing PCB. |
| CPU 6× slower, DPR2, case | Ready 2.15s. |
| Early scroll, repeated resize, freeze/resume, history/back | Completed readiness; no deadlock observed. These are controlled browser experiments, not proof against all real tab-lifecycle failures. |
| Twelve direct API reads | MISS total 0.50–1.10s versus repeated equivalent HIT 0.07–0.12s. Response hashes identical for canonical and diagnostic-query variants. Headers show `bom1::iad1` origin/edge routing. No cold-instance guarantee. |
| 64,000 bytes/s, 150ms latency, empty browser HTTP cache | Eight script resources total 167,766 transferred bytes; last script finished ~3.49s; first regional artwork request ~3.54s; PCB ready ~5.70s. |
| 3840×2160, 128,000 bytes/s | Multiple serial viewport cohorts; PCB ready 5.91s. |
| 32,000 bytes/s, 150ms latency, parked pointer | First artwork request 6.75s, JSON complete 12.33s, ready 12.43s. No long main-thread task observed. |
| Same limit, pointer moved after renderer initialization | Full-source interaction fetch started alongside the regional fetch; JSON complete 14.34s, PCB ready 14.39s. |

At 32,000 bytes/s (256 Kbit/s), a repeated browser-only A/B held the full-source request until the viewport was ready. It did not alter the server or release content early. Control ready times were 12.79s and 11.86s. First treatment was 11.11s, but the second treatment was **30.51s**. The latter contradicts a simple contention-only diagnosis. Its initial regional request waited 19.13s before DNS/connection activity began, despite ultimately receiving a CDN HIT. The body then hit the broker's 20s timeout and retried; the retry completed normally. This is a pre-connection wait, not evidence of 19s spent parsing artwork or computing an origin response. Cache state also differed between some A/B runs. Do not present this comparison as a reliable speedup estimate or conclude that speculative warming is the sole cause. Browser network logging was added to investigate the wait. It is a diagnostic intervention, not a proposed production interaction change.

The earlier 64KB/s pointer experiment moved the pointer before the interaction listeners were ready and did not exercise active-input contention. The later 32KB/s active-pointer test explicitly waited for renderer initialization and confirmed the early full-source request in the network trace. Do not treat the earlier result as proof that input has no effect.

Four subsequent network-log runs at the same 32KB/s limit reached readiness in 12.33–12.39s and did not reproduce the anomalous pre-connection wait. Their completed Chrome NetLog shows direct HTTP/2 portfolio connections; it cannot explain an earlier event that happened before recording began. The anomalous wait therefore remains unlocalized within browser request scheduling/connection acquisition. Do not equate the 19.13s before `dnsStart` with DNS lookup duration: the DNS lookup itself was near-instantaneous once started. The favicon also stalled over the same interval, arguing against an artwork parser alone causing it.

## Confirmed initiating boundaries

The browser's first regional geometry request starts in `StaticCircuitVector`'s effect, after the relevant application scripts download and hydrate. Geometry must then download and parse before image decoding, canvas snapshots, and the existing two-frame publication. At low bandwidth these costs accumulate rather than overlap.

Desktop interaction mounts automatically after 1.2s, then warms full-source geometry after another 1.2s; actual pointer input can start it earlier. The ~643KB compressed home full-source response shares the connection with ~114KB compressed initial regional geometry. The broker can use a completed full-source response to satisfy regional requests, so this request can sometimes rescue pending regional work as well as compete. Simply removing it or delaying genuine input is not an acceptable behavior-preserving fix.

On fresh processes, the home source still requires local file loading/parsing; its persistent remote-cache branch is not used. Remote cache misses and geographically routed API requests add time, but the measured misses alone do not explain an 8–10s episode. The previous oversized remote-cache correction remains valid.

No circular wait was found in the geometry broker, persistent-index recovery, or static renderer. Each static layout owns its own queue; superseded versions cannot hold a new queue or publish stale tiles. Resize notifications with unchanged layout keys are ignored. Repeated resize notifications alone are not evidence of repeated rendering.

## What must happen before a root fix

Capture one naturally slow visit in the affected environment. Distinguish:

- a late first API request: script transfer/initialization;
- a prompt request with late headers: origin/edge/server or connection waiting;
- prompt headers but late response end: body transfer;
- completed geometry with late readiness: decode/layout/publication.

The local read-only DevTools helper `artifacts/loading-diagnosis-2026-11-08/capture-slow-visit.js` copies navigation/resource timings, public PCB state and heading opacity. Run after a slow visit and before navigation/reload. It sends nothing and changes no site state. It can discriminate the dominant phases after an episode, but cannot retroactively capture per-tile decode timing or server internals. Existing `firstViewportMs` supplies the final publication timestamp.

A behavior-preserving correction should shorten the measured critical path: for example, start the needed geometry earlier, improve the proven origin path, or prevent speculative transfer from competing with first paint while preserving immediate demanded interactions. Which correction is warranted depends on the natural trace. Do not replace the intended reveal behavior, raise arbitrary timeouts, reduce artwork fidelity, or claim a full root fix from these synthetic conditions.

## Evidence, allocation, and handoff

Local uncommitted evidence is under `artifacts/loading-diagnosis-2026-11-08/`: `trace-init.js`, `deep-probe.mjs`, `deep-natural.json`, `deep-edge.json`, `deep-stress.json`, `deep-bandwidth.json`, `deep-lowbandwidth.json`, `deep-ab32.json`, `deep-netlog.json`, `chrome-netlog.json`, `api-cache-probe.mjs`, and `api-cache.json`. Keep generated traces out of application commits. Instrumentation wraps browser-local fetch/JSON/decode/draw operations and records long tasks, layout notifications and readiness; it is absent from the deployed application. No pointer delays or fetch deferrals were used in natural baseline tests.

Parent owned live tracing and synthesis; reused Sol/high source-analysis worker. Reassessment changed neither axis: the remaining task still required cross-boundary lifecycle/transport judgment and sustained hypothesis discrimination. The source audit was reviewable against traces; the parent did not duplicate the worker's deadlock investigation. All operations must be finished before clear-readiness is declared. Next dependency is a natural affected-environment trace; pending diagnostics are not permission to change the intended behavior.

## Visible Chrome follow-up and investigation correction

User authorized using a Chrome instance directly. The browser connector was unavailable; installed Chrome was launched visibly with an isolated, repository-local test profile. The normal Chrome process/profile was not restarted, changed or controlled. `.gitignore` now excludes this investigation directory, including generated browser databases, screenshots and logs.

Visible Chrome completed six initial direct visits: home fresh3.290s, reload0.239s, Delivery Intelligence1.667s, Leads1.363s, Horecah0.847s and home return0.244s. No JavaScript page errors. Chrome then remained open for310s without portfolio network requests before revisiting: home0.967s, EDD0.770s, home return0.404s. The expired home geometry entry returned `MISS`, age0, and navigation opened a new connection. This establishes that ordinary cache expiration plus connection renewal did not produce a severe stall in that run, not that they can never do so.

The first fresh document's approximately1.94s pre-connection wait is specifically attributable to its cookie-store loading boundary: `COOKIE_PERSISTENT_STORE_LOAD` source34 ran134243819–134245761, and document source38 resumed transaction startup at134245761. Chromium's HTTP startup waits for that domain's cookie read callback. Geometry requests149,200,206,214 and261 had0ms between privacy-mode calculation and transaction startup. Thus this finding explains a separate initial navigation pause and does **not** explain the after-hero artwork episode or the earlier19.13s API wait. Cookie-store loading includes crypto/database/task delivery; the trace does not isolate its internal substage. Do not change cookie/browser settings or claim `credentials: omit` is the root fix from these observations.

Primary implementation references: [Chromium cookie loading](https://raw.githubusercontent.com/chromium/chromium/main/net/cookies/cookie_monster.cc), [HTTP job startup](https://raw.githubusercontent.com/chromium/chromium/main/net/url_request/url_request_http_job.cc), [request credential handling](https://raw.githubusercontent.com/chromium/chromium/main/services/network/url_loader_util.cc).

An additional link/Back matrix was already running when the user corrected the investigation direction. It completed without severe delay. Project cards use normal anchors; the recorded case-study link navigations were full document navigations, so do not present them as proof of a distinct Next client-router path. They did not explain the known waiting boundaries and should not be extended into another broad matrix.

**User correction:** delayed boundaries have already been found; investigate WHY each waits, rather than restarting general reproduction. Accepted. Remaining investigation is a focused dependency trace of the known19.13s pre-connection artwork wait, and phase attribution of observed header/body delay. A new capture is justified only to obtain the missing browser network events for that particular wait; another generic route-success count is not useful progress. The anomalous request predates NetLog recording, so its exact internal waiter cannot be recovered retroactively from its CDP timing record. Keep the confirmed presentation defect, confirmed sequential transfer cost, confirmed navigation cookie wait, and unresolved API waiter distinct.

All headed test processes have completed and closed their own Chrome contexts. Raw evidence is in `visible/`, `visible-idle/` and `visible-spa/`; `summarize-netlog.mjs` extracts request startup and cookie-load overlaps without treating correlation alone as causation. No application or deployment change was made.
