import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { PhimApiClient, UPSTREAM_FETCH } from './phimapi.client';
import { PhimApiService } from './phimapi.service';

@Module({
  imports: [CacheModule],
  providers: [
    PhimApiClient,
    PhimApiService,
    { provide: UPSTREAM_FETCH, useValue: fetch },
  ],
  exports: [PhimApiClient, PhimApiService],
})
export class UpstreamModule {}
