# CineHub Catalog Index & Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a file-backed catalog index and `GET /api/v1/discover` so CineHub can sort/filter the whole catalog by fields PhimAPI ignores, without changing existing routes or the frontend.

**Architecture:** A CLI crawls the four PhimAPI catalog types (~30k movies) into an atomic JSON snapshot. At startup the backend loads the snapshot into memory and serves `/api/v1/discover` with full-catalog sorting, filtering, pagination, and facets. If the snapshot is missing or invalid the route returns `503`; existing upstream-backed routes are untouched.

**Tech Stack:** NestJS 11, TypeScript strict, class-validator, Jest/Supertest, Node `fs/promises`, `Intl.Collator`, Oxlint.

**Spec:** `docs/superpowers/specs/2026-10-26-cinehub-catalog-index-design.md`

## Global Constraints

- Do not modify any file under `frontend/`.
- Do not change behavior or contracts of `/api/v1/movies`, `/api/v1/movies/new`, `/api/v1/genres/:slug/movies`, `/api/v1/countries/:slug/movies`, or `/api/v1/search`.
- No database or new runtime dependency. Snapshot is JSON; index is in-memory.
- No network crawling during tests; use fake clients or local fixtures.
- Missing values sort last in both directions; ties keep the original snapshot order.
- `/discover` must return `503` when the index is not ready, never crash the app.
- Refresh is CLI-only; do not add an HTTP write endpoint or background crawler.
- Every task follows RED → GREEN → REFACTOR and leaves the suite green.

## Review Focus

- Missing or corrupt `CATALOG_INDEX_PATH` → app starts, `/discover` returns 503, old routes still work.
- A crawl failure on any page → old snapshot remains byte-identical, CLI exits non-zero.
- Same slug in multiple catalog types → one item, `types` contains all four values, counts not duplicated.
- Missing `updatedAt`/`year`/rating/votes/name → sorted last for both `asc` and `desc`.
- Vietnamese names with diacritics → `sort=name` uses locale collation, not raw code-point order.
- Accent/case-insensitive `q` → `avenger`, `Avenger`, `AVENGER` and Vietnamese diacritic variants match the same movies.
- `rating=0` → no-op; `rating>0` excludes movies with missing `vote_average`.
- Empty result set → `totalItems: 0`, `totalPages: 1`, empty `items`.

---

### Task 1: Config, snapshot types, and DiscoverQueryDto

**Files:**
- Create: `backend/src/catalog-index/catalog-index.types.ts`
- Create: `backend/src/common/dto/discover-query.dto.ts`
- Modify: `backend/src/common/config/configuration.ts`
- Modify: `backend/src/common/config/env.validation.ts`
- Modify: `backend/src/common/dto/dto-validation.spec.ts`
- Modify: `backend/src/common/config/env.validation.spec.ts`

**Interfaces:**
- Consumes: `CATALOG_TYPES`, `CATALOG_TYPES` type, `MOVIE_ORDERS`, `SLUG_PATTERN`, `PageQueryDto`.
- Produces:
  - `DISCOVER_SORTS = ['updated','year','rating','votes','name'] as const`
  - `type DiscoverSort = (typeof DISCOVER_SORTS)[number]`
  - `DISCOVER_LANGUAGES = ['vietsub','thuyet-minh','long-tieng'] as const`
  - `type DiscoverLanguage = (typeof DISCOVER_LANGUAGES)[number]`
  - `class DiscoverQueryDto extends PageQueryDto` with `sort`, `order`, `type?`, `year?`, `category?`, `country?`, `rating?`, `language?`, `chieurap?`, `q?`.
  - `interface CatalogIndexEntry { movie: MovieSummaryDto; types: CatalogType[]; search: string }`
  - `interface CatalogIndexSnapshot { version: 1; generatedAt: string; totalItems: number; entries: CatalogIndexEntry[] }`
  - `interface FacetCount { value: number; count: number }`
  - `interface FacetNamed { slug: string; name: string; count: number }`
  - `interface FacetLanguage { value: DiscoverLanguage; label: string; count: number }`
  - `interface DiscoverFacets { years: FacetCount[]; categories: FacetNamed[]; countries: FacetNamed[]; languages: FacetLanguage[]; totalItems: number; generatedAt: string }`
  - `interface DiscoverResult { items: MovieSummaryDto[]; pagination: PaginationDto; facets: DiscoverFacets }`
  - `interface CatalogIndexStatus { ready: boolean; generatedAt?: string; totalItems: number; error?: string }`
- Config keys: `catalogIndex.path` (string), `catalogIndex.concurrency` (number).

- [ ] **Step 1: Write failing DTO tests**

Add to `backend/src/common/dto/dto-validation.spec.ts`:

```ts
import { DiscoverQueryDto } from './discover-query.dto';

it('accepts supported discover sort, order, filters, and booleans', async () => {
  expect(
    await errors(DiscoverQueryDto, {
      sort: 'rating',
      order: 'asc',
      type: 'phim-le',
      year: '2024',
      category: 'hanh-dong',
      country: 'viet-nam',
      rating: '7.5',
      language: 'thuyet-minh',
      chieurap: 'true',
      q: '  avenger  ',
    })
  ).toEqual([]);
});

it('rejects unsupported discover values', async () => {
  expect(await errors(DiscoverQueryDto, { sort: 'view' })).not.toEqual([]);
  expect(await errors(DiscoverQueryDto, { order: 'sideways' })).not.toEqual([]);
  expect(await errors(DiscoverQueryDto, { rating: '10.1' })).not.toEqual([]);
  expect(await errors(DiscoverQueryDto, { language: 'engsub' })).not.toEqual([]);
  expect(await errors(DiscoverQueryDto, { chieurap: 'maybe' })).not.toEqual([]);
  expect(await errors(DiscoverQueryDto, { year: '2020-2024' })).not.toEqual([]);
  expect(await errors(DiscoverQueryDto, { category: '../secret' })).not.toEqual([]);
  expect(await errors(DiscoverQueryDto, { q: '   ' })).not.toEqual([]);
});
```

Add env tests if the existing spec has a pattern for defaults; otherwise assert via a small unit:

```ts
it('validates catalog index settings', () => {
  const base = { NODE_ENV: 'test' };
  expect(envValidationSchema.validate({ ...base, CATALOG_INDEX_CONCURRENCY: '8' }).error).toBeUndefined();
  expect(envValidationSchema.validate({ ...base, CATALOG_INDEX_CONCURRENCY: '0' }).error).toBeDefined();
  expect(envValidationSchema.validate({ ...base, CATALOG_INDEX_CONCURRENCY: '33' }).error).toBeDefined();
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm run test -- --runInBand src/common/dto/dto-validation.spec.ts src/common/config/env.validation.spec.ts`
Expected: FAIL because `discover-query.dto.ts` does not exist and config keys are missing.

- [ ] **Step 3: Implement types and DTO**

`backend/src/catalog-index/catalog-index.types.ts`:

```ts
import type { CatalogType } from '../common/dto/catalog-query.dto';
import type { DiscoverLanguage } from '../common/dto/discover-query.dto';
import type { MovieSummaryDto, PaginationDto } from '../movies/dto/movie.dto';

export interface CatalogIndexEntry {
  movie: MovieSummaryDto;
  types: CatalogType[];
  search: string;
}

export interface CatalogIndexSnapshot {
  version: 1;
  generatedAt: string;
  totalItems: number;
  entries: CatalogIndexEntry[];
}

export interface FacetCount {
  value: number;
  count: number;
}

export interface FacetNamed {
  slug: string;
  name: string;
  count: number;
}

export interface FacetLanguage {
  value: DiscoverLanguage;
  label: string;
  count: number;
}

export interface DiscoverFacets {
  years: FacetCount[];
  categories: FacetNamed[];
  countries: FacetNamed[];
  languages: FacetLanguage[];
  totalItems: number;
  generatedAt: string;
}

export interface DiscoverResult {
  items: MovieSummaryDto[];
  pagination: PaginationDto;
  facets: DiscoverFacets;
}

export interface CatalogIndexStatus {
  ready: boolean;
  generatedAt?: string;
  totalItems: number;
  error?: string;
}
```

`backend/src/common/dto/discover-query.dto.ts`:

```ts
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { CATALOG_TYPES, type CatalogType } from './catalog-query.dto';
import { PageQueryDto } from './page-query.dto';
import { SLUG_PATTERN } from './slug-param.dto';
import { MOVIE_ORDERS, type MovieOrder } from './sortable-page-query.dto';

export const DISCOVER_SORTS = ['updated', 'year', 'rating', 'votes', 'name'] as const;
export type DiscoverSort = (typeof DISCOVER_SORTS)[number];

export const DISCOVER_LANGUAGES = ['vietsub', 'thuyet-minh', 'long-tieng'] as const;
export type DiscoverLanguage = (typeof DISCOVER_LANGUAGES)[number];

export const CHIEURAP_VALUES = ['true', 'false'] as const;
export type ChieurapValue = (typeof CHIEURAP_VALUES)[number];

export class DiscoverQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(DISCOVER_SORTS)
  sort: DiscoverSort = 'updated';

  @IsOptional()
  @IsIn(MOVIE_ORDERS)
  order: MovieOrder = 'desc';

  @IsOptional()
  @IsIn(CATALOG_TYPES)
  type?: CatalogType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1888)
  @Max(2100)
  year?: number;

  @IsOptional()
  @Matches(SLUG_PATTERN)
  category?: string;

  @IsOptional()
  @Matches(SLUG_PATTERN)
  country?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(10)
  rating?: number;

  @IsOptional()
  @IsIn(DISCOVER_LANGUAGES)
  language?: DiscoverLanguage;

  @IsOptional()
  @IsIn(CHIEURAP_VALUES)
  chieurap?: ChieurapValue;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  q?: string;
}
```

Config:

```ts
catalogIndex: {
  path: process.env.CATALOG_INDEX_PATH ?? 'data/catalog-index.json',
  concurrency: Number(process.env.CATALOG_INDEX_CONCURRENCY ?? 8),
},
```

```ts
CATALOG_INDEX_PATH: Joi.string().default('data/catalog-index.json'),
CATALOG_INDEX_CONCURRENCY: Joi.number().integer().min(1).max(32).default(8),
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm run test -- --runInBand src/common/dto/dto-validation.spec.ts src/common/config/env.validation.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/catalog-index/catalog-index.types.ts backend/src/common/dto/discover-query.dto.ts backend/src/common/dto/dto-validation.spec.ts backend/src/common/config/configuration.ts backend/src/common/config/env.validation.ts backend/src/common/config/env.validation.spec.ts
git commit -m "feat(api): add discover query contract and index config"
```

---

### Task 2: CatalogIndexService load, query, sort, filter, and facets

**Files:**
- Create: `backend/src/catalog-index/catalog-index.service.ts`
- Create: `backend/src/catalog-index/catalog-index.utils.ts`
- Create: `backend/src/catalog-index/catalog-index.service.spec.ts`

**Interfaces:**
- Consumes: `CatalogIndexSnapshot`, `CatalogIndexEntry`, `DiscoverFacets`, `DiscoverResult`, `CatalogIndexStatus`; `DiscoverQueryDto`; `ConfigService`.
- Produces: `normalizeText(value: string): string`, `languageKeys(lang: string | undefined): DiscoverLanguage[]` in `catalog-index.utils.ts` (shared with Task 3).
- Produces:
  - `class CatalogIndexService implements OnModuleInit`
  - `onModuleInit(): Promise<void>`
  - `load(): Promise<void>` (public for tests)
  - `query(query: DiscoverQueryDto): DiscoverResult`
  - `getStatus(): CatalogIndexStatus`
  - Missing snapshot → `query` throws `ServiceUnavailableException('Catalog index is not built. Run npm run index:refresh.')`.

- [ ] **Step 1: Write failing service tests**

Create `backend/src/catalog-index/catalog-index.service.spec.ts` with a temp snapshot fixture. Use `fs.mkdtemp`, `fs.writeFile`, and a fake `ConfigService`:

```ts
import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CatalogIndexService } from './catalog-index.service';
import type { CatalogIndexSnapshot } from './catalog-index.types';

function configWith(path: string): ConfigService {
  return {
    getOrThrow: (key: string) => {
      if (key === 'catalogIndex.path') return path;
      throw new Error(`unexpected key ${key}`);
    },
  } as unknown as ConfigService;
}

const snapshot: CatalogIndexSnapshot = {
  version: 1,
  generatedAt: '2026-10-26T04:00:00.000Z',
  totalItems: 5,
  entries: [
    {
      movie: { name: 'Ăn Trưa', slug: 'an-trua', year: 2024, updatedAt: '2026-10-26T03:00:00.000Z', tmdb: { vote_average: 8.5, vote_count: 100 }, lang: 'Vietsub', chieurap: true, category: [{ slug: 'hanh-dong', name: 'Hành Động' }], country: [{ slug: 'viet-nam', name: 'Việt Nam' }] },
      types: ['phim-le'],
      search: 'an trua lunch',
    },
    {
      movie: { name: 'Ba Giờ', slug: 'ba-gio', year: 2020, updatedAt: '2026-10-26T02:00:00.000Z', tmdb: { vote_average: 7, vote_count: 50 }, lang: 'Thuyết Minh', chieurap: false, category: [{ slug: 'hanh-dong', name: 'Hành Động' }], country: [{ slug: 'viet-nam', name: 'Việt Nam' }] },
      types: ['phim-le', 'phim-bo'],
      search: 'ba gio three hours',
    },
    {
      movie: { name: 'Cũ', slug: 'cu', year: 1999, updatedAt: '2026-10-25T00:00:00.000Z', tmdb: { vote_average: 6, vote_count: 10 }, lang: 'Lồng Tiếng' },
      types: ['phim-bo'],
      search: 'cu old',
    },
    {
      movie: { name: 'Missing', slug: 'missing' },
      types: ['hoat-hinh'],
      search: 'missing',
    },
    {
      movie: { name: 'Dune', slug: 'dune', year: 2021, updatedAt: '2026-10-24T00:00:00.000Z', tmdb: { vote_average: 9, vote_count: 200 }, lang: 'Vietsub', category: [{ slug: 'vien-tuong', name: 'Viễn Tưởng' }], country: [{ slug: 'my', name: 'Mỹ' }] },
      types: ['phim-le'],
      search: 'dune',
    },
  ],
};
```

Tests (one `describe` with a temp path and service per test):

- default sort returns `an-trua`, `ba-gio`, `cu`, `dune`, `missing` (missing updated last).
- `sort=updated&order=asc` returns `dune`, `cu`, `ba-gio`, `an-trua`, `missing`.
- `sort=name&order=asc` returns `an-trua`, `ba-gio`, `cu`, `dune`, `missing` (Vietnamese collation + missing last).
- `sort=rating&order=desc` returns `dune`, `an-trua`, `ba-gio`, `cu`, `missing`.
- `sort=votes&order=asc` returns `cu`, `ba-gio`, `an-trua`, `dune`, `missing`.
- filters:
  - `year=2024` → 1 item.
  - `category=hanh-dong&country=viet-nam&type=phim-le` → 2 items (`an-trua`, `ba-gio`).
  - `rating=7.5` → `an-trua`, `dune` (missing/6/7 excluded).
  - `language=thuyet-minh` → `ba-gio`.
  - `language=long-tieng` → `cu`.
  - `chieurap=true` → `an-trua`; `chieurap=false` → `ba-gio`.
  - `q=AN TRUA` → `an-trua`; `q=thuyet minh` should not match because q only searches title/origin, not lang; assert empty.
- pagination: page 2 with page size 24 returns empty, `totalPages` 1, `totalItems` 5.
- facets: `years` counts 2024, 2020, 1999, 2021; `categories` counts `hanh-dong` 2, `vien-tuong` 1; `countries`; `languages` counts vietsub 2, thuyet-minh 1, long-tieng 1; `totalItems` 5; `generatedAt`.
- `type=phim-bo` facets only count `ba-gio`, `cu` and `totalItems` 2.
- missing snapshot: `load()` resolves, `getStatus().ready` false, `query()` throws `ServiceUnavailableException`.
- corrupt snapshot: write `'{'`; `load()` resolves, ready false, query throws.
- wrong version: write `{...snapshot, version: 2}`; ready false.
- empty result: `q=zzz` → items [], totalItems 0, totalPages 1.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm run test -- --runInBand src/catalog-index/catalog-index.service.spec.ts`
Expected: FAIL because `CatalogIndexService` does not exist.

- [ ] **Step 3: Implement CatalogIndexService**

Implementation outline:

`backend/src/catalog-index/catalog-index.utils.ts`:

```ts
import type { DiscoverLanguage } from '../common/dto/discover-query.dto';

export const CATALOG_INDEX_VERSION = 1;
export const CATALOG_PAGE_SIZE = 24;

export const LANGUAGE_LABELS: Record<DiscoverLanguage, string> = {
  vietsub: 'Vietsub',
  'thuyet-minh': 'Thuyết Minh',
  'long-tieng': 'Lồng Tiếng',
};

export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export function languageKeys(lang: string | undefined): DiscoverLanguage[] {
  if (!lang) return [];
  const normalized = normalizeText(lang);
  const keys: DiscoverLanguage[] = [];
  if (normalized.includes('vietsub')) keys.push('vietsub');
  if (normalized.includes('thuyet minh')) keys.push('thuyet-minh');
  if (normalized.includes('long tieng')) keys.push('long-tieng');
  return keys;
}
```

`backend/src/catalog-index/catalog-index.service.ts` imports the utils above:

```ts
import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { DiscoverQueryDto } from '../common/dto/discover-query.dto';
import type { CatalogType } from '../common/dto/catalog-query.dto';
import type {
  CatalogIndexEntry,
  CatalogIndexSnapshot,
  CatalogIndexStatus,
  DiscoverFacets,
  DiscoverResult,
  FacetNamed,
} from './catalog-index.types';
import {
  CATALOG_INDEX_VERSION,
  CATALOG_PAGE_SIZE,
  LANGUAGE_LABELS,
  languageKeys,
  normalizeText,
} from './catalog-index.utils';
```

`load()`:
- `const path = resolve(this.config.getOrThrow<string>('catalogIndex.path'));`
- read file, JSON.parse, validate `version === 1`, `Array.isArray(entries)`, each entry has `movie.slug`/`movie.name`, `types` array.
- Keep only valid entries; if zero valid, treat as error? If snapshot legitimately empty, maybe ready with 0? Crawl should never be empty. Require `entries.length > 0`; otherwise not ready.
- Build facets for all + each type. Store `this.facets = new Map<'all' | CatalogType, DiscoverFacets>()`.
- Set `this.snapshot`, `this.status`.
- On error: log warning, set null and status `{ready:false,totalItems:0,error: ...}`. Do not throw.

`query()`:
- If no snapshot, throw `ServiceUnavailableException('Catalog index is not built. Run npm run index:refresh.')`.
- filter entries:
  - type, year, category, country, rating>0, language, chieurap string, q.
- sort with stable index.
- paginate.
- facets `this.facets.get(query.type ?? 'all')!`.
- return `{items: page.map(e=>e.movie), pagination, facets}`.

Sort comparator:
```ts
type Sortable = number | string | undefined;
function valueFor(entry: CatalogIndexEntry, sort: DiscoverSort): Sortable { ... }
const collator = new Intl.Collator('vi', { sensitivity: 'base' });
function compare(left, right, sort, order, leftIndex, rightIndex): number {
  const a = valueFor(left, sort);
  const b = valueFor(right, sort);
  if (a === undefined || b === undefined) {
    if (a === undefined && b === undefined) return leftIndex - rightIndex;
    return a === undefined ? 1 : -1;
  }
  const direction = order === 'asc' ? 1 : -1;
  if (typeof a === 'string' && typeof b === 'string') {
    const compared = collator.compare(a, b);
    if (compared !== 0) return compared * direction;
  } else if (a !== b) {
    return (a as number) < (b as number) ? -1 * direction : 1 * direction;
  }
  return leftIndex - rightIndex;
}
```
For `updated`, use `Date.parse` finite. For `name`, trim; empty -> undefined. For `rating`, `movie.tmdb?.vote_average`; votes similar.

Facets:
```ts
function buildFacets(entries: CatalogIndexEntry[], generatedAt: string): DiscoverFacets {
  // count years, categories, countries, languages
  // sort years desc; named by count desc then name locale; languages fixed order
}
```
Deduplicate movie counts: one entry per slug, so counts are per movie. Categories: if a movie has duplicate category slug, count once per entry using a Set.

`getStatus()` returns copy.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm run test -- --runInBand src/catalog-index/catalog-index.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/catalog-index/catalog-index.service.ts backend/src/catalog-index/catalog-index.service.spec.ts
git commit -m "feat(api): load and query the catalog index"
```

---

### Task 3: CatalogIndexerService crawl, dedupe, and atomic snapshot

**Files:**
- Create: `backend/src/catalog-index/catalog-indexer.service.ts`
- Create: `backend/src/catalog-index/catalog-indexer.service.spec.ts`

**Interfaces:**
- Consumes: `PhimApiClient.getJson<T>(path, query)`; `ConfigService` keys `catalogIndex.path`, `catalogIndex.concurrency`; `mapMovieSummary`; `CATALOG_TYPES`.
- Produces:
  - `interface CatalogIndexRefreshResult { path: string; totalItems: number; generatedAt: string; pagesFetched: number }`
  - `class CatalogIndexerService { refresh(): Promise<CatalogIndexRefreshResult> }`

- [ ] **Step 1: Write failing indexer tests**

Use a fake client and fake config, plus a temp directory:

```ts
const movieA = {
  _id: 'a',
  name: 'Ăn Trưa',
  origin_name: 'Lunch',
  slug: 'phim-a',
  year: 2024,
  modified: { time: '2026-10-26T03:00:00.000Z' },
  tmdb: { vote_average: 8.5, vote_count: 100 },
  category: [{ name: 'Hành Động', slug: 'hanh-dong' }],
  country: [{ name: 'Việt Nam', slug: 'viet-nam' }],
};
const movieB = {
  _id: 'b',
  name: 'Ba Giờ',
  origin_name: 'Three Hours',
  slug: 'phim-b',
  year: 2020,
  modified: { time: '2026-10-26T02:00:00.000Z' },
  tmdb: { vote_average: 7, vote_count: 50 },
};
const movieC = {
  _id: 'c',
  name: 'Cũ',
  slug: 'phim-c',
  year: 1999,
  modified: { time: '2026-10-25T00:00:00.000Z' },
  tmdb: { vote_average: 6, vote_count: 10 },
};

const client = {
  getJson: jest.fn(async (path: string, query: { page?: number }) => {
    if (path === '/v1/api/danh-sach/phim-le') {
      if (query.page === 1) {
        return { status: true, data: { items: [movieA], params: { pagination: { currentPage: 1, totalPages: 2, totalItems: 3, totalItemsPerPage: 24 } } } };
      }
      return { status: true, data: { items: [movieB], params: { pagination: { currentPage: 2, totalPages: 2, totalItems: 3, totalItemsPerPage: 24 } } } };
    }
    if (path === '/v1/api/danh-sach/phim-bo') {
      return { status: true, data: { items: [movieB, movieC], params: { pagination: { currentPage: 1, totalPages: 1, totalItems: 2, totalItemsPerPage: 24 } } } };
    }
    return { status: true, data: { items: [], params: { pagination: { currentPage: 1, totalPages: 1, totalItems: 0, totalItemsPerPage: 24 } } } };
  }),
} as unknown as PhimApiClient;
```

Assertions:
- Result `totalItems` 3, `pagesFetched` 5 (2 + 1 + 1 + 1), path exists.
- Snapshot entries deduped by slug: `phim-a` types `['phim-le']`, `phim-b` types `['phim-le','phim-bo']`, `phim-c` types `['phim-bo']`.
- Each entry `search` contains normalized name/origin.
- Snapshot is sorted by `updatedAt` desc then slug.
- Fake client called with page numbers 1..2 for `phim-le`.
- Failure: make `phim-le` page 2 throw; pre-write `{"version":1,...old}` to path; `refresh()` rejects; file content unchanged.
- Invalid upstream page (missing items) rejects and does not write.
- Empty catalog (all types 0 items) writes a snapshot with `totalItems: 0`? Decide: allow empty snapshot but `CatalogIndexService` rejects empty as not ready. Better indexer throws if totalItems 0 to avoid wiping a good snapshot with an empty crawl. Test that it rejects and preserves old file.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm run test -- --runInBand src/catalog-index/catalog-indexer.service.spec.ts`
Expected: FAIL because `CatalogIndexerService` does not exist.

- [ ] **Step 3: Implement CatalogIndexerService**

Outline:

```ts
const INDEX_VERSION = 1;
const TYPES = CATALOG_TYPES;
const PAGE_SIZE = 24;

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function run() {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}
```

- `firstPage(type)`: call client with `{page:1}`, validate `status !== false`, `items` array, pagination.
- Build jobs `[{type,page}]` from 1..totalPages.
- Fetch all with concurrency.
- Map each item with `mapMovieSummary`; skip empty slug/name.
- Dedupe `Map<slug, CatalogIndexEntry>`; merge `types` set; if duplicate, prefer the entry with more complete data? Use first and merge types; if existing movie fields missing and new has them, merge object shallowly? Simpler: keep first mapped movie; list payloads should be consistent. Tests can assert first.
- Compute `search = normalizeText([name, origin_name].filter(Boolean).join(' '))`.
- Sort entries by `updatedAt` desc (missing last) then slug asc.
- Throw if zero entries.
- Write `{version:1, generatedAt, totalItems, entries}` to `${path}.tmp-${process.pid}` then rename. Ensure directory exists.
- Return stats.
- Use `Logger` for progress (every 100 pages) but avoid noisy tests; log at debug? Nest logger log. Tests will show logs but okay. Could only log at the end. Keep one `logger.log` with counts.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm run test -- --runInBand src/catalog-index/catalog-indexer.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/catalog-index/catalog-indexer.service.ts backend/src/catalog-index/catalog-indexer.service.spec.ts
git commit -m "feat(api): crawl and persist the catalog index"
```

---

### Task 4: Discover response DTO, controller, module, and e2e

**Files:**
- Create: `backend/src/catalog-index/dto/discover.dto.ts`
- Create: `backend/src/catalog-index/catalog-index.controller.ts`
- Create: `backend/src/catalog-index/catalog-index.module.ts`
- Modify: `backend/src/app.module.ts`
- Create: `backend/test/discover.e2e-spec.ts`
- Create: `backend/test/catalog-index-fixture.ts`

**Interfaces:**
- Consumes: `CatalogIndexService.query`, `DiscoverQueryDto`, `DiscoverResult`, `setCacheHeaders`, `ApiCommonErrors`.
- Produces:
  - `class DiscoverResponseDto extends MovieListDto` with `facets`.
  - `GET /api/v1/discover` returning `DiscoverResponseDto`.
  - `CatalogIndexModule` exported for potential future use.

- [ ] **Step 1: Write failing e2e test**

`backend/test/catalog-index-fixture.ts`:

```ts
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CatalogIndexSnapshot } from '../src/catalog-index/catalog-index.types';

export async function writeCatalogIndexFixture(snapshot: CatalogIndexSnapshot): Promise<{ dir: string; path: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'cinehub-index-'));
  const path = join(dir, 'catalog-index.json');
  await writeFile(path, JSON.stringify(snapshot));
  return { dir, path };
}
```

`backend/test/discover.e2e-spec.ts`:
- Build a snapshot with 3-4 movies covering filters.
- `beforeAll`: write fixture, set `process.env.CATALOG_INDEX_PATH`, `NODE_ENV=test`, `SWAGGER_ENABLED=false`, `app = await createTestApp()`.
- `afterAll`: close app, delete env, `rm(dir, {recursive:true,force:true})`.
- Tests:
  - `GET /api/v1/discover` → 200, items ordered updated desc, pagination, facets, `x-cache: HIT`, `cache-control` includes max-age=60.
  - `GET /api/v1/discover?sort=rating&order=desc&rating=7.5&language=vietsub&category=hanh-dong&country=viet-nam&year=2024&q=...` → expected slugs.
  - `GET /api/v1/discover?sort=name&order=asc` → expected Vietnamese order.
  - `GET /api/v1/discover?page=2` (with >24 fixture items? easier: set page=2 and expect empty, totalPages 1; but page size is 24, fixture small). Assert empty.
  - invalid params → 400: `sort=view`, `order=sideways`, `rating=11`, `language=engsub`, `chieurap=maybe`, `year=1800`, `category=../x`.
  - 503 missing index: create a second app with `CATALOG_INDEX_PATH` pointing to a nonexistent path. Since the first app already loaded, create a new app after setting env; `GET /api/v1/discover` → 503 with message. Close it and restore env. (Do this in a separate `describe` or test with `createTestApp`.)
  - old route still works when index missing: `GET /api/v1/movies/new?page=1` with upstream stub? The discover e2e may not start an upstream stub. Skip or use a stub. Better not test old route here; existing suites cover.

- [ ] **Step 2: Run e2e to verify RED**

Run: `npm run test:e2e -- --runInBand discover.e2e-spec.ts`
Expected: FAIL 404 because the controller/module does not exist.

- [ ] **Step 3: Implement DTO, controller, module**

`discover.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { MovieListDto } from '../../movies/dto/movie.dto';

export class FacetCountDto { @ApiProperty({ type: Number }) value!: number; @ApiProperty({ type: Number }) count!: number; }
export class FacetNamedDto { @ApiProperty() slug!: string; @ApiProperty() name!: string; @ApiProperty({ type: Number }) count!: number; }
export class FacetLanguageDto { @ApiProperty() value!: string; @ApiProperty() label!: string; @ApiProperty({ type: Number }) count!: number; }
export class DiscoverFacetsDto {
  @ApiProperty({ type: () => FacetCountDto, isArray: true }) years!: FacetCountDto[];
  @ApiProperty({ type: () => FacetNamedDto, isArray: true }) categories!: FacetNamedDto[];
  @ApiProperty({ type: () => FacetNamedDto, isArray: true }) countries!: FacetNamedDto[];
  @ApiProperty({ type: () => FacetLanguageDto, isArray: true }) languages!: FacetLanguageDto[];
  @ApiProperty({ type: Number }) totalItems!: number;
  @ApiProperty({ type: String, format: 'date-time' }) generatedAt!: string;
}
export class DiscoverResponseDto extends MovieListDto {
  @ApiProperty({ type: () => DiscoverFacetsDto }) facets!: DiscoverFacetsDto;
}
```

Controller: manual `@ApiQuery` for each param, `@ApiOkResponse({ type: DiscoverResponseDto })`, `@ApiCommonErrors()`, `@Get()` on `@Controller('v1/discover')`, call `this.index.query(query)`, `setCacheHeaders(response, 'HIT', 60)`, return result.

Module:

```ts
@Module({
  imports: [UpstreamModule],
  controllers: [CatalogIndexController],
  providers: [CatalogIndexService, CatalogIndexerService],
  exports: [CatalogIndexService, CatalogIndexerService],
})
export class CatalogIndexModule {}
```

Add `CatalogIndexModule` to `AppModule.imports`.

- [ ] **Step 4: Run e2e to verify GREEN**

Run: `npm run test:e2e -- --runInBand discover.e2e-spec.ts`
Expected: PASS.

- [ ] **Step 5: Run full backend tests**

Run: `npm run test -- --runInBand && npm run test:e2e -- --runInBand`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/catalog-index/dto/discover.dto.ts backend/src/catalog-index/catalog-index.controller.ts backend/src/catalog-index/catalog-index.module.ts backend/src/app.module.ts backend/test/discover.e2e-spec.ts backend/test/catalog-index-fixture.ts
git commit -m "feat(api): expose catalog discovery endpoint"
```

---

### Task 5: Refresh CLI, env/docs, and gitignore

**Files:**
- Create: `backend/src/catalog-index/refresh-catalog-index.ts`
- Modify: `backend/package.json`
- Modify: `backend/.env.example`
- Modify: `.gitignore`
- Modify: `backend/README.md`
- Modify: `docs/backend-api.md`
- Modify: `docs/superpowers/specs/2026-10-21-cinehub-backend-design.md` (short link/mention to the new spec)

**Interfaces:**
- Consumes: `NestFactory.createApplicationContext(AppModule)`, `CatalogIndexerService.refresh()`.
- Produces: npm script `index:refresh`; documented endpoint/config/limitations.

- [ ] **Step 1: Implement CLI**

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CatalogIndexerService } from './catalog-indexer.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const result = await app.get(CatalogIndexerService).refresh();
    console.log(
      `Catalog index refreshed: ${result.totalItems} movies, ${result.pagesFetched} pages, ${result.path}`
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error('Catalog index refresh failed:', error);
  process.exitCode = 1;
});
```

Add script:

```json
"index:refresh": "npm run build && node dist/catalog-index/refresh-catalog-index.js"
```

- [ ] **Step 2: Update env and gitignore**

`.env.example`:

```dotenv
CATALOG_INDEX_PATH=data/catalog-index.json
CATALOG_INDEX_CONCURRENCY=8
```

`.gitignore` (root):

```gitignore
# Backend catalog index snapshots
backend/data/catalog-index.json
backend/data/catalog-index.json.tmp-*
```

- [ ] **Step 3: Update docs**

`backend/README.md`: add `npm run index:refresh`, config lines, note restart after refresh, and that `/api/v1/discover` returns 503 until built.

`docs/backend-api.md`: add a "Discovery index" section with:
- why the index exists (upstream ignores rating/language/chieurap/name),
- `GET /api/v1/discover` param table and response example,
- facets semantics (only `type`-dependent, not other filters),
- `rating=0` no-op, missing values last, `q` accent-insensitive,
- build/refresh commands and 503 behavior,
- limitation: cast/crew search still needs detail crawl; existing routes unchanged.

Old backend spec: add a short subsection under normalized endpoints pointing to the new spec and summarizing `/discover`.

- [ ] **Step 4: Verify build picks up the CLI**

Run: `npm run build`
Expected: PASS; `dist/catalog-index/refresh-catalog-index.js` exists.

Run: `Test-Path dist/catalog-index/refresh-catalog-index.js`
Expected: `True`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/catalog-index/refresh-catalog-index.ts backend/package.json backend/.env.example .gitignore backend/README.md docs/backend-api.md docs/superpowers/specs/2026-10-21-cinehub-backend-design.md docs/superpowers/specs/2026-10-26-cinehub-catalog-index-design.md docs/superpowers/plans/2026-10-26-cinehub-catalog-index.md
git commit -m "docs(api): document catalog index and discovery"
```

---

### Task 6: Full verification and final review

**Files:**
- No new files; verify the whole branch.

- [ ] **Step 1: Run backend unit, e2e, lint, build**

```bash
npm run test -- --runInBand
npm run test:e2e -- --runInBand
npm run lint
npm run build
```

Expected: all pass; test counts increase from 38 unit + 40 e2e.

- [ ] **Step 2: Run repo-wide verify**

```bash
npm run verify
```

Expected: frontend 67 tests (or current frontend count), backend tests, lint, build, bundle/deploy/mojibake guards all pass.

- [ ] **Step 3: Review diff and status**

```bash
git status --short
git diff --check
git diff --stat
git diff
```

Expected: only backend/docs/.gitignore changes; no frontend files.

- [ ] **Step 4: Final commit if any verification fixes were needed**

```bash
git add <changed files>
git commit -m "fix(api): ..."
```

- [ ] **Step 5: Report**

Report the branch, commit hashes, test counts, how to build/refresh the index, and the remaining limitation (cast/crew search requires detail crawl; existing routes unchanged). Do not push unless requested.
