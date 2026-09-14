#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import {
  evaluateCapability,
  evaluateCapabilityAgainstInventory,
  evaluateCapabilityDiscovery,
} from "./evaluator.mjs";

const args = process.argv.slice(2);
const valueFor = (name) => {
  const indexes = args.flatMap((value, index) => value === name ? [index] : []);
  if (indexes.length !== 1) return undefined;
  const value = args[indexes[0] + 1];
  return value && !value.startsWith("--") ? value : undefined;
};
const readJson = async (name) => JSON.parse(await readFile(valueFor(name), "utf8"));
const legacyPath = valueFor("--check-capability");
const resolvePath = valueFor("--resolve-capability");
const verifyPath = valueFor("--verify-activation");

try {
  let result;
  let legacy = false;
  if (legacyPath && args.length === 2) {
    legacy = true;
    result = evaluateCapability(await readJson("--check-capability"));
  } else if (resolvePath && valueFor("--inventory") && valueFor("--trust-policy") && args.length === 6) {
    result = evaluateCapabilityAgainstInventory(
      await readJson("--resolve-capability"),
      await readJson("--inventory"),
      await readJson("--trust-policy"),
    );
  } else if (verifyPath && valueFor("--before") && valueFor("--after") && valueFor("--trust-policy") && args.length === 8) {
    result = evaluateCapabilityDiscovery(
      await readJson("--verify-activation"),
      await readJson("--before"),
      await readJson("--after"),
      await readJson("--trust-policy"),
    );
  } else {
    process.stderr.write("Usage: capability.mjs --check-capability decision.json | --resolve-capability request.json --inventory inventory.json --trust-policy policy.json | --verify-activation receipt.json --before before.json --after after.json --trust-policy policy.json\n");
    process.exitCode = 2;
  }
  if (result) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (!result.valid) process.exitCode = 2;
    else if (!legacy && result.outcome === "consent-required") process.exitCode = 3;
    else if (!legacy && result.outcome === "fallback") process.exitCode = 4;
  }
} catch (error) {
  process.stderr.write(`Capability decision invalid: ${error.message}\n`);
  process.exitCode = 2;
}
