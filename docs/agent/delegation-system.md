# Delegation system: current policy and upgrade entrypoint

**Use this document when choosing a worker model/effort or changing the agent
system.** The active worker family is GPT-6 Astra, Sol and Luna only. The aim is
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
   coding, research and workflows needing judgment; Astra suits unusually
   ambiguous, consequential or cross-boundary work needing the highest capability.
   Start on Astra when that ceiling is required; no Luna or Sol failure is needed.
3. **Assess reasoning-work demand separately.** Low fits direct application with
   little search. Medium fits bounded multi-step reasoning and ordinary verification.
   High fits hypothesis testing, dependency tracing or a substantial review. Xhigh
   fits sustained branching and synthesis across several boundaries. Max requires
   specific evidence that still more reasoning is likely to change the result;
   `ultra` is a Codex runtime option for Astra/Sol without points in the published
   GPT-6 charts, so require a concrete unmet reasoning need. Luna supports low
   through max; Astra/Sol support low through ultra in the current spawn tool.
   More effort may increase cost and latency and does not fix a model capability
   mismatch. Effort is not guaranteed to improve benchmark scores monotonically.
4. **Compare viable model–effort pairs.** Only after steps 2–3, use analogous
   evaluations to see whether another pair could meet the same acceptance bar at
   lower total cost. Compare the outcome gap, cost per accepted task, latency and
   review burden, not per-token price alone. For mergeable coding, FrontierCode
   suggests Sol medium may be preferable to Astra low; for long-horizon engineering,
   DeepSWE shows Astra low substantially ahead of Sol medium. Luna at higher
   effort can outperform some lower-effort Sol points, but this is useful only
   when Luna's capability and the task's verification path are sufficient. The
   exact cross-effort points and evaluation limits are in
   `docs/agent/gpt-6-routing-evidence.md`. Small score differences are not proof
   of a real advantage when uncertainty is unreported. Benchmark task costs are
   API estimates, not Codex subscription or this repository's measured cost.
5. **Commit the route and reassess at a meaningful boundary.** Record separate
   model and effort reasons/evidence, the acceptance checks, and the selected
   capabilities in the v2 routing block. Prefer `fork_turns: "none"` with a focused
   brief. After diagnosis, new constraints, or a worker result, rerun steps 1–4
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
medium; a tractable but lengthy regression trace may fit Sol high or xhigh. A
short decision with subtle irreversible consequences may fit Astra low. A
cross-engine defect with uncertain root cause and expensive physical-device
verification may fit Astra medium or higher. Determine the actual pair from the
task evidence and acceptance boundary rather than its label or file count.

The older delegation design established the principles retained here: model and
effort are independent axes; work class is descriptive; start strong when justified;
reassess in either direction; account for handoff overhead; choose capabilities
on demand; keep context focused; and measure completed-task outcomes. The GPT-6
evidence refines comparisons among viable pairs. It does not replace the initial
assessment of task difficulty, uncertainty, consequence or reviewability.

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

Current sources: [OpenAI model selection](https://developers.openai.com/api/docs/guides/model-selection),
[GPT-6 model guidance](https://developers.openai.com/api/docs/guides/latest-model),
and [GPT-6 Sol and Luna evaluations](https://openai.com/index/introducing-gpt-6-sol-and-luna/).
