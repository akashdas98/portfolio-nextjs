import { NextResponse } from "next/server";
import { gzip } from "node:zlib";
import { promisify } from "node:util";

import { loadPcbRegion, PcbSourceError } from "@/lib/pcb/source";
import { parsePcbRegion, PcbInputError, resolvePcbSource } from "@/lib/pcb/spatial";
import { supabaseUrl } from "@/lib/supabase/config";

export const runtime = "nodejs";
const compress = promisify(gzip);

function successHeaders(sourceKind: "local" | "remote", source: string) {
  const fingerprinted = /\.[a-f0-9]{20}\.svg$/i.test(source);
  return {
    "Cache-Control": process.env.NODE_ENV === "development"
      ? "no-store"
      : sourceKind === "remote" && fingerprinted
        ? "public, max-age=86400, s-maxage=31536000, immutable"
        : "public, max-age=0, s-maxage=300, must-revalidate",
    "X-Content-Type-Options": "nosniff",
  };
}

const ERROR_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    if (searchParams.getAll("source").length !== 1) {
      throw new PcbInputError("Expected one source value.");
    }
    const source = searchParams.get("source") ?? "";
    const target = resolvePcbSource(source, supabaseUrl);
    const region = parsePcbRegion(searchParams);
    const paths = await loadPcbRegion(source, region);
    const headers = { ...successHeaders(target.kind, source), Vary: "Accept-Encoding" };
    // Route-handler streams are not compressed by the local Next server. Keep
    // exact SVG strings compact in transit without blocking the server thread.
    const acceptsGzip = (request.headers.get("accept-encoding") ?? "").split(",").some((entry) => {
      const [encoding, ...parameters] = entry.trim().split(";");
      return encoding === "gzip" && !parameters.some((parameter) => /^\s*q=0(?:\.0*)?\s*$/.test(parameter));
    });
    if (acceptsGzip) {
      const body = await compress(JSON.stringify({ paths }));
      return new Response(new Uint8Array(body), { headers: {
        ...headers, "Content-Type": "application/json", "Content-Encoding": "gzip",
      } });
    }
    return NextResponse.json({ paths }, { headers });
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
