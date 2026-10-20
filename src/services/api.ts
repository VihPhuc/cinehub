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

const CACHE_PREFIX = 'cinehub_api_';
const DEFAULT_TIMEOUT_MS = 10000; // 10s timeout
const DEFAULT_TTL_MS = 4 * 60 * 1000; // 4 minutes

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

function getSessionCache<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

function setSessionCache<T>(key: string, entry: CacheEntry<T>): void {
  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
  } catch {
    // Ignore storage quota
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number, externalSignal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const abortListener = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', abortListener);
    }
  }

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return response;
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', abortListener);
    }
  }
}

async function fetchWithCache<T>(
  url: string,
  ttl: number = DEFAULT_TTL_MS,
  externalSignal?: AbortSignal
): Promise<T | null> {
  const now = Date.now();

  const memCached = memoryCache.get(url) as CacheEntry<T> | undefined;
  if (memCached && memCached.expiry > now) {
    return memCached.data;
  }

  const sessionCached = getSessionCache<T>(url);
  if (sessionCached && sessionCached.expiry > now) {
    memoryCache.set(url, sessionCached as CacheEntry<unknown>);
    return sessionCached.data;
  }

  if (inFlightRequests.has(url)) {
    return inFlightRequests.get(url) as Promise<T | null>;
  }

  const fetchPromise = (async (): Promise<T | null> => {
    try {
      const res = await fetchWithTimeout(url, DEFAULT_TIMEOUT_MS, externalSignal);
      if (!res.ok) {
        return memCached?.data || sessionCached?.data || null;
      }
      const data = (await res.json()) as T;
      const entry: CacheEntry<T> = { data, expiry: now + ttl };
      memoryCache.set(url, entry as CacheEntry<unknown>);
      setSessionCache(url, entry);
      return data;
    } catch (err: unknown) {
      if (externalSignal?.aborted) return null;
      const fallback = memCached?.data || sessionCached?.data;
      if (fallback) return fallback;
      console.warn(`[api] Fetch failed for ${url}:`, err);
      return null;
    } finally {
      inFlightRequests.delete(url);
    }
  })();

  inFlightRequests.set(url, fetchPromise);
  return fetchPromise;
}

export function clearApiCache(): void {
  memoryCache.clear();
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) keysToRemove.push(key);
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch {}
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
  page = 1,
  signal?: AbortSignal
): Promise<{ items: MovieItem[]; totalPages: number }> {
  if (!keyword.trim()) return { items: [], totalPages: 1 };
  const data = await fetchWithCache<any>(
    `${BASE_URL}/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword.trim())}&page=${page}`,
    60 * 1000,
    signal
  );
  if (!data) return { items: [], totalPages: 1 };
  return {
    items: data.data?.items || [],
    totalPages: data.data?.params?.pagination?.totalPages || 1,
  };
}

export async function getMovieDetail(slug: string): Promise<MovieDetail | null> {
  if (!slug) return null;
  try {
    const data = await fetchWithCache<any>(`${BASE_URL}/phim/${encodeURIComponent(slug)}`, 6 * 60 * 1000);
    if (!data || !data.status || !data.movie) return null;

    const movie: MovieDetail = {
      ...data.movie,
      episodes: Array.isArray(data.episodes) ? [...data.episodes] : [],
    };

    // Inject International TMDB Player option if TMDB id exists
    if (movie.tmdb?.id) {
      const tmdbId = movie.tmdb.id;
      const isTv = movie.type === 'series' || movie.type === 'tvshows' || movie.type === 'hoathinh';
      const embedUrl = isTv
        ? `https://vidsrc.to/embed/tv/${tmdbId}/1/1`
        : `https://vidsrc.to/embed/movie/${tmdbId}`;

      if (!movie.episodes) movie.episodes = [];
      movie.episodes.push({
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
    console.error(`[api] Failed to get movie detail for ${slug}:`, err);
    return null;
  }
}

export function prefetchMovieDetail(slug: string): void {
  if (!slug) return;
  const url = `${BASE_URL}/phim/${encodeURIComponent(slug)}`;
  if (!memoryCache.has(url) && !inFlightRequests.has(url)) {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        getMovieDetail(slug).catch(() => {});
      });
    } else {
      setTimeout(() => {
        getMovieDetail(slug).catch(() => {});
      }, 150);
    }
  }
}

export function prefetchCatalog(type: 'phim-le' | 'phim-bo' | 'hoat-hinh' | 'tv-shows', page = 1): void {
  const url = `${BASE_URL}/v1/api/danh-sach/${type}?page=${page}`;
  if (!memoryCache.has(url) && !inFlightRequests.has(url)) {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        getCatalogMovies(type, page).catch(() => {});
      });
    } else {
      setTimeout(() => {
        getCatalogMovies(type, page).catch(() => {});
      }, 150);
    }
  }
}
