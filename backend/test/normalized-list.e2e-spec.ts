import type { INestApplication } from '@nestjs/common';
import type { ServerResponse } from 'node:http';
import request from 'supertest';
import {
  movieFixture,
  newUpdatedFixture,
  startUpstreamStub,
  type UpstreamStub,
} from './upstream-stub';
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
      updatedAt: '2026-10-24T15:56:02.000Z',
      category: [{ name: 'Hành Động', slug: 'hanh-dong' }],
    });
    expect(response.body.items[0]).not.toHaveProperty('modified');
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
    expect(response.body.items[0].updatedAt).toBe('2026-10-24T15:56:02.000Z');
    expect(response.body.items[0]).not.toHaveProperty('modified');
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
    expect(genreResponse.body.items[0].updatedAt).toBe('2026-10-24T15:56:02.000Z');
    expect(countryResponse.body.items[0].slug).toBe('phim-test');
    expect(countryResponse.body.items[0].updatedAt).toBe('2026-10-24T15:56:02.000Z');
  });

  it('trims search q and returns items', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/search?q=%20avatar%20&page=1')
      .expect(200);

    expect(response.body.items[0].slug).toBe('phim-test');
    expect(response.body.items[0].updatedAt).toBe('2026-10-24T15:56:02.000Z');
    expect(response.body.pagination.totalItems).toBe(1);
    expect(response.body).not.toHaveProperty('title');
  });

  it('requests catalog, genre, and country lists sorted by modified time descending', async () => {
    const before = stub.requests.length;
    await request(app.getHttpServer())
      .get('/api/v1/movies?type=phim-le&page=3')
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/genres/hanh-dong/movies?page=3')
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/countries/viet-nam/movies?page=3')
      .expect(200);

    const urls = stub.requests.slice(before);
    for (const path of [
      '/v1/api/danh-sach/phim-le',
      '/v1/api/the-loai/hanh-dong',
      '/v1/api/quoc-gia/viet-nam',
    ]) {
      const url = urls.find((entry) => entry.startsWith(path));
      expect(url).toBeDefined();
      expect(url).toContain('sort_field=modified.time');
      expect(url).toContain('sort_type=desc');
    }
  });

  it('supports sort=year and rejects unsupported sort values', async () => {
    const before = stub.requests.length;
    await request(app.getHttpServer())
      .get('/api/v1/movies?type=phim-le&page=4&sort=year')
      .expect(200);
    const url = stub.requests
      .slice(before)
      .find((entry) => entry.startsWith('/v1/api/danh-sach/phim-le'));

    expect(url).toBeDefined();
    expect(url).toContain('sort_field=year');
    expect(url).toContain('sort_type=desc');

    await request(app.getHttpServer())
      .get('/api/v1/movies?type=phim-le&page=4&sort=rating')
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/genres/hanh-dong/movies?sort=rating')
      .expect(400);
  });

  it('sorts by updatedAt and year while preserving search relevance order', async () => {
    const older = {
      ...movieFixture,
      name: 'Older',
      slug: 'older',
      year: 2024,
      modified: { time: '2026-10-24T10:00:00.000Z' },
    };
    const newer = {
      ...movieFixture,
      name: 'Newer',
      slug: 'newer',
      year: 2020,
      modified: { time: '2026-10-24T15:00:00.000Z' },
    };
    const pagination = {
      currentPage: 1,
      totalPages: 1,
      totalItems: 2,
      totalItemsPerPage: 24,
    };
    const send = (response: ServerResponse, body: unknown) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(body));
    };
    const ordered = await startUpstreamStub((upstreamRequest, response) => {
      const path = (upstreamRequest.url ?? '').split('?')[0];
      if (path === '/danh-sach/phim-moi-cap-nhat') {
        send(response, { status: true, items: [older, newer], pagination });
        return;
      }
      if (path === '/v1/api/danh-sach/phim-le') {
        send(response, {
          status: true,
          data: { titlePage: 'Phim Lẻ', items: [older, newer], params: { pagination } },
        });
        return;
      }
      if (path === '/v1/api/tim-kiem') {
        send(response, {
          status: true,
          data: { items: [older, newer], params: { pagination } },
        });
        return;
      }
      send(response, { status: false });
    });

    const previousBaseUrl = process.env.PHIMAPI_BASE_URL;
    process.env.PHIMAPI_BASE_URL = ordered.baseUrl;
    const orderedApp = await createTestApp();
    try {
      const newResponse = await request(orderedApp.getHttpServer())
        .get('/api/v1/movies/new?page=1')
        .expect(200);
      const catalogResponse = await request(orderedApp.getHttpServer())
        .get('/api/v1/movies?type=phim-le&page=1')
        .expect(200);
      const yearResponse = await request(orderedApp.getHttpServer())
        .get('/api/v1/movies?type=phim-le&page=1&sort=year')
        .expect(200);
      const searchResponse = await request(orderedApp.getHttpServer())
        .get('/api/v1/search?q=order-test&page=1')
        .expect(200);

      expect(newResponse.body.items.map((item: { slug: string }) => item.slug)).toEqual([
        'newer',
        'older',
      ]);
      expect(catalogResponse.body.items.map((item: { slug: string }) => item.slug)).toEqual([
        'newer',
        'older',
      ]);
      expect(yearResponse.body.items.map((item: { slug: string }) => item.slug)).toEqual([
        'older',
        'newer',
      ]);
      expect(searchResponse.body.items.map((item: { slug: string }) => item.slug)).toEqual([
        'older',
        'newer',
      ]);
    } finally {
      await orderedApp.close();
      await ordered.close();
      process.env.PHIMAPI_BASE_URL = previousBaseUrl;
    }
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

  it('does not cache a malformed list and recovers after the upstream is fixed', async () => {
    let malformed = true;
    const flaky = await startUpstreamStub((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify(malformed ? { status: true, items: 'oops' } : newUpdatedFixture)
      );
    });
    const previousBaseUrl = process.env.PHIMAPI_BASE_URL;
    process.env.PHIMAPI_BASE_URL = flaky.baseUrl;
    const flakyApp = await createTestApp();
    try {
      await request(flakyApp.getHttpServer()).get('/api/v1/movies/new?page=1').expect(502);

      malformed = false;
      const recovered = await request(flakyApp.getHttpServer())
        .get('/api/v1/movies/new?page=1')
        .expect(200);
      expect(recovered.body.items).toHaveLength(1);
      expect(flaky.requests).toHaveLength(2);
    } finally {
      await flakyApp.close();
      await flaky.close();
      process.env.PHIMAPI_BASE_URL = previousBaseUrl;
    }
  });
});
