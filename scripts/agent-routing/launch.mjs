#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { evaluateDecision } from "./evaluator.mjs";

function parseArguments(argv) {
  const allowed = new Set(["--launch", "--prompt-file", "--codex-js"]);
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(name)) throw new Error(`unknown option: ${name || "<missing>"}`);
    if (name in values) throw new Error(`duplicate option: ${name}`);
    if (!value || value.startsWith("--")) throw new Error(`missing value for ${name}`);
    values[name] = value;
  }
  return values;
}

let options;
try {
  options = parseArguments(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`Launch refused: ${error.message}\n`);
  process.exitCode = 2;
}

const decisionPath = options?.["--launch"];
const promptPath = options?.["--prompt-file"];
const explicitCodex = options?.["--codex-js"];

if (options && (!decisionPath || !promptPath)) {
  process.stderr.write("Usage: node launch.mjs --launch decision.json --prompt-file prompt.txt [--codex-js path]\n");
  process.exitCode = 2;
} else {
  try {
    const decision = JSON.parse(await readFile(decisionPath, "utf8"));
    const checked = evaluateDecision(decision);
    if (!checked.allowed) throw new Error(`routing denied: ${checked.reasons.join("; ")}`);
    const prompt = await readFile(promptPath, "utf8");
    const codexJs = explicitCodex || join(
      process.env.APPDATA || "",
      "npm",
      "node_modules",
      "@openai",
      "codex",
      "bin",
      "codex.js",
    );
    await access(codexJs);

    const child = spawn(process.execPath, [
      codexJs,
      "exec",
      "--model",
      decision.model,
      "--config",
      `model_reasoning_effort=${JSON.stringify(decision.reasoning_effort)}`,
      "--json",
      "-",
    ], {
      cwd: process.cwd(),
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "inherit", "inherit"],
    });
    child.stdin.end(prompt);
    const exitCode = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => resolve(code ?? 1));
    });
    process.exitCode = exitCode;
  } catch (error) {
    process.stderr.write(`Launch refused: ${error.message}\n`);
    process.exitCode = 2;
  }
}
