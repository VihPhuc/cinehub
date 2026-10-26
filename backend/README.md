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
npm run index:refresh
```

All tests use a local upstream stub; they never call PhimAPI.

`npm run index:refresh` crawls the four catalog types into
`data/catalog-index.json`. It is the only way to build or refresh the catalog
index; restart the API afterwards so it loads the new snapshot.

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
CATALOG_INDEX_PATH=data/catalog-index.json
CATALOG_INDEX_CONCURRENCY=8
```

## Cache

In-memory TTL + LRU, 500 entries by default, with single-flight request
deduplication. Restart clears it. Replace `CacheStore` with Redis later if
multiple instances are needed.

The compat and normalized surfaces share the same raw upstream cache key, so a
compat request can warm the cache for `/api/v1`. Failed envelopes
(`status:false`), errors, and malformed payloads are never cached.

## Catalog index and discovery

PhimAPI ignores `rating`, `language`, `chieurap`, and `name` as sort/filter
fields. To make those facets work across the whole catalog, the backend keeps a
JSON snapshot of the four catalog types (`phim-le`, `phim-bo`, `hoat-hinh`,
`tv-shows`) in memory:

```bash
npm run index:refresh
# then restart the API
```

- Snapshot: `backend/data/catalog-index.json` (gitignored), override with
  `CATALOG_INDEX_PATH`.
- Crawl concurrency: `CATALOG_INDEX_CONCURRENCY` (default 8, range 1–32).
- `GET /api/v1/discover` serves full-catalog sort/filter/facets from the
  snapshot; it is independent of the upstream cache.
- Until the snapshot exists or if it is corrupt, `/api/v1/discover` returns
  `503` and the app plus all older routes keep working.
- Refreshes are atomic: a failed crawl leaves the previous snapshot untouched.
- Existing `/api/v1` routes, `/movies/new`, and `/search` are unchanged.

Cast/crew search is not included: it would require crawling roughly 30k detail
pages.

## Scope

Phase 1 is proxy/cache/normalized API only. No auth, DB, comments, admin, or
HLS/iframe proxying. The catalog index is a local JSON snapshot plus an
in-memory query layer; it adds no database or new runtime dependency.
