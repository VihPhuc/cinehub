import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from './cache/cache.module';
import configuration from './common/config/configuration';
import { envValidationSchema } from './common/config/env.validation';
import { HealthModule } from './health/health.module';
import { UpstreamModule } from './upstream/upstream.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    CacheModule,
    UpstreamModule,
    HealthModule,
  ],
})
export class AppModule {}
