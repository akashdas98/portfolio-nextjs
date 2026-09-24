import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parsePcbLensSvg, selectPcbPaths } from "../../lib/pcb/spatial.ts";

test("touch regions retain a bounded source-ordered subset and trail copies stay immutable", async () => {
  const source = await readFile(new URL("../../public/pcb-backgrounds/home-lens.svg", import.meta.url), "utf8");
  const index = parsePcbLensSvg(source);
  const sourceIndexes = new Map(index.paths.map((path, pathIndex) => [path, pathIndex]));
  const first = selectPcbPaths(index, { x: -423, y: 1_500, width: 4_400, height: 4_400 });
  assert.ok(first.length > 0);
  assert.ok(first.length < index.paths.length);
  const orderedIndexes = first.map((path) => sourceIndexes.get(path));
  assert.ok(orderedIndexes.every((value, pathIndex) => pathIndex === 0 || value > orderedIndexes[pathIndex - 1]));

  const trailSnapshot = Object.freeze(first.map((path) => path.source));
  const second = selectPcbPaths(index, { x: -423, y: 3_000, width: 4_400, height: 4_400 });
  assert.notDeepEqual(second.map((path) => path.source), trailSnapshot);
  assert.deepEqual(trailSnapshot, first.map((path) => path.source));
});
