import type { INestApplication } from '@nestjs/common';
import { rm } from 'node:fs/promises';
import request from 'supertest';
import type { CatalogIndexSnapshot } from '../src/catalog-index/catalog-index.types';
import { writeCatalogIndexFixture } from './catalog-index-fixture';
import { createTestApp } from './create-test-app';

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

function slugs(response: request.Response): string[] {
  return (response.body.items as { slug: string }[]).map((item) => item.slug);
}

describe('Discover API', () => {
  let app: INestApplication;
  let dir: string;
  let path: string;
  const previousIndexPath = process.env.CATALOG_INDEX_PATH;

  beforeAll(async () => {
    const fixture = await writeCatalogIndexFixture(snapshot);
    dir = fixture.dir;
    path = fixture.path;
    process.env.NODE_ENV = 'test';
    process.env.SWAGGER_ENABLED = 'false';
    process.env.CATALOG_INDEX_PATH = path;
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await rm(dir, { recursive: true, force: true });
    if (previousIndexPath === undefined) delete process.env.CATALOG_INDEX_PATH;
    else process.env.CATALOG_INDEX_PATH = previousIndexPath;
    delete process.env.SWAGGER_ENABLED;
  });

  it('returns catalog-wide items, pagination, facets, and cache headers', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/discover')
      .expect(200);

    expect(slugs(response)).toEqual(['an-trua', 'ba-gio', 'cu', 'dune', 'missing']);
    expect(response.body.pagination).toEqual({
      page: 1,
      totalPages: 1,
      totalItems: 5,
      totalItemsPerPage: 24,
    });
    expect(response.body.facets).toMatchObject({
      totalItems: 5,
      generatedAt: '2026-10-26T04:00:00.000Z',
    });
    expect(response.body.facets.years).toEqual([
      { value: 2024, count: 1 },
      { value: 2021, count: 1 },
      { value: 2020, count: 1 },
      { value: 1999, count: 1 },
    ]);
    expect(response.body.facets.languages).toEqual([
      { value: 'vietsub', label: 'Vietsub', count: 2 },
      { value: 'thuyet-minh', label: 'Thuyết Minh', count: 1 },
      { value: 'long-tieng', label: 'Lồng Tiếng', count: 1 },
    ]);
    expect(response.headers['x-cache']).toBe('HIT');
    expect(response.headers['cache-control']).toContain('max-age=60');
  });

  it('applies combined sort and filters across the whole catalog', async () => {
    const response = await request(app.getHttpServer())
      .get(
        '/api/v1/discover?sort=rating&order=desc&rating=7.5&language=vietsub&category=hanh-dong&country=viet-nam&year=2024&q=an'
      )
      .expect(200);

    expect(slugs(response)).toEqual(['an-trua']);
  });

  it('sorts Vietnamese names and filters by type', async () => {
    const byName = await request(app.getHttpServer())
      .get('/api/v1/discover?sort=name&order=asc')
      .expect(200);
    expect(slugs(byName)).toEqual(['an-trua', 'ba-gio', 'cu', 'dune', 'missing']);

    const series = await request(app.getHttpServer())
      .get('/api/v1/discover?type=phim-bo')
      .expect(200);
    expect(slugs(series)).toEqual(['ba-gio', 'cu']);
    expect(series.body.facets.totalItems).toBe(2);
    expect(series.body.facets.years).toEqual([
      { value: 2020, count: 1 },
      { value: 1999, count: 1 },
    ]);
  });

  it('returns a safe empty page', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/discover?page=2')
      .expect(200);
    expect(response.body.items).toEqual([]);
    expect(response.body.pagination).toMatchObject({ page: 2, totalPages: 1, totalItems: 5 });
  });

  it('rejects unsupported discover query values', async () => {
    const cases = [
      'sort=view',
      'order=sideways',
      'rating=11',
      'language=engsub',
      'chieurap=maybe',
      'year=1800',
      'category=..%2Fsecret',
      'q=%20%20',
    ];
    for (const query of cases) {
      await request(app.getHttpServer()).get(`/api/v1/discover?${query}`).expect(400);
    }
  });

  it('returns 503 when the catalog index is missing', async () => {
    process.env.CATALOG_INDEX_PATH = `${path}.missing`;
    const missingApp = await createTestApp();
    try {
      const response = await request(missingApp.getHttpServer())
        .get('/api/v1/discover')
        .expect(503);
      expect(response.body).toMatchObject({
        statusCode: 503,
        error: 'Service Unavailable',
      });
      expect(response.body.message).toContain('index:refresh');
    } finally {
      await missingApp.close();
      process.env.CATALOG_INDEX_PATH = path;
    }
  });
});
