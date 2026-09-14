# Workflow ownership

Global Codex configuration owns the injected delegation-mode policy; global
AGENTS owns economical execution guidance. Project AGENTS authorizes intelligent
delegation/model selection and owns task routing and project boundaries. CONTEXT
holds compact restart state; routed documents own detailed requirements/evidence.

## Runtime policy

Codex 0.154.0 defaults V2 ordinary-effort sessions to explicit-request-only mode.
The user config now sets `features.multi_agent_v2.multi_agent_mode_hint_text` to
replace that policy with economical delegation independent of reasoning effort.
Worker allocation uses two independent decisions at the initial route and each
handoff. Model choice addresses required capability profile and ceiling; reasoning
effort addresses inference depth, branching, search and verification within that
model. Complexity, uncertainty, consequences, context and handoff cost inform both
but do not collapse them into one ladder. Stronger model does not imply higher
effort, and effort cannot compensate for a capability mismatch. Avoid cloned
history, duplicate work and empty polling.

## Adaptive routing implementation

2026-09-14 Terra inclusion: Portfolio's evaluator now accepts `gpt-5.6-terra`
at low through ultra, matching the live spawn tool's supported combinations.
Terra is a balanced agentic coding option; select capability and effort independently,
with the existing non-Luna model evidence and high-or-greater effort evidence rules.
The hook audit consumes the evaluator's shared model list to avoid divergent lists.
Allocation rationale: local implementation needs bounded code/schema judgment;
effort needs a short boundary trace and focused regression verification. No worker
handoff was needed. All 23 routing/lifecycle tests passed, including Terra effort
coverage, bidirectional reassessment, evidence rejection and hook audit identity.
No live Terra worker execution or cross-repository propagation was performed.
The model list remains explicit and requires review when runtime support changes.

Recorded 2026-09-11 and subsequently authorized for implementation in Portfolio,
Quilter and MafiaGame. Local guard implementation is installed and tested. A live
2026-09-12 inspection found Portfolio's three hooks trusted and error-free in the
active Codex home. The original requirements below remain acceptance criteria; a
local guard does not satisfy protected runtime governance. Source and operation:
`scripts/agent-routing/README.md`.

Verification: `scripts/agent-routing/VERIFICATION.md`. The historical inventory
found valid but untrusted hooks; the later live Portfolio check supersedes its
activation status for this repository only. Twenty-two local routing/lifecycle tests
and the Portfolio memory check pass. No protected governance, automatic remote
installation or measured savings is claimed. Complete enforcement still requires
a protected gateway/controlled runtime, not more local hooks.

Objective: make initial model and reasoning-effort allocation proportionate to
the work, adapt it as evidence changes, and enforce use of the routing policy at
runtime. Deterministic enforcement cannot guarantee correct complexity judgments.

Primary success criterion (clarified 2026-09-11): get the job successfully done
with token efficiency, without sacrificing intelligence or capability when needed.
Optimize total cost through accepted completion, not minimum per-call tokens;
preserve requirements, verification quality and access to stronger reasoning.

- Require independent model-demand and effort-demand decisions. Model demand states
  capability requirements, rationale and evidence; effort demand states reasoning
  shape, rationale and evidence. `work_class` is descriptive only. Consider total
  parent/worker cost and handoff overhead; allow trivial work directly.
- Apply the two axes to initial judgment, not only escalation. Astra-low, Sol-high
  and Luna-medium are legitimate when their different demand profiles warrant them.
  A stronger initial model needs no prior cheap failure.
- At meaningful handoffs, compare the previous and requested pair and classify the
  transition as model-only, effort-only, both or neither. Require changed-axis
  evidence for upgrades and downgrades, preserve findings, and avoid duplicated
  investigations.
- Put authorization in a protected execution gate outside agent-editable policy.
  Validate permitted allocations, escalation evidence and spending limits before
  expensive execution. Cover the parent, descendants, resumed sessions and other
  launch paths; worker-only enforcement leaves parent execution uncontrolled.
- First verify capabilities of the installed runtime. Current official hook docs
  describe PreToolUse interception of spawn_agent but explicitly warn that hooks
  are not a complete enforcement boundary. Do not claim hard governance from
  prompt injection, defaults or hook installation alone. Determine whether a
  controlled runtime or model-request gateway is needed for complete coverage.
  Reference: https://learn.chatgpt.com/docs/hooks#tool-coverage
- Acceptance: deliberately attempt a non-Luna model without model evidence, high
  effort without effort evidence, cross-axis evidence substitution, nested/
  alternative launches, checker failure or
  disablement, and bypass after resume/configuration changes. Unauthorized routes
  must be rejected with recorded reasons; no silent expensive fallback. Record
  actual coverage and limitations rather than assuming installed-version support.
- Evaluate routing quality separately using acceptance success, unnecessary
  escalations, retries, total usage/cost and latency. Include routine grey-palette
  diagnosis, uncertain scroll regression and straightforward post-diagnosis fixes
  as representative cases. Enforcement tests alone do not demonstrate savings.

Expanded scope recorded 2026-09-11: adaptive skills and external capabilities.

- Automatically determine whether installed skills, built-in tools, connected
  integrations or reusable scripts improve the task; use suitable capabilities
  within the task's authorization without requiring the user to name them.
- Assess task-driven discovery, installation and use of missing skills/plugins.
  Verify actual runtime discovery/install support and connection state first;
  define trusted sources and permission boundaries. Automate eligible installation
  when authorized; account consent and protected configuration remain subject to
  their actual approval requirements. The implementation request authorizes
  task-justified local installation, not new account consent or expanded access.
- Prefer existing capabilities and compact reusable scripts for repeated checks.
  Load relevant skill instructions and references on demand. Add capabilities
  when expected task/reuse benefit outweighs setup, context and maintenance cost;
  do not maximize plugin count or load every skill by default.
- Measure total parent/worker tokens, tool-output context, setup/discovery overhead,
  retries, latency and acceptance success. Cheaper model pricing alone is not
  evidence of fewer tokens. Compare representative completed tasks and preserve
  stronger tools/models wherever they improve reliable completion.
- Verify automatic selection/use, missing-capability discovery, eligible install
  and activation, consent-required connections, unavailable tools and useful
  fallback behavior. Report actual coverage and limitations. At recording time,
  installed-skill selection and economical delegation are instruction-driven;
  blanket auto-install and savings are unverified, and plugin search/suggestion
  tools were not exposed in the review session.

The local capability resolver now derives installed-skill state from fresh runtime
inventory instead of trusting an agent status claim. Inventory records canonical
instruction paths, scope, hashes, read failures and duplicate names. Installed use
requires one readable enabled match in an allowed root; missing-skill eligibility
requires an exact pinned allowlist match and no consent, credential, protected-
configuration, task-data, external-write or executable boundary. A receipt plus
before/after inventories can establish `discovery_verified`, not that instructions
were loaded or followed. The evaluator performs no installation. Protected source
policy, unattended installation and load attestation require a controlled runtime
outside agent-editable files.

## Context and verification

Startup loads Current Task, then relevant routes/issue/approval rows on demand.
Preserve unfinished work and historical evidence without loading them indiscriminately.
Do not shrink tool schemas or remove project requirements just to reduce context.
Natural task handoffs preserve current decisions without replaying completed work.

Meaningful changes require a durable checkpoint in the existing owning document;
read-only answers, unchanged state and validation-only results do not. At completed
or safely handed-off boundaries, the agent should recommend `/clear` when the prior
conversation has become disposable. Recommendation requires a fresh checkpoint,
declared completion, no unresolved items or active operations, and an affirmative
semantic judgment that clearing is useful. `scripts/agent-routing/lifecycle-cli.mjs`
validates those declared conditions and returns distinct ready, blocked and invalid
statuses without exposing item text. It cannot observe unrecorded work, invoke
`/clear`, or replace the agent's completion judgment. The user performs `/clear`;
SessionStart then restores the compact policy and normal Current Task routing.

Memory checkers establish structure only. Fresh-process policy inspection establishes
injection; actual delegated work establishes worker selection. Neither proves quota
savings. Compare total parent/worker usage and corrections through accepted outcomes
in ordinary work. No application build is needed for instruction-only changes.

## Verified 2026-09-10

Codex 0.154.0 `exec --strict-config` with Sol low completed a one-response,
read-only smoke check. Fresh rollout `01a08c56-f441-7142-955a-7c907990f1b2`
records V2, the custom economical mode, and no explicit-request-only fragment.
The response recognized Current Task plus relevant rows on demand. It used
19,307 input tokens (11,392 cached) and 33 output tokens: runtime/tool overhead
still exists. This did not measure before/after savings or automatic routing.
A Sol worker with no inherited history completed Quilter and MafiaGame instruction
updates. Both existing check_context scripts passed; focused diff checks were clean.
Their AGENTS files shrank from 13,391 to 12,394 bytes and 13,298 to 11,012 bytes
respectively; startup state sections are now selected rather than bulk-loaded.
Product work, approvals and hard boundaries were preserved.
Portfolio startup state selection is about 1.4 KB rather than the full 9.3 KB;
these are text sizes, not model-token measurements. Application work remains intact.

This session subsequently received the custom mode as a live developer update.
Fresh processes also load it; old prompt history is not retroactively rewritten. User config is `C:/Users/akash/.codex/config.toml`; the prior configuration
is backed up locally under `.codex/tmp/config-before-economical-delegation-20260910.toml`.
To revert only this policy, remove its added `[features.multi_agent_v2]` block;
do not overwrite newer unrelated settings with an old full backup.

Version-matched implementation:
https://github.com/openai/codex/blob/rust-v0.154.0/codex-rs/core/src/session/multi_agents.rs
The setting is a supported schema field in this version, but not an enforced router.
Recheck effective prompts after CLI upgrades if delegation behavior changes.
