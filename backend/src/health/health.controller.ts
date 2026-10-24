import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CACHE_STORE, type CacheStore } from '../cache/cache.interface';
import { HealthDto } from '../common/dto/api-response.dto';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(CACHE_STORE) private readonly cache: CacheStore) {}

  @Get()
  @ApiOperation({ summary: 'Liveness and cache stats' })
  @ApiOkResponse({ type: HealthDto })
  getHealth() {
    return {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      cache: this.cache.getStats(),
    };
  }
}
