// Tiny localStorage-backed external store with in-memory fallback. Safe on the server and when storage throws.
export function createStore<T>(key: string, initial: T, parse: (raw: string) => T) {
  let current: T | undefined;
  const listeners = new Set<() => void>();

  const read = (): T => {
    if (current === undefined) {
      try {
        const raw = localStorage.getItem(key);
        current = raw === null ? initial : parse(raw);
      } catch {
        current = initial;
      }
    }
    return current;
  };

  return {
    get: read,
    getServer: (): T => initial,
    set(next: T, serialize: (v: T) => string | null) {
      current = next;
      try {
        const s = serialize(next);
        if (s === null) localStorage.removeItem(key);
        else localStorage.setItem(key, s);
      } catch {
        /* storage unavailable: memory only */
      }
      listeners.forEach((l) => l());
    },
    has(): boolean {
      try {
        return localStorage.getItem(key) !== null;
      } catch {
        return false;
      }
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    reset() {
      current = undefined;
      listeners.forEach((l) => l());
    },
  };
}
