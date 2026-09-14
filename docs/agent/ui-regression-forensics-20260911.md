# UI regression forensics — 2026-09-11

## Attribution

The preserved reference is `f9767e2` (August 14 presentation/mobile polish).
The August 31 PCB commit `22d7a20` introduced broad text wrappers without
updating all existing descendant selectors. Global font family, typography
tokens and existing media-query typography/layout declarations were unchanged.

Successful edits in local rollout `01a04430-facc-7dd3-9260-d49a05b8e83e`:

- August 30, 21:13:06 IST: homepage Principles text wrapped in CircuitUnderlay.
- August 30, 21:14:12–21:14:40 IST: case-study text wrapped.
- September 1, 23:36:03 IST: border-shadow sources added as `tr::after`.

The first attempted combined wrapper patch failed; the timestamps above identify
successful subsequent patches, not the failed attempt. The first two changes are
in `22d7a20`; the September row-source change remains uncommitted. The confirmed
regressions predate the agent-routing implementation.

## Mechanisms and restoration

- `.principles span`, `.case-workflow span`, and `.case-outcome-footer span`
  selected new decorative/content spans as if they were the original labels.
  Browser evidence: Principles body 12px/subtle instead of 16px/text; outcome
  value 12px uppercase instead of display typography. Scope label selectors to
  their original structural owners, retaining original declaration values.
- Contact label descendant selectors imposed flex layout on internal paint
  spans. Preserve the original two flex children for Budget range / optional.
- Inline-grid wrappers changed intrinsic sizing, line wrapping beside caption
  markers, and mobile table value alignment. Keep inert paint out of flow;
  preserve caption marker/text in one canonical inline flow and full-width
  mobile value slots. Compare intrinsic-size boundaries, not just overflow.
- Generated table-row children created a fifth fixed-layout column. At 1440px,
  four original 310px columns became four 248px columns. Anchor the unchanged
  full-width rule to a real cell in table mode, and to the block row in mobile
  mode. Four columns are the renderer's fixed outcome-table contract.

No background geometry, lens animation parameters, palette approvals, data,
database promotion, routing implementation or earlier scrolling work is reverted.

## Why prior verification missed it

The modification was treated as decorative despite changing DOM structure
throughout the site. The back-arrow selector collision was addressed locally,
but the same boundary was not audited across all consumers. Later checks of PCB
pixels, animation, overflow and TypeScript did not establish preservation of text
styles, intrinsic sizes or table columns. This is a verification/scope failure,
not evidence that the user needed to supply more screenshots.

## Evidence and limitations

Local audit artifacts live under `.tmp-contour-audit/` (uncommitted):
`ui-forensics.json`, `ui-baseline-before.json`, `ui-baseline-comparison.json`,
`compare-ui-baseline.mjs`, `final-ui-check.mjs`, and `trace-ui-events.mjs`.
The comparison uses the same current published content with historical CSS and
the pre-wrapper semantic flow; backgrounds are omitted from that isolated
comparison. It compares visible boxes and text styles/line rectangles across
four routes and both sides of CSS breakpoint boundaries. The hidden honeypot's
changed containing block is excluded. This is controlled Chromium evidence,
not a claim of pixel identity for changed backgrounds or real-device WebKit proof.

Final verification status is recorded in CONTEXT. No deployment or database write
is part of this recovery.
