import { Controller, Get, Query, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { SearchQueryDto } from '../common/dto/search-query.dto';
import { ApiCommonErrors } from '../common/http/api-error-responses';
import { setCacheHeaders } from '../common/http/cache-headers';
import { MovieListDto } from './dto/movie.dto';
import { MoviesService } from './movies.service';

@ApiTags('search')
@Controller('v1/search')
export class SearchController {
  constructor(private readonly movies: MoviesService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Search movies' })
  @ApiQuery({ name: 'q', required: true, type: String, example: 'avatar' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiOkResponse({ type: MovieListDto })
  @ApiCommonErrors()
  async search(
    @Query() query: SearchQueryDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.movies.search(query.q, query.page);
    setCacheHeaders(response, result.cache, 30);
    return result.result;
  }
}
