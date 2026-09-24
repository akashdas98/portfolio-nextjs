# Native SVG touch interaction prototype

This directory is a standalone, non-production fidelity and timing fixture for
the PCB touch interaction. It reuses the immutable
`public/pcb-backgrounds/home-lens.svg` geometry through the production spatial
parser, but it does not import or alter the production React component, static
derivative compiler, PCG, or `.next` output.

The renderer keeps one 615px native SVG shell. Initial contact, drag, and scroll
update a pure `idle -> contact -> hold -> fading` state machine. Release and
cancel retain the last page-local point for exactly six seconds, then fade the
content and shrink only the envelope mask for 700ms. A new contact replaces that
timeline. Reduced motion mounts no interaction SVG or listeners.

The fixture requests an ordered, bounded source subset on demand. A live lens
may replace its subset at a cell boundary; each emitted trail instead owns an
immutable copy of the subset visible at its sampled point. Both populations of
desktop perimeter jitter are intentionally absent. The retained touch treatment
uses a near-white geometry core, saturated blue/pink band, one soft blur, local
flame lobes, and a separate global flicker pulse.

Run:

```powershell
npm run test:pcb-touch-svg
npm run verify:pcb-touch-svg
```

The test command runs deterministic model and geometry checks. The verify command
then runs an isolated in-memory HTTP fixture in a temporary Chromium profile.
Browser evidence includes cold/warm
contact latency, cache misses, event-to-commit time, handler/model/write samples,
frame gaps, path/trail counts, long tasks, ordered immutable trail subsets,
single-frame coalescing, passive capture listeners, reduced-motion exclusion,
and cleanup. CDP touch input and model replay are synthetic; they do not replace
physical iPhone/WebKit validation.
