import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  evaluateCapability,
  evaluateCapabilityAgainstInventory,
  evaluateCapabilityDiscovery,
  evaluateDecision,
  evaluatePreToolUse,
  isSpawnAgentTool,
} from "./evaluator.mjs";

const hookPath = fileURLToPath(new URL("./hook.mjs", import.meta.url));
const launchPath = fileURLToPath(new URL("./launch.mjs", import.meta.url));
const capabilityPath = fileURLToPath(new URL("./capability.mjs", import.meta.url));

function routing(overrides = {}) {
  return {
    schema_version: 2,
    scope: "Implement and verify the bounded routing guard.",
    work_class: "implementation",
    uncertainty: "The hook input can use direct or nested arguments.",
    consequences: "A bad decision may start an unsuitable worker.",
    acceptance: ["Pure evaluator and CLI tests pass."],
    model_demand: {
      requirements: ["Substantive implementation across a guarded launch boundary."],
      rationale: "Sol is proportionate to the implementation requirements.",
      evidence: ["The evaluator governs every covered worker launch."],
    },
    effort_demand: {
      reasoning_shape: "Apply a specified schema and verify its boundary cases.",
      rationale: "Medium effort is proportionate to the bounded migration.",
      evidence: [],
    },
    allocation: { phase: "initial", previous: null },
    capabilities: ["node:test"],
    model: "gpt-5.6-sol",
    reasoning_effort: "medium",
    ...overrides,
  };
}

function event(decision = routing(), overrides = {}) {
  return {
    hook_event_name: "PreToolUse",
    tool_name: "spawn_agent",
    session_id: "session-1",
    tool_use_id: "tool-1",
    tool_input: {
      task_name: "worker",
      message: `Do the task.\n<routing>${JSON.stringify(decision)}</routing>`,
      model: decision.model,
      reasoning_effort: decision.reasoning_effort,
      fork_turns: "none",
    },
    ...overrides,
  };
}

function runHook(input, args = []) {
  return spawnSync(process.execPath, [hookPath, ...args], {
    input: typeof input === "string" ? input : JSON.stringify(input),
    encoding: "utf8",
  });
}

test("malformed and unknown routing decisions are denied", () => {
  assert.equal(evaluateDecision(null).allowed, false);
  assert.equal(evaluateDecision(routing({ surprise: true })).allowed, false);
  assert.equal(evaluateDecision(routing({ model: "unknown-model" })).allowed, false);
  assert.equal(evaluateDecision(routing({ work_class: "difficult" })).allowed, false);
});

test("legacy, unsupported, and insufficient axis declarations are denied clearly", () => {
  const legacy = evaluateDecision({
    ...routing(),
    schema_version: 1,
    rationale: "Legacy scalar rationale.",
    evidence: [],
  });
  assert.equal(legacy.allowed, false);
  assert.match(legacy.reasons.join(" "), /schema_version 1 is legacy/);
  assert.equal(evaluateDecision(routing({ model_demand: { ...routing().model_demand, evidence: [] } })).allowed, false);
  assert.equal(evaluateDecision(routing({ reasoning_effort: "high" })).allowed, false);
  assert.equal(evaluateDecision(routing({
    model: "gpt-5.6-luna",
    reasoning_effort: "ultra",
    effort_demand: { ...routing().effort_demand, evidence: ["A concrete blocker exists."] },
  })).allowed, false);
  assert.equal(evaluateDecision(routing({ model_demand: { ...routing().model_demand, surprise: true } })).allowed, false);
  assert.equal(evaluateDecision(routing({ allocation: { phase: "initial", previous: null, surprise: true } })).allowed, false);
  assert.equal(evaluateDecision(routing({
    allocation: {
      phase: "reassessment",
      previous: { model: "gpt-5.6-luna", reasoning_effort: "ultra" },
      trigger: "Reconsider the invalid prior route.",
    },
  })).allowed, false);
});

test("work_class is descriptive and all supported model-effort pairs pass with axis evidence", () => {
  for (const work_class of ["routine", "implementation", "complex"]) {
    for (const model of ["gpt-5.6-luna", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-6-astra"]) {
      for (const reasoning_effort of ["low", "medium", "high", "xhigh", "max", "ultra"]) {
        if (model === "gpt-5.6-luna" && reasoning_effort === "ultra") continue;
        const decision = routing({
          work_class,
          model,
          reasoning_effort,
          effort_demand: {
            ...routing().effort_demand,
            evidence: ["The reasoning trace demonstrates the requested effort demand."],
          },
        });
        const evaluated = evaluateDecision(decision);
        assert.equal(evaluated.allowed, true, `${work_class} ${model} ${reasoning_effort}: ${evaluated.reasons.join("; ")}`);
        assert.equal(evaluated.transition, "initial");
      }
    }
  }
});

test("Terra preserves independent evidence and supports reassessment in both directions", () => {
  const terra = routing({ model: "gpt-5.6-terra" });
  assert.equal(evaluateDecision({ ...terra, model_demand: { ...terra.model_demand, evidence: [] } }).allowed, false);
  assert.equal(evaluateDecision({ ...terra, reasoning_effort: "high" }).allowed, false);
  for (const [model, previousModel] of [["gpt-5.6-terra", "gpt-5.6-sol"], ["gpt-5.6-sol", "gpt-5.6-terra"]]) {
    const decision = routing({ model, allocation: {
      phase: "reassessment",
      previous: { model: previousModel, reasoning_effort: "medium" },
      trigger: "The coding scope now fits the selected capability profile.",
    } });
    const evaluated = evaluateDecision(decision);
    assert.equal(evaluated.allowed, true);
    assert.equal(evaluated.transition, "model-only");
    assert.equal(evaluatePreToolUse(event(decision)).allowed, true);
  }
});

test("initial and all four reassessment transitions validate independently", () => {
  const cases = [
    ["model-only", "gpt-5.6-luna", "medium"],
    ["effort-only", "gpt-5.6-sol", "low"],
    ["both", "gpt-5.6-luna", "low"],
    ["neither", "gpt-5.6-sol", "medium"],
  ];
  assert.equal(evaluateDecision(routing()).transition, "initial");
  for (const [transition, model, reasoning_effort] of cases) {
    const evaluated = evaluateDecision(routing({
      model,
      reasoning_effort,
      allocation: {
        phase: "reassessment",
        previous: { model: "gpt-5.6-sol", reasoning_effort: "medium" },
        trigger: "New evidence changed the allocation assessment.",
      },
      effort_demand: {
        ...routing().effort_demand,
        evidence: ["The completed trace bounds the remaining reasoning demand."],
      },
    }));
    assert.equal(evaluated.allowed, true, evaluated.reasons.join("; "));
    assert.equal(evaluated.transition, transition);
  }
});

test("each changed reassessment axis requires its own evidence, including downgrades", () => {
  const previous = { model: "gpt-6-astra", reasoning_effort: "high" };
  const allocation = { phase: "reassessment", previous, trigger: "Diagnosis is complete." };
  const modelDowngrade = evaluateDecision(routing({
    model: "gpt-5.6-luna",
    reasoning_effort: "high",
    allocation,
    model_demand: { ...routing().model_demand, evidence: [] },
    effort_demand: { ...routing().effort_demand, evidence: ["High effort remains justified."] },
  }));
  assert.equal(modelDowngrade.transition, "model-only");
  assert.equal(modelDowngrade.allowed, false);
  assert.match(modelDowngrade.reasons.join(" "), /model reassessment/);

  const effortDowngrade = evaluateDecision(routing({
    model: "gpt-6-astra",
    reasoning_effort: "medium",
    allocation,
    effort_demand: { ...routing().effort_demand, evidence: [] },
  }));
  assert.equal(effortDowngrade.transition, "effort-only");
  assert.equal(effortDowngrade.allowed, false);
  assert.match(effortDowngrade.reasons.join(" "), /effort reassessment/);
});

test("spawn aliases, one routing block, explicit allocation, and context rules are enforced", () => {
  assert.equal(isSpawnAgentTool("Agent"), true);
  assert.equal(isSpawnAgentTool("functions.collaboration__spawn_agent"), true);
  assert.equal(isSpawnAgentTool("read_file"), false);
  assert.equal(evaluatePreToolUse(event()).allowed, true);
  assert.equal(evaluatePreToolUse(event(routing(), { tool_input: { ...event().tool_input, fork_turns: "all" } })).allowed, false);

  const contextual = routing({ context_reason: "The worker needs the immediately preceding failing trace." });
  assert.equal(evaluatePreToolUse(event(contextual, {
    tool_name: "Agent",
    tool_input: { arguments: JSON.stringify({ ...event(contextual).tool_input, fork_turns: "2" }) },
  })).allowed, true);

  const duplicate = event();
  duplicate.tool_input.message += `<routing>${JSON.stringify(routing())}</routing>`;
  assert.equal(evaluatePreToolUse(duplicate).allowed, false);
  const missing = event();
  missing.tool_input.message = "No routing decision.";
  assert.equal(evaluatePreToolUse(missing).allowed, false);
});

test("unrelated calls pass and malformed hook JSON is denied", () => {
  const unrelated = runHook({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: {} });
  assert.equal(unrelated.status, 0);
  assert.equal(unrelated.stdout, "");
  const malformed = runHook("{");
  assert.equal(JSON.parse(malformed.stdout).hookSpecificOutput.permissionDecision, "deny");
});

test("resume gets parent context", () => {
  const response = runHook({ hook_event_name: "SessionStart", source: "resume", session_id: "s", cwd: "." });
  const output = JSON.parse(response.stdout);
  assert.equal(output.hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(output.hookSpecificOutput.additionalContext, /adaptive routing/);
  assert.match(output.hookSpecificOutput.additionalContext, /trusted reviewed source/);
  assert.match(output.hookSpecificOutput.additionalContext, /recommend \/clear/);
  assert.match(output.hookSpecificOutput.additionalContext, /model and reasoning effort independently/);
  assert.match(output.hookSpecificOutput.additionalContext, /schema version 2/);
  const promptResponse = runHook({
    hook_event_name: "UserPromptSubmit",
    prompt: "Implement the task.",
    session_id: "s",
    cwd: ".",
  });
  assert.equal(JSON.parse(promptResponse.stdout).hookSpecificOutput.hookEventName, "UserPromptSubmit");
});

test("targeted logging failure denies; successful audit contains no prompt", async () => {
  const dir = await mkdtemp(join(tmpdir(), "routing-test-"));
  try {
    const failed = runHook(event(), ["--audit", dir]);
    assert.equal(JSON.parse(failed.stdout).hookSpecificOutput.permissionDecision, "deny");
    assert.match(failed.stdout, /audit write failed/);

    const auditPath = join(dir, "audit.jsonl");
    const passed = runHook(event(routing({ model: "gpt-5.6-terra" })), ["--audit", auditPath]);
    assert.equal(passed.stdout, "");
    const record = JSON.parse(await readFile(auditPath, "utf8"));
    assert.equal(record.model, "gpt-5.6-terra");
    assert.deepEqual(Object.keys(record), ["session_id", "tool_use_id", "model", "reasoning_effort", "reasons"]);
    assert.doesNotMatch(JSON.stringify(record), /Do the task/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

function capability(overrides = {}) {
  return {
    capability: "a reviewed reusable formatter",
    status: "missing",
    task_benefit: "It removes repeated manual formatting from this task.",
    source: "openai-curated/formatter",
    version: "1.2.3",
    reviewed_digest: "sha256:review-record-123",
    trustedSource: "openai-curated",
    account_consent: false,
    permissions_expansion: false,
    network_transmission: false,
    ...overrides,
  };
}

test("capability decisions cover discovery, eligibility, consent, and fallback", () => {
  assert.equal(evaluateCapability(capability({ status: "installed" })).outcome, "use-installed");
  assert.equal(evaluateCapability(capability()).outcome, "eligible-install");
  assert.equal(evaluateCapability(capability({ account_consent: true })).outcome, "consent-required");
  assert.equal(evaluateCapability(capability({ status: "installed", account_consent: true })).outcome, "consent-required");
  assert.equal(evaluateCapability(capability({ status: "unavailable" })).outcome, "fallback");
  assert.equal(evaluateCapability(capability({ source: undefined })).outcome, "fallback");
});

const reviewedDigest = `sha256:${"a".repeat(64)}`;
const instructionDigest = `sha256:${"b".repeat(64)}`;

function capabilityRequest(overrides = {}) {
  return {
    schema_version: 1,
    kind: "skill",
    capability: "visual-design",
    cwd: "C:/work/project",
    status: "installed",
    task_benefit: "The task requires the installed visual design instructions.",
    source: "openai-curated/visual-design",
    version: "1.2.3",
    reviewed_digest: reviewedDigest,
    trustedSource: "openai-curated",
    account_consent: false,
    permissions_expansion: false,
    network_transmission: false,
    credentials: false,
    protected_config_write: false,
    external_write: false,
    executable_payload: false,
    ...overrides,
  };
}

function skillInventory(available = [], overrides = {}) {
  return {
    status: "ok",
    skills: [{ cwd: "C:/work/project", available }],
    ...overrides,
  };
}

function trustPolicy(overrides = {}) {
  return {
    allowedSources: [{
      kind: "skill",
      source: "openai-curated/visual-design",
      version: "1.2.3",
      reviewed_digest: reviewedDigest,
      trustedSource: "openai-curated",
      declarative: true,
    }],
    allowedRoots: ["C:/work/project/.codex/skills"],
    ...overrides,
  };
}

test("inventory-derived resolution ignores spoofed status and uses one enabled match", () => {
  const request = capabilityRequest();
  const missing = evaluateCapabilityAgainstInventory(request, skillInventory(), trustPolicy());
  assert.equal(missing.outcome, "eligible-install");

  const installed = evaluateCapabilityAgainstInventory(request, skillInventory([{
    name: "visual-design",
    path: "C:/work/project/.codex/skills/visual-design/SKILL.md",
    canonicalPath: "C:/work/project/.codex/skills/visual-design/SKILL.md",
    instructionSha256: instructionDigest,
    readError: null,
    enabled: true,
  }]), trustPolicy());
  assert.equal(installed.outcome, "use-installed");
  assert.equal(installed.selected.name, "visual-design");

  const outsideRoot = evaluateCapabilityAgainstInventory(request, skillInventory([{
    name: "visual-design",
    path: "C:/outside/visual-design/SKILL.md",
    canonicalPath: "C:/outside/visual-design/SKILL.md",
    instructionSha256: instructionDigest,
    readError: null,
    enabled: true,
  }]), trustPolicy());
  assert.equal(outsideRoot.outcome, "fallback");

  const ambiguous = evaluateCapabilityAgainstInventory(request, skillInventory([
    { name: "visual-design", path: "C:/one/SKILL.md", enabled: true },
    { name: "visual-design", path: "C:/two/SKILL.md", enabled: true },
  ]), trustPolicy());
  assert.equal(ambiguous.outcome, "fallback");
});

test("resolver requires protected exact metadata and fails closed on consent boundaries", () => {
  assert.equal(evaluateCapabilityAgainstInventory(
    capabilityRequest({ executable_payload: true }), skillInventory(), trustPolicy(),
  ).outcome, "consent-required");
  assert.equal(evaluateCapabilityAgainstInventory(
    capabilityRequest({ protected_config_write: true }), skillInventory(), trustPolicy(),
  ).outcome, "consent-required");
  assert.equal(evaluateCapabilityAgainstInventory(
    capabilityRequest({ reviewed_digest: "sha256:not-a-digest" }), skillInventory(), trustPolicy(),
  ).outcome, "fallback");
  assert.equal(evaluateCapabilityAgainstInventory(
    capabilityRequest(), skillInventory(), trustPolicy({ allowedSources: [] }),
  ).outcome, "fallback");
  assert.equal(evaluateCapabilityAgainstInventory(
    capabilityRequest(), skillInventory([], { status: "error" }), trustPolicy(),
  ).outcome, "fallback");
});

function installReceipt(overrides = {}) {
  return {
    schema_version: 1,
    capability: "visual-design",
    cwd: "C:/work/project",
    source: "openai-curated/visual-design",
    version: "1.2.3",
    reviewed_digest: reviewedDigest,
    trustedSource: "openai-curated",
    installedPath: "C:/work/project/.codex/skills/visual-design/SKILL.md",
    instructionSha256: instructionDigest,
    ...overrides,
  };
}

test("discovery verification requires an absent-before exact enabled path and hash match", () => {
  const receipt = installReceipt();
  const exactAfter = skillInventory([{
    name: "visual-design",
    path: receipt.installedPath,
    canonicalPath: receipt.installedPath,
    enabled: true,
    instructionSha256: instructionDigest,
  }]);
  const verified = evaluateCapabilityDiscovery(receipt, skillInventory(), exactAfter, trustPolicy());
  assert.equal(verified.outcome, "discovery_verified");
  assert.equal(verified.discovery_verified, true);
  assert.equal(verified.instructions_loaded, "unverified");

  const wrongHash = structuredClone(exactAfter);
  wrongHash.skills[0].available[0].instructionSha256 = reviewedDigest;
  assert.equal(evaluateCapabilityDiscovery(receipt, skillInventory(), wrongHash, trustPolicy()).outcome, "fallback");
  assert.equal(evaluateCapabilityDiscovery(receipt, exactAfter, exactAfter, trustPolicy()).outcome, "fallback");
  assert.equal(evaluateCapabilityDiscovery(
    installReceipt({ installedPath: "C:/outside/visual-design/SKILL.md" }),
    skillInventory(), exactAfter, trustPolicy(),
  ).outcome, "fallback");
});

test("new resolver CLI has distinct success, consent, fallback, and invalid exit codes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "capability-resolver-test-"));
  try {
    const requestPath = join(dir, "request.json");
    const inventoryPath = join(dir, "inventory.json");
    const policyPath = join(dir, "policy.json");
    await writeFile(requestPath, JSON.stringify(capabilityRequest()), "utf8");
    await writeFile(inventoryPath, JSON.stringify(skillInventory()), "utf8");
    await writeFile(policyPath, JSON.stringify(trustPolicy()), "utf8");
    const args = ["--resolve-capability", requestPath, "--inventory", inventoryPath, "--trust-policy", policyPath];
    const eligible = spawnSync(process.execPath, [capabilityPath, ...args], { encoding: "utf8" });
    assert.equal(eligible.status, 0, eligible.stderr);
    assert.equal(JSON.parse(eligible.stdout).outcome, "eligible-install");

    await writeFile(requestPath, JSON.stringify(capabilityRequest({ credentials: true })), "utf8");
    assert.equal(spawnSync(process.execPath, [capabilityPath, ...args]).status, 3);
    await writeFile(policyPath, JSON.stringify(trustPolicy({ allowedSources: [] })), "utf8");
    await writeFile(requestPath, JSON.stringify(capabilityRequest()), "utf8");
    assert.equal(spawnSync(process.execPath, [capabilityPath, ...args]).status, 4);
    assert.equal(spawnSync(process.execPath, [capabilityPath, "--resolve-capability", requestPath]).status, 2);

    const legacyPath = join(dir, "legacy.json");
    await writeFile(legacyPath, JSON.stringify(capability()), "utf8");
    const legacyResult = spawnSync(process.execPath, [capabilityPath, "--check-capability", legacyPath], { encoding: "utf8" });
    assert.equal(legacyResult.status, 0, legacyResult.stderr);
    assert.equal(JSON.parse(legacyResult.stdout).outcome, "eligible-install");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("parent launcher validates then passes fixed model, effort, JSON mode, and prompt via stdin", async () => {
  const dir = await mkdtemp(join(tmpdir(), "routing-launch-test-"));
  try {
    const decisionPath = join(dir, "decision.json");
    const promptPath = join(dir, "prompt.txt");
    const stubPath = join(dir, "codex.js");
    const capturePath = join(dir, "capture.json");
    await writeFile(decisionPath, JSON.stringify(routing()), "utf8");
    await writeFile(promptPath, "Stubbed parent task.", "utf8");
    await writeFile(stubPath, [
      'import { writeFileSync } from "node:fs";',
      'let input = "";',
      'process.stdin.setEncoding("utf8");',
      'for await (const chunk of process.stdin) input += chunk;',
      'writeFileSync(process.env.ROUTING_STUB_CAPTURE, JSON.stringify({ args: process.argv.slice(2), input }));',
    ].join("\n"), "utf8");
    const launched = spawnSync(process.execPath, [
      launchPath,
      "--launch", decisionPath,
      "--prompt-file", promptPath,
      "--codex-js", stubPath,
    ], {
      encoding: "utf8",
      env: { ...process.env, ROUTING_STUB_CAPTURE: capturePath },
    });
    assert.equal(launched.status, 0, launched.stderr);
    const capture = JSON.parse(await readFile(capturePath, "utf8"));
    assert.deepEqual(capture.args, [
      "exec", "--model", "gpt-5.6-sol", "--config", 'model_reasoning_effort="medium"', "--json", "-",
    ]);
    assert.equal(capture.input, "Stubbed parent task.");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("parent launcher rejects bad routes and alternate launch options before spawning", async () => {
  const dir = await mkdtemp(join(tmpdir(), "routing-launch-deny-test-"));
  try {
    const decisionPath = join(dir, "decision.json");
    const promptPath = join(dir, "prompt.txt");
    const stubPath = join(dir, "codex.js");
    const capturePath = join(dir, "capture.txt");
    await writeFile(decisionPath, JSON.stringify(routing({
      model_demand: { ...routing().model_demand, evidence: [] },
    })), "utf8");
    await writeFile(promptPath, "Must not launch.", "utf8");
    await writeFile(stubPath, 'import { writeFileSync } from "node:fs"; writeFileSync(process.env.ROUTING_STUB_CAPTURE, "spawned");', "utf8");
    const common = ["--launch", decisionPath, "--prompt-file", promptPath, "--codex-js", stubPath];
    const denied = spawnSync(process.execPath, [launchPath, ...common], {
      encoding: "utf8",
      env: { ...process.env, ROUTING_STUB_CAPTURE: capturePath },
    });
    assert.equal(denied.status, 2);
    await assert.rejects(readFile(capturePath));

    const alternate = spawnSync(process.execPath, [launchPath, ...common, "--resume", "last"], {
      encoding: "utf8",
      env: { ...process.env, ROUTING_STUB_CAPTURE: capturePath },
    });
    assert.equal(alternate.status, 2);
    assert.match(alternate.stderr, /unknown option: --resume/);
    await assert.rejects(readFile(capturePath));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
