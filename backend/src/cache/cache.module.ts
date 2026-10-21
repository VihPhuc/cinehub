import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CACHE_STORE } from './cache.interface';
import { MemoryCacheService } from './memory-cache.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: CACHE_STORE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new MemoryCacheService(config.getOrThrow<number>('cache.maxEntries')),
    },
  ],
  exports: [CACHE_STORE],
})
export class CacheModule {}
