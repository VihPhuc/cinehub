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
npm ci
npm run dev        # http://localhost:5173
npm run build      # tsc -b + vite build -> dist/
npm run preview    # chạy thử bản production
```

## Kiểm tra chất lượng

```bash
npm test               # Vitest: data/cache/URL/SW
npm run lint           # Oxlint
npm run build          # type-check + production build
npm run check:bundle   # chặn hls.js bị preload lại vào bundle đầu
npm run check:deploy   # kiểm tra _headers/_redirects được sinh ra
npm run check:mojibake # phát hiện lỗi encoding trong source
```

CI tại `.github/workflows/verify.yml` chạy toàn bộ các bước trên khi push/PR.

## Cấu trúc chính

```text
src/
  App.tsx                 URL state, điều hướng, tải dữ liệu
  components/             Hero, grid/row, modal chi tiết, player, navbar...
  services/
    api.ts                PhimAPI client, cache, dedup, timeout
    tmdb.ts               tạo URL embed VidSrc từ metadata TMDB
    storage.ts            favorites/history/backup có validate
    validation.ts         schema, URL an toàn, giới hạn dữ liệu
  lib/
    urlState.ts           parse/serialize query string
    hlsRecovery.ts        policy retry cho HLS
  main.tsx                mount app + đăng ký service worker (PROD)
public/
  sw.js                   app shell + API + image runtime cache
  manifest.json           PWA manifest
scripts/                  bundle/deploy/encoding guards
```

### URL state

Các tham số được hỗ trợ: `tab`, `genre`, `country`, `q`, `page`, `info`, `watch`, `ep`.
`src/lib/urlState.ts` chịu trách nhiệm parse, giới hạn giá trị và serialize; `App.tsx`
đồng bộ state với `history.pushState` và xử lý `popstate`/back-forward.

## Dữ liệu và cache

- API: `https://phimapi.com`; ảnh: `https://phimimg.com`.
- Cache API trong bộ nhớ + `sessionStorage`, TTL 4 phút; request trùng được dedup.
- Service worker dùng cache có version:
  - `cinehub-shell-v4` — app shell
  - `cinehub-api-v3` — API, TTL 4 phút, dữ liệu hết hạn chỉ dùng offline
  - `cinehub-images-v1` — ảnh, giới hạn số entry
- Khi deploy thay đổi asset, bump version cache trong `public/sw.js`.

## Bảo mật

- HTML mô tả phim được sanitize bằng DOMPurify trước khi render.
- URL stream/embed được validate; iframe có `sandbox`, `referrerPolicy`.
- CSP production được inject vào `index.html` và sinh thêm `dist/_headers`.
- `dist/_headers` / `dist/_redirects` dành cho host hỗ trợ định dạng này
  (Netlify, Cloudflare Pages). Với Vercel/GitHub Pages hoặc reverse proxy, cấu hình
  tương đương ở tầng host.
- Các header gồm CSP, `frame-ancestors 'none'`, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, Referrer Policy, Permissions Policy và HSTS.

## Lưu ý

- Dữ liệu đến từ API bên thứ ba nên schema có thể thay đổi; các trường không hợp lệ
  được bỏ qua thay vì làm crash UI.
- HLS/iframe, retry, fullscreen và PiP cần được kiểm tra thêm trên thiết bị/network thật.
- Player/HLS chunk chỉ được service worker cache sau lần đầu mở một phim.
