#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

export const registryPath = "docs/agent/cms-promotion-status.json";
const zero = "0".repeat(40);

export function parseMainUpdates(input) {
  const updates = [];
  for (const line of input.split(/\r?\n/).filter(Boolean)) {
    const fields = line.trim().split(/\s+/);
    if (fields.length !== 4) throw new Error(`malformed pre-push input: ${line}`);
    const [localRef, localSha, remoteRef] = fields;
    if (remoteRef === "refs/heads/main") updates.push({ localRef, localSha });
  }
  return updates;
}

export function validateRegistry(raw) {
  let registry;
  try { registry = JSON.parse(raw); } catch { throw new Error("promotion registry is not valid JSON"); }
  if (registry?.schema_version !== 1 || !Array.isArray(registry.projects) || registry.projects.length === 0) {
    throw new Error("promotion registry must use schema_version 1 and contain projects");
  }
  const seen = new Set();
  const incomplete = [];
  for (const item of registry.projects) {
    if (!item || typeof item.project !== "string" || !item.project.trim() || typeof item.status !== "string") {
      throw new Error("every promotion entry needs a project and status");
    }
    if (seen.has(item.project)) throw new Error(`duplicate promotion entry: ${item.project}`);
    seen.add(item.project);
    if (!["awaiting user approval", "approved and in progress", "verified complete"].includes(item.status)) {
      throw new Error(`unknown promotion status for ${item.project}: ${item.status}`);
    }
    if (item.status !== "verified complete") incomplete.push(`${item.project}: ${item.status}`);
  }
  if (incomplete.length) throw new Error(`headless-CMS promotion is incomplete:\n- ${incomplete.join("\n- ")}`);
}

export function checkPush(input, readAtCommit) {
  for (const update of parseMainUpdates(input)) {
    if (update.localSha === zero || update.localRef === "(delete)") throw new Error("deleting main is blocked");
    validateRegistry(readAtCommit(update.localSha));
  }
}

function main() {
  try {
    checkPush(fs.readFileSync(0, "utf8"), (sha) =>
      execFileSync("git", ["show", `${sha}:${registryPath}`], { encoding: "utf8" }));
  } catch (error) {
    console.error(`Blocked main push: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) main();
