// Installs only this repository's routing bundle; preserves unrelated hooks/files.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const targets = process.argv.slice(2).map((path) => resolve(path));
if (!targets.length) throw new Error('Pass the explicit repository paths to install.');
const marker = 'Adaptive routing guard';
const operatingRule = `Before substantial work, select model capability and reasoning effort as
independent axes for the initial route: model choice addresses capability profile
and ceiling, while effort addresses inference/search/verification depth within that
model. Record separate demand rationales and acceptance checks; reassess either
axis independently at meaningful handoffs. Work class is descriptive, not an
allocation ladder. Before spawning, use the structured routing contract in
\`scripts/agent-routing/README.md\`. Automatically select useful
installed skills/tools; discover missing capabilities only for a concrete need.
Task-justified installation from a reviewed, pinned trusted source is authorized
within existing permissions; account consent and expanded access still require
their actual approval. Preserve stronger capabilities when evidence warrants them.
The local hook is a guardrail, not protected parent/spending enforcement; never
claim complete governance or measured savings from its presence. Checkpoint durable
state after meaningful changes and recommend /clear only after declared lifecycle
readiness; only the user invokes /clear.`;
const plans = targets.map((root) => {
  for (const name of ['AGENTS.md', 'CONTEXT.md', '.git']) {
    if (!existsSync(join(root, name))) throw new Error(`Not an initialized project: ${root} (${name})`);
  }
  const path = join(root, '.codex/hooks.json');
  const hooks = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')) : {};
  if (typeof hooks !== 'object' || hooks === null || Array.isArray(hooks)) throw new Error(`Invalid hooks object: ${path}`);
  hooks.hooks ??= {};
  const script = join(root, 'scripts/agent-routing/hook.mjs').replaceAll('\\', '/');
  // A fixed executable and quoted literal path work with the Windows hook shell.
  if (/["`$\r\n]/.test(script)) throw new Error('Unsupported shell characters in repository path.');
  for (const [event, matcher] of [['SessionStart', 'startup|resume|clear|compact'], ['UserPromptSubmit', undefined], ['PreToolUse', '(^|[.:_])(spawn_agent|Agent)$']]) {
    const groups = hooks.hooks[event] ?? [];
    if (!Array.isArray(groups)) throw new Error(`Invalid hook event: ${event}`);
    const retained = groups.flatMap((group) => {
      if (!Array.isArray(group.hooks)) throw new Error(`Invalid hook group: ${event}`);
      const handlers = group.hooks.filter((handler) => handler.statusMessage !== marker);
      return handlers.length ? [{ ...group, hooks: handlers }] : [];
    });
    hooks.hooks[event] = [...retained, {
      ...(matcher ? { matcher } : {}),
      hooks: [{ type: 'command', command: `node "${script}"`, timeout: 10, statusMessage: marker }],
    }];
  }
  const copies = [];
  for (const folder of ['scripts/agent-routing', 'scripts/agent-runtime']) {
    for (const entry of readdirSync(join(source, folder), { withFileTypes: true })) {
      if (entry.isFile() && /\.(mjs|md|json)$/.test(entry.name)) {
        copies.push([join(root, folder, entry.name), readFileSync(join(source, folder, entry.name))]);
      }
    }
  }
  const agentsPath = join(root, 'AGENTS.md');
  let agents = readFileSync(agentsPath, 'utf8');
  if (!agents.includes('scripts/agent-routing/README.md')) {
    const anchor = '## Architecture Overview';
    if (!agents.includes(anchor)) throw new Error(`Cannot locate operating-rule insertion in ${root}`);
    agents = agents.replace(anchor, `${operatingRule}\n\n${anchor}`);
    copies.push([agentsPath, Buffer.from(agents)]);
  }
  const owner = ['docs/decisions/workflow-context-memory.md', 'Docs/Decisions/WorkflowContextMemory.md']
    .find((relative) => existsSync(join(root, relative)));
  if (owner) {
    const ownerPath = join(root, owner);
    const original = readFileSync(ownerPath, 'utf8');
    if (!original.includes('## Adaptive routing guard')) {
      copies.push([ownerPath, Buffer.from(`${original.trimEnd()}\n\n## Adaptive routing guard\n\nImplemented locally on 2026-09-11 at the user's request. Source, route contract,\nchecks, capability-install eligibility and limitations are in\n\`scripts/agent-routing/README.md\`; runtime discovery is\n\`scripts/agent-runtime/inspect.mjs\`. Project \`.codex/hooks.json\` registers\nstartup/resume, prompt and worker-allocation hooks. Hook trust is a separate\nruntime state: installation alone does not establish activation. Check it in each\nactive Codex home with the inspector or \`/hooks\`.\n\nProtected parent/descendant/spending governance remains incomplete: the stock\nruntime has alternative launch paths, hook disablement and handler failures.\nThe opt-in launcher validates declared parent decisions, not every app launch.\nA protected request gateway/controlled runtime with credentials and egress outside\nagent control is required for full enforcement. No spending cap was supplied.\nCapability eligibility does not grant account consent or prove source provenance;\nactual installation must use reviewed sources and normal runtime permissions.\nQuota savings and total-task quality remain unmeasured. Product gates and approvals\nare unchanged.\n`)]);
    }
    const contextPath = join(root, 'CONTEXT.md');
    let context = readFileSync(contextPath, 'utf8');
    if (!context.includes('Routing guard installed 2026-09-11')) {
      const checkpoint = '- Routing guard installed 2026-09-11; hook activation requires a fresh trust check. Protected governance and savings remain unverified. See the routed workflow decision and `scripts/agent-routing/README.md`.\n';
      context = context.replace(/(## Current Status\r?\n\r?\n)/, `$1${checkpoint}`);
      if (Buffer.byteLength(context) > 12288) throw new Error(`Context would exceed 12 KiB: ${root}`);
      copies.push([contextPath, Buffer.from(context)]);
    }
  }
  return { root, path, hooks, copies };
});

for (const { root, path, hooks, copies } of plans) {
  for (const [destination, content] of copies) {
    mkdirSync(dirname(destination), { recursive: true });
    if (!existsSync(destination) || !readFileSync(destination).equals(content)) writeFileSync(destination, content);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(hooks, null, 2)}\n`);
  console.log(JSON.stringify({ root, installed: copies.length, hooks: path, activation: 'Check hooks/list trust status; installation alone does not establish activation.' }));
}
