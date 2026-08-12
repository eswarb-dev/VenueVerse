type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

export function getCachedValue<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCachedValue<T>(key: string, value: T, ttlMs: number) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs
  });
}

export function clearCachedValue(keyPrefix: string) {
  Array.from(cache.keys()).forEach((key) => {
    if (key.startsWith(keyPrefix)) cache.delete(key);
  });
  Array.from(inFlight.keys()).forEach((key) => {
    if (key.startsWith(keyPrefix)) inFlight.delete(key);
  });
}

export async function withCache<T>(key: string, ttlMs: number, loader: () => Promise<T>, forceRefresh = false): Promise<T> {
  if (!forceRefresh) {
    const cached = getCachedValue<T>(key);
    if (cached !== null) return cached;

    const pending = inFlight.get(key);
    if (pending) return pending as Promise<T>;
  }

  const request = loader()
    .then((value) => {
      setCachedValue(key, value, ttlMs);
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request;
}

export async function measureAsync<T>(label: string, action: () => Promise<T>): Promise<T> {
  if (!__DEV__) return action();

  const startedAt = Date.now();
  try {
    return await action();
  } finally {
    console.log(`[perf] ${label} ${Date.now() - startedAt}ms`);
  }
}
