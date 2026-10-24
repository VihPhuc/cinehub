export interface UpstreamPagination {
  totalItems?: number;
  totalItemsPerPage?: number;
  currentPage?: number;
  totalPages?: number;
}

export interface UpstreamNamedItem {
  id?: string;
  name?: string;
  slug?: string;
}

export interface UpstreamTmdb {
  id?: string | number | null;
  type?: string | null;
  season?: number | null;
  vote_average?: number;
  vote_count?: number;
}

export interface UpstreamMovie {
  _id?: string;
  name?: string;
  slug?: string;
  origin_name?: string;
  thumb_url?: string;
  poster_url?: string;
  year?: number;
  time?: string;
  episode_current?: string;
  quality?: string;
  lang?: string;
  chieurap?: boolean;
  modified?: { time?: string } | string;
  tmdb?: UpstreamTmdb;
  category?: UpstreamNamedItem[];
  country?: UpstreamNamedItem[];
  content?: string;
  type?: string;
  status?: string;
  trailer_url?: string;
  episode_total?: string | number;
  view?: number;
  actor?: string[];
  director?: string[];
}

export interface UpstreamEpisode {
  name?: string;
  slug?: string;
  filename?: string;
  link_embed?: string;
  link_m3u8?: string;
}

export interface UpstreamServer {
  server_name?: string;
  server_data?: UpstreamEpisode[];
}

export interface UpstreamListResponse {
  status?: boolean;
  msg?: string;
  items?: UpstreamMovie[];
  pagination?: UpstreamPagination;
  data?: {
    titlePage?: string;
    items?: UpstreamMovie[];
    params?: { pagination?: UpstreamPagination };
  };
}

export interface UpstreamDetailResponse {
  status?: boolean;
  msg?: string;
  movie?: UpstreamMovie;
  episodes?: UpstreamServer[];
}
