const MODEL_CLASS = Object.freeze({
  "gpt-6-luna": "luna",
  "gpt-6-sol": "sol",
  "gpt-6-astra": "astra",
});

export const SUPPORTED_MODELS = Object.freeze(Object.keys(MODEL_CLASS));

const EFFORTS = new Set(["low", "medium", "high", "xhigh", "max", "ultra"]);
const HIGH_EFFORTS = new Set(["high", "xhigh", "max", "ultra"]);
const WORK_CLASSES = new Set(["routine", "implementation", "complex"]);
const ROUTING_FIELDS = new Set([
  "schema_version",
  "scope",
  "work_class",
  "uncertainty",
  "consequences",
  "acceptance",
  "model_demand",
  "effort_demand",
  "allocation",
  "capabilities",
  "context_reason",
  "model",
  "reasoning_effort",
]);
const MODEL_DEMAND_FIELDS = new Set(["requirements", "rationale", "evidence"]);
const EFFORT_DEMAND_FIELDS = new Set(["reasoning_shape", "rationale", "evidence"]);
const ALLOCATION_FIELDS = new Set(["phase", "previous", "trigger"]);
const PREVIOUS_ALLOCATION_FIELDS = new Set(["model", "reasoning_effort"]);

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function stringArray(value, { allowEmpty = false } = {}) {
  return (
    Array.isArray(value) &&
    (allowEmpty || value.length > 0) &&
    value.every(nonEmptyString)
  );
}

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unknownFields(value, allowedFields, label, reasons) {
  if (!plainObject(value)) return;
  const unknown = Object.keys(value).filter((key) => !allowedFields.has(key));
  if (unknown.length) reasons.push(`${label} contains unknown field(s)`);
}

function result(reasons, transition = null) {
  return { allowed: reasons.length === 0, reasons, transition };
}

/** Pure validation of a routing decision, including its requested allocation. */
export function evaluateDecision(decision) {
  const reasons = [];
  if (!plainObject(decision)) {
    return result(["routing decision must be a JSON object"]);
  }

  const unknown = Object.keys(decision).filter((key) => !ROUTING_FIELDS.has(key));
  if (unknown.length) reasons.push("routing decision contains unknown field(s)");

  if (decision.schema_version === 1) {
    reasons.push("routing schema_version 1 is legacy; schema_version 2 is required");
  } else if (decision.schema_version !== 2) {
    reasons.push("schema_version must be 2");
  }
  for (const field of ["scope", "uncertainty", "consequences"]) {
    if (!nonEmptyString(decision[field])) reasons.push(`${field} must be a non-empty string`);
  }
  if (!WORK_CLASSES.has(decision.work_class)) reasons.push("unknown or missing work_class");
  if (!stringArray(decision.acceptance)) reasons.push("acceptance must be a non-empty string array");
  if (!stringArray(decision.capabilities, { allowEmpty: true })) reasons.push("capabilities must be a string array");
  if (decision.context_reason !== undefined && !nonEmptyString(decision.context_reason)) {
    reasons.push("context_reason must be a non-empty string when present");
  }

  if (!plainObject(decision.model_demand)) {
    reasons.push("model_demand must be an object");
  } else {
    unknownFields(decision.model_demand, MODEL_DEMAND_FIELDS, "model_demand", reasons);
    if (!stringArray(decision.model_demand.requirements)) {
      reasons.push("model_demand.requirements must be a non-empty string array");
    }
    if (!nonEmptyString(decision.model_demand.rationale)) {
      reasons.push("model_demand.rationale must be a non-empty string");
    }
    if (!stringArray(decision.model_demand.evidence, { allowEmpty: true })) {
      reasons.push("model_demand.evidence must be a string array");
    }
  }

  if (!plainObject(decision.effort_demand)) {
    reasons.push("effort_demand must be an object");
  } else {
    unknownFields(decision.effort_demand, EFFORT_DEMAND_FIELDS, "effort_demand", reasons);
    if (!nonEmptyString(decision.effort_demand.reasoning_shape)) {
      reasons.push("effort_demand.reasoning_shape must be a non-empty string");
    }
    if (!nonEmptyString(decision.effort_demand.rationale)) {
      reasons.push("effort_demand.rationale must be a non-empty string");
    }
    if (!stringArray(decision.effort_demand.evidence, { allowEmpty: true })) {
      reasons.push("effort_demand.evidence must be a string array");
    }
  }

  const modelClass = MODEL_CLASS[decision.model];
  if (!modelClass) reasons.push("unknown or missing model");
  if (!EFFORTS.has(decision.reasoning_effort)) reasons.push("unknown or missing reasoning_effort");

  const hasModelEvidence = stringArray(decision.model_demand?.evidence);
  const hasEffortEvidence = stringArray(decision.effort_demand?.evidence);
  if (modelClass && modelClass !== "luna" && !hasModelEvidence) {
    reasons.push("non-Luna model requires model_demand evidence");
  }
  if (HIGH_EFFORTS.has(decision.reasoning_effort) && !hasEffortEvidence) {
    reasons.push("high-or-greater reasoning effort requires effort_demand evidence");
  }

  if (modelClass === "luna" && decision.reasoning_effort === "ultra") {
    reasons.push("Luna does not support ultra reasoning effort");
  }

  let transition = null;
  if (!plainObject(decision.allocation)) {
    reasons.push("allocation must be an object");
  } else {
    unknownFields(decision.allocation, ALLOCATION_FIELDS, "allocation", reasons);
    if (decision.allocation.phase === "initial") {
      transition = "initial";
      if (decision.allocation.previous !== null) {
        reasons.push("initial allocation.previous must be null");
      }
      if (decision.allocation.trigger !== undefined) {
        reasons.push("initial allocation must not include trigger");
      }
    } else if (decision.allocation.phase === "reassessment") {
      if (!plainObject(decision.allocation.previous)) {
        reasons.push("reassessment allocation.previous must be an object");
      } else {
        const previous = decision.allocation.previous;
        unknownFields(previous, PREVIOUS_ALLOCATION_FIELDS, "allocation.previous", reasons);
        if (!MODEL_CLASS[previous.model]) reasons.push("allocation.previous has unknown or missing model");
        if (!EFFORTS.has(previous.reasoning_effort)) {
          reasons.push("allocation.previous has unknown or missing reasoning_effort");
        }
        if (MODEL_CLASS[previous.model] === "luna" && previous.reasoning_effort === "ultra") {
          reasons.push("allocation.previous uses unsupported Luna ultra reasoning effort");
        }
        if (MODEL_CLASS[previous.model] && EFFORTS.has(previous.reasoning_effort)) {
          const modelChanged = previous.model !== decision.model;
          const effortChanged = previous.reasoning_effort !== decision.reasoning_effort;
          transition = modelChanged && effortChanged
            ? "both"
            : modelChanged
              ? "model-only"
              : effortChanged
                ? "effort-only"
                : "neither";
          if (modelChanged && !hasModelEvidence) {
            reasons.push("model reassessment requires model_demand evidence for a changed model");
          }
          if (effortChanged && !hasEffortEvidence) {
            reasons.push("effort reassessment requires effort_demand evidence for changed reasoning effort");
          }
        }
      }
      if (!nonEmptyString(decision.allocation.trigger)) {
        reasons.push("reassessment allocation.trigger must be a non-empty string");
      }
    } else {
      reasons.push("allocation.phase must be initial or reassessment");
    }
  }

  return result(reasons, transition);
}

export function isSpawnAgentTool(toolName) {
  if (!nonEmptyString(toolName)) return false;
  return /(?:^|[.:/]|__)spawn_agent$/i.test(toolName.trim()) || /^agent$/i.test(toolName.trim());
}

function unwrapToolInput(toolInput) {
  if (!toolInput || typeof toolInput !== "object" || Array.isArray(toolInput)) return toolInput;
  if ("message" in toolInput || "model" in toolInput || "reasoning_effort" in toolInput) return toolInput;
  for (const key of ["arguments", "args", "input"]) {
    if (!(key in toolInput)) continue;
    const nested = toolInput[key];
    if (typeof nested === "string") {
      try {
        return JSON.parse(nested);
      } catch {
        return nested;
      }
    }
    return nested;
  }
  return toolInput;
}

export function parseRoutingTag(message) {
  if (typeof message !== "string") return { error: "worker message must be a string" };
  const matches = [...message.matchAll(/<routing>([\s\S]*?)<\/routing>/g)];
  if (matches.length !== 1) return { error: "worker message must contain exactly one <routing>{JSON}</routing> block" };
  try {
    return { decision: JSON.parse(matches[0][1]) };
  } catch {
    return { error: "routing block must contain valid JSON" };
  }
}

/** Pure evaluator for a PreToolUse event. Unrelated tools pass unchanged. */
export function evaluatePreToolUse(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return { targeted: false, allowed: false, reasons: ["hook input must be a JSON object"] };
  }
  if (!nonEmptyString(event.tool_name)) {
    return { targeted: true, allowed: false, reasons: ["PreToolUse input is missing tool_name"] };
  }
  if (!isSpawnAgentTool(event.tool_name)) return { targeted: false, allowed: true, reasons: [] };

  const input = unwrapToolInput(event.tool_input);
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { targeted: true, allowed: false, reasons: ["spawn_agent tool_input must be an object"] };
  }

  const reasons = [];
  if (!nonEmptyString(input.model)) reasons.push("spawn_agent requires an explicit model");
  if (!nonEmptyString(input.reasoning_effort)) reasons.push("spawn_agent requires an explicit reasoning_effort");

  const parsed = parseRoutingTag(input.message);
  if (parsed.error) reasons.push(parsed.error);
  else {
    const checked = evaluateDecision(parsed.decision);
    reasons.push(...checked.reasons);
    if (parsed.decision.model !== input.model) reasons.push("routing model must match spawn_agent model");
    if (parsed.decision.reasoning_effort !== input.reasoning_effort) {
      reasons.push("routing reasoning_effort must match spawn_agent reasoning_effort");
    }
  }

  if (input.fork_turns === "all") {
    reasons.push("fork_turns all is disallowed");
  } else if (input.fork_turns === "none") {
    // Preferred zero-history handoff.
  } else if (typeof input.fork_turns === "string" && /^[1-9]\d*$/.test(input.fork_turns)) {
    if (!parsed.decision || !nonEmptyString(parsed.decision.context_reason)) {
      reasons.push("positive numeric fork_turns requires routing context_reason");
    }
  } else {
    reasons.push("fork_turns must be none or a positive numeric history count");
  }

  return {
    targeted: true,
    allowed: reasons.length === 0,
    reasons,
    model: nonEmptyString(input.model) ? input.model : "unknown",
    reasoning_effort: nonEmptyString(input.reasoning_effort) ? input.reasoning_effort : "unknown",
  };
}

export const PARENT_POLICY = [
  "Use adaptive routing for each meaningful handoff: choose installed skills, tools, integrations, and reusable scripts before adding capability.",
  "For this repository, use docs/agent/delegation-system.md as the decision and future-upgrade entrypoint. First assess the task's capability, reasoning work, consequences, and reviewability; then compare viable GPT-6 model-effort pairs using relevant benchmarks and completed-task evidence. Benchmarks do not classify task difficulty.",
  "Select model and reasoning effort independently for the initial route and every reassessment. At reassessment, evaluate the remaining work from new task evidence before comparing viable pairs; a benchmark crossing alone is not a trigger. Model choice addresses capability profile and ceiling; effort addresses inference depth, search, branching, and verification within that model. Work class is descriptive, not an allocation ladder; stronger models do not imply higher effort, and higher effort cannot substitute for a capability mismatch.",
  "Use routing schema version 2 with separate model_demand and effort_demand reasons and evidence. Reassess model-only, effort-only, both, or neither as evidence changes, including independent downgrades after diagnosis.",
  "Do not force a cheap-model failure before an appropriate stronger initial allocation, and do not claim token or cost savings without measured completed-task evidence.",
  "Discover a missing capability only when task-relevant. Auto-install only from a trusted reviewed source when the task justifies it and no credentials, account consent, protected configuration, or external-write permission is required.",
  "Preserve user scope, project requirements, permissions, and acceptance checks. If a capability is unavailable, report the limit and use the best in-scope fallback.",
  "Checkpoint durable state after meaningful changes. At a completed or safely handed-off boundary, recommend /clear only when prior context is disposable and lifecycle readiness confirms a fresh checkpoint with no unresolved items or active operations; only the user invokes /clear.",
  "Before spawn_agent, include exactly one <routing>{JSON}</routing> block in its message and explicitly set model, reasoning_effort, and fork_turns per the routing guard contract.",
].join(" ");

const CAPABILITY_FIELDS = new Set([
  "capability",
  "status",
  "task_benefit",
  "source",
  "version",
  "reviewed_digest",
  "trustedSource",
  "account_consent",
  "permissions_expansion",
  "network_transmission",
]);

/** Pure eligibility assessment. It never installs or connects a capability. */
export function evaluateCapability(decision) {
  const reasons = [];
  if (!decision || typeof decision !== "object" || Array.isArray(decision)) {
    return { valid: false, outcome: "fallback", reasons: ["capability decision must be a JSON object"] };
  }
  const unknown = Object.keys(decision).filter((key) => !CAPABILITY_FIELDS.has(key));
  if (unknown.length) reasons.push(`unknown capability field(s): ${unknown.join(", ")}`);
  if (!nonEmptyString(decision.capability)) reasons.push("capability must be a non-empty string");
  if (!nonEmptyString(decision.task_benefit)) reasons.push("task_benefit must state a concrete benefit");
  if (!["installed", "missing", "unavailable"].includes(decision.status)) {
    reasons.push("status must be installed, missing, or unavailable");
  }
  for (const field of ["account_consent", "permissions_expansion", "network_transmission"]) {
    if (typeof decision[field] !== "boolean") reasons.push(`${field} must be boolean`);
  }
  if (decision.trustedSource !== undefined && !["openai-curated", "user-approved"].includes(decision.trustedSource)) {
    reasons.push("trustedSource must be openai-curated or user-approved");
  }

  if (reasons.length) return { valid: false, outcome: "fallback", reasons };
  if (decision.status === "unavailable") {
    return { valid: true, outcome: "fallback", reasons: ["capability is unavailable"] };
  }
  if (decision.account_consent || decision.permissions_expansion || decision.network_transmission) {
    return {
      valid: true,
      outcome: "consent-required",
      reasons: ["installation or activation requires consent, expanded permissions, or network transmission"],
    };
  }
  if (decision.status === "installed") {
    return { valid: true, outcome: "use-installed", reasons: ["installed capability has a stated task benefit"] };
  }

  const metadataProblems = [];
  if (!nonEmptyString(decision.source)) metadataProblems.push("a pinned source is required");
  if (!nonEmptyString(decision.version) || /^(?:latest|next|\*)$/i.test(decision.version.trim())) {
    metadataProblems.push("a pinned version is required");
  }
  if (!nonEmptyString(decision.reviewed_digest)) metadataProblems.push("a reviewed digest is required");
  if (!["openai-curated", "user-approved"].includes(decision.trustedSource)) {
    metadataProblems.push("a trustedSource claim is required");
  }
  if (metadataProblems.length) return { valid: true, outcome: "fallback", reasons: metadataProblems };
  return {
    valid: true,
    outcome: "eligible-install",
    reasons: ["metadata is pinned and reviewed, with no consent or permission expansion indicated"],
  };
}

const RESOLVER_FIELDS = new Set([
  "schema_version",
  "kind",
  "capability",
  "cwd",
  "status",
  "task_benefit",
  "source",
  "version",
  "reviewed_digest",
  "trustedSource",
  "account_consent",
  "permissions_expansion",
  "network_transmission",
  "credentials",
  "protected_config_write",
  "external_write",
  "executable_payload",
]);
const CONSENT_FIELDS = [
  "account_consent",
  "permissions_expansion",
  "network_transmission",
  "credentials",
  "protected_config_write",
  "external_write",
  "executable_payload",
];
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;

function normalizedPath(value) {
  if (!nonEmptyString(value)) return undefined;
  return value.trim().replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function pathWithin(path, root) {
  const candidate = normalizedPath(path);
  const boundary = normalizedPath(root);
  return Boolean(candidate && boundary && (candidate === boundary || candidate.startsWith(`${boundary}/`)));
}

function inventorySkills(inventory, cwd) {
  if (!inventory || typeof inventory !== "object" || Array.isArray(inventory)) {
    return { error: "inventory must be a JSON object" };
  }
  if (inventory.status !== "ok") return { unavailable: true, reason: "runtime inventory is unavailable" };
  if (!Array.isArray(inventory.skills)) return { error: "inventory skills must be an array" };
  const wantedCwd = normalizedPath(cwd);
  const groups = inventory.skills.filter((entry) => normalizedPath(entry?.cwd) === wantedCwd);
  if (groups.length !== 1 || !Array.isArray(groups[0].available)) {
    return { unavailable: true, reason: "runtime inventory has no unique skill group for cwd" };
  }
  return { skills: groups[0].available };
}

function exactTrustEntry(request, trustPolicy) {
  if (!trustPolicy || typeof trustPolicy !== "object" || Array.isArray(trustPolicy)) return undefined;
  if (!Array.isArray(trustPolicy.allowedSources)) return undefined;
  return trustPolicy.allowedSources.find((entry) => (
    entry?.kind === request.kind
    && entry?.source === request.source
    && entry?.version === request.version
    && entry?.reviewed_digest === request.reviewed_digest
    && entry?.trustedSource === request.trustedSource
    && entry?.declarative === true
  ));
}

function validateResolverRequest(request) {
  const reasons = [];
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    return ["capability request must be a JSON object"];
  }
  const unknown = Object.keys(request).filter((key) => !RESOLVER_FIELDS.has(key));
  if (unknown.length) reasons.push(`unknown capability request field(s): ${unknown.join(", ")}`);
  if (request.schema_version !== 1) reasons.push("schema_version must be 1");
  if (request.kind !== "skill") reasons.push("kind must be skill");
  for (const field of ["capability", "cwd", "task_benefit"]) {
    if (!nonEmptyString(request[field])) reasons.push(`${field} must be a non-empty string`);
  }
  for (const field of CONSENT_FIELDS) {
    if (typeof request[field] !== "boolean") reasons.push(`${field} must be boolean`);
  }
  return reasons;
}

/** Resolve a skill against fresh runtime inventory. Caller-declared status is ignored. */
export function evaluateCapabilityAgainstInventory(request, inventory, trustPolicy) {
  const reasons = validateResolverRequest(request);
  if (reasons.length) return { valid: false, outcome: "fallback", reasons };

  if (CONSENT_FIELDS.some((field) => request[field])) {
    return {
      valid: true,
      outcome: "consent-required",
      reasons: ["capability requires consent, access, configuration, transmission, external writes, or executable content"],
    };
  }

  const selected = inventorySkills(inventory, request.cwd);
  if (selected.error) return { valid: false, outcome: "fallback", reasons: [selected.error] };
  if (selected.unavailable) return { valid: true, outcome: "fallback", reasons: [selected.reason] };
  const matches = selected.skills.filter((skill) => skill?.name === request.capability);
  const match = matches[0];
  const installedPath = match?.canonicalPath || match?.path;
  const allowedInstalledRoot = Array.isArray(trustPolicy?.allowedRoots)
    && trustPolicy.allowedRoots.some((root) => pathWithin(installedPath, root));
  if (
    matches.length === 1
    && match.enabled === true
    && nonEmptyString(match.canonicalPath)
    && SHA256_PATTERN.test(match.instructionSha256 || "")
    && (match.readError === null || match.readError === undefined)
    && allowedInstalledRoot
  ) {
    return {
      valid: true,
      outcome: "use-installed",
      reasons: ["runtime inventory contains one readable enabled matching skill in a protected root"],
      selected: {
        name: match.name,
        path: match.canonicalPath,
        instructionSha256: match.instructionSha256,
      },
    };
  }
  if (matches.length) {
    return {
      valid: true,
      outcome: "fallback",
      reasons: ["matching skill is disabled, ambiguous, unreadable, unhashed, or outside protected roots"],
    };
  }

  const metadataProblems = [];
  if (!nonEmptyString(request.source)) metadataProblems.push("a pinned source is required");
  if (!nonEmptyString(request.version) || /^(?:latest|next|\*)$/i.test(request.version?.trim())) {
    metadataProblems.push("a pinned version is required");
  }
  if (!SHA256_PATTERN.test(request.reviewed_digest || "")) {
    metadataProblems.push("reviewed_digest must be a lowercase sha256 digest");
  }
  if (!exactTrustEntry(request, trustPolicy)) {
    metadataProblems.push("source, version, digest, trust, and declarative type must match the protected allowlist");
  }
  if (metadataProblems.length) return { valid: true, outcome: "fallback", reasons: metadataProblems };

  const legacy = evaluateCapability({
    capability: request.capability,
    status: "missing",
    task_benefit: request.task_benefit,
    source: request.source,
    version: request.version,
    reviewed_digest: request.reviewed_digest,
    trustedSource: request.trustedSource,
    account_consent: false,
    permissions_expansion: false,
    network_transmission: false,
  });
  return { ...legacy, reasons: ["missing declarative skill exactly matches the protected allowlist"] };
}

const RECEIPT_FIELDS = new Set([
  "schema_version", "capability", "cwd", "source", "version", "reviewed_digest",
  "trustedSource", "installedPath", "instructionSha256",
]);

/** Verify runtime discovery after installation; this does not prove semantic activation. */
export function evaluateCapabilityDiscovery(receipt, beforeInventory, afterInventory, trustPolicy) {
  const reasons = [];
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    return { valid: false, outcome: "fallback", discovery_verified: false, instructions_loaded: "unverified", reasons: ["receipt must be a JSON object"] };
  }
  const unknown = Object.keys(receipt).filter((key) => !RECEIPT_FIELDS.has(key));
  if (unknown.length) reasons.push(`unknown receipt field(s): ${unknown.join(", ")}`);
  if (receipt.schema_version !== 1) reasons.push("schema_version must be 1");
  for (const field of ["capability", "cwd", "source", "version", "reviewed_digest", "trustedSource", "installedPath", "instructionSha256"]) {
    if (!nonEmptyString(receipt[field])) reasons.push(`${field} must be a non-empty string`);
  }
  if (!SHA256_PATTERN.test(receipt.reviewed_digest || "")) reasons.push("reviewed_digest must be a lowercase sha256 digest");
  if (!SHA256_PATTERN.test(receipt.instructionSha256 || "")) reasons.push("instructionSha256 must be a lowercase sha256 digest");
  const request = { ...receipt, kind: "skill" };
  if (!exactTrustEntry(request, trustPolicy)) reasons.push("receipt does not match the protected allowlist");
  if (!Array.isArray(trustPolicy?.allowedRoots) || !trustPolicy.allowedRoots.some((root) => pathWithin(receipt.installedPath, root))) {
    reasons.push("installedPath is outside protected allowed roots");
  }
  if (reasons.length) {
    return { valid: false, outcome: "fallback", discovery_verified: false, instructions_loaded: "unverified", reasons };
  }

  const before = inventorySkills(beforeInventory, receipt.cwd);
  const after = inventorySkills(afterInventory, receipt.cwd);
  if (before.error || after.error) {
    return { valid: false, outcome: "fallback", discovery_verified: false, instructions_loaded: "unverified", reasons: [before.error || after.error] };
  }
  if (before.unavailable || after.unavailable) {
    return { valid: true, outcome: "fallback", discovery_verified: false, instructions_loaded: "unverified", reasons: [before.reason || after.reason] };
  }
  if (before.skills.some((skill) => skill?.name === receipt.capability)) {
    return { valid: true, outcome: "fallback", discovery_verified: false, instructions_loaded: "unverified", reasons: ["capability was already present in the before inventory"] };
  }
  const matches = after.skills.filter((skill) => skill?.name === receipt.capability);
  const match = matches[0];
  const actualPath = match?.canonicalPath || match?.path;
  if (
    matches.length !== 1
    || match.enabled !== true
    || normalizedPath(actualPath) !== normalizedPath(receipt.installedPath)
    || match.instructionSha256 !== receipt.instructionSha256
  ) {
    return { valid: true, outcome: "fallback", discovery_verified: false, instructions_loaded: "unverified", reasons: ["after inventory does not contain one exact enabled path and instruction hash match"] };
  }
  return {
    valid: true,
    outcome: "discovery_verified",
    discovery_verified: true,
    instructions_loaded: "unverified",
    reasons: ["fresh runtime inventory contains the exact enabled installed skill"],
  };
}
