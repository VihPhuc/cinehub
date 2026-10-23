# CineHub — Project Restructure Design

- **Ngày:** 2026-10-23
- **Trạng thái:** Design đã được duyệt trong chat; chờ review spec
- **Phạm vi:** Toàn bộ repo `D:\Phim`
- **Hướng đã chọn:** Tách `frontend/` + `backend/`, không dùng npm workspaces

## 1. Bối cảnh

Repo hiện có 96 file tracked:

- Frontend React + TypeScript + Vite + Tailwind + PWA: 28 file trong `src/`, nằm ở root repo.
- Backend NestJS: 39 file trong `backend/`, là package độc lập.
- Scripts kiểm tra build/deploy: 5 file trong `scripts/`.
- Docs: 4 file trong `docs/`.
- CI: 1 workflow, hiện chỉ verify frontend.

Các điểm chưa gọn:

- Frontend và backend nằm lệch cấp: frontend ở root, backend trong thư mục con.
- `src/` chia theo loại kỹ thuật (`components/`, `services/`, `lib/`, `constants/`), không theo feature.
- Ba file rất lớn: `VideoPlayer.tsx` 1.110 dòng, `App.tsx` 827 dòng, `Navbar.tsx` 783 dòng.
- `Navbar.tsx` gánh nhiều trách nhiệm: search + suggestions, theme, desktop nav, mobile drawer, layout.
- CI không chạy backend, dù backend có 27 unit test + 2 e2e test và build/lint pass.
- Đường dẫn trong scripts phụ thuộc frontend đang ở root.
- Không có cấu hình deploy trong repo; dự án hiện chỉ chạy local.

Baseline trước refactor:

- Frontend: 61 test pass, lint pass, build pass, bundle/deploy/mojibake guards pass.
- Backend: 27 unit test pass, 2 e2e test pass, lint pass, build pass.
- Git tree sạch, `main` đồng bộ `origin/main`.

## 2. Mục tiêu

1. Tổ chức repo thành các khu vực rõ ràng: `frontend/`, `backend/`, `docs/`, `scripts/`.
2. Chuyển frontend sang cấu trúc **feature-first**, gọn và dễ mở rộng.
3. Tách `Navbar` thành các component/hook nhỏ, giữ nguyên public interface và hành vi.
4. Thêm alias `@/` để import ổn định, không phụ thuộc độ sâu thư mục.
5. Gom lệnh chạy/verify về root `package.json`.
6. Đưa backend vào CI cùng frontend.
7. Giữ nguyên UI/UX, luồng dữ liệu, API contract và hành vi hiện tại.

## 3. Ngoài phạm vi

- Không thêm endpoint backend còn thiếu (compat/catalog/search/detail).
- Không đổi API contract frontend ↔ backend.
- Không dùng npm workspaces, không tạo `packages/shared`.
- Không tách `App.tsx` hay `VideoPlayer.tsx` trong lần này; chỉ đổi import.
- Không thiết kế lại UI, không đổi class Tailwind, aria hay hành vi responsive.
- Không sửa lịch sử docs cũ; chỉ cập nhật README và ghi chú docs lịch sử nếu cần.
- Không thay đổi logic cache API, URL state, player, storage.

## 4. Cấu trúc đích

```text
D:\Phim\
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   ├── index.css
│   │   │   ├── urlState.ts
│   │   │   └── urlState.test.ts
│   │   ├── features/
│   │   │   ├── navigation/
│   │   │   │   ├── Navbar.tsx
│   │   │   │   ├── NavbarLogo.tsx
│   │   │   │   ├── DesktopNav.tsx
│   │   │   │   ├── SearchBar.tsx
│   │   │   │   ├── SearchSuggestions.tsx
│   │   │   │   ├── ThemePicker.tsx
│   │   │   │   ├── MobileDrawer.tsx
│   │   │   │   ├── constants.ts
│   │   │   │   └── hooks/
│   │   │   │       ├── useClickOutside.ts
│   │   │   │       ├── useNavbarSearch.ts
│   │   │   │       ├── useRecentSearches.ts
│   │   │   │       └── useThemeAccent.ts
│   │   │   ├── home/
│   │   │   │   └── HeroBanner.tsx
│   │   │   ├── catalog/
│   │   │   │   ├── MovieCard.tsx
│   │   │   │   ├── MovieGrid.tsx
│   │   │   │   └── MovieRow.tsx
│   │   │   ├── detail/
│   │   │   │   └── MovieDetailModal.tsx
│   │   │   ├── player/
│   │   │   │   ├── VideoPlayer.tsx
│   │   │   │   ├── hlsRecovery.ts
│   │   │   │   └── hlsRecovery.test.ts
│   │   │   └── library/
│   │   │       └── LibraryView.tsx
│   │   └── shared/
│   │       ├── api.ts
│   │       ├── api.test.ts
│   │       ├── storage.ts
│   │       ├── storage.test.ts
│   │       ├── sw.test.ts
│   │       ├── theme.ts
│   │       ├── theme.test.ts
│   │       ├── tmdb.ts
│   │       ├── tmdb.test.ts
│   │       ├── types.ts
│   │       ├── validation.ts
│   │       └── validation.test.ts
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   ├── tsconfig.node.json
│   ├── .env.example
│   ├── .env.local              # local, không commit
│   └── .oxlintrc.json
├── backend/                    # giữ nguyên cấu trúc Nest hiện tại
├── docs/
├── scripts/
├── .github/workflows/verify.yml
├── .gitignore
├── README.md
└── package.json                # root orchestrator, không dependencies
```

## 5. Mapping file frontend

| Hiện tại | Sau refactor |
|---|---|
| `src/App.tsx` | `frontend/src/app/App.tsx` |
| `src/main.tsx` | `frontend/src/app/main.tsx` |
| `src/index.css` | `frontend/src/app/index.css` |
| `src/types.ts` | `frontend/src/shared/types.ts` |
| `src/components/HeroBanner.tsx` | `frontend/src/features/home/HeroBanner.tsx` |
| `src/components/LibraryView.tsx` | `frontend/src/features/library/LibraryView.tsx` |
| `src/components/MovieCard.tsx` | `frontend/src/features/catalog/MovieCard.tsx` |
| `src/components/MovieGrid.tsx` | `frontend/src/features/catalog/MovieGrid.tsx` |
| `src/components/MovieRow.tsx` | `frontend/src/features/catalog/MovieRow.tsx` |
| `src/components/MovieDetailModal.tsx` | `frontend/src/features/detail/MovieDetailModal.tsx` |
| `src/components/VideoPlayer.tsx` | `frontend/src/features/player/VideoPlayer.tsx` |
| `src/components/Navbar.tsx` | Tách trong `frontend/src/features/navigation/` |
| `src/constants/filters.ts` | `frontend/src/features/navigation/constants.ts` |
| `src/lib/hlsRecovery.ts` + test | `frontend/src/features/player/hlsRecovery.ts` + test |
| `src/lib/theme.ts` + test | `frontend/src/shared/theme.ts` + test |
| `src/lib/urlState.ts` + test | `frontend/src/app/urlState.ts` + test |
| `src/services/api.ts` + test | `frontend/src/shared/api.ts` + test |
| `src/services/storage.ts` + test | `frontend/src/shared/storage.ts` + test |
| `src/services/sw.test.ts` | `frontend/src/shared/sw.test.ts` |
| `src/services/tmdb.ts` + test | `frontend/src/shared/tmdb.ts` + test |
| `src/services/validation.ts` + test | `frontend/src/shared/validation.ts` + test |
| `public/*` | `frontend/public/*` |
| `index.html` | `frontend/index.html` |
| `vite.config.ts`, `vitest.config.ts`, `tsconfig*.json` | `frontend/` |
| `package.json`, `package-lock.json` | `frontend/` |
| `.env.example`, `.env.local` | `frontend/` |
| `.oxlintrc.json` | `frontend/.oxlintrc.json` |

Lưu ý:

- `src/constants/filters.ts` chỉ được Navbar sử dụng, nên thuộc `features/navigation`, không đưa vào `shared`.
- `urlState.ts` chỉ được `App.tsx` sử dụng, nên thuộc `app/`.
- `hlsRecovery.ts` chỉ được player sử dụng, nên thuộc `features/player/`.
- `shared/` chỉ chứa module thực sự dùng chung.
- Test tiếp tục đặt cạnh file nguồn; Vitest include `src/**/*.test.ts`.
- Không tạo barrel `index.ts` trong từng feature để tránh vòng import; dùng import trực tiếp.

## 6. Alias import

Thêm alias:

```text
@/  ->  frontend/src/
```

Ví dụ:

```ts
import { Navbar } from '@/features/navigation/Navbar';
import { getImageUrl } from '@/shared/api';
import { parseUrlState } from '@/app/urlState';
```

Cấu hình ở ba nơi:

1. `frontend/vite.config.ts` — `resolve.alias`.
2. `frontend/vitest.config.ts` — cùng alias để test resolve được.
3. `frontend/tsconfig.app.json` — `baseUrl` + `paths`.

Không thêm dependency `vite-tsconfig-paths`; dùng `fileURLToPath(new URL('./src', import.meta.url))`.

## 7. Tách Navbar

Public interface giữ nguyên:

```ts
<Navbar
  activeTab={...}
  onSelectTab={...}
  onSearch={...}
  onSelectGenre={...}
  onSelectCountry={...}
  onSelectMovie={...}
  onRandomMovie={...}
  onInstallPwa={...}
  canInstallPwa={...}
  onThemeChange={...}
/>
```

Trách nhiệm từng file:

- `Navbar.tsx`
  - Layout header hiện tại.
  - State `menuOpen`.
  - Gọi `useThemeAccent` để giữ một nguồn theme duy nhất.
  - Ghép `NavbarLogo`, `DesktopNav`, `SearchBar`, `ThemePicker`, các nút utility, `MobileDrawer`.
- `NavbarLogo.tsx`
  - Logo + click về trang chủ.
- `DesktopNav.tsx`
  - Nav tabs desktop.
  - Tự giữ `openDropdown: 'genre' | 'country' | null`.
  - `NavDropdown` nội bộ dùng chung cho Thể Loại/Quốc Gia, thay vì lặp JSX.
  - Nút Tủ Phim.
- `SearchBar.tsx`
  - Input search + phím tắt + render `SearchSuggestions`.
  - Dùng `useNavbarSearch` và `useRecentSearches`.
  - Nhận `onCloseMobileMenu` để đóng drawer khi submit/chọn tag.
- `SearchSuggestions.tsx`
  - Chỉ render panel: kết quả tìm kiếm / gần đây / xu hướng.
  - Không gọi API, không giữ state search.
- `ThemePicker.tsx`
  - Nút theme + popover, chỉ presentational.
  - Nhận `currentTheme`, `open`, `onToggle`, `onSelect`, `containerRef`.
- `MobileDrawer.tsx`
  - Controlled bằng `open` + `onClose`.
  - Nhận `activeTab`, callback chọn tab/genre/country, random, install.
  - Nhận `currentTheme`, `onSelectTheme` và render phần chọn theme trong drawer.

Hooks:

- `useClickOutside(ref, onDismiss, enabled?)`
  - Đóng popover/dropdown khi click ra ngoài.
  - Hỗ trợ tùy chọn đóng bằng Escape cho theme picker.
- `useRecentSearches()`
  - Đọc/ghi `cinehub_recent_searches`.
  - Tối đa 5 mục, không trùng không phân biệt hoa/thường.
  - Trả `recentSearches`, `saveRecentSearch`, `removeRecentSearch`, `clearRecentSearches`.
- `useNavbarSearch({ onSearch, onSelectMovie, onCloseMobileMenu, saveRecentSearch })`
  - `q`, `suggestions`, `isSearching`, `showSuggestions`, `highlightIdx`.
  - Refs: `searchBoxRef`, `searchInputRef`.
  - Debounce khi `q.trim().length >= 2`.
  - Ctrl/Cmd+K và `/` focus search.
  - ArrowUp/ArrowDown/Enter/Escape.
  - Chọn suggestion, chọn tag, submit.
  - Click outside đóng suggestions.
- `useThemeAccent(onThemeChange?)`
  - Được gọi một lần trong `Navbar` để tránh hai nguồn theme lệch nhau.
  - Trả `currentTheme`, `showThemePicker`, `themePickerRef`, `toggleThemePicker`, `closeThemePicker`, `selectTheme`.
  - Áp dụng/lưu theme, đóng popover khi click outside/Escape.
  - `ThemePicker` và `MobileDrawer` chỉ nhận props từ `Navbar`, không tự gọi hook.

Hành vi phải giữ:

- Các class layout của header (`contents`, `order-3`, `w-full`, `ml-auto`, `sm:*`) phải giữ nguyên; component con nhận `className` hoặc wrapper từ `Navbar`, không tự đổi breakpoint.
- Search gợi ý sau 2 ký tự.
- Recent searches lưu localStorage.
- Ctrl/Cmd+K và `/`.
- Theme lưu localStorage và apply trước mount.
- Mobile drawer đóng sau khi chọn tab/genre/country/random/install.
- Dropdown thể loại/quốc gia vẫn giữ hover bridge 8px và không biến mất khi rê chuột qua khe.
- Header mobile 2 hàng dưới 640px, 1 hàng từ 640px.

## 8. Backend

Giữ nguyên cấu trúc Nest hiện tại:

```text
backend/src/
├── main.ts
├── app.module.ts
├── app.setup.ts
├── cache/
├── common/
│   ├── config/
│   ├── dto/
│   └── filters/
├── health/
├── movies/
│   ├── dto/
│   └── mappers/
└── upstream/
```

Không di chuyển file backend trong lần này vì:

- Cấu trúc đã theo module Nest, phù hợp spec backend hiện có.
- Backend đang là package độc lập, không dùng workspaces.
- Việc di chuyển chỉ tăng rủi ro mà không cải thiện đáng kể.

Chỉ thay đổi liên quan backend:

- Thêm backend vào CI.
- Root scripts chạy backend unit/e2e/lint/build.
- Không thêm endpoint, controller hay module mới.

## 9. Root package.json

Root package chỉ orchestrate, không có dependencies:

```json
{
  "name": "cinehub",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "npm --prefix frontend run dev",
    "dev:api": "npm --prefix backend run start:dev",
    "preview": "npm --prefix frontend run preview",
    "build": "npm --prefix frontend run build",
    "build:web": "npm --prefix frontend run build",
    "build:api": "npm --prefix backend run build",
    "test": "npm run test:web && npm run test:api",
    "test:web": "npm --prefix frontend run test",
    "test:api": "npm --prefix backend run test && npm --prefix backend run test:e2e",
    "lint": "npm --prefix frontend run lint && npm --prefix backend run lint",
    "check:bundle": "node scripts/check-bundle.mjs",
    "check:deploy": "node scripts/check-deploy.mjs",
    "check:mojibake": "node scripts/check-mojibake.mjs",
    "verify": "npm run test && npm run lint && npm run build:web && npm run build:api && npm run check:bundle && npm run check:deploy && npm run check:mojibake"
  }
}
```

Cài dependency:

```bash
npm ci --prefix frontend
npm ci --prefix backend
```

Không cần `npm ci` ở root vì root không có dependencies.

`frontend/package.json` sau khi move:

- Đổi `name` thành `cinehub-web` và cập nhật `frontend/package-lock.json`.
- Giữ các script: `dev`, `build`, `lint`, `test`, `test:watch`, `preview`.
- Bỏ `check:bundle`, `check:deploy`, `check:mojibake` khỏi frontend package; các script này do root package chạy để tránh path `frontend/scripts/...` không tồn tại.
- Không thêm dependency mới.

## 10. Scripts

Cập nhật đường dẫn:

- `scripts/check-bundle.mjs`: đọc `frontend/dist/index.html`.
- `scripts/check-deploy.mjs`: đọc `frontend/dist/_headers`, `frontend/dist/_redirects`.
- `scripts/check-mojibake.mjs`: chạy từ root, quét toàn repo; vẫn skip `node_modules`, `dist`, `.git`, `.vite`.
- `scripts/audit-check.mjs`: đổi path sang `frontend/src/...`, `frontend/public/sw.js`, `frontend/vite.config.ts`; script này không nằm trong `verify`.
- `scripts/make-icons.ps1`: ghi icon vào `frontend/public/...`, dùng đường dẫn tính từ `$PSScriptRoot` để chạy được từ mọi cwd.

## 11. CI

Cập nhật `.github/workflows/verify.yml`:

- Setup Node 22.
- Cache npm theo cả `frontend/package-lock.json` và `backend/package-lock.json`.
- `npm ci --prefix frontend`
- `npm ci --prefix backend`
- `npm run verify`

`npm run verify` đã bao gồm:

- Frontend unit test.
- Backend unit test + e2e.
- Lint cả hai.
- Build frontend + backend.
- Bundle guard, deploy guard, mojibake guard.

## 12. Env và PWA

- Chuyển `.env.example` và `.env.local` vào `frontend/`.
- Vite chạy với cwd `frontend/`, tự load `frontend/.env.local`.
- Giữ nguyên giá trị local hiện tại; ghi chú trong README rằng backend compat chưa implement và có thể dùng `VITE_API_BASE_URL=https://phimapi.com` khi cần dữ liệu thật.
- Bump `SHELL_CACHE` trong `frontend/public/sw.js` từ `cinehub-shell-v4` lên `cinehub-shell-v5` vì build asset hash thay đổi.
- Cập nhật mock cache name trong `frontend/src/shared/sw.test.ts` từ `cinehub-shell-v4` sang `cinehub-shell-v5`.
- Không đổi `STATIC_ASSETS`, manifest, icon hay API/image cache.

## 13. README

Cập nhật:

- Cây thư mục mới.
- Lệnh cài đặt/chạy:
  - `npm ci --prefix frontend`
  - `npm ci --prefix backend`
  - `npm run dev`
  - `npm run dev:api`
  - `npm run verify`
- Ghi rõ backend hiện chỉ có `/api/health`; các endpoint trong spec backend là kế hoạch, chưa implement.
- Ghi chú docs trong `docs/superpowers/` là tài liệu lịch sử; một số đường dẫn có thể trỏ tới cấu trúc cũ.

## 14. Rủi ro và biện pháp

| Rủi ro | Biện pháp |
|---|---|
| Move file làm vỡ import | Alias `@/`, chạy `tsc -b` + build + test sau từng phase |
| Root scripts trỏ sai path | Cập nhật toàn bộ scripts; test `npm run verify` từ root |
| `.env.local` không được load | Move vào `frontend/`; chạy dev từ root; kiểm tra API base |
| PWA cache phục vụ shell cũ | Bump `SHELL_CACHE` lên v5 |
| Navbar split làm đổi hành vi | Giữ nguyên Props/DOM/class; Playwright matrix desktop/mobile |
| CI bỏ sót backend | `verify` chạy unit + e2e + lint + build backend |
| Root package không có lockfile | CI dùng `npm ci --prefix`, không `npm ci` root |
| Backend lint đổi behavior khi root `.oxlintrc` được move | Chạy lại backend lint; nếu cần, thêm `backend/.oxlintrc.json` tối thiểu |
| Deploy host cũ | Không có deploy trong repo; dự án chỉ chạy local |

## 15. Các phase triển khai

Làm trên branch `refactor/project-structure`.

### Phase 1 — Move frontend và cập nhật hạ tầng

- Tạo `frontend/`.
- Move `src/`, `public/`, `index.html`, Vite/TS/Vitest config, package files, `.env*`, `.oxlintrc.json`.
- Đổi `frontend/package.json` name thành `cinehub-web`; regenerate `frontend/package-lock.json`.
- Bỏ các script `check:*` khỏi frontend package (đã chuyển sang root package).
- Tạo root `package.json` orchestrator.
- Cập nhật scripts, CI, README, `.gitignore` nếu cần.
- Kiểm tra backend lint sau khi root `.oxlintrc.json` được move; thêm config backend nếu cần.
- Chưa đổi cấu trúc bên trong `src`.
- Chạy `npm run verify`.
- Commit: `refactor: move web app into frontend workspace`.

### Phase 2 — Feature-first frontend

- Move file theo mapping mục 5.
- Thêm alias `@/`.
- Cập nhật toàn bộ import.
- Chạy `npm run verify`.
- Commit: `refactor: organize frontend by feature`.

### Phase 3 — Tách Navbar

- Tạo các component/hook trong `features/navigation`.
- Giữ nguyên Props và hành vi.
- Chạy `npm run verify` + Playwright.
- Commit: `refactor: split navbar into navigation feature`.

### Phase 4 — Hoàn tất

- Chạy full verification.
- Kiểm tra `git status`, không còn file frontend cũ ở root.
- Push branch.
- Merge `main` sau khi người dùng duyệt kết quả.

## 16. Verification matrix

### Automated

- `npm run test:web`: 61 test pass.
- `npm run test:api`: 27 unit + 2 e2e pass.
- `npm run lint`: frontend + backend pass.
- `npm run build:web`: pass.
- `npm run build:api`: pass.
- `npm run check:bundle`: pass.
- `npm run check:deploy`: pass.
- `npm run check:mojibake`: pass.

### Browser / manual

- `npm run dev` từ root mở `http://localhost:5173`.
- 280 / 295 / 320 / 360 / 375 / 390 / 414 / 480 / 639px:
  - Header 2 hàng, logo/search/menu không đè.
  - Search suggestions full width trong viewport.
  - Theme popover trong viewport.
  - Mobile drawer mở, chọn thể loại đúng URL.
- 640 / 768 / 1023 / 1024 / 1279px:
  - Header 1 hàng, không tràn.
  - Hamburger hoạt động.
- 1280 / 1440px:
  - Desktop nav hiển thị.
  - Dropdown Thể Loại/Quốc Gia mở, hover qua khe 8px không mất.
  - Chọn thể loại/quốc gia cập nhật URL đúng.
- Search:
  - Ctrl/Cmd+K và `/` focus.
  - Gõ >= 2 ký tự có suggestions.
  - Chọn phim/tag hoạt động.
- Theme:
  - Đổi theme, reload vẫn giữ.
- PWA:
  - `frontend/dist` có `manifest.json`, icon, `sw.js`, `_headers`, `_redirects`.
  - Preview không có lỗi console/CSP.

## 17. Acceptance criteria

1. Root tracked chỉ còn `frontend/`, `backend/`, `docs/`, `scripts/`, `.github/`, `README.md`, `package.json` và file cấu hình git (không tính `node_modules`, `dist`, `.superpowers`).
2. Không còn `src/`, `public/`, `index.html`, Vite/TS/Vitest config hay package frontend ở root.
3. `frontend/src` đúng cây feature-first.
4. `Navbar` public Props không đổi; hành vi desktop/mobile giữ nguyên.
5. `npm run verify` từ root pass toàn bộ.
6. Backend được CI verify.
7. README hướng dẫn đúng lệnh và cấu trúc mới.
8. Git tree sạch sau commit; branch được push.

## 18. Quyết định đã chốt

- Dùng `frontend/` + `backend/`, không dùng `apps/` hay npm workspaces.
- Backend giữ nguyên cấu trúc Nest; không làm endpoint mới.
- Không tách `App.tsx`/`VideoPlayer.tsx` trong lần này.
- Root package không có dependencies, chỉ orchestrate.
- Dự án chưa deploy; không cần cấu hình host.
