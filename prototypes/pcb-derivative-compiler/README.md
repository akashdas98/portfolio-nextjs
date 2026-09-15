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
not an acceptable production contract. The next design must either make page
composition itself deterministic, or move final derivative compilation to a
server boundary that receives an authenticated layout description. It must not
restore browser-side SVG compilation or disguise snapshot dimensions as a
responsive family. Reproduce the measurements with
`scripts/measure-pcb-composition.mjs` against a local Chrome DevTools page
endpoint.
