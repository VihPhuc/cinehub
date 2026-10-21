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
    expect(response.body.cache).toEqual({
      size: 0,
      hits: 0,
      misses: 0,
      inFlight: 0,
    });
  });

  it('returns the common error shape for an unknown route', async () => {
    const response = await request(app.getHttpServer()).get('/api/does-not-exist').expect(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      path: '/api/does-not-exist',
    });
  });
});
