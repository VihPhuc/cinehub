import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { ttlFor } from '../common/config/ttl';
import { KeywordQueryDto } from '../common/dto/keyword-query.dto';
import { PageQueryDto } from '../common/dto/page-query.dto';
import { SlugParamDto } from '../common/dto/slug-param.dto';
import { TypeParamDto } from '../common/dto/type-param.dto';
import { setCacheHeaders } from '../common/http/cache-headers';
import { PhimApiService } from '../upstream/phimapi.service';
import type {
  UpstreamDetailResponse,
  UpstreamListResponse,
} from '../upstream/upstream.types';

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
    setCacheHeaders(response, result.cache, 30);
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
    setCacheHeaders(response, result.cache, 30);
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
    setCacheHeaders(response, result.cache, 30);
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
    setCacheHeaders(response, result.cache, 30);
    return result.value;
  }

  @Get('v1/api/tim-kiem')
  async search(
    @Query() query: KeywordQueryDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<UpstreamListResponse> {
    const result = await this.api.get<UpstreamListResponse>(
      '/v1/api/tim-kiem',
      { keyword: query.keyword, page: query.page },
      ttlFor(this.config, 'search')
    );
    setCacheHeaders(response, result.cache, 30);
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
    setCacheHeaders(response, result.cache, 60, false);
    return result.value;
  }
}
