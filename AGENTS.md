# Portfolio Agent Guide

## Startup - mandatory, automatic

Read `CONTEXT.md`'s Current Task first; use the routing table below and retrieve
only relevant ledger/issues/approval rows before affected work. Reuse valid active
context and already-injected instructions. Do not load the full ledger, recent
history, or all routed documents at startup. Inspect Git before edits and preserve
existing work. Saved runtime observations are historical, not proof of health.

## Required task routing

Paths are repository-relative. These files carry mandatory rules, not optional background reading. Load only applicable sections not already known, then follow references only
when needed. Use architecture routing when location/ownership is unclear or a
contract changes, not for every edit in a known component. Copy/visual tuning
does not require rereading product positioning unless it changes that contract.

| Task touches | Read before changing it |
| --- | --- |
| Implementation location or architecture boundaries | `docs/agent/architecture.md` |
| Application code, API, admin/auth, database, project content, schemas, asset ownership, dependencies | `docs/agent/engineering.md` |
| Copy, page structure, positioning, visual direction | `docs/agent/product.md`, `portfolio-structure.md`, `positioning.md` |
| Public CSS, layout, typography, motion, diagrams, PCB artwork, SVG preparation | `docs/agent/visual.md` |
| Install/build/dev processes, LAN, browser verification, tooling | `docs/agent/runtime.md` |
| Agent instructions, memory, skills, workflow architecture | `docs/agent/workflow.md` |
| Expanded case-study editorial work | `docs/case-study-evidence-redesign.md` plus product/engineering/visual rules |
| Independent products or Work catalogue | `docs/work-and-products-overhaul.md` plus product/engineering/visual rules; implementation remains deferred until requested |
| Future Gmail/admin planning | `docs/admin-projects-and-leads-plan.md` plus engineering rules; older plan schema is historical, not current implementation |

Use `.codex/skills/visual-design/SKILL.md` for appearance-led frontend work. Concrete project rules and the user's task override generic skill suggestions. Other skills are loaded only when applicable or explicitly requested; do not load the entire skill catalog.

## Always-active boundaries

- Preserve senior full-stack, practical UI/UX-informed, end-to-end positioning; direct email fallback; accessibility; progressive enhancement; and existing required interactions.
- Diagnose root causes with evidence before fixing. Reassess when evidence contradicts the diagnosis. Current code establishes implementation, explicit requirements establish intended behavior; neither stale prose nor accidental code silently overrides the other.
- Public project fallback is website-only. Public case-study routes require published Supabase data, `has_case_study`, and a validated document. Keep public reads anonymous and cached, and invalidate after admin mutations.
- Case-study iteration is local-first. Database promotion requires explicit approval for that project. Once approved, completion requires verified database/Storage ownership of all project-specific content and layout, aligned seeds/migrations, and removal of local duplicates. No executable database content.
- Never push `main` while any headless-CMS design/content promotion remains local, pending, or unverified on the server. Before such work, set both the `CONTEXT.md` row and `docs/agent/cms-promotion-status.json` to `awaiting user approval`; only remote database/Storage verification may restore `verified complete`. Keep the fail-closed pre-push gate installed.
- Preserve immutable PCB source geometry and Storage-owned semantic/lens pairs. Apply the relevant visual requirements; preserve exactly one responsive diagram composition and the opaque diagram canvas.
- Keep secrets server-only and out of Git. Admin requires both `ADMIN_EMAILS` and matching RLS admin rows.
- `.next` is single-writer state. Never build beside a running dev writer. Follow the runtime procedure when changing processes or generated output; recheck actual processes and ports.
- Do not use ownership/ACL changes to repair Git access. Keep generated output, logs, local environment files, and caches out of commits.
- Do not claim deployment readiness without verified metadata URLs, contact sender configuration, and a production build.

## Execution and verification

Intelligent delegation and explicit cheaper worker model selection are authorized.
Select model capability and reasoning effort as independent axes for the initial
route and every reassessment. Model choice answers which capability profile/ceiling
the work needs; effort answers how much inference, search and verification that
model should perform. Work class is descriptive, not an allocation ladder. A
stronger model need not use higher effort, and higher effort does not substitute
for a capability mismatch. Consider total handoff/review cost, preserve
requirements, and use focused briefs rather than full-history forks.

Before substantial work, record separate model-demand and effort-demand rationales
plus acceptance checks; reassess either axis independently at meaningful handoffs.
Before spawning, use the structured routing contract in
`scripts/agent-routing/README.md`. Automatically select useful
installed skills/tools; discover missing capabilities only for a concrete need.
Task-justified installation from a reviewed, pinned trusted source is authorized
within existing permissions; account consent and expanded access still require
their actual approval. Preserve stronger capabilities when evidence warrants them.
The local hook is a guardrail, not protected parent/spending enforcement; never
claim complete governance or measured savings from its presence.

Spend effort where it changes the result or resolves material uncertainty. Reuse
sufficient evidence. Verify affected behavior; widen checks when a changed boundary
or unresolved concern warrants it. For isolated visual tuning, inspect the affected
composition/interaction; generic skill viewport reviews apply when those variants
can change. Preserve real-engine verification for engine-specific defects.

Keep reads and tool results focused. Recordkeeping supports the task rather than
creating another task. No fixed reasoning/tool caps or forced delegation.

## Mandatory state checkpoints

Keep restart state useful: what is done, what remains, approval limits and
relevant dated evidence. Update the existing owner when those facts change or
unfinished work needs a handoff; link detailed evidence instead of duplicating it.
An unchanged state or a read-only reply needs no checkpoint. A validation result
does not create another documentation-and-validation cycle.

At a completed or safely handed-off task boundary, proactively recommend `/clear`
when the accumulated conversation is no longer needed and a compact restart will
reduce future context cost. Recommend it only after the latest meaningful change
is checkpointed and there are no unresolved items, active tools/processes/workers,
pending approvals or context-dependent next steps that would be lost. Use the
lifecycle checker for a machine-readable readiness decision on substantial work;
the user invokes `/clear`, and the agent never claims or assumes it occurred.

CONTEXT keeps the required task/ledger/issue/next-step sections and at most five
recent entries. Keep AGENTS <=8 KiB and CONTEXT <=12 KiB. Promotion status remains
`awaiting user approval`, `approved and in progress`, or `verified complete`, with
project-specific approval scope. Preserve unresolved issues and recovery evidence.
The routed rule owns changed requirements; README owns setup/operation.
`node scripts/check-agent-memory.mjs` validates memory structure and links.
