import { Inject, Injectable } from '@nestjs/common';
import { CACHE_STORE, type CacheStore, type CachedResult } from '../cache/cache.interface';
import { PhimApiClient, type UpstreamQuery } from './phimapi.client';

function canonicalQuery(query: UpstreamQuery): string {
  return Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}

function isFailedEnvelope(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    (value as { status?: unknown }).status === false
  );
}

function isCacheable(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !isFailedEnvelope(value)
  );
}

@Injectable()
export class PhimApiService {
  constructor(
    @Inject(CACHE_STORE) private readonly cache: CacheStore,
    private readonly client: PhimApiClient
  ) {}

  get<T>(path: string, query: UpstreamQuery, ttlMs: number): Promise<CachedResult<T>> {
    const queryString = canonicalQuery(query);
    const key = `phimapi:GET:${path}?${queryString}`;

    return this.cache.getOrLoad<T>(
      key,
      ttlMs,
      () => this.client.getJson<T>(path, query),
      (value) => isCacheable(value)
    );
  }
}
