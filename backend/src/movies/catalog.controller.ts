import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { MovieListQueryDto } from '../common/dto/movie-list-query.dto';
import { SlugParamDto } from '../common/dto/slug-param.dto';
import { MOVIE_ORDERS, MOVIE_SORTS } from '../common/dto/sortable-page-query.dto';
import { ApiCommonErrors } from '../common/http/api-error-responses';
import { setCacheHeaders } from '../common/http/cache-headers';
import { MovieListDto } from './dto/movie.dto';
import { MoviesService } from './movies.service';

@ApiTags('catalog')
@Controller('v1')
export class CatalogController {
  constructor(private readonly movies: MoviesService) {}

  @Get('genres/:slug/movies')
  @ApiOperation({ summary: 'Get movies in a genre' })
  @ApiParam({ name: 'slug', example: 'hanh-dong' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'sort', required: false, enum: MOVIE_SORTS, example: 'updated' })
  @ApiQuery({ name: 'order', required: false, enum: MOVIE_ORDERS, example: 'desc' })
  @ApiQuery({ name: 'year', required: false, type: Number, example: 2024 })
  @ApiQuery({ name: 'category', required: false, type: String, example: 'hanh-dong' })
  @ApiQuery({ name: 'country', required: false, type: String, example: 'viet-nam' })
  @ApiOkResponse({ type: MovieListDto })
  @ApiCommonErrors()
  async genre(
    @Param() params: SlugParamDto,
    @Query() query: MovieListQueryDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.movies.getGenre(params.slug, query);
    setCacheHeaders(response, result.cache, 30);
    return result.result;
  }

  @Get('countries/:slug/movies')
  @ApiOperation({ summary: 'Get movies in a country' })
  @ApiParam({ name: 'slug', example: 'viet-nam' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'sort', required: false, enum: MOVIE_SORTS, example: 'updated' })
  @ApiQuery({ name: 'order', required: false, enum: MOVIE_ORDERS, example: 'desc' })
  @ApiQuery({ name: 'year', required: false, type: Number, example: 2024 })
  @ApiQuery({ name: 'category', required: false, type: String, example: 'hanh-dong' })
  @ApiQuery({ name: 'country', required: false, type: String, example: 'viet-nam' })
  @ApiOkResponse({ type: MovieListDto })
  @ApiCommonErrors()
  async country(
    @Param() params: SlugParamDto,
    @Query() query: MovieListQueryDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.movies.getCountry(params.slug, query);
    setCacheHeaders(response, result.cache, 30);
    return result.result;
  }
}
