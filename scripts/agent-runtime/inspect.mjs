#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative, resolve } from 'node:path';
import process from 'node:process';
import { StringDecoder } from 'node:string_decoder';

const DEFAULT_CWDS = [process.cwd()];
const DEFAULT_HOME = process.env.CODEX_HOME
  || (process.env.USERPROFILE ? join(process.env.USERPROFILE, '.codex') : undefined);
const DEFAULT_CODEX_BIN = process.env.APPDATA
  ? join(
      process.env.APPDATA,
      'npm/node_modules/@openai/codex/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe',
    )
  : undefined;
const MAX_STDERR_MESSAGES = 8;
const MAX_STDERR_LENGTH = 500;
const MAX_JSONL_LINE = 4 * 1024 * 1024;

const args = process.argv.slice(2);
const knownOptions = ['--cwd', '--home', '--codex-bin', '--timeout-ms'];
const parsed = new Map(knownOptions.map((name) => [name, []]));
let argumentError;
for (let index = 0; index < args.length; index += 2) {
  const name = args[index];
  const value = args[index + 1];
  if (!knownOptions.includes(name)) {
    argumentError = `unknown argument: ${name}`;
    break;
  }
  if (value === undefined || value.startsWith('--')) {
    argumentError = `missing value for ${name}`;
    break;
  }
  parsed.get(name).push(value);
}
const cwds = parsed.get('--cwd');
const targetCwds = cwds.length ? cwds : DEFAULT_CWDS;
const codexHome = parsed.get('--home')[0] || DEFAULT_HOME;
const codexBin = parsed.get('--codex-bin')[0] || DEFAULT_CODEX_BIN;
const timeoutValue = parsed.get('--timeout-ms')[0];
const timeoutMs = timeoutValue === undefined ? 30_000 : Number(timeoutValue);

const output = {
  status: 'ok',
  codexHome,
  cwds: targetCwds,
  hooks: [],
  skills: [],
  warnings: [],
};

const finishWithInputError = (error) => {
  output.status = 'error';
  output.error = error;
  console.log(JSON.stringify(output));
  process.exit(2);
};

if (argumentError) finishWithInputError(argumentError);
if (!Number.isFinite(timeoutMs) || timeoutMs < 100) finishWithInputError('--timeout-ms must be at least 100');
if (!codexHome) finishWithInputError('CODEX_HOME is unavailable; pass --home or set CODEX_HOME/USERPROFILE');
if (!codexBin) finishWithInputError('Codex executable is unavailable; pass --codex-bin or set APPDATA');
if (!existsSync(codexBin)) finishWithInputError(`Codex executable not found: ${codexBin}`);
if (!existsSync(codexHome)) finishWithInputError(`CODEX_HOME not found: ${codexHome}`);
const missingCwd = targetCwds.find((cwd) => !existsSync(cwd));
if (missingCwd) finishWithInputError(`working directory not found: ${missingCwd}`);

let nextId = 1;
let stdoutBuffer = '';
let stderrBuffer = '';
let terminalError;
let timeoutHandle;
const decoder = new StringDecoder('utf8');
const pending = new Map();
const childEnv = { ...process.env, CODEX_HOME: codexHome };
const child = spawn(codexBin, ['app-server', '--stdio'], {
  cwd: targetCwds[0],
  env: childEnv,
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true,
});

const boundedMessage = (value) => String(value).replace(/\s+/g, ' ').trim().slice(0, MAX_STDERR_LENGTH);
const addWarning = (value) => {
  const message = boundedMessage(value);
  if (message && output.warnings.length < MAX_STDERR_MESSAGES) output.warnings.push(message);
};
const rejectPending = (error) => {
  terminalError ||= error instanceof Error ? error : new Error(String(error));
  for (const { reject } of pending.values()) reject(terminalError);
  pending.clear();
};
const writeMessage = (message) => {
  if (child.exitCode !== null || child.stdin.destroyed) throw new Error('Codex app-server stdin is closed');
  child.stdin.write(`${JSON.stringify(message)}\n`);
};
const request = (method, params) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  try {
    writeMessage({ jsonrpc: '2.0', id, method, params });
  } catch (error) {
    pending.delete(id);
    reject(error);
  }
});
const notify = (method, params) => writeMessage({ jsonrpc: '2.0', method, ...(params === undefined ? {} : { params }) });

const acceptLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  if (trimmed.length > MAX_JSONL_LINE) {
    rejectPending(new Error(`JSONL response exceeded ${MAX_JSONL_LINE} bytes`));
    return;
  }
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch (error) {
    rejectPending(new Error(`invalid JSONL response: ${boundedMessage(error.message)}`));
    return;
  }
  if (message.id === undefined || !pending.has(message.id)) return;
  const waiter = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) {
    waiter.reject(new Error(`${message.error.code ?? 'RPC'}: ${message.error.message || 'request failed'}`));
  } else {
    waiter.resolve(message.result);
  }
};

child.stdout.on('data', (chunk) => {
  stdoutBuffer += decoder.write(chunk);
  if (stdoutBuffer.length > MAX_JSONL_LINE && !stdoutBuffer.includes('\n')) {
    rejectPending(new Error(`JSONL response exceeded ${MAX_JSONL_LINE} bytes`));
    return;
  }
  const lines = stdoutBuffer.split('\n');
  stdoutBuffer = lines.pop() || '';
  for (const line of lines) acceptLine(line);
});
child.stderr.on('data', (chunk) => {
  stderrBuffer += chunk.toString('utf8');
  const lines = stderrBuffer.split(/\r?\n/);
  stderrBuffer = lines.pop() || '';
  for (const line of lines) addWarning(line);
});
child.stdin.on('error', (error) => rejectPending(new Error(`app-server stdin error: ${error.message}`)));
child.on('error', (error) => rejectPending(new Error(`could not start Codex app-server: ${error.message}`)));
child.on('exit', (code, signal) => {
  if (pending.size) rejectPending(new Error(`Codex app-server exited before replying (code=${code}, signal=${signal})`));
});

const responseEntries = (method, response) => {
  if (!Array.isArray(response?.data)) throw new Error(`${method} returned an invalid response: missing data array`);
  return response.data;
};
const mapHooks = (response) => responseEntries('hooks/list', response).map((entry) => ({
  cwd: entry.cwd,
  hooks: (Array.isArray(entry.hooks) ? entry.hooks : []).map((hook) => ({
    status: hook.statusMessage || (hook.enabled ? 'enabled' : 'disabled'),
    name: hook.eventName,
    source: hook.source,
    key: hook.key,
    hash: hook.currentHash,
    trustStatus: hook.trustStatus,
  })),
  errors: Array.isArray(entry.errors) ? entry.errors : [],
  warnings: Array.isArray(entry.warnings) ? entry.warnings : [],
}));
const within = (path, root) => {
  const rel = relative(resolve(root), resolve(path));
  return rel === '' || (!rel.startsWith('..') && !rel.includes(':'));
};
const enrichSkill = async (skill, cwd) => {
  const record = { name: skill.name, path: skill.path, enabled: skill.enabled };
  try {
    const canonicalPath = await realpath(skill.path);
    const bytes = await readFile(canonicalPath);
    record.canonicalPath = canonicalPath;
    record.scope = within(canonicalPath, join(cwd, '.codex', 'skills'))
      ? 'project'
      : within(canonicalPath, join(codexHome, 'skills')) ? 'codex-home' : 'external';
    record.instructionSha256 = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    record.readError = null;
  } catch (error) {
    record.canonicalPath = null;
    record.scope = 'unverifiable';
    record.instructionSha256 = null;
    record.readError = boundedMessage(error.message || error);
  }
  return record;
};
const mapSkills = async (response) => Promise.all(responseEntries('skills/list', response).map(async (entry) => {
  const available = await Promise.all((Array.isArray(entry.skills) ? entry.skills : []).map(
    (skill) => enrichSkill(skill, entry.cwd),
  ));
  const counts = new Map();
  for (const skill of available) counts.set(skill.name, (counts.get(skill.name) || 0) + 1);
  return {
    cwd: entry.cwd,
    available,
    duplicateNames: [...counts].filter(([, count]) => count > 1).map(([name]) => name).sort(),
    errors: Array.isArray(entry.errors) ? entry.errors : [],
  };
}));

const waitForExit = (milliseconds) => new Promise((resolve) => {
  if (child.exitCode !== null) return resolve(true);
  let timer;
  const exited = () => {
    clearTimeout(timer);
    resolve(true);
  };
  child.once('exit', exited);
  if (child.exitCode !== null) return exited();
  timer = setTimeout(() => {
    child.off('exit', exited);
    resolve(false);
  }, milliseconds);
});
const closeChild = async () => {
  try { child.stdin.end(); } catch {}
  if (child.exitCode !== null) return;
  child.kill();
  if (await waitForExit(750)) return;
  child.kill('SIGKILL');
  await waitForExit(1_000);
};

try {
  const timedOut = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(`RPC timeout after ${timeoutMs}ms`)), timeoutMs);
  });
  const probe = (async () => {
    await request('initialize', {
      clientInfo: { name: 'agent-runtime-inspector', version: '1.0.0' },
      capabilities: { experimentalApi: true },
    });
    notify('initialized');
    const [hooks, skills] = await Promise.all([
      request('hooks/list', { cwds: targetCwds }),
      request('skills/list', { cwds: targetCwds, forceReload: true }),
    ]);
    output.hooks = mapHooks(hooks);
    output.skills = await mapSkills(skills);
  })();
  await Promise.race([probe, timedOut]);
  if (terminalError) throw terminalError;
} catch (error) {
  output.status = 'error';
  output.error = boundedMessage(error.message || error);
  rejectPending(error);
} finally {
  clearTimeout(timeoutHandle);
  const tail = decoder.end();
  if (tail) stdoutBuffer += tail;
  if (stdoutBuffer.trim()) acceptLine(stdoutBuffer);
  if (stderrBuffer.trim()) addWarning(stderrBuffer);
  await closeChild();
}

console.log(JSON.stringify(output));
if (output.status !== 'ok') process.exitCode = 1;
