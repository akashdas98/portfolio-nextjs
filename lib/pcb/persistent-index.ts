import { createHash } from "node:crypto";
import { gzip, gunzip } from "node:zlib";
import { promisify } from "node:util";

import type { PcbSpatialIndex } from "./spatial";

// Base64 is ASCII, so even JSON/cache-envelope overhead stays far below Next's
// 2 MiB entry ceiling. Split the encoded stream, never individual SVG paths.
export const PCB_INDEX_CHUNK_CHARACTERS = 1_000_000;
const MAX_INDEX_BYTES = 32 * 1024 * 1024;
const MAX_ENCODED_CHARACTERS = Math.ceil((MAX_INDEX_BYTES + 65_536) / 3) * 4;
const MAX_CHUNKS = Math.ceil(MAX_ENCODED_CHARACTERS / PCB_INDEX_CHUNK_CHARACTERS);
const compress = promisify(gzip);
const decompress = promisify(gunzip);

export type PcbIndexCache = {
  getOrCreate: (key: string, tag: string, create: () => Promise<unknown>) => Promise<unknown>;
  invalidate: (tag: string) => void | Promise<void>;
};

type Manifest = {
  version: 1;
  source: string;
  digest: string;
  bytes: number;
  encodedCharacters: number;
  chunks: number;
  inline?: string;
};

class CacheIntegrityError extends Error {}

function digest(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function invalid(): never {
  throw new CacheIntegrityError("The cached PCB spatial index is incomplete or corrupt.");
}

function validateIndex(value: unknown): asserts value is PcbSpatialIndex {
  if (!value || typeof value !== "object") invalid();
  const index = value as PcbSpatialIndex;
  if (![index.width, index.height].every((number) =>
    typeof number === "number" && Number.isFinite(number) && number > 0 && number <= 50_000) ||
    !Array.isArray(index.paths) || index.paths.length < 100 || index.paths.length > 2_500) invalid();
  let sourceBytes = 0;
  for (const path of index.paths) {
    if (!path || typeof path.source !== "string" ||
      ![path.left, path.top, path.right, path.bottom].every((number) =>
        typeof number === "number" && Number.isFinite(number)) ||
      path.left > path.right || path.top > path.bottom) invalid();
    sourceBytes += Buffer.byteLength(path.source, "utf8");
  }
  if (sourceBytes > 5 * 1024 * 1024) invalid();
}

function validateManifest(value: unknown, source: string): Manifest {
  if (!value || typeof value !== "object") invalid();
  const manifest = value as Manifest;
  if (manifest.version !== 1 || manifest.source !== source ||
    typeof manifest.digest !== "string" || !/^[a-f0-9]{64}$/.test(manifest.digest) ||
    !Number.isInteger(manifest.bytes) || manifest.bytes <= 0 || manifest.bytes > MAX_INDEX_BYTES ||
    !Number.isInteger(manifest.encodedCharacters) || manifest.encodedCharacters <= 0 ||
    manifest.encodedCharacters > MAX_ENCODED_CHARACTERS ||
    !Number.isInteger(manifest.chunks) || manifest.chunks < 0 || manifest.chunks > MAX_CHUNKS) invalid();
  if (manifest.chunks === 0) {
    if (typeof manifest.inline !== "string" || manifest.inline.length !== manifest.encodedCharacters ||
      manifest.inline.length > PCB_INDEX_CHUNK_CHARACTERS) invalid();
  } else if (manifest.inline !== undefined ||
    manifest.chunks !== Math.ceil(manifest.encodedCharacters / PCB_INDEX_CHUNK_CHARACTERS)) invalid();
  return manifest;
}

/** Cache only parser-produced indexes; callers still own source authorization. */
export function createPcbIndexLoader(cache: PcbIndexCache, options: {
  memoryLimit?: number;
  onCacheError?: (error: unknown) => void;
} = {}) {
  const memoryLimit = options.memoryLimit ?? 8;
  if (!Number.isInteger(memoryLimit) || memoryLimit < 1 || memoryLimit > 8) {
    throw new Error("PCB index memory cache requires between 1 and 8 entries.");
  }
  const memory = new Map<string, Promise<PcbSpatialIndex>>();

  async function persisted(source: string, derive: () => Promise<PcbSpatialIndex>) {
    const sourceDigest = digest(source);
    const prefix = `pcb-index-v1:${sourceDigest}`;
    const tag = `pcb-index:${sourceDigest}`;
    let artifact: Promise<{ index: PcbSpatialIndex; manifest: Manifest; chunks: string[] }> | undefined;
    function build() {
      // Missing chunks, repairs and concurrent cache callbacks share one fetch
      // and parse. A corrupt old manifest cannot combine two source versions.
      return artifact ??= (async () => {
        const index = await derive();
        validateIndex(index);
        const bytes = Buffer.from(JSON.stringify(index), "utf8");
        if (bytes.length > MAX_INDEX_BYTES) throw new Error("PCB spatial index exceeds the cache size limit.");
        const encoded = (await compress(bytes)).toString("base64");
        const chunks = encoded.length <= PCB_INDEX_CHUNK_CHARACTERS ? [] :
          Array.from({ length: Math.ceil(encoded.length / PCB_INDEX_CHUNK_CHARACTERS) }, (_, position) =>
            encoded.slice(position * PCB_INDEX_CHUNK_CHARACTERS, (position + 1) * PCB_INDEX_CHUNK_CHARACTERS));
        const manifest: Manifest = {
          version: 1, source: sourceDigest, digest: digest(bytes), bytes: bytes.length,
          encodedCharacters: encoded.length, chunks: chunks.length,
          ...(chunks.length ? {} : { inline: encoded }),
        };
        return { index, manifest, chunks };
      })();
    }
    const chunkKey = (manifest: Manifest, position: number) => `${prefix}:${manifest.digest}:${position}`;

    async function read() {
      const manifest = validateManifest(await cache.getOrCreate(`${prefix}:manifest`, tag, async () => {
        const prepared = await build();
        // Publish the manifest after all chunk writes have been requested and
        // awaited. Next may finish durable writes at request end; a process
        // interrupted between writes is recovered by the chunk loaders below.
        await Promise.all(prepared.chunks.map((chunk, position) =>
          cache.getOrCreate(chunkKey(prepared.manifest, position), tag, async () => chunk)));
        return prepared.manifest;
      }), sourceDigest);
      const chunks = manifest.chunks === 0 ? [manifest.inline!] : await Promise.all(
        Array.from({ length: manifest.chunks }, async (_, position) => {
          const chunk = await cache.getOrCreate(chunkKey(manifest, position), tag, async () => {
            const prepared = await build();
            if (prepared.manifest.digest !== manifest.digest) invalid();
            return prepared.chunks[position];
          });
          if (typeof chunk !== "string" || chunk.length === 0 || chunk.length > PCB_INDEX_CHUNK_CHARACTERS) invalid();
          return chunk;
        }),
      );
      const encoded = chunks.join("");
      if (encoded.length !== manifest.encodedCharacters || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) invalid();
      let bytes: Buffer;
      try {
        bytes = await decompress(Buffer.from(encoded, "base64"), { maxOutputLength: MAX_INDEX_BYTES });
      } catch { invalid(); }
      if (bytes.length !== manifest.bytes || digest(bytes) !== manifest.digest) invalid();
      let index: unknown;
      try { index = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
      catch { invalid(); }
      validateIndex(index);
      return index;
    }

    try { return await read(); }
    catch (error) {
      if (error instanceof CacheIntegrityError) {
        try {
          await cache.invalidate(tag);
          return await read();
        } catch (repairError) { options.onCacheError?.(repairError); }
      } else options.onCacheError?.(error);
      // A cache/backend failure cannot make valid Storage artwork unavailable.
      // Parser/network failures still reject and are removed from memory.
      return (await build()).index;
    }
  }

  return {
    load(source: string, derive: () => Promise<PcbSpatialIndex>, persistent: boolean) {
      const cached = memory.get(source);
      if (cached) {
        memory.delete(source);
        memory.set(source, cached);
        return cached;
      }
      while (memory.size >= memoryLimit) memory.delete(memory.keys().next().value!);
      const promise = Promise.resolve().then(() => persistent ? persisted(source, derive) : derive());
      memory.set(source, promise);
      void promise.catch(() => { if (memory.get(source) === promise) memory.delete(source); });
      return promise;
    },
    get memorySize() { return memory.size; },
  };
}
