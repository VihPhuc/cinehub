# CineHub Catalog Index & Discovery — Thiết kế

Cập nhật: 2026-10-26

## 1. Bối cảnh

Frontend commit `a4ad62d` thêm discovery đa facet: sort, lọc theo năm, rating,
thể loại, quốc gia, ngôn ngữ, phim chiếu rạp, từ khóa; đồng bộ lên URL và có
nút chia sẻ bộ lọc. Hiện các facet này chạy client-side trên 24 phim của trang
hiện tại, nên kết quả không đại diện toàn catalog.

Backend Phase 1/2 đã có:

- `/api/v1/movies`, `/genres/:slug/movies`, `/countries/:slug/movies` sort
  `updated|year`, order `desc|asc`, filter `year|category|country`.
- `/api/v1/movies/new` và `/api/v1/search` giữ nguyên hành vi.

Khảo sát upstream (2026-10-26):

- `sort_field=modified.time|year` hoạt động; `view`, `vote_average`,
  `vote_count`, `name`, `language` bị bỏ qua.
- Filter `year`, `category`, `country` hoạt động; `rating`, `language`,
  `chieurap` bị bỏ qua.
- Search chỉ khớp tên phim, không tìm được theo diễn viên/đạo diễn.
- 4 loại catalog có tổng cộng khoảng 30.4k phim / 1,269 trang; 10 request
  concurrent mất khoảng 245ms.

Vì vậy muốn các facet của frontend đúng trên toàn catalog, backend cần một
catalog index cục bộ thay vì cố ép upstream sort/filter.

## 2. Mục tiêu

- Thêm `GET /api/v1/discover` đọc từ catalog index trong bộ nhớ.
- Hỗ trợ sort toàn catalog: `updated`, `year`, `rating`, `votes`, `name`.
- Hỗ trợ filter: `type`, `year`, `category`, `country`, `rating` (điểm tối
  thiểu), `language`, `chieurap`, `q` (tên phim, không phân biệt dấu/hoa thường).
- Trả facets toàn catalog (theo `type` nếu có) để frontend dựng dropdown thay
  vì suy ra từ 24 item.
- Giữ nguyên toàn bộ route hiện có; index là tính năng bổ sung.
- Index xây bằng CLI, ghi snapshot JSON atomically; không crawl trong request.
- Nếu snapshot chưa có/hỏng, `/discover` trả `503` rõ ràng; ứng dụng vẫn chạy.

## 3. Không nằm trong phạm vi

- Tìm theo diễn viên/đạo diễn (cần crawl ~30k trang detail; tách phase sau).
- Tự động refresh/hot reload index; sau khi chạy CLI cần restart service.
- Reindex qua HTTP admin endpoint.
- Database/Redis/multi-instance shared cache.
- Thay thế `/api/v1/search` hoặc đổi thứ tự relevance của upstream.
- Sửa frontend trong phase này.

## 4. Kiến trúc

### 4.1. Module mới `backend/src/catalog-index/`

- `catalog-index.types.ts`: kiểu snapshot, entry, query result, facets.
- `catalog-index.service.ts`: load snapshot, query/filter/sort/paginate, facets.
- `catalog-indexer.service.ts`: crawl 4 loại catalog, dedupe, ghi snapshot.
- `catalog-index.controller.ts`: `GET /api/v1/discover`.
- `catalog-index.module.ts`: wiring.
- `refresh-catalog-index.ts`: CLI entry.

### 4.2. Nguồn dữ liệu

- 4 loại: `phim-le`, `phim-bo`, `hoat-hinh`, `tv-shows`.
- Mỗi loại gọi `/v1/api/danh-sach/{type}?page=N` từ trang 1 đến `totalPages`
  lấy từ trang 1.
- Dùng `PhimApiClient` sẵn có (timeout/retry/giới hạn byte).
- Concurrency mặc định 8, cấu hình bằng `CATALOG_INDEX_CONCURRENCY`.
- Mỗi item map bằng `mapMovieSummary` để giữ đúng DTO normalized.
- Dedupe theo `slug`; một phim có thể thuộc nhiều `type`, lưu mảng `types`.
- Nếu bất kỳ trang nào lỗi: hủy refresh, không ghi đè snapshot cũ.
- Ghi file tạm rồi `rename` để tránh snapshot dở dang.

### 4.3. Snapshot

Mặc định `backend/data/catalog-index.json`, cấu hình `CATALOG_INDEX_PATH`.

```json
{
  "version": 1,
  "generatedAt": "2026-10-26T04:00:00.000Z",
  "totalItems": 30423,
  "entries": [
    {
      "movie": { "name": "...", "slug": "...", "year": 2024, "updatedAt": "..." },
      "types": ["phim-le"],
      "search": "ten phim goc"
    }
  ]
}
```

- `search` là tên + tên gốc đã chuẩn hóa NFD, bỏ dấu, lowercase.
- Load lúc khởi động; lỗi parse/version sai → index `not ready`, log warning.
- Không tự động crawl khi thiếu file.

### 4.4. Facets

Tính lúc load cho toàn bộ index và cho từng `type`:

- `years`: `{ value, count }`, giảm dần.
- `categories`: `{ slug, name, count }`.
- `countries`: `{ slug, name, count }`.
- `languages`: `vietsub | thuyet-minh | long-tieng`, kèm label và count.
- `totalItems`, `generatedAt`.

Facet của `/discover` chỉ phụ thuộc `type`, không phụ thuộc các filter khác,
để dropdown luôn có đủ lựa chọn. Điều này được ghi rõ trong tài liệu.

## 5. API contract

```http
GET /api/v1/discover?page=1&sort=updated&order=desc
    &type=phim-le&year=2024&category=hanh-dong&country=viet-nam
    &rating=7.5&language=vietsub&chieurap=true&q=avenger
```

| Param | Giá trị | Mặc định |
|---|---|---|
| `page` | 1..5000 | 1 |
| `sort` | `updated`, `year`, `rating`, `votes`, `name` | `updated` |
| `order` | `desc`, `asc` | `desc` |
| `type` | `phim-le`, `phim-bo`, `hoat-hinh`, `tv-shows` | tất cả |
| `year` | 1888..2100 | — |
| `category` | slug | — |
| `country` | slug | — |
| `rating` | 0..10, điểm TMDB tối thiểu | — |
| `language` | `vietsub`, `thuyet-minh`, `long-tieng` | — |
| `chieurap` | `true`, `false` | — |
| `q` | 1..100 ký tự | — |

Response:

```json
{
  "items": [ { "name": "...", "slug": "...", "year": 2024, "updatedAt": "..." } ],
  "pagination": {
    "page": 1,
    "totalPages": 1268,
    "totalItems": 30423,
    "totalItemsPerPage": 24
  },
  "facets": {
    "years": [ { "value": 2026, "count": 1234 } ],
    "categories": [ { "slug": "hanh-dong", "name": "Hành Động", "count": 4321 } ],
    "countries": [ { "slug": "viet-nam", "name": "Việt Nam", "count": 987 } ],
    "languages": [ { "value": "vietsub", "label": "Vietsub", "count": 25000 } ],
    "totalItems": 30423,
    "generatedAt": "2026-10-26T04:00:00.000Z"
  }
}
```

### 5.1. Ngữ nghĩa sort

- `updated`: `updatedAt`; item thiếu timestamp xếp cuối ở cả hai hướng.
- `year`, `rating`, `votes`: số; thiếu giá trị xếp cuối.
- `name`: `Intl.Collator('vi', { sensitivity: 'base' })`; tên rỗng xếp cuối.
- Tie-break giữ thứ tự gốc trong snapshot (stable sort).
- `order=asc|desc` áp dụng cho field đã chọn.

### 5.2. Ngữ nghĩa filter

- `rating=0` tương đương không lọc; `rating>0` chỉ giữ `vote_average >= rating`.
- `language` so khớp `lang` đã chuẩn hóa (bỏ dấu, lowercase).
- `q` so khớp `search` đã chuẩn hóa; không phân biệt dấu/hoa thường.
- `chieurap=false` chỉ giữ phim có `chieurap === false`; item thiếu field bị loại.
- Các filter kết hợp AND.

### 5.3. Lỗi và cache

- Query sai → `400` theo validation pipe hiện có.
- Index chưa sẵn sàng/hỏng → `503` với message hướng dẫn chạy
  `npm --prefix backend run index:refresh`.
- Thành công → `Cache-Control: public, max-age=60, stale-while-revalidate=120`.
- `X-Cache: HIT` vì dữ liệu đọc từ bộ nhớ.

## 6. Cấu hình

| Env | Mặc định | Ý nghĩa |
|---|---|---|
| `CATALOG_INDEX_PATH` | `data/catalog-index.json` | Đường dẫn snapshot |
| `CATALOG_INDEX_CONCURRENCY` | `8` | Số request crawl song song (1..32) |

Thêm `backend/data/catalog-index.json` vào `.gitignore`.

## 7. Vận hành

```bash
npm --prefix backend run index:refresh
# restart backend để load snapshot mới
```

Khuyến nghị chạy cron định kỳ (ví dụ mỗi 6 giờ) rồi restart service, hoặc chạy
CLI trước khi deploy. Snapshot có `generatedAt` để client/ops kiểm tra độ mới.

## 8. Kiểm thử

- Unit DTO: sort/order/rating/language/chieurap/q/year/category/country hợp lệ
  và không hợp lệ.
- Unit `CatalogIndexService`: load snapshot, missing/corrupt snapshot, sort
  asc/desc, missing-value last, Vietnamese name sort, filters, q accent-
  insensitive, pagination, facets theo type.
- Unit `CatalogIndexerService`: crawl nhiều trang, dedupe slug, merge types,
  atomic write, lỗi giữa chừng không ghi đè snapshot cũ.
- E2E `discover.e2e-spec.ts`: contract, filter/sort kết hợp, 400, 503 khi thiếu
  index, facets, cache header.
- Giữ toàn bộ test cũ xanh; chạy lint/build và `npm run verify`.

## 9. Acceptance criteria

- [ ] `/api/v1/discover` trả đúng contract, sort/filter toàn catalog thật.
- [ ] Snapshot xây được từ 4 loại catalog, dedupe theo slug.
- [ ] Thiếu index → 503, ứng dụng và các route cũ vẫn hoạt động.
- [ ] Facets đủ years/categories/countries/languages theo `type`.
- [ ] Refresh lỗi giữa chừng không làm hỏng snapshot cũ.
- [ ] Test unit/e2e/lint/build/`npm run verify` pass.
- [ ] Không sửa frontend.
- [ ] `docs/backend-api.md`, backend spec, README và `.env.example` được cập nhật.
