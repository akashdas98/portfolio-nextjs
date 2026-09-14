import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateLifecycle } from "./lifecycle.mjs";

const cliPath = fileURLToPath(new URL("./lifecycle-cli.mjs", import.meta.url));

function lifecycle(overrides = {}) {
  return {
    schema_version: 1,
    meaningful_change_revision: 4,
    checkpoint_revision: 4,
    task_state: "complete",
    unresolved_items: [],
    active_operations: [],
    recommendation_state: "clear-candidate",
    ...overrides,
  };
}

test("a stale checkpoint is not clear-ready", () => {
  const result = evaluateLifecycle(lifecycle({ checkpoint_revision: 3 }));
  assert.equal(result.valid, true);
  assert.equal(result.clear_ready, false);
  assert.equal(result.checks.checkpoint_fresh, false);
  assert.deepEqual(result.blockers, ["checkpoint is stale"]);
});

test("unfinished work and a non-clear recommendation block readiness", () => {
  const result = evaluateLifecycle(lifecycle({
    task_state: "in-progress",
    recommendation_state: "continue",
  }));
  assert.equal(result.clear_ready, false);
  assert.equal(result.checks.task_complete_declared, false);
  assert.match(result.blockers.join("; "), /task is not declared complete/);
  assert.match(result.blockers.join("; "), /semantic clear recommendation/);
});

test("active operations and unresolved items block without exposing their text", () => {
  const secretItem = "private customer detail";
  const secretOperation = "worker handling private repository";
  const result = evaluateLifecycle(lifecycle({
    unresolved_items: [secretItem],
    active_operations: [secretOperation],
  }));
  const output = JSON.stringify(result);
  assert.equal(result.clear_ready, false);
  assert.equal(result.checks.unresolved_item_count, 1);
  assert.equal(result.checks.active_operation_count, 1);
  assert.doesNotMatch(output, new RegExp(secretItem));
  assert.doesNotMatch(output, new RegExp(secretOperation));
});

test("fresh checkpoint with declared completion and no blockers is clear-ready", () => {
  const result = evaluateLifecycle(lifecycle());
  assert.equal(result.valid, true);
  assert.equal(result.status, "clear-ready");
  assert.equal(result.clear_ready, true);
  assert.match(result.advisory, /does not invoke \/clear/);
});

test("malformed manifests are rejected", () => {
  assert.equal(evaluateLifecycle(null).valid, false);
  assert.equal(evaluateLifecycle(lifecycle({ schema_version: 2 })).valid, false);
  assert.equal(evaluateLifecycle(lifecycle({ unexpected: true })).valid, false);
  assert.equal(evaluateLifecycle(lifecycle({ checkpoint_revision: 5 })).valid, false);
  assert.equal(evaluateLifecycle(lifecycle({ unresolved_items: [""] })).valid, false);
});

test("CLI uses distinct ready, blocked, and malformed exit codes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lifecycle-test-"));
  try {
    const readyPath = join(dir, "ready.json");
    const blockedPath = join(dir, "blocked.json");
    const malformedPath = join(dir, "malformed.json");
    await writeFile(readyPath, JSON.stringify(lifecycle()), "utf8");
    await writeFile(blockedPath, JSON.stringify(lifecycle({ active_operations: ["worker-1"] })), "utf8");
    await writeFile(malformedPath, "{", "utf8");

    const ready = spawnSync(process.execPath, [cliPath, "--check-lifecycle", readyPath], {
      encoding: "utf8",
    });
    assert.equal(ready.status, 0, ready.stderr);
    assert.equal(JSON.parse(ready.stdout).status, "clear-ready");

    const blocked = spawnSync(process.execPath, [cliPath, "--check-lifecycle", blockedPath], {
      encoding: "utf8",
    });
    assert.equal(blocked.status, 1, blocked.stderr);
    const blockedOutput = JSON.parse(blocked.stdout);
    assert.equal(blockedOutput.status, "not-clear-ready");
    assert.doesNotMatch(blocked.stdout, /worker-1/);

    const malformed = spawnSync(process.execPath, [cliPath, "--check-lifecycle", malformedPath], {
      encoding: "utf8",
    });
    assert.equal(malformed.status, 2);
    assert.match(malformed.stderr, /Lifecycle manifest invalid/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

