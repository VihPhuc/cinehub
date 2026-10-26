export interface MovieCategory {
  id?: string;
  name: string;
  slug: string;
}

export interface MovieCountry {
  id?: string;
  name: string;
  slug: string;
}

export interface MovieTMDB {
  id?: string | number | null;
  type?: 'movie' | 'tv' | null;
  season?: number | null;
  vote_average?: number;
  vote_count?: number;
}

export interface MovieItem {
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
  tmdb?: MovieTMDB;
  category?: MovieCategory[];
  country?: MovieCountry[];
  updatedAt?: string;
  modified?: { time?: string };
}

export interface EpisodeItem {
  name: string;
  slug: string;
  filename?: string;
  link_embed: string;
  link_m3u8: string;
}

export interface EpisodeServer {
  server_name: string;
  server_data: EpisodeItem[];
}

export interface MovieDetail extends MovieItem {
  content?: string;
  type?: string;
  status?: string;
  trailer_url?: string;
  episode_total?: string | number;
  view?: number;
  actor?: string[];
  director?: string[];
  episodes?: EpisodeServer[];
}

export interface HistoryItem {
  slug: string;
  name: string;
  origin_name?: string;
  poster_url?: string;
  thumb_url?: string;
  serverName: string;
  episodeSlug: string;
  episodeName: string;
  currentTime: number;
  duration: number;
  updatedAt: number;
}

export interface FavoriteItem {
  slug: string;
  name: string;
  origin_name?: string;
  poster_url?: string;
  thumb_url?: string;
  year?: number;
  quality?: string;
  lang?: string;
  savedAt: number;
}

export interface CustomCollection {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  slugs: string[];
}

interface ApiPagination {
  totalItems?: number;
  totalItemsPerPage?: number;
  currentPage?: number;
  totalPages?: number;
}

/** `GET /danh-sach/phim-moi-cap-nhat` */
export interface NewUpdatedResponse {
  status?: boolean;
  msg?: string;
  items?: MovieItem[];
  pagination?: ApiPagination;
}

/** `GET /v1/api/{danh-sach,the-loai,quoc-gia,tim-kiem}` */
export interface CatalogResponse {
  status?: boolean;
  msg?: string;
  data?: {
    titlePage?: string;
    items?: MovieItem[];
    params?: { pagination?: ApiPagination };
  };
}

/** `GET /phim/{slug}` */
export interface MovieDetailResponse {
  status?: boolean;
  msg?: string;
  movie?: MovieDetail;
  episodes?: EpisodeServer[];
}

/** Normalized list response: `GET /api/v1/movies/new`, `/api/v1/movies`, etc. */
export interface NormalizedListResponse {
  items: MovieItem[];
  title?: string;
  pagination: {
    page: number;
    totalPages: number;
    totalItems?: number;
    totalItemsPerPage?: number;
  };
}

/** Normalized detail response: `GET /api/v1/movies/:slug` */
export interface NormalizedDetailResponse {
  movie: MovieDetail;
}

