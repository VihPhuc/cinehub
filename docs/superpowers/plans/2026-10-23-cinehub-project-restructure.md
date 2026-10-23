# CineHub Project Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Vite app into `frontend/`, reorganize frontend source by feature, split `Navbar` into focused components/hooks, and make `npm run verify` validate both frontend and backend from the repo root.

**Architecture:** Two independent packages (`frontend/`, `backend/`) without npm workspaces. A root `package.json` orchestrates installs, dev servers, tests, builds, and guards. Frontend uses the `@/` alias and the boundaries `app/` → `features/` → `shared/`. Backend keeps its existing NestJS module layout and only gains CI coverage.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind CSS 4, Vitest 5, NestJS 11, Jest 29, oxlint, GitHub Actions, Node.js 22.

**Spec:** `docs/superpowers/specs/2026-10-23-cinehub-project-restructure-design.md`

## Global Constraints

- Không dùng npm workspaces; frontend và backend là hai package độc lập.
- Không thêm dependency npm mới.
- Không đổi UI/UX, Tailwind classes, aria, responsive behavior, API contract hay data flow.
- Không thêm endpoint/controller/module backend.
- Backend giữ nguyên cấu trúc Nest hiện tại.
- `App.tsx` và `VideoPlayer.tsx` chỉ đổi import, không tách file trong plan này.
- Tất cả lệnh frontend chạy với cwd `frontend/`; root chỉ orchestrate bằng `npm --prefix frontend`.
- Node.js 22+.
- Branch làm việc: `refactor/project-structure`.
- Mỗi task kết thúc bằng một commit xanh, trừ Task 0.
- Baseline phải giữ: frontend 61 test; backend 27 unit + 2 e2e; lint/build pass.

## Review Focus

Các failure mode dễ xảy ra nhất, và task sở hữu test/verification:

1. **Import resolution sau khi move** — alias `@/` phải resolve đồng thời ở Vite, Vitest và `tsc`. Test: `npm run build:web` + `npm run test:web` trong Task 3.
2. **Vite cwd/env/public path** — `.env.local`, `index.html`, `public/sw.js` phải nằm trong `frontend/`; test PWA/sw và một lần `npm run dev` smoke trong Task 2/3.
3. **Root scripts trên Windows** — `npm --prefix frontend`/`backend` phải chạy đúng cwd; test toàn bộ `npm run verify` trong Task 2.
4. **Navbar state ownership** — theme chỉ một nguồn ở `Navbar` (header + drawer đồng bộ); logo clear query; search/menu đóng đúng; dropdown hover bridge `pt-2`; test browser trong Task 4–7.
5. **PWA cache + CI hai package** — cache shell version phải bump sau khi build hash đổi; CI phải chạy cả backend; test `npm run verify` + SW unit test trong Task 9.

---

## Task 0: Baseline and branch

**Files:** commit the reviewed spec clarification + this plan before code changes.

- [ ] **Step 1: Verify the current baseline from the repo root.**

Run:
```powershell
npm test
npm run lint
npm run build
npm --prefix backend test
npm --prefix backend run test:e2e
npm --prefix backend run lint
npm --prefix backend run build
```
Expected: frontend 61/61 tests pass; backend 27 unit tests + 2 e2e tests pass; all lint/build commands exit `0`.

- [ ] **Step 2: Confirm only the reviewed docs are pending.**

Run:
```powershell
git status --short --branch
```
Expected: `## main...origin/main`; only the spec snippet (`M docs/superpowers/specs/...`) and the new plan (`?? docs/superpowers/plans/...`) are present. If any source/config file is modified, stop and inspect it before continuing.

- [ ] **Step 3: Create the working branch.**

Run:
```powershell
git switch -c refactor/project-structure
```
Expected: `Switched to a new branch 'refactor/project-structure'`.

- [ ] **Step 4: Commit the reviewed docs so later `git add -A` cannot swallow them.**

Run:
```powershell
git add docs/superpowers/specs/2026-10-23-cinehub-project-restructure-design.md docs/superpowers/plans/2026-10-23-cinehub-project-restructure.md
git commit -m "docs: add restructure implementation plan"
```
Expected: docs commit on `refactor/project-structure`; later task commits contain code/config only.

---

## Task 1: Move the web app into `frontend/`

**Files:**
- Move: `src/`, `public/`, `index.html`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `package.json`, `package-lock.json`, `.env.example`, `.oxlintrc.json`
- Move untracked: `.env.local` → `frontend/.env.local`
- Edit: `frontend/package.json`

- [ ] **Step 1: Move tracked shell files with `git mv`.**

Run:
```powershell
New-Item -ItemType Directory -Force frontend | Out-Null
git mv src frontend/src
git mv public frontend/public
git mv index.html frontend/index.html
git mv vite.config.ts frontend/vite.config.ts
git mv vitest.config.ts frontend/vitest.config.ts
git mv tsconfig.json frontend/tsconfig.json
git mv tsconfig.app.json frontend/tsconfig.app.json
git mv tsconfig.node.json frontend/tsconfig.node.json
git mv package.json frontend/package.json
git mv package-lock.json frontend/package-lock.json
git mv .env.example frontend/.env.example
git mv .oxlintrc.json frontend/.oxlintrc.json
```
Expected: `git status --short` shows only renames.

- [ ] **Step 2: Move the untracked local env file, if present.**

Run:
```powershell
if (Test-Path .env.local) { Move-Item .env.local frontend/.env.local }
```
Expected: `frontend/.env.local` exists and stays untracked. Do not commit it.

- [ ] **Step 3: Rename the frontend package and remove root-only check scripts.**

Edit `frontend/package.json`:
```diff
-  "name": "movie-web",
+  "name": "cinehub-web",
   "private": true,
   "version": "0.0.0",
   "type": "module",
   "scripts": {
     "dev": "vite",
     "build": "tsc -b && vite build",
     "lint": "oxlint",
     "test": "vitest run",
     "test:watch": "vitest",
-    "check:bundle": "node scripts/check-bundle.mjs",
-    "check:deploy": "node scripts/check-deploy.mjs",
-    "check:mojibake": "node scripts/check-mojibake.mjs",
    "preview": "vite preview"
   },
```
Do not change dependency versions.

- [ ] **Step 4: Refresh the lockfile name and install inside `frontend/`.**

Run:
```powershell
npm install --package-lock-only --prefix frontend
npm ci --prefix frontend
```
Expected: install exits `0`; `frontend/package-lock.json` has `"name": "cinehub-web"`; no dependency version changes beyond the root package name.

- [ ] **Step 5: Verify frontend checks from the new package root.**

Run:
```powershell
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
```
Expected: 61/61 tests pass; lint exits `0`; build writes `frontend/dist` and exits `0`. `frontend/src/services/sw.test.ts` still reads `public/sw.js` relative to cwd `frontend/`, so it passes.

- [ ] **Step 6: Verify backend is untouched.**

Run:
```powershell
npm --prefix backend test
```
Expected: 27/27 unit tests pass.

- [ ] **Step 7: Commit.**

Run:
```powershell
git add -A
git commit -m "refactor: move web app into frontend package"
```
Expected: one commit containing the tracked renames and `frontend/package.json`/lockfile changes; `.env.local` is not staged.

---

## Task 2: Root orchestration, guards, and CI

**Files:**
- Create: `package.json` (root)
- Edit: `scripts/check-bundle.mjs`, `scripts/check-deploy.mjs`, `scripts/make-icons.ps1`
- Edit: `.github/workflows/verify.yml`
- Edit: `frontend/.env.example`

- [ ] **Step 1: Create the root orchestrator package.**

Write `package.json` at the repo root:
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
Do not add dependencies or npm workspaces. Root `install` is intentionally absent; install each package with `npm ci --prefix frontend` and `npm ci --prefix backend`.

- [ ] **Step 2: Point bundle/deploy guards at `frontend/dist`.**

In `scripts/check-bundle.mjs`, replace:
```diff
-const html = readFileSync('dist/index.html', 'utf8');
+const html = readFileSync('frontend/dist/index.html', 'utf8');
```
Also update both error strings from `dist/index.html` to `frontend/dist/index.html`.

In `scripts/check-deploy.mjs`, replace the two `required` paths:
```diff
-required('dist/_headers', [
+required('frontend/dist/_headers', [
...
-required('dist/_redirects', [/\/\*\s+\/index\.html\s+200/]);
+required('frontend/dist/_redirects', [/\/\*\s+\/index\.html\s+200/]);
```
Keep all header assertions unchanged.

- [ ] **Step 3: Make the icon generator repo-root-safe.**

Replace the first lines of `scripts/make-icons.ps1` with:
```powershell
Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent $PSScriptRoot
$publicDir = Join-Path $repoRoot 'frontend/public'

$configs = @(
    @{ Size = 192; Path = (Join-Path $publicDir 'icon-192.png'); Maskable = $false },
    @{ Size = 512; Path = (Join-Path $publicDir 'icon-512.png'); Maskable = $false },
    @{ Size = 512; Path = (Join-Path $publicDir 'icon-maskable-512.png'); Maskable = $true },
    @{ Size = 180; Path = (Join-Path $publicDir 'apple-touch-icon.png'); Maskable = $false }
)
```
Leave the drawing loop unchanged; `$c.Path` is already used by `$bmp.Save(...)`.

- [ ] **Step 4: Update the example environment comments.**

Replace `frontend/.env.example` with:
```dotenv
# CineHub Environment Configuration
# Chạy backend từ repo root: npm run dev:api (NestJS ở port 3001; hiện chỉ có /api/health)
# VITE_API_BASE_URL=http://localhost:3001/api/compat

# Backend compat chưa implement; dùng https://phimapi.com nếu cần dữ liệu thật.
# Mặc định nếu không đặt biến này, frontend sẽ gọi trực tiếp https://phimapi.com
```

- [ ] **Step 5: Replace CI with frontend + backend verification.**

Write `.github/workflows/verify.yml`:
```yaml
name: Verify

on:
  push:
    branches: [develop, main]
  pull_request:

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: |
            frontend/package-lock.json
            backend/package-lock.json
      - run: npm ci --prefix frontend
      - run: npm ci --prefix backend
      - run: npm run verify
```

- [ ] **Step 6: Run the full root verification.**

Run:
```powershell
npm run verify
```
Expected, in order: frontend 61 tests; `frontend/dist` built; bundle/deploy/mojibake/sw guards pass; backend 27 unit tests + 2 e2e tests; backend build passes. Exit code `0`.

- [ ] **Step 7: Smoke the dev command wiring.**

Run in one terminal:
```powershell
npm run dev
```
Expected: Vite starts and prints a local URL; open it once and confirm the app shell renders. Stop with `Ctrl+C`. Do not start the backend unless you need the compat proxy; `https://phimapi.com` is the default data source.

- [ ] **Step 8: Commit.**

Run:
```powershell
git add package.json scripts/check-bundle.mjs scripts/check-deploy.mjs scripts/make-icons.ps1 .github/workflows/verify.yml frontend/.env.example
git commit -m "chore: orchestrate frontend and backend verification"
```

---

## Task 3: Feature-first frontend moves and `@/` alias

**Files:** move all files under `frontend/src/` into `app/`, `features/`, `shared/`; add aliases in `frontend/vite.config.ts`, `frontend/vitest.config.ts`, `frontend/tsconfig.app.json`; update imports.

- [ ] **Step 1: Create the target directories.**

Run:
```powershell
$dirs = @(
  'frontend/src/app',
  'frontend/src/shared',
  'frontend/src/features/home',
  'frontend/src/features/catalog',
  'frontend/src/features/detail',
  'frontend/src/features/player',
  'frontend/src/features/library',
  'frontend/src/features/navigation'
)
$dirs | ForEach-Object { New-Item -ItemType Directory -Force $_ | Out-Null }
```

- [ ] **Step 2: Move `app/` and `shared/` files.**

Run:
```powershell
git mv frontend/src/App.tsx frontend/src/app/App.tsx
git mv frontend/src/main.tsx frontend/src/app/main.tsx
git mv frontend/src/index.css frontend/src/app/index.css
git mv frontend/src/lib/urlState.ts frontend/src/app/urlState.ts
git mv frontend/src/lib/urlState.test.ts frontend/src/app/urlState.test.ts

git mv frontend/src/types.ts frontend/src/shared/types.ts
git mv frontend/src/services/api.ts frontend/src/shared/api.ts
git mv frontend/src/services/api.test.ts frontend/src/shared/api.test.ts
git mv frontend/src/services/storage.ts frontend/src/shared/storage.ts
git mv frontend/src/services/storage.test.ts frontend/src/shared/storage.test.ts
git mv frontend/src/services/sw.test.ts frontend/src/shared/sw.test.ts
git mv frontend/src/services/tmdb.ts frontend/src/shared/tmdb.ts
git mv frontend/src/services/tmdb.test.ts frontend/src/shared/tmdb.test.ts
git mv frontend/src/services/validation.ts frontend/src/shared/validation.ts
git mv frontend/src/services/validation.test.ts frontend/src/shared/validation.test.ts
git mv frontend/src/lib/theme.ts frontend/src/shared/theme.ts
git mv frontend/src/lib/theme.test.ts frontend/src/shared/theme.test.ts
```

- [ ] **Step 3: Move feature files.**

Run:
```powershell
git mv frontend/src/components/HeroBanner.tsx frontend/src/features/home/HeroBanner.tsx

git mv frontend/src/components/MovieCard.tsx frontend/src/features/catalog/MovieCard.tsx
git mv frontend/src/components/MovieGrid.tsx frontend/src/features/catalog/MovieGrid.tsx
git mv frontend/src/components/MovieRow.tsx frontend/src/features/catalog/MovieRow.tsx

git mv frontend/src/components/MovieDetailModal.tsx frontend/src/features/detail/MovieDetailModal.tsx

git mv frontend/src/components/VideoPlayer.tsx frontend/src/features/player/VideoPlayer.tsx
git mv frontend/src/lib/hlsRecovery.ts frontend/src/features/player/hlsRecovery.ts
git mv frontend/src/lib/hlsRecovery.test.ts frontend/src/features/player/hlsRecovery.test.ts

git mv frontend/src/components/LibraryView.tsx frontend/src/features/library/LibraryView.tsx

git mv frontend/src/components/Navbar.tsx frontend/src/features/navigation/Navbar.tsx
git mv frontend/src/constants/filters.ts frontend/src/features/navigation/constants.ts
```

- [ ] **Step 4: Remove the now-empty old directories.**

Run:
```powershell
@('frontend/src/components','frontend/src/constants','frontend/src/lib','frontend/src/services') | ForEach-Object {
  if ((Test-Path $_) -and -not (Get-ChildItem $_ -Force)) { Remove-Item $_ }
}
```
Expected: `Get-ChildItem frontend/src` lists only `app`, `features`, `shared`.

Update the Vite entry in `frontend/index.html`:
```diff
-    <script type="module" src="/src/main.tsx"></script>
+    <script type="module" src="/src/app/main.tsx"></script>
```
This is required after moving `main.tsx`; leaving it at `/src/main.tsx` produces a blank page.

- [ ] **Step 5: Add the Vite alias.**

In `frontend/vite.config.ts`, add the import and `resolve` option:
```diff
 import react from '@vitejs/plugin-react'
 import tailwindcss from '@tailwindcss/vite'
+import { fileURLToPath, URL } from 'node:url'
 import { defineConfig } from 'vite'
 import type { Plugin } from 'vite'
@@
 export default defineConfig({
   plugins: [react(), tailwindcss(), cspPlugin(), securityHeadersPlugin()],
+  resolve: {
+    alias: {
+      '@': fileURLToPath(new URL('./src', import.meta.url)),
+    },
+  },
   build: {
```

- [ ] **Step 6: Add the Vitest alias.**

Replace `frontend/vitest.config.ts` with:
```ts
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    restoreMocks: true,
    clearMocks: true,
    unstubGlobals: true,
  },
});
```

- [ ] **Step 7: Add the TypeScript path alias.**

In `frontend/tsconfig.app.json`, add only the `paths` mapping inside `compilerOptions`. TypeScript 6 rejects `baseUrl`, so do not add it:
```json
"paths": {
  "@/*": ["./src/*"]
},
```
Keep `"include": ["src"]` and `"exclude": ["src/**/*.test.ts"]` unchanged.

- [ ] **Step 8: Update imports by destination.**

Use this table; keep relative imports inside the same folder.

| File | Replace |
|---|---|
| `frontend/src/app/App.tsx` | `./services/api` → `@/shared/api`; `./types` → `@/shared/types`; `./services/storage` → `@/shared/storage`; `./lib/urlState` → `./urlState`; `./lib/theme` → `@/shared/theme`; `./components/Navbar` → `@/features/navigation/Navbar`; `./components/HeroBanner` → `@/features/home/HeroBanner`; `./components/MovieRow` → `@/features/catalog/MovieRow`; `./components/MovieGrid` → `@/features/catalog/MovieGrid`; `./components/MovieDetailModal` → `@/features/detail/MovieDetailModal`; `./components/LibraryView` → `@/features/library/LibraryView`; lazy `./components/VideoPlayer` → `@/features/player/VideoPlayer` |
| `frontend/src/app/main.tsx` | `./App.tsx` → `./App`; `./lib/theme` → `@/shared/theme`; keep `./index.css` |
| `frontend/src/app/urlState.test.ts` | no change (`./urlState` stays) |
| `frontend/src/shared/api.ts` | `../types` → `./types`; keep `./validation`, `./tmdb` |
| `frontend/src/shared/storage.ts` | `../types` → `./types`; keep `./validation` |
| `frontend/src/shared/validation.ts` | `../types` → `./types` |
| `frontend/src/shared/tmdb.ts` | `../types` → `./types` |
| `frontend/src/shared/*.test.ts` | keep same-folder relative imports |
| `frontend/src/features/home/HeroBanner.tsx` | `../types` → `@/shared/types`; `../services/api` → `@/shared/api` |
| `frontend/src/features/catalog/MovieCard.tsx` | `../types` → `@/shared/types`; `../services/api` → `@/shared/api` |
| `frontend/src/features/catalog/MovieGrid.tsx` | `../types` → `@/shared/types`; `../services/api` → `@/shared/api`; keep `./MovieCard` |
| `frontend/src/features/catalog/MovieRow.tsx` | `../types` → `@/shared/types`; keep `./MovieCard` |
| `frontend/src/features/detail/MovieDetailModal.tsx` | `../types` → `@/shared/types`; `../services/api` → `@/shared/api` |
| `frontend/src/features/player/VideoPlayer.tsx` | `../types` → `@/shared/types`; `../services/storage` → `@/shared/storage`; `../services/api` → `@/shared/api`; `../lib/hlsRecovery` → `./hlsRecovery` |
| `frontend/src/features/player/hlsRecovery.test.ts` | no change (`./hlsRecovery` stays) |
| `frontend/src/features/library/LibraryView.tsx` | `../types` → `@/shared/types`; `../services/api` → `@/shared/api`; `../services/storage` → `@/shared/storage` |
| `frontend/src/features/navigation/Navbar.tsx` | `../constants/filters` → `./constants`; `../services/api` → `@/shared/api`; `../types` → `@/shared/types`; `../lib/theme` → `@/shared/theme` |

- [ ] **Step 9: Verify imports and behavior.**

Run:
```powershell
npm run build:web
npm run test:web
npm --prefix frontend run lint
npm run verify
```
Expected: build compiles with no unresolved imports; 61/61 tests pass (including the SW test); lint passes; root verify passes both packages.

Search for stale paths:
```powershell
rg -n "from '\.\./(types|services|lib|constants)" frontend/src
```
Expected: no output.

- [ ] **Step 10: Commit.**

Run:
```powershell
git add -A
git commit -m "refactor: organize frontend by feature"
```

---

## Task 4: Extract `NavbarLogo` and `DesktopNav`

> Line ranges below refer to the original 783-line `Navbar.tsx`. After each extraction, locate blocks by their JSX comments and markers (`{/* Logo */}`, `{/* Desktop Nav Items */}`, etc.), not by stale line numbers.

**Files:**
- Create: `frontend/src/features/navigation/NavbarLogo.tsx`
- Create: `frontend/src/features/navigation/DesktopNav.tsx`
- Edit: `frontend/src/features/navigation/Navbar.tsx`

- [ ] **Step 1: Create `NavbarLogo.tsx`.**

Write:
```tsx
import { Film } from 'lucide-react';

interface NavbarLogoProps {
  onHome: () => void;
}

export function NavbarLogo({ onHome }: NavbarLogoProps) {
  return (
    <button
      onClick={onHome}
      className="group flex items-center gap-2.5 cursor-pointer text-left focus:outline-none shrink-0"
    >
      <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 flex items-center justify-center shadow-lg shadow-red-600/30 group-hover:shadow-red-600/50 group-hover:scale-105 transition-all shrink-0">
        <Film className="w-5 h-5 text-white" />
        <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <span className="text-xl font-black tracking-tight font-heading text-white">
          CINE<span className="bg-gradient-to-r from-red-500 via-rose-500 to-amber-400 bg-clip-text text-transparent">HUB</span>
        </span>
        <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-red-600/20 text-red-400 border border-red-500/30">
          HD
        </span>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Create `DesktopNav.tsx` from the existing desktop block.**

Create `DesktopNav.tsx` with this public interface:
```tsx
interface DesktopNavProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onSelectGenre: (slug: string, name: string) => void;
  onSelectCountry: (slug: string, name: string) => void;
}
```
Inside the file:
- Import `ChevronDown`, `Bookmark` from `lucide-react`.
- Import `GENRES, COUNTRIES, NAV_TABS` from `./constants`.
- Add a local `const [openDropdown, setOpenDropdown] = useState<'genre' | 'country' | null>(null);`.
- Define a local `NavDropdown` component with props:
```tsx
interface NavDropdownProps {
  label: string;
  title: string;
  active: boolean;
  open: boolean;
  widthClass: string;
  items: { name: string; slug: string }[];
  onToggle: () => void;
  onClose: () => void;
  onSelect: (slug: string, name: string) => void;
}
```
- Copy the existing JSX and class strings from `frontend/src/features/navigation/Navbar.tsx` lines **266–377** verbatim into `DesktopNav`'s returned `<nav className="hidden xl:flex ...">`.
- Replace `setOpenDropdown(...)` with the local setter; replace `openDropdown === 'genre'` / `'country'` with `open`; replace `onSelectGenre` / `onSelectCountry` with `onSelect`; call `onSelect(...)` then `onClose()` in the item click handler.
- Preserve the outer dropdown wrapper `onMouseLeave={onClose}` and the `pt-2` bridge exactly.
- Preserve `activeTab === 'genre'` / `'country'` / `'library'` active classes, the Anime label conditional, and the `Bookmark` icon.

- [ ] **Step 3: Wire the components into `Navbar`.**

In `Navbar.tsx`:
```tsx
import { NavbarLogo } from './NavbarLogo';
import { DesktopNav } from './DesktopNav';
```
Replace the logo button block (currently lines 244–264) with:
```tsx
<NavbarLogo
  onHome={() => {
    onSelectTab('home');
    setQ('');
  }}
/>
```
Replace the desktop `<nav>...</nav>` block (currently lines 266–377) with:
```tsx
<DesktopNav
  activeTab={activeTab}
  onSelectTab={onSelectTab}
  onSelectGenre={onSelectGenre}
  onSelectCountry={onSelectCountry}
/>
```
Keep the left wrapper `<div className="flex items-center gap-3 2xl:gap-8 min-w-0">` and the header shell unchanged.

Remove the now-unused `openDropdown` state (`const [openDropdown, setOpenDropdown] = useState<'genre' | 'country' | null>(null);`) and now-unused imports `Film` and `ChevronDown` from `Navbar.tsx`. **Keep** `GENRES`, `COUNTRIES`, and `NAV_TABS` for now: the inline mobile drawer still uses them until Task 8. Keep `Bookmark` for the quick library button.

- [ ] **Step 4: Verify tests and build.**

Run:
```powershell
npm run verify
```
Expected: 61 frontend tests, 27 backend unit tests + 2 e2e tests, all lint/build/guards pass.

- [ ] **Step 5: Browser-check desktop navigation.**

Start:
```powershell
npm run dev
```
At width `1280px`:
- Hover **Thể Loại**; the dropdown opens and stays open while moving the pointer across the `pt-2` gap into the panel.
- Click a genre; the list closes and the catalog updates.
- Repeat for **Quốc Gia**.
- Click **Tủ Phim**; the library view opens and the active underline remains.

At width `375px`: desktop nav is hidden; logo/HUB badge do not overlap the search or utility buttons. Stop the server with `Ctrl+C`.

- [ ] **Step 6: Commit.**

Run:
```powershell
git add frontend/src/features/navigation
git commit -m "refactor: extract navbar logo and desktop navigation"
```

---

## Task 5: Extract recent-search persistence

**Files:**
- Create: `frontend/src/features/navigation/hooks/useRecentSearches.ts`
- Edit: `frontend/src/features/navigation/Navbar.tsx`

- [ ] **Step 1: Create `useRecentSearches.ts`.**

Run:
```powershell
New-Item -ItemType Directory -Force frontend/src/features/navigation/hooks | Out-Null
```
Then write:
```ts
import { useCallback, useState, type MouseEvent } from 'react';

const RECENT_SEARCHES_KEY = 'cinehub_recent_searches';
const MAX_RECENT_SEARCHES = 5;

function readRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

export function useRecentSearches() {
  const [recentSearches, setRecentSearches] = useState<string[]>(readRecentSearches);

  const saveRecentSearch = useCallback((term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;

    const next = [
      trimmed,
      ...recentSearches.filter((item) => item.toLowerCase() !== trimmed.toLowerCase()),
    ].slice(0, MAX_RECENT_SEARCHES);
    setRecentSearches(next);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  }, [recentSearches]);

  const removeRecentSearch = useCallback((term: string, event: MouseEvent) => {
    event.stopPropagation();
    const next = recentSearches.filter((item) => item !== term);
    setRecentSearches(next);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  }, [recentSearches]);

  const clearRecentSearches = useCallback((event?: MouseEvent) => {
    event?.stopPropagation();
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  }, []);

  return {
    recentSearches,
    saveRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
  };
}
```
This preserves the existing key, max 5, case-insensitive de-duplication, and event propagation behavior.

- [ ] **Step 2: Use the hook in `Navbar`.**

In `Navbar.tsx`:
```tsx
import { useRecentSearches } from './hooks/useRecentSearches';
```
Remove:
- `const RECENT_SEARCHES_KEY = 'cinehub_recent_searches';`
- the `recentSearches` `useState` initializer
- the `saveRecentSearch`, `removeRecentSearch`, `clearRecentSearches` functions

Add after the other state declarations:
```tsx
const {
  recentSearches,
  saveRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
} = useRecentSearches();
```
Keep the existing JSX call sites unchanged; the hook's signatures match them (`removeRecentSearch(term, event)` and `clearRecentSearches(event)`).

- [ ] **Step 3: Verify.**

Run:
```powershell
npm run verify
```
Expected: all tests/lint/build/guards pass.

- [ ] **Step 4: Browser-check recent searches.**

Start `npm run dev`, then:
- Search for `Avengers`, submit.
- Search for `Dune`, submit.
- Focus the search input; both terms appear in **Tìm kiếm gần đây** with the newest first.
- Remove one term with its `X`; it disappears and does not submit a search.
- Click **Xóa**; the recent list empties.
- Reload the page; the persisted list still matches localStorage `cinehub_recent_searches`.

Stop with `Ctrl+C`.

- [ ] **Step 5: Commit.**

Run:
```powershell
git add frontend/src/features/navigation
git commit -m "refactor: extract recent search storage hook"
```

---

## Task 6: Extract the navbar search state machine

**Files:**
- Create: `frontend/src/features/navigation/hooks/useClickOutside.ts`
- Create: `frontend/src/features/navigation/hooks/useNavbarSearch.ts`
- Edit: `frontend/src/features/navigation/Navbar.tsx`

- [ ] **Step 1: Create `useClickOutside.ts`.**

Write:
```ts
import { useEffect, type RefObject } from 'react';

export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onOutside: () => void,
  enabled = true,
  closeOnEscape = false,
) {
  useEffect(() => {
    if (!enabled) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onOutside();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === 'Escape') onOutside();
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [ref, onOutside, enabled, closeOnEscape]);
}
```

- [ ] **Step 2: Create `useNavbarSearch.ts`.**

Write:
```ts
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { formatMovieTitle, searchMovies } from '@/shared/api';
import type { MovieItem } from '@/shared/types';
import { useClickOutside } from './useClickOutside';

interface UseNavbarSearchOptions {
  onSearch: (q: string) => void;
  onSelectMovie?: (slug: string) => void;
  onCloseMobileMenu: () => void;
  saveRecentSearch: (term: string) => void;
}

export function useNavbarSearch({
  onSearch,
  onSelectMovie,
  onCloseMobileMenu,
  saveRecentSearch,
}: UseNavbarSearchOptions) {
  const [q, setQ] = useState('');
  const [suggestions, setSuggestions] = useState<MovieItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        setShowSuggestions(true);
      } else if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        searchInputRef.current?.focus();
        setShowSuggestions(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setIsSearching(true);
      searchMovies(q.trim(), 1, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) {
            setSuggestions(result.items.slice(0, 6));
            setIsSearching(false);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) setIsSearching(false);
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  const closeSuggestions = useCallback(() => setShowSuggestions(false), []);
  useClickOutside(searchBoxRef, closeSuggestions);

  const visibleSuggestions = q.trim().length >= 2 ? suggestions : [];

  const handleQueryChange = (value: string) => {
    setQ(value);
    setShowSuggestions(true);
    setHighlightIdx(-1);
  };

  const handleFocus = () => setShowSuggestions(true);
  const clearQuery = () => setQ('');
  const clearSearch = () => {
    setQ('');
    setSuggestions([]);
    setShowSuggestions(false);
    setHighlightIdx(-1);
  };

  const handleSelectSuggestion = (movie: MovieItem) => {
    saveRecentSearch(formatMovieTitle(movie.name));
    setShowSuggestions(false);
    setQ('');
    setHighlightIdx(-1);
    onSelectMovie?.(movie.slug);
  };

  const handleSearchAll = () => {
    const term = q.trim();
    if (!term) return;
    saveRecentSearch(term);
    setShowSuggestions(false);
    onSearch(term);
  };

  const handleSelectTag = (tag: string) => {
    setQ(tag);
    saveRecentSearch(tag);
    setShowSuggestions(false);
    onSearch(tag);
    onCloseMobileMenu();
  };

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        setShowSuggestions(true);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const count = visibleSuggestions.length;
      if (count > 0) setHighlightIdx((prev) => (prev + 1) % count);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const count = visibleSuggestions.length;
      if (count > 0) setHighlightIdx((prev) => (prev - 1 + count) % count);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setShowSuggestions(false);
      setHighlightIdx(-1);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (highlightIdx >= 0 && highlightIdx < visibleSuggestions.length) {
      const selected = visibleSuggestions[highlightIdx];
      saveRecentSearch(selected.name);
      setShowSuggestions(false);
      setQ('');
      setHighlightIdx(-1);
      onSelectMovie?.(selected.slug);
      return;
    }

    if (q.trim()) {
      saveRecentSearch(q.trim());
      setShowSuggestions(false);
      setHighlightIdx(-1);
      onSearch(q.trim());
      onCloseMobileMenu();
    }
  };

  return {
    q,
    setQ,
    suggestions,
    visibleSuggestions,
    isSearching,
    showSuggestions,
    highlightIdx,
    setHighlightIdx,
    searchBoxRef,
    searchInputRef,
    handleQueryChange,
    handleFocus,
    clearQuery,
    clearSearch,
    handleSelectSuggestion,
    handleSearchAll,
    handleSelectTag,
    handleSearchKeyDown,
    handleSubmit,
  };
}
```

- [ ] **Step 3: Replace inline search state/handlers in `Navbar`.**

Import:
```tsx
import { useNavbarSearch } from './hooks/useNavbarSearch';
```
Remove the old `q`, `suggestions`, `isSearching`, `showSuggestions`, `highlightIdx`, `searchBoxRef`, `searchInputRef` state, the local `visibleSuggestions` constant, and the **search** keyboard/debounce/click-outside effects (keep the theme-picker effect), plus `handleSelectTag`, `handleSearchKeyDown`, `onSubmit`, and the suggestion/tag/submit helper functions.

After the recent-search hook call, add:
```tsx
const {
  q,
  suggestions,
  visibleSuggestions,
  isSearching,
  showSuggestions,
  highlightIdx,
  setHighlightIdx,
  searchBoxRef,
  searchInputRef,
  handleQueryChange,
  handleFocus,
  clearQuery,
  clearSearch,
  handleSelectSuggestion,
  handleSearchAll,
  handleSelectTag,
  handleSearchKeyDown,
  handleSubmit,
} = useNavbarSearch({
  onSearch,
  onSelectMovie,
  onCloseMobileMenu: () => setMenuOpen(false),
  saveRecentSearch,
});
```
Update the logo callback from `setQ('')` to `clearQuery()`.

Update the search JSX call sites:
```tsx
<form onSubmit={handleSubmit} role="search">
<input
  ...
  onFocus={handleFocus}
  onChange={(event) => handleQueryChange(event.target.value)}
/>
```
Replace the clear button handler with `onClick={clearSearch}`. Keep `onKeyDown={handleSearchKeyDown}`.

In the suggestion list:
```tsx
onMouseEnter={() => setHighlightIdx(idx)}
onClick={() => handleSelectSuggestion(movie)}
```
Use the actual map variable name from the current file (`m`); do not rename DOM/classes.

Replace the “Xem tất cả” handler with `handleSearchAll`; replace tag buttons with `handleSelectTag(tag)`; keep recent remove/clear handlers from `useRecentSearches`.

Remove now-unused imports (`searchMovies`; `MovieItem` only if unused) and unused state. `getImageUrl`/`formatMovieTitle` stay because the suggestion JSX still uses them.

- [ ] **Step 4: Verify.**

Run:
```powershell
npm run verify
```
Expected: build/typecheck passes with no unused locals; all tests and guards pass.

- [ ] **Step 5: Browser-check search behavior.**

Start `npm run dev` and check:
- `Ctrl+K` and `/` focus the search input (unless already typing in an input/textarea/select).
- Type at least 2 characters; suggestions appear after the 250ms debounce; the request is aborted when the query changes.
- Arrow keys move highlight; Enter opens the selected movie; Escape closes suggestions.
- Clicking a suggestion saves its formatted title to recent searches and opens the detail modal.
- “Xem tất cả” runs the catalog search without closing the mobile menu.
- Clicking outside closes suggestions.
- At 375px, submitting a search closes the mobile drawer.

Stop with `Ctrl+C`.

- [ ] **Step 6: Commit.**

Run:
```powershell
git add frontend/src/features/navigation
git commit -m "refactor: extract navbar search hook"
```

---

## Task 7: Extract `SearchBar` and `SearchSuggestions`

> The `Paste the existing ...` comments below are **move markers**, not placeholders. Copy the named JSX block verbatim from the current `Navbar.tsx`, then apply only the listed handler/prop substitutions. Do not rewrite classes, text, ids, roles, or aria attributes.

**Files:**
- Create: `frontend/src/features/navigation/SearchSuggestions.tsx`
- Create: `frontend/src/features/navigation/SearchBar.tsx`
- Edit: `frontend/src/features/navigation/Navbar.tsx`

- [ ] **Step 1: Create `SearchSuggestions.tsx`.**

Move the suggestions popup JSX from `Navbar.tsx` lines **431–574** into this component. Use:
```tsx
import { History, Loader2, TrendingUp, X } from 'lucide-react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { formatMovieTitle, getImageUrl } from '@/shared/api';
import type { MovieItem } from '@/shared/types';

const TRENDING_TAGS = [
  'Phim Chiếu Rạp',
  'Anime Mới',
  'Hàn Quốc',
  'Kinh Dị',
  'Hành Động',
  'Gia Đình',
];

interface SearchSuggestionsProps {
  q: string;
  visibleSuggestions: MovieItem[];
  isSearching: boolean;
  highlightIdx: number;
  recentSearches: string[];
  onHighlight: (index: number) => void;
  onSelectSuggestion: (movie: MovieItem) => void;
  onSearchAll: () => void;
  onSelectTag: (tag: string) => void;
  onRemoveRecent: (term: string, event: ReactMouseEvent) => void;
  onClearRecent: (event: ReactMouseEvent) => void;
}

export function SearchSuggestions({
  q,
  visibleSuggestions,
  isSearching,
  highlightIdx,
  recentSearches,
  onHighlight,
  onSelectSuggestion,
  onSearchAll,
  onSelectTag,
  onRemoveRecent,
  onClearRecent,
}: SearchSuggestionsProps) {
  return (
    // Paste the existing `{showSuggestions && (...)}` popup content here,
    // without the outer `showSuggestions &&` guard.
    <div
      id="navbar-search-suggestions"
      role="listbox"
      className="absolute top-full right-0 mt-2 w-full sm:w-96 glass-dropdown rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
    >
      {/* Paste the existing conditional content from lines 437–572 verbatim. */}
    </div>
  );
}
```
When pasting:
- Replace the suggestion `onMouseEnter` with `onHighlight(idx)`.
- Replace the suggestion `onClick` body with `onSelectSuggestion(m)`.
- Replace the “Xem tất cả” `onClick` body with `onSearchAll()`.
- Replace recent/tag `handleSelectTag(s)` with `onSelectTag(s)`.
- Replace `clearRecentSearches` with `onClearRecent`.
- Replace `removeRecentSearch(s, e)` with `onRemoveRecent(s, e)`.
- Keep all ids, roles, aria attributes, classes, and text exactly.

- [ ] **Step 2: Create `SearchBar.tsx`.**

Move the search wrapper/form/input JSX from `Navbar.tsx` lines **382–428** into this component, and render `<SearchSuggestions />` after the form. Use:
```tsx
import { Search, X } from 'lucide-react';
import type {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  RefObject,
} from 'react';
import type { MovieItem } from '@/shared/types';
import { SearchSuggestions } from './SearchSuggestions';

interface SearchBarProps {
  q: string;
  visibleSuggestions: MovieItem[];
  isSearching: boolean;
  showSuggestions: boolean;
  highlightIdx: number;
  recentSearches: string[];
  searchBoxRef: RefObject<HTMLDivElement | null>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  onQueryChange: (value: string) => void;
  onHighlight: (index: number) => void;
  onFocus: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent) => void;
  onClearSearch: () => void;
  onSelectSuggestion: (movie: MovieItem) => void;
  onSearchAll: () => void;
  onSelectTag: (tag: string) => void;
  onRemoveRecent: (term: string, event: ReactMouseEvent) => void;
  onClearRecent: (event: ReactMouseEvent) => void;
}

export function SearchBar({ ... }: SearchBarProps) {
  return (
    <div
      ref={searchBoxRef}
      className="relative order-3 w-full sm:order-none sm:w-48 md:w-64 lg:w-72 xl:w-64 2xl:w-72"
    >
      <form onSubmit={onSubmit} role="search">
        {/* Paste the existing label/input/clear-button/kbd block from lines 384–427. */}
      </form>
      {showSuggestions && (
        <SearchSuggestions
          q={q}
          visibleSuggestions={visibleSuggestions}
          isSearching={isSearching}
          highlightIdx={highlightIdx}
          recentSearches={recentSearches}
          onHighlight={onHighlight}
          onSelectSuggestion={onSelectSuggestion}
          onSearchAll={onSearchAll}
          onSelectTag={onSelectTag}
          onRemoveRecent={onRemoveRecent}
          onClearRecent={onClearRecent}
        />
      )}
    </div>
  );
}
```
For the input:
```tsx
onFocus={onFocus}
onKeyDown={onKeyDown}
onChange={(event) => onQueryChange(event.target.value)}
```
For the clear button:
```tsx
onClick={onClearSearch}
```
Keep the existing `id`, roles, aria attributes, placeholder, classes, and `Ctrl K` kbd unchanged.

- [ ] **Step 3: Replace the search JSX in `Navbar`.**

Import:
```tsx
import { SearchBar } from './SearchBar';
```
Replace the entire search block (lines 382–575) inside the right section with:
```tsx
<SearchBar
  q={q}
  visibleSuggestions={visibleSuggestions}
  isSearching={isSearching}
  showSuggestions={showSuggestions}
  highlightIdx={highlightIdx}
  recentSearches={recentSearches}
  searchBoxRef={searchBoxRef}
  searchInputRef={searchInputRef}
  onQueryChange={handleQueryChange}
  onHighlight={setHighlightIdx}
  onFocus={handleFocus}
  onKeyDown={handleSearchKeyDown}
  onSubmit={handleSubmit}
  onClearSearch={clearSearch}
  onSelectSuggestion={handleSelectSuggestion}
  onSearchAll={handleSearchAll}
  onSelectTag={handleSelectTag}
  onRemoveRecent={removeRecentSearch}
  onClearRecent={clearRecentSearches}
/>
```
Keep the right wrapper’s `contents sm:flex ...` classes unchanged so the search remains the third row on mobile.

Remove from `Navbar.tsx`: `TRENDING_TAGS`, the `Search`/`Loader2`/`TrendingUp`/`History` imports, `getImageUrl`/`formatMovieTitle` imports, and any now-unused `MovieItem` import. Keep `X`/`Menu` for the mobile toggle.

- [ ] **Step 4: Verify.**

Run:
```powershell
npm run verify
```
Expected: all tests/lint/build/guards pass; no unused imports.

- [ ] **Step 5: Browser-check the extracted search UI.**

Start `npm run dev` and verify at `1280px` and `375px`:
- The search box sits in the same position/width as before.
- Suggestions open below the box, stay inside the viewport, and remain scrollable (`max-h-80`).
- Keyboard selection, mouse hover highlight, recent-search remove/clear, trending tag click, and “Xem tất cả” all work.
- Mobile search still occupies its own row and submits/closes the drawer correctly.

Stop with `Ctrl+C`.

- [ ] **Step 6: Commit.**

Run:
```powershell
git add frontend/src/features/navigation
git commit -m "refactor: extract navbar search components"
```

---

## Task 8: Extract theme state, `ThemePicker`, and `MobileDrawer`

> The “Paste ...” comments are move markers. Copy the named JSX block verbatim and apply only the listed prop/handler substitutions.

**Files:**
- Create: `frontend/src/features/navigation/hooks/useThemeAccent.ts`
- Create: `frontend/src/features/navigation/ThemePicker.tsx`
- Create: `frontend/src/features/navigation/MobileDrawer.tsx`
- Edit: `frontend/src/features/navigation/Navbar.tsx`

- [ ] **Step 1: Create `useThemeAccent.ts`.**

Write:
```ts
import { useCallback, useRef, useState } from 'react';
import { applyTheme, getStoredTheme, type ThemeAccent } from '@/shared/theme';
import { useClickOutside } from './useClickOutside';

export function useThemeAccent(onThemeChange?: (theme: ThemeAccent) => void) {
  const [currentTheme, setCurrentTheme] = useState<ThemeAccent>(() => getStoredTheme());
  const [showThemePicker, setShowThemePicker] = useState(false);
  const themePickerRef = useRef<HTMLDivElement>(null);

  const closeThemePicker = useCallback(() => setShowThemePicker(false), []);
  useClickOutside(themePickerRef, closeThemePicker, showThemePicker, true);

  const selectTheme = useCallback((themeId: ThemeAccent) => {
    setCurrentTheme(themeId);
    applyTheme(themeId);
    setShowThemePicker(false);
    onThemeChange?.(themeId);
  }, [onThemeChange]);

  const toggleThemePicker = () => setShowThemePicker((open) => !open);

  return {
    currentTheme,
    showThemePicker,
    themePickerRef,
    toggleThemePicker,
    closeThemePicker,
    selectTheme,
  };
}
```
This keeps one theme source in `Navbar`; both the header picker and mobile drawer receive the same `currentTheme` and `selectTheme`.

- [ ] **Step 2: Create `ThemePicker.tsx`.**

Move the header theme picker JSX from `Navbar.tsx` lines **603–666** into:
```tsx
import { Check, Palette } from 'lucide-react';
import type { RefObject } from 'react';
import { THEME_OPTIONS, type ThemeAccent } from '@/shared/theme';

interface ThemePickerProps {
  currentTheme: ThemeAccent;
  showThemePicker: boolean;
  themePickerRef: RefObject<HTMLDivElement | null>;
  onToggle: () => void;
  onSelect: (theme: ThemeAccent) => void;
}

export function ThemePicker({
  currentTheme,
  showThemePicker,
  themePickerRef,
  onToggle,
  onSelect,
}: ThemePickerProps) {
  return (
    <div
      className="relative order-2 ml-auto shrink-0 sm:order-none sm:ml-0"
      ref={themePickerRef}
    >
      {/* Paste the existing button and popover from lines 605–665. */}
    </div>
  );
}
```
Replace `setShowThemePicker(!showThemePicker)` with `onToggle`; replace `handleSelectTheme(theme.id)` with `onSelect(theme.id)`. Keep `aria-expanded`, `aria-controls`, ids, classes, and the mobile-positioning class `top-[calc(100%+4rem)]` exactly.

- [ ] **Step 3: Create `MobileDrawer.tsx`.**

Move the drawer JSX from `Navbar.tsx` lines **693–817** into:
```tsx
import { Bookmark, Check, Download, Palette, Sparkles } from 'lucide-react';
import { GENRES, COUNTRIES, NAV_TABS } from './constants';
import { THEME_OPTIONS, type ThemeAccent } from '@/shared/theme';

interface MobileDrawerProps {
  open: boolean;
  activeTab: string;
  currentTheme: ThemeAccent;
  canInstallPwa?: boolean;
  onSelectTab: (tab: string) => void;
  onSelectGenre: (slug: string, name: string) => void;
  onSelectCountry: (slug: string, name: string) => void;
  onRandomMovie?: () => void;
  onInstallPwa?: () => void;
  onSelectTheme: (theme: ThemeAccent) => void;
  onClose: () => void;
}

export function MobileDrawer({
  open,
  activeTab,
  currentTheme,
  canInstallPwa,
  onSelectTab,
  onSelectGenre,
  onSelectCountry,
  onRandomMovie,
  onInstallPwa,
  onSelectTheme,
  onClose,
}: MobileDrawerProps) {
  if (!open) return null;

  return (
    <div
      id="mobile-nav-drawer"
      className="xl:hidden border-t border-white/[0.08] bg-[#090a0f]/95 backdrop-blur-2xl px-4 py-4 space-y-4 max-h-[80vh] overflow-y-auto shadow-2xl animate-in fade-in slide-in-from-top-4 duration-200"
    >
      {/* Paste the existing drawer content from lines 696–815. */}
    </div>
  );
}
```
Replace every `setMenuOpen(false)` after an action with `onClose()`. Replace `handleSelectTheme(theme.id)` with `onSelectTheme(theme.id)`. Keep the theme selection from closing the drawer (do not call `onClose` in the theme buttons). Keep `max-h-[80vh]`, grid classes, scroll containers, and labels unchanged.

- [ ] **Step 4: Wire the theme hook and components into `Navbar`.**

Import:
```tsx
import { useThemeAccent } from './hooks/useThemeAccent';
import { ThemePicker } from './ThemePicker';
import { MobileDrawer } from './MobileDrawer';
```
Remove `currentTheme`/`showThemePicker`/`themePickerRef` state, the theme click-outside/escape effect, and `handleSelectTheme`. Add:
```tsx
const {
  currentTheme,
  showThemePicker,
  themePickerRef,
  toggleThemePicker,
  selectTheme,
} = useThemeAccent(onThemeChange);
```
Replace the theme picker JSX with:
```tsx
<ThemePicker
  currentTheme={currentTheme}
  showThemePicker={showThemePicker}
  themePickerRef={themePickerRef}
  onToggle={toggleThemePicker}
  onSelect={selectTheme}
/>
```
Replace the drawer JSX with:
```tsx
<MobileDrawer
  open={menuOpen}
  activeTab={activeTab}
  currentTheme={currentTheme}
  canInstallPwa={canInstallPwa}
  onSelectTab={onSelectTab}
  onSelectGenre={onSelectGenre}
  onSelectCountry={onSelectCountry}
  onRandomMovie={onRandomMovie}
  onInstallPwa={onInstallPwa}
  onSelectTheme={selectTheme}
  onClose={() => setMenuOpen(false)}
/>
```
Remove now-unused imports (`Palette`, `Check`, `GENRES`, `COUNTRIES`, `NAV_TABS`, `applyTheme`, `getStoredTheme`, `THEME_OPTIONS` if no longer referenced) while keeping `type ThemeAccent` for the `Props` interface.

- [ ] **Step 5: Verify.**

Run:
```powershell
npm run verify
```
Expected: all tests/lint/build/guards pass.

- [ ] **Step 6: Browser-check theme and drawer behavior.**

Start `npm run dev` and check:
- Desktop: choose a theme from the header picker; colors change immediately and the popover closes.
- Open the picker and press Escape or click outside; it closes.
- At `375px`: open the drawer, choose a theme; the header updates, the drawer stays open, and the selected checkmark moves to the new theme.
- Reload; the chosen theme persists in localStorage and is reflected in both header and drawer.
- Drawer content scrolls inside `max-h-[80vh]`; genre/country selection closes the drawer.
- Header remains two rows below `640px`, one row at `640px+`; theme popover does not overflow the viewport.

Stop with `Ctrl+C`.

- [ ] **Step 7: Commit.**

Run:
```powershell
git add frontend/src/features/navigation
git commit -m "refactor: extract navbar theme and mobile drawer"
```

---

## Task 9: Docs, audit paths, PWA cache, and final verification

**Files:**
- Edit: `README.md`
- Edit: `docs/coordination.md`
- Edit: `scripts/audit-check.mjs`
- Edit: `frontend/public/sw.js`
- Edit: `frontend/src/shared/sw.test.ts`

- [ ] **Step 1: Update README commands.**

Replace the `## Chạy local` command block with:
```bash
npm ci --prefix frontend
npm ci --prefix backend
npm run dev           # http://localhost:5173
npm run dev:api       # NestJS API ở http://localhost:3001
npm run build:web     # tsc -b + vite build -> frontend/dist/
npm run preview
```

Replace the `## Kiểm tra chất lượng` block with:
```bash
npm run verify         # lint + test + build + guard cho cả frontend/backend
npm run test:web       # Vitest frontend
npm run test:api       # Jest unit + e2e backend
npm run lint           # Oxlint frontend + backend
npm run check:bundle   # chặn hls.js bị preload lại vào bundle đầu
npm run check:deploy   # kiểm tra _headers/_redirects trong frontend/dist
npm run check:mojibake # phát hiện lỗi encoding trong source
```
Update the CI sentence to say `verify.yml` installs and verifies both packages.

- [ ] **Step 2: Update the README structure tree.**

Replace the `## Cấu trúc chính` code block with:
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
Keep the feature descriptions concise; do not claim backend endpoints that do not exist.

- [ ] **Step 3: Update README paths and PWA cache versions.**

Apply these exact replacements:
- `src/lib/urlState.ts` → `frontend/src/app/urlState.ts`.
- `App.tsx` in the URL-state paragraph → `frontend/src/app/App.tsx`.
- `cinehub-shell-v4` → `cinehub-shell-v5`.
- `public/sw.js` → `frontend/public/sw.js`.
- `dist/_headers` / `dist/_redirects` → `frontend/dist/_headers` / `frontend/dist/_redirects`.
- The sentence “Khi deploy thay đổi asset, bump version cache trong `public/sw.js`.” → “Khi build thay đổi asset, bump shell cache trong `frontend/public/sw.js`.”
- In `docs/coordination.md`, replace the coordination note's `cinehub-shell-v4` with `cinehub-shell-v5` so internal docs do not advertise a stale cache.

Add this note under `## Dữ liệu và cache`:
```markdown
> Backend hiện chỉ có endpoint `/api/health`. Các module compat/catalog/search/detail
> trong tài liệu cũ chưa được implement; frontend mặc định gọi trực tiếp `https://phimapi.com`.
```

- [ ] **Step 4: Update `scripts/audit-check.mjs` paths.**

Replace the `files` array with:
```js
const files = [
  'frontend/src/app/App.tsx',
  'frontend/src/features/detail/MovieDetailModal.tsx',
  'frontend/src/features/player/VideoPlayer.tsx',
  'frontend/src/features/home/HeroBanner.tsx',
  'frontend/src/features/navigation/Navbar.tsx',
  'frontend/src/features/catalog/MovieGrid.tsx',
  'frontend/src/features/library/LibraryView.tsx',
  'frontend/src/features/catalog/MovieCard.tsx',
];
```
Replace the `backend` map with:
```js
const backend = {
  A2_race: ['frontend/src/app/App.tsx', /AbortController|requestKey|loadedKey/],
  B1_dedup: ['frontend/src/shared/api.ts', /inFlightRequests/],
  B2_tmdbSeason: ['frontend/src/shared/tmdb.ts', /season/],
  B3_importValidate: ['frontend/src/shared/storage.ts', /sanitize|validate/],
  B4_eviction: ['frontend/src/shared/api.ts', /MAX_MEMORY|trimMemory|evict/],
  B4_swExpiry: ['frontend/public/sw.js', /expiry|MAX_AGE|Date\.now/],
  C2_epUrl: ['frontend/src/app/App.tsx', /onEpChange|watchEpIdx/],
  C3_throttle: ['frontend/src/features/player/VideoPlayer.tsx', /lastSavedAt/],
  C8_native: ['frontend/src/features/player/VideoPlayer.tsx', /canPlayType/],
  E1_sanitize: ['frontend/src/features/detail/MovieDetailModal.tsx', /DOMPurify|sanitizedContent/],
  CSP: ['frontend/vite.config.ts', /Content-Security-Policy/],
};
```

- [ ] **Step 5: Bump the PWA shell cache and its test mock.**

In `frontend/public/sw.js`:
```diff
-const SHELL_CACHE = 'cinehub-shell-v4';
+const SHELL_CACHE = 'cinehub-shell-v5';
```
Leave `API_CACHE` and `IMAGE_CACHE` unchanged.

In `frontend/src/shared/sw.test.ts`, update the mocked cache keys:
```diff
-    keys: vi.fn(async () => ['cinehub-shell-v4', 'cinehub-api-v2', 'other-cache']),
+    keys: vi.fn(async () => ['cinehub-shell-v5', 'cinehub-api-v2', 'other-cache']),
```
No other SW assertions change.

- [ ] **Step 6: Run the audit and full verification.**

Run:
```powershell
node scripts/audit-check.mjs
npm --prefix frontend run test -- src/shared/sw.test.ts
npm run verify
```
Expected: audit prints `OK` for every `backend` key (no `MISSING`); SW test passes; full verify passes both packages.

- [ ] **Step 7: Final browser matrix.**

Run `npm run dev` and check these widths: `375`, `639`, `640`, `1024`, `1280`, `1440`, `1920`.

Expected:
- Below `640px`: header is two rows; search is the third row; logo/HUB badge and utility buttons do not overlap.
- At `640px+`: header is one row; mobile drawer remains available below `xl`.
- At `xl`/`1280px+`: desktop nav appears; genre/country hover bridge works; theme picker is right-aligned.
- Search suggestions, recent list, and theme popover stay inside the viewport at every width.
- Theme selection persists and stays in sync between header and drawer.
- Library, catalog genre/country, detail modal, and player still open from the nav.
- No uncaught console errors during these flows.

Then verify production shell caching:
```powershell
npm run build:web
npm run preview
```
Open the preview, check DevTools → Application → Cache Storage contains `cinehub-shell-v5`, then stop with `Ctrl+C`.

- [ ] **Step 8: Review the diff and commit.**

Run:
```powershell
git status --short
git diff --check
git add README.md docs/coordination.md scripts/audit-check.mjs frontend/public/sw.js frontend/src/shared/sw.test.ts
git commit -m "docs: update restructure paths and bump shell cache"
```
Expected: no whitespace errors; commit contains only the docs/audit/SW changes.

- [ ] **Step 9: Push the branch.**

Run:
```powershell
git status --short --branch
git push -u origin refactor/project-structure
```
Expected: branch pushed and tracking `origin/refactor/project-structure`. Do **not** merge to `main` until the user reviews the branch.

---

## Completion Criteria

- [ ] `frontend/`, `backend/`, root `package.json`, `scripts/`, `docs/`, `.github/` are the only top-level project areas.
- [ ] No npm workspaces; `frontend/package.json` and `backend/package.json` remain independent.
- [ ] `frontend/src` contains only `app/`, `features/`, `shared/`.
- [ ] `Navbar.tsx` is a shell that composes `NavbarLogo`, `DesktopNav`, `SearchBar`, `ThemePicker`, utility buttons, and `MobileDrawer`; search/theme logic lives in hooks.
- [ ] Theme state has one source in `Navbar`; header picker and drawer stay in sync.
- [ ] Frontend 61 tests, backend 27 unit + 2 e2e, lint, build, and all guards pass via `npm run verify`.
- [ ] README commands and structure match the new layout; backend limitations are stated honestly.
- [ ] `cinehub-shell-v5` is the shell cache version.
- [ ] Branch `refactor/project-structure` is pushed; merge waits for review.

