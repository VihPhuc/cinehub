# CineHub Backend API — Handoff

## Run

```bash
cd backend
npm ci
npm run start:dev
```

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
CORS defaults to `http://localhost:5173` and `http://localhost:4173`; set
`CORS_ORIGINS` for other origins.

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
- 502: upstream invalid/unavailable
- 503: upstream rate limit
- 504: upstream timeout

Do not proxy HLS/iframe through the backend. Keep the current player and
stream URLs unchanged.

## Cache

- `X-Cache: HIT | MISS` is exposed for debugging.
- Cache TTL: new 2m, list 4m, search 1m, detail 6m.
- `status:false`, errors, and malformed responses are never cached.
- Compat and normalized endpoints share the raw upstream cache.

## Integration checklist

1. Start backend on port 3001.
2. Point `VITE_API_BASE_URL` to `http://localhost:3001/api/compat`.
3. Verify home, catalog, genre, country, search, detail, and watch.
4. Confirm CORS for the actual frontend origin.
5. Migrate to `/api/v1` only after compat passes.
