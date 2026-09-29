# v2 CMS promotion evidence

Approved by the user on 2026-09-30 for Delivery Intelligence, Leads Management and Horecah, including all remaining local project data and artwork. Registry moved to `approved and in progress` before writes.

## Remote ownership verification

Verified at 2026-09-29T22:18:19.481Z (2026-09-30 IST). Each project remains published with `has_case_study=true`. Anonymous Supabase reads matched the full promoted document; all three passed the live v3 schema. Each public semantic/lens download returned 200 and its SHA-256 exactly matched the approved prepared asset. Uploads used immutable hash-addressed names in `case-study-assets`; generated geometry was unchanged. No secret was written to this evidence.

| Project | Dimensions | Semantic object | Lens object |
| --- | --- | --- | --- |
| delivery-intelligence-the-sleep-company | 2400 x 15183.5 | `delivery-intelligence-the-sleep-company/background.fff5c7fbe538eabf7bff.svg` | `delivery-intelligence-the-sleep-company/background-lens.ed3d7b911febb7a95ba3.svg` |
| leads-management-the-sleep-company | 2400 x 14173.8 | `leads-management-the-sleep-company/background.0de4c8bc000082604a62.svg` | `leads-management-the-sleep-company/background-lens.85f40a3149ed04d5f1c7.svg` |
| horecah | 2400 x 11019.3 | `horecah/background.8812277dcb9def6845a9.svg` | `horecah/background-lens.63804fd846af2ecceab8.svg` |

## SHA-256 verification

### delivery-intelligence-the-sleep-company

- Semantic: `fff5c7fbe538eabf7bffefc6ffd08cb45aba5d5fc7b288f96d61038c2e647e9b`
- Lens: `ed3d7b911febb7a95ba350fbb87acb7b53a2b0cc6cae60b09cc93a52239694f0`
- Document snapshot (ordered JSON serialization): `622eac19ad8774f76bb07108ea1c6c8cd11ebb92c8f51c9e2d5e7cc1cfc6cd64`
### leads-management-the-sleep-company

- Semantic: `0de4c8bc000082604a62544481a043e3b2d1aa7765cb63f54b320244e78c0aab`
- Lens: `85f40a3149ed04d5f1c78dcff38fa5daee38a66a73390eceff58a51ffb6c3f39`
- Document snapshot (ordered JSON serialization): `13011f6a1f7c335affe2d848d6aad5f16e8d49255767c49b2380cfb17461ed3a`
### horecah

- Semantic: `8812277dcb9def6845a9b7ed23829d8d4a67bddb9fef4ea2a7aa411b7677f133`
- Lens: `63804fd846af2ecceab81702223a8b7debec1257d1f44cc4f94491ce62650616`
- Document snapshot (ordered JSON serialization): `b8e9fd840784cc6e5408372c741dc2789f6b0ed1e947af44d2097ddd6901f16f`

## Data and frontend reconciliation

- Delivery Intelligence Additional impact now selects the bounded shared `dark-blue-pink` palette via validated `circuitImpactPalette` section data. The generic renderer no longer checks its project slug or section ID. Static main `#0c3264`, depth `#315686`, blue center `#4aa8ff` and pink halo remain the approved shared palette primitive. Existing diagram layout/content already belonged to the document and were preserved.
- Horecah CMS URL and website-only fallback are empty. The local retirement resolver was removed; its published case study remains available.
- The complete promoted documents align `supabase/seed.sql` and `supabase/migrations/20260930120000_promote_v2_case_study_artwork.sql`. Remote changes were applied through the service-role API and read back anonymously; this SQL records the equivalent migration, not a claim that the remote migration ledger was altered.
- Local preview routes, slug-to-height tables, preview renderer overrides and local source allowlist were removed. Approved project pairs belong to Storage. The complete ignored public-preview tree was moved into ignored audit storage, so no project SVG remains under `public/`. Exact current verified semantic/lens/depth copies were removed; immutable raw sources, older iterations, measurements/seeds/counts/screenshots remain audit archives and are inaccessible to the renderer. Automatic review rejected broad deletion of historical audit/source directories; the reversible archive preserves that evidence. Full private rollback rows and operational scripts are ignored local audit artifacts, excluded from Git.
- Focused spatial checks: 10 passed after preview support removal. TypeScript overlapped the parent dependency install and is deferred to the release production build.
- A fresh public render, production build, deployment and deployed-route verification belong to the release owner. Physical-device/WebKit acceptance remains the previously recorded scope; no new physical-device result is claimed.
