# Loading recurrence — 2026-11-09

**2026-11-10 steering:** the user requires the complete visible sequence, beyond the raw transport stall. A matching controlled browser sequence is now recorded three times; current owner: `2026-11-10-loading-sequence-reproduction.md`. Administrator capture remains unapproved and is not a prerequisite for that reproduction.

Reopened. User reports a day-later visit: 5–6s skeleton, then content without PCB, then PCB much later. Previous synthetic/live verification did not establish resolution of this natural failure. No new application fix or deployment.

Earlier evidence already specifies homepage/case studies, Chrome/Edge and regular/incognito sessions (`2026-11-08-loading-deep-trace.md`). Do not make another URL/browser clarification a prerequisite. Investigate public production as working target. Available browser inventory exposes no affected tab. Preserve existing performance entries before reloading an affected tab if it becomes accessible.

## Findings

- Existing CSS emergency escape releases content after eight seconds of its animation. Geometry transport may wait twenty seconds and retry once on network/body errors. This permits the observed split appearance; it does not identify the initial stall. Do not lengthen the skeleton timeout as a root fix.
- Production versioned home/fingerprinted remote API responses and persistent remote indexes have one-year lifetimes. No configured one-day PCB expiry was found. Browser eviction is a separate question.
- Home index has process-memory caching only; recycled functions reread/hash/parse the 2,560,887-byte repository lens. A remote index miss fetches Storage with a ten-second timeout. Neither is measured as this episode's cause.
- Home awaits public projects before emitting its preload. A real data-cache miss can incur two four-second attempts plus 150ms. Ordinary 300s age does not prove blocking: installed Next returns stale values during dynamic render. This can postpone discovery but cannot alone explain a skeleton already painted from that completed page.
- No durable cached-failure path found: rejected broker/index entries are removed, public fallback sits outside persistent publication, API errors are no-store.
- API Server-Timing begins inside GET, excluding dispatch/module initialization and browser connection queueing. Cached timing headers describe original generation.

## Evidence and runtime

Focused fresh public home Chromium trace without injected delays passed: document TTFB180ms; bootstrap447–625ms; DOMContentLoaded692ms; PCB ready approximately849ms. Reload ready approximately194ms, unchanged geometry zero transfer. No page errors. These are passing samples, not reproduction or next-day acceptance.

Ignored artifacts: `artifacts/loading-diagnosis-2026-11-08/next-day-trace.mjs` and `next-day-chromium.json`. Trace captures response/cache/timing headers, navigation/resources, fetch/body/decode events and PCB/startup/skeleton transitions for one fresh visit and reload. Sandbox network attempt failed; authorized network-enabled rerun succeeded. Test browser closed.

Current read-only process/listener inspection: no repository Next writer or listeners3000/3001/3100. `.next/dev` remains; LAN192.168.0.102. Saved previous claims of a running LAN writer are historical. No runtime/cache mutation performed.

## Next and acceptance

Follow the connection-level finding below. Do not make missing clarification a blocker or repeat a broad route matrix. A captured affected navigation remains useful to correlate the complete symptom, but another passing route count does not assign the lower-layer delay.

Preserve exact artwork, PCB-first healthy reveal, interactions, accessibility/progressive enhancement and coordinated failure escape. No CMS/source or browser settings changes. Existing drafts preserved.

Sol/high worker performed read-only server/cache audit; parent traced client lifecycle and public timing. Model reason: interacting cache/serverless/broker contracts require substantive judgment; Luna handoff/review would duplicate analysis. Effort reason: recurrence after synthetic acceptance needs hypothesis tracing and discriminating checks. Routing evidence supports Sol candidacy, not local savings. Result narrowed hypotheses without a fix; neither axis changes for remaining investigation. No worker/test operation remains running.

## Continued investigation: reproducible connection stall

The user explicitly requested continued investigation without another clarification handoff. Yesterday's two isolated test profiles were revisited with NetLog enabled (not the user's normal profile): home ready506ms and957ms, cookie-store load9ms/8ms. These did not reproduce the severe stall. No normal browser settings were changed.

Focused analysis of existing NetLog found a **4.84s real response wait**, beyond the deliberately injected12s hold in the old reduced-motion fallback experiment. This is distinct from claiming the injected hold was natural:

- Request525/session522/socket514: PING and HEADERS accepted by socket at t0; no received socket bytes until PING ACK at4827ms; cached response headers at4840ms.
- Response was HTTP200, `x-vercel-cache:HIT`, age876, cached generation `pcb_origin0.4ms/pcb_encode20.1ms`. Thus the measured4.84s did not execute that origin generation afresh. Socket acceptance does not itself prove wire-transmission time.
- Matched healthy captured connection to the same64.29.17.131 endpoint:11.605s idle → PING ACK58ms → headers75ms. Slow connection had11.748s idle. Idle duration alone is not deterministic cause.
- Chromium sends a preface PING after ten seconds without reads, then serializes HEADERS immediately. It does not wait for ACK. PING is a connection-level frame, independent of the application stream. [Chromium implementation](https://raw.githubusercontent.com/chromium/chromium/main/net/spdy/spdy_session.cc), [constants](https://raw.githubusercontent.com/chromium/chromium/main/net/spdy/spdy_session.h), [HTTP/2 PING specification](https://www.rfc-editor.org/rfc/rfc9113.html#name-ping).

**New application-free reproduction:** built-in Node HTTP/2 client, no browser/React/SVG, no CPU/network throttling or fixed request-delay injection. On a reused connection to216.198.79.195 after12s of real idle, PING ACK took4829ms; cached PCB headers4844ms; body completed5011ms. Other cycles had56–58ms PING and70–93ms headers. Raw artifact `h2-idle-probe.json` preserves this run. The script was subsequently expanded; do not overwrite this original result.

This isolates a real intermittent connection-responsiveness boundary outside website rendering. It does **not** yet distinguish path/middlebox loss, endpoint HTTP/2 scheduling, local TCP handling or host/process scheduling; Node shares the host/network with Chrome. No simultaneous heartbeat was recorded during that slow sample. Do not blame Vercel or an ISP exclusively, or claim this alone proves the full reported visit's cause.

Follow-up controls all completed without the severe stall:

- Five rounds comparing tiny static asset on reused HTTP/2, fresh HTTP/2, reused HTTP/1.1 and Google HTTP/2 PING.
- Eight rounds with cached PCB and tiny static asset on the same HTTP/2 connection plus the other controls; Node heartbeat maxima approximately25–27ms.
- Eight single-connection rounds alternating explicit-PING/no-explicit-PING requests with heartbeat; eight further rounds to the original216.198.79.195 with read-only aggregate Windows TCP counters. No severe stall in those runs, so they cannot prove which control would have stayed healthy during a simultaneous failure. Aggregate retransmissions cannot identify a specific flow.

Freshness is not guaranteed retention: Vercel documents that rarely requested assets may be evicted despite long configured TTL. This is a possible reason a return visit needs network delivery, not an explanation for the captured PING latency. [Vercel cache behavior](https://vercel.com/docs/caching/cdn-cache).

Ignored evidence: `hit-wait-timeline.json`, `h2-ping-signatures.json`, `h2-idle-probe.json`, `connection-controls.json`, `connection-controls-pcb.json`, `h2-idle-heartbeat.json`, `h2-idle-stats-216.198.79.195.json`, their adjacent scripts and `revisit-*.netlog.json`. No application/build/deployment change. One diagnostic NETSTAT subprocess hung; verified test Node25116/NETSTAT34144 were stopped, and the controls were rerun without it. Other clients and their counter samplers finished/closed. Windows route is Ethernet4→192.168.0.1; no active VPN adapter was observed.

## Separately proven viewport queue defect

Two static decode workers can await an obsolete serialized geometry cohort while the viewport has changed. `onScroll` checks publication but does not dispatch independent current demand. Held-cohort test: jump at603ms, no new current-band request for10194ms; dispatch only190ms after old cohort release. Startup failed its deadline; PCB ready11602ms. Matched no-hold jump dispatched in101ms and was ready218ms after jump. Stationary-top control was ready541ms while belowfold batch remained held. Therefore this is a real viewport-change defect; it does not explain an unchanged top-of-page visit. Artifacts: `cohort-hol-summary.json`, `cohort-hol-probe.json/mjs`.

Correction direction, not implemented: separate current viewport acquisition from the ready-resource decode workers, preserving two decoders,8regions/query,16staged resources, atomic publication/resize replacement and consumer-safe shared transport. Do not present fixing this narrower defect as resolving the connection stall.

## Exact next access boundary

`pktmon status` failed: **Failed to communicate with the PktMon driver: Access is denied.** Ordinary network-enabled execution is not a Windows administrator token. No packet capture or elevation has been started. Vercel integration was discovered but is not connected; a suggestion was made through the [plugin-management skill](/C:/Users/akash/.codex/plugins/cache/openai-curated-remote/plugin-management/0.1.0/skills/plugin-management/SKILL.md). User connection consent remains required for server logs.

Prepared ignored helper `artifacts/loading-diagnosis-2026-11-08/capture-transport.ps1`: TCP216.198.79.195:443 only,96bytes/packet,8MiB circular cap,120s capture interval. No browser/DNS/firewall/adapter change. PowerShell parse and `-DescribeOnly` pass; privileged execution remains unverified. Independent review identified stop/filter ownership and native-command timeout gaps; helper now uses a unique logfile, checks active logfile before stop, validates a sole named filter before cleanup, and bounds each native invocation at5s. It refuses observed capture/filter changes. Installed CLI supports remove-all only; these checks are not an atomic ownership lock. Exclusive PktMon use during the capture is required. If identity is ambiguous, it preserves state and reports cleanup/stop failure; inspect status before further action. Do not promise unconditional cleanup under concurrent external monitor changes or driver failure.

User authorization question pending: approve launching that helper with an actual Windows administrator prompt, or continue without administrator access. Elapsed time is not approval. If approved, launch only the reviewed capture helper elevated (hidden window), wait for its ready marker, run the Node216.198.79.195 probe **unelevated**, wait for automatic stop, inspect cleanup/result, and analyze only the matching TCP flow for retransmission/ACK/payload timing. This distinguishes on-wire loss/delay from delayed client callbacks. Do not run arbitrary Node/application code as administrator. If approval is declined, preserve the current layer attribution and seek connected Vercel/support/network evidence; do not invent a website patch for an unassigned transport failure.
