import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UpstreamError } from './upstream.errors';

export const UPSTREAM_FETCH = Symbol('UPSTREAM_FETCH');
export type UpstreamQuery = Record<string, string | number | boolean | undefined>;

@Injectable()
export class PhimApiClient {
  constructor(
    private readonly config: ConfigService,
    @Inject(UPSTREAM_FETCH) private readonly fetchFn: typeof fetch
  ) {}

  async getJson<T>(path: string, query: UpstreamQuery = {}): Promise<T> {
    if (!/^\/[a-zA-Z0-9/_-]+$/.test(path) || path.includes('..')) {
      throw new UpstreamError('BAD_RESPONSE', 'Invalid upstream path');
    }

    const url = this.buildUrl(path, query);
    const timeoutMs = this.config.getOrThrow<number>('upstream.timeoutMs');
    const retries = this.config.getOrThrow<number>('upstream.retries');
    const totalTimeoutMs = this.config.getOrThrow<number>('upstream.totalTimeoutMs');
    const maxBytes = this.config.getOrThrow<number>('upstream.maxBytes');
    const deadline = Date.now() + totalTimeoutMs;
    let lastError: UpstreamError | undefined;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new UpstreamError('TIMEOUT', 'Upstream timeout');
      }

      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        Math.min(timeoutMs, remaining)
      );

      try {
        const response = await this.fetchFn(url, {
          method: 'GET',
          headers: {
            accept: 'application/json',
            'user-agent': 'CineHubBackend/0.1.0',
          },
          redirect: 'manual',
          signal: controller.signal,
        });

        if (response.status >= 300 && response.status < 400) {
          throw new UpstreamError('BAD_RESPONSE', 'Unexpected upstream redirect');
        }
        if (response.status === 404) {
          throw new UpstreamError('NOT_FOUND', 'Upstream resource not found');
        }
        if (response.status === 429) {
          const retryAfter = this.retryAfter(response);
          if (attempt < retries) {
            await this.sleep(Math.min(retryAfter ?? 250, 2000));
            continue;
          }
          throw new UpstreamError('RATE_LIMIT', 'Upstream rate limit', retryAfter);
        }
        if (response.status >= 500) {
          if (attempt < retries) {
            await this.sleep(250);
            continue;
          }
          throw new UpstreamError('UNAVAILABLE', 'Upstream server error');
        }
        if (!response.ok) {
          throw new UpstreamError('BAD_RESPONSE', `Upstream status ${response.status}`);
        }

        const contentLength = Number(response.headers.get('content-length') ?? 0);
        if (contentLength > maxBytes) {
          throw new UpstreamError('BAD_RESPONSE', 'Upstream response too large');
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.byteLength > maxBytes) {
          throw new UpstreamError('BAD_RESPONSE', 'Upstream response too large');
        }

        try {
          return JSON.parse(buffer.toString('utf8')) as T;
        } catch {
          throw new UpstreamError('BAD_RESPONSE', 'Upstream returned invalid JSON');
        }
      } catch (error) {
        if (error instanceof UpstreamError) {
          if (error.code === 'BAD_RESPONSE' || error.code === 'NOT_FOUND') {
            throw error;
          }
          lastError = error;
        } else if (this.isAbortError(error)) {
          lastError = new UpstreamError('TIMEOUT', 'Upstream timeout');
        } else {
          lastError = new UpstreamError('UNAVAILABLE', 'Network error');
        }

        if (attempt >= retries) {
          throw lastError;
        }
        await this.sleep(250);
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError ?? new UpstreamError('UNAVAILABLE', 'Upstream unavailable');
  }

  private buildUrl(path: string, query: UpstreamQuery): string {
    const base = this.config.getOrThrow<string>('upstream.baseUrl');
    const baseWithSlash = base.endsWith('/') ? base : `${base}/`;
    const url = new URL(path.replace(/^\/+/, ''), baseWithSlash);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  private retryAfter(response: Response): number | undefined {
    const raw = response.headers.get('retry-after');
    if (!raw) return undefined;
    const seconds = Number(raw);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
  }

  private isAbortError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      (error as { name?: unknown }).name === 'AbortError'
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
