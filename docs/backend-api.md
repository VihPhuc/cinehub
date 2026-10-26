# CineHub Backend API — Handoff

## Run

```bash
npm ci --prefix frontend
npm ci --prefix backend
npm run dev
```

`npm run dev` starts the frontend on `http://localhost:5173` and the API on
`http://localhost:3001`. Use `npm run dev:web` or `npm run dev:api` to run
only one side.

Base URL: `http://localhost:3001/api`

Swagger: `http://localhost:3001/api/docs` (enabled outside production by
default; set `SWAGGER_ENABLED` to override). The OpenAPI document at
`/api/docs-json` includes typed response schemas, query/path parameters, and
the shared `400/404/429/502/503/504` error schema.

## Compat integration (anty)

The frontend supports `VITE_API_BASE_URL` with a PhimAPI fallback. Set:

```dotenv
VITE_API_BASE_URL=http://localhost:3001/api/compat
```

For an older checkout without env support, change only the base constant to
`http://localhost:3001/api/compat`. Do not change any other API path.

Existing paths are unchanged:

| Frontend call | Backend path |
|---|---|
| Phim mới | `/api/compat/danh-sach/phim-moi-cap-nhat?page=1` |
| Catalog | `/api/compat/v1/api/danh-sach/phim-le?page=1` |
| Genre | `/api/compat/v1/api/the-loai/hanh-dong?page=1` |
| Country | `/api/compat/v1/api/quoc-gia/viet-nam?page=1` |
| Search | `/api/compat/v1/api/tim-kiem?keyword=avatar&page=1` |
| Detail | `/api/compat/phim/phim-test` |

Compat responses are the raw PhimAPI JSON. No wrapper, no renamed fields.
CORS defaults to `http://localhost:5173` and `http://localhost:4173`. In
development any loopback origin on any port is also allowed (`localhost`,
`127.0.0.1`, `[::1]`). In production only the exact `CORS_ORIGINS` allowlist
is accepted.

## Normalized API

| Method | Path |
|---|---|
| GET | `/api/v1/movies/new?page=1` |
| GET | `/api/v1/movies?type=phim-le&page=1&sort=updated&order=desc` |
| GET | `/api/v1/movies/:slug` |
| GET | `/api/v1/genres/:slug/movies?page=1&year=2024&country=viet-nam` |
| GET | `/api/v1/countries/:slug/movies?page=1&sort=year&order=asc` |
| GET | `/api/v1/search?q=avatar&page=1` |

List response:

```json
{
  "items": [
    {
      "name": "Danh Sách Tử Tù (Phần 2)",
      "slug": "danh-sach-tu-tu-phan-2",
      "year": 2022,
      "updatedAt": "2026-10-24T15:56:02.000Z",
      "tmdb": { "vote_average": 7.5, "vote_count": 100 }
    }
  ],
  "title": "Phim Lẻ",
  "pagination": {
    "page": 1,
    "totalPages": 717,
    "totalItems": 17193,
    "totalItemsPerPage": 24
  }
}
```

`updatedAt` is the last content update time, derived from upstream
`modified.time` and normalized to ISO 8601 UTC. It is optional: missing or
invalid upstream timestamps are omitted. The raw upstream `modified` object is
never returned. `updatedAt` is content recency, not the release year (`year`);
both fields describe different things. Detail responses include the same
`updatedAt` because they inherit the summary fields.

Ordering:

- `/api/v1/movies/new`: preserves upstream order, then stable-sorts by
  `updatedAt` descending. This endpoint has no `sort` query.
- Catalog, genre, and country: the backend forwards `sort_field` and
  `sort_type=<order>` upstream, then stable-sorts the page locally by the same
  field and direction.
- Search: keeps upstream relevance order and is never re-sorted.
- Items without a valid timestamp (or year) sort last in both directions; ties
  keep their original order.

`sort` and `order` are optional for catalog, genre, and country:

- `sort=updated` (default): content update time.
- `sort=year`: release year.
- `order=desc` (default) or `order=asc`.
- Any other value returns `400`.

The backend maps `updated` to `sort_field=modified.time` and `year` to
`sort_field=year`.

Filters are available on the same three endpoints and can be combined:

- `year`: one year, 1888–2100. Ranges and comma lists return `400` because
  upstream only applies a single year reliably.
- `category`: category slug, for example `hanh-dong`.
- `country`: country slug, for example `viet-nam`.

Filters are not added to `/movies/new` or `/search`.

Upstream ignores `view`, `vote_average`, `vote_count`, `name`, and `language`
as sort/filter fields. The backend therefore does not expose full-catalog sorts
for those fields; unsupported `sort` values return `400` instead of returning
page-local ordering that would look like a global sort.

Detail response:

```json
{
  "movie": {
    "name": "Tên phim",
    "slug": "ten-phim",
    "episodes": []
  }
}
```

`type`: `phim-le | phim-bo | hoat-hinh | tv-shows`.
`q`/`keyword`: 1–100 characters after trim.
`page`: 1–5000.
`sort`: `updated | year` (catalog, genre, country only; default `updated`).
`order`: `desc | asc` (catalog, genre, country only; default `desc`).
`year`: one year from 1888 to 2100.
`category`, `country`: slugs using lowercase letters, digits, and hyphens.

## Errors

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "page must not be greater than 5000",
  "path": "/api/v1/movies"
}
```

- 400: invalid query/path
- 404: movie not found
- 429: rate limit exceeded (see `Retry-After`)
- 502: upstream invalid/unavailable
- 503: upstream rate limit
- 504: upstream timeout

Error responses and failed compat envelopes always carry
`Cache-Control: no-store`. `429` responses include `Retry-After` and use the
same error shape with `error`/`message` set to `Too Many Requests`.

Do not proxy HLS/iframe through the backend. Keep the current player and
stream URLs unchanged.

## Cache and logging

- `X-Cache: HIT | MISS` is exposed for debugging.
- `X-Request-Id` echoes a safe client ID or generates one; use it when
  reporting an issue.
- Cache TTL: new 2m, list 4m, search 1m, detail 6m.
- Only structurally valid successful payloads are cached. `status:false`,
  malformed payloads, timeouts, and error responses are never cached.
- Compat and normalized endpoints share the raw upstream cache.
- Requests are logged with method, route, status, duration, cache status, and
  request ID. Search keywords are not logged.

## Troubleshooting red requests

If DevTools shows API requests (and `favicon.svg`) with a red X:

1. Confirm both servers are running with one command from the repo root:
   `npm run dev`. Check `http://localhost:3001/api/health` and
   `http://localhost:5173`.
2. Open the page using an allowed origin. In development, loopback origins on
   any port work; in production, set `CORS_ORIGINS` to the exact deployed
   origin.
3. If the app was previously offline, unregister the old service worker in
   DevTools > Application > Service Workers, then hard-reload.

## Integration checklist

1. Start backend on port 3001.
2. Point `VITE_API_BASE_URL` to `http://localhost:3001/api/compat`.
3. Verify home, catalog, genre, country, search, detail, and watch.
4. Confirm CORS for the actual frontend origin.
5. Migrate to `/api/v1` only after compat passes.
