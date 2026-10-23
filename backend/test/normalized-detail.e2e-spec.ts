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
    const path = '/api/v1/movies/cache-test';
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
