#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { evaluateLifecycle } from "./lifecycle.mjs";

const usage = "Usage: node lifecycle-cli.mjs --check-lifecycle manifest.json";
const args = process.argv.slice(2);

if (args.length !== 2 || args[0] !== "--check-lifecycle") {
  process.stderr.write(`${usage}\n`);
  process.exitCode = 2;
} else {
  try {
    const manifest = JSON.parse(await readFile(args[1], "utf8"));
    const outcome = evaluateLifecycle(manifest);
    process.stdout.write(`${JSON.stringify(outcome)}\n`);
    process.exitCode = outcome.valid ? (outcome.clear_ready ? 0 : 1) : 2;
  } catch (error) {
    process.stderr.write(`Lifecycle manifest invalid: ${error.message}\n`);
    process.exitCode = 2;
  }
}

