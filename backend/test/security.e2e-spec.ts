import { Logger, type INestApplication } from '@nestjs/common';
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

  it('allows loopback origins used by Vite', async () => {
    for (const origin of [
      'http://127.0.0.1:5173',
      'http://[::1]:5173',
      'http://localhost:5174',
    ]) {
      const response = await request(app.getHttpServer())
        .get('/api/health')
        .set('Origin', origin)
        .expect(200);
      expect(response.headers['access-control-allow-origin']).toBe(origin);
    }
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

  it('logs request metadata without leaking search keywords', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    try {
      const response = await request(app.getHttpServer())
        .get('/api/v1/search?q=secret-keyword&page=1')
        .set('X-Request-Id', 'req-123')
        .expect(200);

      expect(response.headers['x-request-id']).toBe('req-123');
      const line = logSpy.mock.calls
        .map((call) => String(call[0]))
        .find((entry) => entry.includes('method=GET'));
      expect(line).toBeDefined();
      expect(line).toContain('path=/api/v1/search');
      expect(line).toContain('status=200');
      expect(line).toContain('cache=MISS');
      expect(line).toContain('requestId=req-123');
      expect(line).not.toContain('secret-keyword');
    } finally {
      logSpy.mockRestore();
    }
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
      const limited = await request(limitedApp.getHttpServer())
        .get('/api/health')
        .expect(429);
      expect(limited.body).toMatchObject({
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Too Many Requests',
      });
      expect(limited.headers['cache-control']).toBe('no-store');
      expect(limited.headers['retry-after']).toBeDefined();
    } finally {
      await limitedApp.close();
      if (previousLimit === undefined) delete process.env.RATE_LIMIT_LIMIT;
      else process.env.RATE_LIMIT_LIMIT = previousLimit;
    }
  });

  it('shares one rate-limit bucket across routes for the same client', async () => {
    const previousLimit = process.env.RATE_LIMIT_LIMIT;
    process.env.RATE_LIMIT_LIMIT = '2';
    const limitedApp = await createTestApp();
    try {
      await request(limitedApp.getHttpServer()).get('/api/health').expect(200);
      await request(limitedApp.getHttpServer()).get('/api/v1/movies/new?page=1').expect(200);
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
