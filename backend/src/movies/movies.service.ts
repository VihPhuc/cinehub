import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CacheStatus } from '../cache/cache.interface';
import { ttlFor } from '../common/config/ttl';
import type { MovieListQueryDto } from '../common/dto/movie-list-query.dto';
import type { MovieOrder, MovieSort } from '../common/dto/sortable-page-query.dto';
import { PhimApiService } from '../upstream/phimapi.service';
import { UpstreamError } from '../upstream/upstream.errors';
import type {
  UpstreamDetailResponse,
  UpstreamListResponse,
} from '../upstream/upstream.types';
import type { MovieDetailResultDto, MovieListDto } from './dto/movie.dto';
import { mapListResponse, mapMovieDetail } from './mappers/movie.mapper';

export interface MovieListResult {
  result: MovieListDto;
  cache: CacheStatus;
}

export interface MovieDetailResult {
  result: MovieDetailResultDto;
  cache: CacheStatus;
}

function ensureListResponse(raw: UpstreamListResponse): void {
  if (!raw || typeof raw !== 'object' || raw.status === false) {
    throw new UpstreamError('BAD_RESPONSE', 'Upstream returned an invalid list payload');
  }
  const items = Array.isArray(raw.items) ? raw.items : raw.data?.items;
  if (!Array.isArray(items)) {
    throw new UpstreamError('BAD_RESPONSE', 'Upstream returned an invalid list payload');
  }
}

function ensureDetailResponse(raw: UpstreamDetailResponse): void {
  if (!raw || typeof raw !== 'object') {
    throw new UpstreamError('BAD_RESPONSE', 'Upstream returned an invalid detail payload');
  }
  if (raw.status === false) {
    throw new UpstreamError('NOT_FOUND', 'Movie not found');
  }
  if (!raw.movie || typeof raw.movie !== 'object' || Array.isArray(raw.movie)) {
    throw new UpstreamError('BAD_RESPONSE', 'Upstream returned an invalid detail payload');
  }
}

function sortByField<T>(
  items: T[],
  valueOf: (item: T) => number | undefined,
  order: MovieOrder
): T[] {
  const direction = order === 'asc' ? 1 : -1;
  return items
    .map((item, index) => {
      const value = valueOf(item);
      return { item, index, value: Number.isFinite(value) ? value : undefined };
    })
    .sort((left, right) => {
      if (left.value === undefined || right.value === undefined) {
        if (left.value === undefined && right.value === undefined) {
          return left.index - right.index;
        }
        return left.value === undefined ? 1 : -1;
      }
      if (left.value !== right.value) return (left.value - right.value) * direction;
      return left.index - right.index;
    })
    .map(({ item }) => item);
}

function sortListResult(
  result: MovieListDto,
  sort: MovieSort = 'updated',
  order: MovieOrder = 'desc'
): MovieListDto {
  const items =
    sort === 'year'
      ? sortByField(result.items, (item) => item.year, order)
      : sortByField(
          result.items,
          (item) => {
            const timestamp = Date.parse(item.updatedAt ?? '');
            return Number.isFinite(timestamp) ? timestamp : undefined;
          },
          order
        );
  return { ...result, items };
}

const UPSTREAM_SORT_FIELDS: Record<MovieSort, string> = {
  updated: 'modified.time',
  year: 'year',
};

function upstreamSortQuery(
  sort: MovieSort,
  order: MovieOrder
): { sort_field: string; sort_type: MovieOrder } {
  return { sort_field: UPSTREAM_SORT_FIELDS[sort], sort_type: order };
}

function upstreamFilters(query: MovieListQueryDto): Record<string, string | number> {
  const filters: Record<string, string | number> = {};
  if (query.year !== undefined) filters.year = query.year;
  if (query.category) filters.category = query.category;
  if (query.country) filters.country = query.country;
  return filters;
}

@Injectable()
export class MoviesService {
  constructor(
    private readonly api: PhimApiService,
    private readonly config: ConfigService
  ) {}

  async getNew(page: number): Promise<MovieListResult> {
    const raw = await this.api.get<UpstreamListResponse>(
      '/danh-sach/phim-moi-cap-nhat',
      { page },
      ttlFor(this.config, 'new')
    );
    ensureListResponse(raw.value);
    return {
      result: sortListResult(mapListResponse(raw.value, { includeTitle: false })),
      cache: raw.cache,
    };
  }

  async getCatalog(type: string, query: MovieListQueryDto): Promise<MovieListResult> {
    return this.getMovieList(`/v1/api/danh-sach/${type}`, query);
  }

  async getGenre(slug: string, query: MovieListQueryDto): Promise<MovieListResult> {
    return this.getMovieList(`/v1/api/the-loai/${slug}`, query);
  }

  async getCountry(slug: string, query: MovieListQueryDto): Promise<MovieListResult> {
    return this.getMovieList(`/v1/api/quoc-gia/${slug}`, query);
  }

  private async getMovieList(
    path: string,
    query: MovieListQueryDto
  ): Promise<MovieListResult> {
    const raw = await this.api.get<UpstreamListResponse>(
      path,
      {
        page: query.page,
        ...upstreamSortQuery(query.sort, query.order),
        ...upstreamFilters(query),
      },
      ttlFor(this.config, 'list')
    );
    ensureListResponse(raw.value);
    return {
      result: sortListResult(mapListResponse(raw.value), query.sort, query.order),
      cache: raw.cache,
    };
  }

  async search(q: string, page: number): Promise<MovieListResult> {
    const raw = await this.api.get<UpstreamListResponse>(
      '/v1/api/tim-kiem',
      { keyword: q, page },
      ttlFor(this.config, 'search')
    );
    ensureListResponse(raw.value);
    return {
      result: mapListResponse(raw.value, { includeTitle: false }),
      cache: raw.cache,
    };
  }

  async getDetail(slug: string): Promise<MovieDetailResult> {
    const raw = await this.api.get<UpstreamDetailResponse>(
      `/phim/${slug}`,
      {},
      ttlFor(this.config, 'detail')
    );
    ensureDetailResponse(raw.value);
    const movie = mapMovieDetail(raw.value);
    if (!movie) {
      throw new UpstreamError('NOT_FOUND', 'Movie not found');
    }
    return { result: { movie }, cache: raw.cache };
  }
}
