import type {
  UpstreamDetailResponse,
  UpstreamListResponse,
  UpstreamMovie,
  UpstreamNamedItem,
  UpstreamPagination,
  UpstreamServer,
} from '../../upstream/upstream.types';
import type {
  EpisodeServerDto,
  MovieDetailDto,
  MovieListDto,
  MovieNamedDto,
  MovieSummaryDto,
  PaginationDto,
} from '../dto/movie.dto';

function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function numeric(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function httpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? value : undefined;
  } catch {
    return undefined;
  }
}

function namedItems(value: unknown): MovieNamedDto[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((item): item is UpstreamNamedItem => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      ...(text(item.id) ? { id: text(item.id) } : {}),
      name: text(item.name) ?? '',
      slug: text(item.slug) ?? '',
    }))
    .filter((item) => item.name.length > 0 || item.slug.length > 0);
  return items.length > 0 ? items : undefined;
}

function mapEpisodes(raw: unknown): EpisodeServerDto[] {
  if (!Array.isArray(raw)) return [];

  const servers: EpisodeServerDto[] = [];
  for (const server of raw as UpstreamServer[]) {
    if (!server || typeof server !== 'object' || !Array.isArray(server.server_data)) continue;
    const episodes = server.server_data
      .filter((episode) => episode && typeof episode === 'object')
      .map((episode) => {
        const link_embed = httpUrl(episode.link_embed) ?? '';
        const link_m3u8 = httpUrl(episode.link_m3u8) ?? '';
        return {
          name: text(episode.name) ?? '',
          slug: text(episode.slug) ?? '',
          ...(text(episode.filename) ? { filename: text(episode.filename) } : {}),
          link_embed,
          link_m3u8,
        };
      })
      .filter((episode) => episode.link_embed.length > 0 || episode.link_m3u8.length > 0);

    if (episodes.length > 0) {
      servers.push({
        server_name: text(server.server_name) ?? '',
        server_data: episodes,
      });
    }
  }
  return servers;
}

export function mapMovieSummary(raw: UpstreamMovie): MovieSummaryDto {
  const result: MovieSummaryDto = {
    name: text(raw.name) ?? '',
    slug: text(raw.slug) ?? '',
  };

  if (text(raw._id)) result._id = text(raw._id);
  if (text(raw.origin_name)) result.origin_name = text(raw.origin_name);
  if (text(raw.thumb_url)) result.thumb_url = text(raw.thumb_url);
  if (text(raw.poster_url)) result.poster_url = text(raw.poster_url);
  if (numeric(raw.year) !== undefined) result.year = numeric(raw.year);
  if (text(raw.time)) result.time = text(raw.time);
  if (text(raw.episode_current)) result.episode_current = text(raw.episode_current);
  if (text(raw.quality)) result.quality = text(raw.quality);
  if (text(raw.lang)) result.lang = text(raw.lang);
  if (typeof raw.chieurap === 'boolean') result.chieurap = raw.chieurap;

  if (raw.tmdb && typeof raw.tmdb === 'object') {
    result.tmdb = {
      ...(raw.tmdb.id !== undefined ? { id: raw.tmdb.id } : {}),
      ...(text(raw.tmdb.type) ? { type: text(raw.tmdb.type) } : {}),
      ...(numeric(raw.tmdb.season) !== undefined ? { season: numeric(raw.tmdb.season) } : {}),
      ...(numeric(raw.tmdb.vote_average) !== undefined
        ? { vote_average: numeric(raw.tmdb.vote_average) }
        : {}),
      ...(numeric(raw.tmdb.vote_count) !== undefined
        ? { vote_count: numeric(raw.tmdb.vote_count) }
        : {}),
    };
  }

  const category = namedItems(raw.category);
  if (category) result.category = category;
  const country = namedItems(raw.country);
  if (country) result.country = country;
  return result;
}

function mapPagination(raw: UpstreamPagination | undefined): PaginationDto {
  return {
    page: numeric(raw?.currentPage) ?? 1,
    totalPages: numeric(raw?.totalPages) ?? 1,
    totalItems: numeric(raw?.totalItems) ?? 0,
    totalItemsPerPage: numeric(raw?.totalItemsPerPage) ?? 0,
  };
}

export function mapListResponse(raw: UpstreamListResponse): MovieListDto {
  const upstreamPagination = raw.pagination ?? raw.data?.params?.pagination;
  const rawItems = raw.items ?? raw.data?.items ?? [];
  const items = rawItems
    .filter((item): item is UpstreamMovie => Boolean(item) && typeof item === 'object')
    .map(mapMovieSummary);
  const title = text(raw.data?.titlePage);

  return {
    items,
    ...(title ? { title } : {}),
    pagination: mapPagination(upstreamPagination),
  };
}

export function mapMovieDetail(raw: UpstreamDetailResponse): MovieDetailDto | null {
  if (!raw || raw.status === false || !raw.movie) return null;

  const summary = mapMovieSummary(raw.movie);
  const result: MovieDetailDto = {
    ...summary,
    episodes: mapEpisodes(raw.episodes),
  };

  if (text(raw.movie.content)) result.content = text(raw.movie.content);
  if (text(raw.movie.type)) result.type = text(raw.movie.type);
  if (text(raw.movie.status)) result.status = text(raw.movie.status);
  if (text(raw.movie.trailer_url)) result.trailer_url = text(raw.movie.trailer_url);
  if (text(raw.movie.episode_total) || typeof raw.movie.episode_total === 'number') {
    result.episode_total = raw.movie.episode_total;
  }
  if (numeric(raw.movie.view) !== undefined) result.view = numeric(raw.movie.view);
  if (Array.isArray(raw.movie.actor)) {
    result.actor = raw.movie.actor.filter((v) => typeof v === 'string');
  }
  if (Array.isArray(raw.movie.director)) {
    result.director = raw.movie.director.filter((v) => typeof v === 'string');
  }
  return result;
}
