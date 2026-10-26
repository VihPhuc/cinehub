import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const swSource = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8');

type FetchListener = (event: {
  request: { method: string; url: string; mode: string; destination: string; cache?: string };
  respondWith: (response: Promise<Response>) => void;
}) => void;

type MessageListener = (event: {
  data?: { type?: string };
  waitUntil: (promise: Promise<unknown>) => void;
}) => void;

function createHarness(cachedResponse?: Response) {
  const listeners = new Map<string, unknown>();
  const deletedCaches: string[] = [];
  const cache = {
    add: vi.fn(async () => undefined),
    delete: vi.fn(async () => true),
    keys: vi.fn(async () => []),
    match: vi.fn(async () => cachedResponse),
    put: vi.fn(async () => undefined),
  };
  const caches = {
    delete: vi.fn(async (name: string) => {
      deletedCaches.push(name);
      return true;
    }),
    keys: vi.fn(async () => ['cinehub-shell-v6', 'cinehub-api-v3', 'other-cache']),
    match: vi.fn(async () => undefined),
    open: vi.fn(async () => cache),
  };
  const fetchMock = vi.fn();
  const context = vm.createContext({
    caches,
    console,
    Date,
    fetch: fetchMock,
    JSON,
    Promise,
    Response,
    setTimeout,
    clearTimeout,
    URL,
    self: {
      addEventListener: (type: string, listener: unknown) => listeners.set(type, listener),
      clients: { claim: vi.fn(async () => undefined) },
      location: { origin: 'https://app.test' },
      skipWaiting: vi.fn(async () => undefined),
    },
  });

  vm.runInContext(swSource, context);

  const dispatchFetch = async (
    url = 'https://phimapi.com/test',
    requestInit: { cache?: string } = {}
  ): Promise<Response> => {
    const respondWith = vi.fn();
    (listeners.get('fetch') as FetchListener)({
      request: { method: 'GET', url, mode: 'cors', destination: '', ...requestInit },
      respondWith,
    });
    expect(respondWith).toHaveBeenCalledTimes(1);
    return respondWith.mock.calls[0][0];
  };

  return { cache, caches, deletedCaches, dispatchFetch, fetchMock, listeners };
}

function jsonResponse(body: unknown, date = new Date()): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      Date: date.toUTCString(),
    },
  });
}

describe('service worker api cache', () => {
  it('refetches when the cached api response is older than the ttl', async () => {
    const stale = jsonResponse({ value: 'stale' }, new Date(Date.now() - 5 * 60 * 1000));
    const harness = createHarness(stale);
    harness.fetchMock.mockResolvedValue(jsonResponse({ value: 'fresh' }));

    const response = await harness.dispatchFetch();

    await expect(response.json()).resolves.toEqual({ value: 'fresh' });
    expect(harness.fetchMock).toHaveBeenCalledTimes(1);
    expect(harness.cache.put).toHaveBeenCalledTimes(1);
  });

  it('returns a fresh cached api response without waiting for the network', async () => {
    const fresh = jsonResponse({ value: 'cached' });
    const harness = createHarness(fresh);
    harness.fetchMock.mockResolvedValue(jsonResponse({ value: 'network' }));

    const response = await harness.dispatchFetch();

    await expect(response.json()).resolves.toEqual({ value: 'cached' });
    expect(harness.fetchMock).toHaveBeenCalledTimes(1);
  });

  it('bypasses cache and fetches network when request cache is no-store', async () => {
    const fresh = jsonResponse({ value: 'cached' });
    const harness = createHarness(fresh);
    harness.fetchMock.mockResolvedValue(jsonResponse({ value: 'bypass-fresh' }));

    const response = await harness.dispatchFetch('https://phimapi.com/test', {
      cache: 'no-store',
    });

    await expect(response.json()).resolves.toEqual({ value: 'bypass-fresh' });
    expect(harness.fetchMock).toHaveBeenCalledTimes(1);
    expect(harness.cache.put).toHaveBeenCalledTimes(1);
  });

  it('clears the api cache when the page sends CLEAR_API_CACHE', async () => {
    const harness = createHarness();
    const messageListener = harness.listeners.get('message') as MessageListener | undefined;
    expect(messageListener).toBeTypeOf('function');

    const waitUntil = vi.fn();
    messageListener?.({ data: { type: 'CLEAR_API_CACHE' }, waitUntil });
    const clearPromise = waitUntil.mock.calls[0][0] as Promise<unknown>;
    await clearPromise;

    expect(harness.deletedCaches).toContain('cinehub-api-v4');
  });

  it('routes backend /api/compat requests to api cache', async () => {
    const harness = createHarness();
    harness.fetchMock.mockResolvedValue(jsonResponse({ status: true, message: 'compat' }));

    const response = await harness.dispatchFetch('http://localhost:3001/api/compat/v1/api/danh-sach/phim-le');

    await expect(response.json()).resolves.toEqual({ status: true, message: 'compat' });
    expect(harness.fetchMock).toHaveBeenCalledTimes(1);
    expect(harness.cache.put).toHaveBeenCalledTimes(1);
  });

  it('routes backend /api/v1 normalized requests to api cache', async () => {
    const harness = createHarness();
    harness.fetchMock.mockResolvedValue(jsonResponse({ items: [], pagination: { page: 1 } }));

    const response = await harness.dispatchFetch('http://localhost:3001/api/v1/movies');

    await expect(response.json()).resolves.toEqual({ items: [], pagination: { page: 1 } });
    expect(harness.fetchMock).toHaveBeenCalledTimes(1);
    expect(harness.cache.put).toHaveBeenCalledTimes(1);
  });

  it('does not cache error responses (404/502) in service worker', async () => {
    const harness = createHarness();
    harness.fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ statusCode: 404, message: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const response = await harness.dispatchFetch('http://localhost:3001/api/compat/phim/not-found');

    expect(response.status).toBe(404);
    expect(harness.cache.put).not.toHaveBeenCalled();
  });

  it('returns 503 json when offline and no cache entry exists without caching', async () => {
    const harness = createHarness();
    harness.fetchMock.mockRejectedValue(new Error('Network error'));

    const response = await harness.dispatchFetch('http://localhost:3001/api/compat/v1/api/danh-sach/phim-le');

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ status: false, message: 'offline' });
    expect(harness.cache.put).not.toHaveBeenCalled();
  });
});


