import { appendFile } from "node:fs/promises";
import path from "node:path";
import { isTouchDeviceCapture } from "@/lib/pcb/touch-device-capture";

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
  }
  const body = await request.text();
  if (body.length > 180_000) return new Response(null, { status: 413 });
  let capture: unknown;
  try {
    capture = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!isTouchDeviceCapture(capture)) {
    return new Response(null, { status: 400 });
  }
  await appendFile(
    path.join(process.cwd(), ".next", "dev", "pcb-touch-captures.jsonl"),
    `${JSON.stringify(capture)}\n`,
  );
  return new Response(null, { status: 204 });
}
