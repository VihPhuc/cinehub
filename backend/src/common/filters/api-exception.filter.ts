import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { UpstreamError } from '../../upstream/upstream.errors';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof UpstreamError) {
      const mapped = this.mapUpstream(exception);
      status = mapped.status;
      message = mapped.message;
      error = mapped.error;
      if (exception.retryAfterSeconds !== undefined) {
        response.setHeader('Retry-After', String(exception.retryAfterSeconds));
      }
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const record = body as { message?: unknown; error?: unknown };
        message = Array.isArray(record.message)
          ? record.message.join('; ')
          : String(record.message ?? exception.message);
        error = String(record.error ?? exception.name);
      }
    } else {
      this.logger.error(
        'Unhandled exception',
        exception instanceof Error ? exception.stack : undefined
      );
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      path: request.originalUrl,
    });
  }

  private mapUpstream(exception: UpstreamError): {
    status: number;
    message: string;
    error: string;
  } {
    switch (exception.code) {
      case 'NOT_FOUND':
        return { status: 404, message: 'Movie not found', error: 'Not Found' };
      case 'TIMEOUT':
        return { status: 504, message: 'Upstream timeout', error: 'Gateway Timeout' };
      case 'RATE_LIMIT':
        return { status: 503, message: 'Upstream rate limit', error: 'Service Unavailable' };
      case 'BAD_RESPONSE':
      case 'UNAVAILABLE':
      default:
        return { status: 502, message: 'Upstream unavailable', error: 'Bad Gateway' };
    }
  }
}
