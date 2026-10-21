# Coordination — CineHub

Cập nhật: 2026-10-20 20:32 (sau khi hợp nhất 3 luồng)

## Trạng thái các luồng

| Luồng | File chính | Trạng thái |
|-------|------------|------------|
| Data / TDD | `src/services/api.ts`, `storage.ts`, `validation.ts`, `tmdb.ts`, `*.test.ts`, `src/lib/urlState.ts`, `vitest.config.ts`, `package.json` | Hoàn tất, 40 test pass; cache hết hạn không trả khi online, có clear API cache |
| App / URL & race | `src/App.tsx` | Hoàn tất: hydrate URL, skip ghi URL lần đầu, popstate, request-id + AbortController cho catalog, reset page khi đổi filter, chặn URL-sync khi đang khôi phục watch, lazy-load player |
| Player | `src/components/VideoPlayer.tsx` | Hoàn tất phần P1: retry có giới hạn, HLS lifecycle, throttle history, keyboard guard, sync tập khi back/forward, `resumeFromHistory`, không echo `onEpChange` gây vòng lặp |
| UI / a11y | `MovieDetailModal.tsx`, `MovieCard.tsx`, `Navbar.tsx`, `MovieGrid.tsx`, `HeroBanner.tsx`, `MovieRow.tsx`, `LibraryView.tsx`, `index.css` | Hoàn tất trong tree: DOMPurify + dialog semantics, keyboard card, combobox search |
| PWA / security | `public/sw.js`, `src/main.tsx`, `index.html`, `public/manifest.json`, `public/icon-*.png`, `vite.config.ts` | Hoàn tất: cache có version + giới hạn, navigation fallback, SW chỉ ở PROD, CSP build-only, icon PWA, dọn asset thừa |

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

## Kiểm chứng

Chạy tại `D:\Phim`:

```text
npm test                -> 8 test files, 45 tests passed
npm run lint            -> clean (0 warnings, 0 errors trên 34 files)
npm run build           -> pass (tsc -b + vite build, ~670ms)
npm run check:bundle    -> pass (hls.js không bị preload, deferred)
npm run check:deploy    -> pass (_headers + _redirects đã sinh)
npm run check:mojibake  -> OK: no mojibake
node scripts/audit-check.mjs -> All OK (backend 10/10 OK, UI đầy đủ chỉ số)
```

Kiểm tra thủ công bằng Chrome headless + CDP trên `vite preview`:

- Deep link `?watch=...&ep=2` với slug lỗi: URL vẫn giữ nguyên (không bị ghi đè về `/`).
- Deep link phim thật: player render, không có CSP violation; URL watch giữ nguyên.
- Chọn `Tập 02`: URL thành `?watch=...&ep=1`, UI active Tập 02.
- `history.back()`: URL về `?watch=...&ep=0`, UI active Tập 01; `history.forward()` quay lại Tập 02.
- History chỉ tăng 1 entry cho mỗi lần đổi tập (không còn vòng lặp pushState; trước fix là 50+ entry).
- Service worker: `activated`, scope `/`, cache `cinehub-shell-v4`, `cinehub-api-v3`, `cinehub-images-v1`; shell cache có đủ `/`, `index.html`, manifest, favicon và 4 icon; trang do SW kiểm soát.
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

- **Phối hợp Frontend ↔ Backend (Cập nhật 2026-10-21 22:52):**
  - **Spec & Plan backend từ `opencode`:** Đã đồng bộ theo bản thiết kế [2026-10-21-cinehub-backend-design.md](file:///d:/Phim/docs/superpowers/specs/2026-10-21-cinehub-backend-design.md) và kế hoạch chi tiết [2026-10-21-cinehub-backend.md](file:///d:/Phim/docs/superpowers/plans/2026-10-21-cinehub-backend.md) (NestJS proxy trên port 3001, cache in-memory TTL/LRU, single-flight, hybrid compat `/api/compat` + normalized `/api/v1`).
  - **Phía Frontend (`anty`):**
    - Đã cập nhật [src/services/api.ts](file:///d:/Phim/src/services/api.ts) hỗ trợ biến môi trường `VITE_API_BASE_URL` linh hoạt (mặc định fallback về `https://phimapi.com` khi backend chưa bật, hoặc trỏ tới `http://localhost:3001/api/compat` khi backend chạy).
    - Đã tạo [.env.example](file:///d:/Phim/.env.example) hướng dẫn kết nối backend 1 dòng.
    - Đã cập nhật `connect-src` trong [vite.config.ts](file:///d:/Phim/vite.config.ts) CSP cho phép `http://localhost:3001` và `http://127.0.0.1:3001`.
    - Đã cập nhật [public/sw.js](file:///d:/Phim/public/sw.js) nhận diện các route `/api/compat` và `/api/v1` vào cache API `cinehub-api-v3`.
    - Đã bổ sung bộ unit test trong [src/services/sw.test.ts](file:///d:/Phim/src/services/sw.test.ts) kiểm chứng luồng định tuyến cache của `/api/compat` và `/api/v1`. Toàn bộ 47/47 tests pass 100%.
    - Frontend sẵn sàng kết nối và kiểm chứng ngay khi opencode khởi chạy backend trên port 3001!


