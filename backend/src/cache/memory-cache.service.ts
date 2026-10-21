import { Injectable } from '@nestjs/common';
import { LRUCache } from 'lru-cache';
import type { CacheStats, CacheStore, CachedResult } from './cache.interface';

@Injectable()
export class MemoryCacheService implements CacheStore {
  private readonly cache: LRUCache<string, object>;
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private hits = 0;
  private misses = 0;

  constructor(maxEntries: number) {
    this.cache = new LRUCache<string, object>({
      max: maxEntries,
      allowStale: false,
    });
  }

  async getOrLoad<T>(
    key: string,
    ttlMs: number,
    loader: () => Promise<T>,
    shouldCache: (value: T) => boolean = () => true
  ): Promise<CachedResult<T>> {
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      this.hits += 1;
      return { value: cached as T, cache: 'HIT' };
    }

    const pending = this.inFlight.get(key);
    if (pending) {
      this.misses += 1;
      const value = (await pending) as T;
      return { value, cache: 'MISS' };
    }

    this.misses += 1;
    const request = (async () => {
      try {
        const value = await loader();
        if (shouldCache(value)) {
          this.cache.set(key, value as object, { ttl: ttlMs });
        }
        return value;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, request);
    const value = (await request) as T;
    return { value, cache: 'MISS' };
  }

  getStats(): CacheStats {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      inFlight: this.inFlight.size,
    };
  }

  clear(): void {
    this.cache.clear();
  }
}
