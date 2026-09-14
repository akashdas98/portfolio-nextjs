#!/usr/bin/env node
import { appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";
import { evaluatePreToolUse, PARENT_POLICY, SUPPORTED_MODELS } from "./evaluator.mjs";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function readStdin() {
  let text = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) text += chunk;
  return text;
}

function deny(reason) {
  process.stdout.write(`${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  })}\n`);
}

async function audit(event, decision) {
  const explicitPath = argument("--audit");
  const path = explicitPath || join(tmpdir(), "codex-agent-routing", "audit.jsonl");
  if (!explicitPath) await mkdir(dirname(path), { recursive: true });
  const safeId = (value) => (
    typeof value === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(value) ? value : "invalid"
  );
  const safeModel = SUPPORTED_MODELS.includes(decision.model)
    ? decision.model
    : "unknown";
  const safeEffort = ["low", "medium", "high", "xhigh", "max", "ultra"].includes(decision.reasoning_effort)
    ? decision.reasoning_effort
    : "unknown";
  const record = {
    session_id: safeId(event.session_id),
    tool_use_id: safeId(event.tool_use_id),
    model: safeModel,
    reasoning_effort: safeEffort,
    reasons: decision.allowed ? ["allowed by routing policy"] : decision.reasons,
  };
  await appendFile(path, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
}

let event;
try {
  event = JSON.parse(await readStdin());
} catch {
  deny("Routing handler denied malformed JSON input.");
  process.exitCode = 0;
}

if (event !== undefined) {
  if (!event || typeof event !== "object" || Array.isArray(event) || typeof event.hook_event_name !== "string") {
    deny("Routing handler denied an invalid hook event.");
  } else
  if (event.hook_event_name === "SessionStart" || event.hook_event_name === "UserPromptSubmit") {
    process.stdout.write(`${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: event.hook_event_name,
        additionalContext: PARENT_POLICY,
      },
    })}\n`);
  } else if (event.hook_event_name === "PreToolUse") {
    const decision = evaluatePreToolUse(event);
    if (decision.targeted) {
      try {
        await audit(event, decision);
      } catch {
        decision.allowed = false;
        decision.reasons = [...decision.reasons, "routing audit write failed"];
      }
      if (!decision.allowed) deny(`Routing denied spawn_agent: ${decision.reasons.join("; ")}`);
    } else if (!decision.allowed) {
      deny(`Routing handler denied invalid input: ${decision.reasons.join("; ")}`);
    }
  } else {
    deny("Routing handler denied an unknown hook event.");
  }
}
