export const CACHE_STORE = Symbol('CACHE_STORE');

export type CacheStatus = 'HIT' | 'MISS';

export interface CachedResult<T> {
  value: T;
  cache: CacheStatus;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  inFlight: number;
}

export interface CacheStore {
  getOrLoad<T>(
    key: string,
    ttlMs: number,
    loader: () => Promise<T>,
    shouldCache?: (value: T) => boolean
  ): Promise<CachedResult<T>>;
  getStats(): CacheStats;
  clear(): void;
}
