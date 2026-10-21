export interface MovieNamedDto {
  id?: string;
  name: string;
  slug: string;
}

export interface MovieTmdbDto {
  id?: string | number | null;
  type?: string | null;
  season?: number | null;
  vote_average?: number;
  vote_count?: number;
}

export interface MovieSummaryDto {
  _id?: string;
  name: string;
  slug: string;
  origin_name?: string;
  thumb_url?: string;
  poster_url?: string;
  year?: number;
  time?: string;
  episode_current?: string;
  quality?: string;
  lang?: string;
  chieurap?: boolean;
  tmdb?: MovieTmdbDto;
  category?: MovieNamedDto[];
  country?: MovieNamedDto[];
}

export interface EpisodeDto {
  name: string;
  slug: string;
  filename?: string;
  link_embed: string;
  link_m3u8: string;
}

export interface EpisodeServerDto {
  server_name: string;
  server_data: EpisodeDto[];
}

export interface MovieDetailDto extends MovieSummaryDto {
  content?: string;
  type?: string;
  status?: string;
  trailer_url?: string;
  episode_total?: string | number;
  view?: number;
  actor?: string[];
  director?: string[];
  episodes?: EpisodeServerDto[];
}

export interface PaginationDto {
  page: number;
  totalPages: number;
  totalItems: number;
  totalItemsPerPage: number;
}

export interface MovieListDto {
  items: MovieSummaryDto[];
  title?: string;
  pagination: PaginationDto;
}

export interface MovieDetailResultDto {
  movie: MovieDetailDto;
}
