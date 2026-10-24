import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CatalogQueryDto, CATALOG_TYPES } from '../common/dto/catalog-query.dto';
import { ApiErrorDto } from '../common/dto/api-response.dto';
import { PageQueryDto } from '../common/dto/page-query.dto';
import { SlugParamDto } from '../common/dto/slug-param.dto';
import { MOVIE_SORTS } from '../common/dto/sortable-page-query.dto';
import { ApiCommonErrors } from '../common/http/api-error-responses';
import { setCacheHeaders } from '../common/http/cache-headers';
import { MovieDetailResultDto, MovieListDto } from './dto/movie.dto';
import { MoviesService } from './movies.service';

@ApiTags('movies')
@Controller('v1/movies')
export class MoviesController {
  constructor(private readonly movies: MoviesService) {}

  @Get('new')
  @ApiOperation({ summary: 'Get the newest updated movies' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiOkResponse({ type: MovieListDto })
  @ApiCommonErrors()
  async getNew(
    @Query() query: PageQueryDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.movies.getNew(query.page);
    setCacheHeaders(response, result.cache, 30);
    return result.result;
  }

  @Get()
  @ApiOperation({ summary: 'Get a movie catalog by type' })
  @ApiQuery({ name: 'type', required: true, enum: CATALOG_TYPES })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'sort', required: false, enum: MOVIE_SORTS, example: 'updated' })
  @ApiOkResponse({ type: MovieListDto })
  @ApiCommonErrors()
  async getCatalog(
    @Query() query: CatalogQueryDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.movies.getCatalog(query.type, query.page, query.sort);
    setCacheHeaders(response, result.cache, 30);
    return result.result;
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a normalized movie detail' })
  @ApiParam({ name: 'slug', example: 'phim-test' })
  @ApiOkResponse({ type: MovieDetailResultDto })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'Movie not found' })
  @ApiCommonErrors()
  async getDetail(
    @Param() params: SlugParamDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.movies.getDetail(params.slug);
    setCacheHeaders(response, result.cache, 60);
    return result.result;
  }
}
