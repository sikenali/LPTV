interface CacheEntry {
  urls: string[];
  error?: string;
  timestamp: number;
}

const CACHE_TTL = 30_000; // 30s
const cache = new Map<string, CacheEntry>();

export function getCachedUrls(tid: string, id: string): string[] | null {
  const key = `${tid}-${id}`;
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.urls;
}

export function setCachedUrls(tid: string, id: string, urls: string[], error?: string): void {
  const key = `${tid}-${id}`;
  cache.set(key, { urls, error, timestamp: Date.now() });
}
