import type { INestApplication } from '@nestjs/common';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { isLoopbackOrigin } from './common/http/cors-origin';
import { requestLoggingMiddleware } from './common/logging/request-logging.middleware';

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  const express = app.getHttpAdapter().getInstance() as {
    set: (key: string, value: unknown) => void;
  };

  app.setGlobalPrefix('api');
  app.use(
    helmet({
      // This service returns JSON; CSP is disabled to keep Swagger UI usable.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
  app.use(compression());
  app.use(requestLoggingMiddleware);
  const allowedOrigins = config.getOrThrow<string[]>('cors.origins');
  const allowLoopbackOrigins = config.getOrThrow<string>('nodeEnv') !== 'production';
  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      const allowed =
        !origin ||
        allowedOrigins.includes(origin) ||
        (allowLoopbackOrigins && isLoopbackOrigin(origin));
      callback(null, allowed);
    },
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    exposedHeaders: ['X-Cache', 'X-Request-Id'],
    maxAge: 86400,
  };
  app.enableCors(corsOptions);
  express.set('trust proxy', config.getOrThrow<boolean>('trustProxy') ? 1 : false);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    })
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  if (config.getOrThrow<boolean>('swagger.enabled')) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('CineHub API')
      .setDescription('PhimAPI proxy, cache, and normalized movie API')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  app.enableShutdownHooks();
}
