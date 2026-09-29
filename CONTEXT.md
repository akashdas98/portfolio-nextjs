# Portfolio Context

Updated: 2026-09-30. Read `AGENTS.md`.

## Current Task

- Objective: publish visible PCB artwork atomically before UI entrance, preserve belowfold preparation, and improve residual homepage loading on live v2.
- Scope/approval: user reported live slowdown on 2026-09-30 and clarified hover already shows geometry immediately. Continue the authorized release correction through verified commit/push/deployment. No source geometry, project content, Storage or palette changes; CMS promotions remain verified complete.
- Status: Parent feature complete; v2 PCB first-paint correction deployed and live verified.
- Completed: v2.0.0 at b0bc73b remains the tagged baseline; all three CMS promotions verified. First-paint correction 2ffdfaa pushed/deployed successfully (Production6747830726). Visible-cohort publication, PCB-before-UI readiness, bounded batch/coverage delivery and failure-safe progressive enhancement verified; see docs/releases/v2-pcb-first-paint.md.
- Verification: user clarified that restored internet resolved most slowdown; project pages work, homepage remains slower. Do not infer a universal live stall from the earlier trace. Local Chromium desktop/laptop/mobile/reduced/noJS sequence checks passed with deliberately delayed geometry: visible tiles together, then UI; screenshots inspected. WebKit passed the same five variants; production build and delayed-network checks passed. All four routes passed hover/touch/scroll/resize; publication-time resize, late-art fallback and exact batch API checks passed. Clean LAN restart verified HTML and17 assets/cache policies. Live Chromium/WebKit each passed five first-paint variants; all four live desktop routes and mobile home/Leads reached complete preparation with hover/touch. Fresh desktop home first viewport2.913s, warm revisit0.193s; timings are observations, not controlled speedup evidence.
- Allocation: parent retains StaticCircuitVector scheduling and live/runtime verification. Reuse Sol-high for shared geometry broker and bounded API batching: model demand is interacting transport/cache/consumer ownership; effort demand is hypothesis tracing plus meaningful deferred/failure tests. New live timings justify this correction; no model/effort change or savings claim.
- Acceptance: all currently visible tiles decode before one DOM publication, then two paint frames precede UI entrance. Preserve belowfold preparation, atomic resize, noJS canonical content and bounded failure release; original bounds/path strings/paint order, 512px projection/two decoders, hover/touch/trails/hold and anonymous cached delivery remain intact.
- Remaining: follow the ordered task table below. No PCB release implementation remains. Existing production sender/admin browser follow-ups stay open; Work/products and Gmail remain deferred. Record any renewed live loading or physical-device regression before changing the accepted renderer.

| Order | PCB feature task | State | Exit condition |
| ---: | --- | --- | --- |
| 1 | Correct parent/subtask tracking and resume order | done | Current Task, workflow and checker agree. |
| 2 | Resolve remaining static performance evidence | done | Native iPad zoom accepted; backing estimate is not measured memory. |
| 3 | Verify final interaction correction | done | Hybrid/reduced-motion production checks passed; preserve behavior. |
| 4 | Branch regression and handoff review | done | Prior focused checks/build/LAN checks passed. |
| 5 | Inverse artwork underlay | done | Slow trial removed; same-color CSS slight darkening accepted. |
| 6 | EDD color and PCB regeneration review | done | User approved all; three paired artwork/document promotions remotely verified. |
| 7 | v2 checks, commit, push and deploy | done | v2.0.0 at b0bc73b pushed, tagged and deployed; live loading defect reopened below. |
| 8 | Correct live PCB first paint | done | Visible PCB appears together before UI, belowfold preparation/interaction preserved; production/live verified. |

### Routing task outcome (preserve)

2026-09-30: Sol/Luna only; independent allocation axes retained. Prompt hook silent; session restoration/guard retained. 26 routing/lifecycle and two memory tests passed; live Sol-medium/Luna-low metadata and three trusted hooks verified. Live spawn interception, savings and protected gateway remain unverified. See `docs/agent/delegation-system.md`.

### Previous task outcome (preserve)

Accepted PCB redesign separates static snapshots, native desktop SVG and bounded touch Canvas. Preserve PCG geometry, immediate contact/drag, native scroll/pinch zoom, flame/flicker/trails, six-second hold then opacity/size fade, hybrid separation and live reduced-motion teardown. iPad snapshot zoom softness accepted. Grey `#13181d`, EDD main `#0c3264`, depth `#315686`, blue center `#4aa8ff` with pink halo; CSS underlays remain. Estimated static backing 153.8 MiB DPR2 / 346 MiB DPR3 is not measured memory or speedup. Reopen only for reproduced lag/crash/blanking or material softness; `prototypes/pcb-derivative-compiler/README.md`.

## Status Ledger

| Area | Status / evidence | Next action or reopening condition |
| --- | --- | --- |
| Agent memory | Sol/Luna, independent routing and progressive context preserved | Hook trust verified; interception/savings/gateway unverified. |
| Product/site | App Router portfolio, admin/contact; senior full-stack and practical UI/UX positioning | Preserve design and required interactions; `docs/agent/architecture.md`. |
| Public data | Anonymous cached published reads, website-only fallback, validated database-only case studies | Preserve invalidation after admin mutations and availability semantics. |
| Delivery Intelligence promotion | verified complete | 2026-09-30 anonymous document and paired Storage hashes verified; `docs/releases/v2-promotion.md`. |
| Leads Management promotion | verified complete | Same evidence; retain lead-activity wording. |
| Horecah promotion | verified complete | Same evidence; retired website action removed, published study retained. |
| PCB artwork/rendering | Four new approved compositions; home repository-owned, studies Storage-owned | Preserve geometry/lens pairs, opaque diagrams and one responsive composition. |
| Reveal motion | CSS first entrance; JS owns initially below-fold targets at 94% line | Preserve progressive enhancement, route rebinding and reduced motion. |
| Admin/auth/contact | Implemented; full authenticated browser edit review pending | Local Resend key rejected; verify production sender/env. Gmail unbuilt. |
| Identity/deployment | Metadata/source origin `https://freebirdakash.vercel.app`; existing host returned 200 | First-paint application2ffdfaa Vercel Production success; all four live routes and atomic/UI sequence verified. |
| Dependencies | Next 16.3.7 pinned; Node 24.18.0; zero production audit vulnerabilities | Build/TypeScript pass; obsolete baseUrl removed, relative aliases retained. |
| Runtime/build | Fresh production build and Chromium/WebKit checks pass; one clean LAN dev writer on 3000 | Clean LAN restored at 192.168.0.101:3000; HTML and 17 CSS/JS assets and cache policies passed. Next agentRules:false prevents framework AGENTS mutation; fresh config build passes. |
| Git/GitHub | Private `akashdas98/portfolio-nextjs`; all v2 application changes pushed to main | v2.0.0 baseline b0bc73b; first-paint correction2ffdfaa pushed/deployed with separate release notes. |
| Main push gate | All three registry entries remotely verified complete; gate installed | Validate pushed commit; downgrade before any future local CMS iteration. |
| Future Work/products | Direction approved in principle, implementation deferred | `docs/work-and-products-overhaul.md`; start only when requested. |

## Known Issues

- Next and compatible transitive advisory fixes are applied: zero production audit findings. Other latest ranges remain floating; obsolete next lint is not a valid check on this Next version. TypeScript baseUrl removed and fresh build passes.
- Mojibake was reported; read UTF-8 and distinguish terminal display before editing.
- Local Resend credentials failed HTTP401; production sender/env and full admin login/edit browser verification pending. Direct email fallback preserved. Supabase historical success does not replace live evidence.
- LAN uses intentional `192.168.0.*`; inspect actual listeners/assets/cache, never trust saved processes. .next is single-writer. Git access uses safe-directory, never ACL changes.
- Current validated documents/seeds override older plans. No executable DB content; server-only secrets; admin requires ADMIN_EMAILS and matching RLS rows. Lifecycle checker cannot observe uncaptured work.

## Next Recommended Steps

1. Retain production contact sender verification and full authenticated admin login/edit review as follow-up work; direct email fallback remains available.
2. Monitor renewed PCB crashes, blanking, drag lag or unacceptable zoom softness. First-paint correction is live verified; preserve atomic viewport publication before UI and belowfold preparation. See docs/releases/v2-pcb-first-paint.md.
3. Keep Work/products and Gmail implementation deferred until explicitly requested.

## Recent Changes

- 2026-09-30: First-paint correction2ffdfaa deployed/live verified: visible PCB together before UI, belowfold preparation preserved. Build,57 affected tests, Chromium/WebKit five-variant sequence checks, four-route interaction/scroll/resize and bounded API/failure checks pass. See docs/releases/v2-pcb-first-paint.md.

- 2026-09-30: User approved all promotion and v2 commit/push/deploy. Three documents/six SVGs remotely verified, seed/migration aligned and local project overrides removed. See promotion evidence.
- 2026-09-30: v2 application/config deployed at 5e987e7; four live public routes/artwork and touch verified. Build/TypeScript, 81 affected tests plus browser pixel test, 20 local Chromium/WebKit render checks, zero production audit vulnerabilities and clean LAN/cache checks pass. v2 notes/tag publication follows. Sender verification remains unresolved (local HTTP401).
- 2026-09-30: Four seedless PCB pairs regenerated with requested scale/density/run controls. Home installed and project pairs now promoted; generation measurements/seeds and raw source remain ignored audit evidence.
- 2026-09-30: Sol/Luna routing and compact session-only policy completed; 26 guard/lifecycle plus two memory tests passed, live metadata/trust verified with interception evidence gap retained.
