import type { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PhimApiClient } from '../upstream/phimapi.client';
import { CatalogIndexerService } from './catalog-indexer.service';
import type { CatalogIndexSnapshot } from './catalog-index.types';

function configWith(path: string, concurrency = 2): ConfigService {
  return {
    getOrThrow: (key: string) => {
      if (key === 'catalogIndex.path') return path;
      if (key === 'catalogIndex.concurrency') return concurrency;
      throw new Error(`unexpected key ${key}`);
    },
  } as unknown as ConfigService;
}

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

function page(items: unknown[], totalPages = 1, currentPage = 1) {
  return {
    status: true,
    data: {
      items,
      params: {
        pagination: {
          currentPage,
          totalPages,
          totalItems: items.length,
          totalItemsPerPage: 24,
        },
      },
    },
  };
}

function createClient(): { client: PhimApiClient; getJson: jest.Mock } {
  const getJson = jest.fn(async (path: string, query: { page?: number }) => {
    if (path === '/v1/api/danh-sach/phim-le') {
      return query.page === 1 ? page([movieA], 2, 1) : page([movieB], 2, 2);
    }
    if (path === '/v1/api/danh-sach/phim-bo') {
      return page([movieB, movieC]);
    }
    return page([]);
  });
  return { client: { getJson } as unknown as PhimApiClient, getJson };
}

async function readSnapshot(path: string): Promise<CatalogIndexSnapshot> {
  return JSON.parse(await readFile(path, 'utf8')) as CatalogIndexSnapshot;
}

describe('CatalogIndexerService', () => {
  let dir: string;
  let path: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'cinehub-indexer-'));
  });

  beforeEach(async () => {
    path = join(dir, `catalog-${Date.now()}-${Math.random()}.json`);
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('crawls every page, dedupes slugs, and merges catalog types', async () => {
    const { client, getJson } = createClient();
    const service = new CatalogIndexerService(client, configWith(path));

    const result = await service.refresh();
    const snapshot = await readSnapshot(path);

    expect(result.totalItems).toBe(3);
    expect(result.pagesFetched).toBe(5);
    expect(result.path).toBe(path);
    expect(snapshot.version).toBe(1);
    expect(snapshot.totalItems).toBe(3);
    expect(Number.isFinite(Date.parse(snapshot.generatedAt))).toBe(true);
    expect(snapshot.entries.map((entry) => entry.movie.slug)).toEqual([
      'phim-a',
      'phim-b',
      'phim-c',
    ]);
    expect(snapshot.entries.find((entry) => entry.movie.slug === 'phim-b')?.types).toEqual([
      'phim-le',
      'phim-bo',
    ]);
    expect(snapshot.entries.find((entry) => entry.movie.slug === 'phim-a')?.search).toBe(
      'an trua lunch'
    );
    expect(snapshot.entries.find((entry) => entry.movie.slug === 'phim-b')?.search).toBe(
      'ba gio three hours'
    );

    expect(getJson).toHaveBeenCalledWith('/v1/api/danh-sach/phim-le', { page: 1 });
    expect(getJson).toHaveBeenCalledWith('/v1/api/danh-sach/phim-le', { page: 2 });
    expect(getJson).toHaveBeenCalledWith('/v1/api/danh-sach/phim-bo', { page: 1 });
    expect(getJson).toHaveBeenCalledWith('/v1/api/danh-sach/hoat-hinh', { page: 1 });
    expect(getJson).toHaveBeenCalledWith('/v1/api/danh-sach/tv-shows', { page: 1 });
  });

  it('keeps the previous snapshot when any page fails', async () => {
    const oldContent = '{"old":true}';
    await writeFile(path, oldContent);
    const getJson = jest.fn(async (requestPath: string, query: { page?: number }) => {
      if (requestPath === '/v1/api/danh-sach/phim-le' && query.page === 2) {
        throw new Error('upstream failed');
      }
      return requestPath === '/v1/api/danh-sach/phim-le'
        ? page([movieA], 2, 1)
        : page([]);
    });
    const service = new CatalogIndexerService(
      { getJson } as unknown as PhimApiClient,
      configWith(path)
    );

    await expect(service.refresh()).rejects.toThrow('upstream failed');
    expect(await readFile(path, 'utf8')).toBe(oldContent);
  });

  it('rejects an empty crawl and keeps the previous snapshot', async () => {
    const oldContent = '{"old":true}';
    await writeFile(path, oldContent);
    const getJson = jest.fn(async () => page([]));
    const service = new CatalogIndexerService(
      { getJson } as unknown as PhimApiClient,
      configWith(path)
    );

    await expect(service.refresh()).rejects.toThrow('no movies');
    expect(await readFile(path, 'utf8')).toBe(oldContent);
  });

  it('rejects an invalid first page and keeps the previous snapshot', async () => {
    const oldContent = '{"old":true}';
    await writeFile(path, oldContent);
    const getJson = jest.fn(async () => ({ status: false }));
    const service = new CatalogIndexerService(
      { getJson } as unknown as PhimApiClient,
      configWith(path)
    );

    await expect(service.refresh()).rejects.toThrow('invalid list payload');
    expect(await readFile(path, 'utf8')).toBe(oldContent);
  });
});
