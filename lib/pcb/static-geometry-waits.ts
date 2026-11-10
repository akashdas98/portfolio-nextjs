/** Let an obsolete geometry wait yield decode ownership without canceling shared delivery. */
export function createStaticGeometryWaits() {
  const waiting = new Set<() => void>();
  let cancelled = false;
  return {
    wait<T>(promise: Promise<T>, shouldYield: () => boolean): Promise<{ value: T } | null> {
      if (cancelled) {
        void promise.catch(() => {});
        return Promise.resolve(null);
      }
      return new Promise((resolve, reject) => {
        let settled = false;
        function finish(result: { value: T } | null, failed = false, error?: unknown) {
          if (settled) return;
          settled = true;
          waiting.delete(check);
          if (failed) reject(error);
          else resolve(result);
        }
        function check() {
          if (cancelled || shouldYield()) finish(null);
        }
        waiting.add(check);
        promise.then((value) => finish({ value }), (error) => finish(null, true, error));
        check();
      });
    },
    notify() { for (const check of [...waiting]) check(); },
    cancel() {
      cancelled = true;
      for (const check of [...waiting]) check();
    },
  };
}

/** Keep staged acquisition bounded even when scroll repeatedly replaces worker demand. */
export function stageStaticGeometry<T>(
  staged: Map<string, { promise: Promise<T>; release: () => void }>,
  active: ReadonlySet<string>,
  keys: string[],
  acquire: () => Array<{ promise: Promise<T>; release: () => void }>,
) {
  if (keys.length > 8) throw new Error("PCB static cohorts cannot exceed eight regions.");
  for (const [key, handle] of staged) {
    if (staged.size + keys.length <= 16) break;
    if (!active.has(key)) {
      staged.delete(key);
      handle.release();
    }
  }
  if (staged.size + keys.length > 16) throw new Error("PCB static staging is full.");
  const handles = acquire();
  keys.forEach((key, index) => staged.set(key, handles[index]));
}
