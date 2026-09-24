# Touch PCB halo tile experiment

This is an isolated Canvas experiment. It does not use or change the production renderer. Run `node prototypes/pcb-touch-halo-tiles/run.mjs` from the repository root. The runner writes `results.json` and uses the installed Playwright link plus local Chrome and WebKit browser executables.

## Method

The benchmark draws a deterministic dense trace mask on a 1092 × 708 CSS-pixel region, at 1× and 1.4×. It colors that mask, then applies the production shape of three sequential shadowed `drawImage` passes (`shadowBlur = 8.5 × ratio`). Each tiled pass crops a guarded source area from the *complete assembled previous pass*, applies the shadow to a local canvas, and publishes only the tile interior. This preserves the propagation from pass to pass. Zero guard is a positive control for the seam detector. Pixel differences compare alpha and RGB composited over `#121212`, including a ±2px seam band.

## Results, 2026-09-24

The saved single-run measurements in `results.json` are useful for architecture screening, not a stable timing distribution or physical-device proof.

| Browser / size | Tile interior / guard | Pixel result vs full | Full shadow calls | Tiled shadow calls | Complete preparation |
| --- | --- | --- | --- | --- | --- |
| WebKit 1092 × 708 | 256 / 0 | 61,248 pixels >4 levels; hard seams | max 13ms | max 5ms | 27ms full, 70ms tiled |
| WebKit 1092 × 708 | 256 / 16 | exact in this fixture | max 13ms | max 6ms | 27ms full, 76ms tiled |
| WebKit 1092 × 708 | 256 / 64 | exact in this fixture | max 13ms | max 5ms | 27ms full, 105ms tiled |
| WebKit 1092 × 708 | 384 / 64 | exact in this fixture | max 15ms | max 6ms | 29ms full, 71ms tiled |
| WebKit 1529 × 991 | 256 / 64 | exact in this fixture | max 23ms | max 11ms | 48ms full, 177ms tiled |
| WebKit 1529 × 991 | 384 / 64 | exact in this fixture | max 22ms | max 17ms | 51ms full, 139ms tiled |
| Chrome 1092 × 708 | 256 / 64 | max 4.94 levels; 2 seam-band pixels >4 | queued draw return ≤0.1ms | queued draw return ≤0.1ms | queued totals unreliable |
| Chrome 1529 × 991 | 256 / 64 | max 21 levels; 329 seam-band pixels >4 | queued draw return ≤0.1ms | queued draw return ≤0.1ms | queued totals unreliable |

The positive control confirms the pixel comparison catches severe clipped halos. WebKit's 16px guard was exact for this one fixture; that is no proof of finite support for every path, ratio or Safari version. Chrome retains small differences even with 64px guard, so guard width alone does not establish cross-engine pixel identity. Chrome's `drawImage` calls returned before GPU work completed; its reported sub-millisecond call times must not be interpreted as paint cost. The Chrome differences need a visual inspection with real PCB geometry before any adoption.

Tiling bounded the longest measured **WebKit shadow call** here, but it increased complete preparation by roughly 2.5–3.7×. A two-tone boundary could double that aggregate work. These local calls were much shorter than the 213–250ms calls previously recorded while the live page was active, so the prototype does not demonstrate that tiles solve the iPad's RAF gaps. It also does not implement per-tile readiness, cancellation, scroll reanchoring, or retained-cache eviction. Publishing only after the entire tiled atlas is ready could increase coverage misses despite shorter individual calls.

The result supports a follow-up with a bounded local-tile readiness design only if physical `prepCall` evidence implicates shadow preparation. It does not support production replacement yet. Physical iPad behavior and seamless motion remain unverified.
