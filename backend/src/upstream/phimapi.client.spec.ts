import type { ConfigService } from '@nestjs/config';
import { PhimApiClient } from './phimapi.client';
import { UpstreamError } from './upstream.errors';

function config(overrides: Record<string, unknown> = {}): ConfigService {
  const values: Record<string, unknown> = {
    'upstream.baseUrl': 'https://phimapi.test',
    'upstream.timeoutMs': 1000,
    'upstream.retries': 1,
    'upstream.totalTimeoutMs': 3000,
    'upstream.maxBytes': 1024 * 1024,
    ...overrides,
  };
  return { getOrThrow: (key: string) => values[key] } as unknown as ConfigService;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('PhimApiClient', () => {
  it('fetches JSON with a canonical URL', async () => {
    const fetchFn = jest.fn(async (url: string | URL | Request) => {
      expect(String(url)).toBe('https://phimapi.test/v1/api/danh-sach/phim-le?page=2');
      return jsonResponse({ status: true, data: { items: [] } });
    });
    const client = new PhimApiClient(config(), fetchFn as typeof fetch);

    const result = await client.getJson('/v1/api/danh-sach/phim-le', { page: 2 });

    expect(result).toEqual({ status: true, data: { items: [] } });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 404', async () => {
    const fetchFn = jest.fn(async () => jsonResponse({ status: false }, 404));
    const client = new PhimApiClient(config(), fetchFn as typeof fetch);

    await expect(client.getJson('/phim/missing', {})).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 401', async () => {
    const fetchFn = jest.fn(async () => jsonResponse({ error: 'unauthorized' }, 401));
    const client = new PhimApiClient(config(), fetchFn as typeof fetch);

    await expect(client.getJson('/private', {})).rejects.toMatchObject({
      code: 'BAD_RESPONSE',
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('retries a 5xx then succeeds', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500))
      .mockResolvedValueOnce(jsonResponse({ status: true, items: [] }));
    const client = new PhimApiClient(config(), fetchFn as typeof fetch);

    const result = await client.getJson('/danh-sach/phim-moi-cap-nhat', { page: 1 });

    expect(result).toEqual({ status: true, items: [] });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('honors an HTTP-date Retry-After header', async () => {
    const retryAt = new Date(Date.now() + 2000).toUTCString();
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(
        new Response('{}', { status: 429, headers: { 'retry-after': retryAt } })
      )
      .mockResolvedValueOnce(jsonResponse({ status: true, items: [] }));
    const client = new PhimApiClient(config(), fetchFn as typeof fetch);
    const sleep = jest
      .spyOn(client as unknown as { sleep: (ms: number) => Promise<void> }, 'sleep')
      .mockResolvedValue(undefined);

    await client.getJson('/danh-sach/phim-moi-cap-nhat', { page: 1 });

    expect(sleep.mock.calls[0][0]).toBeGreaterThan(500);
  });

  it('maps malformed JSON to BAD_RESPONSE without retrying', async () => {
    const fetchFn = jest.fn(async () => new Response('not-json', { status: 200 }));
    const client = new PhimApiClient(config(), fetchFn as typeof fetch);

    await expect(client.getJson('/bad', {})).rejects.toMatchObject({
      code: 'BAD_RESPONSE',
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('maps aborted requests to TIMEOUT', async () => {
    const fetchFn = jest.fn(async () => {
      throw new DOMException('Aborted', 'AbortError');
    });
    const client = new PhimApiClient(config({ 'upstream.retries': 0 }), fetchFn as typeof fetch);

    await expect(client.getJson('/slow', {})).rejects.toBeInstanceOf(UpstreamError);
    await expect(client.getJson('/slow', {})).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('rejects oversized responses', async () => {
    const fetchFn = jest.fn(async () =>
      new Response(JSON.stringify({ value: 'x'.repeat(100) }), {
        status: 200,
        headers: { 'content-length': '1000' },
      })
    );
    const client = new PhimApiClient(
      config({ 'upstream.maxBytes': 10 }),
      fetchFn as typeof fetch
    );

    await expect(client.getJson('/large', {})).rejects.toMatchObject({
      code: 'BAD_RESPONSE',
    });
  });

  it('stops reading a chunked response once the byte limit is crossed', async () => {
    let canceled = false;
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        if (pulls > 20) {
          controller.close();
          return;
        }
        controller.enqueue(new Uint8Array(64));
      },
      cancel() {
        canceled = true;
      },
    });
    const fetchFn = jest.fn(
      async () =>
        new Response(body, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
    );
    const client = new PhimApiClient(
      config({ 'upstream.maxBytes': 100 }),
      fetchFn as typeof fetch
    );

    await expect(client.getJson('/large', {})).rejects.toMatchObject({
      code: 'BAD_RESPONSE',
    });
    expect(canceled).toBe(true);
    expect(pulls).toBeLessThan(5);
  });

  it('rejects a path with traversal characters', async () => {
    const fetchFn = jest.fn();
    const client = new PhimApiClient(config(), fetchFn as typeof fetch);

    await expect(client.getJson('/../secret', {})).rejects.toMatchObject({
      code: 'BAD_RESPONSE',
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
