import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
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
    expect(response.body).not.toHaveProperty('title');
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
