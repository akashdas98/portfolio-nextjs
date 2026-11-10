# Complete loading correction — local implementation, 2026-11-08

**Reopened 2026-11-09:** the user reports the natural day-later skeleton/content/late-PCB failure persists. Checks below establish tested behavior, not resolution of that recurrence. Current investigation: `2026-11-09-loading-recurrence.md`.

User-authorized loading correction is deployed and live-verified, preserving the intended PCB-first presentation. Initial commita2d0f26and native-link follow-updf3ef16are released. This supersedes diagnosis-only scope and the earlier suggestion to use early content release as the fix.

## Root boundaries corrected

The measured dependency chain started regional artwork delivery only after application scripts loaded and React effects ran. A separate passive interaction warmup could compete with that first-paint delivery. Independent eight-second CSS, skeleton and scroll timers then produced the reported partial-page state. A critical tile error could also wait behind an unrelated worker before reporting failure.

The generic bounded source-band preload now starts from server-rendered HTML, without awaiting Storage, decoding SVG in SSR, or changing canonical content. The client broker consumes that exact URL and shares its pending response only with contained tile consumers. Other regions—including restored scroll positions and unusually tall viewports—retain immediate on-demand delivery. Only explicitly registered bootstrap entries can cover pending consumers; an unrelated pending full-source interaction cannot hold the static renderer hostage.

The preload is an explicit native link element. The first implementation used imperative React resource hints, which worked in the static homepage but reached Vercel dynamic case-study pages through Flight after application scripts. A strict delayed-script case test exposed that difference: merely starting shortly before the renderer effect was insufficient evidence of early acquisition. The native element passes the production-build test in both engines, acquiring approximately5s before delayed application scripts complete. Do not substitute an imperative hint without verifying that boundary on the deployed dynamic routes.

The first2048source units plus16units of conservative padding are resource-cache coverage, not a viewport/device heuristic or a different composition. Existing native bounds, source order, palettes, tile size, raster budgets and source authority are unchanged. Home bootstrap is approximately130KB compressed; other regions still use exact spatial selection. No unbounded inline artwork payload or source fetch was added to the HTML critical path.

The homepage now has an exact SHA256 revision for its unchanged repository-owned lens. Working and committed bytes were verified identical. Versioned bootstrap and regional responses are immutable for one year; legacy unversioned requests retain revalidation, mismatched/duplicate revisions are rejected without caching, and source derivation verifies the actual hash. This closes repeated homepage network revalidation without guessing a version or serving changed art under an old immutable identity. The source-hash test must be updated with any future approved home lens revision. Storage-owned sources keep their existing fingerprint identity.

### Cross-engine request matching

Chromium reused the initial anonymous fetch preload, but WebKit actually downloaded it twice—even for fingerprinted immutable remote sources. A transparent HTTP proxy confirmed both network requests and isolated their differing `Origin` headers. WebKit's raw-resource cache compares those headers before its preload-reuse branch. [WebKit reuse implementation](https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebCore/loader/cache/CachedRawResource.cpp)

A focused fixture established the portable pair: no `crossorigin` attribute on the preload and `mode:no-cors`, `credentials:include`, `redirect:error` on the explicitly registered bootstrap fetch. The builder always targets the literal same-origin `/api/pcb` endpoint; redirects are rejected so these credentials cannot follow another origin. Ordinary geometry fetch options remain unchanged. Both engines then consumed one response with no unused-preload warning. This is request-policy alignment, not source version guessing or a cache-clearing workaround.

### Preserved presentation and failure behavior

Healthy startup still publishes the complete decoded current viewport atomically and waits two animation frames before releasing normal UI entrances. Real pointer and touch demand remain immediate; only passive desktop/coarse-pointer warming waits for the initial static viewport.

The existing eight-second emergency escape is coordinated rather than extended. Its deadline is read from the already-running CSS animation, so late hydration cannot restart the wait. Failure is latched for startup, releases queued and future reveals, and late artwork completion cannot re-hide content. No-hydration CSS escape, noJS canonical content and reduced-motion behavior remain. Initial worker failure reports immediately and suppresses stale publication while the other worker settles.

## Verification checkpoint

- Final production build and TypeScript pass;93affected bootstrap/broker/spatial/touch-preparation/integration/persistence tests pass.
- Chromium and installed WebKit pass all four public routes, desktop/laptop/mobile, reduced motion and noJS. Each scripting-enabled normal visit consumes one bootstrap response; noJS requests none.
- With scripts delayed5s, artwork acquisition begins from HTML before hydration in both engines and is consumed once. With artwork delayed12s or scripts delayed10s, the original emergency boundary releases later sections without another eight-second wait and late art does not re-hide them.
- Restored scroll outside the bootstrap band and tall viewports dispatch direct geometry immediately. A critical tile decode failure reports in approximately0.3s while a second worker is deliberately held6s. Passive warming does not compete during the held bootstrap; real pointer demand starts independently and real touch mounts its own interaction surfaces.
- Corrected local production build reached first viewport readiness around0.14–0.28s in warm Chromium samples and0.18–0.51s in warm WebKit samples. Initial remote cold samples include database/Storage time and are not represented as warm speedup percentages.
- At32KB/s, corrected startup measured11.17s;64KB/s measured5.71s. The slow connection still has a real byte-transfer cost; this release does not promise instantaneous loading at arbitrary bandwidth. The key proven correction is early overlapping acquisition, single consumption, preserved paint ordering and no renewed reveal delay. Existing external browser connection stalls are not claimed eliminated.

Final API checks pass for all four sources: exact selected strings/bounds/order match ordinary delivery; compressed and uncompressed bodies agree; versioned home is immutable, legacy parity/revalidation holds, invalid home revision returns400/no-store. `Server-Timing` distinguishes source/index selection and serialization/compression from browser queue/connection/body time. CDN hits carry origin-generation timings for the cached response; do not interpret them as fresh origin work on every hit.

Desktop, laptop, mobile and case-study screenshots were reviewed. One clean LAN dev writer is restored at `http://192.168.0.102:3000`: HTML200 with must-revalidate, all17referenced CSS/JS200 with no-store, current CSS/lifecycle code, published case-study links and direct email fallback verified. `.next/dev` exists and production `BUILD_ID` is absent. Production test servers and temporary proxy are stopped.

## Evidence, allocation and remaining work

Ignored `artifacts/loading-diagnosis-2026-11-08/` contains the focused preload-policy fixtures, transparent proxy counts, correction browser sequences/screenshots and boundary probes. A preliminary case-study404 was caused by restricted test-server network access; restarting the verified local server with authorized anonymous Supabase access restored published routes. Production build was also repeated with those reads available. Test sampling excludes pre-stylesheet computed defaults, which are not visible painted UI. WebKit resource start times after a deliberately intercepted delay reflect route continuation; delayed-script tests establish the actual early request behavior.

Sol/high worker implemented and verified the bounded broker integration; parent owned server wiring, lifecycle, render-failure correction, request-policy diagnosis and runtime verification. Model capability remained Sol for concurrent rendering/cache invariants; high effort supported causal failure and engine-policy analysis. Reassessment changed neither axis. No benchmark savings are claimed.

CMS/source data, normal browser settings, unrelated drafts and contact configuration remain untouched. Do not mark the original natural episode conclusively explained by the separate cookie-store navigation delay or by bandwidth alone. The correction removes the proven avoidable dependency/cache/lifecycle defects; it does not guarantee zero latency during an external network or browser connection failure.

## Final production verification

- Final application SHA `df3ef166f7cead9f27d256938c9ce1f0928d2438`; GitHub deployment7634051604reports Production success. Immutable deployment: `https://portfolio-nextjs-itys2dji7-akash-freebird.vercel.app`; public domain: `https://freebirdakash.vercel.app`.
- Both engines pass the exact deployed four-route desktop, laptop, mobile, reduced-motion and noJS checks. Every normal scripting visit consumes one bootstrap; noJS home and all three case-study routes keep canonical content visible and make no artwork request. No JavaScript page errors or unused-preload warnings in normal checks.
- Stricter deployed dynamic-case checks pass with scripts held5s. Chrome starts acquisition1198ms versus hydrated consumption6844ms; WebKit492ms versus5715ms. Both preserve normal PCB-first order. This explicitly proves independent native acquisition, rather than accepting a hint that appears milliseconds before the renderer effect.
- Live prolonged-artwork, geometry-outage and late-JS checks pass in both engines: lower sections do not acquire another eight-second startup wait; late readiness does not re-hide content. Reduced-motion failure paths pass.
- Final repeated homepage visits transfer zero bytes for unchanged versioned geometry. Reload viewport readiness measured163ms Chromium and207ms WebKit. Fresh final four-route samples ranged634–2821ms Chromium and701–2008ms WebKit; those include differing server/network/cache conditions, so no universal speedup percentage is claimed.
- All four live source selections match local exact path/bounds/order hashes. Home immutable/legacy parity, bad-revision rejection and origin timing headers pass.

One initial live script-hold probe acquired all bootstrap bytes by361ms but application scripts received headers around14.8s after a5s injected hold. Its normal-order assertion was correctly reclassified as late-JS failure after independent timing proof that the existing deadline elapsed. A focused follow-up with full network logging reached normal readiness around5.55s in both engines. The exact extra script-header wait remains external/unattributed; do not claim it was SVG parsing or cookie-store startup. The deployed cache/overlap/failure corrections and phase diagnostics remain valid. This observation is a reopening trigger if a naturally slow affected visit persists, not evidence that another broad route matrix is needed.

Post-deployment evidence is checkpointed locally; no extra documentation-only push was made after final live verification. The clean LAN dev writer remains at `http://192.168.0.102:3000`; test browsers, production test servers and proxy have stopped.
