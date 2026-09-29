import type { PcbPath, PcbRegion } from "./spatial";

export const PCB_GEOMETRY_CACHE_LIMIT = 128;
export const PCB_GEOMETRY_BATCH_LIMIT = 8;
export const PCB_GEOMETRY_TIMEOUT_MS = 20_000;

type GeometryEntry = {
  key: string;
  url: string;
  region: PcbRegion;
  promise: Promise<PcbPath[]>;
  resolve: (paths: PcbPath[]) => void;
  reject: (error: unknown) => void;
  state: "pending" | "fulfilled" | "rejected";
  paths?: PcbPath[];
  delivery?: GeometryDelivery;
};

type GeometryDelivery = {
  consumers: Set<GeometryEntry>;
  controller: AbortController | null;
  timer: ReturnType<typeof setTimeout> | null;
  finished: boolean;
  cancelWait: () => void;
  cancelled: Promise<null>;
};

class GeometryTransportError extends Error {
  retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.retryable = retryable;
  }
}

function covers(outer: PcbRegion, inner: PcbRegion) {
  return outer.x <= inner.x && outer.y <= inner.y &&
    outer.x + outer.width >= inner.x + inner.width &&
    outer.y + outer.height >= inner.y + inner.height;
}

/** Retain server source order and conservative bounds, including edge contacts. */
export function selectDeliveredGeometry(paths: PcbPath[], region: PcbRegion) {
  return paths.filter((path) => path.right >= region.x &&
    path.left <= region.x + region.width && path.bottom >= region.y &&
    path.top <= region.y + region.height);
}

function validateRegion(region: PcbRegion) {
  if (!region || [region.x, region.y, region.width, region.height].some((value) =>
    typeof value !== "number" || !Number.isFinite(value)) ||
    Math.abs(region.x) > 100_000 || Math.abs(region.y) > 100_000 ||
    region.width <= 0 || region.height <= 0 ||
    region.width > 65_536 || region.height > 65_536) {
    throw new Error("Invalid PCB geometry region.");
  }
}

function validatePaths(value: unknown): PcbPath[] {
  if (!Array.isArray(value) || value.length > 2_500) {
    throw new GeometryTransportError("Invalid PCB geometry response.", false);
  }
  let sourceBytes = 0;
  for (const path of value) {
    if (!path || typeof path.source !== "string" ||
      [path.left, path.top, path.right, path.bottom].some((bound) =>
        typeof bound !== "number" || !Number.isFinite(bound)) ||
      path.left > path.right || path.top > path.bottom) {
      throw new GeometryTransportError("Invalid PCB geometry bounds.", false);
    }
    sourceBytes += path.source.length;
  }
  if (sourceBytes > 5 * 1024 * 1024) {
    throw new GeometryTransportError("PCB geometry exceeds the source limit.", false);
  }
  return value as PcbPath[];
}

/** One bounded cache of regional promises; acquisition is independent of paint. */
export function createGeometryDeliveryBroker(options: {
  fetcher?: typeof fetch;
  timeoutMs?: number;
  cacheLimit?: number;
} = {}) {
  const fetcher = options.fetcher ?? ((input, init) => fetch(input, init));
  const timeoutMs = options.timeoutMs ?? PCB_GEOMETRY_TIMEOUT_MS;
  const cacheLimit = options.cacheLimit ?? PCB_GEOMETRY_CACHE_LIMIT;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 ||
    !Number.isInteger(cacheLimit) || cacheLimit < 1 || cacheLimit > PCB_GEOMETRY_CACHE_LIMIT) {
    throw new Error("Invalid PCB delivery limits.");
  }
  const cache = new Map<string, GeometryEntry>();
  // Eviction never cancels a caller. Pending consumers remain rescuable by a
  // containing fulfillment, even when their cache entry has been evicted.
  const pending = new Set<GeometryEntry>();

  function touch(entry: GeometryEntry) {
    if (cache.get(entry.key) !== entry) return;
    cache.delete(entry.key);
    cache.set(entry.key, entry);
  }

  function insert(entry: GeometryEntry) {
    while (cache.size >= cacheLimit) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
    cache.set(entry.key, entry);
  }

  function endDelivery(delivery: GeometryDelivery, abort: boolean) {
    if (delivery.finished) return;
    delivery.finished = true;
    if (delivery.timer !== null) clearTimeout(delivery.timer);
    delivery.timer = null;
    delivery.cancelWait();
    if (abort) delivery.controller?.abort(new Error("PCB geometry was supplied by a covering delivery."));
  }

  function fulfill(entry: GeometryEntry, paths: PcbPath[]) {
    if (entry.state !== "pending") return;
    entry.state = "fulfilled";
    entry.paths = paths;
    pending.delete(entry);
    entry.resolve(paths);
    const delivery = entry.delivery;
    if (delivery) {
      delivery.consumers.delete(entry);
      // Only abort when EVERY consumer attached to this transport already has
      // equivalent geometry. Touch cancellation never aborts shared transport.
      if (delivery.consumers.size === 0) endDelivery(delivery, true);
    }
  }

  function publish(entry: GeometryEntry, paths: PcbPath[]) {
    fulfill(entry, paths);
    touch(entry);
    for (const narrower of pending) {
      if (narrower.url === entry.url && covers(entry.region, narrower.region)) {
        fulfill(narrower, selectDeliveredGeometry(paths, narrower.region));
      }
    }
  }

  function lookup(url: string, region: PcbRegion) {
    validateRegion(region);
    const key = JSON.stringify([url, region.x, region.y, region.width, region.height]);
    const existing = cache.get(key);
    if (existing) { touch(existing); return { entry: existing, created: false }; }
    let covering: GeometryEntry | undefined;
    for (const candidate of cache.values()) {
      if (candidate.url === url && candidate.state === "fulfilled" && covers(candidate.region, region) &&
        (!covering || candidate.region.width * candidate.region.height < covering.region.width * covering.region.height)) {
        covering = candidate;
      }
    }
    let resolve!: GeometryEntry["resolve"];
    let reject!: GeometryEntry["reject"];
    const promise = new Promise<PcbPath[]>((yes, no) => { resolve = yes; reject = no; });
    const entry: GeometryEntry = {
      key, url, region: { ...region }, promise, resolve, reject, state: "pending",
    };
    if (covering) touch(covering);
    insert(entry);
    pending.add(entry);
    if (covering) {
      fulfill(entry, selectDeliveredGeometry(covering.paths!, region));
      return { entry, created: false };
    }
    return { entry, created: true };
  }

  async function request(entries: GeometryEntry[], batch: boolean, signal: AbortSignal) {
    const params = new URLSearchParams({ source: entries[0].url });
    if (batch) {
      params.set("regions", JSON.stringify(entries.map((entry) => entry.region)));
    } else {
      for (const [name, value] of Object.entries(entries[0].region)) params.set(name, String(value));
    }
    let response: Response;
    try { response = await fetcher(`/api/pcb?${params}`, { signal }); }
    catch (error) { throw new GeometryTransportError(error instanceof Error ? error.message : "PCB network delivery failed.", true); }
    if (!response.ok) throw new GeometryTransportError(`PCB projection failed: ${response.status}`, false);
    let result: { paths?: unknown; regions?: unknown };
    try { result = await response.json(); }
    catch (error) { throw new GeometryTransportError(error instanceof Error ? error.message : "PCB response delivery failed.", !(error instanceof SyntaxError)); }
    if (!result || typeof result !== "object") throw new GeometryTransportError("Invalid PCB geometry response.", false);
    const paths = validatePaths(result.paths);
    if (!batch) return [paths];
    if (!Array.isArray(result.regions) || result.regions.length !== entries.length) {
      throw new GeometryTransportError("Invalid PCB batch response.", false);
    }
    return result.regions.map((indices: unknown) => {
      if (!Array.isArray(indices)) throw new GeometryTransportError("Invalid PCB batch indices.", false);
      let previous = -1;
      return indices.map((index: unknown) => {
        if (typeof index !== "number" || !Number.isInteger(index) || index <= previous || index >= paths.length) {
          throw new GeometryTransportError("Invalid PCB batch path order.", false);
        }
        previous = index;
        return paths[index];
      });
    });
  }

  function start(entries: GeometryEntry[], batch: boolean) {
    if (entries.length === 0) return;
    let cancelWait!: () => void;
    const cancelled = new Promise<null>((resolve) => { cancelWait = () => resolve(null); });
    const delivery: GeometryDelivery = {
      consumers: new Set(entries), controller: null, timer: null,
      finished: false, cancelled, cancelWait,
    };
    for (const entry of entries) entry.delivery = delivery;
    void (async () => {
      for (let attempt = 0; attempt < 2 && !delivery.finished; attempt += 1) {
        delivery.controller = new AbortController();
        const signal = delivery.controller.signal;
        const timeout = new Promise<never>((_, reject) => {
          delivery.timer = setTimeout(() => {
            reject(new GeometryTransportError("PCB geometry delivery timed out.", true));
            delivery.controller?.abort(new Error("PCB geometry delivery timed out."));
          }, timeoutMs);
        });
        try {
          // The deadline includes response.json(), not only response headers.
          // A covering result resolves consumers and this wait independently
          // of a redundant fetch whose body may never settle.
          const result = await Promise.race([request(entries, batch, signal), timeout, delivery.cancelled]);
          if (delivery.finished || result === null) return;
          endDelivery(delivery, false);
          for (let index = 0; index < entries.length; index += 1) publish(entries[index], result[index]);
          return;
        } catch (error) {
          if (delivery.timer !== null) clearTimeout(delivery.timer);
          delivery.timer = null;
          if (delivery.finished) return;
          delivery.controller.abort(error);
          if (attempt === 0 && error instanceof GeometryTransportError && error.retryable) continue;
          endDelivery(delivery, false);
          for (const entry of delivery.consumers) {
            if (entry.state !== "pending") continue;
            entry.state = "rejected";
            pending.delete(entry);
            if (cache.get(entry.key) === entry) cache.delete(entry.key);
            entry.reject(error);
          }
          delivery.consumers.clear();
          return;
        }
      }
    })();
  }

  return {
    load(url: string, region: PcbRegion) {
      const { entry, created } = lookup(url, region);
      if (created) start([entry], false);
      return entry.promise;
    },
    loadBatch(url: string, regions: PcbRegion[]) {
      if (!Array.isArray(regions) || regions.length < 1 || regions.length > PCB_GEOMETRY_BATCH_LIMIT) {
        throw new Error("PCB geometry batches require between 1 and 8 regions.");
      }
      // Validate the complete batch before creating any unresolved consumers.
      regions.forEach(validateRegion);
      const lookedUp = regions.map((region) => lookup(url, region));
      const created = lookedUp.filter((item) => item.created).map((item) => item.entry);
      start(created, true);
      return Promise.all(lookedUp.map((item) => item.entry.promise));
    },
    get cacheSize() { return cache.size; },
  };
}
