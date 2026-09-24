import assert from "node:assert/strict";
import test from "node:test";
import { checkTaskOrder } from "./check-agent-memory.mjs";

const task = (states, status = "Parent PCB feature is active") => `
- Status: ${status}
- Remaining: follow the ordered task table below. The first active row is next.
${states.map((state, index) => `| ${index + 1} | Task ${index + 1} | ${state} | Exit condition. |`).join("\n")}
`;

test("ordered parent tasks advance only to the first unfinished row", () => {
  assert.deepEqual(checkTaskOrder(task(["done", "active", "queued"])), []);
  assert.match(checkTaskOrder(task(["done", "queued", "active"]))[0], /first unfinished/);
  assert.match(checkTaskOrder(task(["done", "active", "active"]))[0], /first unfinished/);
});

test("completed detours cannot make an unfinished parent appear complete", () => {
  assert.match(checkTaskOrder(task(["done", "active", "queued"], "Touch lag accepted"))[0], /active parent Status/);
  assert.match(checkTaskOrder(task(["done", "done"], "Parent PCB feature is active"))[0], /not complete/);
});
