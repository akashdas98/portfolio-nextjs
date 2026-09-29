# Changelog

## v2.0.0 — 2026-09-30

All changes since the last push to `main` (`dedf30d4`) are included in v2.
See [v2 release notes](docs/releases/v2.md) for the portfolio, case studies,
PCB renderer, artwork, presentation, delivery and workflow changes, and
[promotion evidence](docs/releases/v2-promotion.md) for verified CMS ownership.

## 2026-09-24 — PCB renderer redesign (local main)

### Changed

- Split the public PCB background into static projection, desktop SVG interaction, and touch Canvas interaction owners while keeping PCG-authored geometry and desktop appearance intact.
- Snapshot decoded static SVG tiles into device-density Canvas for the accepted touch composition, retaining the SVG fallback if a snapshot fails.
- Restore immediate touch glow across the page, continuous drag and native-scroll tracking, geometry trails, flame and flicker, and the six-second hold followed by size and opacity fade. Keep native scrolling and pinch zoom available.
- Keep hybrid mouse and touch lifecycles separate. Tear down interaction resources when reduced motion becomes active.
- Restrict PCB diagnostic URL switches and the capture endpoint to development.
- Update the local agent routing policy and lifecycle guard to GPT-6 model and effort decisions with separate evidence for each axis.

### Verification and limits

- The final branch review passed a clean production build, 42 touch tests, 14 related tests, and production Chrome pixel, hybrid, and reduced-motion checks. Physical iPad ready-frame p95 was 25 ms and 28 ms in the recorded touch captures.
- The user accepted mouse and touch glow, scrolling, and slight iPad pinch-zoom softness. These observations do not establish a measured overall speedup.
- No PCG source, Supabase CMS document, Storage object, or deployment is changed by this renderer release.
