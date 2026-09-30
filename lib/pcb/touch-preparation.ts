/** Cancel this consumer's wait without cancelling a shared geometry fetch. */
export function waitForTouchPreparation<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work;
  return new Promise<T>((resolve, reject) => {
    const abort = () => { signal.removeEventListener("abort", abort); reject(signal.reason); };
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener("abort", abort, { once: true });
  });
}

/** One retained region and one replaceable intent. Async work owns no published pixels. */
export function createTouchPreparation<Request extends { key: string }, Prepared>(options: {
  prepare: (request: Request, isCurrent: () => boolean, signal: AbortSignal) => Promise<Prepared>;
  release: (prepared: Prepared) => void;
  ready: () => void;
  failed?: (error: unknown) => void;
  cancelled?: () => void;
}) {
  let active: Prepared | null = null;
  let wanted: Request | null = null;
  let running = false;
  let disposed = false;
  let revision = 0;
  let cancellation: AbortController | null = null;

  async function drain() {
    if (running || disposed) return;
    running = true;
    try {
      while (wanted && !disposed) {
        const request = wanted;
        const intent = revision;
        const controller = new AbortController();
        cancellation = controller;
        const isCurrent = () => !disposed && revision === intent && wanted === request;
        try {
          const prepared = await options.prepare(request, isCurrent, controller.signal);
          if (!isCurrent()) {
            if (prepared !== active) options.release(prepared);
            continue;
          }
          const previous = active;
          active = prepared;
          wanted = null;
          // Published front pixels remain independent of these backing resources.
          if (previous && previous !== prepared) options.release(previous);
          options.ready();
        } catch (error) {
          if (isCurrent()) {
            wanted = null;
            options.failed?.(error);
          } else {
            options.cancelled?.();
          }
        }
      }
    } finally {
      cancellation = null;
      running = false;
    }
  }

  return {
    get active() { return active; },
    get wanted() { return wanted; },
    get running() { return running; },
    want(request: Request | null) {
      if (disposed || wanted?.key === request?.key) return;
      revision += 1;
      wanted = request;
      cancellation?.abort(new Error("Touch preparation was superseded."));
      void drain();
    },
    reset() {
      revision += 1;
      wanted = null;
      cancellation?.abort(new Error("Touch preparation was reset."));
      if (active) options.release(active);
      active = null;
    },
    dispose() {
      disposed = true;
      this.reset();
    },
  };
}

/** The browser cannot paint between these synchronous writes. A failed back paint
 * leaves both the front pixels and their page-local origin untouched. */
export function publishTouchMainCanvas(
  surfaces: ReadonlyArray<{ style: { transform: string; visibility: string } }>,
  front: number | null,
  point: { x: number; y: number },
  diameter: number,
  paint: (back: number) => boolean,
) {
  const back = front === 0 ? 1 : 0;
  try {
    if (!paint(back)) return front;
  } catch {
    return front;
  }
  surfaces[back].style.transform =
    `translate3d(${point.x - diameter / 2}px,${point.y - diameter / 2}px,0)`;
  surfaces[back].style.visibility = "visible";
  if (front !== null) surfaces[front].style.visibility = "hidden";
  return back;
}

/** Geometry-only ahead-of-contact work retains request metadata, never pixels.
 * Cancel only this latest consumer's wait; shared delivery remains available
 * to contact, static and desktop consumers. Obsolete reads cannot serialize
 * the current viewport behind an unresolved transport.
 */
export function createTouchGeometryWarmup<Request extends { key: string }>(options: {
  load: (request: Request) => Promise<unknown>;
  failed?: (error: unknown) => void;
}) {
  return createTouchPreparation<Request, Request>({
    async prepare(request, _isCurrent, signal) {
      await waitForTouchPreparation(options.load(request), signal);
      return request;
    },
    release() {},
    ready() {},
    failed: options.failed,
  });
}

/** Replace scroll intent until it settles; layout/capability work may start immediately.
 * This bounds request churn, not the lifetime of shared HTTP transports.
 */
export function createTouchGeometryWarmSchedule(options: {
  warm: () => void;
  delay?: number;
  timer?: (callback: () => void, delay: number) => () => void;
}) {
  const timer = options.timer ?? ((callback, delay) => {
    const handle = setTimeout(callback, delay);
    return () => clearTimeout(handle);
  });
  let cancel: (() => void) | null = null;
  let disposed = false;
  function clear() { cancel?.(); cancel = null; }
  return {
    scroll() {
      if (disposed) return;
      clear();
      cancel = timer(() => { cancel = null; if (!disposed) options.warm(); }, options.delay ?? 120);
    },
    now() { if (!disposed) { clear(); options.warm(); } },
    clear,
    dispose() { disposed = true; clear(); },
  };
}
