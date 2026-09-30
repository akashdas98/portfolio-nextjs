/** Development diagnostics only; bounded records contain scalar state, never page content. */
export type TouchDeviceCaptureRecord = Record<string, number | string>;
export const TOUCH_DEVICE_CAPTURE_EVENT_LIMIT = 256;
export const TOUCH_DEVICE_CAPTURE_BODY_LIMIT = 160_000;

export function createTouchDeviceCaptureBuffer(limit = TOUCH_DEVICE_CAPTURE_EVENT_LIMIT) {
  const records: TouchDeviceCaptureRecord[] = [];
  let dropped = 0;
  return {
    get size() { return records.length; },
    get dropped() { return dropped; },
    add(record: TouchDeviceCaptureRecord) {
      records.push(record);
      if (records.length > limit) { records.shift(); dropped += 1; }
    },
    drain() { return records.splice(0); },
  };
}

export function serializeTouchDeviceCapture(capture: {
  schema: string;
  frames: TouchDeviceCaptureRecord[];
  events: TouchDeviceCaptureRecord[];
  [key: string]: unknown;
}) {
  const payload = { ...capture, frames: [...capture.frames], events: [...capture.events], trimmedFrames: 0, trimmedEvents: 0 };
  let body = JSON.stringify(payload);
  // Prefer raw lifecycle evidence over old animation samples. Keep newest raw
  // records and report every discarded record so absence is not overclaimed.
  while (body.length > TOUCH_DEVICE_CAPTURE_BODY_LIMIT && (payload.frames.length || payload.events.length)) {
    const records = payload.frames.length ? payload.frames : payload.events;
    const count = Math.max(1, Math.ceil(records.length / 8));
    if (payload.frames.length) payload.trimmedFrames += count;
    else payload.trimmedEvents += count;
    records.splice(0, count);
    body = JSON.stringify(payload);
  }
  if (body.length > TOUCH_DEVICE_CAPTURE_BODY_LIMIT) throw new Error("Touch device capture metadata exceeds diagnostic limit.");
  return body;
}

export function isTouchDeviceCapture(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      (value as { schema?: unknown }).schema !== "pcb-touch-device-capture-v1") return false;
  const capture = value as Record<string, unknown>;
  const validRecord = (record: unknown) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) return false;
    const entries = Object.entries(record);
    return entries.length <= 100 && entries.every(([key, item]) => key.length <= 80 &&
      ((typeof item === "number" && Number.isFinite(item)) || (typeof item === "string" && item.length <= 2048)));
  };
  return [["frames", 400], ["events", TOUCH_DEVICE_CAPTURE_EVENT_LIMIT]].every(([name, limit]) =>
    capture[name] === undefined || (Array.isArray(capture[name]) && capture[name].length <= Number(limit) && capture[name].every(validRecord))) &&
    (capture.rawCounts === undefined || validRecord(capture.rawCounts));
}
