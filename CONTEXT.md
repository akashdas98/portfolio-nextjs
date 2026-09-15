# Portfolio Context

Updated: 2026-09-15. Read `AGENTS.md`.

## Current Task

- Objective: redesign the PCG-generated PCB background and glow pipeline for much better performance while preserving generated geometry and visual identity. Restore performant touch glow; excluding touch is not acceptable.
- Status: composition prototype implemented on `feature/pcb-renderer-redesign`; production remains unchanged.
- Source contract: the PCB Art Generator/PCG renderer is the sole geometry author. Preserve semantic primitives, IDs/classes, ownership, topology, cutouts and paint order through derivatives. Screenshots only validate appearance; current `PublicCircuitBackground.tsx` specifies interaction behavior. This repo contains the export/preparation pipeline, not the generator source; inspect that source before changing PCG itself.
- Desktop contract: preserve its current effect one-for-one. Touch: activate on contact anywhere; follow drag including scroll; keep halo/flame/flicker and geometry trails but omit jitters; hold at the final touched spot for 6s, then fade opacity and size. No lag/blanking.
- Root diagnosis: the browser acts as an asset compiler: hydration creates arbitrary `/api/pcb` regions and Blob SVGs; scale `max(pageWidth/sourceWidth,pageHeight/sourceHeight)` couples all art to document height; desktop continuously rewrites a large SVG mask/filter stack.
- Direction: PCG master → trusted derivative compiler → stable static renderer, plus a separate interaction renderer using the same evaluator. Responsive evidence rules out fixed breakpoint-height plans; either page composition becomes deterministic or a server compiler consumes an authenticated layout. Compare bounded native-SVG and GPU lenses. Exact GPU trails require a viewport surface plus bounded work buffers; one 615px canvas cannot cover separated trails.
- Unresolved: choose deterministic-page versus authenticated server-layout compilation; inspect PCG source; wire/measure static derivatives; compare SVG/GPU with touch activation and scroll; prove mobile glow fidelity and no blanking on physical iPhone.
- Completed: touch/coarse glow shell/listeners/requests/animations removed; static PCB and desktop glow/trails preserved. No database, Storage, deployment or PCG mutation authorized.
- Verification: build, TypeScript, synthetic WebKit/Chromium touch and desktop/static/reduced-motion checks passed. Physical-iPhone confirmation remains pending. Evidence: `.tmp-contour-audit/`. Recheck runtime.
- Prototype evidence: a fail-closed composition plan owns layout identity, bounded cell coverage, empty cells and tone intervals. The compiler emits one displayable hashed 512px derivative with 45 preserved positive/cutout paths, depth-before-main paint and provenance; it now removes only stale generated artifacts after publishing a new manifest while preserving unrelated files. The shared evaluator drives the unchanged SVG adapter. All 18 PCB tests pass. Chromium pages measured 390x10625, 753x7620 and 1425x7073; mapping flips from height- to width-driven, disproving fixed-height families. TypeScript remains blocked only by the recorded `baseUrl` deprecation. Rendered derivative equivalence remains unproved; this proves boundaries, not speedup.


### Routing task outcome (preserve)

- 2026-09-14: Portfolio Terra guard/audit added; 23 tests pass. Propagation/live worker unverified. See `docs/agent/workflow.md`.

- Guard installed/tested in Portfolio, Quilter and MafiaGame; 2026-09-12 Portfolio: 3/3 trusted hooks. Other trust is historical; protected governance/savings incomplete. See `scripts/agent-routing/VERIFICATION.md`.
### Previous task outcome (preserve)

- Objective: restore fluid native scrolling and fix the final grey Contact section.
- Status: implemented and verified; user reports scrolling is now fine on phone and seems okay on PC. Contact palette correction verified in browser; final user visual acceptance remains optional.
- Scope/approval: public PCB rendering/performance and grey-section palette correction. No database promotion or deployment; preserve depth, vector geometry and all jitter settings.
- Completed/verified: native local-vector PCB and fixed desktop lens restored; Work/About/Contact share #12171c. Prior pixel/interaction checks passed and user reported improved scrolling. Evidence: `.tmp-contour-audit/verify-local-vector.mjs`, `verify-final-interactions.mjs`, `contact-corrected.png`. These historical checks do not establish current device performance.
- Remaining: no requested implementation work; reopen if user reports renewed lag or color mismatch. WebKit not separately instrumented this session.

## Status Ledger

| Area | Status / evidence | Next action or reopening condition |
| --- | --- | --- |
| Agent memory | Adaptive routing, lifecycle and skill governance hardened locally, 2026-09-12 | Portfolio hooks trusted; checkpoint/clear and inventory-derived skill checks pass. Protected gateway and measured savings remain open; see `docs/agent/workflow.md`. |
| Product/site | Implemented Next.js App Router portfolio, admin, contact API; senior full-stack and practical UI/UX positioning | Preserve current design unless a new task changes it. Route map: `docs/agent/architecture.md`. |
| Public data | Published anonymous cached Supabase reads; website-only fallback; database-only validated case studies | Preserve cache invalidation after admin mutations and availability flag semantics. |
| Delivery Intelligence promotion | verified complete | Prior recorded approval and remote verification cover schema-v3 copy, all EDD geometry/breakpoints, and semantic/lens Storage pair; seeds/migrations aligned. No new promotion authorized by this task. |
| Leads Management promotion | verified complete | Prior recorded remote verification covers schema-v3 content, network variants/paths/breakpoints and Storage pair. Use lead activities for ingested units. |
| Horecah promotion | verified complete | Prior recorded remote verification covers schema-v3 scoped payments/notifications content, feature diagram/breakpoints and Storage pair. Do not imply whole-product ownership. |
| PCB artwork/rendering | PCG semantic source + spatial static vectors + desktop lens; redesign prototype on feature branch | Restore performant touch glow; preserve PCG geometry and desktop identity. Physical-iPhone glow/scroll confirmation is mandatory. |
| Reveal motion | Autonomous CSS first entrance locked by prior fresh-profile iPhone verification; JS owns only initially below-fold targets at 94% line | Preserve route rebinding, progressive enhancement, reduced motion, and LAN cache safeguards. |
| Admin/auth/contact | Supabase Auth, project create/edit/archive, lead actionables, dual allowlist/RLS, Resend contact and optional lead capture implemented | Complete browser login/edit review and production sender/env verification before launch claims. Gmail, richer filters, and project deletion remain unbuilt. |
| Identity/deployment | Icons, manifest, social image, metadata/sitemap/robots implemented; source URL `https://freebirdakash.vercel.app`; older plan prefers Netlify Free | Reconcile actual host/domain when deployment is in scope; do not silently change URL to match old planning text. |
| Dependencies | `latest` ranges remain; Node 24 previously installed successfully; lockfile uses public npm registry | Check current Node executable (old shells resolved 18); use Node 20+ for app installs/builds. Audit/pinning still pending. |
| Runtime/build | Prior clean production build reported 2026-09-01; later 2026-09-07 change had TypeScript/LAN checks, no new production build | Server/listener status unknown this session. Follow single-writer runtime procedure before any dev/build operation. |
| Git/GitHub | `main`; private `akashdas98/portfolio-nextjs`, SSH origin and initial commit `0a226dd` previously established | Preserve working changes; inspect auth/remote only when needed. Historical push/auth success is not present-session verification. |
| Main push gate | `main` push requires every entry in `docs/agent/cms-promotion-status.json` to be `verified complete`; pre-push validates the pushed commit | Downgrade registry and CONTEXT before local CMS iteration; restore only after remote verification. |
| Future Work/products | Direction approved in principle, implementation deferred | `docs/work-and-products-overhaul.md`: live independent flagship before client work, later supporting products, `/work` catalogue, distinct Product Stories. Start only when requested and evidence is ready. |

## Known Issues

- Previous audit recorded four high-severity production advisories through `next@16.2.9` and transitive packages; suggested forced upgrade was not applied. This is historical, not a fresh security assessment. Recheck when dependency work is requested.
- Floating `latest` dependencies make future installs unstable. `npm run lint` invokes `next lint`; confirm support before relying on it. Last TypeScript check explicitly acknowledged TypeScript 6 deprecation behavior.
- Mojibake was previously reported in copy files. Read UTF-8 and distinguish terminal decoding from actual file corruption before editing text.
- Production Resend sender/env and full admin browser-flow verification remain pending. Previous Supabase connectivity/auth success and three promoted documents are historical evidence, not a live probe today.
- The 2026-08-28 Supabase/Cloudflare incident stopped reproducing in 2026-08-29 checks; bounded retries/tagged caching remain. Do not restore static case-study fallbacks to mask provider failures.
- The LAN subnet is intentionally `192.168.0.*`. Inspect DHCP/listeners/assets when debugging; do not treat a saved running-server claim as current.
- Older product outlines contain superseded Delivery metrics and older admin plans contain obsolete fields. Current validated documents/seeds and explicit rules govern changes; history is not an implementation checklist.
- Git metadata writes can require elevated filesystem access; safe-directory is the intended ownership-neutral remedy. GitHub CLI previously used `C:/Program Files/GitHub CLI/gh.exe` if PATH was stale.
- Abrupt termination can still lose undeclared state. Checkpoints remain agent-authored; the lifecycle checker validates declared freshness/blockers but cannot observe unrecorded work or invoke `/clear`.

## Next Recommended Steps

1. Preserve the forensic UI restoration and its baseline evidence; finish any remaining real-device WebKit verification if requested. Protected routing/runtime gaps remain in `docs/agent/workflow.md`.
2. On the next relevant task, re-evaluate dependency advisories/pinning and complete admin login/project-edit browser review.
3. Verify production host/domain, deployment env, Resend sender and a current production build before declaring launch readiness.
4. Address confirmed mojibake deliberately; review affected desktop/tablet/mobile layouts after visual changes.
5. Keep Gmail sync deferred until lead workflow is useful; keep Work/products redesign deferred until explicitly requested.

## Recent Changes

- 2026-09-15: Made derivative recompilation converge on the manifest-owned generated file set without deleting unrelated output-directory files; 18 PCB tests pass.

- 2026-09-15: Measured live responsive composition and rejected fixed breakpoint-height derivative families: page reflow changes height continuously and flips the source mapping from height-driven to width-driven.

- 2026-09-15: Extended the PCB compiler prototype with a fail-closed composition plan and directly displayable static derivative paint (hard tone transitions, bounded cutout masks, depth before main); production remains unwired and 17 focused tests pass.

- 2026-09-15: Added a fail-closed `main` pre-push gate: the pushed commit's CMS registry must show every promotion remotely verified.

- 2026-09-15: On `feature/pcb-renderer-redesign`, added a deterministic hashed derivative-compiler prototype and extracted the exact envelope evaluator behind the unchanged SVG adapter. Production wiring and GPU choice remain gated on visual/performance comparisons.

- 2026-09-15: Specified separate touch glow: contact-anywhere activation, drag/scroll following, full non-jitter animation and trails, six-second final-position hold, then opacity+size fade; mobile lag/blanking remains disallowed.
