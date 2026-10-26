# Coordination — CineHub

Cập nhật: 2026-10-24 (sau refactor frontend/backend và hoàn thành Backend Phase 1)

> Repo đã tách thành `frontend/` và `backend/`. Backend đã hoàn tất Phase 1
> (compat `/api/compat/*` và normalized `/api/v1/*`, CORS/rate limit/Swagger); xem
> [docs/backend-api.md](backend-api.md) để tích hợp.

## Trạng thái các luồng

| Luồng | File chính | Trạng thái |
|-------|------------|------------|
| Data / TDD | `frontend/src/shared/api.ts`, `storage.ts`, `validation.ts`, `tmdb.ts`, `*.test.ts`, `frontend/src/app/urlState.ts`, `frontend/vitest.config.ts`, `frontend/package.json` | Hoàn tất, 67 test frontend pass; cache hết hạn không trả khi online, có clear API cache, kết nối live với backend normalized `/api/v1` |
| App / URL & race | `frontend/src/app/App.tsx` | Hoàn tất: hydrate URL, skip ghi URL lần đầu, popstate, request-id + AbortController cho catalog, reset page khi đổi filter, chặn URL-sync khi đang khôi phục watch, lazy-load player |
| Player | `frontend/src/features/player/VideoPlayer.tsx` | Hoàn tất phần P1: retry có giới hạn, HLS lifecycle, throttle history, keyboard guard, sync tập khi back/forward, `resumeFromHistory`, không echo `onEpChange` gây vòng lặp |
| UI / a11y | `frontend/src/features/detail/MovieDetailModal.tsx`, `frontend/src/features/catalog/MovieCard.tsx`, `frontend/src/features/navigation/Navbar.tsx`, `frontend/src/features/catalog/MovieGrid.tsx`, `frontend/src/features/home/HeroBanner.tsx`, `frontend/src/features/catalog/MovieRow.tsx`, `frontend/src/features/library/LibraryView.tsx`, `frontend/src/app/index.css` | Hoàn tất trong tree: DOMPurify + dialog semantics, keyboard card, combobox search |
| PWA / security | `frontend/public/sw.js`, `frontend/src/app/main.tsx`, `frontend/index.html`, `frontend/public/manifest.json`, `frontend/public/icon-*.png`, `frontend/vite.config.ts` | Hoàn tất: cache có version + giới hạn, navigation fallback, SW chỉ ở PROD, CSP build-only, icon PWA, dọn asset thừa |

## Đã sửa (P1)

### Data layer
- Hủy request theo từng caller (`AbortSignal` + `waitForSignal`), không còn một caller hủy request dùng chung.
- Cache memory/session có TTL, giới hạn 200 entry, dọn cache hết hạn.
- Chuẩn hóa dữ liệu localStorage/import backup: giới hạn 100 favorites / 50 history, dedupe, chặn URL ảnh không an toàn (kể cả `//host`).
- Import backup validate toàn bộ trước khi ghi; file lỗi không ghi nửa vời.
- VidSrc dùng đúng `tmdb.type` / `tmdb.season`; URL stream/embed chỉ nhận https.
- Cache hết hạn bị xóa và không được trả như dữ liệu mới khi network lỗi; `clearApiCache()` xóa memory/session và gửi `CLEAR_API_CACHE` cho SW.

### App / URL
- `parseUrlState()` hydrate ngay từ query string; `buildUrlSearch()` là nguồn duy nhất khi ghi URL.
- Bỏ ghi URL ở lần render đầu để deep link `?watch=...` / `?info=...` không bị ghi đè trước khi fetch xong.
- `popstate` khôi phục đầy đủ tab/genre/country/search/page/info/watch; có request-id chống response cũ.
- Catalog: `AbortController` + request-id, clear dữ liệu cũ, loading/error nhất quán, reset page khi đổi filter.
- `?ep=0` được chuẩn hóa trong URL do app sinh ra (bỏ `ep`); deep link có sẵn `ep=0` được giữ nguyên để không tạo thêm history entry.
- Khi popstate khôi phục watch, cập nhật `watchEpIdx` ngay và tạm chặn URL-sync đến khi fetch xong — tránh push lặp tập cũ.

### Performance
- `VideoPlayer` được `React.lazy` + `Suspense`; `hls.js` (574 KB) không còn nằm trong bundle/preload đầu trang, chỉ tải khi mở phim.
- Bundle đầu ~144 KB JS (~40 KB gzip); player chunk ~27 KB; HLS chunk tách riêng; QR chunk chỉ tải khi mở mã QR.
- `scripts/check-bundle.mjs` + `npm run check:bundle` chặn hồi quy nếu `vendor-hls` bị preload lại.
- `.github/workflows/verify.yml` chạy `npm ci`, test, lint, build, bundle/deploy guard và kiểm tra mojibake trên push/PR.

### Player
- Retry fatal HLS có giới hạn (3 lần), có nút thử lại; cleanup HLS đúng lifecycle.
- History ghi throttle 5 giây + flush khi pause/pagehide; không auto-resume khi người dùng chọn tập cụ thể (chỉ resume từ Continue Watching).
- Phím tắt không chiếm Space/Arrow khi focus vào input/button/select/link.
- Đổi tập bằng browser back/forward đồng bộ lại UI; `onEpChange` chỉ phát từ thao tác người dùng/auto-next, không echo prop (đã test CDP).

### PWA / security
- SW: cache shell/API/image riêng, version hóa, giới hạn entry; API cache v3 có TTL 4 phút, chỉ dùng entry hết hạn khi offline; nhận `CLEAR_API_CACHE`; chỉ fallback `index.html` cho navigation; API lỗi trả 503 JSON thay vì HTML.
- SW chỉ đăng ký khi `import.meta.env.PROD`; dev/HMR không bị cache.
- CSP production-only qua Vite plugin (dev vẫn dùng được React Refresh): `script-src 'self'`, chặn object/base/form, cho phép API/HLS/font/iframe cần thiết.
- Build sinh thêm `_headers` (CSP + `frame-ancestors 'none'`, HSTS, nosniff, X-Frame-Options, Referrer/Permissions Policy, cache policy) và `_redirects` (SPA fallback) cho host hỗ trợ Netlify/Cloudflare Pages.
- Manifest có icon 192/512 + maskable + apple-touch-icon; `theme-color` và `background_color` đồng bộ `#0f1015`.

### UI / UX / A11y & Performance (P2 & P3 - 5 Phần Nâng Cấp Toàn Diện)
- **Phần 1 - Mã QR Code xem tiếp trên Mobile:** Đã tích hợp nút "Xem Trên Mobile (QR)" trên `MovieDetailModal.tsx`. Sử dụng dynamic import `import('qrcode')` tách riêng chunk `browser-*.js` (~23.4 kB), không làm tăng kích thước bundle ban đầu. Modal QR đạt chuẩn a11y (role dialog, backdrop blur, phím Esc, nút sao chép liên kết deep link nhanh).
- **Phần 2 - Tiến trình xem tập phim trực quan (VideoPlayer):** Thanh mini progress bar sắc nét hiển thị % thời lượng đã xem trên từng nút tập phim (`episodeProgressMap`). Tập đã xem trên 90% hiển thị biểu tượng hoàn thành `Check` màu xanh lá cây; aria-label mô tả chi tiết trạng thái tập phim cho screen reader.
- **Phần 3 - Bộ lọc đa tiêu chí linh hoạt (MovieGrid):** Bổ sung dropdown bộ lọc "Tất cả thể loại" và "Tất cả quốc gia" tính toán động theo danh mục phim thực tế. Kết hợp lọc mượt mà cùng bộ lọc Định dạng (Vietsub, Thuyết minh, Chiếu rạp) và Năm phát hành mà không cần tải lại trang.
- **Phần 4 - Hàng phim tuyển chọn chủ đề đặc biệt (Curated Collections):** Bổ sung các hàng phim tuyển chọn độc quyền trên Trang chủ:
  - *K-Drama: Phim Bộ Hàn Quốc Gây Sốt* (biểu tượng `Flame`, badge `K-DRAMA TUYỂN CHỌN`, gradient tím hồng).
  - *Siêu Phẩm Hành Động & Kịch Tính* (biểu tượng `Zap`, badge `BLOCKBUSTER ACTION`, gradient cam đỏ).
  - Nâng cấp `MovieRow` hỗ trợ prop `badge`, `icon`, `accentGradient` và nút "Xem tất cả" đạt kích thước cảm ứng chuẩn WCAG 2.2 AA (>= 44×44px).
- **Phần 5 - Tùy chọn tông màu giao diện (Theme Accent):** Bộ chuyển đổi màu sắc giao diện cá nhân hóa với 4 phong cách cao cấp:
  - *Đỏ Ruby Điện Ảnh* (Mặc định - Ruby Red)
  - *Vàng Kim Hoàng Gia* (Golden Amber)
  - *Xanh Neon Cyberpunk* (Cyan / Teal Neon)
  - *Tím Huyền Bí* (Mystic Violet)
  Tích hợp cả trên thanh tác vụ Desktop (`Navbar.tsx`) và Mobile Drawer, lưu vào `localStorage`, đồng bộ `data-theme` trên thẻ gốc trước khi mount (`main.tsx`), phản hồi Toast mượt mà khi đổi màu.
- **Chế độ Rạp Chiếu Phim (Theater Mode) & Hiệu ứng Ánh sáng Ambient Glow (Player):**
  - *Chế độ Rạp Phim (Phím T):* Mở rộng sân khấu video tràn viền màn hình (`h-[54vw] max-h-[85vh] min-h-[380px] w-full`), danh sách tập và bảng điều khiển máy chủ bên dưới được căn giữa trong container tiêu chuẩn (`max-w-[1720px] mx-auto`) tạo trải nghiệm chuẩn rạp IMAX.
  - *Hiệu ứng Ánh Sáng Hắt Rạp Phim (Ambilight - Phím G):* Hệ thống ánh sáng hào quang 2 lớp (Layer 1: Phổ quang theo tông màu giao diện hiện tại; Layer 2: Ánh sáng tán xạ mờ phản chiếu theo poster phim bão hòa cao). Hỗ trợ nút bật/tắt đèn rạp độc lập, lưu trạng thái vào `localStorage`.
  - *Phím tắt tiện dụng:* Phím `T` bật/tắt rạp phim, phím `G` bật/tắt đèn rạp; hiển thị đầy đủ trong Quick Shortcuts info bar và Bảng hướng dẫn phím tắt modal (`Shift + ?`).
- **Touch Targets (WCAG 2.2 AA - D10):** Toàn bộ các nút tương tác chính trên mobile đều đạt tối thiểu 44×44px (`MovieCard` bookmark, `MovieGrid` pagination & jump, `HeroBanner` capsule dock, arrows, dash indicators, `Navbar` drawer/search clear, `LibraryView` remove buttons, `VideoPlayer` controls/speeds/episodes/toggles, `ThemePicker`).
- **HeroBanner Cinematic Backdrop & Trailer Modal:** Loại bỏ hoàn toàn YouTube iframe nền (tránh vướng overlay nút pause `||` và playlist controls của YouTube); thay bằng ảnh backdrop sáng nét chuẩn điện ảnh (`Outfit` heading không ngắt dòng cụm `(Phần 1)`); trailer mở qua popup modal độc lập với sandbox/referrer an toàn.
- **Auto-slide 5s:** Chu kỳ chuyển slide 5000ms liên tục với thanh progress bar đồng bộ.
- **Catalog Filter Reset (A3):** `MovieGrid` đồng bộ `key` theo `${activeTab}-${genreFilter.slug}-${countryFilter.slug}-${searchQuery}` giúp reset sạch sẽ bộ lọc cục bộ khi chuyển trang.
- **Phân trang (A3):** Form nhảy trang dùng `noValidate` + validation tường minh; trang không hợp lệ hiển thị lỗi `role="alert"`, `aria-invalid`/`aria-describedby`, không còn im lặng; nhập trang hợp lệ cập nhật URL và reset ô nhập.
- **Prefetch & Scroll Optimization (A5):** Debounce 180ms cho prefetch detail khi hover thẻ phim tránh spam CDN; throttle scroll listener bằng `requestAnimationFrame`; memoize `favSlugs`, `MovieCard`, và `MovieRow`.
- **Import/Export Validation (B3):** Hàm `validateAndSanitizeBackup` kiểm tra chặt chẽ schema dữ liệu JSON và sanitize URL hình ảnh.
- **Phương án 2 — Tủ Phim Thông Minh & Cá Nhân Hóa (Smart Library & Personalization):**
  - *Viewing Insights & Thống kê cá nhân:* Thanh Dashboard tổng quan thời gian đã xem (giờ/phút), số tập hoàn thành, số phim đã lưu và số bộ sưu tập cá nhân.
  - *Bộ sưu tập cá nhân (Custom Collections / Playlists):* Cho phép tạo mới, xóa, thêm/bớt phim vào bộ sưu tập cá nhân từ cả trang Tủ Phim và Chi tiết phim (`MovieDetailModal`). Xem danh sách phim theo từng bộ sưu tập riêng biệt.
  - *Lọc trạng thái lịch sử xem:* Phân loại nhanh "Tất cả", "Đang xem dở" (<85%), "Đã xong" (>=85%) với huy hiệu trạng thái trực quan.
  - *Sắp xếp danh sách yêu thích:* Sắp xếp theo ngày lưu (mới nhất/cũ nhất), tên phim (A-Z), năm phát hành (mới nhất).
  - *Hộp thoại xem trước Backup (Backup Preview):* Phân tích tệp JSON trước khi nhập, cho phép người dùng lựa chọn "Hợp Nhất (Khuyên dùng)" an toàn không mất dữ liệu hiện có hoặc "Ghi Đè Tất Cả".
- **Phương án 3 — Khám Phá & Bộ Lọc Đa Chiều Thông Minh (Discovery & Smart Multi-Facet Search):**
  - *Tra cứu Diễn viên / Đạo diễn tương tác (Interactive Cast & Crew):* Thẻ badge đạo diễn và diễn viên trong `MovieDetailModal` trở thành nút bấm kèm biểu tượng kính lúp, lập tức chuyển sang trang tìm kiếm nhân sự tương ứng.
  - *Đồng bộ Bộ lọc Đa Tiêu Chí lên URL (URL State Sync):* Các tiêu chí sắp xếp (`sort`), năm phát hành (`year`), đánh giá tối thiểu (`rating`) được đồng bộ 2 chiều vào query parameters trên URL và hỗ trợ nút "Chia sẻ bộ lọc" sao chép liên kết trực tiếp.
  - *Vòng quay điện ảnh ngẫu nhiên (Smart Movie Roulette Modal):* Modal chọn phim ngẫu nhiên phong cách xúc xắc/roulette với hiệu ứng chuyển động slot machine đẹp mắt, hỗ trợ lọc theo thể loại và chọn nhanh xem phim hoặc mở chi tiết.

## Kiểm chứng

Chạy tại `D:\Phim`:

```text
npm run test:web        -> 8 test files, 76 tests passed
npm run test:api        -> 34 unit + 36 e2e passed (tổng 70 tests)
npm run lint            -> clean (frontend + backend)
npm run build:web       -> pass (tsc -b + vite build)
npm run build:api       -> pass (nest build)
npm run check:bundle    -> pass (hls.js không bị preload, deferred)
npm run check:deploy    -> pass (_headers + _redirects đã sinh)
npm run check:mojibake  -> OK: no mojibake
node scripts/audit-check.mjs -> All OK (backend 11/11 OK)
```

Kiểm tra thủ công bằng Chrome headless + CDP trên `vite preview`:

- Deep link `?watch=...&ep=2` với slug lỗi: URL vẫn giữ nguyên (không bị ghi đè về `/`).
- Deep link phim thật: player render, không có CSP violation; URL watch giữ nguyên.
- Chọn `Tập 02`: URL thành `?watch=...&ep=1`, UI active Tập 02.
- `history.back()`: URL về `?watch=...&ep=0`, UI active Tập 01; `history.forward()` quay lại Tập 02.
- History chỉ tăng 1 entry cho mỗi lần đổi tập (không còn vòng lặp pushState; trước fix là 50+ entry).
- Service worker: `activated`, scope `/`, cache `cinehub-shell-v5`, `cinehub-api-v3`, `cinehub-images-v1`; shell cache có đủ `/`, `index.html`, manifest, favicon và 4 icon; trang do SW kiểm soát.
- API cache v3 tạo được entry sau khi SW kiểm soát trang; gửi `CLEAR_API_CACHE` xóa sạch cache API (`caches.has(...) === false`).
- Unit test xác nhận cache API quá 4 phút bị refetch, cache còn hạn trả ngay, và message clear xóa đúng cache.
- Không có response same-origin 4xx/5xx, không có console error/CSP violation; manifest + toàn bộ icon trả 200.
- Offline sau khi SW kiểm soát: reload vẫn tải app shell, hiện banner ngoại tuyến, 107 card lấy từ API cache, `navigator.serviceWorker.controller === true`, không có console error.
- Player: chuyển HLS -> iframe (iframe có sandbox/referrer) -> HLS hoạt động, video element trở lại; phím `F` vào/thoát fullscreen container đúng.
- PiP chưa xác minh được trong Chrome headless (video chưa phát/không có user gesture); cần kiểm tra trên trình duyệt thật.
- Preview production render đầy đủ dưới CSP mới; manifest/icon phục vụ 200.
- Bundle: `index.html` chỉ preload runtime/icons/react, **không preload `vendor-hls`**; trang chủ chỉ tải `index-*.js` + CSS, khi mở watch mới tải `VideoPlayer-*.js` và `vendor-hls-*.js`.
- Tab `Phim Lẻ`: URL `?tab=phim-le`, 24 card; mở modal -> `?info=...`, đóng modal quay lại URL tab, không còn dialog trong DOM.
- Nhảy trang không hợp lệ (`9999`): hiện `Trang phải là số từ 1 đến 717.` với `role="alert"` + `aria-invalid`; nhập `2` + Enter -> `?tab=phim-le&page=2`, ô nhập reset, lỗi biến mất.
- Không có console error/warning hay request failed trong luồng home -> tab -> modal -> phân trang.

- **Phối hợp Frontend ↔ Backend (Cập nhật 2026-10-24 23:00):**
  - **Phía Backend (`opencode`):**
    - 70 test pass (34 unit + 36 e2e), lint clean, build pass.
    - Cung cấp đầy đủ `/api/compat/*` (6 routes raw PhimAPI shape), `/api/v1/*` (normalized DTOs), CORS loopback mọi port trong dev (`localhost`, `127.0.0.1`, `[::1]`) và allowlist `CORS_ORIGINS` ở production.
    - Rate limit 120 req/phút/IP dùng chung mọi route; riêng search 60 req/phút. Lỗi/failed envelope trả `Cache-Control: no-store`, có `X-Request-Id`, `X-Cache`, `Retry-After` và single-flight chống gọi upstream trùng.
    - Swagger tại `/api/docs` đã có schema response, query/path parameter và error schema dùng chung.
  - **Phía Frontend (`anty`):**
    - Chuyển đổi thành công sang chuẩn Normalized API v1: `VITE_API_BASE_URL=http://localhost:3001/api/v1`.
    - Bổ sung **Chỉ báo tập phim đã xem (Watched Episodes Indicator)**: theo dõi tiến trình từng tập riêng biệt trong `storage.ts`, hiển thị huy hiệu dấu tích xanh ngọc (emerald checkmark) và thanh tiến trình trong `VideoPlayer.tsx` và `MovieDetailModal.tsx`.
    - Bổ sung **Bộ lọc & Sắp xếp nâng cao (Sort & Filter)** trong `MovieGrid.tsx`: thêm lọc theo điểm số đánh giá TMDB (`⭐ 8.0+`, `⭐ 7.0+`, `⭐ 6.0+`), bổ sung các tùy chọn sắp xếp mới (`Lượt đánh giá`, `Năm mới nhất`, `Năm cũ nhất`), và thanh chip bộ lọc đang áp dụng với nút xóa nhanh.
    - Đã ngăn chặn vòng lặp re-fetch trong `HeroBanner.tsx` bằng `attemptedSlugsRef` và memoize `heroBannerMovies`.
    - Toàn bộ **137/137 test pass** trên toàn dự án (67 web + 70 backend), lint clean, build web & api 100% pass.

- **Frontend Recency, Accuracy & Auto-Refresh (`feat/frontend-recency-and-accuracy` - 2026-10-24):**
  - **Types & Mapping:**
    - `MovieItem`: thêm `updatedAt?: string` và compat fallback `modified?: { time?: string }`.
    - `sanitizeMovieItem`: ánh xạ `updatedAt` từ trường normalized `item.updatedAt` hoặc compat `item.modified?.time`; validate date chặt chẽ với `Date.parse`, loại bỏ các giá trị không hợp lệ.
  - **Helpers:**
    - `sortMoviesByUpdatedAtDesc(movies)`: sắp xếp ổn định (stable sort) giảm dần theo `updatedAt`; các phim thiếu timestamp được đưa xuống cuối mà vẫn giữ nguyên thứ tự ban đầu từ API.
    - `selectTopRatedMovies(movies, limit = 10, minVotes = 20)`: lọc theo điều kiện TMDB rating (`vote_count >= 20` và `vote_average > 0`), sắp xếp điểm cao nhất trước, tie-breaker theo lượt đánh giá.
    - `formatUpdatedAtBadge(dateStr)`: định dạng badge thời gian cập nhật hiển thị gọn gàng (`Cập nhật HH:mm` nếu trong ngày, `DD/MM HH:mm` nếu ngày trước).
  - **Loại bỏ tuyên bố "Thịnh Hành" không có căn cứ (Truthfulness & UX Recency):**
    - Hero kicker: đổi thành `"PHIM MỚI CẬP NHẬT"` / `"PHIM {COUNTRY} MỚI CẬP NHẬT"`, loại bỏ hoàn toàn chữ `"HÀNG ĐẦU"`.
    - Hàng TOP 10: đổi thành `"TOP 10 Được Đánh Giá Cao"` (subtitle `"Điểm TMDB cao nhất trong các phim vừa cập nhật"`). Nếu có ít hơn 5 phim đủ tiêu chuẩn rating thì ẩn hàng (không fallback về danh sách chưa rating dưới nhãn thịnh hành).
    - Đổi tên các hàng và chip danh mục:
      * `"Mới Cập Nhật Hôm Nay"` -> `"Mới Cập Nhật"` (subtitle: `"Phim và tập mới được cập nhật gần nhất"`).
      * `"Phim Bộ Thịnh Hành"` -> `"Phim Bộ Mới Cập Nhật"` (cả chip khám phá và hàng phim).
      * `"K-Drama: Phim Bộ Hàn Quốc Gây Sốt"` -> `"Phim Hàn Mới Cập Nhật"` (badge `"PHIM HÀN"`).
      * `"Phim Lẻ Đỉnh Cao"` -> `"Phim Lẻ Mới Cập Nhật"` (badge `"PHIM LẺ"`).
      * `"Siêu Phẩm Hành Động & Kịch Tính"` -> `"Hành Động Mới Cập Nhật"` (badge `"HÀNH ĐỘNG"`).
  - **Hiển thị Badge `updatedAt`:**
    - `MovieCard` và `MovieRow` nhận prop `showUpdatedAt?: boolean`.
    - Hàng "Mới Cập Nhật" hiển thị badge thời gian ở góc poster không che episode badge hay poster; có `title` và `aria-label` đầy đủ cho a11y.
    - Loại bỏ fallback `movie.year || '2026'`; nếu thiếu năm phát hành, hiển thị `"—"`.
  - **Sắp xếp MovieGrid:**
    - `SortKey` thêm `'updated-desc'` và đặt làm mặc định; tùy chọn `"Mới cập nhật"` liên kết với `'updated-desc'`; `"Năm phát hành mới nhất"` liên kết với `'year-desc'`.
    - `resetFilters` trả về `'updated-desc'`.
    - Thêm ghi chú rõ ràng về giới hạn sắp xếp client-side trong 24 phim/trang.
  - **Cơ chế Refresh & Cache Bypass:**
    - `loadHome(force)` dùng `Promise.allSettled`, có `homeLoadingRef` chống request trùng.
    - Tự động kiểm tra làm mới khi tab quay lại (`visibilitychange` / `focus`) nếu lần tải trước cách > 60 giây.
    - Hiển thị `"Cập nhật lúc HH:mm"` trên thanh khám phá kèm nút bấm `"Làm mới"` thủ công.
    - `fetchWithCache` và các API getter hỗ trợ `options?: RequestOptions` với `bypassCache: true`, gửi request `cache: 'no-store'` và cập nhật bộ nhớ đệm khi có kết quả mới.
    - Service Worker (`sw.js`): nhận diện `request.cache === 'no-store'` để bỏ qua đọc cache và fetch network; nâng cấp `API_CACHE` lên `cinehub-api-v4` và `SHELL_CACHE` lên `cinehub-shell-v6`.
  - **Kiểm thử:**
    - Toàn bộ **72/72 tests frontend** pass (thêm 5 test mới cho `sanitizeMovieItem`, `sortMoviesByUpdatedAtDesc`, `selectTopRatedMovies`, SW `no-store` cache bypass, và `getNewUpdatedMovies` bypassCache).
    - `oxlint` 0 lỗi, TypeScript typecheck pass, Vite production build hoàn tất sạch sẽ.


