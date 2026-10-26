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
      movie: {
        name: 'Ăn Trưa',
        slug: 'an-trua',
        year: 2024,
        updatedAt: '2026-10-26T03:00:00.000Z',
        tmdb: { vote_average: 8.5, vote_count: 100 },
        lang: 'Vietsub',
        chieurap: true,
        category: [{ slug: 'hanh-dong', name: 'Hành Động' }],
        country: [{ slug: 'viet-nam', name: 'Việt Nam' }],
      },
      types: ['phim-le'],
      search: 'an trua lunch',
    },
    {
      movie: {
        name: 'Ba Giờ',
        slug: 'ba-gio',
        year: 2020,
        updatedAt: '2026-10-26T02:00:00.000Z',
        tmdb: { vote_average: 7, vote_count: 50 },
        lang: 'Thuyết Minh',
        chieurap: false,
        category: [{ slug: 'hanh-dong', name: 'Hành Động' }],
        country: [{ slug: 'viet-nam', name: 'Việt Nam' }],
      },
      types: ['phim-le', 'phim-bo'],
      search: 'ba gio three hours',
    },
    {
      movie: {
        name: 'Cũ',
        slug: 'cu',
        year: 1999,
        updatedAt: '2026-10-25T00:00:00.000Z',
        tmdb: { vote_average: 6, vote_count: 10 },
        lang: 'Lồng Tiếng',
      },
      types: ['phim-bo'],
      search: 'cu old',
    },
    {
      movie: { name: 'Missing', slug: 'missing' },
      types: ['hoat-hinh'],
      search: 'missing',
    },
    {
      movie: {
        name: 'Dune',
        slug: 'dune',
        year: 2021,
        updatedAt: '2026-10-24T00:00:00.000Z',
        tmdb: { vote_average: 9, vote_count: 200 },
        lang: 'Vietsub',
        category: [{ slug: 'vien-tuong', name: 'Viễn Tưởng' }],
        country: [{ slug: 'my', name: 'Mỹ' }],
      },
      types: ['phim-le'],
      search: 'dune',
    },
  ],
};

function slugs(result: { items: { slug: string }[] }): string[] {
  return result.items.map((item) => item.slug);
}

describe('CatalogIndexService', () => {
  let dir: string;
  let path: string;
  let service: CatalogIndexService;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'cinehub-index-service-'));
    path = join(dir, 'catalog-index.json');
    await writeFile(path, JSON.stringify(snapshot));
  });

  beforeEach(async () => {
    service = new CatalogIndexService(configWith(path));
    await service.load();
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('sorts by updated desc and keeps missing timestamps last', () => {
    expect(slugs(service.query({ page: 1, sort: 'updated', order: 'desc' }))).toEqual([
      'an-trua',
      'ba-gio',
      'cu',
      'dune',
      'missing',
    ]);
  });

  it('sorts by updated asc and still keeps missing timestamps last', () => {
    expect(slugs(service.query({ page: 1, sort: 'updated', order: 'asc' }))).toEqual([
      'dune',
      'cu',
      'ba-gio',
      'an-trua',
      'missing',
    ]);
  });

  it('sorts Vietnamese names with locale collation', () => {
    expect(slugs(service.query({ page: 1, sort: 'name', order: 'asc' }))).toEqual([
      'an-trua',
      'ba-gio',
      'cu',
      'dune',
      'missing',
    ]);
  });

  it('sorts by rating and votes with missing values last', () => {
    expect(slugs(service.query({ page: 1, sort: 'rating', order: 'desc' }))).toEqual([
      'dune',
      'an-trua',
      'ba-gio',
      'cu',
      'missing',
    ]);
    expect(slugs(service.query({ page: 1, sort: 'votes', order: 'asc' }))).toEqual([
      'cu',
      'ba-gio',
      'an-trua',
      'dune',
      'missing',
    ]);
  });

  it('filters by year, category, country, and type', () => {
    expect(slugs(service.query({ page: 1, sort: 'updated', order: 'desc', year: 2024 }))).toEqual([
      'an-trua',
    ]);
    expect(
      slugs(
        service.query({
          page: 1,
          sort: 'updated',
          order: 'desc',
          category: 'hanh-dong',
          country: 'viet-nam',
          type: 'phim-le',
        })
      )
    ).toEqual(['an-trua', 'ba-gio']);
    expect(slugs(service.query({ page: 1, sort: 'updated', order: 'desc', type: 'phim-bo' }))).toEqual([
      'ba-gio',
      'cu',
    ]);
  });

  it('filters by minimum rating, language, and chieurap', () => {
    expect(
      slugs(service.query({ page: 1, sort: 'updated', order: 'desc', rating: 7.5 }))
    ).toEqual(['an-trua', 'dune']);
    expect(
      slugs(service.query({ page: 1, sort: 'updated', order: 'desc', rating: 0 }))
    ).toHaveLength(5);
    expect(
      slugs(
        service.query({ page: 1, sort: 'updated', order: 'desc', language: 'thuyet-minh' })
      )
    ).toEqual(['ba-gio']);
    expect(
      slugs(service.query({ page: 1, sort: 'updated', order: 'desc', language: 'long-tieng' }))
    ).toEqual(['cu']);
    expect(
      slugs(service.query({ page: 1, sort: 'updated', order: 'desc', chieurap: 'true' }))
    ).toEqual(['an-trua']);
    expect(
      slugs(service.query({ page: 1, sort: 'updated', order: 'desc', chieurap: 'false' }))
    ).toEqual(['ba-gio']);
  });

  it('searches titles accent-insensitively and case-insensitively', () => {
    expect(slugs(service.query({ page: 1, sort: 'updated', order: 'desc', q: 'AN TRUA' }))).toEqual([
      'an-trua',
    ]);
    expect(slugs(service.query({ page: 1, sort: 'updated', order: 'desc', q: 'cũ' }))).toEqual([
      'cu',
    ]);
    expect(
      slugs(service.query({ page: 1, sort: 'updated', order: 'desc', q: 'thuyet minh' }))
    ).toEqual([]);
  });

  it('paginates and reports a safe empty page', () => {
    const first = service.query({ page: 1, sort: 'updated', order: 'desc' });
    expect(first.pagination).toEqual({
      page: 1,
      totalPages: 1,
      totalItems: 5,
      totalItemsPerPage: 24,
    });
    const second = service.query({ page: 2, sort: 'updated', order: 'desc' });
    expect(second.items).toEqual([]);
    expect(second.pagination).toEqual({
      page: 2,
      totalPages: 1,
      totalItems: 5,
      totalItemsPerPage: 24,
    });
    const none = service.query({ page: 1, sort: 'updated', order: 'desc', q: 'zzz' });
    expect(none.items).toEqual([]);
    expect(none.pagination).toMatchObject({ totalItems: 0, totalPages: 1 });
  });

  it('builds facets for the whole catalog and per type', () => {
    const all = service.query({ page: 1, sort: 'updated', order: 'desc' }).facets;
    expect(all.totalItems).toBe(5);
    expect(all.generatedAt).toBe('2026-10-26T04:00:00.000Z');
    expect(all.years).toEqual([
      { value: 2024, count: 1 },
      { value: 2021, count: 1 },
      { value: 2020, count: 1 },
      { value: 1999, count: 1 },
    ]);
    expect(all.categories).toEqual([
      { slug: 'hanh-dong', name: 'Hành Động', count: 2 },
      { slug: 'vien-tuong', name: 'Viễn Tưởng', count: 1 },
    ]);
    expect(all.countries).toEqual([
      { slug: 'viet-nam', name: 'Việt Nam', count: 2 },
      { slug: 'my', name: 'Mỹ', count: 1 },
    ]);
    expect(all.languages).toEqual([
      { value: 'vietsub', label: 'Vietsub', count: 2 },
      { value: 'thuyet-minh', label: 'Thuyết Minh', count: 1 },
      { value: 'long-tieng', label: 'Lồng Tiếng', count: 1 },
    ]);

    const series = service.query({ page: 1, sort: 'updated', order: 'desc', type: 'phim-bo' }).facets;
    expect(series.totalItems).toBe(2);
    expect(series.years).toEqual([
      { value: 2020, count: 1 },
      { value: 1999, count: 1 },
    ]);
    expect(series.languages).toEqual([
      { value: 'vietsub', label: 'Vietsub', count: 0 },
      { value: 'thuyet-minh', label: 'Thuyết Minh', count: 1 },
      { value: 'long-tieng', label: 'Lồng Tiếng', count: 1 },
    ]);
  });

  it('reports not ready when the snapshot is missing', async () => {
    const missing = new CatalogIndexService(configWith(join(dir, 'missing.json')));
    await missing.load();
    expect(missing.getStatus().ready).toBe(false);
    expect(missing.getStatus().error).toBeDefined();
    expect(() => missing.query({ page: 1, sort: 'updated', order: 'desc' })).toThrow(
      ServiceUnavailableException
    );
  });

  it('reports not ready for corrupt or unsupported snapshots', async () => {
    const corruptPath = join(dir, 'corrupt.json');
    await writeFile(corruptPath, '{');
    const corrupt = new CatalogIndexService(configWith(corruptPath));
    await corrupt.load();
    expect(corrupt.getStatus().ready).toBe(false);

    const oldPath = join(dir, 'old.json');
    await writeFile(oldPath, JSON.stringify({ ...snapshot, version: 2 }));
    const old = new CatalogIndexService(configWith(oldPath));
    await old.load();
    expect(old.getStatus().ready).toBe(false);
  });
});
