# Delegation system: current policy and upgrade entrypoint

**Use this document when choosing a worker model/effort or changing the agent
system.** The active workers are GPT-6.1 Sol and GPT-6 Luna only.
`Sol` in active guidance means GPT-6.1 Sol (`gpt-6.1-sol`). GPT-6 Sol
(`gpt-6-sol`) and GPT-6 Astra (`gpt-6-astra`) are prohibited for project
delegation, including fallbacks. Luna and its low-through-max effort range
are unchanged. The aim is
accepted completion with the least total task cost consistent with required
capability, reliability, latency, permissions and review effort. Token price or
benchmark score alone does not optimize that outcome. Preserve the independent
model-demand and effort-demand decisions and schema-version-2 routing contract in
`scripts/agent-routing/README.md`.

## Make a routing decision

1. **Define the work before looking at model comparisons.** State the deliverable,
   acceptance checks, relevant context, consequence of an error, and whether the
   result can be verified cheaply. Decide whether a worker can own a bounded part
   in parallel. Keep the work with the parent when handoff and review would exceed
   the benefit. Choose installed skills, tools and scripts that materially help.
2. **Assess capability demand.** Judge novelty and ambiguity; number of interacting
   technical or domain boundaries; need for architectural or product judgment;
   requirement to preserve subtle invariants; and how costly an undetected error
   would be. Reviewability matters: a narrow change with strong tests is more
   suitable for a lower-capability worker than an apparently short but hard-to-
   verify decision. This assessment identifies plausible models, not a score or
   a mandatory tier. Luna suits well-scoped, reviewable work; Sol suits substantive
   coding, research and workflows needing judgment. Start on Sol when its capability
   is needed; no Luna failure is required. If neither allowed model can meet the
   acceptance boundary, report that limitation rather than silently using Astra
   or weakening requirements.
3. **Assess reasoning-work demand separately.** Low fits direct application with
   little search. Medium fits bounded multi-step reasoning and ordinary verification.
   High fits hypothesis testing, dependency tracing or a substantial review. Xhigh
   fits sustained branching and synthesis across several boundaries. Max requires
   specific evidence that still more reasoning is likely to change the result;
   `ultra` is a Codex runtime option for Sol without points in the published
   GPT-6 charts, so require a concrete unmet reasoning need. Luna supports low
   through max; Sol supports low through ultra in the current spawn tool.
   More effort may increase cost and latency and does not fix a model capability
   mismatch. Effort is not guaranteed to improve benchmark scores monotonically.
4. **Compare viable model–effort pairs.** Only after steps 2–3, use analogous
   evaluations to see whether another pair could meet the same acceptance bar at
   lower total cost. Compare the outcome gap, cost per accepted task, latency and
   review burden, not per-token price alone. The September 30 charts strengthen
   GPT-6.1 Sol's candidacy for substantive workflows and show effort is not
   uniformly beneficial. Luna remains a candidate for bounded, reviewable work;
   its model and prior evidence are unchanged. The new charts omit Luna, so they
   do not establish current Luna-versus-Sol crossings. Astra values are reference
   comparators only, never routing options for this project. The
   exact cross-effort points and evaluation limits are in
   `docs/agent/gpt-6-routing-evidence.md`. Small score differences are not proof
   of a real advantage when uncertainty is unreported. Benchmark task costs are
   API estimates, not Codex subscription or this repository's measured cost.
5. **Commit the route and reassess at a meaningful boundary.** Record separate
   model and effort reasons/evidence, the acceptance checks, and the selected
   capabilities in the v2 routing block. Prefer `fork_turns: "none"` with a focused
   brief for a new worker. Reuse an existing worker for related follow-ups when its
   allocation still fits; reassess before reusing it. The current follow-up tool
   cannot change its model/effort: a changed pair requires a new explicit spawn
   with the reassessment declaration and a concise handoff. After diagnosis,
   new constraints, or a worker result, rerun steps 1–4
   on the **remaining work**, using what was actually learned about uncertainty,
   capability ceiling, reasoning depth, consequences and reviewability. Then
   compare the viable pairs again. A benchmark crossing alone is not a trigger:
   task evidence must explain why a different pair is now suitable. A model-only,
   effort-only, both-axis or neither-axis change is legitimate; changed axes need
   fresh, axis-specific evidence, including downgrades. For example, a diagnosis
   that localizes a difficult bug to a tested, mechanical edit can justify both a
   lower model and lower effort; a bounded but lengthy verification trace may
   lower model demand while retaining high effort; a newly discovered architectural
   invariant may raise model demand without changing reasoning depth. Preserve
   completed findings and avoid repeating adequate verification. The local
   evaluator checks that changed-axis evidence is present and well formed; it
   cannot establish that the claimed observation is true or that the new route
   is the best one.

These are starting examples, not a fixed allocation table. A small mechanical
edit with direct tests may fit Luna low; a coordinated update with a clear brief
may fit Luna medium. A feature implementation with interacting code may fit Sol
medium; a tractable but lengthy regression trace may fit Sol high or xhigh.
Subtle decisions and cross-engine defects may require Sol with deeper reasoning
and authoritative verification. Determine the actual pair from the
task evidence and acceptance boundary rather than its label or file count.

The older delegation design established the principles retained here: model and
effort are independent axes; work class is descriptive; start strong when justified;
reassess in either direction; account for handoff overhead; choose capabilities
on demand; keep context focused; and measure completed-task outcomes. The GPT-6
evidence refines comparisons among viable pairs. It does not replace the initial
assessment of task difficulty, uncertainty, consequence or reviewability.

## Context and cache discipline

Keep autonomous delegation, independent allocation and evidence-based reassessment.
Keep the v2 block concise: task-specific reasons and acceptance checks, without
copying general policy or benchmark matrices into each brief. Trivial parent work
needs no worker declaration. Load relevant requirements and evidence on demand;
do not reread already-loaded policy at every handoff.

The fixed session hook restores a compact policy at startup, resume, clear and
compaction. The registered prompt hook is a silent compatibility handler; it does
not inject another copy on every user message. Worker validation and audit remain
active. Hook definitions stay unchanged, preserving their existing trust identity.
Stable instructions/tool definitions and appended task evidence support prefix
reuse; changing prompt content earlier in a request can reduce reuse. Do not
rebuild prompts, manipulate cache settings or add a cache framework here.

Include new context, model changes, duplicated investigation and parent review in
handoff cost. Reusing an informed parent/worker can beat a fresh cheaper model;
choose from task evidence without sacrificing capability or verification. Existing
workers cannot be assumed to share a parent's cache. Cache benefit and total
savings remain unmeasured: compare complete accepted tasks, not hit rates alone.
The /clear recommendation and lifecycle behavior are unchanged in this update.

## Agent-system upgrade protocol

**Trigger:** a new user instruction, model family or version, effort option,
benchmark, Codex runtime behavior, skill/tool/integration, permission boundary,
or measured task outcome could change routing or agent workflow. Begin here;
do not treat a model rename or new graph as the whole upgrade.

1. Recover the current objective and constraints from `AGENTS.md`, `CONTEXT.md`,
   this policy, `docs/agent/workflow.md`, the routing guard README and relevant
   dated evidence. Preserve user approvals, project boundaries, unfinished work,
   and the original accepted-outcome objective. Inspect Git before edits.
2. Verify current official model/runtime support and the actual tool interface.
   Separate source claims from inference and distinguish API benchmarks from Codex
   availability, quotas and observed task performance. For graph evidence, extract
   exact labels/data where possible, read axes/legend/caption and surrounding
   methodology, and record workload, effort, quality, cost and limitations. Check
   for missing competitors, changed harnesses and nonmonotonic points.
3. Reconcile the update with both decisions: Does it change the capability needed
   for a task, the reasoning work within a model, the comparison among already
   viable pairs, or only implementation availability? Preserve independent axes
   and stronger initial routes where warranted. State which prior guidance is
   superseded and which remains valid. Do not turn benchmark rankings into a
   universal task-difficulty classifier.
4. Update the smallest owning surfaces together: this decision procedure and
   evidence, `docs/agent/workflow.md`, the compact AGENTS route, the hook-injected
   parent policy, explicit model/effort registry and tests, and CONTEXT checkpoint.
   Review the user-level Codex configuration if its injected mode hint conflicts;
   protected or out-of-workspace edits still follow their permission boundary.
   Preserve historical records as history, not active options. Keep the v2 schema
   unless a real contract change requires a versioned migration.
5. Verify representative initial and reassessed routes, all allowed pairs, old
   model rejection, axis-specific evidence, hook/launcher behavior, memory limits,
   and a fresh-session policy load where feasible. Test the changed boundary,
   not a fabricated savings claim. Record any runtime coverage gap explicitly.
6. Evaluate routing quality later on representative completed tasks: acceptance,
   corrections, retries, parent plus worker usage, tool/context overhead, review
   time and latency. Revise candidate-pair guidance when these outcomes outweigh
   generic benchmark evidence. A local hook remains an advisory guardrail; hard
   parent/descendant and spending enforcement requires a protected runtime.

## GPT-6.1 Sol upgrade (2026-09-30)

This upgrade record predates the same-day Sol/Luna restriction and policy-delivery
streamlining above. Current project eligibility overrides earlier comparisons.

The user replaces GPT-6 Sol with GPT-6.1 Sol and disallows the old model.
The live spawn interface supports `gpt-6.1-sol` at low through ultra; API graph
points cover low through max only. Schema v2 and independent axis selection stay
unchanged. Registry, hook injection, launch validation and audit identity share
the same model list. Historical records and benchmark baselines do not authorize
old models. The user-level configuration already selects `gpt-6.1-sol`; its
generic Sol mode wording is resolved by the explicit project policy, so no
out-of-workspace configuration edit is needed.

Allocation for this upgrade: Sol capability fits coordinated policy/evidence and
guard changes whose acceptance can be directly checked. Medium effort fits
bounded dependency tracing, exact chart extraction and regression verification.
The registry/tests worker uses GPT-6.1 Sol medium with no inherited history;
the parent owns evidence and policy reconciliation. Acceptance: all supported
pairs pass, old Sol fails at evaluator/hook/launcher boundaries, injected policy
names the replacement, active comparisons use version-correct evidence, and
memory/lifecycle checks pass. See the CONTEXT routing outcome for dated results.
Local hooks remain advisory; other repositories and protected runtime policy
were not changed, and this update does not measure completed-task savings.

## Streamlining verification (2026-09-30)

Allocation: Sol medium owned the bounded hook/registry/test correction; Luna low
performed a narrow read-only invariant audit after the changes. Both workers
completed real useful tasks rather than synthetic long-horizon benchmarks.
Runtime rollout metadata records `gpt-6.1-sol` / `medium` for
`01a0eeec-4b89-71a3-8586-8fae670ce852` and `gpt-6-luna` / `low` for
`01a0eeee-f484-7360-a6de-3a97970c421f`, both children of this session.

The 26 routing/lifecycle tests pass: all 11 allowed pairs, forbidden models,
independent axis evidence, reassessment in both directions, exact SessionStart
restoration for all four sources, silent repeated prompt handling, history limits,
hook audit privacy/failure, launcher and capability resolution. Two memory task-
tracking tests pass; memory size/link and diff checks pass. The bounded Luna audit
found no mismatched current routing or delivery invariant. Fresh app-server
inspection found all three unchanged hook definitions trusted with no errors.

Runtime model metadata proves these allocations executed; it does not prove a
universally optimal choice or autonomous future reassessment. The default hook
audit has no records attributable to these live spawns, so live PreToolUse
interception remains unverified despite trust and handler tests. Specialized
runtime tool paths may bypass hooks; preserve the documented advisory boundary.
No deliberate forbidden live model call was made: deterministic denial checks
cover it without paying for an unwanted model. No global config, hook definition,
cache settings, application processes or /clear policy changed.

Policy delivery adds no per-prompt text now, but no vanilla comparison or total
cost/cache improvement is claimed. Runtime counters include substantial common
harness context; minimal worker history does not eliminate that context. Detailed
prompt traces were not loaded into agent context. This run tests the changed
architecture boundary, not frontend behavior or protected runtime governance.

Current sources: [GPT-6.1 Sol evaluations](https://openai.com/index/introducing-gpt-6-1-sol/),
[OpenAI model selection](https://developers.openai.com/api/docs/guides/model-selection),
[GPT-6 model guidance](https://developers.openai.com/api/docs/guides/latest-model),
and [GPT-6 Sol and Luna evaluations](https://openai.com/index/introducing-gpt-6-sol-and-luna/).
