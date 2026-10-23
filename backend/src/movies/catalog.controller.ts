import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PageQueryDto } from '../common/dto/page-query.dto';
import { SlugParamDto } from '../common/dto/slug-param.dto';
import { setCacheHeaders } from '../common/http/cache-headers';
import { MoviesService } from './movies.service';

@Controller('v1')
export class CatalogController {
  constructor(private readonly movies: MoviesService) {}

  @Get('genres/:slug/movies')
  async genre(
    @Param() params: SlugParamDto,
    @Query() query: PageQueryDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.movies.getGenre(params.slug, query.page);
    setCacheHeaders(response, result.cache, 30);
    return result.result;
  }

  @Get('countries/:slug/movies')
  async country(
    @Param() params: SlugParamDto,
    @Query() query: PageQueryDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.movies.getCountry(params.slug, query.page);
    setCacheHeaders(response, result.cache, 30);
    return result.result;
  }
}
