#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { evaluateDecision } from "./evaluator.mjs";

const usage = "Usage: node check.mjs --check decision.json";
const index = process.argv.indexOf("--check");
const path = index >= 0 ? process.argv[index + 1] : undefined;

if (!path) {
  process.stderr.write(`${usage}\n`);
  process.exitCode = 2;
} else {
  try {
    const decision = JSON.parse(await readFile(path, "utf8"));
    const outcome = evaluateDecision(decision);
    if (!outcome.allowed) {
      process.stderr.write(`Routing decision denied: ${outcome.reasons.join("; ")}\n`);
      process.exitCode = 2;
    } else {
      process.stdout.write("Routing decision allowed.\n");
    }
  } catch (error) {
    process.stderr.write(`Routing decision denied: ${error.message}\n`);
    process.exitCode = 2;
  }
}
