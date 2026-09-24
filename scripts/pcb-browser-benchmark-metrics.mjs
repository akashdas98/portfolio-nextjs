// Pure report logic shared with deterministic tests. No performance threshold is
// a pass/fail gate: this experiment collects evidence, not production readiness.
export function distribution(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return { count: 0, min: null, median: null, p95: null, max: null };
  const percentile = (p) => {
    const position = (sorted.length - 1) * p;
    const lower = Math.floor(position);
    return sorted[lower] + (sorted[Math.ceil(position)] - sorted[lower]) * (position - lower);
  };
  return { count: sorted.length, min: sorted[0], median: percentile(0.5), p95: percentile(0.95), max: sorted.at(-1) };
}

export function summarizeFrames(samples) {
  const intervals = samples.slice(1).map((sample, index) => sample.at - samples[index].at);
  let unavailableMs = 0;
  let unavailableFrames = 0;
  let failedFrames = 0;
  for (let index = 0; index < samples.length; index += 1) {
    if (samples[index].unavailable > 0) {
      unavailableFrames += 1;
      // Left-sampled DOM interval, not a measured physical display interval.
      if (index + 1 < samples.length) unavailableMs += intervals[index];
    }
    if (samples[index].failed > 0) failedFrames += 1;
  }
  return { intervalMs: distribution(intervals), over33Ms: intervals.filter((value) => value > 33.334).length,
    over50Ms: intervals.filter((value) => value > 50).length, unavailableFrames, unavailableMs, failedFrames };
}

export function summarizeTrace(events) {
  const names = ["Paint", "RasterTask", "Decode Image", "ImageDecodeTask", "CompositeLayers"];
  return Object.fromEntries(names.map((name) => {
    const matches = events.filter((event) => event.name === name && event.ph === "X" && Number.isFinite(event.dur));
    return [name, { count: matches.length, summedThreadDurationMs: matches.reduce((sum, event) => sum + event.dur / 1000, 0) }];
  }));
}

export function classifyPixels(actual, before, after, { tolerance = 8, changedFraction = 0.002 } = {}) {
  if (!actual.length || actual.length !== before.length || actual.length !== after.length || actual.length % 3) {
    throw new Error("Pixel buffers must be matching RGB images.");
  }
  let beforeDiff = 0;
  let afterDiff = 0;
  let informative = 0;
  let nonMatte = 0;
  for (let index = 0; index < actual.length; index += 3) {
    const distance = (left, right) => Math.max(...[0, 1, 2].map((offset) => Math.abs(left[index + offset] - right[index + offset])));
    if (distance(before, after) > tolerance) informative += 1;
    if (distance(actual, before) > tolerance) beforeDiff += 1;
    if (distance(actual, after) > tolerance) afterDiff += 1;
    if (Math.max(Math.abs(actual[index] - 128), Math.abs(actual[index + 1] - 144), Math.abs(actual[index + 2] - 160)) > tolerance) nonMatte += 1;
  }
  const pixels = actual.length / 3;
  const distinguishable = informative / pixels > changedFraction;
  const state = nonMatte / pixels < changedFraction ? "blank-matte"
    : !distinguishable ? "indeterminate-reference"
      : afterDiff / pixels <= changedFraction ? "replacement"
        : beforeDiff / pixels <= changedFraction ? "stale-original" : "partial-or-other";
  return { state, beforeMismatchFraction: beforeDiff / pixels, afterMismatchFraction: afterDiff / pixels,
    referenceDifferenceFraction: informative / pixels, foregroundFraction: nonMatte / pixels };
}
