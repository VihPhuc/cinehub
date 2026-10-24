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
default; set `SWAGGER_ENABLED` to override).

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
| GET | `/api/v1/movies?type=phim-le&page=1` |
| GET | `/api/v1/movies/:slug` |
| GET | `/api/v1/genres/:slug/movies?page=1` |
| GET | `/api/v1/countries/:slug/movies?page=1` |
| GET | `/api/v1/search?q=avatar&page=1` |

List response:

```json
{
  "items": [],
  "title": "Phim Lẻ",
  "pagination": {
    "page": 1,
    "totalPages": 717,
    "totalItems": 17193,
    "totalItemsPerPage": 24
  }
}
```

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
