# CineHub Backend

NestJS proxy/cache/normalized API for CineHub.

## Requirements

- Node.js 22+
- npm

## Run local

```bash
cd backend
npm ci
cp .env.example .env
npm run start:dev
```

API: `http://localhost:3001/api/health`
Swagger: `http://localhost:3001/api/docs`

Set `SWAGGER_ENABLED=false` to disable Swagger. In production it is disabled by
default unless explicitly enabled.

## Scripts

```bash
npm run build
npm run start:dev
npm run lint
npm test
npm run test:e2e
```

All tests use a local upstream stub; they never call PhimAPI.

## Configuration

Copy `.env.example` to `.env` and adjust as needed:

```dotenv
PORT=3001
HOST=0.0.0.0
PHIMAPI_BASE_URL=https://phimapi.com
CORS_ORIGINS=http://localhost:5173,http://localhost:4173
CACHE_MAX_ENTRIES=500
CACHE_TTL_LIST_MS=240000
CACHE_TTL_NEW_MS=120000
CACHE_TTL_SEARCH_MS=60000
CACHE_TTL_DETAIL_MS=360000
UPSTREAM_TIMEOUT_MS=5000
UPSTREAM_RETRIES=1
UPSTREAM_TOTAL_TIMEOUT_MS=9000
UPSTREAM_MAX_BYTES=2000000
RATE_LIMIT_TTL_MS=60000
RATE_LIMIT_LIMIT=120
TRUST_PROXY=false
SWAGGER_ENABLED=true
```

## Cache

In-memory TTL + LRU, 500 entries by default, with single-flight request
deduplication. Restart clears it. Replace `CacheStore` with Redis later if
multiple instances are needed.

The compat and normalized surfaces share the same raw upstream cache key, so a
compat request can warm the cache for `/api/v1`. Failed envelopes
(`status:false`), errors, and malformed payloads are never cached.

## Scope

Phase 1 is proxy/cache/normalized API only. No auth, DB, comments, admin, or
HLS/iframe proxying.
