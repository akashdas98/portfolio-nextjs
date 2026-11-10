# Loading root-cause investigation — 2026-11-10

## Finding

The reproduced split appearance comes from the public first-paint dependency graph. CSS releases canonical content at its autonomous eight-second escape, while static PCB preparation still depends on React hydration and a separate, substantial geometry download. Native preloading moved acquisition earlier but did not remove the hydration gate or competing initial transfers.

The app-side mechanism is proved. **The initiating cause of the user's original uninstrumented day-later delay remains unassigned.** Cold/evicted resources or a stalled request can expose the graph, but neither throttled reproduction nor the separate HTTP/2 stall establishes that original cause. Do not blame the user's connection or present an architectural prototype as a deployed fix.

## Evidence from the complete sequence

See `2026-11-10-loading-sequence-reproduction.md` and its original recorded frames. In the latest match:

| Boundary | Navigation age |
| --- | ---: |
| Visible skeleton begins | 3.051s |
| Skeleton expires | 8.024s |
| Content appears, PCB pending | 8.075s |
| Static renderer effects begin | 12.728s |
| Geometry body completes | 14.867s |
| Populated PCB tiles appear | 14.950s |

At content release, main startup fields are absent: this is CSS release **before hydration**, not a later JavaScript failure timer. Once bytes are available, painting takes approximately83ms. Source projection, canvas loss and obsolete viewport work do not explain this particular run.

Measured production transfer:

| Initial resource group | Transferred bytes |
| --- | ---: |
| Application scripts | 168,699 |
| CSS | 16,667 |
| First-band geometry | 130,611 |
| HTML | 12,722 |
| Total | 328,699 |

At the controlled24,000bytes/s, that is approximately13.7s of transfer before latency and scheduling. An eight-second escape cannot make those bytes available sooner. Warm browser-cache tests hide this cost; one-year freshness is not guaranteed cache retention. The exact original revisit's cache/transfer phases still need correlation.

## Avoidable eager code

`PublicCircuitBackground.tsx` statically imports both interaction renderers. Their runtime is delivered with static art even when desktop mounting is delayed. Touch is initially mounted on normal desktop visits too; its effect starts `createTouchHaloWorker().start()` and allocates two canvases before static readiness. Deferring geometry warmup did not defer all code/worker initialization.

Deployed chunk `1xszpdoel580c.js` includes static, desktop and touch code:26,592 transferred bytes. `PublicAnimations` adds3,314. React DOM/core is73,485; another Next/router chunk is44,884. Removing the **entire** PCB client chunk would still leave roughly142KB of script plus130KB geometry, CSS and HTML. Lazy interactions are a valid optimization, not a sufficient root fix for the matching condition.

## Causal counterfactual, not a production patch

The ignored `artifacts/loading-diagnosis-2026-11-08/static-critical-path-prototype.mjs` extracts the **existing** static engine, broker, bootstrap and palette/section code through the TypeScript AST. Its standalone runtime is8,314bytes gzip. A loopback fixture serves unchanged production source/geometry/CSS through HTTP/1.1 with gzip, at24KB/s and150ms. Framework files are either downloaded as script preloads or excluded; they are never executed in these fixtures.

| Counterfactual | PCB ready | Content before PCB |
| --- | ---: | --- |
| Independent static engine; framework traffic retained | 16.418s | Yes |
| Same engine; only first-paint resources transferred | 7.428s | No |
| Same bounded geometry embedded in HTML; framework traffic retained | 16.045s | Yes |

The first pair was repeated with consistent results. All six viewport canvases have identical RGBA pixel hashes between variants, identical live page height, no light-DOM child composition and no page exceptions. Critical-only paint precedes the existing deadline. Screenshots were visually inspected; assertions pass for the paired fixture. These values are fixture timings, **not a deployed speedup claim**: transport/compression differs from production and actual application hydration/interaction integration is not exercised.

Within this HTTP/1.1 fixture, removing the execution gate alone leaves body delivery late; removing competing transfer as well recovers the intended order with unchanged artwork. This does not establish that framework traffic must be suppressed on production HTTP/2, nor that every initial byte must finish before an independent renderer can paint. Native resource priority and actual App Router markup require their own integration measurement. Embedding the same bytes in HTML did not solve contention in this fixture without Flight duplication or SSR source waiting.

A lossless-raster shortcut was also measured using the exact current browser snapshots atDPR1. Six tiles total681,491bytes PNG or251,040bytes lossless WebP, versus130,311bytes encoded geometry. WebP roundtrip pixel hashes match exactly, but the payload is larger. No lower-quality representation is approved or recommended.

Artifacts: `startup-bundle-analysis.json`, `startup-bundles/`, `static-critical-path-prototype/result.json`, `inline-result.json`, `lossless-tile-sizes.json`, `runtime.js`, and paired screenshots. Generated geometry and snapshots remain ignored derivative evidence; CMS/source artwork is unchanged.

## Candidate delivery correction and integration boundary

A candidate design target is a **small first-paint public runtime and delivery phase**, followed by optional application/interaction work. The constrained-transfer fixture does not establish that a public-router migration is necessary. Any candidate must:

1. Paint the initial viewport independently of React hydration using the existing exact engine, with one lifetime owner and one broker.
2. Keep full framework and optional interaction traffic out of that initial transfer budget. Passive imports, mounts and worker startup follow first paint; actual input keeps a direct, cancellation-safe demand path.
3. Preserve atomic viewport publication, two paint frames before UI, exact source identity, palettes,512px tiles, DPR budgets, two decode workers,8regions/query and16staged resources.
4. Preserve canonical noJS content and the bounded failure escape. Native navigation, form submission and responsive diagrams must remain correct while optional code is unavailable.

An independent native custom-element host with an owned shadow tree is a plausible static-engine boundary: React can render the same empty host on server/client without touching that tree. Readiness must use element-owned state/properties and composed events before hydration. The fixture's host dataset mutation is **not** a validated production hydration contract. Later React code must adopt the existing controller/broker, never mount another renderer or create a second broker.

**There is no small supported App Router switch for the required framework-transfer sequencing in installed Next16.3.7.** `app-render` supplies bootstrap scripts. `runtime="nodejs"` controls server execution, not browser code. Next's `beforeInteractive` queue also executes through `appBootstrap`; it is not evidence of independence. `unstable_runtimeJS:false` is Pages-Router-only, production-only, and disables hydration rather than deferring it.

Consequently, do not ship the fixture's HTML/script rewriting. A supported explicit public HTML Route Handler/document bootstrap is an architectural option, while keeping admin in the current App Router. Public Pages migration is another broad option, not a flag-only fix. Either requires complete local functional validation before changing existing public routes. All three current diagrams depend on `matchMedia`/`useSyncExternalStore` to choose their single composition; runtime omission alone leaves their server fallback. ContactForm has no native action/method, and its API currently accepts JSON only; delaying hydration without a native validated POST fallback risks default GET submission. Header/menu, back behavior, reveals and first input also need a valid early path.

The narrower prepared-inline-payload option was investigated, not implemented. It would require an already prepared/versioned derivative, fail-open absence without awaiting Storage during canonical SSR, measured HTML/Flight duplication, one consumption instead of inline plus preload, and the independent engine. Its best-case contention fixture still failed the target, so it is not established as a sufficient repair.

## Decision and remaining work

Confirmed: the earlier preload/cache/timer changes did not remove the full first-paint dependency. Do not extend the timeout, disable artwork, reduce fidelity, promise that lazy imports alone fix it, or silently migrate public routing.

The production implementation remains open. **Reassessment at 17:20 UTC:** the broad public-document preview proposed earlier is premature. The independent simplification audit identified a smaller, proved scheduling defect; correct and verify that in place first. Investigate a native module entry within the existing App Router before considering route/runtime migration. The 24KB/s fixture establishes a capacity limit, not which architectural correction is proportionate to the user's natural failure. Preserve case-study responsive composition, published-data authority, metadata, anonymous cache/invalidation, reduced motion, noJS, input and real-engine paint as acceptance gates. The static-only fixture is not a functional app integration.

No runtime build, CMS or deployment changed during this investigation. The bounded scheduler correction is now in progress locally; no release claim follows. No database promotion or Windows administrator packet capture was performed. Sol/high workers independently reviewed supported integration options and overengineering; parent measured bundles, exercised counterfactuals and inspected paint. Both worker allocation axes remained justified and unchanged for their related implementation/reassessment tasks. No savings claims.

## Actual 22-hour returns and infrastructure audit

Before new live origin probes on November10, the existing isolated Chrome profiles revisited the home and Delivery Intelligence routes after approximately22hours. No bandwidth or latency shaping was applied. The browser remained foregrounded; this is a real aged profile return, not the earlier controlled slow-transfer reproduction.

| Route | First visible skeleton | PCB ready | Content visible | Content before PCB |
| --- | ---: | ---: | ---: | --- |
| Home | 292ms | 398ms | 545ms | No |
| Delivery Intelligence | 819ms | 957ms | 1225ms | No |

The home document was `x-vercel-cache: STALE`, age18485, but its TTFB was169ms and body completed199ms. The browser's home geometry `transferSize` was0: its year-fresh cached body survived the idle period. Cached response metadata includes yesterday's MISS/origin duration and must not be mistaken for fresh origin execution. Artifacts: `sequence-visible-foreground-controlled-return-2026-11-10T17-07-53.431Z/result.json` and `sequence-visible-spa-foreground-controlled-return-2026-11-10T17-09-01.211Z/result.json`.

Separate actual-network reads then found canonical home and case geometry **CDN MISS** after the idle period, despite the immutable one-year policy. A unique ignored diagnostic query key and its repeat return the same decoded SHA-256; no purge, response replacement or service restart was used.

| Geometry request | Headers | Total | Origin selection/index | Encoding | CDN |
| --- | ---: | ---: | ---: | ---: | --- |
| Home canonical | 1792ms | 2344ms | 302.6ms | 79.1ms | MISS |
| Home new key, warm origin | 329ms | 941ms | 0.3ms | 22.3ms | MISS |
| Home same key repeat | 69ms | 107ms | cached | cached | HIT |
| Case canonical | 689ms | 876ms | 314.9ms | 85.2ms | MISS |
| Case new key, warm origin | 293ms | 850ms | 0.4ms | 23.1ms | MISS |
| Case same key repeat | 63ms | 66ms | cached | cached | HIT |

The first home's approximately1.4seconds outside measured handler work includes unmeasured connection/dispatch/module initialization; it is **not assigned to a Vercel cold start**. The source/selection duration includes its dependencies and is not all parser CPU. The canonical MISS and index work show a real idle-sensitive path; they do not reproduce the original long split appearance. Vercel explicitly documents that rarely accessed content can be evicted despite its TTL: [CDN cache](https://vercel.com/docs/caching/cdn-cache). Evidence: `idle-origin-2026-11-10T17-12-55.385Z.json`.

Read-only CLI inspection using the existing login confirmed linked Supabase project `portfolio` is `ACTIVE_HEALTHY`, region `ap-northeast-1` (Tokyo), at17:17:54UTC. No token or unrelated project data was printed/persisted. Production miss headers route through `bom1::iad1`; application functions execute in Washington while the database is in Tokyo. No code region override existed. This is a confirmed unnecessary geographic boundary for uncached database/Storage work, consistent with [Vercel's region guidance](https://vercel.com/docs/functions/configuring-functions/region), rather than proof of the original5-second delay. A local `vercel.json` now specifies the single Tokyo region `hnd1`, matching the database; it has not been deployed or claimed as a measured improvement. Home PCB geometry is repository-local and does not fetch Supabase; public data blocking occurs before its HTML/skeleton can arrive. Supabase's documented automatic pause is low activity over7days, not an overnight sleep/wake policy: [Free project pausing](https://supabase.com/docs/guides/platform/free-project-pausing). No restart, restore, billing or provider settings were changed. Vercel function logs/settings remain unavailable through connected tools.

## Independent simplification audit

No accidental minimum8-second wait exists. There are multiple maximum fail-open mechanisms: autonomous CSS entrance/skeleton escape, JavaScript deadline reconstruction, per-element entrance scheduling, scroll-queue timeout and artwork transport retry. Two20-second geometry attempts can outlive the8-second UI escape. This permits the recorded split appearance; increasing the escape would only hide content longer.

Required: exact ordered geometry, masks/palettes, bounded512px snapshots, one composition, atomic viewport publication plus two frames, atomic resize replacement, shared source identity/cancellation and noJS escape. Avoidable: global static cohort FIFO; aggregate batch promises that delay independently ready entries; repeated startup observations/timers; eager optional interaction imports/worker allocation. The first two have a demonstrated head-of-line failure and are the narrow correction currently underway. The worker must preserve two decode workers, <=8regions/query, <=16staged entries and shared consumers under repeated jumps; removing the FIFO alone is insufficient when both workers already await obsolete geometry.

After startup failure, the latched failure prevents renewed startup waits. A distinct later viewport pending after successful startup can still start a new reveal-queue timeout; do not describe that as resetting the failed startup latch. Passive enhancement readiness subscriptions only accepting `ready` can remain waiting after artwork failure; actual input remains the immediate path. Neither passive1.2second desktop warmup explains initial PCB delay.

## Local correction and current verification

The smaller native-entry correction is implemented in the existing App Router. `lib/pcb/static-engine.ts` extracts the exact projection/decode/snapshot algorithm; `native-element.ts` owns one custom-element shadow surface and its cleanup/configuration lifecycle. React supplies deterministic empty host configuration. `browser-geometry.ts` shares one browser-only broker via versioned `Symbol.for`, across the native and React bundles. The original native bootstrap/policy, source selection, palette/tile/DPR limits, atomic viewport plus two frames and resize replacement remain. No public-router migration, generated-HTML rewriting, framework postponement, form/navigation change or artwork promotion occurred.

RootLayout emits one standard deferred module, including on nonpublic initial routes so later client insertion of a host needs no special script execution. Only the custom host suppresses hydration attribute warnings: its dynamic readiness belongs to the native controller. Canonical content and page-wide hydration remain normally checked. Standard pinned `esbuild@0.28.2` produces the current hash-addressed17,055byte entry (6,811bytes gzip); managed development watch shares a lifetime with one Next child. Generated assets/manifest stay ignored; README records operation.

Broker/static scheduling correction: independent per-region handles plus releasable static interest replace the global cohort FIFO/aggregate wait. Viewport changes relinquish obsolete geometry waits to the same two decode workers. Staging releases unused interest before replacement acquisition; an independently retained bootstrap/interaction request is never aborted.32 focused tests and TypeScript pass, including30 repeated jumps with bodies that ignore abort, <=16staged entries, <=8regions/query, broker realm sharing and custom-element lifecycle/configuration failures. No source/palette/projection fidelity reduction.

The clean Next16.3.7 production build passed. Parent test server is local127.0.0.1:3100, exec session72489; no dev writer was active and `.next` was resolved/validated before deletion. Runtime workflow requires stopping this verified process and restoring one clean LAN development writer after production verification. Actual-app Chromium checks deliberately holding all Next scripts12seconds painted case PCB at2.088seconds and content at2.091seconds, before framework execution. Responsive diagram hydration changes case page height9546→9110; native host/source ownership remains one, and the existing atomic replacement handles the resulting layout change. This is not identical pre/post-layout pixel geometry.

First home pixel assertion failed despite identical canvas identities/alpha counts. Investigation reproduced the exact hash change on two immediate `getImageData` reads **before framework release**, then stable reads3–5, with no further canvas writes and maximum1RGB-level changes. This is a readback/backend conversion observation, not evidence that hydration repainted the canvas. Artifact: `canvas-readback-2026-11-10T17-39-31.651Z/result.json`. Harness correction must record/stabilize repeated reads consistently for old/new controls; never use a tolerance to hide geometry regressions. The first navigation harness also assumed SPA despite existing native anchors, and its noJS check ran before CSS entrance completion; fix those tests to actual semantics before interpreting failures. Reduced-motion and malformed-geometry checks pass. Full corrected Chromium/WebKit, navigation/resize/input and old-engine parity checks remain pending.

A bounded idle HTTP/2 probe on216.198.79.131 recorded eight healthy PING/header exchanges (PING54–56ms) with a25ms event-loop heartbeat. Its ninth exchange was not saved because the helper read a closed session's socket; that helper failure is not an attributed site failure. The helper now retains endpoint/session events and simultaneous-control support for future use; no repeat run is in flight. Prior4.8second transport stall remains separately unassigned. No administrator capture was performed.

Dependency installation surfaced newer existing advisories: Next16.3.7 critical (audit recommends16.4.6), zod/source-map-js high; esbuild has none. Prior zero-production-audit evidence is historical. No application dependency upgrades have yet occurred; resolve/verify these before releasing the candidate. Raw bounded audit evidence is ignored `npm-audit-native-entry.json`. No production deployment or provider account setting changed.

## Updated candidate acceptance and remaining delivery failure — 18:15 UTC

The following supersedes the preceding in-progress notes. Local dependencies are now Next16.4.6, zod4.6.7 and source-map-js1.2.2; React19.2.7 is unchanged. Fresh production audit has zero vulnerabilities.102 affected tests pass, one existing halo-browser test is skipped; production build/TypeScript pass. No application release has occurred.

New Next automatic route compression exposed a local compatibility failure: manual API gzip plus framework gzip produced two actual gzip layers under one declared encoding (raw129337→130311→527037JSON). Identity worked. Removed manual compression, leaving framework ownership. Raw wire regression now proves one encoding/one decompression,130318→527037bytes and valid JSON. `pcb_serialize` replaces `pcb_encode`: it measures handler serialization, excluding framework transport compression. This failure was introduced by the local update, not evidence of the user's live delay. `compression-*.json` records both sides.

Actual delayed-case evidence exposed a required entrance correction: merely removing CSS's8second delay preserved an already elapsed animation timeline, so motion could skip before React. The native publisher now samples the existing skeleton's computed display/visibility **before** changing readiness, latches host-only `startupEntrance=ready|expired`, and changes to the existing ready-entry animation exactly once. There is no new timer or canonical DOM mutation. Late artwork never restarts/re-hides content after CSS failure release. Initial publication/time/entrance outcome persists across host reconnection; current viewport readiness is separate. The existing autonomous noJS escape remains.

Final Chromium seven scenarios pass, including exact unchanged historical home renderer first-read pixels and stable byte-identical pre/post-hydration canvases; delayed home/case, native navigation/back plus separately labelled same-document ownership/reconnect, atomic resize, noJS, reduced motion, malformed payload and fresh/expired entrance lifecycles. Artifact: `native-entry-verification-chromium-2026-11-10T18-02-09.066Z/results.json`. Final WebKit six scenarios are clean; all navigation/reconnect/resize assertions also complete, but its collector flags two handled old-document fetch refusals. Focused proof records steady endpoint200/basic/732paths, then navigation `beforeunload1874ms`, passive warmup/refusal2567ms, `pagehide3090ms`; both rejections are caught, neither request reaches the network, no DOMerror/unhandledrejection occurs. WebKit logs this loader refusal as JSconsole error and Playwright promotes it to pageerror. Do not change CORS or blanket-filter active-document failures. Evidence: `native-entry-verification-webkit-2026-11-10T18-03-57.675Z/` and `webkit-fetch-lifecycle-2026-11-10T18-11-55.921Z/result.json`.

All four public routes × desktop/mobile × Chrome/Edge/WebKit pass24 populated-art/source/one-composition checks. Representative mobile home and desktop Horecah screenshots inspected. First local uncached remote case indexes took2.37/2.91seconds; warmed variants were faster. These are local functional observations, not a production speedup. `native-routes-2026-11-10T18-04-00.885Z/result.json`. Real installed Chrome launched directly with noDefaults CDP restores `pageshow.persisted=true` with the same host, broker and42canvas objects: `native-bfcache-2026-11-10T18-08-45.773Z/result.json`. Existing touch release/new-contact and activation-during-scroll checks pass in Chromium and WebKit. No new physical-device acceptance is claimed.

**The candidate is not a complete delay fix.** The actual local app was replayed with the original24KB/s,150ms, minimized-until-DOMContentLoaded, zero additional hidden wait, foreground-controlled procedure. A separate isolated local profile and shadow-aware sampler preserve the historical production profiles. Native rendering starts independently, but framework traffic still competes with the geometry response. Local HTTP/1.1 geometry headers arrive2361ms, body completes17117ms, PCB appears17266ms; content appears9072ms,8194ms before PCB. Its visible skeleton is2.71seconds because the window returns at6.36seconds, so it is not the original5second visible-duration match. It nevertheless retains the forbidden content-before-art manifestation under congestion. Source/paint is not the long phase. Artifact: `sequence-visible-idle-background-controlled-slow-local-native-2026-11-10T18-10-43.063Z/result.json` and recorded frames.

Reassessment: do not ship the native candidate as a complete solution or add another timeout. The remaining concrete test is **actual Vercel HTTP/2 preview delivery**, before deciding whether this capacity result requires a separate critical-transfer phase/public architecture. Do not infer production HTTP/2 priority behavior from local HTTP/1.1. Parent retains this Git/provider experiment to preserve scope/approval/CMS state; no new worker allocation or savings claim. Natural day-later initiating cause remains unassigned; administrator packet capture and provider logs remain unavailable. Preview preparation is authorized under the existing loading work/release scope; production main is not to be pushed at this checkpoint.

Runtime at this checkpoint: production test server127.0.0.1:3100, exec session99341; restore one clean LAN development writer before handoff. All diagnostic browsers exited. Current native asset is`/_pcb/entry-7ceab9ca11b0e9336869.js`; generated assets, logs and profiles remain ignored. GitHub read-only repository inspection reports `private:false`; previous private-repo prose is stale. No visibility setting was changed. Preserve unrelated Upwork/recovery drafts.

Runtime restoration complete: stopped the verified3100server, checked its listener closed, validated/deleted only the repository `.next`, started one managed LAN dev writer at`http://192.168.0.102:3000` (exec session23808). `.next/dev` exists, no BUILD_ID. LAN HTML200 uses Next16.4.6's framework-owned`no-store`; installed base-server source confirms that stricter policy, so the routed runtime rule now accepts it alongside older must-revalidate HTML. Every referenced CSS/JS/native asset200 with development no-store policy. A harmless shadow CSS comment edit changed the generated native hash and triggered full document reload; restoring exact source bytes restored the initial hash and reloaded again. Evidence:`native-dev-watch-result.json`, sourceRestored=true. The screenshot helper initially encoded spaces in its filesystem path; corrected via fileURLToPath and moved only that verified accidental image back to the workspace, preserving pre-existing files/directories. No temporary source marker remains. Production JavaScript has no development polling.
