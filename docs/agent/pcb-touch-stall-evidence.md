# Touch preparation stall evidence — 2026-09-23

## Proven defect and correction

`createTouchPreparation` serialized preparation behind an awaited obsolete geometry
request. Updating `wanted` only invalidated the result; it did not interrupt that
wait. A current cached region could therefore wait indefinitely for unrelated old
network work. Its eventual successful preparation timing excluded that wait.

Each preparation now receives an AbortSignal. Supersession/reset/disposal interrupts
its network wait and pending cooperative timer. The underlying shared geometry
fetch remains intact for other consumers. The single drain still serializes raster
ownership, releases stale resources, and publishes only current results.

Deterministic unit test: leave request A unresolved, request cached B, require B to
publish before A resolves. This failed with an empty publication list before the
fix and passes afterward. Late A resolution cannot rasterize or replace B; late
rejection and already-cancelled consumers are covered too.

Browser reproduction:

`node scripts/pcb-touch-playwright-probe.mjs http://192.168.0.100:3000 stall`

The test holds an obsolete `/api/pcb` response indefinitely, then moves to another
region. Restoring the old supersession behavior caused a 3000ms timeout. With the
fix, the actual renderer published the new point while the old response remained
blocked: 308ms localhost, 257ms LAN. These are cold preparation latencies in Windows
WebKit, not physical-iPad tracking latency or proof of smooth motion.

## Limits and remaining failure mode

The supplied `E:/Downloads/not-top-laggy-4.mp4` confirms publication gaps and about
31 cumulative uncovered intents. Its old overlay cannot attribute those gaps:
successful-stage times omit waiting before execution and unsuccessful work;
the old abort counter excluded yield/network/mask cancellations.

The updated overlay includes running state, unfinished preparation age, previous
frame CPU cost, and all cancelled preparations. `lag` remains CSS-pixel distance;
`retained-preparing` alone does not prove a pending job exists.

Canvas profiling in Windows WebKit found synchronous preparation draw calls taking
up to 230ms (plain) and 213ms (shadow), while live main draw calls peaked around
13–17ms. Matching mask/decorated DPR did not remove this cost and was reverted.
An additional deterministic state sequence shows continuous movement can invalidate
each finite preparation before publication when motion exceeds its coverage reserve.
Cancellation of network waits does not solve expensive synchronous raster work or
prove the physical-iPad issue fully fixed. Do not present this correction as full
device acceptance, revive previously rejected changes, or attribute every video
stall to network blocking without new evidence.

The prior stale-frame suppression remains reverted. Desktop, PCG geometry, Storage,
and static rendering are unchanged. No deployment or new production build occurred.

## Section/device differential (follow-up)

Physical iPad remains laggy below the top, while iPhone does not show comparable
lag. The previous network correction therefore did not resolve the reported bug.
Live layout measurements at 1024×1194 and 390×844 show the iPad Technical
foundation section occupies y6006–6420. Its blue interval between neighboring
pink sections is only 614px, shorter than the 708px preparation region. The
old `neededGeometryTones` scanned that entire region and necessarily prepared
blue and pink on every touch there, even when the visible 420px lens fit entirely
inside blue. On phone the corresponding blue interval is 816px and the 708px
backing region can fit inside it. This is a concrete tablet-specific extra
three full-size halo passes plus one extra decorated surface per region.

Preparation now derives required tones from the visible 420px lens. Region
coverage checks include tone availability, so crossing a boundary prepares both
tones before publication. A mounted tablet transition produced blue → blue,pink
→ pink, one visible main canvas, and zero settled publication lag at each point.
The local WebKit completed preparation was 279ms for one tone and 467ms for two.
Layout rebuild also removes old trail DOM nodes instead of orphaning layers.

This is not a complete explanation of lower-page lag: Services interior needs
only one tone yet showed longer frame gaps than the top. Tablet regions there
select about 48 source paths versus 33 at the top. Diagnostic disabling of
required CSS readability-underlay blur reduced synthetic tablet Services frame
gap p95 from about 267ms to 161ms; a `will-change:transform` treatment did not
help consistently. Production readability styling remains unchanged. These
software-WebKit measurements are directional, not physical-iPad acceptance.

## Settled lower-page and scroll follow-up

After waiting 2s for entrance motion to settle, the one-tone tablet Services
case still had RAF-gap p95 around 256–272ms and measured Canvas presentation
cost p95 around 16–18ms. Removing the required underlay blur in a diagnostic
style reduced RAF-gap p95 to around 165ms, but would degrade text readability
and is not a production fix. Promoting or containing the underlay, disabling
static-tile layer promotion, and section paint containment did not consistently
help. The underlay blurs its own inert source; this does not prove the moving
glow invalidates that filter.

A synthetic scroll-only replay kept touch at one viewport coordinate while
scrolling 8px per RAF. Tablet RAF gaps were longer than phone gaps, but the
renderer reported zero publication lag on both. A 4000px tablet scroll kept
layout version and page height stable, ruling out repeated ResizeObserver
resets in that local run. Programmatic scroll cannot reproduce native iPad
compositor scroll or real touch delivery.

The debug overlay now separates latest-state publication lag, visible
finger-to-published-point gap, RAF gap, previous Canvas paint cost, unfinished
preparation age, touch/scroll event recency and delivery delay, tones, layout version, and stage
timings. It was checked in a 480px viewport without clipped text. A fresh
physical-iPad `?pcb-debug=1` recording during top-to-lower touch+scroll is
needed to identify which boundary stalls; the earlier video lacks these fields.

## Physical-iPad recordings supplied 2026-09-23

`E:/Downloads/not-top-laggy-1.MP4` (lower Services/About) and
`E:/Downloads/top-okayish-1.MP4` (hero/Work) contain the expanded overlay.
The lower recording shows the front glow retained about 100–140 CSS px behind
the finger during region preparation. Sampled overlay frames show RAF gaps
around 103–110 ms with previous Canvas paint around 0–1 ms; an earlier contact
frame reports a 592 ms RAF gap. The top recording also reaches a 154 px peak
and briefly retains the front while preparing, so the issue is worse below the
top but not exclusive to it. Touch event delivery in the sampled lag frames
is about 6 ms and the layout version stays at 2. These values rule out the
measured live Canvas paint call and repeated layout rebuilds as complete
explanations; they do not identify which browser paint/composite or preparation
step consumed the missing time. `miss` counts frames without active coverage,
not distinct requests. The clips do not justify changing PCG geometry or the
frozen desktop renderer.

A debug-only A/B URL, `?pcb-debug=1&pcb-underlay=off`, now disables the text and
secondary-button underlay CSS blurs and labels the overlay `blur=off`. The normal
URL remains `blur=on` with production styling intact. Compare the same iPad
section and touch/scroll gesture after reload to test the local WebKit underlay
finding on the physical engine. This diagnostic is not an acceptable final
visual treatment: the underlays are required for readability.

## Chromium horizontal-touch reproduction and coverage correction

The user's correction identified a reproducible horizontal drag in Chromium.
`scripts/pcb-touch-chromium-horizontal-probe.mjs` uses CDP
`Input.dispatchTouchEvent` rather than synthetic DOM events: 120 delivered
touch moves over four left/right sweeps (x100–924 at y570) in a 1024×1194
touch viewport, repeated at scrollY 0, 2400, 3900, 5940 and 6500. The
normal-speed headless Chrome run is smooth, but 8× CPU throttling reproduces
retained-pixel lag: baseline p95 publication lag was 247px at the top and
192px in Services. At 12×, Services reached 577px p95. This is a synthetic
stress reproduction, not a calibrated iPad-equivalent throttle.

The invariant was too little prepared horizontal coverage for the time needed
to fetch, rasterize and decorate a new region during fast movement. The old
708px region gave only a 96–192px geometric reserve, and prefetch began with
64px remaining. The source region now spans 1092px horizontally (same 708px
vertical extent) with an axis-specific 192px horizontal / 64px vertical
prefetch reserve. The vertical reserve stays at 64px; applying 192px on both
axes made a newly prepared region immediately fail the prefetch check and
restarted preparation continuously. Only selected source bounds and their
bounded Canvas allocation changed; PCG paths, cutouts, paint order and tone
selection remain exact. The wider region increases horizontal raster area
about 54%, a retained-resource/performance tradeoff to watch on hardware.

With that correction, a five-height 8× Chromium run reported publication-lag
p95 values of 27px (top), 0px (Work), 0px (Services), 137px (Technical
foundation boundary), and 0px (About). Services at 12× improved from 577px
to 192px p95. Individual runs vary; the two-tone Technical foundation case
still has significant lag. Disabling required underlay blur in one 8×
Technical foundation run reduced p95 from 137px to 27px, so compositing cost
also contributes; this is diagnostic and not a production visual change.

Thirty-two focused tests pass with one intentional browser-pixel skip.
Windows WebKit tone transitions retain one visible main canvas with zero
settled lag; synthetic vertical scroll at five phone/tablet positions has
zero lag at p95 and at most 32px transient lag. The Chrome browser-pixel halo
test could not launch because the local Chrome GPU process exits; this was a
pre-existing tool limitation, not a pixel assertion failure. Physical-iPad
acceptance after the coverage change and remaining two-tone lag are open.

## 2026-09-24: repeated path construction in the preparation path

Matched Chromium CDP traces found that samples above 64px publication lag
coincided with `retained-preparing`, especially at the blue/pink boundary.
Static artwork was already ready, with 30 tiles; hiding it changed little.
The laggy boundary had *less* browser paint/compositor work than a smoother
one-tone section. The extra work is geometry preparation: the same SVG path
data is parsed into a new `Path2D` on every overlapping region request.
Approximately 64–89 paths intersect each tested region; repeated requests
usually include paths seen in the preceding region. A 256-entry LRU cache of
`Path2D` geometry now preserves their exact commands while style and paint
order are still applied for each request. The cache is released at unmount.

Before that cache, three repeated 8x boundary sweeps after the coverage fix
were 110px p95 publication lag (18–22 samples over 64px); further baseline
runs ranged 110–192px. With the cache, three matched 8x boundary runs were
27/82/27px p95 (0/11/5 samples over 64px), and a five-height run was
27/0/0/82/0px. Completed mask stages at the boundary fell from about
80–140ms to 5–8ms when overlapping paths were cached. Timings vary with
browser load and this is a synthetic 8x CPU stress test, not measured iPad
speed. A 12x boundary run still had 110px p95 lag. Windows WebKit's settled
blue-to-pink transition retained one visible main canvas and zero lag.

Two attempted optimizations were rejected and reverted: shared-halo pixel
readback/colorization repeatedly aborted before the first publication;
browser-native shared-halo compositing and a narrower vertical region gave
no consistent boundary gain. Holding a superseded request to completion also
gave no consistent improvement. The required underlay blur remains enabled.
Physical-iPad validation of the new cache and residual cold-region lag remain
open; no browser emulator proves physical WebKit recovery.

## 2026-09-24: iPad two-tone boundary follow-up

The user reports that the remaining lag occurs at and near blue/pink section
boundaries on iPad, while iPhone remains smooth. At a boundary, the current
architecture prepares two 1092x708 CSS-pixel decorated surfaces, each with
three full-region shadow passes. Once Path2D reuse shortened the mask stage,
this dual-surface raster is the remaining costly stage. A narrowly scoped
pixel budget now caps decorated preparation to 1x for the wider composition
(`min-width: 651px`) only when both tones are needed. The final 420px lens,
flame, envelope and trails still paint at the viewport ratio. Phone
composition and one-tone regions retain their previous density. The cap does
not change PCG paths, section tone intervals, paint order or underlay blur.

In matched Windows WebKit boundary captures, completed two-tone decoration
measured 652ms at the previous 1.401x surface ratio and 355ms with the 1x
cap. Side-by-side captures retained the visible core, halo and exact section
split, though this does not prove pixel identity and fine edges may be a little
softer. Three repeated 8x Chromium boundary drags at 1x had 0px p95 lag;
after the final width-breakpoint branch, repeats were 27/0/0px with one
additional concurrent-check run at 55px and a five-height run at 82px at the
boundary. Adjacent one-tone sections in the five-height run stayed at 0px.
Windows WebKit transition still published one canvas and settled at zero lag.

This is a bounded raster-quality tradeoff for the expensive two-tone path.
An incremental blue-to-pink transition initially retained its existing 1.40x
blue surface alongside a new 1x pink surface. The transition now downsamples
that retained surface only after the missing tone is ready, then atomically
publishes both at 1x. WebKit telemetry confirmed `blue:1.00,pink:1.00` on the
tablet and `blue:2.00` on the phone; the tone-transition probe retained one
visible canvas and zero settled lag. Resampling can add one full-region copy
at the transition, but avoids a second full-density shadow surface.
Remove the cap when an exact shared-halo or incremental-surface method proves
faster on physical iPad without a visual change. The next section records the
user's physical-device result after this follow-up.

## 2026-09-24: physical-iPad follow-up after boundary correction

The user reports the blue/pink boundary is **much better** on iPad, but the
interaction overall is still not consistently smooth away from boundaries.
This validates improvement, not completion. A fresh steady one-tone iPad
recording with the debug overlay is requested to separate publication lag,
touch delivery, RAF pacing, Canvas paint and browser composition.

Windows WebKit's instrumented one-tone Services drag showed occasional
individual full-region `drawImage`/shadow calls above 200ms during
preparation, while ready-state 420px Canvas drawing stayed comparatively
small. A trial 1x cap for *all* tablet decorated regions did not reduce the
largest preparation call or improve the steady-drag profile, so that broader
quality change was reverted. The accepted 1x cap remains only for tablet
two-tone regions, and the iPhone path stays unchanged. Hiding static artwork
did not materially improve ready-state pacing in the local one-tone probe.
The Windows Playwright WebKit runtime reports no `OffscreenCanvas`, so it
cannot verify a worker-raster solution for the physical device. The local
per-event Playwright dispatch loop is slower even in the phone scenario and
does not measure native iPad frame cadence; avoid treating its frame gaps as
device FPS.

## 2026-09-24: `drag-test.MP4` physical-iPad frame review

The 19.35-second, 1334x1920 recording is under `E:/Downloads/drag-test.MP4`.
Its active drag near the top remains in a `blue,pink` lens and includes page
scroll events and browser viewport-height changes (about 1056–1079 CSS px).
Layout version stays 2, so repeated layout resets are not the cause. At
sampled active moments publication and finger gaps are usually 0px, but a
brief debug peak reaches 213px. RAF gaps include 58–93ms while measured
Canvas `writePresentation` costs 0–1ms and touch delivery is about 6–9ms.
Thus the visible stutter includes frame scheduling/composition delay outside
the measured presentation call, with some transient coverage lag.

Later the clip scrolls through a pink-only region *after touch release*;
`touch` age exceeds two seconds. At one hold/scroll frame, the glow is
`retained-preparing` 170px behind, with RAF gap 69ms, paint 1ms, misses 6 and
one abort. That is a scroll reanchoring coverage miss, not a steady pink-only
drag. The recording cannot establish whether pure horizontal movement inside
one tone also stutters without page scrolling; clarification is pending.

The overlay's `net/mask/deco` values describe the last completed request and
cannot identify the single synchronous call preceding a long RAF gap. A
debug-only `prepCall` line now records the most recent shadow draw duration
and its age. The local WebKit probe lacks `OffscreenCanvas`, so a worker raster
path is not established. Exact halo tiling is a possible architecture but
needs finite-footprint visual validation and per-tile readiness; waiting for
an entire tiled atlas would likely increase retention lag. Do not adopt it
without evidence that preparation calls, rather than browser compositing,
caused the recorded frame gaps.

## 2026-09-24: general drag latency, trail isolation

The user clarified that the remaining defect is visible latency during drag
overall; the blue/pink boundary is no longer the defining problem. In a
throttled Chromium touch drag at scrollY=3900, disabling only touch trails
reduced the sampled frame-interval p95 from 37-42ms to 31-33ms across repeated
runs and presentation paint p95 from 8-11ms to 4ms. Publication lag remained
0px in both modes. The CSS underlay blur A/B was inconclusive locally (43ms
p95 with both on and off in one matched run). The user also reports no clear
difference with `?pcb-underlay=off` on the physical iPad, so the blurred
text underlay is not the primary remaining cause. These synthetic timings
identify trail production as one cost but
do not establish physical iPad smoothness or rule out compositor/preparation
stalls.

The active touch path created, inserted and then removed a 238px trail Canvas
up to once every 36ms, with eight active nodes. A retained pool reduced the
synthetic p95 interval to 35/32ms and paint to 5/6ms, but the user saw no
clear difference on the physical iPad. Disabling trail painting entirely with
`?pcb-debug=1&pcb-trails=off` also made no clear difference there. The pool
was reverted to avoid retaining extra Canvas memory; the diagnostic switch
remains. Windows WebKit's tone transition still showed one visible main
Canvas and 0px settled lag. Trail production is not the primary iPad defect.

The `drag-test.MP4` overlay, rechecked at 0.25s steps during active motion,
shows 58-93ms RAF gaps in both `ready` and `ready-preparing` frames while
paint stays 0-1ms. Local WebKit individually measured plain and shadowed
full-region `drawImage` calls up to 213ms and 250ms, respectively, during
Services drag. A diagnostic single-visible-main-Canvas copy path had only
a small Chromium sample-interval change (34-36ms versus 37-39ms) and no
meaningful local WebKit improvement; it was reverted. Chromium's sampled RAF
p95 was the same 18ms with the debug overlay enabled and disabled. Physical
`prepCall` video is requested to distinguish synchronous preparation stalls
from Safari composition/scheduling on the actual iPad.

A larger 288px horizontal source-window step was also trialed against the
original 96px step. For a one-way 824px throttled Chromium drag it cut
preparation starts only from five to four and left frame timing essentially
unchanged. Reversing across window boundaries increased cancellation churn.
It was reverted; wider regions and the 192px prefetch threshold remain.

An isolated tiling experiment is in `prototypes/pcb-touch-halo-tiles/`.
WebKit tile calls were shorter than full-region shadow calls, but complete
preparation took about 2.5-3.7 times longer. Chrome had small pixel
differences with a 64px guard. This is not a production fix, especially while
the physical source of the 58-93ms RAF gaps is unresolved. If the physical
`prepCall` trace implicates shadow preparation, per-tile readiness and real
PCB pixel checks are needed before adopting tiles.

## 2026-09-24: stationary horizontal drag and input delivery

The second physical recording (`E:/Downloads/drag-test-2.MP4`, 13.57s) is a
stationary-page horizontal drag. The user reports the hover remains behind the
finger throughout motion and catches up after release, including without the
debug overlay and with underlay and trails disabled. Sampled frames show
`raf` gaps of 62-93ms while `paint` is 0-3ms, touch delivery is about 6-8ms,
publication lag is usually 0px when a frame arrives, and `prepCall` is 0-3ms
with an age of tens to hundreds of milliseconds. This rules out overlay DOM
work, trail painting, and the last measured synchronous Canvas call as primary
causes. The delay is in input/frame delivery or browser composition.

The touch path previously depended on passive `touchmove` listeners while
Safari negotiated the gesture. It now also handles touch via Pointer Events,
captures the active pointer, and declares `touch-action: pan-y` on the public
circuit page. Vertical page scrolling remains native; horizontal touch
movement is delivered directly to the glow. Legacy touch listeners remain as a
fallback and are ignored while a touch pointer is active. TypeScript, 22
focused integration tests plus one intentional browser-pixel skip, and 11
preparation tests pass after this change. Physical iPad verification of the
Pointer Events path remains the acceptance check.

## 2026-09-24: landscape regression report and current diagnosis

The user reports that landscape iPad horizontal drags with a small vertical
component sometimes scroll the page again, with renewed glow latency and stalls
near pink/blue section borders. The iPad uses `192.168.0.100:3000`. A fresh LAN
request returned HTTP 200 with current `pan-y` CSS and the scroll-follow touch
JavaScript, both with development no-store cache headers. The problem is not
explained by an old LAN bundle. Chromium at 1194x834 with three synthetic
diagonal gestures (120px horizontal, 20/50/90px vertical) reported no page
scroll and no pointer cancellation; that is not authoritative for iPad WebKit.

Code inspection found `pan-y` was formerly injected only after contact; it is
now in initial global CSS. Touch Events work while the pointer is captured was
removed, so the ordinary horizontal path is pointer-only. Those changes pass
34 focused tests (one intentional browser-pixel skip) and TypeScript but have
not passed physical iPad verification. A debug-only overlay now reports the
gesture path, pointer cancel/move counts, fallback touch moves and page scroll
delta beside the existing RAF, paint, tone and preparation timings.

No tone-pipeline edit is justified yet. On common portrait/landscape pairs the
two-tone decorated raster is already capped at 1x, and the final lens pixel
budget is area-capped, so swapping orientation does not increase its allocation.
Prior physical recordings had 62-93ms RAF gaps with 0-3ms presentation paint
and 0-3ms last shadow call. A new landscape overlay recording is needed to
distinguish pointer cancellation/native scroll from RAF/composition and
preparation churn at the border. Do not replace native scrolling with manual
scrolling or add non-passive move arbitration without physical latency evidence.

The initial `pan-y` CSS also prevented pinch zoom on the iPad, blocking the
landscape recording. It is now `pan-y pinch-zoom`; fresh LAN CSS includes that
rule and the viewport remains `width=device-width, initial-scale=1` with no
zoom restriction. [WebKit bug 232545](https://bugs.webkit.org/show_bug.cgi?id=232545)
remains open and describes an initially horizontal `pan-y` gesture switching
to vertical scrolling after slight vertical movement when the page has no
horizontal scroll. This matches the user's report but is not yet proof of the
active iPad event path. Preserve native scrolling and pinch zoom while
evaluating any workaround.

The user confirms both latency and older lag persist in landscape and remain
present, though less costly, at the narrower orientation; incidental vertical
movement still triggers scroll during horizontal drag. The debug overlay now
also shows `visualViewport.scale`, viewport width and bounded lens DPR so a
zoomed page is distinguishable from a rotated viewport. The open WebKit issue
is a concrete root limitation for the gesture boundary. A non-passive
`touchmove` classifier could intercept it, but may restore the synchronous
input wait that caused the earlier latency; a horizontally scrollable-page
workaround is also unverified and risks new layout/scroll behavior. Neither
workaround is applied pending physical gesture/RAF evidence.

## 2026-09-24: renderer isolation candidate

The user clarified that native scrolling during a horizontal drag is acceptable;
the requested fix is glow latency and stalls. The earlier physical overlay's
`prepCall` reported only the last shadow call, so its 0-3ms value cannot exclude
an earlier long call. Instrumented local Playwright WebKit at 1194x834 recorded
full-region shadow `drawImage` calls up to 159-232ms and plain copies up to
223ms, alongside 160-250ms preparing-frame p95 intervals. Its ready-frame p95
remained about 40-59ms. These synthetic measurements identify a credible
preparation blocker but do not prove the exact physical-iPad stall.

The touch renderer now tries a dedicated worker when both page and worker
support `OffscreenCanvas`. It transfers a mask `ImageBitmap`, colors and applies
all three shadow passes in the worker, and retains the returned `ImageBitmap`
for direct crop. Unsupported or failed worker setup uses the original Canvas
path. Tone extension retains the already decorated surface at its own pixel
ratio instead of synchronously resampling a whole region at a border. This
avoids a redundant main-thread copy while using more memory when a high-density
single-tone region gains a second tone.

The bundled worker ran in local Chrome on the actual page through the LAN
origin. Four synthetic tablet drag scenarios reported worker preparation and
zero publication lag; the
isolated crop fixture had zero changed pixel channels. Local Playwright WebKit
lacks `OffscreenCanvas`, so it exercised the fallback and still had 172-227ms
preparing-frame p95 intervals. Focused touch tests, TypeScript, LAN HTML and
asset checks pass. Physical iPad Safari remains the acceptance gate for worker
capability, complete request-to-ready timing, visual match, and horizontal
drag latency at pink/blue borders. Do not claim the latency fixed from Chrome
or fallback WebKit measurements alone.

## 2026-09-24: ready-frame composition and native-scroll handoff

The user still observed landscape horizontal drag latency with a prepared
effect. We remeasured without the green overlay (`?pcb-probe=1`), because the
overlay itself adds measurable frame cost. In local Playwright WebKit at
1194x834, a 70-frame settled service-section trace had about 62ms p95 RAF
gaps, while Canvas presentation writes were much shorter. Suppressing main
Canvas writes left about 47ms; suppressing publication or hiding the painted
scene left about 30ms. Moving an ordinary gradient overlay over the original
scene also cost about 42ms. This isolates a page-composition cost outside the
glow's JavaScript paint and explains why optimizing halo preparation alone did
not fix ready-state latency.

The page's static art consisted of many decoded SVG tiles with local luminance
masks and gradients. A diagnostic same-geometry 2x Canvas snapshot preserved
the visible pixels and reduced settled frame gaps. Production now snapshots
each decoded SVG projection to a same-CSS-size Canvas at capped device DPR,
then releases the SVG Blob URL. SVG is retained if snapshotting fails. At DPR2,
the page mounted 42/42 Canvas tiles, a 1194-to-1024 resize atomically replaced
42 tiles with 32, and a 2388x1668 screenshot differed from the vector
baseline at only 27 pixels by more than 2/255 (maximum channel difference 5).
Local settled p95 RAF gaps after the change were about 39-45ms across runs;
the local no-effect floor is about 30ms. Turning off text-underlay blur reduced
the residual toward that floor, but the blur is part of the accepted visual
treatment and was not changed. Global section `contain:paint` distorted About
layering, and other CSS layer hints or Canvas publication variants offered no
sound visual/performance tradeoff; they were not shipped. These are local
engine A/B measurements, not a claim of physical iPad resolution.

A separate deterministic bug was found at native-scroll handoff: pointercancel
entered a six-second hold, so passive touchmove samples during the same finger
contact were ignored. Pointercancel now preserves the contact state and latest
page-local anchor; only touchend releases. The WebKit `cancel-handoff` probe
asserts 30px horizontal motion, zero vertical drift while scrolling, and hold
after lift. The focused touch/preparation tests pass (34 plus one browser-pixel
skip), TypeScript passes, and the LAN origin returns current development HTML.
Physical landscape iPad drag latency, border motion, scroll-following, pinch
zoom, and sharpness remain the acceptance checks.

## 2026-09-24: physical rejection and accepted-state audit

The user tested the Canvas-snapshot change on the landscape iPad and reports
that horizontal drag latency remains. The local WebKit p95 change above was a
performance measurement, not an accepted fix; do not describe it as resolving
the physical defect. The earlier Pointer Events plus `pan-y` version was
physically marked fixed for horizontal dragging. No committed or saved patch of
that uncommitted state exists, so an exact code diff cannot be reconstructed.

The later native-scroll fallback is entered only after `pointercancel` and is
inactive while an uncancelled pointer handles a stationary horizontal drag.
This rules it out as a direct explanation for that specific path. A later
gesture-policy change from `pan-y` to `pan-y pinch-zoom` remains a plausible
WebKit-specific input difference, but local Playwright cannot reproduce the
physical iPad's real gesture negotiation. The diagnostic
`?pcb-gesture=accepted` applies the previously accepted `pan-y` policy after
hydration and before the first touch, leaving all other current code in place.
Compare it with the normal route for the same landscape horizontal drag. It
temporarily omits pinch zoom only in that diagnostic route. If both lag, do not
blame the scroll fallback or claim the CSS caused the pure-drag regression;
continue isolating the moving-glow renderer/composition on device.

## 2026-09-24: gesture A/B falsified; boundary preparation trace

The user compared the normal page and `?pcb-gesture=accepted` on the landscape
iPad: both lag equally, and the lag is worse when pink and blue share the lens.
The gesture override was removed. This falsifies the specific claim that the
later `pan-y pinch-zoom` setting caused the current pure-horizontal lag.

A local no-overlay WebKit boundary replay at 1194x834 recorded 22 preparation
starts and 11-12 aborts over 180 synthetic touch moves; p95 captured RAF gaps
were 127-156ms and individual fallback shadow calls reached 74ms. It is a
stress replay, not an iPad FPS estimate. The code explains the cost: every
new region prepares a 1092x708 CSS-pixel mask and two full decorated surfaces,
each with three full-region shadow passes. The previously active mask and both
surfaces are released when the new region publishes. The one-tone path does
less work. In contrast, local Chrome's actual-page worker path reported a
0-2ms decoration stage and 0px publication lag in the same landscape section.

One concrete later regression was found in worker cancellation. Aborting an
obsolete job terminated the worker; the next region's `decorate()` returned
`null` while the replacement worker probed, forcing all full-region shadows
onto the input thread. The worker now starts before first contact, and a new
request waits for its restarted probe instead of choosing the Canvas fallback
solely because the probe is pending. A deterministic mocked-worker test covers
abort, restart, and successful next decoration. This correction is relevant
only if the physical iPad supports the worker path; that is not yet measured.

`?pcb-capture=1` now gathers bounded RAF, paint, finger-gap, tone, preparation,
abort and worker/fallback samples without an overlay or network request during
contact. It posts after touch release to the development-only endpoint, which
appends `.next/dev/pcb-touch-captures.jsonl`. Local Chrome and WebKit captures
were received. The next physical run should include one one-tone drag and one
pink/blue boundary drag; then the actual device's worker availability and
dominant delay can be identified without another screenshot request.

## 2026-09-24: physical iPad capture and worker-owned mask correction

The user's landscape iPad sent three captures at 1180 CSS px width, DPR 2.
The one-tone drag had 14 preparations, 0 aborts, 1 miss, 101ms p95 RAF gaps,
and 0-1ms presentation paint. A blue/pink drag had 27 preparations, 3 aborts,
5 misses, 97ms p95 RAF gaps, 0-3ms paint, and a measured 511px finger gap
while the old region was retained. The browser supports the existing halo
worker: samples say `worker:0-3ms`, but the main-thread
`createImageBitmap(mask)` before each worker job took 21-86ms and some
`postMessage` sends took 16-66ms. The captured pointer was cancelled and the
scroll fallback ran in all three drags, so its contribution remains separate;
the large region-copy cost is directly observed even while worker halo time
itself is short. Browser UI height changed during captures. Input delivery
samples were mostly 6-17ms. Do not interpret the finger-gap metric as pure
horizontal offset during native scrolling; the retained-preparation status and
miss count identify the stalled published region independently.

The worker now accepts the ordered parsed paths, exact mask transform and
mask dimensions, and all requested tones in one job. It draws the unchanged
Path2D mask in its own OffscreenCanvas and decorates blue and pink from that
same mask, returning both bitmaps. The main thread no longer creates or copies
a full-region mask when the worker Path2D probe succeeds. A failed probe
retains the original Canvas fallback. The worker probe is started before touch;
restarted probes are awaited rather than triggering a premature main-thread
fallback. Local Chrome actual-page two-tone replay reports
`worker-region:2ms send:0ms`, 0px publication lag, and no main-thread
full-region shadow calls. TypeScript and focused worker/integration tests pass.
Physical iPad motion and worker-region adoption are still the acceptance gate.

## 2026-09-24: worker path physically rejected; horizontal coverage corrected

The user reloaded the landscape iPad and reported lag in both a one-tone drag
and a blue/pink boundary drag. The three captured contacts show that the new
worker path did run: `worker-region` took 2-6ms with no repeated main-thread
mask bitmap copy. One-tone RAF p95 was 103ms in the longer first contact;
the mixed contact was 124ms, with 5 geometry misses and 463px maximum
retained-region gap. Thus moving mask preparation to the worker removed an
observed cost but did not resolve the physical failure. Pointer cancellation
and fallback touch input still occurred. The capture's fallback input age was
stale because that handler returned before updating `lastTouchEventAt`; this
telemetry defect is now fixed, so prior fallback age readings are not causal
evidence.

The region key used point-dependent horizontal buckets. A horizontal drag
crossed bucket boundaries and rebuilt an overlapping full region even though
the visible PCB layout was unchanged. At a two-tone boundary, the rebuilt
region also required two decorated bitmaps before publication. The current
candidate fixes the coverage invariant: one region spans the full viewport
width plus the lens and a 64px guard at the current layout scale; only vertical
coverage can change its geometry. A tone extension now rasterizes using its
retained geometry's origin and scale rather than assigning new-request pixels
to the old origin. A local Chrome landscape replay saw one initial miss and no
retained-preparing frames over horizontal mixed-tone motion. This is a local
coverage check, not an iPad latency result.

Per-frame mixed-tone paint also copied each 420px prepared crop through a
full-lens work Canvas before drawing the final surface. The renderer now clips
each color interval on the final Canvas, draws the matching prepared source
strip, then applies the same flame and envelope masks within that clip. This
keeps the tone intervals, geometry, halo, flame and envelope equations but
removes the intermediate full-lens copy. A local Chrome screenshot showed the
pink glow in the mixed-tone section with the PCB geometry aligned. Focused
tests: 36 pass and one browser-pixel skip; TypeScript and diff checks pass.
The landscape iPad remains the acceptance gate for feel, scroll, pinch and
visual parity.

## 2026-09-24: physical landscape recheck after coverage and paint correction

The user reloaded `?pcb-capture=1` on the landscape iPad and described touch
drag as "almost perfect." The new one-tone drag (1180px viewport) had one
preparation, one cold miss, no retained frames, and 25ms p95 RAF gaps after
ready across 181 captured frames. The main mixed-tone drag had 28ms p95 ready
RAF gaps across 315 frames; its three retained frames occurred while entering
new coverage, rather than persisting through the drag. A fresh mixed contact
after reload had one preparation, one cold miss, no retained frames, 29ms p95
ready RAF gaps and 7px p95 finger gap across 73 ready frames. Earlier physical
mixed capture had 124ms p95 RAF gaps and a 463px retained gap. The latest file
also contains short contacts, zoomed viewport states and periods after pointer
cancellation with stale input; these are not equivalent drag comparisons.

This physical improvement is consistent with stopping horizontal region churn
and removing the full-lens intermediate copy. The capture cannot apportion the
gain between those two changes, and the user's "almost" leaves a residual
interaction concern. Do not call the renderer fully accepted or make another
speculative adjustment without identifying that residual behavior. Scroll,
pinch, mixed-tone appearance and hold/fade still need explicit acceptance.

The user subsequently said "great so this is done" after reviewing the change
and physical result. Treat the touch-lag task as accepted and closed. The
capture measures the tested landscape drags; it does not independently prove
every interaction variant or a production build. Reopen only on a new report.
