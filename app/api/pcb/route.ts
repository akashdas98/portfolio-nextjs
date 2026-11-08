import { NextResponse } from "next/server";
import { gzip } from "node:zlib";
import { promisify } from "node:util";

import { loadPcbRegion, loadPcbRegions, PcbSourceError } from "@/lib/pcb/source";
import { parsePcbRegion, parsePcbBatchRegions, PcbInputError, resolvePcbSource } from "@/lib/pcb/spatial";
import { supabaseUrl } from "@/lib/supabase/config";
import { HOME_PCB_REVISION } from "@/lib/pcb/home-identity";

export const runtime = "nodejs";
const compress = promisify(gzip);

function successHeaders(sourceKind: "local" | "remote", source: string, revision: string | null) {
  const fingerprinted = sourceKind === "remote"
    ? /\.[a-f0-9]{20}\.svg$/i.test(source)
    : revision === HOME_PCB_REVISION;
  return {
    "Cache-Control": process.env.NODE_ENV === "development"
      ? "no-store"
      : fingerprinted
        ? "public, max-age=31536000, s-maxage=31536000, immutable"
        : "public, max-age=0, s-maxage=300, must-revalidate",
    "X-Content-Type-Options": "nosniff",
  };
}

const ERROR_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: Request) {
  const startedAt = performance.now();
  try {
    const searchParams = new URL(request.url).searchParams;
    if (searchParams.getAll("source").length !== 1) {
      throw new PcbInputError("Expected one source value.");
    }
    const source = searchParams.get("source") ?? "";
    const target = resolvePcbSource(source, supabaseUrl);
    const revision = searchParams.get("v");
    if (target.kind === "local" && (searchParams.getAll("v").length > 1 ||
      (revision !== null && revision !== HOME_PCB_REVISION))) {
      throw new PcbInputError("The PCB source revision is not available.");
    }
    const result = searchParams.has("regions")
      ? await loadPcbRegions(source, parsePcbBatchRegions(searchParams))
      : { paths: await loadPcbRegion(source, parsePcbRegion(searchParams)) };
    const selectedAt = performance.now();
    const headers = { ...successHeaders(target.kind, source, revision), Vary: "Accept-Encoding" };
    // Origin-generation durations remain interpretable on cached responses:
    // compare them with the browser's queue/connection/body timings and CDN hit.
    const timingHeaders = () => ({
      "Server-Timing": `pcb_origin;dur=${(selectedAt - startedAt).toFixed(1)}, pcb_encode;dur=${(performance.now() - selectedAt).toFixed(1)}`,
    });
    const serialized = JSON.stringify(result);
    // Route-handler streams are not compressed by the local Next server. Keep
    // exact SVG strings compact in transit without blocking the server thread.
    const acceptsGzip = (request.headers.get("accept-encoding") ?? "").split(",").some((entry) => {
      const [encoding, ...parameters] = entry.trim().split(";");
      return encoding === "gzip" && !parameters.some((parameter) => /^\s*q=0(?:\.0*)?\s*$/.test(parameter));
    });
    if (acceptsGzip) {
      const body = await compress(serialized);
      return new Response(new Uint8Array(body), { headers: {
        ...headers, ...timingHeaders(), "Content-Type": "application/json", "Content-Encoding": "gzip",
      } });
    }
    return new Response(serialized, { headers: {
      ...headers, ...timingHeaders(), "Content-Type": "application/json",
    } });
  } catch (error) {
    if (error instanceof PcbInputError) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: ERROR_HEADERS });
    }
    if (error instanceof PcbSourceError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: ERROR_HEADERS });
    }
    console.error("PCB spatial delivery failed", error);
    return NextResponse.json(
      { error: "The PCB geometry could not be delivered." },
      { status: 500, headers: ERROR_HEADERS },
    );
  }
}
