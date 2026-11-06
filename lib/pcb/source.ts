import "server-only";

import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { revalidateTag, unstable_cache } from "next/cache";

import { supabaseUrl } from "@/lib/supabase/config";
import { createPcbIndexLoader } from "@/lib/pcb/persistent-index";
import {
  MAX_PCB_SOURCE_BYTES,
  parsePcbLensSvg,
  resolvePcbSource,
  selectPcbPaths,
  selectPcbPathBatch,
  type PcbRegion,
} from "@/lib/pcb/spatial";

const REMOTE_SOURCE_TIMEOUT_MS = 10_000;
const indexLoader = createPcbIndexLoader({
  // Keep callback identity identical for chunk publication and recovery reads;
  // unstable_cache includes the callback source in its persistent key.
  getOrCreate: (key, tag, create) => unstable_cache(async () => create(), [key], {
    revalidate: 31_536_000,
    tags: [tag],
  })(),
  invalidate: (tag) => { revalidateTag(tag, { expire: 0 }); },
}, {
  onCacheError: (error) => console.warn("PCB spatial index cache recovery required.", error),
});

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
      // Raw SVG responses exceed Next's per-entry limit. Persist the compressed
      // parser result instead; never silently attempt to cache this full body.
      cache: "no-store",
      headers: { accept: "image/svg+xml,application/xml;q=0.9" },
      redirect: "manual",
      signal: AbortSignal.timeout(REMOTE_SOURCE_TIMEOUT_MS),
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

  return indexLoader.load(cacheKey, async () => {
    const text = await load();
    try {
      return parsePcbLensSvg(text);
    } catch (error) {
      if (error instanceof PcbSourceError) throw error;
      throw new PcbSourceError(422, error instanceof Error ? error.message : "The PCB source is invalid.");
    }
  }, process.env.NODE_ENV === "production" && target.kind === "remote" &&
    /\.[a-f0-9]{20}\.svg$/i.test(target.url));
}

export async function loadPcbRegion(source: string, region: PcbRegion) {
  return selectPcbPaths(await loadIndex(source), region);
}

export async function loadPcbRegions(source: string, regions: PcbRegion[]) {
  return selectPcbPathBatch(await loadIndex(source), regions);
}
