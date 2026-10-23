import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SearchQueryDto } from '../common/dto/search-query.dto';
import { setCacheHeaders } from '../common/http/cache-headers';
import { MoviesService } from './movies.service';

@Controller('v1/search')
export class SearchController {
  constructor(private readonly movies: MoviesService) {}

  @Get()
  async search(
    @Query() query: SearchQueryDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.movies.search(query.q, query.page);
    setCacheHeaders(response, result.cache, 30);
    return result.result;
  }
}
