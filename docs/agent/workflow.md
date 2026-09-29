# Workflow ownership

Global Codex configuration owns the injected delegation-mode policy; global
AGENTS owns economical execution guidance. Project AGENTS authorizes intelligent
delegation/model selection and owns task routing and project boundaries. CONTEXT
holds compact restart state; routed documents own detailed requirements/evidence.

## Runtime policy

The active two-stage routing decision and the general upgrade entrypoint are in
`docs/agent/delegation-system.md`: assess the task's capability and reasoning
demands first, then compare viable model-effort pairs using relevant evidence.
The GPT-6 benchmark matrix informs pair comparison; it does not classify task
difficulty. Apply this policy at initial allocation and meaningful reassessment.

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

2026-09-30 GPT-6.1 Sol upgrade: the active routing evaluator and launch guard accept
only `gpt-6.1-sol` and `gpt-6-luna`. Astra and `gpt-6-sol` are prohibited,
including fallbacks; Sol in current guidance means GPT-6.1 Sol. Existing effort limits stay the
same in this Codex spawn tool: Sol supports low through ultra; Luna
supports low through max. The current API model pages separately document
effort only through max; this guard models the Codex tool contract.
Model and effort evidence gates, reassessment rules, and work-class independence
are unchanged. Historical GPT-5.6 routes below are records, not current options.

OpenAI's GPT-6.1 Sol charts supersede old Sol comparisons. Higher effort
is not uniformly better. Luna's eligibility, effort range and previous evidence
are unchanged; it is absent from the new graphs. Astra is a comparator only.
The current matrix, historical baselines,
evaluation context and routing implications are in
`docs/agent/gpt-6-routing-evidence.md`. Select both axes for the actual task;
these API-priced benchmark results do not establish local Codex savings.
Sources:
https://openai.com/index/introducing-gpt-6-1-sol/
https://developers.openai.com/api/docs/guides/latest-model

2026-09-30 delivery streamlining: SessionStart restores the compact routing
policy at startup/resume/clear/compact; UserPromptSubmit is a silent compatibility
handler. The hook definition and PreToolUse enforcement are unchanged. Preserve
autonomous delegation, schema v2 and reassessment. Reuse an appropriately allocated
worker for related follow-ups; changed model/effort requires a new explicit spawn.
Keep briefs short and load requirements progressively. Detailed decisions and
cache limitations live in `docs/agent/delegation-system.md`, not repeated hook text.
The /clear rule remains unchanged; no measured cache or total-cost improvement
is claimed. User-level configuration remains untouched; project rules narrow its
generic global Astra guidance for this repository.

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
- Apply the two axes to initial judgment, not only escalation. Sol-high
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
When asked for the next task, resolve the scope from the active branch and Current
Task first, then check the routed requirement for unfinished work. The general
Next Recommended Steps list is a later backlog while an active feature still has
an ordered remaining item. If a completed subtask and an unfinished requirement
appear to conflict, reconcile their scope in CONTEXT before answering; do not
silently treat subtask acceptance as feature completion.
For a multi-step active feature, Current Task owns one ordered task table with
`active`, `queued`, and `done` states. Exactly the first unfinished row is `active`;
later rows stay `queued`. A detour closes only its own row or recorded subtask.
Do not promote final regression, release review, or backlog ahead of an unfinished
feature outcome. Keep the parent Status and Remaining line aligned with that table;
Next Recommended Steps points to it instead of maintaining a second task order.
The memory checker validates this structure, while the agent must still reconcile
the actual task truth against user corrections and evidence.

Meaningful changes require a durable checkpoint in the existing owning document;
read-only answers, unchanged state and validation-only results do not. Finish
affected regression checks before calling a code change verified; pending human
verification can be recorded explicitly. Run `scripts/agent-routing/lifecycle-cli.mjs`
after each meaningful checkpoint. At a safe handoff, suggest `/clear` naturally
whenever it returns ready. Version 3 checks checkpoint freshness, uncaptured
handoff details and in-flight operations. Feature completion, queued tasks,
documented pending checks and stable services do not block readiness. Task
tracking continues independently. The checker cannot verify checkpoint contents,
observe unrecorded work or invoke `/clear`; the user performs it. SessionStart
restores Current Task routing.

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
