# CineHub

Ứng dụng xem phim trực tuyến (SPA) xây dựng bằng React + TypeScript + Vite + Tailwind CSS.

- Duyệt phim lẻ, phim bộ, anime, TV shows; tìm kiếm và lọc theo thể loại/quốc gia.
- Xem HLS bằng `hls.js`, fallback iframe cho server không có m3u8.
- Lưu phim yêu thích, lịch sử xem và thời gian phát; hỗ trợ sao lưu/khôi phục JSON.
- PWA: cài đặt, offline app shell, cache API/ảnh có giới hạn và TTL.
- Deep link chia sẻ được trạng thái tab, tìm kiếm, phim đang xem và tập phim.

## Dự án được xây dựng thế nào

Đây là dự án học tập có sử dụng AI ("vibe coding"). Toàn bộ code ứng dụng được
sinh ra bằng công cụ AI; mình đặt yêu cầu, làm việc với AI và hiện đang đọc lại
codebase để hiểu, sửa lỗi và tự kiểm thử.

Mình không trình bày dự án này như code tự viết tay. Trọng tâm hiện tại:

- Hiểu luồng dữ liệu: URL state → API → cache → player.
- Tái hiện và sửa lỗi.
- Viết test và tập giải thích kiến trúc.

## Chạy local

Yêu cầu Node.js 22+ (khuyến nghị) và npm.

```bash
npm ci --prefix frontend
npm ci --prefix backend
npm run dev           # http://localhost:5173
npm run dev:api       # NestJS API ở http://localhost:3001
npm run build:web     # tsc -b + vite build -> frontend/dist/
npm run preview
```

## Kiểm tra chất lượng

```bash
npm run verify         # lint + test + build + guard cho cả frontend/backend
npm run test:web       # Vitest frontend
npm run test:api       # Jest unit + e2e backend
npm run lint           # Oxlint frontend + backend
npm run check:bundle   # chặn hls.js bị preload lại vào bundle đầu
npm run check:deploy   # kiểm tra _headers/_redirects trong frontend/dist
npm run check:mojibake # phát hiện lỗi encoding trong source
```

CI tại `.github/workflows/verify.yml` cài đặt và kiểm tra cả hai package `frontend/` và `backend/` khi push/PR.

## Cấu trúc chính

```text
frontend/
  src/
    app/                  App, main, URL state, global CSS
    features/
      navigation/         Navbar + logo/desktop/search/theme/drawer + hooks
      home/               HeroBanner
      catalog/            MovieCard, MovieGrid, MovieRow
      detail/             MovieDetailModal
      player/             VideoPlayer, hlsRecovery
      library/            LibraryView
    shared/               api, storage, tmdb, validation, theme, types
  public/                 sw.js, manifest, icons
  vite/vitest/tsconfig    cấu hình riêng của frontend
backend/                  NestJS API hiện có
scripts/                  bundle/deploy/encoding guards, icon generator
docs/                     spec và implementation plan
.github/workflows/        verify.yml
```

### URL state

Các tham số được hỗ trợ: `tab`, `genre`, `country`, `q`, `page`, `info`, `watch`, `ep`.
`frontend/src/app/urlState.ts` chịu trách nhiệm parse, giới hạn giá trị và serialize; `frontend/src/app/App.tsx`
đồng bộ state với `history.pushState` và xử lý `popstate`/back-forward.

## Dữ liệu và cache

- API: `https://phimapi.com`; ảnh: `https://phimimg.com`.
- Cache API trong bộ nhớ + `sessionStorage`, TTL 4 phút; request trùng được dedup.
- Service worker dùng cache có version:
  - `cinehub-shell-v5` — app shell
  - `cinehub-api-v3` — API, TTL 4 phút, dữ liệu hết hạn chỉ dùng offline
  - `cinehub-images-v1` — ảnh, giới hạn số entry
- Khi build thay đổi asset, bump shell cache trong `frontend/public/sw.js`.

> Backend hiện chỉ có endpoint `/api/health`. Các module compat/catalog/search/detail
> trong tài liệu cũ chưa được implement; frontend mặc định gọi trực tiếp `https://phimapi.com`.

## Bảo mật

- HTML mô tả phim được sanitize bằng DOMPurify trước khi render.
- URL stream/embed được validate; iframe có `sandbox`, `referrerPolicy`.
- CSP production được inject vào `index.html` và sinh thêm `frontend/dist/_headers`.
- `frontend/dist/_headers` / `frontend/dist/_redirects` dành cho host hỗ trợ định dạng này
  (Netlify, Cloudflare Pages). Với Vercel/GitHub Pages hoặc reverse proxy, cấu hình
  tương đương ở tầng host.
- Các header gồm CSP, `frame-ancestors 'none'`, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, Referrer Policy, Permissions Policy và HSTS.

## Lưu ý

- Dữ liệu đến từ API bên thứ ba nên schema có thể thay đổi; các trường không hợp lệ
  được bỏ qua thay vì làm crash UI.
- HLS/iframe, retry, fullscreen và PiP cần được kiểm tra thêm trên thiết bị/network thật.
- Player/HLS chunk chỉ được service worker cache sau lần đầu mở một phim.
