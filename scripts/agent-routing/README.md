# Adaptive routing guard

This dependency-free package provides a pure routing evaluator, a Codex 0.154
hook command, an advisory decision checker, a capability eligibility checker, and
an opt-in parent launch wrapper. It is a practical guardrail, not hard runtime
governance.

For the actual model/effort decision and future agent-system upgrades, start with
`docs/agent/delegation-system.md`. The evaluator checks declared evidence and
supported combinations; it cannot infer task difficulty or prove that a route
minimizes completed-task cost.

## Worker contract

Every covered `spawn_agent` / `Agent` call must explicitly set `model`,
`reasoning_effort`, and `fork_turns`. Its message must contain exactly one block:

```text
<routing>{"schema_version":2,"scope":"...","work_class":"implementation","uncertainty":"...","consequences":"...","acceptance":["..."],"model_demand":{"requirements":["..."],"rationale":"...","evidence":["..."]},"effort_demand":{"reasoning_shape":"...","rationale":"...","evidence":[]},"allocation":{"phase":"initial","previous":null},"capabilities":["node:test"],"model":"gpt-6-astra","reasoning_effort":"low"}</routing>
```

Schema version 2 treats the axes independently. `model_demand` describes required
capability profile/ceiling—such as judgment, novelty, abstraction, interacting
constraints or robustness—and justifies the model. `effort_demand` describes the
inference work within that model—such as direct application, sequential deduction,
hypothesis search, dependency tracing or verification—and justifies effort.
`work_class` remains `routine`, `implementation`, or `complex`, but is descriptive
metadata and never selects either axis.

All runtime-supported model/effort combinations are valid with sufficient axis-
specific declarations: a narrow subtle judgment may use Astra-low, a long tractable
investigation may use Sol-high, and bounded multi-step work may use Luna-medium.
Non-Luna models require model-specific evidence; high, xhigh, max and ultra require
effort-specific evidence. Evidence for one axis cannot satisfy the other. Luna
supports effort through max; Sol and Astra support through ultra. No cheap-model
failure is required before a justified stronger initial allocation.

The supported model list is explicit: GPT-6 Luna, Sol and Astra. GPT-5.6
models, including Terra, are no longer eligible for new routes.
Use capability and effort demands together: a Sol medium route can match or beat
Astra low for some coding work at lower measured benchmark task cost, while
Astra low leads Sol medium on longer engineering and computer-use evaluations.
See `docs/agent/gpt-6-routing-evidence.md` for the SVG point values and limits.
Validation and audit logging share the evaluator's model list. Runtime inventory
changes still require reviewing this list; it is not discovered automatically.

For reassessment, `allocation` supplies the declared previous pair and a trigger.
The evaluator derives `model-only`, `effort-only`, `both`, or `neither`; every
changed axis requires its own evidence even when downgrading. This stateless check
cannot authenticate the declared prior allocation. Unknown fields, models, efforts,
mismatches and legacy schema-version 1 decisions are denied.

Use `fork_turns: "none"` by default. A positive numeric string is allowed only when
the routing JSON includes `context_reason`; `all` is denied. No arbitrary token or
spending cap is imposed.

## Hook configuration

From the source repository, install or merge the project-local hook definition with
this exact command, replacing the argument with the target repository path:

```powershell
node scripts/install-agent-routing.mjs "<repository>"
```

The adjacent installer writes `<repository>/.codex/hooks.json` with absolute hook
commands for that checkout and does not change hook trust. Inspect and trust the
resulting exact definition with `/hooks`. That installed JSON is the review artifact.
The hook accepts paths only through Node's `process.argv`, including an optional
`--audit <absolute-path>`; its default append-only JSONL audit is under the OS temp
directory. Records contain only sanitized session/tool IDs, model, effort, and
policy reasons. This package's hook command does not mutate hook configuration.

Codex supports the `PreToolUse` denial shape emitted here. It also documents that
some specialized tool paths can bypass hooks, project hooks can be disabled or
left untrusted, and command-hook failure is not a protected security boundary.
Multiple matching hooks start concurrently. This cannot control the current parent
model, remote/provider gateways, resumed launches that do not load this hook, or
alternative clients. Protected full coverage requires managed runtime policy or a
model-request gateway outside agent-editable configuration.

## Advisory commands

Check lifecycle state before recommending `/clear`:

```powershell
node scripts/agent-routing/lifecycle-cli.mjs --check-lifecycle lifecycle.json
```

The version 3 manifest records `meaningful_change_revision`,
`checkpoint_revision`, `unresolved_items`, and `active_operations`.
Exit `0` means the declared state is clear-ready, `1` means valid but blocked,
and `2` means invalid input. Readiness requires a fresh checkpoint, no uncaptured
handoff details, and no in-flight operations whose control would be lost. Record
queued tasks, pending verification, approvals and known issues in the checkpoint;
they do not block clearing once the resume state is complete. A stable dev server
is not an in-flight operation merely because it remains listening. Feature/task
completion is tracked separately and is not a clear-readiness condition. Output
contains only counts and generic blocker labels. This checker cannot inspect
checkpoint semantics, discover unrecorded work or invoke `/clear`; the user
retains control of clearing the session.

Check a parent allocation without launching it:

```powershell
node scripts/agent-routing/check.mjs --check decision.json
```

Launch a new, non-resumed `codex exec` with the validated model and effort. The
prompt is read from a file and is never logged by this package:

```powershell
node scripts/agent-routing/launch.mjs --launch decision.json --prompt-file prompt.txt
```

The wrapper uses `node` with the installed `codex.js`, `shell: false`, `--json`, and
no passthrough arguments. Unknown, duplicate, missing-value, resume, and alternate
launch options are rejected. Use `--codex-js <absolute-path>` if Codex is not installed
under `%APPDATA%\npm\node_modules\@openai\codex\bin\codex.js`. It is opt-in and
does not protect other parent launch paths. Codex JSONL is forwarded, including
usage events the runtime emits, but this wrapper does not aggregate complete parent
and descendant totals.

Assess capability preparation:

```powershell
node scripts/agent-routing/capability.mjs --check-capability capability.json
```

Outcomes are `use-installed`, `eligible-install`, `consent-required`, or `fallback`.
An eligible install needs concrete task benefit, pinned source/version, a reviewed
digest claim, `trustedSource` of `openai-curated` or `user-approved`, and false
account-consent, permission-expansion, and network-transmission flags. This only
checks declared metadata; it is not cryptographic verification and never installs
anything. Actual task-driven installation must use the runtime's existing skill or
plugin mechanism and its permission checks. The checker never authorizes arbitrary
remote execution.

For inventory-derived resolution, first capture a fresh runtime inventory and
supply a protected trust policy:

```powershell
node scripts/agent-runtime/inspect.mjs --cwd "<repository>"
node scripts/agent-routing/capability.mjs --resolve-capability request.json --inventory inventory.json --trust-policy trust-policy.json
```

The inspector canonicalizes and hashes each discovered `SKILL.md`, reports its
scope/read failure, and identifies duplicate names. Resolution ignores a caller's
installed-status claim. `use-installed` requires exactly one readable, enabled,
hashed match inside an allowed root. A missing declarative skill is only
`eligible-install` when pinned source, version, digest and trust metadata exactly
match the supplied allowlist and no consent/access/configuration/data/external-
write/executable boundary is declared.

After an authorized installer runs, compare its receipt with fresh inventories:

```powershell
node scripts/agent-routing/capability.mjs --verify-activation receipt.json --before before.json --after after.json --trust-policy trust-policy.json
```

Success is `discovery_verified`: the exact enabled path and instruction hash newly
appear in runtime discovery. `instructions_loaded` remains unverified without a
protected launcher or gateway. These local commands never download or install
code, and an agent-editable trust-policy file is not a protected allowlist.

Run tests with:

```powershell
node --test scripts/agent-routing/evaluator.test.mjs scripts/agent-routing/lifecycle.test.mjs
```
