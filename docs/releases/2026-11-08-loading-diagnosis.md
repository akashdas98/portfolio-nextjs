# Intermittent loading diagnosis — 2026-11-08

Diagnosis only, requested after release `94d1d95`. No application, deployment, CMS, browser-profile, or local runtime changes. Fourteen live browser scenarios completed against `https://freebirdakash.vercel.app`; fresh browser contexts do not guarantee a cold Vercel instance. These tests reproduce the reported presentation failure under controlled delays, not the original user's uninstrumented network episode.

## Result

The loading animation ending is not an artwork-readiness signal. Independent startup and scroll reveal deadlines let the hero appear while the PCB remains pending and lower content remains invisible. The lower content is already present in server HTML; reveal animations hide it. A screenshot after scrolling at ten seconds shows a completely blank content area beneath the visible header.

## Live scenario matrix

Times are seconds after navigation, sampled every approximately 200ms. Hero visibility is computed opacity, not a universal paint measurement. Below-fold visibility includes ancestor opacity. Routing delays also disable browser HTTP cache in the fault tests. Concurrent probes and backend variability can affect absolute durations; causal claims rely on the state transitions, not speed comparisons across runs.

| Scenario | Observation |
| --- | --- |
| Fresh Chromium desktop | PCB ready 1.28s; hero fully visible 1.88s. |
| Fresh Chromium mobile viewport | PCB ready 1.03s; hero 1.63s. |
| Fresh Delivery Intelligence case study | PCB ready 1.67s; hero 2.27s. |
| Same-context reload | PCB ready 0.33s; hero 0.70s. |
| Home artwork delayed 15s, Chromium | Skeleton hidden 8.40s, hero 9.00s, scroll at ~10s, lower heading remains invisible until 18.60s; PCB ready 19.60s. |
| Same test, WebKit | Skeleton hidden 8.37s, hero 8.78s, lower heading visible 18.57s; PCB ready 20.01s. |
| Case artwork delayed 15s, Chromium | Skeleton hidden 8.66s, hero 9.25s; lower heading and PCB ready about 18.85s. |
| Same case test, WebKit | Skeleton hidden 8.49s, hero 9.10s; lower heading visible 18.69s, PCB ready 19.31s. |
| Home artwork delayed 20s, desktop | Crossed request timeout; hero 8.78s, lower heading ~18.58s, PCB still pending at 32s. |
| Same 20s hold, mobile viewport | Hero 9.00s, lower heading ~18.60s, PCB still pending at 32s. |
| Scripts delayed 12s plus artwork delayed 12s | Hero visible 8.81s, reveal registration ~12.41s, PCB ready 27.41s. Content scrolled into view before hydration stayed visible. |
| Artwork requests explicitly aborted | Renderer reported failure ~0.31s; hero 0.91s; lower content revealed normally on scroll. |
| Chromium 150ms network latency, 200KB/s download, 4× CPU throttle | PCB ready 2.70s; lower section revealed normally on scroll. No long stall reproduced in this sample. |
| JavaScript disabled | FCP 0.32s; screenshot confirms selected-work content visible on scroll; no artwork API requests. |

No JavaScript page errors occurred. Request logs include expected injected aborts, superseded geometry cancellations, reload/context shutdown cancellations, and the noJS script-block indication; these are not evidence of spontaneous production errors. Browser mobile emulation and installed WebKit do not replace physical-device observations.

## Causal trace

1. `app/globals.css:193` delays initial canonical entrances by eight seconds while art is pending. `:4432–4445` separately hides the new skeleton after eight seconds, regardless of readiness.
2. `components/PublicAnimations.tsx:334–357` prepares below-fold targets as paused opacity-zero Web Animations. When a hidden target enters view while either artwork readiness state is pending, `:286–307` queues it.
3. `:222–224` starts another eight-second timer when a target enters. It is relative to that intersection, not navigation. Consequently a visit can show the hero near nine seconds, then leave the next section invisible until approximately eighteen seconds. Further newly intersecting sections can start another wait after a previous fallback has flushed.
4. `lib/pcb/geometry-delivery.ts:5,217–240` permits 20s per request attempt and two attempts. The UI's eight-second escape does not finish artwork work or permanently end reveal gating.
5. Artwork also requires geometry, SVG image decoding, snapshots, and publication. `StaticCircuitVector.tsx:335` has no decode deadline. Failure classification at `:379–395` waits for both workers. These are additional inspected risks, not independently demonstrated causes of the user's episode.

## What the deployed fix did and did not address

`94d1d95` corrected oversized remote SVG persistence and added skeletons. It did not modify `PublicAnimations.tsx` or `StaticCircuitVector.tsx`; those gates predate this release. The skeleton's independent disappearance was introduced in this release and makes the split visible as an apparently completed loading phase.

The homepage uses the local source branch (`lib/pcb/source.ts:98–105,118–119`) and does not use the new remote persistent-index cache. That cache improvement cannot solve this homepage reveal boundary. Remote cache operations lack independent deadlines, but no live evidence here establishes them as the original intermittent trigger or demonstrates a release-wide slowdown.

The previous persisted browser verification delayed geometry by only one second, sampled hero/header/tiles only until eight seconds, and checked the final state after readiness. It did not scroll during a prolonged pending state or measure skeleton `visibility` after its expiration. Thus its passing results did not cover this failure.

## Recommended next work

On authorized implementation, make startup exit a single persistent lifecycle decision shared by the skeleton, initial content and future scroll reveals. Once the emergency deadline releases content, newly encountered sections must not acquire another artwork wait. Preserve normal two-frame artwork-before-UI publication, canonical noJS content, reduced motion, route changes and single responsive composition. Define a separate bounded artwork recovery path; do not extend the loading animation or discard PCB behavior to mask the failure.

Retain a trace of an unmodified slow visit to establish why geometry or script delivery sometimes stalls on the user's connection/profile. The controlled reproductions prove the presentation defect and explain the extra waits; they do not establish whether the initiating delay is Vercel, network, decoding, or profile-specific. No evidence supports blaming an extension or asking the user to clear caches.

## Evidence and allocation

Local uncommitted probes and full timelines: `artifacts/loading-diagnosis-2026-11-08/probe.mjs`, `chromium-baseline.json`, `chromium-faults.json`, `chromium-target.json`, `webkit-target.json`; copied home screenshots `chromium-art-15s-mid.png` and `webkit-art-15s-mid.png`. Keep generated evidence out of application commits. Initial shell network access was denied; approved read-only network escalation enabled live tests. No local build/dev writer was started or stopped.

Parent owned browser probes and synthesis; Sol/high worker independently traced lifecycle/cache boundaries. Sol capability was selected for coupled React/CSS/transport judgment; high effort for branching hypotheses and deadline analysis. Project benchmark evidence supports Sol for substantive engineering, does not contain a current Luna comparison, and does not prove savings. Previous completed loading work showed that passing short-delay checks was insufficient; a bounded routine worker would create duplicate review work here. At the handoff, neither axis changed: review still required reconciling measured transitions with lifecycle semantics. All probes and worker work finished; implementation remains unrequested in this diagnosis turn.
