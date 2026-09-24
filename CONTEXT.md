# Portfolio Context

Updated: 2026-09-24. Read `AGENTS.md`.

## Current Task

- Objective: release the accepted PCB renderer redesign locally, then resolve the user's Supabase CMS push request without deployment.
- Scope/approval: user authorized commit and merge to `main` and requested a Supabase CMS push on 2026-09-24; deployment is excluded. User clarified this is a universal site-wide renderer change, not a case-study update. No PCG mutation is authorized. No CMS document, Storage or migration delta exists to push.
- Status: Parent feature complete and merged locally to `main` at `04dd60c` (feature commit `dd3118e`). Mouse/touch glow and scrolling were user-accepted, including slight iPad pinch-zoom softness. This is experience acceptance, not a measured overall speedup. `main` has not been pushed to GitHub or deployed.
- Source contract: the PCB Art Generator/PCG renderer is the sole geometry author. Preserve semantic primitives, IDs/classes, topology, cutouts and paint order. Screenshots only validate appearance; `components/public-circuit/` specifies interaction behavior. This repo does not contain the generator source; inspect it before changing PCG itself.
- Desktop contract: preserve its current effect one-for-one. Touch: activate on contact anywhere; follow drag including scroll; keep halo/flame/flicker and geometry trails but omit jitters; hold at the final touched spot for 6s, then fade opacity and size. No lag/blanking.
- Root diagnosis: hydration compiles arbitrary `/api/pcb` regions and Blob SVGs in-browser; document-height scaling couples all artwork to layout; desktop rewrites a large SVG mask/filter stack. Naive 512px derivatives multiply decoded geometry by about 3.45x-3.98x, so compression alone does not solve parse/paint cost.
- Completed decisions: static/desktop/touch ownership is split; the shared-definition candidate was rejected for unproved runtime benefit and missing responsive integration. Static projection snapshots decoded tiles for touch composition. The user accepted the resulting motion and iPad zoom appearance; no further renderer correction is selected. External PCG inspection remains a separate follow-up.
- Monitoring: high-DPR static backing projects to 153.8 MiB RGBA at DPR 2 / 346 MiB at DPR 3. This is not measured device memory or incremental cost over SVG; no related failure was reported. Reopen for reproduced crash, lag, blanking, or unacceptable zoom softness. See `prototypes/pcb-derivative-compiler/README.md`. No overall speedup claim or deployment.
- Completed: touch retains the frozen desktop flame field with approved size/jitter exceptions, persistent 420px front/back canvases, atomic pixels+origin publication, retained last-valid paint, active+latest preparation, guarded worker halo and Canvas fallback. Static SVG geometry now paints once into per-tile Canvas; desktop SVG is unchanged. Pointer cancellation keeps the touch interaction in contact until actual lift.
- Verification: 2026-09-24 clean production build passed; 42 touch tests plus browser-pixel check and 14 related tests passed. Production Chrome showed 42 ready static canvases, separate hybrid lifecycles, and zero interaction canvases/lenses/trails after live reduced-motion switch. Physical iPad touch captures remain 25ms/28ms ready RAF p95. This is not a before/after overall performance comparison. Dev LAN restored and assets checked.
- Prototype evidence: the gate corrected a mask/transform bug and rejected grouped shared definitions that repainted cutouts. Ordered per-path references fixed correctness and cut raw/gzip output about 48%, but runtime benefit remains unproved and production is unwired.
- Remaining: follow the ordered task table below. All PCB feature rows and the local merge are complete. Existing Supabase case-study documents and artwork are untouched; the universal renderer takes effect only when app code is deployed in a separately authorized step. Do not deploy now.

| Order | PCB feature task | State | Exit condition |
| ---: | --- | --- | --- |
| 1 | Correct parent/subtask tracking and resume order | done | Current Task, workflow, and checker agree; user correction is preserved. |
| 2 | Resolve remaining static performance evidence | done | Native iPad zoom checked and accepted; backing-pixel estimate recorded with limits. No actionable failure or further correction selected. |
| 3 | Verify final interaction correction | done | Live reduced-motion teardown fixed; production hybrid and reduced-motion checks passed. No speculative static rewrite. |
| 4 | Branch regression and handoff review | done | Focused checks, clean production build, diff review, and restored LAN assets passed. No deployment. |


### Routing task outcome (preserve)

- 2026-09-23: GPT-6-only Astra/Sol/Luna routing redesign complete: two-stage choice, reassessment, SVG evidence, future upgrade route, and local guard. See `docs/agent/delegation-system.md`. Twenty-three tests, memory/diff and 3/3 trusted hooks pass. Live worker, savings and protected gateway remain unverified.
### Previous task outcome (preserve)

- Fluid native scrolling and the Contact palette were restored and user-accepted on phone/PC. Work/About/Contact share `#12171c`; desktop depth/vector/jitter behavior was preserved. Historical `.tmp-contour-audit` evidence is not current device proof; reopen on renewed lag/color mismatch.

## Status Ledger

| Area | Status / evidence | Next action or reopening condition |
| --- | --- | --- |
| Agent memory | GPT-6 guard and two-stage delegation policy active locally | Portfolio hooks trusted; protected gateway and measured savings remain open; see `docs/agent/delegation-system.md`. |
| Product/site | Implemented Next.js App Router portfolio, admin, contact API; senior full-stack and practical UI/UX positioning | Preserve current design unless a new task changes it. Route map: `docs/agent/architecture.md`. |
| Public data | Published anonymous cached Supabase reads; website-only fallback; database-only validated case studies | Preserve cache invalidation after admin mutations and availability flag semantics. |
| Delivery Intelligence promotion | verified complete | Preserve database/Storage ownership and aligned seeds/migrations. |
| Leads Management promotion | verified complete | Preserve database ownership and lead-activity wording. |
| Horecah promotion | verified complete | Preserve database ownership and scoped product claims. |
| PCB artwork/rendering | Redesign accepted and merged locally to `main`; no overall speedup claim | Reopen only for reproduced performance/visual failure; no deployment. |
| Reveal motion | Autonomous CSS first entrance locked by prior fresh-profile iPhone verification; JS owns only initially below-fold targets at 94% line | Preserve route rebinding, progressive enhancement, reduced motion, and LAN cache safeguards. |
| Admin/auth/contact | Auth, project/lead admin and Resend contact implemented | Verify browser login/edit and production sender/env before launch claims; Gmail, richer filters and deletion remain unbuilt. |
| Identity/deployment | Metadata/assets implemented; source URL `https://freebirdakash.vercel.app` | Reconcile actual host/domain when deployment is in scope. |
| Dependencies | `latest` ranges remain; Node 24 previously installed successfully; lockfile uses public npm registry | Check current Node executable (old shells resolved 18); use Node 20+ for app installs/builds. Audit/pinning still pending. |
| Runtime/build | Clean production build passed 2026-09-24; dev LAN restored with HTML/CSS/JS asset and cache checks | Recheck actual processes/ports next session; follow single-writer procedure. |
| Git/GitHub | Private `akashdas98/portfolio-nextjs`; PCB feature merged locally to `main` at `04dd60c` | `main` remains ahead of origin; no GitHub push or deployment in this handoff. |
| Main push gate | `main` push requires every entry in `docs/agent/cms-promotion-status.json` to be `verified complete`; pre-push validates the pushed commit | Downgrade registry and CONTEXT before local CMS iteration; restore only after remote verification. |
| Future Work/products | Direction approved in principle, implementation deferred | `docs/work-and-products-overhaul.md`: live independent flagship before client work, later supporting products, `/work` catalogue, distinct Product Stories. Start only when requested and evidence is ready. |

## Known Issues

- Historical audit recorded four high-severity advisories through `next@16.2.9`; no forced upgrade was applied. Floating `latest` ranges remain unstable, and `next lint`/TypeScript compatibility must be rechecked before dependency work.
- Mojibake was previously reported in copy files. Read UTF-8 and distinguish terminal decoding from actual file corruption before editing text.
- Production Resend sender/env and full admin browser-flow verification remain pending. Prior Supabase success is historical; retain bounded retries/tagged caching and never mask provider failures with static case studies.
- The LAN subnet is intentionally `192.168.0.*`. Inspect DHCP/listeners/assets when debugging; do not treat a saved running-server claim as current.
- Current validated documents/seeds override older product/admin plans. Git access uses safe-directory, never ACL ownership changes. Lifecycle checks validate declared state but cannot observe unrecorded work or invoke `/clear`.

## Next Recommended Steps

1. PCB redesign is committed and merged locally. No Supabase CMS push is applicable to this universal renderer change; existing case-study data and layout remain owned by Supabase. Deployment remains excluded.
2. Re-evaluate dependency advisories/pinning and complete admin login/project-edit browser review on the next relevant task. Verify production host/domain, deployment env and Resend sender before declaring launch readiness.
3. Address confirmed mojibake deliberately; keep Gmail sync and Work/products redesign deferred until explicitly requested.

## Recent Changes

- 2026-09-24: User approved checkpoint-based `/clear` readiness. Lifecycle v3 allows documented pending work; only stale checkpoints, uncaptured handoff details or in-flight operations block. Six tests, memory and diff checks pass. Task tracking remains separate; only the user invokes `/clear`.
- 2026-09-24: User accepted corrected desktop trail. `<use>` had referenced lens geometry whose live culling changed old samples; per-sample ordered SVG path snapshots now remain fixed. Chrome verified 42 frozen paths through a fast jump, full decay/removal, visible afterimages, hybrid/reduced-motion isolation. TypeScript and diff check pass; no build beside dev writer.
- 2026-09-24: PCB diagnostic URL switches now run only in development; capture POST was already 404 outside development. TypeScript, production-route check and development-overlay check pass. Production build remains part of branch review.
- 2026-09-24: User accepted mouse/touch glow, scrolling, and slight iPad pinch-zoom softness. Clean build, focused tests, browser hybrid/reduced-motion checks, diff review, and LAN restart passed. Static DPR backing estimate is a monitored risk without a reported failure. No measured overall speedup claim or deployment.
- 2026-09-24: Committed the PCB release with changelog (`dd3118e`) and merged to local `main` (`04dd60c`). User clarified the change is universal; the merge has no CMS document, Storage or migration delta, so no Supabase push applies. Existing dynamic case-study content/layout remains intact. No GitHub push or deployment.
