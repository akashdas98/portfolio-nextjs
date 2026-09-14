import assert from "node:assert/strict";
import test from "node:test";
import { checkPush, parseMainUpdates, validateRegistry } from "./check-main-cms-push.mjs";

const sha = "1".repeat(40);
const verified = JSON.stringify({ schema_version: 1, projects: [{ project: "Delivery", status: "verified complete" }] });
const line = (remote = "main", localSha = sha) => `refs/heads/topic ${localSha} refs/heads/${remote} ${"2".repeat(40)}\n`;

test("feature pushes do not read CMS state", () => checkPush(line("topic"), () => assert.fail()));
test("main reads the pushed commit", () => {
  let received;
  checkPush(line(), (commit) => ((received = commit), verified));
  assert.equal(received, sha);
});
test("incomplete promotion blocks main", () => {
  const pending = JSON.stringify({ schema_version: 1, projects: [{ project: "Delivery", status: "awaiting user approval" }] });
  assert.throws(() => checkPush(line(), () => pending), /promotion is incomplete/);
});
test("invalid registries fail closed", () => {
  assert.throws(() => validateRegistry("{"), /valid JSON/);
  assert.throws(() => validateRegistry('{"schema_version":1,"projects":[]}'), /contain projects/);
  assert.throws(() => validateRegistry(JSON.stringify({ schema_version: 1, projects: [{ project: "A", status: "verified complete" }, { project: "A", status: "verified complete" }] })), /duplicate/);
  assert.throws(() => validateRegistry(JSON.stringify({ schema_version: 1, projects: [{ project: "A", status: "pending" }] })), /unknown/);
});
test("main deletion and malformed hook input fail closed", () => {
  assert.throws(() => checkPush(line("main", "0".repeat(40)), () => verified), /deleting main/);
  assert.throws(() => parseMainUpdates("bad input\n"), /malformed/);
});
