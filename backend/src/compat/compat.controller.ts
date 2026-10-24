import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ttlFor } from '../common/config/ttl';
import { KeywordQueryDto } from '../common/dto/keyword-query.dto';
import { PageQueryDto } from '../common/dto/page-query.dto';
import { SlugParamDto } from '../common/dto/slug-param.dto';
import { TypeParamDto } from '../common/dto/type-param.dto';
import { setCacheHeaders, setNoStoreHeaders } from '../common/http/cache-headers';
import { PhimApiService } from '../upstream/phimapi.service';
import type {
  UpstreamDetailResponse,
  UpstreamListResponse,
} from '../upstream/upstream.types';
import { isCacheableUpstreamPayload } from '../upstream/upstream.validation';

function setCompatCacheHeaders(
  response: Response,
  path: string,
  cache: 'HIT' | 'MISS',
  value: unknown,
  maxAgeSeconds: number,
  staleWhileRevalidate = true
): void {
  if (!isCacheableUpstreamPayload(path, value)) {
    setNoStoreHeaders(response, cache);
    return;
  }
  setCacheHeaders(response, cache, maxAgeSeconds, staleWhileRevalidate);
}

@Controller('compat')
export class CompatController {
  constructor(
    private readonly api: PhimApiService,
    private readonly config: ConfigService
  ) {}

  @Get('danh-sach/phim-moi-cap-nhat')
  async newUpdated(
    @Query() query: PageQueryDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<UpstreamListResponse> {
    const result = await this.api.get<UpstreamListResponse>(
      '/danh-sach/phim-moi-cap-nhat',
      { page: query.page },
      ttlFor(this.config, 'new')
    );
    setCompatCacheHeaders(
      response,
      '/danh-sach/phim-moi-cap-nhat',
      result.cache,
      result.value,
      30
    );
    return result.value;
  }

  @Get('v1/api/danh-sach/:type')
  async catalog(
    @Param() params: TypeParamDto,
    @Query() query: PageQueryDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<UpstreamListResponse> {
    const result = await this.api.get<UpstreamListResponse>(
      `/v1/api/danh-sach/${params.type}`,
      { page: query.page },
      ttlFor(this.config, 'list')
    );
    setCompatCacheHeaders(
      response,
      `/v1/api/danh-sach/${params.type}`,
      result.cache,
      result.value,
      30
    );
    return result.value;
  }

  @Get('v1/api/the-loai/:slug')
  async genre(
    @Param() params: SlugParamDto,
    @Query() query: PageQueryDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<UpstreamListResponse> {
    const result = await this.api.get<UpstreamListResponse>(
      `/v1/api/the-loai/${params.slug}`,
      { page: query.page },
      ttlFor(this.config, 'list')
    );
    setCompatCacheHeaders(
      response,
      `/v1/api/the-loai/${params.slug}`,
      result.cache,
      result.value,
      30
    );
    return result.value;
  }

  @Get('v1/api/quoc-gia/:slug')
  async country(
    @Param() params: SlugParamDto,
    @Query() query: PageQueryDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<UpstreamListResponse> {
    const result = await this.api.get<UpstreamListResponse>(
      `/v1/api/quoc-gia/${params.slug}`,
      { page: query.page },
      ttlFor(this.config, 'list')
    );
    setCompatCacheHeaders(
      response,
      `/v1/api/quoc-gia/${params.slug}`,
      result.cache,
      result.value,
      30
    );
    return result.value;
  }

  @Get('v1/api/tim-kiem')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async search(
    @Query() query: KeywordQueryDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<UpstreamListResponse> {
    const result = await this.api.get<UpstreamListResponse>(
      '/v1/api/tim-kiem',
      { keyword: query.keyword, page: query.page },
      ttlFor(this.config, 'search')
    );
    setCompatCacheHeaders(response, '/v1/api/tim-kiem', result.cache, result.value, 30);
    return result.value;
  }

  @Get('phim/:slug')
  async detail(
    @Param() params: SlugParamDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<UpstreamDetailResponse> {
    const result = await this.api.get<UpstreamDetailResponse>(
      `/phim/${params.slug}`,
      {},
      ttlFor(this.config, 'detail')
    );
    setCompatCacheHeaders(
      response,
      `/phim/${params.slug}`,
      result.cache,
      result.value,
      60,
      false
    );
    return result.value;
  }
}
