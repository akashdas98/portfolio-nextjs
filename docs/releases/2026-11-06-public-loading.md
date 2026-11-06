# Public loading correction — 2026-11-06

Local correction verified; user authorized deployment on2026-11-06. This release covers loading performance and skeletons only; email configuration, CMS/Storage content, browser settings and user caches remain outside scope.

## Findings

The user reports intermittent8–10s loading, often after1–2 days. Initial fast incognito and hard-refresh observations were not a controlled server-warmness comparison; they did not rule out an intermittent cold path. Early live measurements were fast: four-route fresh FCP0.47–1.89s and warm0.18–0.42s, all HTTP200/no JavaScript errors. History/scroll restoration and a500ms-latency comparison did not reproduce a profile-only defect. Public runtime has no service worker or persistent application storage, and cached image decoding uses promises rather than missed load events. Dark Reader is installed in the default browser profile, but involvement was not established. The affected-profile timing-report request remains unanswered; do not blame extensions or claim every observed episode is explained.

A new local production process exposed a real broken cache boundary. The first remote-artwork API requests took EDD2523ms, Leads3572ms and Horecah4122ms. Next logged that all three raw Storage fetches exceeded its2MB cache-entry limit (serialized sizes4,661,960 /4,241,799 /3,343,252 bytes). Installed Next's incremental-cache/index.js:517–524 confirms this limit. The requested year-long fetch cache was silently failing to persist; process memory alone retained parsed sources. A new server process therefore needed another full remote download/parse. Browser geometry freshness also expired after one day. This is a confirmed intermittent cold-path bottleneck, not proof of the sole cause of every8–10s production visit.

Case-study pages additionally preloaded the full lens SVG into the browser although renderers consume regional `/api/pcb` responses exclusively. The preload was unused network work competing with actual rendering.

## Changes

- `lib/pcb/source.ts` now stores parser-produced immutable remote indexes through `lib/pcb/persistent-index.ts`. Gzip/base64 manifests or digest-keyed chunks stay below1,000,000 characters per entry, comfortably inside Next's limit. Source identity, bounded decompression, SHA256 and index validation protect exact geometry/order. Process promises remain bounded/coalesced; missing/corrupt entries recover once; cache outages fall back to validated source loading. Raw SVG fetches are no-store, development remains uncached, local assets retain mtime/size invalidation, and project artwork remains Storage-owned.
- Removed the unused full raw-lens browser preload. Fingerprinted remote API geometry now has one-year browser freshness, matching its existing immutable identity/CDN lifetime. Unversioned homepage requests retain revalidation; no guessed revision or behavior workaround was added.
- Added inert, aria-hidden home/case hero skeleton paint for headings, copy, buttons, proof strip and diagram layout. It follows actual initial artwork readiness and the existing failure escape; reduced motion is static and noJS has no skeleton. Original viewport-atomic tiles, two paint frames before UI, belowfold preparation, native gestures and pointer renderers are unchanged.
- Removed prototype streaming loading boundaries after actual noJS browser checks showed hidden canonical React transport. No loading.tsx or homepage Suspense change remains. Avoid styling Next's hidden transport or mounting alternate semantic content.

## Verification

- Production build/TypeScript passed;34 focused persistent-index/spatial/delivery tests pass, including large single paths, exact Unicode/order/bounds, incomplete persistence, corrupt cache and concurrent recovery.
- After priming real Next cache, restarted into a fresh process with all raw Storage artwork fetches deliberately blocked. All three API requests returned200 in98/31/26ms with byte-identical response SHA256 hashes. Actual cache files were at most1,000,182 bytes; no oversized-cache or blocked-Storage warnings. This proves persistent reuse independently of browser cache and warm process memory. It is a local integration result, not a deployed speedup percentage.
- Chromium and installed WebKit each passed desktop/laptop/mobile/reduced-motion/noJS initial-paint checks. All three case studies also passed noJS canonical-content checks. Delayed geometry showed skeletons and atomic artwork-before-UI ordering; failure/8s/late-readiness checks released content without re-hiding it. Screenshots reviewed.
- Existing four-route desktop hover/mobile touch, scroll/resize, geometry-failure release and exact batched/single API checks passed. Physical-device paint/gesture behavior was not changed; browser tests do not replace a new physical-device result.
- Clean LAN dev restored at `http://192.168.0.103:3000`: HTTP200 HTML,18 referenced CSS/JS assets200, current skeleton CSS delivered; HTML must-revalidate and assets no-store. One listener on3000; production test server3100 stopped, production .next output cleared.

Raw scripts, sequences, screenshots and baseline/restart proofs are ignored under `artifacts/pcb-regeneration-2026-11-06/loading/`. The blocked-Storage preloader is test-only under `.codex/tmp/` and is not part of normal runtime.

## Allocation and handoff

Parent owned live timing, cache integration, preload/cache-header change and runtime verification. Sol/high worker owned focused dependency tracing, skeleton implementation and persistent-index correction/tests. Capability required coupled cache/rendering-integrity judgment; high effort supported hypothesis discrimination and failure-path verification. Allocation stayed unchanged as concrete evidence emerged; no savings are claimed from benchmarks or worker choice.

Release authorized: commit/push the verified feature, then confirm the exact Vercel Git SHA and production cache/header/readiness behavior. A later affected-profile revisit remains useful. Capture any remaining slow episode using HTML/resource timings and both artwork readiness states. Keep the eight-second emergency release separate from the normal readiness criterion.

Existing production contact/admin follow-ups remain open. Parent retains sequential release operations because Git/deployment validation shares the established scope and evidence; no new worker handoff is needed.
