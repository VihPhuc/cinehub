import type {
  CatalogResponse,
  EpisodeItem,
  EpisodeServer,
  MovieDetail,
  MovieDetailResponse,
  MovieItem,
  NewUpdatedResponse,
  NormalizedDetailResponse,
  NormalizedListResponse,
} from './types';
import { safeStreamUrl } from './validation';
import { buildTmdbEmbedUrl } from './tmdb';

export function getBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim().replace(/\/+$/, '');
  return envUrl || 'https://phimapi.com';
}

export function isV1Api(): boolean {
  const url = getBaseUrl();
  return url.endsWith('/api/v1') || url.includes('/api/v1');
}


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

/**
 * Chuẩn hóa tên phim từ API:
 * Nhiều phim trên API ghép 2-3 tên bằng " / " hoặc " | " (ví dụ: "Tên 1 / Tên 2 (Phần 1)").
 * Hàm này lấy tên chính/phổ biến nhất (tên đầu tiên) và giữ lại phần chỉ định mùa/tập (như (Phần 1))
 * nếu tên đầu chưa có.
 */
export function formatMovieTitle(name?: string): string {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();
  const separatorRegex = /\s+(?:[/|])\s+/;
  if (!separatorRegex.test(trimmed)) return trimmed;

  const parts = trimmed.split(separatorRegex).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return trimmed;

  let primary = parts[0];
  const seasonRegex = /(?:\((?:Phần|Season|Mùa|Tập|Part)\s*\d+[^)]*\)|(?:Phần|Season|Mùa|Part)\s*\d+)/i;
  const hasSeasonInPrimary = seasonRegex.test(primary);

  if (!hasSeasonInPrimary) {
    for (let i = 1; i < parts.length; i++) {
      const match = parts[i].match(seasonRegex);
      if (match) {
        const seasonTag = match[0].startsWith('(') ? match[0] : `(${match[0]})`;
        primary = `${primary} ${seasonTag}`;
        break;
      }
    }
  }

  return primary;
}

export interface RequestOptions {
  bypassCache?: boolean;
  signal?: AbortSignal;
}

export function normalizeRequestOptions(
  optionsOrSignal?: RequestOptions | AbortSignal
): RequestOptions {
  if (!optionsOrSignal) return {};
  if (optionsOrSignal instanceof AbortSignal || 'aborted' in optionsOrSignal) {
    return { signal: optionsOrSignal as AbortSignal };
  }
  return optionsOrSignal as RequestOptions;
}

export function sanitizeMovieItem(item: MovieItem): MovieItem {
  const rawDate =
    item.updatedAt ||
    item.modified?.time ||
    (typeof item.modified === 'string' ? item.modified : undefined);

  let validUpdatedAt: string | undefined;
  if (rawDate && typeof rawDate === 'string') {
    const parsed = Date.parse(rawDate);
    if (!Number.isNaN(parsed)) {
      validUpdatedAt = new Date(parsed).toISOString();
    }
  }

  const result: MovieItem = {
    ...item,
    name: formatMovieTitle(item.name),
  };

  if (validUpdatedAt) {
    result.updatedAt = validUpdatedAt;
  } else {
    delete result.updatedAt;
  }

  return result;
}

export function sortMoviesByUpdatedAtDesc(movies: MovieItem[]): MovieItem[] {
  return movies
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const timeA = a.item.updatedAt ? Date.parse(a.item.updatedAt) : NaN;
      const timeB = b.item.updatedAt ? Date.parse(b.item.updatedAt) : NaN;
      const hasA = !Number.isNaN(timeA);
      const hasB = !Number.isNaN(timeB);

      if (hasA && hasB) {
        const diff = timeB - timeA;
        if (diff !== 0) return diff;
        return a.index - b.index;
      }
      if (hasA) return -1;
      if (hasB) return 1;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

export function selectTopRatedMovies(
  movies: MovieItem[],
  limit = 10,
  minVotes = 20
): MovieItem[] {
  return movies
    .map((item, index) => ({ item, index }))
    .filter(
      ({ item }) =>
        (item.tmdb?.vote_count ?? 0) >= minVotes && (item.tmdb?.vote_average ?? 0) > 0
    )
    .sort((a, b) => {
      const scoreA = a.item.tmdb?.vote_average ?? 0;
      const scoreB = b.item.tmdb?.vote_average ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;

      const votesA = a.item.tmdb?.vote_count ?? 0;
      const votesB = b.item.tmdb?.vote_count ?? 0;
      if (votesB !== votesA) return votesB - votesA;

      return a.index - b.index;
    })
    .slice(0, limit)
    .map(({ item }) => item);
}

export function formatUpdatedAtBadge(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');

  if (isToday) {
    return `Cập nhật ${hh}:${mm}`;
  }

  const dd = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${month} ${hh}:${mm}`;
}

const CACHE_PREFIX = 'cinehub_api_';
const DEFAULT_TIMEOUT_MS = 10000; // 10s timeout
const DEFAULT_TTL_MS = 4 * 60 * 1000; // 4 minutes
const MAX_MEMORY_CACHE_ENTRIES = 200;

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

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  options?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Wait for a shared request without letting one caller's AbortSignal
 * cancel the network request that every other caller is waiting on.
 */
function waitForSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T | null> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.resolve(null);

  return new Promise<T | null>((resolve) => {
    let settled = false;
    const finish = (value: T | null) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      resolve(value);
    };
    const onAbort = () => finish(null);

    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => finish(value),
      () => finish(null)
    );
  });
}

function removeSessionCache(key: string): void {
  try {
    sessionStorage.removeItem(`${CACHE_PREFIX}${key}`);
  } catch {
    // Ignore storage access errors
  }
}

/** Clear both app-level API caches and ask the service worker to drop its copy. */
export function clearApiCache(): void {
  memoryCache.clear();
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) keys.push(key);
    }
    for (const key of keys) sessionStorage.removeItem(key);
  } catch {
    // Ignore storage access errors
  }

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.controller?.postMessage({ type: 'CLEAR_API_CACHE' });
  }
}

function trimMemoryCache(): void {
  while (memoryCache.size > MAX_MEMORY_CACHE_ENTRIES) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey === undefined) break;
    memoryCache.delete(oldestKey);
  }
}

async function fetchWithCache<T>(
  url: string,
  ttl: number = DEFAULT_TTL_MS,
  optionsOrSignal?: RequestOptions | AbortSignal
): Promise<T | null> {
  const options = normalizeRequestOptions(optionsOrSignal);
  const { bypassCache = false, signal: externalSignal } = options;
  if (externalSignal?.aborted) return null;

  const now = Date.now();

  if (!bypassCache) {
    const memCached = memoryCache.get(url) as CacheEntry<T> | undefined;
    if (memCached && memCached.expiry > now) {
      return memCached.data;
    }
    if (memCached) memoryCache.delete(url);

    const sessionCached = getSessionCache<T>(url);
    if (sessionCached && sessionCached.expiry > now) {
      memoryCache.set(url, sessionCached as CacheEntry<unknown>);
      return sessionCached.data;
    }
    if (sessionCached) removeSessionCache(url);
  }

  const inFlightKey = bypassCache ? `${url}__bypass` : url;
  let requestPromise = inFlightRequests.get(inFlightKey) as Promise<T | null> | undefined;
  if (!requestPromise) {
    requestPromise = (async (): Promise<T | null> => {
      try {
        const fetchInit: RequestInit = bypassCache ? { cache: 'no-store' } : {};
        const res = await fetchWithTimeout(url, DEFAULT_TIMEOUT_MS, fetchInit);
        if (!res.ok) {
          return null;
        }
        const data = (await res.json()) as T;
        // Never cache error responses (status: false)
        const isSuccess = (data as { status?: boolean })?.status !== false;
        if (isSuccess) {
          const entry: CacheEntry<T> = { data, expiry: Date.now() + ttl };
          memoryCache.set(url, entry as CacheEntry<unknown>);
          trimMemoryCache();
          setSessionCache(url, entry);
        }
        return data;
      } catch (err: unknown) {
        // Expired entries are deleted above. Do not silently serve them as
        // fresh data when the network is unavailable.
        console.warn(`[api] Fetch failed for ${url}:`, err);
        return null;
      } finally {
        inFlightRequests.delete(inFlightKey);
      }
    })();
    inFlightRequests.set(inFlightKey, requestPromise);
  }

  return waitForSignal(requestPromise, externalSignal);
}

export async function getNewUpdatedMovies(
  page = 1,
  optionsOrSignal?: RequestOptions | AbortSignal
): Promise<{ items: MovieItem[]; totalPages: number }> {
  if (isV1Api()) {
    const data = await fetchWithCache<NormalizedListResponse>(
      `${getBaseUrl()}/movies/new?page=${page}`,
      2 * 60 * 1000,
      optionsOrSignal
    );
    if (!data) return { items: [], totalPages: 1 };
    return {
      items: (data.items || []).map(sanitizeMovieItem),
      totalPages: data.pagination?.totalPages || 1,
    };
  }

  const data = await fetchWithCache<NewUpdatedResponse>(
    `${getBaseUrl()}/danh-sach/phim-moi-cap-nhat?page=${page}`,
    2 * 60 * 1000,
    optionsOrSignal
  );
  if (!data) return { items: [], totalPages: 1 };
  return {
    items: (data.items || []).map(sanitizeMovieItem),
    totalPages: data.pagination?.totalPages || 1,
  };
}

export async function getCatalogMovies(
  type: 'phim-le' | 'phim-bo' | 'hoat-hinh' | 'tv-shows',
  page = 1,
  optionsOrSignal?: RequestOptions | AbortSignal
): Promise<{ items: MovieItem[]; title: string; totalPages: number }> {
  if (isV1Api()) {
    const data = await fetchWithCache<NormalizedListResponse>(
      `${getBaseUrl()}/movies?type=${type}&page=${page}`,
      undefined,
      optionsOrSignal
    );
    if (!data) return { items: [], title: '', totalPages: 1 };
    return {
      items: (data.items || []).map(sanitizeMovieItem),
      title: data.title || '',
      totalPages: data.pagination?.totalPages || 1,
    };
  }

  const data = await fetchWithCache<CatalogResponse>(
    `${getBaseUrl()}/v1/api/danh-sach/${type}?page=${page}`,
    undefined,
    optionsOrSignal
  );
  if (!data) return { items: [], title: '', totalPages: 1 };
  return {
    items: (data.data?.items || []).map(sanitizeMovieItem),
    title: data.data?.titlePage || '',
    totalPages: data.data?.params?.pagination?.totalPages || 1,
  };
}

export async function getGenreMovies(
  slug: string,
  page = 1,
  optionsOrSignal?: RequestOptions | AbortSignal
): Promise<{ items: MovieItem[]; title: string; totalPages: number }> {
  const cleanSlug = encodeURIComponent(slug?.trim() || '');
  if (!cleanSlug) return { items: [], title: '', totalPages: 1 };

  if (isV1Api()) {
    const data = await fetchWithCache<NormalizedListResponse>(
      `${getBaseUrl()}/genres/${cleanSlug}/movies?page=${page}`,
      undefined,
      optionsOrSignal
    );
    if (!data) return { items: [], title: '', totalPages: 1 };
    return {
      items: (data.items || []).map(sanitizeMovieItem),
      title: data.title || 'Thể Loại',
      totalPages: data.pagination?.totalPages || 1,
    };
  }

  const data = await fetchWithCache<CatalogResponse>(
    `${getBaseUrl()}/v1/api/the-loai/${cleanSlug}?page=${page}`,
    undefined,
    optionsOrSignal
  );
  if (!data) return { items: [], title: '', totalPages: 1 };
  return {
    items: (data.data?.items || []).map(sanitizeMovieItem),
    title: data.data?.titlePage || 'Thể Loại',
    totalPages: data.data?.params?.pagination?.totalPages || 1,
  };
}

export async function getCountryMovies(
  slug: string,
  page = 1,
  optionsOrSignal?: RequestOptions | AbortSignal
): Promise<{ items: MovieItem[]; title: string; totalPages: number }> {
  const cleanSlug = encodeURIComponent(slug?.trim() || '');
  if (!cleanSlug) return { items: [], title: '', totalPages: 1 };

  if (isV1Api()) {
    const data = await fetchWithCache<NormalizedListResponse>(
      `${getBaseUrl()}/countries/${cleanSlug}/movies?page=${page}`,
      undefined,
      optionsOrSignal
    );
    if (!data) return { items: [], title: '', totalPages: 1 };
    return {
      items: (data.items || []).map(sanitizeMovieItem),
      title: data.title || 'Quốc Gia',
      totalPages: data.pagination?.totalPages || 1,
    };
  }

  const data = await fetchWithCache<CatalogResponse>(
    `${getBaseUrl()}/v1/api/quoc-gia/${cleanSlug}?page=${page}`,
    undefined,
    optionsOrSignal
  );
  if (!data) return { items: [], title: '', totalPages: 1 };
  return {
    items: (data.data?.items || []).map(sanitizeMovieItem),
    title: data.data?.titlePage || 'Quốc Gia',
    totalPages: data.data?.params?.pagination?.totalPages || 1,
  };
}

export async function searchMovies(
  keyword: string,
  page = 1,
  optionsOrSignal?: RequestOptions | AbortSignal
): Promise<{ items: MovieItem[]; totalPages: number }> {
  if (!keyword.trim()) return { items: [], totalPages: 1 };

  if (isV1Api()) {
    const data = await fetchWithCache<NormalizedListResponse>(
      `${getBaseUrl()}/search?q=${encodeURIComponent(keyword.trim())}&page=${page}`,
      60 * 1000,
      optionsOrSignal
    );
    if (!data) return { items: [], totalPages: 1 };
    return {
      items: (data.items || []).map(sanitizeMovieItem),
      totalPages: data.pagination?.totalPages || 1,
    };
  }

  const data = await fetchWithCache<CatalogResponse>(
    `${getBaseUrl()}/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword.trim())}&page=${page}`,
    60 * 1000,
    optionsOrSignal
  );
  if (!data) return { items: [], totalPages: 1 };
  return {
    items: (data.data?.items || []).map(sanitizeMovieItem),
    totalPages: data.data?.params?.pagination?.totalPages || 1,
  };
}

/**
 * Episode payloads come from a third-party API. Drop entries with no usable
 * stream and reject non-https links so a tampered response cannot smuggle
 * `javascript:`/`data:` URLs into the player.
 */
function sanitizeEpisodes(raw: unknown): EpisodeServer[] {
  if (!Array.isArray(raw)) return [];

  const servers: EpisodeServer[] = [];
  for (const server of raw) {
    if (!server || typeof server !== 'object') continue;
    const name = typeof server.server_name === 'string' ? server.server_name : '';
    const data = Array.isArray(server.server_data) ? server.server_data : [];

    const episodes: EpisodeItem[] = [];
    for (const ep of data) {
      if (!ep || typeof ep !== 'object') continue;
      const linkEmbed = safeStreamUrl(ep.link_embed) ?? '';
      const linkM3u8 = safeStreamUrl(ep.link_m3u8) ?? '';
      if (!linkEmbed && !linkM3u8) continue;

      episodes.push({
        name: typeof ep.name === 'string' ? ep.name : '',
        slug: typeof ep.slug === 'string' ? ep.slug : '',
        filename: typeof ep.filename === 'string' ? ep.filename : undefined,
        link_embed: linkEmbed,
        link_m3u8: linkM3u8,
      });
    }

    if (episodes.length > 0) servers.push({ server_name: name, server_data: episodes });
  }
  return servers;
}

export async function getMovieDetail(
  slug: string,
  optionsOrSignal?: RequestOptions | AbortSignal
): Promise<MovieDetail | null> {
  const cleanSlug = encodeURIComponent(slug?.trim() || '');
  if (!cleanSlug) return null;
  try {
    let rawMovie: MovieDetail | undefined;
    let rawEpisodes: EpisodeServer[] | undefined;

    if (isV1Api()) {
      const data = await fetchWithCache<NormalizedDetailResponse>(
        `${getBaseUrl()}/movies/${cleanSlug}`,
        6 * 60 * 1000,
        optionsOrSignal
      );
      if (!data || !data.movie) return null;
      rawMovie = data.movie;
      rawEpisodes = data.movie.episodes;
    } else {
      const data = await fetchWithCache<MovieDetailResponse>(
        `${getBaseUrl()}/phim/${cleanSlug}`,
        6 * 60 * 1000,
        optionsOrSignal
      );
      if (!data || !data.status || !data.movie) return null;
      rawMovie = data.movie;
      rawEpisodes = data.episodes;
    }

    const movie: MovieDetail = {
      ...rawMovie,
      name: formatMovieTitle(rawMovie.name),
      episodes: sanitizeEpisodes(rawEpisodes),
    };

    // Inject International TMDB Player option if TMDB id exists
    const isTv = movie.tmdb?.type === 'tv' || ['series', 'tvshows', 'hoathinh'].includes(movie.type ?? '');
    if (isTv && movie.episodes && movie.episodes.length > 0 && movie.episodes[0].server_data.length > 0) {
      const primaryServer = movie.episodes[0];
      const tvEpisodes: EpisodeItem[] = primaryServer.server_data.map((ep, i) => {
        const epNumMatch = ep.name.match(/\d+/);
        const epNum = epNumMatch ? parseInt(epNumMatch[0], 10) : i + 1;
        const epEmbed = buildTmdbEmbedUrl(movie.tmdb, movie.type, epNum) || '';
        return {
          name: ep.name,
          slug: `intl-${ep.slug || i + 1}`,
          filename: `${movie.name} - ${ep.name} (Quốc Tế)`,
          link_embed: epEmbed,
          link_m3u8: '',
        };
      });
      if (tvEpisodes.length > 0 && tvEpisodes[0].link_embed) {
        movie.episodes.push({
          server_name: 'Quốc Tế (VidSrc TMDB)',
          server_data: tvEpisodes,
        });
      }
    } else {
      const embedUrl = buildTmdbEmbedUrl(movie.tmdb, movie.type, 1);
      if (embedUrl) {
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
    }

    return movie;
  } catch (err) {
    console.error(`[api] Failed to get movie detail for ${slug}:`, err);
    return null;
  }
}

export function prefetchMovieDetail(slug: string): void {
  const cleanSlug = encodeURIComponent(slug?.trim() || '');
  if (!cleanSlug) return;
  const url = isV1Api()
    ? `${getBaseUrl()}/movies/${cleanSlug}`
    : `${getBaseUrl()}/phim/${cleanSlug}`;
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


