import "server-only";

import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { supabaseUrl } from "@/lib/supabase/config";
import {
  MAX_PCB_SOURCE_BYTES,
  parsePcbLensSvg,
  resolvePcbSource,
  selectPcbPaths,
  selectPcbPathBatch,
  type PcbRegion,
  type PcbSpatialIndex,
} from "@/lib/pcb/spatial";

const MAX_PARSED_SOURCES = 8;
const REMOTE_SOURCE_TIMEOUT_MS = 10_000;
const parsedSources = new Map<string, Promise<PcbSpatialIndex>>();

export class PcbSourceError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "PcbSourceError";
  }
}

async function readRemoteSource(url: string) {
  let response: Response;
  try {
    response = await fetch(url, {
      cache: process.env.NODE_ENV === "development" ? "no-store" : "force-cache",
      headers: { accept: "image/svg+xml,application/xml;q=0.9" },
      redirect: "manual",
      signal: AbortSignal.timeout(REMOTE_SOURCE_TIMEOUT_MS),
      ...(process.env.NODE_ENV === "development" ? {} : { next: { revalidate: 31_536_000 } }),
    });
  } catch {
    throw new PcbSourceError(502, "The PCB source could not be loaded.");
  }
  if (response.status >= 300 && response.status < 400) {
    throw new PcbSourceError(502, "The PCB source redirect was rejected.");
  }
  if (!response.ok) throw new PcbSourceError(502, "The PCB source could not be loaded.");
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PCB_SOURCE_BYTES) {
    throw new PcbSourceError(413, "The PCB source exceeds the 5 MB limit.");
  }

  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > MAX_PCB_SOURCE_BYTES) {
          await reader.cancel();
          throw new PcbSourceError(413, "The PCB source exceeds the 5 MB limit.");
        }
        chunks.push(value);
      }
    }
  } catch (error) {
    if (error instanceof PcbSourceError) throw error;
    throw new PcbSourceError(502, "The PCB source could not be loaded within the time limit.");
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new PcbSourceError(422, "The PCB source is not valid UTF-8.");
  }
}

async function loadIndex(source: string) {
  const target = resolvePcbSource(source, supabaseUrl);
  let cacheKey = source;
  let load: () => Promise<string>;
  if (target.kind === "local") {
    const filename = path.join(process.cwd(), "public", target.pathname.slice(1));
    const metadata = await stat(filename);
    if (metadata.size <= 0 || metadata.size > MAX_PCB_SOURCE_BYTES) {
      throw new PcbSourceError(413, "The PCB source exceeds the 5 MB limit.");
    }
    cacheKey = `${source}:${metadata.size}:${metadata.mtimeMs}`;
    load = () => readFile(filename, "utf8");
  } else {
    load = () => readRemoteSource(target.url);
  }

  const cached = parsedSources.get(cacheKey);
  if (cached) return cached;
  while (parsedSources.size >= MAX_PARSED_SOURCES) {
    const oldest = parsedSources.keys().next().value;
    if (oldest === undefined) break;
    parsedSources.delete(oldest);
  }
  const promise = load().then((text) => {
    try {
      return parsePcbLensSvg(text);
    } catch (error) {
      if (error instanceof PcbSourceError) throw error;
      throw new PcbSourceError(422, error instanceof Error ? error.message : "The PCB source is invalid.");
    }
  });
  parsedSources.set(cacheKey, promise);
  promise.catch(() => {
    if (parsedSources.get(cacheKey) === promise) parsedSources.delete(cacheKey);
  });
  return promise;
}

export async function loadPcbRegion(source: string, region: PcbRegion) {
  return selectPcbPaths(await loadIndex(source), region);
}

export async function loadPcbRegions(source: string, regions: PcbRegion[]) {
  return selectPcbPathBatch(await loadIndex(source), regions);
}
