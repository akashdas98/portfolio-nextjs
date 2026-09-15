# PCB derivative compiler prototype

This directory holds build-time prototype output only. It is not read by the
production renderer and does not change the PCB Art Generator or CMS assets.

Regenerate the representative homepage region with:

```powershell
npm run compile:pcb-derivatives -- public/pcb-backgrounds/home-lens.svg scripts/fixtures/pcb-home-derivative-regions.json prototypes/pcb-derivative-compiler/home
```

The manifest records full SHA-256 source and compiler provenance, the exact
CSS-to-source mapping, the scale-adjusted selection reserve, artifact hashes,
and ordered source-path indices. Each derivative embeds the selected original
`<path>` strings without regrouping or paint-order changes and is capped at
512 CSS px per dimension.

Current limits: this prototype consumes the prepared homepage lens projection,
not the larger semantic master; it emits mask-ready geometry rather than final
section-colored static paint; and it does not yet define the future
document-height composition contract.
