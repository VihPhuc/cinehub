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

## Hướng dẫn chạy dự án

### 1. Yêu cầu hệ thống
- **Node.js**: Phiên bản 20+ hoặc 22+ (khuyến nghị Node 22+).
- **Trình quản lý gói**: `npm` đi kèm với Node.js.

### 2. Cài đặt Dependencies
Cài đặt toàn bộ thư viện cần thiết cho cả Frontend và Backend từ thư mục gốc của dự án:

```bash
npm ci --prefix frontend
npm ci --prefix backend
```

> **Lưu ý**: Nếu clone dự án lần đầu và cần cài mới dependencies, bạn cũng có thể chạy `npm install --prefix frontend` và `npm install --prefix backend`.

### 3. Cấu hình biến môi trường (`.env`)

#### Cấu hình Frontend (Khuyến nghị):
Sao chép file mẫu `.env.example` trong thư mục `frontend/` thành `.env.local`:
```bash
# Trên Windows PowerShell:
Copy-Item frontend/.env.example frontend/.env.local

# Hoặc trên Git Bash / macOS / Linux:
cp frontend/.env.example frontend/.env.local
```

Trong file `frontend/.env.local`:
- **Chế độ kết nối Backend CineHub (Khuyên dùng - Chuẩn Normalized API v1)**:
  ```dotenv
  VITE_API_BASE_URL=http://localhost:3001/api/v1
  ```
  *(Chế độ này cung cấp đầy đủ thông tin chuẩn hóa `updatedAt`, phân trang, sắp xếp và bộ lọc nâng cao từ server).*
- **Chế độ Compat (Proxy định dạng thô PhimAPI)**:
  ```dotenv
  VITE_API_BASE_URL=http://localhost:3001/api/compat
  ```
- **Chế độ Standalone (Frontend độc lập, không cần bật Backend)**:
  Để trống biến này hoặc không tạo file `.env.local`, frontend sẽ tự động gọi trực tiếp nguồn API công khai `https://phimapi.com`.

#### Cấu hình Backend (Tùy chọn):
Nếu bạn muốn tùy chỉnh cấu hình backend (mặc định đã sẵn sàng chạy ở cổng 3001):
```bash
# Windows PowerShell:
Copy-Item backend/.env.example backend/.env
# Hoặc Bash:
cp backend/.env.example backend/.env
```

---

### 4. Khởi chạy dự án

#### Cách 1: Chạy Fullstack đồng thời cả Web và API (Khuyên dùng nhất)
```bash
npm run dev
```
Lệnh này sử dụng script điều phối khởi chạy song song 2 dịch vụ:
- 🌐 **Frontend Web (Vite + React)**: [http://localhost:5173](http://localhost:5173)
- 🚀 **Backend API (NestJS)**: [http://localhost:3001](http://localhost:3001)
  - 📖 Trang tài liệu tương tác Swagger: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)
  - 🩺 Kiểm tra trạng thái máy chủ (Health): [http://localhost:3001/api/health](http://localhost:3001/api/health)

#### Cách 2: Chỉ chạy Frontend
```bash
npm run dev:web
```
Ứng dụng web mở tại [http://localhost:5173](http://localhost:5173). Nếu backend không bật, frontend vẫn xem phim bình thường qua API dự phòng.

#### Cách 3: Chỉ chạy Backend API
```bash
npm run dev:api
# Hoặc: cd backend && npm run start:dev
```
Server NestJS khởi động tại [http://localhost:3001](http://localhost:3001).

---

### 5. Khởi tạo Catalog Index cho Backend (Tùy chọn)
Để kích hoạt tính năng Discovery & Facet filter toàn bộ danh mục (`/api/v1/discover`), chạy lệnh tải và đồng bộ chỉ mục phim cục bộ:
```bash
npm --prefix backend run index:refresh
```
*(Sau khi tạo file index snapshot, khởi động lại backend để nạp dữ liệu vào bộ nhớ).*

---

### 6. Đóng gói & Chạy thử Production (Build & Preview)
```bash
# Đóng gói frontend -> frontend/dist/
npm run build:web

# Đóng gói backend -> backend/dist/
npm run build:api

# Xem trước bản build production của Frontend trên môi trường local (port 4173)
npm run preview
```

---

## Kiểm tra chất lượng

```bash
npm run verify         # Kiểm tra toàn diện: lint + test + build + guard cho cả frontend và backend
npm run test:web       # Chạy Vitest cho frontend (76 tests)
npm run test:api       # Chạy Jest unit + e2e cho backend (109 tests)
npm run lint           # Kiểm tra quy chuẩn code với Oxlint (frontend + backend)
npm run check:bundle   # Guard: Chặn hls.js bị preload sai vào bundle ban đầu
npm run check:deploy   # Guard: Kiểm tra _headers và _redirects bảo mật trong dist
npm run check:mojibake # Guard: Phát hiện lỗi encoding ký tự lạ trong mã nguồn
```

CI tại `.github/workflows/verify.yml` tự động cài đặt và kiểm tra toàn bộ các điều kiện trên khi có push/PR mới.

## Thông tin Backend & Hợp nhất API

Backend NestJS nằm trong `backend/`, cung cấp proxy/cache thông minh cho PhimAPI và hệ thống API chuẩn hóa:
- **Normalized API (Khuyên dùng)**: `/api/v1/*` (xem chi tiết tại [docs/backend-api.md](docs/backend-api.md))
- **Compat API**: `/api/compat/*` (giữ nguyên cấu trúc dữ liệu thô gốc của PhimAPI)
- **Tài liệu Swagger**: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)
- **Kiểm tra sức khỏe**: [http://localhost:3001/api/health](http://localhost:3001/api/health)

Backend không proxy luồng video HLS/iframe; trình phát VideoPlayer vẫn kết nối trực tiếp đến CDN stream để đảm bảo tốc độ tối đa.

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
backend/                  NestJS proxy/cache + normalized API
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

> Backend cung cấp cả chuẩn normalized (`/api/v1/*` — khuyến nghị) và compat (`/api/compat/*`). Frontend
> mặc định gọi trực tiếp `https://phimapi.com` cho đến khi cấu hình
> `VITE_API_BASE_URL=http://localhost:3001/api/v1` (hoặc `/api/compat`); xem `docs/backend-api.md` để tích hợp.

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
