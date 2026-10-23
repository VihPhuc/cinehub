import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  const express = app.getHttpAdapter().getInstance() as {
    set: (key: string, value: unknown) => void;
  };

  app.setGlobalPrefix('api');
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
  app.use(compression());
  app.enableCors({
    origin: config.getOrThrow<string[]>('cors.origins'),
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    exposedHeaders: ['X-Cache'],
    maxAge: 86400,
  });
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
