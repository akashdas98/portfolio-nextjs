const LIFECYCLE_FIELDS = new Set([
  "schema_version",
  "meaningful_change_revision",
  "checkpoint_revision",
  "task_state",
  "unresolved_items",
  "active_operations",
  "recommendation_state",
]);

const TASK_STATES = new Set(["in-progress", "blocked", "complete"]);
const RECOMMENDATION_STATES = new Set([
  "continue",
  "checkpoint-required",
  "clear-candidate",
]);

function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function nonEmptyStringArray(value) {
  return Array.isArray(value) && value.every(
    (item) => typeof item === "string" && item.trim().length > 0,
  );
}

/**
 * Validate declared lifecycle state and assess whether it is safe to recommend
 * clearing the session. This is advisory: it cannot invoke /clear, observe work
 * outside the manifest, or verify the agent's semantic completion judgment.
 */
export function evaluateLifecycle(manifest) {
  const validationErrors = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return {
      valid: false,
      status: "invalid",
      clear_ready: false,
      validation_errors: ["lifecycle manifest must be a JSON object"],
    };
  }

  const unknown = Object.keys(manifest).filter((key) => !LIFECYCLE_FIELDS.has(key));
  if (unknown.length > 0) {
    validationErrors.push(`unknown lifecycle field(s): ${unknown.sort().join(", ")}`);
  }
  if (manifest.schema_version !== 1) {
    validationErrors.push("schema_version must be 1");
  }
  if (!nonNegativeInteger(manifest.meaningful_change_revision)) {
    validationErrors.push("meaningful_change_revision must be a non-negative safe integer");
  }
  if (!nonNegativeInteger(manifest.checkpoint_revision)) {
    validationErrors.push("checkpoint_revision must be a non-negative safe integer");
  }
  if (!TASK_STATES.has(manifest.task_state)) {
    validationErrors.push("task_state must be in-progress, blocked, or complete");
  }
  if (!nonEmptyStringArray(manifest.unresolved_items)) {
    validationErrors.push("unresolved_items must be an array of non-empty strings");
  }
  if (!nonEmptyStringArray(manifest.active_operations)) {
    validationErrors.push("active_operations must be an array of non-empty strings");
  }
  if (!RECOMMENDATION_STATES.has(manifest.recommendation_state)) {
    validationErrors.push(
      "recommendation_state must be continue, checkpoint-required, or clear-candidate",
    );
  }

  if (validationErrors.length > 0) {
    return {
      valid: false,
      status: "invalid",
      clear_ready: false,
      validation_errors: validationErrors,
    };
  }

  if (manifest.checkpoint_revision > manifest.meaningful_change_revision) {
    return {
      valid: false,
      status: "invalid",
      clear_ready: false,
      validation_errors: [
        "checkpoint_revision cannot exceed meaningful_change_revision",
      ],
    };
  }

  const checks = {
    checkpoint_fresh:
      manifest.checkpoint_revision === manifest.meaningful_change_revision,
    task_complete_declared: manifest.task_state === "complete",
    unresolved_item_count: manifest.unresolved_items.length,
    active_operation_count: manifest.active_operations.length,
    clear_candidate_declared: manifest.recommendation_state === "clear-candidate",
  };
  const blockers = [];
  if (!checks.checkpoint_fresh) blockers.push("checkpoint is stale");
  if (!checks.task_complete_declared) blockers.push("task is not declared complete");
  if (checks.unresolved_item_count > 0) blockers.push("unresolved items remain");
  if (checks.active_operation_count > 0) blockers.push("active operations remain");
  if (!checks.clear_candidate_declared) {
    blockers.push("semantic clear recommendation is not declared");
  }

  return {
    valid: true,
    status: blockers.length === 0 ? "clear-ready" : "not-clear-ready",
    clear_ready: blockers.length === 0,
    checks,
    blockers,
    advisory:
      "This result evaluates declared state only; it does not invoke /clear or discover unrecorded work.",
  };
}

