// Client-side cache for instant tab switching
const cache = new Map();
const CACHE_TTL = 60000; // 60 seconds

export async function cachedFetch(url, options) {
  const key = url + JSON.stringify(options || {});
  const cached = cache.get(key);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.cachedResponse;
  }
  
  const response = await fetch(url, options);
  const clonedResponse = response.clone();
  
  cache.set(key, {
    timestamp: Date.now(),
    cachedResponse: clonedResponse,
  });
  
  return response;
}

export function invalidateCache() {
  cache.clear();
}

export function invalidateCachePrefix(prefix) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}
