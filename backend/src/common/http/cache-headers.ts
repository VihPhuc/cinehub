import type { Response } from 'express';
import type { CacheStatus } from '../../cache/cache.interface';

export function setNoStoreHeaders(response: Response, cache?: CacheStatus): void {
  if (cache) response.setHeader('X-Cache', cache);
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Vary', 'Origin');
}

export function setCacheHeaders(
  response: Response,
  cache: CacheStatus,
  maxAgeSeconds: number,
  staleWhileRevalidate = true
): void {
  response.setHeader('X-Cache', cache);
  response.setHeader(
    'Cache-Control',
    staleWhileRevalidate
      ? `public, max-age=${maxAgeSeconds}, stale-while-revalidate=120`
      : `public, max-age=${maxAgeSeconds}`
  );
  response.setHeader('Vary', 'Origin');
}
