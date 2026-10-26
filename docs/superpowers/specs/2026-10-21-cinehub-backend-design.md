# CineHub Backend — Proxy + Cache + Normalized API

- **Ngày:** 2026-10-21
- **Trạng thái:** Approved — 2026-10-21
- **Phạm vi:** Phase 1
- **Chủ sở hữu:** Backend/API contract (AI backend), frontend integration (anty)
- **Repo:** `D:\Phim`

## 1. Bối cảnh

CineHub hiện là SPA React/Vite gọi trực tiếp `https://phimapi.com`. Toàn bộ cache, dedup,
normalize và xử lý lỗi nằm trong `src/services/api.ts`; favorites/history nằm trong
`localStorage`. Chưa có backend, database hay auth.

Mục tiêu phase 1 là thêm một backend NestJS đứng giữa frontend và PhimAPI để:

- Cache response upstream, giảm request và tăng độ ổn định.
- Giấu/khóa địa chỉ upstream, kiểm soát timeout, retry, rate limit, CORS.
- Cung cấp API chuẩn hóa ổn định cho code mới.
- Giữ một lớp proxy tương thích để anty tích hợp mà không phải viết lại toàn bộ
  `src/services/api.ts`.

### 1.1. Quyết định đã chốt

| Hạng mục | Quyết định |
|---|---|
| Backend | NestJS + TypeScript |
| Phạm vi | Proxy + cache + normalized API |
| Contract | Hybrid: compat + `/api/v1` |
| Cache | In-memory TTL + LRU, có interface thay Redis sau |
| Auth/DB | Không làm trong phase 1 |
| Frontend | Anty tự nối; backend chỉ cung cấp contract/docs |
| Media | Không proxy HLS/iframe; chỉ trả metadata và URL |

### 1.2. Không nằm trong phạm vi

- Đăng nhập, tài khoản, phân quyền.
- Đồng bộ favorites/history giữa thiết bị.
- Comments, ratings, admin.
- Database, Redis, queue, worker.
- Proxy file `.m3u8`, segment `.ts`, ảnh hoặc iframe.
- Inject server TMDB/VidSrc vào detail; logic này vẫn ở frontend như hiện tại.
- Thay đổi UI/frontend trong đợt này.

## 2. Phương án và lý do chọn

### Phương án A — Compat-first gateway + normalized API (đã chọn)

Hai surface dùng chung `PhimApiClient` và cache:

1. `/api/compat/*`: path và JSON giống PhimAPI.
2. `/api/v1/*`: DTO chuẩn hóa.

Ưu điểm: anty chỉ đổi base URL là chạy; vẫn có contract sạch để migrate dần.
Nhược điểm: duy trì hai surface, cần test cả hai.

### Phương án B — Chỉ normalized

Frontend phải sửa toàn bộ service/types. Sạch hơn nhưng chặn anty và tạo conflict
trong lúc frontend đang thay đổi. Không chọn.

### Phương án C — Wildcard proxy

Proxy mọi path, chỉ cache. Nhanh nhưng gần như open proxy, thiếu validation và
contract ổn định. Không chọn.

## 3. Kiến trúc

```text
Frontend (anty)
   │
   ├── /api/compat/*  ──┐
   └── /api/v1/*      ──┤
                        ▼
                 NestJS backend
                 ├─ CompatController
                 ├─ MoviesController
                 ├─ CatalogController
                 ├─ SearchController
                 ├─ DTO mappers
                 ├─ CacheService (TTL + LRU + single-flight)
                 └─ PhimApiClient (timeout, retry, allowlist)
                        │
                        ▼
                   phimapi.com
```

### 3.1. Luồng request

1. Controller validate path/query.
2. Service tạo upstream path + canonical cache key.
3. `CacheService.getOrLoad(key, ttl, loader)`:
   - hit còn hạn → trả cache (`X-Cache: HIT`).
   - miss → single-flight gọi `PhimApiClient`.
4. `PhimApiClient` gọi upstream với timeout/retry, trả JSON thô.
5. Cache JSON thô (không cache DTO) để compat và normalized dùng chung.
6. Compat trả nguyên JSON upstream; normalized map sang DTO rồi trả.

### 3.2. Cấu trúc thư mục

```text
backend/
  package.json
  package-lock.json
  tsconfig.json
  tsconfig.build.json
  nest-cli.json
  .env.example
  Dockerfile
  .dockerignore
  src/
    main.ts
    app.module.ts
    common/
      config/
      filters/
      interceptors/
      dto/
    cache/
      cache.service.ts
      cache.interface.ts
      cache.module.ts
    upstream/
      phimapi.client.ts
      upstream.errors.ts
      upstream.module.ts
    compat/
      compat.controller.ts
      compat.module.ts
    movies/
      movies.controller.ts
      movies.service.ts
      movies.module.ts
      dto/
      mappers/
    catalog/
      catalog.controller.ts
      catalog.service.ts
      catalog.module.ts
    search/
      search.controller.ts
      search.service.ts
      search.module.ts
    health/
      health.controller.ts
      health.module.ts
  test/
    app.e2e-spec.ts
    upstream-stub.ts
    cache.e2e-spec.ts
    errors.e2e-spec.ts
```

`backend/` là package độc lập, không dùng npm workspaces ở root để tránh ảnh hưởng
frontend. Root `.gitignore` đã bỏ qua `node_modules` và `dist`; bổ sung ignore cho
`backend/.env` nếu cần.

## 4. API contract

### 4.1. Base URL và prefix

- Global prefix: `/api`.
- Compat: `http://localhost:3001/api/compat`.
- Normalized: `http://localhost:3001/api/v1`.
- Health: `http://localhost:3001/api/health`.
- Swagger: `http://localhost:3001/api/docs`.

Frontend hiện đã hỗ trợ `VITE_API_BASE_URL` (fallback `https://phimapi.com`), nên anty chỉ cần đặt:

```dotenv
VITE_API_BASE_URL=http://localhost:3001/api/compat
```

Nếu checkout cũ chưa có env, chỉ đổi `BASE_URL` tương ứng.

Các path `${BASE_URL}/v1/api/...` và `${BASE_URL}/phim/:slug` giữ nguyên.

### 4.2. Compat endpoints

| Method | Path | Query | Upstream |
|---|---|---|---|
| GET | `/api/compat/danh-sach/phim-moi-cap-nhat` | `page` | `/danh-sach/phim-moi-cap-nhat` |
| GET | `/api/compat/v1/api/danh-sach/:type` | `page` | `/v1/api/danh-sach/:type` |
| GET | `/api/compat/v1/api/the-loai/:slug` | `page` | `/v1/api/the-loai/:slug` |
| GET | `/api/compat/v1/api/quoc-gia/:slug` | `page` | `/v1/api/quoc-gia/:slug` |
| GET | `/api/compat/v1/api/tim-kiem` | `keyword`, `page` | `/v1/api/tim-kiem` |
| GET | `/api/compat/phim/:slug` | — | `/phim/:slug` |

Quy tắc:

- Trả **raw upstream JSON**, không bọc envelope, không đổi tên field.
- Chỉ chấp nhận `GET`.
- `page` validate 1–5000; mặc định 1 nếu thiếu.
- `type` chỉ nhận `phim-le`, `phim-bo`, `hoat-hinh`, `tv-shows`.
- `keyword` bắt buộc với tìm kiếm, trim, tối đa 100 ký tự.
- Slug chỉ nhận `[a-z0-9]+(-[a-z0-9]+)*`.
- Query lạ bị bỏ qua (whitelist), không forward tùy ý.
- Upstream `200` với `status:false` vẫn trả nguyên cho compat (giữ hành vi cũ) nhưng
  **không cache** payload đó.
- Upstream HTTP lỗi được map sang lỗi backend thống nhất (mục 4.4).

Ví dụ:

```http
GET /api/compat/v1/api/danh-sach/phim-le?page=1
```

### 4.3. Normalized endpoints

| Method | Path | Mô tả | Query |
|---|---|---|---|
| GET | `/api/v1/movies/new` | Phim mới cập nhật | `page` |
| GET | `/api/v1/movies` | Catalog theo loại | `type`, `page`, `sort`, `order`, `year`, `category`, `country` |
| GET | `/api/v1/movies/:slug` | Chi tiết + episodes | — |
| GET | `/api/v1/genres/:slug/movies` | Theo thể loại | `page`, `sort`, `order`, `year`, `category`, `country` |
| GET | `/api/v1/countries/:slug/movies` | Theo quốc gia | `page`, `sort`, `order`, `year`, `category`, `country` |
| GET | `/api/v1/search` | Tìm kiếm | `q`, `page` |

`type` bắt buộc với `/api/v1/movies`: `phim-le | phim-bo | hoat-hinh | tv-shows`.
`sort` chỉ có ở catalog/genre/country: `updated | year`, mặc định `updated`.
`order`: `desc | asc`, mặc định `desc`. Giá trị khác trả `400`.
`/api/v1/movies/new` không nhận `sort`, `order` hay filter.

Thứ tự route: `/movies/new` phải được đăng ký **trước** `/movies/:slug` để Nest
không hiểu `new` là slug. Các route tĩnh khác cũng đặt trước route param.

#### List response

```json
{
  "items": [
    {
      "_id": "...",
      "name": "Tên phim",
      "slug": "ten-phim",
      "origin_name": "Original Name",
      "thumb_url": "https://...",
      "poster_url": "https://...",
      "year": 2026,
      "updatedAt": "2026-10-24T15:56:02.000Z",
      "time": "120 phút",
      "episode_current": "Full",
      "quality": "HD",
      "lang": "Vietsub",
      "chieurap": false,
      "tmdb": { "id": 123, "type": "movie", "season": null },
      "category": [{ "name": "Hành Động", "slug": "hanh-dong" }],
      "country": [{ "name": "Việt Nam", "slug": "viet-nam" }]
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

- `title` chỉ có với catalog/genre/country; có thể vắng với new/search.
- `pagination.page` là page thực tế đã gửi upstream.
- Không trả các field upstream không nằm trong DTO (`modified`, `imdb`,
  `last_episodes`, `seoOnPage`, ...) để contract ổn định.
- `updatedAt` là dẫn xuất từ `modified.time`, chuẩn hóa ISO 8601 UTC. Field
  optional: thiếu hoặc không parse được thì bỏ, không trả raw `modified`.
- `updatedAt` là thời điểm cập nhật nội dung, khác `year` (năm phát hành).

Filter catalog/genre/country (có thể kết hợp):

- `year`: một năm trong khoảng 1888–2100. Range/comma trả `400` vì upstream chỉ
  áp dụng đúng một năm.
- `category`: slug thể loại, ví dụ `hanh-dong`.
- `country`: slug quốc gia, ví dụ `viet-nam`.
- Filter không áp dụng cho `/movies/new` và `/search`.

Giới hạn upstream (khảo sát 2026-10):

- `sort_field=modified.time|year` hoạt động với cả `asc`/`desc`.
- `view`, `vote_average`, `vote_count`, `name`, `language` bị upstream bỏ qua.
- Vì vậy backend không mở sort/filter toàn catalog cho các field đó; giá trị
  `sort` không hỗ trợ trả `400` thay vì sort tạm trong 24 item/trang.

Thứ tự danh sách:

- `/api/v1/movies/new`: giữ thứ tự upstream, stable sort `updatedAt` giảm dần.
- Catalog/genre/country: gửi upstream `sort_field` + `sort_type=<order>`, kèm
  filter, rồi stable sort local theo cùng field và hướng.
- Search: giữ relevance order của upstream, không sort lại.
- Item thiếu timestamp/năm hợp lệ xếp cuối ở cả hai hướng; item bằng nhau giữ
  thứ tự gốc.

#### Detail response

```json
{
  "movie": {
    "name": "Tên phim",
    "slug": "ten-phim",
    "origin_name": "Original Name",
    "content": "<p>...</p>",
    "type": "series",
    "status": "ongoing",
    "thumb_url": "https://...",
    "poster_url": "https://...",
    "year": 2026,
    "updatedAt": "2026-10-24T15:56:02.000Z",
    "time": "45 phút",
    "episode_current": "Tập 10",
    "episode_total": "24",
    "quality": "HD",
    "lang": "Vietsub",
    "view": 12345,
    "actor": ["..."],
    "director": ["..."],
    "category": [],
    "country": [],
    "tmdb": { "id": 123, "type": "tv", "season": 1 },
    "episodes": [
      {
        "server_name": "Vietsub",
        "server_data": [
          {
            "name": "Tập 01",
            "slug": "tap-01",
            "filename": "...",
            "link_embed": "https://...",
            "link_m3u8": "https://..."
          }
        ]
      }
    ]
  }
}
```

Quy tắc normalize:

- Ghép `episodes` từ upstream vào `movie.episodes`.
- Bỏ server/episode không có `link_embed` và `link_m3u8`; chỉ giữ URL `http:`/`https:`.
- Không format lại `name`; frontend tiếp tục dùng `formatMovieTitle`.
- Không inject server TMDB/VidSrc; frontend tiếp tục làm việc này.
- `content` giữ nguyên HTML upstream; client phải sanitize (frontend đã dùng DOMPurify).
- Upstream list trả `status:false` → `502`; chi tiết `status:false` hoặc thiếu
  `movie` → `404`.

### 4.4. Error contract

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "page must be between 1 and 5000",
  "path": "/api/v1/movies"
}
```

Mapping:

| Tình huống | HTTP | Ghi chú |
|---|---|---|
| Query/path sai | 400 | Không gọi upstream |
| Phim không tồn tại | 404 | Upstream 404 hoặc `status:false` |
| Upstream timeout | 504 | Sau retry |
| Upstream 5xx/JSON lỗi | 502 | Không cache |
| Upstream list `status:false` | 502 | Payload không hợp lệ |
| Upstream rate limit | 503 | Kèm `Retry-After` nếu có |
| Route không tồn tại | 404 | Nest default |

- Không trả stack trace, URL upstream hoặc chi tiết nội bộ ra client.
- Log nội bộ có method, path, status, duration, cache status; không log toàn bộ
  keyword tìm kiếm.

### 4.5. Response headers

- `X-Cache: HIT | MISS` trên các endpoint có cache.
- `Cache-Control: public, max-age=30, stale-while-revalidate=120` cho list/search;
  `public, max-age=60` cho detail. Đây là cache trình duyệt/CDN; cache nội bộ vẫn
  theo TTL ở mục 5.
- `Vary: Origin` vì response CORS phụ thuộc origin.
- `Access-Control-Expose-Headers: X-Cache` để debug từ frontend.
- `Content-Type: application/json; charset=utf-8`.
- Không set cookie, không yêu cầu credentials.

## 5. Cache và upstream

### 5.1. Cache service

Interface:

```ts
interface CacheStore {
  getOrLoad<T>(
    key: string,
    ttlMs: number,
    loader: () => Promise<T>
  ): Promise<{ value: T; status: 'HIT' | 'MISS' }>;
  getStats(): { size: number; hits: number; misses: number };
  clear(): void;
}
```

Triển khai phase 1:

- `lru-cache` in-memory, `max = CACHE_MAX_ENTRIES` (mặc định 500).
- TTL theo entry; hết hạn thì xóa và gọi loader.
- Single-flight: map key → Promise; request đồng thời dùng chung promise.
- Nếu loader reject: xóa in-flight, không cache lỗi.
- Chỉ cache JSON upstream thành công: HTTP `200` và `status !== false`.
- Không cache lỗi, timeout, payload malformed hoặc payload `status:false`.
- Cache key: `phimapi:GET:<path>?<canonical-query>`; query sort ổn định.
- Compat và normalized dùng cùng key cho cùng upstream request; TTL xác định theo
  loại upstream path, không theo surface gọi.

TTL:

| Loại | TTL |
|---|---|
| Danh sách catalog/genre/country | 4 phút |
| Phim mới cập nhật | 2 phút |
| Tìm kiếm | 1 phút |
| Chi tiết phim | 6 phút |

Cho phép override từng loại bằng env (mục 7.1), không dùng một TTL chung cho mọi route.

### 5.2. PhimApiClient

- Base URL từ `PHIMAPI_BASE_URL`, mặc định `https://phimapi.com`.
- Chỉ nhận path nội bộ do service tạo; không nhận host/path từ query người dùng.
- Timeout mỗi attempt: `UPSTREAM_TIMEOUT_MS` (mặc định 5.000 ms).
- Retry: `UPSTREAM_RETRIES` (mặc định 1) cho network error, 429, 5xx.
- Tổng ngân sách upstream: `UPSTREAM_TOTAL_TIMEOUT_MS` (mặc định 9.000 ms).
  Frontend hiện timeout 10 giây, nên backend phải trả trước mốc đó; attempt cuối
  dùng thời gian còn lại, không vượt tổng ngân sách.
- Không retry 400/401/403/404.
- Backoff: 250 ms + jitter nhỏ; tôn trọng `Retry-After` (tối đa 2 giây).
- Giới hạn response: `UPSTREAM_MAX_BYTES` (mặc định 2 MB).
- `Accept: application/json`, `User-Agent: CineHubBackend/<version>`.
- Parse JSON lỗi → `UpstreamError` 502.
- Production yêu cầu `https`; test/dev có thể dùng `http` cho stub local.
- Không follow redirect tùy tiện; nếu upstream redirect, coi là lỗi 502 (tránh SSRF
  qua redirect). Có thể nới sau nếu PhimAPI cần.

### 5.3. Hành vi khi upstream lỗi

- Timeout/5xx: retry rồi trả 504/502.
- 429: retry; hết lượt trả 503 kèm `Retry-After`.
- 404: trả 404, không retry.
- JSON không hợp lệ: 502, không cache.
- Không có stale fallback trong phase 1; frontend đã có cache/SW offline riêng.

## 6. Validation

- Global `ValidationPipe`:
  - `transform: true`
  - `whitelist: true`
  - `forbidNonWhitelisted: false` để không phá vỡ query tương lai
- `page`: integer, 1–5000, mặc định 1.
- `type`: enum.
- `keyword`/`q`: trim, 1–100 ký tự.
- slug: regex an toàn, encode khi build URL.
- Không cho path `..`, slash hoặc protocol trong slug.
- Compat route cũng dùng cùng validation; lỗi trả theo contract 4.4.

## 7. Security và vận hành

- CORS allowlist từ `CORS_ORIGINS`, mặc định:
  `http://localhost:5173,http://localhost:4173`.
- Helmet; Swagger UI được cấu hình CSP phù hợp hoặc tắt CSP riêng cho docs.
- Swagger mặc định bật ở development và tắt ở production; chỉ bật production khi
  `SWAGGER_ENABLED=true` có chủ đích.
- Rate limit toàn cục: 120 request/phút/IP; search có thể 60/phút.
- Chỉ GET; không có endpoint clear cache công khai.
- Không tin `X-Forwarded-For` trừ khi `TRUST_PROXY=true`.
- Bind `0.0.0.0` khi chạy Docker; mặc định local `0.0.0.0` hoặc `127.0.0.1`
  theo `HOST`.
- Graceful shutdown (`app.enableShutdownHooks()`).
- Health endpoint trả uptime + cache stats, không lộ env/secrets.

### 7.1. Env

```dotenv
PORT=3001
HOST=0.0.0.0
NODE_ENV=development
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

- Config validate bằng Joi; thiếu/sai kiểu thì app fail-fast.
- `.env.example` commit; `.env` không commit.
- `UPSTREAM_TOTAL_TIMEOUT_MS` phải nhỏ hơn timeout 10 giây của frontend hiện tại.

### 7.2. Docker

- Multi-stage: `node:22-alpine` build → runtime production dependencies.
- `EXPOSE 3001`.
- `HEALTHCHECK` gọi `/api/health`.
- Chạy non-root user.
- Không cần Redis/DB trong compose phase 1.

## 8. Testing

Dùng **Jest + Supertest** (chuẩn NestJS) và **Oxlint** để đồng bộ với frontend.

### Unit

- Cache: hit/miss, TTL hết hạn, LRU eviction, single-flight, loader reject.
- Upstream client: timeout, retry đúng loại lỗi, không retry 404, parse lỗi,
  response quá lớn, URL builder.
- Mapper: list/detail, episodes rỗng, URL không hợp lệ, field thiếu.
- Validation: page/type/slug/keyword.

### E2E

- Dùng Node HTTP stub server nội bộ (port ngẫu nhiên), cấu hình
  `PHIMAPI_BASE_URL` trỏ vào stub; **không gọi mạng thật**.
- Test:
  - Compat trả đúng raw shape cho 6 endpoint.
  - Normalized trả đúng DTO.
  - Cache: request 2 `X-Cache: HIT`, stub chỉ nhận 1 request.
  - Concurrent requests cùng key chỉ gọi upstream 1 lần.
  - 400 page/type/keyword; 404 detail; 502 malformed; 504 timeout.
  - CORS cho origin hợp lệ, từ chối origin khác.
  - Health endpoint.
- Chạy: `npm test`, `npm run test:e2e`, `npm run build`.

## 9. CI và tài liệu

### CI

Thêm job backend vào `.github/workflows/verify.yml`:

```yaml
backend:
  runs-on: ubuntu-latest
  defaults:
    run:
      working-directory: backend
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22
        cache: npm
        cache-dependency-path: backend/package-lock.json
    - run: npm ci
    - run: npm test
    - run: npm run test:e2e
    - run: npm run lint
    - run: npm run build
```

Job frontend hiện có giữ nguyên.

### Tài liệu

- `docs/backend-api.md`: contract cho anty, ví dụ curl, lỗi, cache headers.
- `backend/README.md`: chạy local, env, test, Docker.
- Swagger UI `/api/docs` và OpenAPI JSON.
- `docs/coordination.md`: thêm mục Backend, trạng thái, checklist tích hợp.
- Root `README.md`: thêm phần backend và lệnh chạy.

## 10. Phối hợp với anty

### Nguyên tắc

- Backend không sửa file trong `src/` khi anty đang làm.
- Contract được đóng băng trong spec + `docs/backend-api.md` trước khi code.
- Thay đổi contract phải cập nhật docs và thông báo trước.

### Checklist tích hợp

1. Chạy backend: `cd backend && npm ci && npm run start:dev`.
2. Anty đổi base URL frontend sang `http://localhost:3001/api/compat`.
3. Kiểm tra lại: home, catalog, genre, country, search, detail, watch.
4. Xác nhận CORS với origin thực tế của frontend.
5. Giữ nguyên HLS/iframe trực tiếp; không đổi player.
6. Sau khi compat ổn định, anty chuyển từng endpoint sang `/api/v1`.
7. Nếu cần đổi response/field, báo backend trước khi merge.

### Trạng thái bàn giao

- Backend: code + test + Swagger + docs.
- Anty: thay base URL và xác nhận 6 luồng compat.
- Chưa chuyển normalized cho đến khi compat pass.

## 11. Acceptance criteria

- [ ] `backend` build và chạy local trên port 3001.
- [ ] 6 compat endpoint trả raw shape tương thích frontend hiện tại.
- [ ] 6 normalized endpoint trả DTO đúng spec, có Swagger.
- [ ] Cache hit/miss đúng; request thứ hai `X-Cache: HIT`; upstream chỉ gọi một lần.
- [ ] Single-flight hoạt động khi concurrent.
- [ ] Validation 400; detail không tồn tại 404; upstream lỗi 502/504.
- [ ] CORS đúng allowlist; rate limit hoạt động.
- [ ] Test unit + e2e pass; CI backend pass.
- [ ] Không sửa file frontend; không proxy HLS.
- [ ] `docs/backend-api.md` đủ để anty tích hợp không cần đọc code.

## 12. Rủi ro và câu hỏi mở

### Rủi ro

- Schema PhimAPI thay đổi: compat sẽ lộ thay đổi; normalized cần mapper được test.
- In-memory cache mất khi restart, không chia sẻ giữa nhiều instance.
- Rate limit sau reverse proxy có thể gộp IP nếu không cấu hình `TRUST_PROXY`.
- Upstream chặn IP/datacenter: cần kiểm tra khi deploy thật.
- Swagger public có thể lộ contract; production nên tắt hoặc bảo vệ.

### Câu hỏi mở

- Deploy target chính xác (VPS/Render/Railway/Docker) để tinh chỉnh healthcheck/CI.
- Anty muốn dùng compat ngay hay chuyển normalized ngay từ đầu.
- Có cần cache ảnh/metadata TMDB ở backend trong phase sau không.
- Rate limit/TTL có cần chỉnh theo traffic thực tế không.

## 13. Thứ tự triển khai đề xuất

1. Scaffold `backend/`, config, health, CI skeleton.
2. Cache service + upstream client + unit test.
3. Compat endpoints + e2e raw shape.
4. Normalized list/detail + DTO/mapper + e2e.
5. Security (CORS, rate limit, Helmet), Swagger.
6. Docker + docs + CI backend job.
7. Anty tích hợp compat; kiểm tra 6 luồng.
8. Sau khi pass, chuyển dần normalized.
