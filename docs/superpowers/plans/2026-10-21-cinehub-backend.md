# CineHub Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a NestJS proxy/cache/normalized API for CineHub without changing frontend source.

**Architecture:** A standalone `backend/` NestJS package exposes `/api/compat/*` (raw PhimAPI-compatible responses) and `/api/v1/*` (normalized DTOs). Both share an allowlisted upstream client, an in-memory TTL/LRU cache with single-flight, validation, retry/timeout, CORS, rate limiting, Swagger, and tests with a local upstream stub.

**Tech Stack:** Node.js 22+, NestJS 11, TypeScript strict, Jest, Supertest, Oxlint, `lru-cache`, `@nestjs/config`, `@nestjs/swagger`, `@nestjs/throttler`, Helmet, compression, Joi, class-validator.

**Spec:** `docs/superpowers/specs/2026-10-21-cinehub-backend-design.md`

## Global Constraints

- **Do not modify frontend files** in `src/`, `public/`, `index.html`, `vite.config.ts`, or root `package.json` while anty is working. Only add `backend/`, backend docs, root README/docs, and CI.
- **No commits** unless the user explicitly requests them. End each task by reviewing the diff, not committing.
- No auth, database, Redis, favorites/history sync, comments, ratings, admin, HLS/iframe proxying, or TMDB injection in phase 1.
- All backend routes use global prefix `/api`.
- Compat base for frontend: `http://localhost:3001/api/compat`.
- Normalized base: `http://localhost:3001/api/v1`.
- Frontend request timeout is 10 seconds; backend upstream total budget is 9 seconds (`UPSTREAM_TOTAL_TIMEOUT_MS=9000`), per-attempt 5 seconds, one retry.
- Cache only HTTP 200 payloads whose `status` is not `false`; never cache errors, malformed JSON, timeouts, or `status:false`.
- In-memory cache only; expose `CacheStore` so Redis can replace it later.
- Tests must use the local HTTP stub; no real PhimAPI network calls.
- Do not expose upstream URLs, stack traces, or secrets in API errors.
- Backend package is independent; use `backend/package-lock.json` and `cd backend` for all backend commands.
- Keep the frontend contract frozen: no response envelope on compat; normalized responses follow the spec exactly.

## Review Focus

- Upstream `status:false` or malformed JSON must produce 404/502 and must not poison the cache.
- Two concurrent cold requests for the same key must call upstream once and both receive data within the 9-second budget.
- Invalid page/type/slug/keyword must fail with 400 before any upstream call, and slugs must not permit path traversal.
- CORS preflight/allowed origin, unknown origin, and per-IP rate limiting must behave correctly.
- All six compat endpoints must preserve the current frontend's raw JSON shape and paths.

---

### Task 1: Scaffold NestJS, config, health, and test harness

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/tsconfig.build.json`
- Create: `backend/nest-cli.json`
- Create: `backend/jest.config.js`
- Create: `backend/test/jest-e2e.json`
- Create: `backend/.env.example`
- Create: `backend/src/main.ts`
- Create: `backend/src/app.setup.ts`
- Create: `backend/src/app.module.ts`
- Create: `backend/src/common/config/configuration.ts`
- Create: `backend/src/common/config/env.validation.ts`
- Create: `backend/src/health/health.controller.ts`
- Create: `backend/src/health/health.module.ts`
- Create: `backend/test/create-test-app.ts`
- Create: `backend/test/health.e2e-spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `configureApp(app: INestApplication): void`, `createTestApp(): Promise<INestApplication>`, `ConfigService` keys from `configuration()`.

- [ ] **Step 1: Create the backend manifest and TypeScript/Nest config**

`backend/package.json`:

```json
{
  "name": "cinehub-backend",
  "version": "0.1.0",
  "private": true,
  "license": "UNLICENSED",
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main.js",
    "lint": "oxlint src test",
    "test": "jest --config jest.config.js",
    "test:watch": "jest --config jest.config.js --watch",
    "test:e2e": "jest --config test/jest-e2e.json --runInBand",
    "test:cov": "jest --config jest.config.js --coverage"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/config": "^4.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "@nestjs/swagger": "^11.0.0",
    "@nestjs/throttler": "^6.0.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "compression": "^1.8.0",
    "helmet": "^8.0.0",
    "joi": "^17.13.3",
    "lru-cache": "^11.0.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/testing": "^11.0.0",
    "@types/compression": "^1.8.0",
    "@types/express": "^5.0.0",
    "@types/jest": "^29.5.14",
    "@types/node": "^22.10.0",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "oxlint": "^1.0.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-node": "^10.9.2",
    "typescript": "^5.7.2"
  }
}
```

Run:

```bash
cd backend
npm install
```

`backend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2023",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strict": true,
    "strictPropertyInitialization": false,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

`backend/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*.spec.ts", "**/*.e2e-spec.ts"]
}
```

`backend/nest-cli.json`:

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

`backend/jest.config.js`:

```js
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  testPathIgnorePatterns: ['/node_modules/', '\\.e2e-spec\\.ts$'],
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  setupFiles: ['reflect-metadata'],
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts'],
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
};
```

`backend/test/jest-e2e.json`:

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "..",
  "testEnvironment": "node",
  "testRegex": ".*\\.e2e-spec\\.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "setupFiles": ["reflect-metadata"]
}
```

- [ ] **Step 2: Add config and health**

`backend/.env.example`:

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

`backend/src/common/config/configuration.ts`:

```ts
export default () => ({
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? '0.0.0.0',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  upstream: {
    baseUrl: process.env.PHIMAPI_BASE_URL ?? 'https://phimapi.com',
    timeoutMs: Number(process.env.UPSTREAM_TIMEOUT_MS ?? 5000),
    retries: Number(process.env.UPSTREAM_RETRIES ?? 1),
    totalTimeoutMs: Number(process.env.UPSTREAM_TOTAL_TIMEOUT_MS ?? 9000),
    maxBytes: Number(process.env.UPSTREAM_MAX_BYTES ?? 2_000_000),
  },
  cache: {
    maxEntries: Number(process.env.CACHE_MAX_ENTRIES ?? 500),
    ttlListMs: Number(process.env.CACHE_TTL_LIST_MS ?? 240_000),
    ttlNewMs: Number(process.env.CACHE_TTL_NEW_MS ?? 120_000),
    ttlSearchMs: Number(process.env.CACHE_TTL_SEARCH_MS ?? 60_000),
    ttlDetailMs: Number(process.env.CACHE_TTL_DETAIL_MS ?? 360_000),
  },
  cors: {
    origins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:4173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  },
  rateLimit: {
    ttlMs: Number(process.env.RATE_LIMIT_TTL_MS ?? 60_000),
    limit: Number(process.env.RATE_LIMIT_LIMIT ?? 120),
  },
  trustProxy: process.env.TRUST_PROXY === 'true',
  swagger: {
    enabled:
      process.env.SWAGGER_ENABLED === 'true' ||
      (process.env.SWAGGER_ENABLED !== 'false' && process.env.NODE_ENV !== 'production'),
  },
});
```

`backend/src/common/config/env.validation.ts`:

```ts
import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3001),
  HOST: Joi.string().default('0.0.0.0'),
  PHIMAPI_BASE_URL: Joi.string().uri({ scheme: ['http', 'https'] }).default('https://phimapi.com'),
  CORS_ORIGINS: Joi.string().default('http://localhost:5173,http://localhost:4173'),
  CACHE_MAX_ENTRIES: Joi.number().integer().min(1).default(500),
  CACHE_TTL_LIST_MS: Joi.number().integer().min(1000).default(240000),
  CACHE_TTL_NEW_MS: Joi.number().integer().min(1000).default(120000),
  CACHE_TTL_SEARCH_MS: Joi.number().integer().min(1000).default(60000),
  CACHE_TTL_DETAIL_MS: Joi.number().integer().min(1000).default(360000),
  UPSTREAM_TIMEOUT_MS: Joi.number().integer().min(100).max(9000).default(5000),
  UPSTREAM_RETRIES: Joi.number().integer().min(0).max(3).default(1),
  UPSTREAM_TOTAL_TIMEOUT_MS: Joi.number().integer().min(500).max(9500).default(9000),
  UPSTREAM_MAX_BYTES: Joi.number().integer().min(1024).default(2000000),
  RATE_LIMIT_TTL_MS: Joi.number().integer().min(1000).default(60000),
  RATE_LIMIT_LIMIT: Joi.number().integer().min(1).default(120),
  TRUST_PROXY: Joi.boolean().default(false),
  SWAGGER_ENABLED: Joi.boolean().optional(),
}).unknown(true);
```

`backend/src/health/health.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }
}
```

`backend/src/health/health.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({ controllers: [HealthController] })
export class HealthModule {}
```

- [ ] **Step 3: Add app setup and bootstrap**

`backend/src/app.setup.ts`:

```ts
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    })
  );
  app.enableShutdownHooks();
}
```

`backend/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './common/config/configuration';
import { envValidationSchema } from './common/config/env.validation';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    HealthModule,
  ],
})
export class AppModule {}
```

`backend/src/main.ts`:

```ts
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const config = app.get(ConfigService);
  await app.listen(config.getOrThrow<number>('port'), config.getOrThrow<string>('host'));
}

void bootstrap();
```

- [ ] **Step 4: Add the e2e health test**

`backend/test/create-test-app.ts`:

```ts
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}
```

`backend/test/health.e2e-spec.ts`:

```ts
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-test-app';

describe('Health API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns ok with uptime', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(response.body.status).toBe('ok');
    expect(typeof response.body.uptime).toBe('number');
  });
});
```

- [ ] **Step 5: Verify scaffold**

Run:

```bash
cd backend
npm run lint
npm test -- --runInBand
npm run test:e2e
npm run build
```

Expected: lint passes, health e2e passes, build emits `backend/dist/main.js`. Review the diff. Do not commit.

### Task 2: In-memory TTL/LRU cache with single-flight

**Files:**
- Create: `backend/src/cache/cache.interface.ts`
- Create: `backend/src/cache/memory-cache.service.ts`
- Create: `backend/src/cache/cache.module.ts`
- Create: `backend/src/cache/memory-cache.service.spec.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/health/health.controller.ts`
- Modify: `backend/test/health.e2e-spec.ts`

**Interfaces:**
- Produces: `CACHE_STORE` token, `CacheStore`, `CachedResult<T>`, `CacheStatus`, `CacheStats`, `MemoryCacheService`.
- Consumed later by `PhimApiService`, controllers, and health.

- [ ] **Step 1: Write the failing cache tests**

`backend/src/cache/memory-cache.service.spec.ts`:

```ts
import { MemoryCacheService } from './memory-cache.service';

describe('MemoryCacheService', () => {
  it('returns a hit for a fresh entry', async () => {
    const cache = new MemoryCacheService(10);
    const loader = jest.fn(async () => ({ value: 1 }));

    const first = await cache.getOrLoad('key', 1000, loader);
    const second = await cache.getOrLoad('key', 1000, loader);

    expect(first).toEqual({ value: { value: 1 }, cache: 'MISS' });
    expect(second).toEqual({ value: { value: 1 }, cache: 'HIT' });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('expires entries after their TTL', async () => {
    const cache = new MemoryCacheService(10);
    const first = await cache.getOrLoad('key', 10, async () => 'old');
    expect(first.value).toBe('old');

    await new Promise((resolve) => setTimeout(resolve, 25));

    const second = await cache.getOrLoad('key', 10, async () => 'new');
    expect(second.value).toBe('new');
  });

  it('evicts the least recently used entry', async () => {
    const cache = new MemoryCacheService(2);
    await cache.getOrLoad('a', 1000, async () => 'a');
    await cache.getOrLoad('b', 1000, async () => 'b');
    await cache.getOrLoad('c', 1000, async () => 'c');

    const result = await cache.getOrLoad('a', 1000, async () => 'a-miss');
    expect(result.value).toBe('a-miss');
    expect(result.cache).toBe('MISS');
  });

  it('coalesces concurrent loads for the same key', async () => {
    const cache = new MemoryCacheService(10);
    const loader = jest.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return 'value';
    });

    const [a, b] = await Promise.all([
      cache.getOrLoad('key', 1000, loader),
      cache.getOrLoad('key', 1000, loader),
    ]);

    expect(a.value).toBe('value');
    expect(b.value).toBe('value');
    expect(loader).toHaveBeenCalledTimes(1);
    expect(cache.getStats().inFlight).toBe(0);
  });

  it('does not cache when shouldCache returns false', async () => {
    const cache = new MemoryCacheService(10);
    const loader = jest.fn(async () => ({ status: false }));

    await cache.getOrLoad('key', 1000, loader, () => false);
    await cache.getOrLoad('key', 1000, loader, () => false);

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('clear removes all cached entries', async () => {
    const cache = new MemoryCacheService(10);
    const loader = jest.fn(async () => 'value');
    await cache.getOrLoad('key', 1000, loader);
    cache.clear();
    await cache.getOrLoad('key', 1000, loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npm test -- --runInBand src/cache/memory-cache.service.spec.ts`

Expected: FAIL because `./memory-cache.service` does not exist.

- [ ] **Step 3: Implement the cache interface and service**

`backend/src/cache/cache.interface.ts`:

```ts
export const CACHE_STORE = Symbol('CACHE_STORE');

export type CacheStatus = 'HIT' | 'MISS';

export interface CachedResult<T> {
  value: T;
  cache: CacheStatus;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  inFlight: number;
}

export interface CacheStore {
  getOrLoad<T>(
    key: string,
    ttlMs: number,
    loader: () => Promise<T>,
    shouldCache?: (value: T) => boolean
  ): Promise<CachedResult<T>>;
  getStats(): CacheStats;
  clear(): void;
}
```

`backend/src/cache/memory-cache.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { LRUCache } from 'lru-cache';
import type { CacheStats, CacheStore, CachedResult } from './cache.interface';

@Injectable()
export class MemoryCacheService implements CacheStore {
  private readonly cache: LRUCache<string, object>;
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private hits = 0;
  private misses = 0;

  constructor(maxEntries: number) {
    this.cache = new LRUCache<string, object>({
      max: maxEntries,
      allowStale: false,
    });
  }

  async getOrLoad<T>(
    key: string,
    ttlMs: number,
    loader: () => Promise<T>,
    shouldCache: (value: T) => boolean = () => true
  ): Promise<CachedResult<T>> {
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      this.hits += 1;
      return { value: cached as T, cache: 'HIT' };
    }

    const pending = this.inFlight.get(key);
    if (pending) {
      this.misses += 1;
      const value = (await pending) as T;
      return { value, cache: 'MISS' };
    }

    this.misses += 1;
    const request = (async () => {
      try {
        const value = await loader();
        if (shouldCache(value)) {
          this.cache.set(key, value as object, { ttl: ttlMs });
        }
        return value;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, request);
    const value = (await request) as T;
    return { value, cache: 'MISS' };
  }

  getStats(): CacheStats {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      inFlight: this.inFlight.size,
    };
  }

  clear(): void {
    this.cache.clear();
  }
}
```

`backend/src/cache/cache.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CACHE_STORE } from './cache.interface';
import { MemoryCacheService } from './memory-cache.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: CACHE_STORE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new MemoryCacheService(config.getOrThrow<number>('cache.maxEntries')),
    },
  ],
  exports: [CACHE_STORE],
})
export class CacheModule {}
```

- [ ] **Step 4: Wire cache into app and health**

In `backend/src/app.module.ts`, import `CacheModule` and add it before `HealthModule`:

```ts
import { CacheModule } from './cache/cache.module';

// inside imports:
CacheModule,
HealthModule,
```

Replace `backend/src/health/health.controller.ts` with:

```ts
import { Controller, Get, Inject } from '@nestjs/common';
import { CACHE_STORE, type CacheStore } from '../cache/cache.interface';

@Controller('health')
export class HealthController {
  constructor(@Inject(CACHE_STORE) private readonly cache: CacheStore) {}

  @Get()
  getHealth() {
    return {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      cache: this.cache.getStats(),
    };
  }
}
```

Add to `backend/test/health.e2e-spec.ts`:

```ts
expect(response.body.cache).toEqual({
  size: 0,
  hits: 0,
  misses: 0,
  inFlight: 0,
});
```

- [ ] **Step 5: Verify cache task**

Run:

```bash
cd backend
npm test -- --runInBand src/cache/memory-cache.service.spec.ts
npm run test:e2e
npm run build
```

Expected: all cache tests pass; health e2e still passes; build passes. Review the diff. Do not commit.

### Task 3: Allowlisted upstream client with timeout, retry, and error mapping

**Files:**
- Create: `backend/src/upstream/upstream.errors.ts`
- Create: `backend/src/upstream/upstream.types.ts`
- Create: `backend/src/upstream/phimapi.client.ts`
- Create: `backend/src/upstream/phimapi.client.spec.ts`
- Create: `backend/src/upstream/upstream.module.ts`
- Create: `backend/src/common/filters/api-exception.filter.ts`
- Modify: `backend/src/app.setup.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Produces: `UPSTREAM_FETCH`, `PhimApiClient.getJson<T>(path, query)`, `UpstreamError` codes `NOT_FOUND | TIMEOUT | RATE_LIMIT | BAD_RESPONSE | UNAVAILABLE`.
- Consumed later by `PhimApiService`, compat and normalized controllers.

- [ ] **Step 1: Write failing upstream client tests**

`backend/src/upstream/phimapi.client.spec.ts`:

```ts
import type { ConfigService } from '@nestjs/config';
import { PhimApiClient } from './phimapi.client';
import { UpstreamError } from './upstream.errors';

function config(overrides: Record<string, unknown> = {}): ConfigService {
  const values: Record<string, unknown> = {
    'upstream.baseUrl': 'https://phimapi.test',
    'upstream.timeoutMs': 1000,
    'upstream.retries': 1,
    'upstream.totalTimeoutMs': 3000,
    'upstream.maxBytes': 1024 * 1024,
    ...overrides,
  };
  return { getOrThrow: (key: string) => values[key] } as unknown as ConfigService;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('PhimApiClient', () => {
  it('fetches JSON with a canonical URL', async () => {
    const fetchFn = jest.fn(async (url: string | URL | Request) => {
      expect(String(url)).toBe('https://phimapi.test/v1/api/danh-sach/phim-le?page=2');
      return jsonResponse({ status: true, data: { items: [] } });
    });
    const client = new PhimApiClient(config(), fetchFn as typeof fetch);

    const result = await client.getJson('/v1/api/danh-sach/phim-le', { page: 2 });

    expect(result).toEqual({ status: true, data: { items: [] } });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 404', async () => {
    const fetchFn = jest.fn(async () => jsonResponse({ status: false }, 404));
    const client = new PhimApiClient(config(), fetchFn as typeof fetch);

    await expect(client.getJson('/phim/missing', {})).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 401', async () => {
    const fetchFn = jest.fn(async () => jsonResponse({ error: 'unauthorized' }, 401));
    const client = new PhimApiClient(config(), fetchFn as typeof fetch);

    await expect(client.getJson('/private', {})).rejects.toMatchObject({
      code: 'BAD_RESPONSE',
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('retries a 5xx then succeeds', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500))
      .mockResolvedValueOnce(jsonResponse({ status: true, items: [] }));
    const client = new PhimApiClient(config(), fetchFn as typeof fetch);

    const result = await client.getJson('/danh-sach/phim-moi-cap-nhat', { page: 1 });

    expect(result).toEqual({ status: true, items: [] });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('maps malformed JSON to BAD_RESPONSE without retrying', async () => {
    const fetchFn = jest.fn(async () => new Response('not-json', { status: 200 }));
    const client = new PhimApiClient(config(), fetchFn as typeof fetch);

    await expect(client.getJson('/bad', {})).rejects.toMatchObject({
      code: 'BAD_RESPONSE',
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('maps aborted requests to TIMEOUT', async () => {
    const fetchFn = jest.fn(async () => {
      throw new DOMException('Aborted', 'AbortError');
    });
    const client = new PhimApiClient(config({ 'upstream.retries': 0 }), fetchFn as typeof fetch);

    await expect(client.getJson('/slow', {})).rejects.toBeInstanceOf(UpstreamError);
    await expect(client.getJson('/slow', {})).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('rejects oversized responses', async () => {
    const fetchFn = jest.fn(async () =>
      new Response(JSON.stringify({ value: 'x'.repeat(100) }), {
        status: 200,
        headers: { 'content-length': '1000' },
      })
    );
    const client = new PhimApiClient(
      config({ 'upstream.maxBytes': 10 }),
      fetchFn as typeof fetch
    );

    await expect(client.getJson('/large', {})).rejects.toMatchObject({
      code: 'BAD_RESPONSE',
    });
  });

  it('rejects a path with traversal characters', async () => {
    const fetchFn = jest.fn();
    const client = new PhimApiClient(config(), fetchFn as typeof fetch);

    await expect(client.getJson('/../secret', {})).rejects.toMatchObject({
      code: 'BAD_RESPONSE',
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npm test -- --runInBand src/upstream/phimapi.client.spec.ts`

Expected: FAIL because the client and errors do not exist.

- [ ] **Step 3: Implement error types and raw upstream types**

`backend/src/upstream/upstream.errors.ts`:

```ts
export type UpstreamErrorCode =
  | 'NOT_FOUND'
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'BAD_RESPONSE'
  | 'UNAVAILABLE';

export class UpstreamError extends Error {
  constructor(
    public readonly code: UpstreamErrorCode,
    message: string,
    public readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}
```

`backend/src/upstream/upstream.types.ts`:

```ts
export interface UpstreamPagination {
  totalItems?: number;
  totalItemsPerPage?: number;
  currentPage?: number;
  totalPages?: number;
}

export interface UpstreamNamedItem {
  id?: string;
  name?: string;
  slug?: string;
}

export interface UpstreamTmdb {
  id?: string | number | null;
  type?: string | null;
  season?: number | null;
  vote_average?: number;
  vote_count?: number;
}

export interface UpstreamMovie {
  _id?: string;
  name?: string;
  slug?: string;
  origin_name?: string;
  thumb_url?: string;
  poster_url?: string;
  year?: number;
  time?: string;
  episode_current?: string;
  quality?: string;
  lang?: string;
  chieurap?: boolean;
  tmdb?: UpstreamTmdb;
  category?: UpstreamNamedItem[];
  country?: UpstreamNamedItem[];
  content?: string;
  type?: string;
  status?: string;
  trailer_url?: string;
  episode_total?: string | number;
  view?: number;
  actor?: string[];
  director?: string[];
}

export interface UpstreamEpisode {
  name?: string;
  slug?: string;
  filename?: string;
  link_embed?: string;
  link_m3u8?: string;
}

export interface UpstreamServer {
  server_name?: string;
  server_data?: UpstreamEpisode[];
}

export interface UpstreamListResponse {
  status?: boolean;
  msg?: string;
  items?: UpstreamMovie[];
  pagination?: UpstreamPagination;
  data?: {
    titlePage?: string;
    items?: UpstreamMovie[];
    params?: { pagination?: UpstreamPagination };
  };
}

export interface UpstreamDetailResponse {
  status?: boolean;
  msg?: string;
  movie?: UpstreamMovie;
  episodes?: UpstreamServer[];
}
```

- [ ] **Step 4: Implement the client**

`backend/src/upstream/phimapi.client.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UpstreamError } from './upstream.errors';

export const UPSTREAM_FETCH = Symbol('UPSTREAM_FETCH');
export type UpstreamQuery = Record<string, string | number | boolean | undefined>;

@Injectable()
export class PhimApiClient {
  constructor(
    private readonly config: ConfigService,
    @Inject(UPSTREAM_FETCH) private readonly fetchFn: typeof fetch
  ) {}

  async getJson<T>(path: string, query: UpstreamQuery = {}): Promise<T> {
    if (!/^\/[a-zA-Z0-9/_-]+$/.test(path) || path.includes('..')) {
      throw new UpstreamError('BAD_RESPONSE', 'Invalid upstream path');
    }

    const url = this.buildUrl(path, query);
    const timeoutMs = this.config.getOrThrow<number>('upstream.timeoutMs');
    const retries = this.config.getOrThrow<number>('upstream.retries');
    const totalTimeoutMs = this.config.getOrThrow<number>('upstream.totalTimeoutMs');
    const maxBytes = this.config.getOrThrow<number>('upstream.maxBytes');
    const deadline = Date.now() + totalTimeoutMs;
    let lastError: UpstreamError | undefined;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new UpstreamError('TIMEOUT', 'Upstream timeout');
      }

      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        Math.min(timeoutMs, remaining)
      );

      try {
        const response = await this.fetchFn(url, {
          method: 'GET',
          headers: {
            accept: 'application/json',
            'user-agent': 'CineHubBackend/0.1.0',
          },
          redirect: 'manual',
          signal: controller.signal,
        });

        if (response.status >= 300 && response.status < 400) {
          throw new UpstreamError('BAD_RESPONSE', 'Unexpected upstream redirect');
        }
        if (response.status === 404) {
          throw new UpstreamError('NOT_FOUND', 'Upstream resource not found');
        }
        if (response.status === 429) {
          const retryAfter = this.retryAfter(response);
          if (attempt < retries) {
            await this.sleep(Math.min(retryAfter ?? 250, 2000));
            continue;
          }
          throw new UpstreamError('RATE_LIMIT', 'Upstream rate limit', retryAfter);
        }
        if (response.status >= 500) {
          if (attempt < retries) {
            await this.sleep(250);
            continue;
          }
          throw new UpstreamError('UNAVAILABLE', 'Upstream server error');
        }
        if (!response.ok) {
          throw new UpstreamError('BAD_RESPONSE', `Upstream status ${response.status}`);
        }

        const contentLength = Number(response.headers.get('content-length') ?? 0);
        if (contentLength > maxBytes) {
          throw new UpstreamError('BAD_RESPONSE', 'Upstream response too large');
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.byteLength > maxBytes) {
          throw new UpstreamError('BAD_RESPONSE', 'Upstream response too large');
        }

        try {
          return JSON.parse(buffer.toString('utf8')) as T;
        } catch {
          throw new UpstreamError('BAD_RESPONSE', 'Upstream returned invalid JSON');
        }
      } catch (error) {
        if (error instanceof UpstreamError) {
          if (error.code === 'BAD_RESPONSE' || error.code === 'NOT_FOUND') {
            throw error;
          }
          lastError = error;
        } else if (this.isAbortError(error)) {
          lastError = new UpstreamError('TIMEOUT', 'Upstream timeout');
        } else {
          lastError = new UpstreamError('UNAVAILABLE', 'Network error');
        }

        if (attempt >= retries) {
          throw lastError;
        }
        await this.sleep(250);
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError ?? new UpstreamError('UNAVAILABLE', 'Upstream unavailable');
  }

  private buildUrl(path: string, query: UpstreamQuery): string {
    const base = this.config.getOrThrow<string>('upstream.baseUrl');
    const baseWithSlash = base.endsWith('/') ? base : `${base}/`;
    const url = new URL(path.replace(/^\/+/, ''), baseWithSlash);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  private retryAfter(response: Response): number | undefined {
    const raw = response.headers.get('retry-after');
    if (!raw) return undefined;
    const seconds = Number(raw);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
  }

  private isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

`backend/src/upstream/upstream.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PhimApiClient, UPSTREAM_FETCH } from './phimapi.client';

@Module({
  providers: [
    PhimApiClient,
    { provide: UPSTREAM_FETCH, useValue: fetch },
  ],
  exports: [PhimApiClient],
})
export class UpstreamModule {}
```

- [ ] **Step 5: Add the API exception filter and wire it**

`backend/src/common/filters/api-exception.filter.ts`:

```ts
import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { UpstreamError } from '../../upstream/upstream.errors';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof UpstreamError) {
      const mapped = this.mapUpstream(exception);
      status = mapped.status;
      message = mapped.message;
      error = mapped.error;
      if (exception.retryAfterSeconds !== undefined) {
        response.setHeader('Retry-After', String(exception.retryAfterSeconds));
      }
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const record = body as { message?: unknown; error?: unknown };
        message = Array.isArray(record.message)
          ? record.message.join('; ')
          : String(record.message ?? exception.message);
        error = String(record.error ?? exception.name);
      }
    } else {
      this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : undefined);
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      path: request.originalUrl,
    });
  }

  private mapUpstream(exception: UpstreamError): {
    status: number;
    message: string;
    error: string;
  } {
    switch (exception.code) {
      case 'NOT_FOUND':
        return { status: 404, message: 'Movie not found', error: 'Not Found' };
      case 'TIMEOUT':
        return { status: 504, message: 'Upstream timeout', error: 'Gateway Timeout' };
      case 'RATE_LIMIT':
        return { status: 503, message: 'Upstream rate limit', error: 'Service Unavailable' };
      case 'BAD_RESPONSE':
      case 'UNAVAILABLE':
      default:
        return { status: 502, message: 'Upstream unavailable', error: 'Bad Gateway' };
    }
  }
}
```

In `backend/src/app.setup.ts`, import and register:

```ts
import { ApiExceptionFilter } from './common/filters/api-exception.filter';

// inside configureApp, after useGlobalPipes:
app.useGlobalFilters(new ApiExceptionFilter());
```

In `backend/src/app.module.ts`, import `UpstreamModule` and add it to `imports` after `CacheModule`.

Add this filter test to `backend/test/health.e2e-spec.ts` (you will use it fully in the compat e2e task):

```ts
it('returns the common error shape for an unknown route', async () => {
  const response = await request(app.getHttpServer()).get('/api/does-not-exist').expect(404);
  expect(response.body).toMatchObject({
    statusCode: 404,
    path: '/api/does-not-exist',
  });
});
```

- [ ] **Step 6: Verify upstream task**

Run:

```bash
cd backend
npm test -- --runInBand src/upstream/phimapi.client.spec.ts
npm run test:e2e
npm run build
```

Expected: client tests pass; health e2e passes; build passes. Review the diff. Do not commit.

### Task 4: Cached upstream service with shared keys

**Files:**
- Create: `backend/src/upstream/phimapi.service.ts`
- Create: `backend/src/upstream/phimapi.service.spec.ts`
- Modify: `backend/src/upstream/upstream.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `CACHE_STORE`, `CacheStore`, `PhimApiClient`.
- Produces: `PhimApiService.get<T>(path, query, ttlMs): Promise<CachedResult<T>>`.
- `PhimApiService` never caches an envelope whose `status === false`.

- [ ] **Step 1: Write the failing service tests**

`backend/src/upstream/phimapi.service.spec.ts`:

```ts
import type { PhimApiClient } from './phimapi.client';
import { PhimApiService } from './phimapi.service';
import { MemoryCacheService } from '../cache/memory-cache.service';

function fakeClient(value: unknown): PhimApiClient {
  return {
    getJson: jest.fn().mockResolvedValue(value),
  } as unknown as PhimApiClient;
}

describe('PhimApiService', () => {
  it('shares one cache key across different query orderings', async () => {
    const client = fakeClient({ status: true, items: [] });
    const service = new PhimApiService(new MemoryCacheService(10), client);

    const first = await service.get('/v1/api/tim-kiem', { keyword: 'avatar', page: 1 }, 1000);
    const second = await service.get('/v1/api/tim-kiem', { page: 1, keyword: 'avatar' }, 1000);

    expect(first.cache).toBe('MISS');
    expect(second.cache).toBe('HIT');
    expect(client.getJson).toHaveBeenCalledTimes(1);
  });

  it('does not cache an upstream status:false envelope', async () => {
    const client = fakeClient({ status: false, msg: 'not found' });
    const service = new PhimApiService(new MemoryCacheService(10), client);

    await service.get('/phim/missing', {}, 1000);
    await service.get('/phim/missing', {}, 1000);

    expect(client.getJson).toHaveBeenCalledTimes(2);
  });

  it('does not cache a null payload', async () => {
    const client = fakeClient(null);
    const service = new PhimApiService(new MemoryCacheService(10), client);

    await service.get('/bad', {}, 1000);
    await service.get('/bad', {}, 1000);

    expect(client.getJson).toHaveBeenCalledTimes(2);
  });

  it('keeps status:true payloads cacheable', async () => {
    const client = fakeClient({ status: true, items: [{ slug: 'a' }] });
    const service = new PhimApiService(new MemoryCacheService(10), client);

    await service.get('/danh-sach/phim-moi-cap-nhat', { page: 1 }, 1000);
    const second = await service.get('/danh-sach/phim-moi-cap-nhat', { page: 1 }, 1000);

    expect(second.cache).toBe('HIT');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npm test -- --runInBand src/upstream/phimapi.service.spec.ts`

Expected: FAIL because `phimapi.service.ts` does not exist.

- [ ] **Step 3: Implement the service**

`backend/src/upstream/phimapi.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';
import { CACHE_STORE, type CacheStore, type CachedResult } from '../cache/cache.interface';
import { PhimApiClient, type UpstreamQuery } from './phimapi.client';

function canonicalQuery(query: UpstreamQuery): string {
  return Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}

function isFailedEnvelope(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    (value as { status?: unknown }).status === false
  );
}

function isCacheable(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !isFailedEnvelope(value);
}

@Injectable()
export class PhimApiService {
  constructor(
    @Inject(CACHE_STORE) private readonly cache: CacheStore,
    private readonly client: PhimApiClient
  ) {}

  get<T>(
    path: string,
    query: UpstreamQuery,
    ttlMs: number
  ): Promise<CachedResult<T>> {
    const queryString = canonicalQuery(query);
    const key = `phimapi:GET:${path}?${queryString}`;

    return this.cache.getOrLoad<T>(
      key,
      ttlMs,
      () => this.client.getJson<T>(path, query),
      (value) => isCacheable(value)
    );
  }
}
```

`backend/src/upstream/upstream.module.ts` becomes:

```ts
import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { PhimApiClient, UPSTREAM_FETCH } from './phimapi.client';
import { PhimApiService } from './phimapi.service';

@Module({
  imports: [CacheModule],
  providers: [
    PhimApiClient,
    PhimApiService,
    { provide: UPSTREAM_FETCH, useValue: fetch },
  ],
  exports: [PhimApiClient, PhimApiService],
})
export class UpstreamModule {}
```

`backend/src/app.module.ts` should already import `UpstreamModule`; keep it after `CacheModule`.

- [ ] **Step 4: Verify cache-sharing behavior**

Run:

```bash
cd backend
npm test -- --runInBand src/upstream/phimapi.service.spec.ts
npm test -- --runInBand
npm run build
```

Expected: service tests pass; all unit tests pass; build passes. Review the diff. Do not commit.

### Task 5: DTOs, validation, and upstream-to-normalized mappers

**Files:**
- Create: `backend/src/common/dto/page-query.dto.ts`
- Create: `backend/src/common/dto/catalog-query.dto.ts`
- Create: `backend/src/common/dto/search-query.dto.ts`
- Create: `backend/src/common/dto/keyword-query.dto.ts`
- Create: `backend/src/common/dto/slug-param.dto.ts`
- Create: `backend/src/common/dto/type-param.dto.ts`
- Create: `backend/src/movies/dto/movie.dto.ts`
- Create: `backend/src/movies/mappers/movie.mapper.ts`
- Create: `backend/src/movies/mappers/movie.mapper.spec.ts`
- Create: `backend/src/common/dto/dto-validation.spec.ts`

**Interfaces:**
- Produces: `PageQueryDto`, `CatalogQueryDto`, `SearchQueryDto`, `KeywordQueryDto`, `SlugParamDto`, `TypeParamDto`, `MovieListDto`, `MovieDetailDto`, `MovieSummaryDto`, `PaginationDto`, `mapMovieSummary`, `mapMovieDetail`, `mapListResponse`.
- Consumed by Tasks 6–8.

- [ ] **Step 1: Write failing DTO validation tests**

`backend/src/common/dto/dto-validation.spec.ts`:

```ts
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CatalogQueryDto } from './catalog-query.dto';
import { KeywordQueryDto } from './keyword-query.dto';
import { PageQueryDto } from './page-query.dto';
import { SearchQueryDto } from './search-query.dto';
import { SlugParamDto } from './slug-param.dto';

async function errors<T extends object>(dto: new () => T, value: object): Promise<string[]> {
  const instance = plainToInstance(dto, value);
  const result = await validate(instance);
  return result.flatMap((item) => Object.keys(item.constraints ?? {}));
}

describe('query DTO validation', () => {
  it('defaults page to 1 and accepts 1..5000', async () => {
    expect(await errors(PageQueryDto, {})).toEqual([]);
    expect(await errors(PageQueryDto, { page: '2' })).toEqual([]);
    expect(await errors(PageQueryDto, { page: '0' })).not.toEqual([]);
    expect(await errors(PageQueryDto, { page: '5001' })).not.toEqual([]);
    expect(await errors(PageQueryDto, { page: 'abc' })).not.toEqual([]);
  });

  it('requires a known catalog type', async () => {
    expect(await errors(CatalogQueryDto, { type: 'phim-le' })).toEqual([]);
    expect(await errors(CatalogQueryDto, { type: 'unknown' })).not.toEqual([]);
  });

  it('trims search q and rejects empty or overlong values', async () => {
    const instance = plainToInstance(SearchQueryDto, { q: '  avatar  ' });
    expect(instance.q).toBe('avatar');
    expect(await errors(SearchQueryDto, { q: 'avatar' })).toEqual([]);
    expect(await errors(SearchQueryDto, { q: '   ' })).not.toEqual([]);
    expect(await errors(SearchQueryDto, { q: 'x'.repeat(101) })).not.toEqual([]);
  });

  it('requires keyword for compat search', async () => {
    expect(await errors(KeywordQueryDto, { keyword: 'avatar' })).toEqual([]);
    expect(await errors(KeywordQueryDto, {})).not.toEqual([]);
  });

  it('rejects unsafe slugs', async () => {
    expect(await errors(SlugParamDto, { slug: 'ten-phim-1' })).toEqual([]);
    expect(await errors(SlugParamDto, { slug: '../secret' })).not.toEqual([]);
    expect(await errors(SlugParamDto, { slug: 'Ten Phim' })).not.toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npm test -- --runInBand src/common/dto/dto-validation.spec.ts`

Expected: FAIL because the DTOs do not exist.

- [ ] **Step 3: Implement the DTOs**

`backend/src/common/dto/page-query.dto.ts`:

```ts
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  page: number = 1;
}
```

`backend/src/common/dto/catalog-query.dto.ts`:

```ts
import { IsIn } from 'class-validator';
import { PageQueryDto } from './page-query.dto';

export const CATALOG_TYPES = ['phim-le', 'phim-bo', 'hoat-hinh', 'tv-shows'] as const;
export type CatalogType = (typeof CATALOG_TYPES)[number];

export class CatalogQueryDto extends PageQueryDto {
  @IsIn(CATALOG_TYPES)
  type!: CatalogType;
}
```

`backend/src/common/dto/search-query.dto.ts`:

```ts
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { PageQueryDto } from './page-query.dto';

export class SearchQueryDto extends PageQueryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  q!: string;
}
```

`backend/src/common/dto/keyword-query.dto.ts`:

```ts
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { PageQueryDto } from './page-query.dto';

export class KeywordQueryDto extends PageQueryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  keyword!: string;
}
```

`backend/src/common/dto/slug-param.dto.ts`:

```ts
import { Matches } from 'class-validator';

export class SlugParamDto {
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;
}
```

`backend/src/common/dto/type-param.dto.ts`:

```ts
import { IsIn } from 'class-validator';
import { CATALOG_TYPES, type CatalogType } from './catalog-query.dto';

export class TypeParamDto {
  @IsIn(CATALOG_TYPES)
  type!: CatalogType;
}
```

- [ ] **Step 4: Write failing mapper tests**

`backend/src/movies/mappers/movie.mapper.spec.ts`:

```ts
import { mapListResponse, mapMovieDetail, mapMovieSummary } from './movie.mapper';

describe('movie mapper', () => {
  it('maps the stable summary fields and drops unknown fields', () => {
    const result = mapMovieSummary({
      _id: 'id-1',
      name: 'Tên 1 / Tên 2',
      slug: 'ten-phim',
      origin_name: 'Original',
      year: 2026,
      time: '120 phút',
      episode_current: 'Full',
      quality: 'HD',
      lang: 'Vietsub',
      chieurap: false,
      tmdb: { id: 123, type: 'movie', season: null, vote_average: 7.5 },
      category: [{ id: '1', name: 'Hành Động', slug: 'hanh-dong' }],
      country: [{ name: 'Việt Nam', slug: 'viet-nam' }],
      modified: 'ignored',
    } as never);

    expect(result).toMatchObject({
      _id: 'id-1',
      name: 'Tên 1 / Tên 2',
      slug: 'ten-phim',
      year: 2026,
      tmdb: { id: 123, type: 'movie' },
      category: [{ name: 'Hành Động', slug: 'hanh-dong' }],
    });
    expect(result).not.toHaveProperty('modified');
  });

  it('maps new/list pagination and titles from both upstream shapes', () => {
    const newResult = mapListResponse({
      status: true,
      items: [{ name: 'A', slug: 'a' }],
      pagination: { currentPage: 1, totalPages: 2, totalItems: 30, totalItemsPerPage: 24 },
    });
    expect(newResult.items).toHaveLength(1);
    expect(newResult.pagination).toEqual({
      page: 1,
      totalPages: 2,
      totalItems: 30,
      totalItemsPerPage: 24,
    });

    const catalogResult = mapListResponse({
      status: true,
      data: {
        titlePage: 'Phim Lẻ',
        items: [{ name: 'B', slug: 'b' }],
        params: { pagination: { currentPage: 2, totalPages: 3, totalItems: 50, totalItemsPerPage: 24 } },
      },
    });
    expect(catalogResult.title).toBe('Phim Lẻ');
    expect(catalogResult.items[0].slug).toBe('b');
    expect(catalogResult.pagination.page).toBe(2);
  });

  it('maps detail episodes and drops unsafe or empty links', () => {
    const result = mapMovieDetail({
      status: true,
      movie: { name: 'Phim', slug: 'phim', content: '<p>ok</p>', type: 'series' },
      episodes: [
        {
          server_name: 'Vietsub',
          server_data: [
            { name: 'Tập 1', slug: 'tap-1', link_embed: 'https://e/1', link_m3u8: 'https://m/1' },
            { name: 'Bad', slug: 'bad', link_embed: 'javascript:alert(1)', link_m3u8: '' },
            { name: 'Empty', slug: 'empty' },
          ],
        },
      ],
    });

    expect(result?.name).toBe('Phim');
    expect(result?.content).toBe('<p>ok</p>');
    expect(result?.episodes).toEqual([
      {
        server_name: 'Vietsub',
        server_data: [
          { name: 'Tập 1', slug: 'tap-1', link_embed: 'https://e/1', link_m3u8: 'https://m/1' },
        ],
      },
    ]);
  });

  it('returns null for a failed or missing detail', () => {
    expect(mapMovieDetail({ status: false, movie: { name: 'A', slug: 'a' } })).toBeNull();
    expect(mapMovieDetail({ status: true })).toBeNull();
  });
});
```

- [ ] **Step 5: Implement normalized DTOs and mappers**

`backend/src/movies/dto/movie.dto.ts`:

```ts
export interface MovieNamedDto {
  id?: string;
  name: string;
  slug: string;
}

export interface MovieTmdbDto {
  id?: string | number | null;
  type?: string | null;
  season?: number | null;
  vote_average?: number;
  vote_count?: number;
}

export interface MovieSummaryDto {
  _id?: string;
  name: string;
  slug: string;
  origin_name?: string;
  thumb_url?: string;
  poster_url?: string;
  year?: number;
  time?: string;
  episode_current?: string;
  quality?: string;
  lang?: string;
  chieurap?: boolean;
  tmdb?: MovieTmdbDto;
  category?: MovieNamedDto[];
  country?: MovieNamedDto[];
}

export interface EpisodeDto {
  name: string;
  slug: string;
  filename?: string;
  link_embed: string;
  link_m3u8: string;
}

export interface EpisodeServerDto {
  server_name: string;
  server_data: EpisodeDto[];
}

export interface MovieDetailDto extends MovieSummaryDto {
  content?: string;
  type?: string;
  status?: string;
  trailer_url?: string;
  episode_total?: string | number;
  view?: number;
  actor?: string[];
  director?: string[];
  episodes?: EpisodeServerDto[];
}

export interface PaginationDto {
  page: number;
  totalPages: number;
  totalItems: number;
  totalItemsPerPage: number;
}

export interface MovieListDto {
  items: MovieSummaryDto[];
  title?: string;
  pagination: PaginationDto;
}

export interface MovieDetailResultDto {
  movie: MovieDetailDto;
}
```

`backend/src/movies/mappers/movie.mapper.ts`:

```ts
import type {
  UpstreamDetailResponse,
  UpstreamListResponse,
  UpstreamMovie,
  UpstreamNamedItem,
  UpstreamPagination,
  UpstreamServer,
} from '../../upstream/upstream.types';
import type {
  EpisodeServerDto,
  MovieDetailDto,
  MovieListDto,
  MovieNamedDto,
  MovieSummaryDto,
  PaginationDto,
} from '../dto/movie.dto';

function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function numeric(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function httpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? value : undefined;
  } catch {
    return undefined;
  }
}

function namedItems(value: unknown): MovieNamedDto[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((item): item is UpstreamNamedItem => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      ...(text(item.id) ? { id: text(item.id) } : {}),
      name: text(item.name) ?? '',
      slug: text(item.slug) ?? '',
    }))
    .filter((item) => item.name.length > 0 || item.slug.length > 0);
  return items.length > 0 ? items : undefined;
}

function mapEpisodes(raw: unknown): EpisodeServerDto[] {
  if (!Array.isArray(raw)) return [];

  const servers: EpisodeServerDto[] = [];
  for (const server of raw as UpstreamServer[]) {
    if (!server || typeof server !== 'object' || !Array.isArray(server.server_data)) continue;
    const episodes = server.server_data
      .filter((episode) => episode && typeof episode === 'object')
      .map((episode) => {
        const link_embed = httpUrl(episode.link_embed) ?? '';
        const link_m3u8 = httpUrl(episode.link_m3u8) ?? '';
        return {
          name: text(episode.name) ?? '',
          slug: text(episode.slug) ?? '',
          ...(text(episode.filename) ? { filename: text(episode.filename) } : {}),
          link_embed,
          link_m3u8,
        };
      })
      .filter((episode) => episode.link_embed.length > 0 || episode.link_m3u8.length > 0);

    if (episodes.length > 0) {
      servers.push({
        server_name: text(server.server_name) ?? '',
        server_data: episodes,
      });
    }
  }
  return servers;
}

export function mapMovieSummary(raw: UpstreamMovie): MovieSummaryDto {
  const result: MovieSummaryDto = {
    name: text(raw.name) ?? '',
    slug: text(raw.slug) ?? '',
  };

  if (text(raw._id)) result._id = text(raw._id);
  if (text(raw.origin_name)) result.origin_name = text(raw.origin_name);
  if (text(raw.thumb_url)) result.thumb_url = text(raw.thumb_url);
  if (text(raw.poster_url)) result.poster_url = text(raw.poster_url);
  if (numeric(raw.year) !== undefined) result.year = numeric(raw.year);
  if (text(raw.time)) result.time = text(raw.time);
  if (text(raw.episode_current)) result.episode_current = text(raw.episode_current);
  if (text(raw.quality)) result.quality = text(raw.quality);
  if (text(raw.lang)) result.lang = text(raw.lang);
  if (typeof raw.chieurap === 'boolean') result.chieurap = raw.chieurap;

  if (raw.tmdb && typeof raw.tmdb === 'object') {
    result.tmdb = {
      ...(raw.tmdb.id !== undefined ? { id: raw.tmdb.id } : {}),
      ...(text(raw.tmdb.type) ? { type: text(raw.tmdb.type) } : {}),
      ...(numeric(raw.tmdb.season) !== undefined ? { season: numeric(raw.tmdb.season) } : {}),
      ...(numeric(raw.tmdb.vote_average) !== undefined
        ? { vote_average: numeric(raw.tmdb.vote_average) }
        : {}),
      ...(numeric(raw.tmdb.vote_count) !== undefined
        ? { vote_count: numeric(raw.tmdb.vote_count) }
        : {}),
    };
  }

  const category = namedItems(raw.category);
  if (category) result.category = category;
  const country = namedItems(raw.country);
  if (country) result.country = country;
  return result;
}

function mapPagination(raw: UpstreamPagination | undefined): PaginationDto {
  return {
    page: numeric(raw?.currentPage) ?? 1,
    totalPages: numeric(raw?.totalPages) ?? 1,
    totalItems: numeric(raw?.totalItems) ?? 0,
    totalItemsPerPage: numeric(raw?.totalItemsPerPage) ?? 0,
  };
}

export function mapListResponse(raw: UpstreamListResponse): MovieListDto {
  const upstreamPagination = raw.pagination ?? raw.data?.params?.pagination;
  const rawItems = raw.items ?? raw.data?.items ?? [];
  const items = rawItems
    .filter((item): item is UpstreamMovie => Boolean(item) && typeof item === 'object')
    .map(mapMovieSummary);
  const title = text(raw.data?.titlePage);

  return {
    items,
    ...(title ? { title } : {}),
    pagination: mapPagination(upstreamPagination),
  };
}

export function mapMovieDetail(raw: UpstreamDetailResponse): MovieDetailDto | null {
  if (!raw || raw.status === false || !raw.movie) return null;

  const summary = mapMovieSummary(raw.movie);
  const result: MovieDetailDto = {
    ...summary,
    episodes: mapEpisodes(raw.episodes),
  };

  if (text(raw.movie.content)) result.content = text(raw.movie.content);
  if (text(raw.movie.type)) result.type = text(raw.movie.type);
  if (text(raw.movie.status)) result.status = text(raw.movie.status);
  if (text(raw.movie.trailer_url)) result.trailer_url = text(raw.movie.trailer_url);
  if (text(raw.movie.episode_total) || typeof raw.movie.episode_total === 'number') {
    result.episode_total = raw.movie.episode_total;
  }
  if (numeric(raw.movie.view) !== undefined) result.view = numeric(raw.movie.view);
  if (Array.isArray(raw.movie.actor)) result.actor = raw.movie.actor.filter((v) => typeof v === 'string');
  if (Array.isArray(raw.movie.director)) {
    result.director = raw.movie.director.filter((v) => typeof v === 'string');
  }
  return result;
}
```

- [ ] **Step 6: Run mapper/validation tests**

Run:

```bash
cd backend
npm test -- --runInBand src/common/dto/dto-validation.spec.ts src/movies/mappers/movie.mapper.spec.ts
npm run build
```

Expected: DTO and mapper tests pass; build passes. Review the diff. Do not commit.

### Task 6: Compat proxy endpoints and local upstream stub

**Files:**
- Create: `backend/src/common/config/ttl.ts`
- Create: `backend/src/common/http/cache-headers.ts`
- Create: `backend/src/compat/compat.controller.ts`
- Create: `backend/src/compat/compat.module.ts`
- Create: `backend/test/upstream-stub.ts`
- Create: `backend/test/compat.e2e-spec.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `PhimApiService.get`, DTOs, `setCacheHeaders`, `ttlFor`.
- Produces: six `/api/compat/*` routes with raw upstream JSON and `X-Cache`.

- [ ] **Step 1: Add TTL/cache header helpers**

`backend/src/common/config/ttl.ts`:

```ts
import type { ConfigService } from '@nestjs/config';

const TTL_KEYS = {
  list: 'cache.ttlListMs',
  new: 'cache.ttlNewMs',
  search: 'cache.ttlSearchMs',
  detail: 'cache.ttlDetailMs',
} as const;

export type TtlKind = keyof typeof TTL_KEYS;

export function ttlFor(config: ConfigService, kind: TtlKind): number {
  return config.getOrThrow<number>(TTL_KEYS[kind]);
}
```

`backend/src/common/http/cache-headers.ts`:

```ts
import type { Response } from 'express';
import type { CacheStatus } from '../../cache/cache.interface';

export function setCacheHeaders(
  response: Response,
  cache: CacheStatus,
  maxAgeSeconds: number,
  staleWhileRevalidate = true
): void {
  response.setHeader('X-Cache', cache);
  response.setHeader(
    'Cache-Control',
    staleWhileRevalidate
      ? `public, max-age=${maxAgeSeconds}, stale-while-revalidate=120`
      : `public, max-age=${maxAgeSeconds}`
  );
  response.setHeader('Vary', 'Origin');
}
```

- [ ] **Step 2: Implement compat controller and module**

`backend/src/compat/compat.controller.ts`:

```ts
import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { setCacheHeaders } from '../common/http/cache-headers';
import { PageQueryDto } from '../common/dto/page-query.dto';
import { KeywordQueryDto } from '../common/dto/keyword-query.dto';
import { SlugParamDto } from '../common/dto/slug-param.dto';
import { TypeParamDto } from '../common/dto/type-param.dto';
import { ttlFor } from '../common/config/ttl';
import { PhimApiService } from '../upstream/phimapi.service';
import type {
  UpstreamDetailResponse,
  UpstreamListResponse,
} from '../upstream/upstream.types';

@Controller('compat')
export class CompatController {
  constructor(
    private readonly api: PhimApiService,
    private readonly config: ConfigService
  ) {}

  @Get('danh-sach/phim-moi-cap-nhat')
  async newUpdated(
    @Query() query: PageQueryDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<UpstreamListResponse> {
    const result = await this.api.get<UpstreamListResponse>(
      '/danh-sach/phim-moi-cap-nhat',
      { page: query.page },
      ttlFor(this.config, 'new')
    );
    setCacheHeaders(response, result.cache, 30);
    return result.value;
  }

  @Get('v1/api/danh-sach/:type')
  async catalog(
    @Param() params: TypeParamDto,
    @Query() query: PageQueryDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<UpstreamListResponse> {
    const result = await this.api.get<UpstreamListResponse>(
      `/v1/api/danh-sach/${params.type}`,
      { page: query.page },
      ttlFor(this.config, 'list')
    );
    setCacheHeaders(response, result.cache, 30);
    return result.value;
  }

  @Get('v1/api/the-loai/:slug')
  async genre(
    @Param() params: SlugParamDto,
    @Query() query: PageQueryDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<UpstreamListResponse> {
    const result = await this.api.get<UpstreamListResponse>(
      `/v1/api/the-loai/${params.slug}`,
      { page: query.page },
      ttlFor(this.config, 'list')
    );
    setCacheHeaders(response, result.cache, 30);
    return result.value;
  }

  @Get('v1/api/quoc-gia/:slug')
  async country(
    @Param() params: SlugParamDto,
    @Query() query: PageQueryDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<UpstreamListResponse> {
    const result = await this.api.get<UpstreamListResponse>(
      `/v1/api/quoc-gia/${params.slug}`,
      { page: query.page },
      ttlFor(this.config, 'list')
    );
    setCacheHeaders(response, result.cache, 30);
    return result.value;
  }

  @Get('v1/api/tim-kiem')
  async search(
    @Query() query: KeywordQueryDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<UpstreamListResponse> {
    const result = await this.api.get<UpstreamListResponse>(
      '/v1/api/tim-kiem',
      { keyword: query.keyword, page: query.page },
      ttlFor(this.config, 'search')
    );
    setCacheHeaders(response, result.cache, 30);
    return result.value;
  }

  @Get('phim/:slug')
  async detail(
    @Param() params: SlugParamDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<UpstreamDetailResponse> {
    const result = await this.api.get<UpstreamDetailResponse>(
      `/phim/${params.slug}`,
      {},
      ttlFor(this.config, 'detail')
    );
    setCacheHeaders(response, result.cache, 60, false);
    return result.value;
  }
}
```

`backend/src/compat/compat.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { UpstreamModule } from '../upstream/upstream.module';
import { CompatController } from './compat.controller';

@Module({
  imports: [UpstreamModule],
  controllers: [CompatController],
})
export class CompatModule {}
```

In `backend/src/app.module.ts`, add `CompatModule` to `imports`.

- [ ] **Step 3: Create the upstream stub and failing compat e2e test**

`backend/test/upstream-stub.ts`:

```ts
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export const movieFixture = {
  _id: 'movie-1',
  name: 'Phim Test',
  slug: 'phim-test',
  origin_name: 'Test Movie',
  thumb_url: 'https://images.test/thumb.jpg',
  poster_url: 'https://images.test/poster.jpg',
  year: 2026,
  time: '120 phút',
  episode_current: 'Full',
  quality: 'HD',
  lang: 'Vietsub',
  chieurap: false,
  tmdb: { id: 123, type: 'movie', season: null, vote_average: 7.5 },
  category: [{ name: 'Hành Động', slug: 'hanh-dong' }],
  country: [{ name: 'Việt Nam', slug: 'viet-nam' }],
};

export const newUpdatedFixture = {
  status: true,
  msg: '',
  items: [movieFixture],
  pagination: {
    totalItems: 1,
    totalItemsPerPage: 24,
    currentPage: 1,
    totalPages: 1,
  },
};

export const catalogFixture = {
  status: true,
  msg: '',
  data: {
    titlePage: 'Phim Lẻ',
    items: [movieFixture],
    params: {
      pagination: {
        totalItems: 1,
        totalItemsPerPage: 24,
        currentPage: 1,
        totalPages: 1,
      },
    },
  },
};

export const detailFixture = {
  status: true,
  msg: '',
  movie: {
    ...movieFixture,
    content: '<p>Nội dung phim</p>',
    type: 'movie',
    status: 'completed',
    episode_total: 'Full',
    view: 42,
    actor: ['Diễn viên A'],
    director: ['Đạo diễn B'],
  },
  episodes: [
    {
      server_name: 'Vietsub',
      server_data: [
        {
          name: 'Full',
          slug: 'full',
          filename: 'phim-test.mp4',
          link_embed: 'https://embed.test/1',
          link_m3u8: 'https://stream.test/1.m3u8',
        },
      ],
    },
  ],
};

export type StubHandler = (request: IncomingMessage, response: ServerResponse) => void;

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

export const defaultStubHandler: StubHandler = (request, response) => {
  const path = (request.url ?? '').split('?')[0];
  if (request.method !== 'GET') return sendJson(response, 405, { error: 'method' });
  if (path === '/danh-sach/phim-moi-cap-nhat') return sendJson(response, 200, newUpdatedFixture);
  if (path === '/v1/api/danh-sach/phim-le') return sendJson(response, 200, catalogFixture);
  if (path === '/v1/api/the-loai/hanh-dong') return sendJson(response, 200, catalogFixture);
  if (path === '/v1/api/quoc-gia/viet-nam') return sendJson(response, 200, catalogFixture);
  if (path === '/v1/api/tim-kiem') return sendJson(response, 200, catalogFixture);
  if (path.startsWith('/phim/')) return sendJson(response, 200, detailFixture);
  return sendJson(response, 404, { status: false, msg: 'not found' });
};

export interface UpstreamStub {
  baseUrl: string;
  requests: string[];
  close: () => Promise<void>;
}

export async function startUpstreamStub(
  handler: StubHandler = defaultStubHandler
): Promise<UpstreamStub> {
  const requests: string[] = [];
  const server = createServer((request, response) => {
    requests.push(request.url ?? '');
    handler(request, response);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
```

`backend/test/compat.e2e-spec.ts`:

```ts
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  catalogFixture,
  detailFixture,
  newUpdatedFixture,
  startUpstreamStub,
  type UpstreamStub,
} from './upstream-stub';
import { createTestApp } from './create-test-app';

describe('Compat API', () => {
  let app: INestApplication;
  let stub: UpstreamStub;

  beforeAll(async () => {
    stub = await startUpstreamStub();
    process.env.NODE_ENV = 'test';
    process.env.PHIMAPI_BASE_URL = stub.baseUrl;
    process.env.SWAGGER_ENABLED = 'false';
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await stub.close();
    delete process.env.PHIMAPI_BASE_URL;
    delete process.env.SWAGGER_ENABLED;
  });

  it('preserves raw shapes for all six frontend calls', async () => {
    const cases: Array<[string, unknown]> = [
      ['/api/compat/danh-sach/phim-moi-cap-nhat?page=1', newUpdatedFixture],
      ['/api/compat/v1/api/danh-sach/phim-le?page=1', catalogFixture],
      ['/api/compat/v1/api/the-loai/hanh-dong?page=1', catalogFixture],
      ['/api/compat/v1/api/quoc-gia/viet-nam?page=1', catalogFixture],
      ['/api/compat/v1/api/tim-kiem?keyword=avatar&page=1', catalogFixture],
      ['/api/compat/phim/phim-test', detailFixture],
    ];

    for (const [path, body] of cases) {
      const response = await request(app.getHttpServer()).get(path).expect(200);
      expect(response.body).toEqual(body);
      expect(response.headers['content-type']).toContain('application/json');
    }
  });

  it('serves a cache hit without calling upstream twice', async () => {
    const path = '/api/compat/danh-sach/phim-moi-cap-nhat?page=7';
    const before = stub.requests.filter((url) =>
      url.startsWith('/danh-sach/phim-moi-cap-nhat')
    ).length;
    const first = await request(app.getHttpServer()).get(path).expect(200);
    const second = await request(app.getHttpServer()).get(path).expect(200);

    expect(first.headers['x-cache']).toBe('MISS');
    expect(second.headers['x-cache']).toBe('HIT');
    expect(
      stub.requests.filter((url) => url.startsWith('/danh-sach/phim-moi-cap-nhat'))
    ).toHaveLength(before + 1);
  });

  it('returns 400 for invalid page, type, and slug', async () => {
    await request(app.getHttpServer()).get('/api/compat/danh-sach/phim-moi-cap-nhat?page=0').expect(400);
    await request(app.getHttpServer()).get('/api/compat/v1/api/danh-sach/unknown?page=1').expect(400);
    await request(app.getHttpServer()).get('/api/compat/phim/Ten%20Phim').expect(400);
  });

  it('returns the common error shape', async () => {
    const response = await request(app.getHttpServer()).get('/api/unknown').expect(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      path: '/api/unknown',
    });
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `cd backend && npm run test:e2e`

Expected: FAIL because compat routes/module/helpers do not exist (or import errors).

- [ ] **Step 5: Run it to verify it passes**

Run:

```bash
cd backend
npm run test:e2e
npm run build
```

Expected: all compat e2e tests pass; build passes. Review the diff. Do not commit.

### Task 7: Normalized list, catalog, genre/country, and search endpoints

**Files:**
- Create: `backend/src/movies/movies.service.ts`
- Create: `backend/src/movies/movies.controller.ts`
- Create: `backend/src/movies/catalog.controller.ts`
- Create: `backend/src/movies/search.controller.ts`
- Create: `backend/src/movies/movies.module.ts`
- Create: `backend/test/normalized-list.e2e-spec.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `PhimApiService`, mappers, DTOs.
- Produces: `MoviesService.getNew`, `getCatalog`, `getGenre`, `getCountry`, `search`; routes:
  - `GET /api/v1/movies/new`
  - `GET /api/v1/movies?type=&page=`
  - `GET /api/v1/genres/:slug/movies`
  - `GET /api/v1/countries/:slug/movies`
  - `GET /api/v1/search?q=&page=`

- [ ] **Step 1: Write the failing normalized e2e test**

`backend/test/normalized-list.e2e-spec.ts`:

```ts
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { startUpstreamStub, type UpstreamStub } from './upstream-stub';
import { createTestApp } from './create-test-app';

describe('Normalized list API', () => {
  let app: INestApplication;
  let stub: UpstreamStub;

  beforeAll(async () => {
    stub = await startUpstreamStub();
    process.env.NODE_ENV = 'test';
    process.env.PHIMAPI_BASE_URL = stub.baseUrl;
    process.env.SWAGGER_ENABLED = 'false';
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await stub.close();
    delete process.env.PHIMAPI_BASE_URL;
    delete process.env.SWAGGER_ENABLED;
  });

  it('returns normalized new movies with pagination', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/movies/new?page=1')
      .expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      name: 'Phim Test',
      slug: 'phim-test',
      year: 2026,
      category: [{ name: 'Hành Động', slug: 'hanh-dong' }],
    });
    expect(response.body.pagination).toEqual({
      page: 1,
      totalPages: 1,
      totalItems: 1,
      totalItemsPerPage: 24,
    });
    expect(response.body).not.toHaveProperty('data');
    expect(response.headers['x-cache']).toBe('MISS');
  });

  it('returns a catalog title and items', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/movies?type=phim-le&page=1')
      .expect(200);

    expect(response.body.title).toBe('Phim Lẻ');
    expect(response.body.items[0].slug).toBe('phim-test');
    expect(response.body.pagination.page).toBe(1);
  });

  it('supports genre and country lists', async () => {
    const genreResponse = await request(app.getHttpServer())
      .get('/api/v1/genres/hanh-dong/movies?page=1')
      .expect(200);
    const countryResponse = await request(app.getHttpServer())
      .get('/api/v1/countries/viet-nam/movies?page=1')
      .expect(200);

    expect(genreResponse.body.items[0].slug).toBe('phim-test');
    expect(countryResponse.body.items[0].slug).toBe('phim-test');
  });

  it('trims search q and returns items', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/search?q=%20avatar%20&page=1')
      .expect(200);

    expect(response.body.items[0].slug).toBe('phim-test');
    expect(response.body.pagination.totalItems).toBe(1);
  });

  it('uses cache on the second identical list request', async () => {
    const path = '/api/v1/movies?type=phim-le&page=2';
    const first = await request(app.getHttpServer()).get(path).expect(200);
    const second = await request(app.getHttpServer()).get(path).expect(200);

    expect(first.headers['x-cache']).toBe('MISS');
    expect(second.headers['x-cache']).toBe('HIT');
  });

  it('shares the raw upstream cache with the compat surface', async () => {
    const page = '9';
    const compat = await request(app.getHttpServer())
      .get(`/api/compat/danh-sach/phim-moi-cap-nhat?page=${page}`)
      .expect(200);
    const normalized = await request(app.getHttpServer())
      .get(`/api/v1/movies/new?page=${page}`)
      .expect(200);

    expect(compat.headers['x-cache']).toBe('MISS');
    expect(normalized.headers['x-cache']).toBe('HIT');
  });

  it('rejects invalid type, page, and search query', async () => {
    await request(app.getHttpServer()).get('/api/v1/movies?type=unknown').expect(400);
    await request(app.getHttpServer()).get('/api/v1/movies/new?page=5001').expect(400);
    await request(app.getHttpServer()).get('/api/v1/search?q=').expect(400);
  });

  it('returns 502 when the upstream list says status:false', async () => {
    const failing = await startUpstreamStub((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ status: false, msg: 'maintenance' }));
    });
    const previousBaseUrl = process.env.PHIMAPI_BASE_URL;
    process.env.PHIMAPI_BASE_URL = failing.baseUrl;
    const failingApp = await createTestApp();
    try {
      const response = await request(failingApp.getHttpServer())
        .get('/api/v1/movies/new?page=1')
        .expect(502);
      expect(response.body.message).toBe('Upstream unavailable');
    } finally {
      await failingApp.close();
      await failing.close();
      process.env.PHIMAPI_BASE_URL = previousBaseUrl;
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npm run test:e2e -- normalized-list`

Expected: FAIL because routes do not exist (404).

- [ ] **Step 3: Implement the service**

`backend/src/movies/movies.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CacheStatus } from '../cache/cache.interface';
import { ttlFor } from '../common/config/ttl';
import { PhimApiService } from '../upstream/phimapi.service';
import { UpstreamError } from '../upstream/upstream.errors';
import type { UpstreamListResponse } from '../upstream/upstream.types';
import type { MovieListDto } from './dto/movie.dto';
import { mapListResponse } from './mappers/movie.mapper';

export interface MovieListResult {
  result: MovieListDto;
  cache: CacheStatus;
}

function ensureListResponse(raw: UpstreamListResponse): void {
  if (!raw || typeof raw !== 'object' || raw.status === false) {
    throw new UpstreamError('BAD_RESPONSE', 'Upstream returned an invalid list payload');
  }
}

@Injectable()
export class MoviesService {
  constructor(
    private readonly api: PhimApiService,
    private readonly config: ConfigService
  ) {}

  async getNew(page: number): Promise<MovieListResult> {
    const raw = await this.api.get<UpstreamListResponse>(
      '/danh-sach/phim-moi-cap-nhat',
      { page },
      ttlFor(this.config, 'new')
    );
    ensureListResponse(raw.value);
    return { result: mapListResponse(raw.value), cache: raw.cache };
  }

  async getCatalog(type: string, page: number): Promise<MovieListResult> {
    const raw = await this.api.get<UpstreamListResponse>(
      `/v1/api/danh-sach/${type}`,
      { page },
      ttlFor(this.config, 'list')
    );
    ensureListResponse(raw.value);
    return { result: mapListResponse(raw.value), cache: raw.cache };
  }

  async getGenre(slug: string, page: number): Promise<MovieListResult> {
    const raw = await this.api.get<UpstreamListResponse>(
      `/v1/api/the-loai/${slug}`,
      { page },
      ttlFor(this.config, 'list')
    );
    ensureListResponse(raw.value);
    return { result: mapListResponse(raw.value), cache: raw.cache };
  }

  async getCountry(slug: string, page: number): Promise<MovieListResult> {
    const raw = await this.api.get<UpstreamListResponse>(
      `/v1/api/quoc-gia/${slug}`,
      { page },
      ttlFor(this.config, 'list')
    );
    ensureListResponse(raw.value);
    return { result: mapListResponse(raw.value), cache: raw.cache };
  }

  async search(q: string, page: number): Promise<MovieListResult> {
    const raw = await this.api.get<UpstreamListResponse>(
      '/v1/api/tim-kiem',
      { keyword: q, page },
      ttlFor(this.config, 'search')
    );
    ensureListResponse(raw.value);
    return { result: mapListResponse(raw.value), cache: raw.cache };
  }
}
```

- [ ] **Step 4: Implement controllers and module**

`backend/src/movies/movies.controller.ts`:

```ts
import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CatalogQueryDto } from '../common/dto/catalog-query.dto';
import { PageQueryDto } from '../common/dto/page-query.dto';
import { setCacheHeaders } from '../common/http/cache-headers';
import { MoviesService } from './movies.service';

@Controller('v1/movies')
export class MoviesController {
  constructor(private readonly movies: MoviesService) {}

  @Get('new')
  async getNew(
    @Query() query: PageQueryDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.movies.getNew(query.page);
    setCacheHeaders(response, result.cache, 30);
    return result.result;
  }

  @Get()
  async getCatalog(
    @Query() query: CatalogQueryDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.movies.getCatalog(query.type, query.page);
    setCacheHeaders(response, result.cache, 30);
    return result.result;
  }
}
```

`backend/src/movies/catalog.controller.ts`:

```ts
import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PageQueryDto } from '../common/dto/page-query.dto';
import { SlugParamDto } from '../common/dto/slug-param.dto';
import { setCacheHeaders } from '../common/http/cache-headers';
import { MoviesService } from './movies.service';

@Controller('v1')
export class CatalogController {
  constructor(private readonly movies: MoviesService) {}

  @Get('genres/:slug/movies')
  async genre(
    @Param() params: SlugParamDto,
    @Query() query: PageQueryDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.movies.getGenre(params.slug, query.page);
    setCacheHeaders(response, result.cache, 30);
    return result.result;
  }

  @Get('countries/:slug/movies')
  async country(
    @Param() params: SlugParamDto,
    @Query() query: PageQueryDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.movies.getCountry(params.slug, query.page);
    setCacheHeaders(response, result.cache, 30);
    return result.result;
  }
}
```

`backend/src/movies/search.controller.ts`:

```ts
import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SearchQueryDto } from '../common/dto/search-query.dto';
import { setCacheHeaders } from '../common/http/cache-headers';
import { MoviesService } from './movies.service';

@Controller('v1/search')
export class SearchController {
  constructor(private readonly movies: MoviesService) {}

  @Get()
  async search(
    @Query() query: SearchQueryDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.movies.search(query.q, query.page);
    setCacheHeaders(response, result.cache, 30);
    return result.result;
  }
}
```

`backend/src/movies/movies.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { UpstreamModule } from '../upstream/upstream.module';
import { CatalogController } from './catalog.controller';
import { MoviesController } from './movies.controller';
import { MoviesService } from './movies.service';
import { SearchController } from './search.controller';

@Module({
  imports: [UpstreamModule],
  controllers: [MoviesController, CatalogController, SearchController],
  providers: [MoviesService],
})
export class MoviesModule {}
```

In `backend/src/app.module.ts`, add `MoviesModule` to `imports`.

- [ ] **Step 5: Verify normalized list task**

Run:

```bash
cd backend
npm run test:e2e -- normalized-list
npm run build
```

Expected: all normalized list tests pass; build passes. Review the diff. Do not commit.

### Task 8: Normalized movie detail endpoint

**Files:**
- Modify: `backend/src/movies/movies.service.ts`
- Modify: `backend/src/movies/movies.controller.ts`
- Modify: `backend/test/upstream-stub.ts`
- Create: `backend/test/normalized-detail.e2e-spec.ts`

**Interfaces:**
- Consumes: `PhimApiService`, `mapMovieDetail`, `SlugParamDto`.
- Produces: `MoviesService.getDetail(slug): Promise<MovieDetailResult>` and `GET /api/v1/movies/:slug`.

- [ ] **Step 1: Write the failing detail e2e test**

`backend/test/normalized-detail.e2e-spec.ts`:

```ts
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { startUpstreamStub, type UpstreamStub } from './upstream-stub';
import { createTestApp } from './create-test-app';

describe('Normalized detail API', () => {
  let app: INestApplication;
  let stub: UpstreamStub;

  beforeAll(async () => {
    stub = await startUpstreamStub();
    process.env.NODE_ENV = 'test';
    process.env.PHIMAPI_BASE_URL = stub.baseUrl;
    process.env.SWAGGER_ENABLED = 'false';
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await stub.close();
    delete process.env.PHIMAPI_BASE_URL;
    delete process.env.SWAGGER_ENABLED;
  });

  it('returns a normalized movie with episodes', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/movies/phim-test')
      .expect(200);

    expect(response.body.movie).toMatchObject({
      name: 'Phim Test',
      slug: 'phim-test',
      content: '<p>Nội dung phim</p>',
      type: 'movie',
      episode_total: 'Full',
      view: 42,
      actor: ['Diễn viên A'],
      director: ['Đạo diễn B'],
    });
    expect(response.body.movie.episodes).toEqual([
      {
        server_name: 'Vietsub',
        server_data: [
          {
            name: 'Full',
            slug: 'full',
            filename: 'phim-test.mp4',
            link_embed: 'https://embed.test/1',
            link_m3u8: 'https://stream.test/1.m3u8',
          },
        ],
      },
    ]);
    expect(response.headers['x-cache']).toBe('MISS');
  });

  it('returns a cache hit for a repeated detail request', async () => {
    const path = '/api/v1/movies/phim-test';
    const first = await request(app.getHttpServer()).get(path).expect(200);
    const second = await request(app.getHttpServer()).get(path).expect(200);

    expect(first.headers['x-cache']).toBe('MISS');
    expect(second.headers['x-cache']).toBe('HIT');
  });

  it('keeps the static /movies/new route reachable', async () => {
    await request(app.getHttpServer()).get('/api/v1/movies/new?page=1').expect(200);
  });

  it('returns 400 for an unsafe slug', async () => {
    await request(app.getHttpServer()).get('/api/v1/movies/Ten%20Phim').expect(400);
  });

  it('returns 404 when upstream says the movie is missing', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/movies/missing')
      .expect(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      message: 'Movie not found',
      path: '/api/v1/movies/missing',
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npm run test:e2e -- normalized-detail`

Expected: FAIL because `/api/v1/movies/:slug` does not exist.

- [ ] **Step 3: Add the detail service method**

In `backend/src/movies/movies.service.ts`, add imports:

```ts
import type { MovieDetailResultDto } from './dto/movie.dto';
import { mapMovieDetail } from './mappers/movie.mapper';
import type { UpstreamDetailResponse } from '../upstream/upstream.types';
```

Add interface and method:

```ts
export interface MovieDetailResult {
  result: MovieDetailResultDto;
  cache: CacheStatus;
}

async getDetail(slug: string): Promise<MovieDetailResult> {
  const raw = await this.api.get<UpstreamDetailResponse>(
    `/phim/${slug}`,
    {},
    ttlFor(this.config, 'detail')
  );
  const movie = mapMovieDetail(raw.value);
  if (!movie) {
    throw new UpstreamError('NOT_FOUND', 'Movie not found');
  }
  return { result: { movie }, cache: raw.cache };
}
```

- [ ] **Step 4: Add the detail controller route after the static routes**

In `backend/src/movies/movies.controller.ts`, add imports:

```ts
import { Param } from '@nestjs/common';
import { SlugParamDto } from '../common/dto/slug-param.dto';
```

Add this method **after** `getCatalog`:

```ts
@Get(':slug')
async getDetail(
  @Param() params: SlugParamDto,
  @Res({ passthrough: true }) response: Response
) {
  const result = await this.movies.getDetail(params.slug);
  setCacheHeaders(response, result.cache, 60);
  return result.result;
}
```

The final method order in `MoviesController` must be: `getNew`, `getCatalog`, `getDetail`.

- [ ] **Step 5: Make the stub return 404 for the missing slug**

In `backend/test/upstream-stub.ts`, inside `defaultStubHandler`, add before the generic `/phim/` branch:

```ts
if (path === '/phim/missing') return sendJson(response, 404, { status: false, msg: 'not found' });
```

- [ ] **Step 6: Verify detail task**

Run:

```bash
cd backend
npm run test:e2e -- normalized-detail
npm run test:e2e
npm run build
```

Expected: all detail tests and all e2e tests pass; build passes. Review the diff. Do not commit.

### Task 9: CORS, Helmet, compression, rate limiting, Swagger, and deployment setup

**Files:**
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/app.setup.ts`
- Modify: `backend/src/movies/search.controller.ts`
- Create: `backend/test/security.e2e-spec.ts`

**Interfaces:**
- Consumes: `ConfigService` keys `cors.origins`, `rateLimit.*`, `trustProxy`, `swagger.enabled`.
- Produces: configured CORS/security middleware, global throttling, Swagger at `/api/docs`.

- [ ] **Step 1: Write the failing security e2e tests**

`backend/test/security.e2e-spec.ts`:

```ts
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { startUpstreamStub, type UpstreamStub } from './upstream-stub';
import { createTestApp } from './create-test-app';

describe('Security and operations API', () => {
  let app: INestApplication;
  let stub: UpstreamStub;

  beforeAll(async () => {
    stub = await startUpstreamStub();
    process.env.NODE_ENV = 'test';
    process.env.PHIMAPI_BASE_URL = stub.baseUrl;
    process.env.SWAGGER_ENABLED = 'true';
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await stub.close();
    delete process.env.PHIMAPI_BASE_URL;
    delete process.env.SWAGGER_ENABLED;
  });

  it('allows the configured frontend origin', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', 'http://localhost:5173')
      .expect(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('answers a CORS preflight', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/health')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('does not allow an unknown origin', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', 'http://evil.test');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('exposes X-Cache for debugging', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/movies/new?page=1')
      .set('Origin', 'http://localhost:5173')
      .expect(200);
    expect(response.headers['access-control-expose-headers']).toContain('X-Cache');
  });

  it('serves Swagger when enabled', async () => {
    await request(app.getHttpServer()).get('/api/docs').expect(200);
  });

  it('returns 502 for a persistent upstream failure', async () => {
    const failing = await startUpstreamStub((_request, response) => {
      response.writeHead(500, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'boom' }));
    });
    process.env.PHIMAPI_BASE_URL = failing.baseUrl;
    process.env.UPSTREAM_RETRIES = '0';
    const failingApp = await createTestApp();
    try {
      const response = await request(failingApp.getHttpServer())
        .get('/api/v1/movies/new?page=1')
        .expect(502);
      expect(response.body).toMatchObject({
        statusCode: 502,
        message: 'Upstream unavailable',
      });
    } finally {
      await failingApp.close();
      await failing.close();
      delete process.env.UPSTREAM_RETRIES;
      process.env.PHIMAPI_BASE_URL = stub.baseUrl;
    }
  });

  it('rate limits after the configured number of requests', async () => {
    const previousLimit = process.env.RATE_LIMIT_LIMIT;
    process.env.RATE_LIMIT_LIMIT = '2';
    const limitedApp = await createTestApp();
    try {
      await request(limitedApp.getHttpServer()).get('/api/health').expect(200);
      await request(limitedApp.getHttpServer()).get('/api/health').expect(200);
      await request(limitedApp.getHttpServer()).get('/api/health').expect(429);
    } finally {
      await limitedApp.close();
      if (previousLimit === undefined) delete process.env.RATE_LIMIT_LIMIT;
      else process.env.RATE_LIMIT_LIMIT = previousLimit;
    }
  });

  it('returns 504 when the upstream exceeds its timeout budget', async () => {
    const slow = await startUpstreamStub((_request, response) => {
      setTimeout(() => {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ status: true, items: [] }));
      }, 300);
    });
    process.env.PHIMAPI_BASE_URL = slow.baseUrl;
    process.env.UPSTREAM_TIMEOUT_MS = '100';
    process.env.UPSTREAM_TOTAL_TIMEOUT_MS = '500';
    process.env.UPSTREAM_RETRIES = '0';
    const slowApp = await createTestApp();
    try {
      await request(slowApp.getHttpServer())
        .get('/api/v1/movies/new?page=1')
        .expect(504);
    } finally {
      await slowApp.close();
      await slow.close();
      delete process.env.UPSTREAM_TIMEOUT_MS;
      delete process.env.UPSTREAM_TOTAL_TIMEOUT_MS;
      delete process.env.UPSTREAM_RETRIES;
      process.env.PHIMAPI_BASE_URL = stub.baseUrl;
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npm run test:e2e -- security`

Expected: FAIL because CORS/Swagger/throttling are not configured.

- [ ] **Step 3: Add throttling to the app module**

In `backend/src/app.module.ts`, add imports:

```ts
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
```

Add to `imports`:

```ts
ThrottlerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => [
    {
      ttl: config.getOrThrow<number>('rateLimit.ttlMs'),
      limit: config.getOrThrow<number>('rateLimit.limit'),
    },
  ],
}),
```

Add to the module metadata:

```ts
providers: [
  {
    provide: APP_GUARD,
    useClass: ThrottlerGuard,
  },
],
```

- [ ] **Step 4: Configure Express middleware, CORS, trust proxy, and Swagger**

Replace `backend/src/app.setup.ts` with:

```ts
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  const express = app.getHttpAdapter().getInstance() as {
    set: (key: string, value: unknown) => void;
  };

  app.setGlobalPrefix('api');
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
  app.use(compression());
  app.enableCors({
    origin: config.getOrThrow<string[]>('cors.origins'),
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    exposedHeaders: ['X-Cache'],
    maxAge: 86400,
  });
  express.set('trust proxy', config.getOrThrow<boolean>('trustProxy') ? 1 : false);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    })
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  if (config.getOrThrow<boolean>('swagger.enabled')) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('CineHub API')
      .setDescription('PhimAPI proxy, cache, and normalized movie API')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  app.enableShutdownHooks();
}
```

- [ ] **Step 5: Add a narrower search throttle**

In `backend/src/movies/search.controller.ts`, import:

```ts
import { Throttle } from '@nestjs/throttler';
```

Add above the `search` method:

```ts
@Throttle({ default: { limit: 60, ttl: 60000 } })
```

- [ ] **Step 6: Run it to verify it passes**

Run:

```bash
cd backend
npm run test:e2e -- security
npm run test:e2e
npm run build
```

Expected: security tests pass; all e2e tests pass; build passes. If the rate-limit test sees shared throttler state from the first app, increase the test limit to a unique IP or use a separate app and assert the third request only; the global `ThrottlerGuard` is per-app and the second app has its own storage. Review the diff. Do not commit.

### Task 10: Docker, API handoff docs, CI, and final verification

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`
- Create: `backend/README.md`
- Create: `docs/backend-api.md`
- Modify: `README.md`
- Modify: `docs/coordination.md`
- Modify: `.github/workflows/verify.yml`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: all backend routes and envs.
- Produces: runnable Docker image, integration contract for anty, backend CI job.

- [ ] **Step 1: Add Docker files**

`backend/.dockerignore`:

```text
node_modules
dist
coverage
test
.env
*.log
```

Add to the root `.gitignore`:

```text
# Backend local env and coverage
backend/.env
backend/coverage
```

`backend/Dockerfile`:

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1
CMD ["node", "dist/main.js"]
```

- [ ] **Step 2: Document backend operations**

`backend/README.md`:

```markdown
# CineHub Backend

NestJS proxy/cache/normalized API for CineHub.

## Requirements

- Node.js 22+
- npm

## Run local

```bash
cd backend
npm ci
cp .env.example .env
npm run start:dev
```

API: `http://localhost:3001/api/health`  
Swagger: `http://localhost:3001/api/docs`

## Scripts

```bash
npm run build
npm run start:dev
npm run lint
npm test
npm run test:e2e
```

All tests use a local upstream stub; they never call PhimAPI.

## Docker

```bash
docker build -t cinehub-backend .
docker run --rm -p 3001:3001 --env-file .env cinehub-backend
```

## Cache

In-memory TTL + LRU, 500 entries by default. Restart clears it. Replace
`CacheStore` with Redis later if multiple instances are needed.

## Scope

Phase 1 is proxy/cache/normalized API only. No auth, DB, comments, admin, or
HLS/iframe proxying.
```

- [ ] **Step 3: Write the contract for anty**

`docs/backend-api.md`:

```markdown
# CineHub Backend API — Handoff

## Run

```bash
cd backend
npm ci
npm run start:dev
```

Base URL: `http://localhost:3001/api`

## Compat integration (anty)

The frontend already supports `VITE_API_BASE_URL` with a PhimAPI fallback. Set:

```dotenv
VITE_API_BASE_URL=http://localhost:3001/api/compat
```

For an older checkout without the env support, change only the base constant to
`http://localhost:3001/api/compat`. Do not change any other API path.

Existing paths are unchanged:

| Frontend call | Backend path |
|---|---|
| Phim mới | `/api/compat/danh-sach/phim-moi-cap-nhat?page=1` |
| Catalog | `/api/compat/v1/api/danh-sach/phim-le?page=1` |
| Genre | `/api/compat/v1/api/the-loai/hanh-dong?page=1` |
| Country | `/api/compat/v1/api/quoc-gia/viet-nam?page=1` |
| Search | `/api/compat/v1/api/tim-kiem?keyword=avatar&page=1` |
| Detail | `/api/compat/phim/phim-test` |

Compat responses are the raw PhimAPI JSON. No wrapper, no renamed fields.
CORS defaults to `http://localhost:5173` and `http://localhost:4173`; set
`CORS_ORIGINS` for other origins.

## Normalized API

| Method | Path |
|---|---|
| GET | `/api/v1/movies/new?page=1` |
| GET | `/api/v1/movies?type=phim-le&page=1` |
| GET | `/api/v1/movies/:slug` |
| GET | `/api/v1/genres/:slug/movies?page=1` |
| GET | `/api/v1/countries/:slug/movies?page=1` |
| GET | `/api/v1/search?q=avatar&page=1` |

List response:

```json
{
  "items": [],
  "title": "Phim Lẻ",
  "pagination": {
    "page": 1,
    "totalPages": 717,
    "totalItems": 17193,
    "totalItemsPerPage": 24
  }
}
```

Detail response:

```json
{
  "movie": {
    "name": "Tên phim",
    "slug": "ten-phim",
    "episodes": []
  }
}
```

`type`: `phim-le | phim-bo | hoat-hinh | tv-shows`.  
`q`/`keyword`: 1–100 characters after trim.  
`page`: 1–5000.

## Errors

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "page must be between 1 and 5000",
  "path": "/api/v1/movies"
}
```

- 400: invalid query/path
- 404: movie not found
- 502: upstream invalid/unavailable
- 503: upstream rate limit
- 504: upstream timeout

Do not proxy HLS/iframe through the backend. Keep the current player and
stream URLs unchanged.

## Cache

- `X-Cache: HIT | MISS` is exposed for debugging.
- Cache TTL: new 2m, list 4m, search 1m, detail 6m.
- `status:false`, errors, and malformed responses are never cached.

## Integration checklist

1. Start backend on port 3001.
2. Point `BASE_URL` to `http://localhost:3001/api/compat`.
3. Verify home, catalog, genre, country, search, detail, and watch.
4. Confirm CORS for the actual frontend origin.
5. Migrate to `/api/v1` only after compat passes.
```

- [ ] **Step 4: Add root README and coordination notes**

In root `README.md`, add a backend section after the frontend scripts section:

```markdown
## Backend (phase 1)

Backend NestJS nằm trong `backend/`, cung cấp proxy/cache PhimAPI và API chuẩn hóa.

```bash
cd backend
npm ci
npm run start:dev
```

- Health: `http://localhost:3001/api/health`
- Swagger: `http://localhost:3001/api/docs`
- Frontend compat base: `http://localhost:3001/api/compat`
- Contract cho frontend: `docs/backend-api.md`

Backend không proxy HLS/iframe; player vẫn dùng URL stream trực tiếp.
```

`docs/coordination.md` already has a `## Phối hợp Frontend ↔ Backend` section written by anty. Do not replace it. Add a `### Backend implementation` subsection beneath it:

```markdown
### Backend implementation

- Backend NestJS nằm trong `backend/`; không sửa frontend trong đợt này.
- Compat: `/api/compat/*` giữ nguyên path/JSON PhimAPI; anty đặt `VITE_API_BASE_URL=http://localhost:3001/api/compat`.
- Normalized: `/api/v1/*`; contract đầy đủ tại `docs/backend-api.md`.
- Cache in-memory TTL + LRU, single-flight; chưa có auth/DB/Redis.
- Trạng thái: chờ xác nhận 6 luồng compat (home, catalog, genre, country, search, detail/watch).
```

- [ ] **Step 5: Add the backend CI job**

In `.github/workflows/verify.yml`, add a second job after the existing `verify` job:

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

- [ ] **Step 6: Verify the backend end-to-end**

Run:

```bash
cd backend
npm ci
npm test
npm run test:e2e
npm run lint
npm run build
```

Expected: all unit/e2e tests pass, lint passes, build passes.

Run a local smoke test:

```bash
npm run start:dev
curl http://localhost:3001/api/health
curl "http://localhost:3001/api/compat/danh-sach/phim-moi-cap-nhat?page=1"
```

Expected: health returns `status:ok`; compat returns raw PhimAPI JSON. Stop the
process after checking.

Run the root documentation/security guards:

```bash
cd ..
npm run check:mojibake
```

If Docker is available:

```bash
docker build -t cinehub-backend backend
```

- [ ] **Step 7: Verify frontend was not changed**

Run:

```bash
git status --short
git diff -- src public index.html vite.config.ts package.json
```

Expected: anty's frontend changes may already be present in the working tree
(for example `VITE_API_BASE_URL`, CSP, SW routing, and tests). Do **not** revert
them. Confirm that the backend work only touched `backend/`, root docs/README,
`.gitignore`, and the CI workflow; do not edit or stage frontend files as part of
this task. Review the backend diff. Do not commit unless the user asks.

