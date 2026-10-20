import type { MovieDetail, MovieItem } from '../types';

const BASE_URL = 'https://phimapi.com';
const IMAGE_CDN = 'https://phimimg.com';

export function getImageUrl(url?: string): string {
  if (!url) {
    return 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=800&auto=format&fit=crop';
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const cleanPath = url.startsWith('/') ? url.slice(1) : url;
  return `${IMAGE_CDN}/${cleanPath}`;
}

const apiCache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL_MS = 4 * 60 * 1000; // 4 minutes cache

async function fetchWithCache<T>(url: string, ttl = CACHE_TTL_MS): Promise<T | null> {
  const now = Date.now();
  const cached = apiCache.get(url);
  if (cached && cached.expiry > now) {
    return cached.data as T;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) return cached ? (cached.data as T) : null;
    const data = await res.json();
    apiCache.set(url, { data, expiry: now + ttl });
    return data as T;
  } catch (err) {
    console.error(`Fetch failed for ${url}:`, err);
    return cached ? (cached.data as T) : null;
  }
}

export async function getNewUpdatedMovies(page = 1): Promise<{ items: MovieItem[]; totalPages: number }> {
  const data = await fetchWithCache<any>(`${BASE_URL}/danh-sach/phim-moi-cap-nhat?page=${page}`, 2 * 60 * 1000);
  if (!data) return { items: [], totalPages: 1 };
  return {
    items: data.items || [],
    totalPages: data.pagination?.totalPages || 1,
  };
}

export async function getCatalogMovies(
  type: 'phim-le' | 'phim-bo' | 'hoat-hinh' | 'tv-shows',
  page = 1
): Promise<{ items: MovieItem[]; title: string; totalPages: number }> {
  const data = await fetchWithCache<any>(`${BASE_URL}/v1/api/danh-sach/${type}?page=${page}`);
  if (!data) return { items: [], title: '', totalPages: 1 };
  return {
    items: data.data?.items || [],
    title: data.data?.titlePage || '',
    totalPages: data.data?.params?.pagination?.totalPages || 1,
  };
}

export async function getGenreMovies(
  slug: string,
  page = 1
): Promise<{ items: MovieItem[]; title: string; totalPages: number }> {
  const data = await fetchWithCache<any>(`${BASE_URL}/v1/api/the-loai/${slug}?page=${page}`);
  if (!data) return { items: [], title: '', totalPages: 1 };
  return {
    items: data.data?.items || [],
    title: data.data?.titlePage || 'Thể Loại',
    totalPages: data.data?.params?.pagination?.totalPages || 1,
  };
}

export async function getCountryMovies(
  slug: string,
  page = 1
): Promise<{ items: MovieItem[]; title: string; totalPages: number }> {
  const data = await fetchWithCache<any>(`${BASE_URL}/v1/api/quoc-gia/${slug}?page=${page}`);
  if (!data) return { items: [], title: '', totalPages: 1 };
  return {
    items: data.data?.items || [],
    title: data.data?.titlePage || 'Quốc Gia',
    totalPages: data.data?.params?.pagination?.totalPages || 1,
  };
}

export async function searchMovies(
  keyword: string,
  page = 1
): Promise<{ items: MovieItem[]; totalPages: number }> {
  if (!keyword.trim()) return { items: [], totalPages: 1 };
  const data = await fetchWithCache<any>(
    `${BASE_URL}/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}&page=${page}`,
    60 * 1000
  );
  if (!data) return { items: [], totalPages: 1 };
  return {
    items: data.data?.items || [],
    totalPages: data.data?.params?.pagination?.totalPages || 1,
  };
}

export async function getMovieDetail(slug: string): Promise<MovieDetail | null> {
  try {
    const data = await fetchWithCache<any>(`${BASE_URL}/phim/${slug}`, 5 * 60 * 1000);
    if (!data || !data.status || !data.movie) return null;

    const movie: MovieDetail = {
      ...data.movie,
      episodes: data.episodes || [],
    };

    // Inject International TMDB Player option if TMDB id exists
    if (movie.tmdb?.id) {
      const tmdbId = movie.tmdb.id;
      const isTv = movie.type === 'series' || movie.type === 'tvshows' || movie.type === 'hoathinh';
      const embedUrl = isTv
        ? `https://vidsrc.to/embed/tv/${tmdbId}/1/1`
        : `https://vidsrc.to/embed/movie/${tmdbId}`;

      movie.episodes?.push({
        server_name: 'Quốc Tế (VidSrc TMDB)',
        server_data: [
          {
            name: 'Bản Quốc Tế (Full)',
            slug: 'full-intl',
            filename: `${movie.name} - International Stream`,
            link_embed: embedUrl,
            link_m3u8: '',
          },
        ],
      });
    }

    return movie;
  } catch (err) {
    console.error(`Failed to get movie detail for ${slug}:`, err);
    return null;
  }
}
