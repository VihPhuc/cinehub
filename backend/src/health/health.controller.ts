import { Controller, Get, Inject } from '@nestjs/common';
import { CACHE_STORE, type CacheStore } from '../cache/cache.interface';

@Controller('health')
export class HealthController {
  constructor(@Inject(CACHE_STORE) private readonly cache: CacheStore) {}

  @Get()
  getHealth() {
    return {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      cache: this.cache.getStats(),
    };
  }
}
