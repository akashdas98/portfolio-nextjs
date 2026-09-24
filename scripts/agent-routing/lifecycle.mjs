const LIFECYCLE_FIELDS = new Set([
  "schema_version",
  "meaningful_change_revision",
  "checkpoint_revision",
  "unresolved_items",
  "active_operations",
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
 * clearing the session. This is advisory: it cannot invoke /clear or observe work
 * outside the manifest.
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
  if (manifest.schema_version !== 3) {
    validationErrors.push("schema_version must be 3");
  }
  if (!nonNegativeInteger(manifest.meaningful_change_revision)) {
    validationErrors.push("meaningful_change_revision must be a non-negative safe integer");
  }
  if (!nonNegativeInteger(manifest.checkpoint_revision)) {
    validationErrors.push("checkpoint_revision must be a non-negative safe integer");
  }
  if (!nonEmptyStringArray(manifest.unresolved_items)) {
    validationErrors.push("unresolved_items must be an array of non-empty strings");
  }
  if (!nonEmptyStringArray(manifest.active_operations)) {
    validationErrors.push("active_operations must be an array of non-empty strings");
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
    unresolved_item_count: manifest.unresolved_items.length,
    active_operation_count: manifest.active_operations.length,
  };
  const blockers = [];
  if (!checks.checkpoint_fresh) blockers.push("checkpoint is stale");
  if (checks.unresolved_item_count > 0) blockers.push("unresolved items remain");
  if (checks.active_operation_count > 0) blockers.push("active operations remain");
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
