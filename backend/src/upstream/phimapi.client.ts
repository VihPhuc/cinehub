import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UpstreamError } from './upstream.errors';

export const UPSTREAM_FETCH = Symbol('UPSTREAM_FETCH');
export type UpstreamQuery = Record<string, string | number | boolean | undefined>;

@Injectable()
export class PhimApiClient {
  private readonly logger = new Logger(PhimApiClient.name);

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
            await this.sleep(Math.min((retryAfter ?? 0.25) * 1000, 2000));
            continue;
          }
          throw new UpstreamError('RATE_LIMIT', 'Upstream rate limit', retryAfter);
        }
        if (response.status >= 500) {
          if (attempt < retries) {
            await this.sleep(this.backoff());
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
        if (!response.body) {
          throw new UpstreamError('BAD_RESPONSE', 'Upstream returned an empty body');
        }
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let totalBytes = 0;
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            totalBytes += value.byteLength;
            if (totalBytes > maxBytes) {
              await reader.cancel();
              throw new UpstreamError('BAD_RESPONSE', 'Upstream response too large');
            }
            chunks.push(value);
          }
        } finally {
          reader.releaseLock();
        }
        const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));

        try {
          return JSON.parse(buffer.toString('utf8')) as T;
        } catch {
          throw new UpstreamError('BAD_RESPONSE', 'Upstream returned invalid JSON');
        }
      } catch (error) {
        if (error instanceof UpstreamError) {
          if (error.code === 'BAD_RESPONSE' || error.code === 'NOT_FOUND') {
            this.logFailure(path, error);
            throw error;
          }
          lastError = error;
        } else if (this.isAbortError(error)) {
          lastError = new UpstreamError('TIMEOUT', 'Upstream timeout');
        } else {
          lastError = new UpstreamError('UNAVAILABLE', 'Network error');
        }

        if (attempt >= retries) {
          this.logFailure(path, lastError);
          throw lastError;
        }
        await this.sleep(this.backoff());
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError ?? new UpstreamError('UNAVAILABLE', 'Upstream unavailable');
  }

  private logFailure(path: string, error: UpstreamError): void {
    this.logger.warn(`upstream failure path=${path} code=${error.code}`);
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
    if (Number.isFinite(seconds) && seconds >= 0) return seconds;
    const timestamp = Date.parse(raw);
    if (!Number.isFinite(timestamp)) return undefined;
    return Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
  }

  private backoff(): number {
    return 250 + Math.floor(Math.random() * 100);
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
