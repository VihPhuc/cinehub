export default () => ({
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? '0.0.0.0',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  upstream: {
    baseUrl: process.env.PHIMAPI_BASE_URL ?? 'https://phimapi.com',
    timeoutMs: Number(process.env.UPSTREAM_TIMEOUT_MS ?? 5000),
    retries: Number(process.env.UPSTREAM_RETRIES ?? 1),
    totalTimeoutMs: Number(process.env.UPSTREAM_TOTAL_TIMEOUT_MS ?? 9000),
    maxBytes: Number(process.env.UPSTREAM_MAX_BYTES ?? 2_000_000),
  },
  cache: {
    maxEntries: Number(process.env.CACHE_MAX_ENTRIES ?? 500),
    ttlListMs: Number(process.env.CACHE_TTL_LIST_MS ?? 240_000),
    ttlNewMs: Number(process.env.CACHE_TTL_NEW_MS ?? 120_000),
    ttlSearchMs: Number(process.env.CACHE_TTL_SEARCH_MS ?? 60_000),
    ttlDetailMs: Number(process.env.CACHE_TTL_DETAIL_MS ?? 360_000),
  },
  cors: {
    origins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:4173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  },
  rateLimit: {
    ttlMs: Number(process.env.RATE_LIMIT_TTL_MS ?? 60_000),
    limit: Number(process.env.RATE_LIMIT_LIMIT ?? 120),
  },
  trustProxy: process.env.TRUST_PROXY === 'true',
  swagger: {
    enabled:
      process.env.SWAGGER_ENABLED === 'true' ||
      (process.env.SWAGGER_ENABLED !== 'false' && process.env.NODE_ENV !== 'production'),
  },
});
