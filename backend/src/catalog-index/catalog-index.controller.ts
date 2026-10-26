import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CATALOG_TYPES } from '../common/dto/catalog-query.dto';
import {
  CHIEURAP_VALUES,
  DISCOVER_LANGUAGES,
  DISCOVER_SORTS,
  DiscoverQueryDto,
} from '../common/dto/discover-query.dto';
import { MOVIE_ORDERS } from '../common/dto/sortable-page-query.dto';
import { ApiCommonErrors } from '../common/http/api-error-responses';
import { setCacheHeaders } from '../common/http/cache-headers';
import { CatalogIndexService } from './catalog-index.service';
import { DiscoverResponseDto } from './dto/discover.dto';

@ApiTags('discover')
@Controller('v1')
export class CatalogIndexController {
  constructor(private readonly index: CatalogIndexService) {}

  @Get('discover')
  @ApiOperation({
    summary: 'Discover and sort the whole catalog index',
    description:
      'Sorts and filters the full catalog snapshot. Facets depend only on `type`. ' +
      'Returns 503 until `npm run index:refresh` has built the snapshot.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'sort', required: false, enum: DISCOVER_SORTS, example: 'updated' })
  @ApiQuery({ name: 'order', required: false, enum: MOVIE_ORDERS, example: 'desc' })
  @ApiQuery({ name: 'type', required: false, enum: CATALOG_TYPES, example: 'phim-le' })
  @ApiQuery({ name: 'year', required: false, type: Number, example: 2024 })
  @ApiQuery({ name: 'category', required: false, type: String, example: 'hanh-dong' })
  @ApiQuery({ name: 'country', required: false, type: String, example: 'viet-nam' })
  @ApiQuery({
    name: 'rating',
    required: false,
    type: Number,
    example: 7.5,
    description: 'Minimum TMDB rating; `0` disables the filter.',
  })
  @ApiQuery({ name: 'language', required: false, enum: DISCOVER_LANGUAGES, example: 'vietsub' })
  @ApiQuery({ name: 'chieurap', required: false, enum: CHIEURAP_VALUES, example: 'true' })
  @ApiQuery({ name: 'q', required: false, type: String, example: 'avenger' })
  @ApiOkResponse({ type: DiscoverResponseDto })
  @ApiCommonErrors()
  discover(
    @Query() query: DiscoverQueryDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = this.index.query(query);
    setCacheHeaders(response, 'HIT', 60);
    return result;
  }
}
