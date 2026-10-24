import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');
const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._-]{1,64}$/;

type RoutedRequest = Request & { route?: { path?: string } };

export function requestLoggingMiddleware(
  request: Request,
  response: Response,
  next: NextFunction
): void {
  const startedAt = process.hrtime.bigint();
  const providedId = request.header('x-request-id');
  const requestId =
    providedId && REQUEST_ID_PATTERN.test(providedId) ? providedId : randomUUID();
  response.setHeader('X-Request-Id', requestId);

  response.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const route = (request as RoutedRequest).route?.path ?? request.path;
    const cache = String(response.getHeader('x-cache') ?? '-');
    logger.log(
      `method=${request.method} path=${route} status=${response.statusCode} durationMs=${durationMs.toFixed(1)} cache=${cache} requestId=${requestId}`
    );
  });

  next();
}
