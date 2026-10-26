import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from './cache/cache.module';
import { CatalogIndexModule } from './catalog-index/catalog-index.module';
import { CompatModule } from './compat/compat.module';
import configuration from './common/config/configuration';
import { GlobalThrottlerGuard } from './common/guards/global-throttler.guard';
import { envValidationSchema } from './common/config/env.validation';
import { HealthModule } from './health/health.module';
import { MoviesModule } from './movies/movies.module';
import { UpstreamModule } from './upstream/upstream.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.getOrThrow<number>('rateLimit.ttlMs'),
          limit: config.getOrThrow<number>('rateLimit.limit'),
        },
      ],
    }),
    CacheModule,
    UpstreamModule,
    CompatModule,
    MoviesModule,
    CatalogIndexModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: GlobalThrottlerGuard,
    },
  ],
})
export class AppModule {}
