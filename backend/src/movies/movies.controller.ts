import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CatalogQueryDto } from '../common/dto/catalog-query.dto';
import { PageQueryDto } from '../common/dto/page-query.dto';
import { setCacheHeaders } from '../common/http/cache-headers';
import { MoviesService } from './movies.service';

@Controller('v1/movies')
export class MoviesController {
  constructor(private readonly movies: MoviesService) {}

  @Get('new')
  async getNew(
    @Query() query: PageQueryDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.movies.getNew(query.page);
    setCacheHeaders(response, result.cache, 30);
    return result.result;
  }

  @Get()
  async getCatalog(
    @Query() query: CatalogQueryDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.movies.getCatalog(query.type, query.page);
    setCacheHeaders(response, result.cache, 30);
    return result.result;
  }
}
