# Verification: 2026-09-11

Installed identically in Portfolio, Quilter and `D:/Projects/Unity/Mafia Game/MafiaGame`.
Existing product changes and approval gates were preserved.

- Node 24.18.0: all 10 evaluator/CLI/launcher tests passed. Covered malformed
  input, routine expensive-route denial, escalation evidence, stronger initial
  allocation, nested input, history limits, resume context, audit failure/privacy,
  capability eligibility/consent/fallback, and checked parent launch arguments.
- Codex 0.154.0 app-server `hooks/list` and `skills/list` succeeded for all three
  repositories under both `C:/Users/akash/.codex` and `.codex-secondary`.
  Each repository exposes the three expected hooks with no hook parse errors.
  All nine definitions are **untrusted** in each home; normal runtime execution
  is therefore inactive until the user reviews/trusts them using `/hooks`.
- All three project memory checkers passed. No application build or Unity run
  was needed for these tooling-only changes.

Handler tests are not live model-call interception evidence. Actual nested-agent
execution, resume behavior with trusted hooks, and activation after configuration
changes remain unverified. Disabled/untrusted hooks, missing Node/handler modules,
direct CLI/app/provider launches, and parent selection bypass this guard. No
protected fail-closed boundary, spending enforcement, or total-usage aggregator
has been implemented. Agent-supplied evidence is validated structurally, not
independently authenticated. Full governance needs a controlled runtime/request
gateway with credentials and egress outside agent control.

Capability selection/use remains agent-driven. Existing skills were discovered;
the eligibility evaluator was tested, but it is not an automatic remote installer.
No missing capability justified installing a third-party plugin in this task.
End-to-end discovery/install/activation and measured task efficiency remain open.

Official runtime boundary and trust contract:
https://learn.chatgpt.com/docs/hooks

Local raw inventory snapshots are retained in Portfolio's
`.tmp-contour-audit/routing-inventory-primary.json` and
`.tmp-contour-audit/routing-inventory-secondary.json` (not commit artifacts).

## Follow-up: 2026-09-12

- A fresh Portfolio runtime inspection found all three project hooks trusted with
  no hook or skill-discovery errors. This supersedes the earlier untrusted status
  for the inspected repository/home only.
- Runtime skill inventory now records canonical paths, scope, instruction hashes,
  read failures and duplicate names. The live inspection hashed nine enabled
  discovered skills and reported no duplicate names.
- Capability resolution now derives installed state from fresh inventory, fails
  closed for ambiguous/unreadable/outside-root entries, enforces protected
  allowlist and consent boundaries, and verifies post-install discovery receipts.
  It performs no installation and cannot attest that instructions were loaded.
- A lifecycle evaluator now checks declared checkpoint freshness, completion,
  unresolved work and active operations before `/clear` can be recommended. It
  cannot observe undeclared work or invoke `/clear`.
- The combined routing, capability and lifecycle suite passes 22/22 tests; the
  Portfolio memory checker and `git diff --check` pass.
- Routing schema version 2 independently validates model capability demand and
  reasoning-work demand for initial allocation and reassessment. `work_class` is
  descriptive only; all 17 supported model/effort pairs pass with sufficient
  axis-specific declarations. Reassessment derives model-only, effort-only, both,
  or neither, including independently justified downgrades.
