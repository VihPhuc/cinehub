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
