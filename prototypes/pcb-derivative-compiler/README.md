# PCB derivative compiler prototype

This directory holds build-time prototype output only. It is not read by the
production renderer and does not change the PCB Art Generator or CMS assets.

Regenerate the representative homepage region with:

```powershell
npm run compile:pcb-derivatives -- public/pcb-backgrounds/home-lens.svg scripts/fixtures/pcb-home-derivative-regions.json prototypes/pcb-derivative-compiler/home
```

The versioned composition plan owns a fail-closed layout key, canvas, complete
non-overlapping cell coverage, explicit empty cells, CSS-to-source mapping, and
hard section-tone intervals. The manifest records full SHA-256 source and
compiler provenance, the scale-adjusted selection reserve, artifact hashes,
and ordered source-path indices. Each non-empty derivative is directly
displayable: it keeps the selected original `<path>` strings, paints the 1px
depth before the opaque main geometry, and uses bounded luminance masks only
for negative cutouts. Every cell is capped at 512 CSS px per dimension.
Publishing a new manifest removes only obsolete files matching the compiler's
strict hashed artifact naming contract; unrelated files in the output directory
are preserved.

Verify rendered equivalence with:

```powershell
npm run verify:pcb-derivative-render
```

The gate compiles the checked 512px region afresh, verifies that its manifest and
SVG remain byte-identical to the checked artifacts, and compares it in installed
headless Chromium's software paint path at DPR 4 against an independent
all-source reference. The reference does not use the compiler's selected indices or gradient builder: it
paints every immutable source path through explicit solid-color tone clips. A
second four-cell rendering places seams at x=241 and y=271, away from the tone
boundary, and is checked against both the reference and the monolithic derivative.
Sharp reads the browser PNGs for global RGB, foreground occupancy, negative-cutout,
tone, and seam-band assertions. SVG, HTML, browser profiles, and PNGs exist only in
an operating-system temporary directory and are removed after a passing run; the
command writes no repository output.

The software paint path is explicit because this Windows sandbox cannot launch
Chrome's GPU process. Chromium still owns SVG parsing, external-image isolation,
masking, gradients, clipping, and rasterization; Sharp only reads the resulting
PNG pixels.

Current limits: this prototype consumes the prepared homepage lens projection,
not the larger semantic master. Its checked plan proves one representative
512px homepage composition only; it does not yet define the production
document-height or responsive composition families, and production does not
load the manifest.

## Responsive composition finding

Fresh Chromium measurements on 2026-09-15 showed that fixed breakpoint plans
would not preserve the current projection. The delivered page measured
390x10625, 753x7620, and 1425x7073 CSS px. With the 2400x12082.5 source, the
current `max(pageWidth/sourceWidth, pageHeight/sourceHeight)` mapping is
height-driven at the first two widths and width-driven at the third. Section
boundaries also move continuously as copy and cards reflow.

Therefore a small set of hard-coded mobile/tablet/desktop page-height plans is
not an acceptable production contract. Any future derivative design must either make page
composition itself deterministic, or move final derivative compilation to a
server boundary that receives an authenticated layout description. It must not
restore browser-side SVG compilation or disguise snapshot dimensions as a
responsive family. Reproduce the measurements with
`scripts/measure-pcb-composition.mjs` against a local Chrome DevTools page
endpoint.

## Full-layout cost benchmark

Run the non-production geometry and artifact-cost benchmark with:

```powershell
npm run benchmark:pcb-derivatives
```

It compiles complete bounded-cell grids for the three recorded page snapshots
and reports cell/artifact counts, derivative plus manifest bytes, source-path
selection and serialized-copy multipliers, and parse/plan/compile timings. It
writes no artifacts and production does not import it. It also reports the raw
source gzip/Brotli sizes and, for each snapshot, deterministic gzip/Brotli
sizes for the derivative responses, manifest response, and their aggregate.
Compression uses Node's built-in zlib with gzip level 9 and Brotli quality 11.
The aggregate is the sum of independently compressed artifact responses plus
the independently compressed manifest response, matching separate HTTP
responses; it is not the size of one concatenated compression stream.

### Shared-definitions A/B candidate

Run the isolated serialization experiment with:

```powershell
npm run benchmark:pcb-shared-definitions
```

The candidate first delegates validation and path selection to the established
compiler, then changes only each non-empty cell's SVG serialization. Every
selected source `<path>` string appears exactly once inside a cell-local
definition. Depth and main reference those definitions independently, retaining
the 1 CSS px depth offset and depth-before-main paint order. Ordinary cells keep
the established positive-geometry and global-cutout stages; a narrowly scoped
CSS custom paint property recolors white fill/stroke through each `<use>` while
the source attributes remain byte-exact. Cells containing a path with both
white and black paint retain ordered all-source luminance-mask semantics.

This is explicitly non-production (`productionContract: false`) and writes no
artifacts. The default compiler, checked derivatives, and public renderer do not
import it. `npm run verify:pcb-derivative-render` exercises the candidate and
the independent all-source oracle at DPR 1, 2, and 4, including the representative
cell, non-tone-aligned four-cell mosaic, and a mixed-paint fixture at fractional
scale.

The recorded measurements did not retain exact section boundaries, so this
benchmark deliberately uses one full-canvas `base` tone interval. That keeps
grid coverage, geometry selection, duplication, and artifact-cost evidence
valid without inventing tone data. It cannot validate rendered section-tone
fidelity, and the measured dimensions are snapshots only—not responsive
runtime breakpoints or production composition plans.

### Isolated browser-cost experiment

Run `node --experimental-strip-types scripts/pcb-browser-cost-benchmark.mjs` for
three A/B repetitions across those historical layouts. Optional arguments are
`--trials=3`, `--layout=measured-390x10625` (or another measured id), `--dpr=1`,
`--viewport-height=900`, and `--traverse-ms=2000`. Set `CHROME_PATH` if necessary.
It uses installed headless Chromium with `--disable-gpu` by default; `--gpu`
requests its normal GPU configuration, whose reported feature status must be
inspected before making hardware-acceleration claims.

The standalone localhost fixture server serves in-memory gzip SVG responses.
Each representation/repetition receives a fresh browser profile in OS temporary
storage, followed by a cache-warm navigation within that browser. Canonical HTML
contains identical eager/async image policies, CSS bounds, viewport and DPR.
Repetition order alternates. No Next server, `.next`, checked derivatives, or
production imports participate. Profiles are cleaned up, and JSON goes to stdout.

The report includes per-image decode settlement, first-viewport/all-image
settlement, HTTP-cache evidence, down-and-return animation-frame distributions,
visible unavailable/failed image samples, and Chromium paint/raster/decode trace
events. Windows process working sets and private bytes supplement JS heap; other
platforms explicitly report that OS memory collection is unavailable. Working
sets double-count shared pages, private bytes are committed virtual memory, and
post-traversal samples are not peak-memory measurements. Trace event sums can
overlap and are thread work, not elapsed time; absent events are not free work.

A separate diagnostic immediately replaces images with cold-URL derivatives of
the same-size layout shifted 24 CSS px in source projection. DOM readiness is
sampled each animation frame. Viewport PNG samples are compared with settled
before/after references to flag blank, stale, replaced, or partial/indeterminate
frames. Screenshot capture overhead is excluded from traversal timings. Each
sample carries its capture-time bounds: unobserved presented frames and exact
physical blank/stale durations remain unknown. The matte background aids pixel
classification and is deliberately not the actual site palette.

Fresh profiles do not clear OS caches; `image.decode()` includes loading and
scheduling; animation frames do not measure compositor presentation or touch
latency. This benchmark omits app foreground content, glow, network latency and
lazy loading. It cannot establish production, GPU, WebKit or physical-iPhone
performance, and its distributions are evidence rather than a pass/fail gate.
Pure report logic is covered by
`node --test scripts/pcb-browser-benchmark-metrics.test.mjs`.

## Production renderer-boundary measurement (milestone 2)

`scripts/pcb-boundary-runtime-measurement.mjs` records one deliberately bounded
production-page lifecycle. It does not tune either renderer. The 2026-09-22
comparison used Chrome 153 headless software paint, a fresh browser profile for
each artifact, a `1440x900@1` viewport, touch emulation, and one explicit mouse
event to exercise hybrid ownership.

The before artifact was the preserved production `.next` build from 01:33 local
time (`BUILD_ID=Y8Zhts94T2qQd9yIdFiZn`). It contains the accepted Canvas touch
backend in the pre-split monolithic component. The after artifact was a clean
build of the split source at 03:03 local time
(`BUILD_ID=E8y-1_Fz58T5RS9YjWnrV`). Both runs used the same installed dependencies,
Next 16.2.9, local server, harness, viewport, input sequence, and browser.

| Checkpoint | Before | After | Result |
| --- | ---: | ---: | --- |
| Delivered client JavaScript | 10 requests; 163,166 encoded / 562,848 decoded bytes | 10 requests; 163,195 encoded / 562,864 decoded bytes | +29 encoded bytes (+0.018%); no material byte change |
| Initial relevant listeners | 9 window + 12 document listener records | 9 window + 12 document listener records | Identical type/capture/passive signatures; the window set includes one passive capture listener for each touch phase, one passive pointer-move listener, one pointer-leave listener, one resize listener, and the observed scroll listeners |
| Initial PCB resources | 42 static SVG-image tiles; 4 live off-DOM Canvas work surfaces; 0 touch Canvas DOM; 0 interaction SVG | Same | No new initial resource ownership |
| Geometry requests and cache ceilings | 42/42 unique initial requests; 5/5 touch; 1/1 hybrid mouse; 1/1 settle; observed touch-cache max 4 | Same | No duplicate requests in the exercised path; observed max equals the tested touch limit of 4; shared promise cache remains capped at 128 |
| Retained Canvas/SVG wrappers after the 6s hold + 700ms fade and forced GC | 1 hidden touch Canvas DOM; 9/15 created Canvas wrappers live; 9/9 created interaction SVG wrappers live (1 lens + 8 trail SVGs); 0 retained touch trails | Same | Split does not increase retained wrappers; counts describe reachable DOM-created objects, not GPU memory |
| Hybrid lifecycle isolation | Touch input: 0 desktop lenses. Mouse input: 1 desktop lens + 8 trail SVGs. Touch misses 5 before mouse and 5 after mouse; exactly 1 touch Canvas | Same | Touch does not enter the mouse lifecycle, mouse does not add touch misses, and both capabilities coexist without a second touch surface |

The transient active-touch sample had three trail bitmaps before and two after;
trail emission is time/distance gated, so that single-sample count is not a
stable comparative metric. Both runs settled to zero retained trails and the
same nine reachable Canvas wrappers. Browser/GPU allocations, physical-device
latency, and WebKit behavior are unavailable from this CDP run; the already
accepted physical-phone behavior remains separate evidence. This is one
comparative checkpoint, not a benchmark distribution.

## Final static-renderer decision (milestone 3, 2026-09-22)

**Retain the current production static renderer.** The corrected shared-definition
candidate remains an isolated experiment. This decision makes no production
renderer changes and closes static-strategy exploration for the current task.

The acceptance threshold was material measured benefit applicable to production,
with preserved correctness and responsive composition. The four criteria resolve
as follows:

| Criterion | Existing evidence | Decision implication |
| --- | --- | --- |
| Correctness | Ordered per-path references corrected the grouped candidate's cutout repainting; the existing oracle covers representative cells, a non-tone-aligned mosaic, and mixed paint at DPR 1, 2, and 4. Full-layout cost fixtures use only a base tone because measured section boundaries were not retained. | Supports the corrected serialization in tested fixtures; does not establish full production section-tone or real-engine equivalence. |
| Size | The recorded comparison approximately halves serialized path copies and reduces raw/gzip output about 48%, but independently compressed response Brotli totals increase about 0.67–0.72%. | A meaningful serialization result, not a uniform transfer win. Production currently generates Blob SVG tiles in-browser, so derivative-response compression savings do not directly measure delivered production savings. |
| First and settled cost | Existing software-Chromium runs showed mixed results, including worse first-viewport, memory, and paint measurements in some cases. No material production runtime benefit was established. Milestone 2 instead shows the accepted renderer ownership split leaves initial and settled resource signatures materially unchanged. | Smaller serialization does not establish lower decode, paint, or retained-resource cost. The production boundary comparison validates the split, not the unwired static candidate. |
| Responsive compatibility | Recorded 390x10625, 753x7620, and 1425x7073 layouts switch between height-driven and width-driven projection; live section boundaries vary with reflow. The candidate has no production contract or runtime integration. | Snapshot derivative families cannot replace live layout ownership. Adoption would require additional composition/integration work outside this bounded decision. |

The decisive combination is unproved production runtime benefit and a missing
responsive production contract, despite a real raw/gzip serialization reduction.
This does not establish that shared definitions are intrinsically slower or
incorrect; it establishes that the existing candidate does not meet adoption
criteria. Keeping current static rendering preserves its accepted live-layout,
section-tone, vector, and atomic tile-replacement behavior, while retaining the
completed static/desktop/touch ownership separation.

Evidence limitations remain explicit: the numerical static A/B findings above
are preserved historical summaries; their raw reports were not available for
this decision. The standalone browser experiment uses software Chromium and
omits foreground content, glow, real network conditions, and production loading;
it proves neither GPU nor WebKit/physical-iPhone behavior. The accepted phone and
desktop checks apply to the existing production behavior, not the candidate.
No new experiment was run to fill these gaps.

## Production follow-up (2026-09-24)

A clean Next 16.2.9 build and fresh-profile Chrome 153 software-paint run of the
current homepage reached `ready` with 42 static Canvas tiles. Initial client JS
was 169,854 encoded / 584,062 decoded bytes across 10 requests. The touch/mouse
sequence kept separate lifecycles (three persistent touch canvases, one desktop
lens after mouse input, no additional touch cache miss). Switching reduced motion
on in the live page unmounted the touch canvases, touch trails, and desktop lens.
These checks establish resource ownership and behavior, not a before/after
startup or frame-time improvement. The production build and visual verification
passed; the development LAN server was restored afterward.

The same geometry under the development LAN origin at 1440x900@1 covered
10,079,025 Canvas backing pixels: 38.4 MiB of RGBA bytes at DPR 1. If all tiles
remain at the same CSS dimensions, backing alone projects to 153.8 MiB at DPR 2
or 346.0 MiB at DPR 3. This is a pixel-count estimate, not measured process/GPU
memory or an incremental cost over decoded SVG images. Current code retains the
full tile set. The user checked native iPad pinch zoom on 2026-09-24 and accepted
the slight softness against the desktop vector version. No memory-related crash,
lag, or blanking was reported; actual device memory remains unmeasured. Reopen
the static strategy only for a reproduced material problem, not the estimate
alone. No overall before/after speedup is claimed.

No further prototype is warranted: the task explicitly permits retaining the
current renderer when material measured improvement is unproved, and existing
evidence identifies no new failure of the accepted static requirements that
requires another design. Reopen only for a newly reproduced failed requirement
or a separately authorized production-composition change. Inspection of the
external PCG generator remains a non-blocking follow-up; no generator, database,
Storage, or deployment changes are part of this decision.
