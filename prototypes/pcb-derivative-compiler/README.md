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
