import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CacheStatus } from '../cache/cache.interface';
import { ttlFor } from '../common/config/ttl';
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
      result: mapListResponse(raw.value, { includeTitle: false }),
      cache: raw.cache,
    };
  }

  async getCatalog(type: string, page: number): Promise<MovieListResult> {
    const raw = await this.api.get<UpstreamListResponse>(
      `/v1/api/danh-sach/${type}`,
      { page },
      ttlFor(this.config, 'list')
    );
    ensureListResponse(raw.value);
    return { result: mapListResponse(raw.value), cache: raw.cache };
  }

  async getGenre(slug: string, page: number): Promise<MovieListResult> {
    const raw = await this.api.get<UpstreamListResponse>(
      `/v1/api/the-loai/${slug}`,
      { page },
      ttlFor(this.config, 'list')
    );
    ensureListResponse(raw.value);
    return { result: mapListResponse(raw.value), cache: raw.cache };
  }

  async getCountry(slug: string, page: number): Promise<MovieListResult> {
    const raw = await this.api.get<UpstreamListResponse>(
      `/v1/api/quoc-gia/${slug}`,
      { page },
      ttlFor(this.config, 'list')
    );
    ensureListResponse(raw.value);
    return { result: mapListResponse(raw.value), cache: raw.cache };
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
