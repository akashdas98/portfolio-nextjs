import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Structural checks only: never infer truth, approval, or read compliance.
export function checkAgentMemory(root = repositoryRoot) {
  const errors = [];
  const sizes = {};
  const read = (name) => {
    const path = resolve(root, name);
    if (!existsSync(path) || !statSync(path).isFile()) {
      errors.push(`Missing file: ${name}`);
      return "";
    }
    return readFileSync(path, "utf8");
  };
  const agents = read("AGENTS.md");
  const context = read("CONTEXT.md");
  for (const [name, content, limit] of [
    ["AGENTS.md", agents, 8192],
    ["CONTEXT.md", context, 12288],
  ]) {
    sizes[name] = Buffer.byteLength(content, "utf8");
    if (sizes[name] > limit) errors.push(`${name}: ${sizes[name]} bytes exceeds ${limit}`);
  }

  for (const heading of ["Current Task", "Status Ledger", "Known Issues", "Next Recommended Steps", "Recent Changes"]) {
    if (!context.split(/\r?\n/).includes(`## ${heading}`)) errors.push(`Missing memory section: ${heading}`);
  }
  const task = context.split("## Current Task")[1]?.split(/\r?\n## /)[0] ?? "";
  for (const field of ["Objective", "Status", "Scope/approval", "Completed", "Remaining", "Verification"]) {
    if (!task.includes(`- ${field}:`)) errors.push(`Missing current-task field: ${field}`);
  }
  if (!/^Updated: \d{4}-\d{2}-\d{2}\./m.test(context)) errors.push("Missing ISO Updated date");
  const recent = context.split("## Recent Changes")[1]?.split(/\r?\n## /)[0] ?? "";
  if ((recent.match(/^- /gm) ?? []).length > 5) errors.push("Recent Changes exceeds five entries");

  const allowedStates = new Set(["awaiting user approval", "approved and in progress", "verified complete"]);
  for (const project of ["Delivery Intelligence", "Leads Management", "Horecah"]) {
    if (!context.includes(`| ${project} promotion |`)) errors.push(`Missing promotion row: ${project}`);
  }
  for (const line of context.split(/\r?\n/).filter((line) => /^\| [^|]+ promotion \|/.test(line))) {
    if (!allowedStates.has(line.split("|")[2].trim())) errors.push(`Invalid promotion state: ${line}`);
  }

  for (const name of ["architecture", "engineering", "product", "visual", "runtime", "workflow"]) {
    const path = `docs/agent/${name}.md`;
    read(path);
    if (!agents.includes(`\`${path}\``)) errors.push(`Root does not route: ${path}`);
  }
  // Root routing paths are literal code spans. Skip example commands and symbols.
  for (const [, path] of agents.matchAll(/`((?:docs\/|\.codex\/)[^`]+\.(?:md|mjs))`/g)) read(path);
  for (const path of ["portfolio-structure.md", "positioning.md", "scripts/check-agent-memory.mjs"]) read(path);

  const docs = resolve(root, "docs/agent");
  const files = ["AGENTS.md", "CONTEXT.md", ...(existsSync(docs)
    ? readdirSync(docs).filter((name) => name.endsWith(".md")).map((name) => `docs/agent/${name}`)
    : [])];
  for (const name of files) {
    const content = read(name);
    for (const [, raw] of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = raw.replace(/^<|>$/g, "").split("#")[0];
      if (!target || /^[a-z]+:/i.test(target)) continue;
      if (!existsSync(resolve(dirname(resolve(root, name)), target))) errors.push(`Broken link in ${name}: ${target}`);
    }
  }
  return { errors: [...new Set(errors)], sizes };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { errors, sizes } = checkAgentMemory();
  for (const [name, bytes] of Object.entries(sizes)) console.log(`${name}: ${bytes} bytes`);
  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
  } else {
    console.log("Agent memory structure OK; semantic accuracy and fresh-session behavior require separate review.");
  }
}
