import type { FavoriteItem, HistoryItem, MovieDetail, MovieItem } from './types';
import {
  MAX_FAVORITES,
  MAX_HISTORY,
  normalizeFavorite,
  normalizeFavorites,
  normalizeHistoryItem,
  normalizeHistoryList,
} from './validation';

const FAVORITES_KEY = 'cineflix_favorites';
const HISTORY_KEY = 'cineflix_history';
const WATCHED_EPISODES_KEY = 'cineflix_watched_episodes';
export const STORAGE_CHANGE_EVENT = 'cinehub:storage_change';

export interface WatchedEpisodeInfo {
  progress: number;
  completed: boolean;
  updatedAt: number;
}

// In-memory cache to avoid repeated JSON.parse across renders
let memoryFavorites: FavoriteItem[] | null = null;
let memoryHistory: HistoryItem[] | null = null;
let memoryWatchedEpisodes: Record<string, Record<string, WatchedEpisodeInfo>> | null = null;

function notifyChange(key: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(STORAGE_CHANGE_EVENT, { detail: { key } }));
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === FAVORITES_KEY) {
      memoryFavorites = null;
      notifyChange(FAVORITES_KEY);
    } else if (e.key === HISTORY_KEY) {
      memoryHistory = null;
      notifyChange(HISTORY_KEY);
    } else if (e.key === WATCHED_EPISODES_KEY) {
      memoryWatchedEpisodes = null;
      notifyChange(WATCHED_EPISODES_KEY);
    }
  });
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    try {
      if (key === HISTORY_KEY) {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          localStorage.setItem(key, JSON.stringify(parsed.slice(0, 15)));
        }
      }
    } catch {}
  }
}

export function getFavorites(): FavoriteItem[] {
  if (memoryFavorites !== null) return memoryFavorites;
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    memoryFavorites = normalizeFavorites(parsed, MAX_FAVORITES);
    return memoryFavorites;
  } catch {
    memoryFavorites = [];
    return [];
  }
}

export function toggleFavorite(movie: MovieItem | MovieDetail): boolean {
  if (!movie || !movie.slug) return false;
  const list = [...getFavorites()];
  const existsIndex = list.findIndex((item) => item.slug === movie.slug);
  let nowFavorite = false;

  if (existsIndex >= 0) {
    list.splice(existsIndex, 1);
    nowFavorite = false;
  } else {
    list.unshift({
      slug: movie.slug,
      name: movie.name,
      origin_name: movie.origin_name,
      poster_url: movie.poster_url,
      thumb_url: movie.thumb_url,
      year: movie.year,
      quality: movie.quality,
      lang: movie.lang,
      savedAt: Date.now(),
    });
    if (list.length > 100) list.pop();
    nowFavorite = true;
  }

  memoryFavorites = list;
  safeSetItem(FAVORITES_KEY, JSON.stringify(list));
  notifyChange(FAVORITES_KEY);
  return nowFavorite;
}

export function getHistory(): HistoryItem[] {
  if (memoryHistory !== null) return memoryHistory;
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    memoryHistory = normalizeHistoryList(parsed, MAX_HISTORY);
    return memoryHistory;
  } catch {
    memoryHistory = [];
    return [];
  }
}

export function saveHistory(entry: {
  movie: MovieItem | MovieDetail;
  serverName: string;
  episodeSlug: string;
  episodeName: string;
  currentTime: number;
  duration: number;
}) {
  if (!entry?.movie?.slug) return;
  try {
    const list = getHistory().filter((item) => item.slug !== entry.movie.slug);
    list.unshift({
      slug: entry.movie.slug,
      name: entry.movie.name,
      origin_name: entry.movie.origin_name,
      poster_url: entry.movie.poster_url,
      thumb_url: entry.movie.thumb_url,
      serverName: entry.serverName,
      episodeSlug: entry.episodeSlug,
      episodeName: entry.episodeName,
      currentTime: entry.currentTime,
      duration: entry.duration,
      updatedAt: Date.now(),
    });
    const capped = list.slice(0, 50);
    memoryHistory = capped;
    safeSetItem(HISTORY_KEY, JSON.stringify(capped));
    notifyChange(HISTORY_KEY);
  } catch (e) {
    console.error('[storage] Failed to save history:', e);
  }
}

export function clearHistory(): void {
  memoryHistory = [];
  memoryWatchedEpisodes = {};
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem(WATCHED_EPISODES_KEY);
  notifyChange(HISTORY_KEY);
  notifyChange(WATCHED_EPISODES_KEY);
}

export function removeHistoryItem(slug: string, episodeSlug?: string): void {
  try {
    const list = getHistory().filter((item) =>
      episodeSlug ? !(item.slug === slug && item.episodeSlug === episodeSlug) : item.slug !== slug
    );
    memoryHistory = list;
    safeSetItem(HISTORY_KEY, JSON.stringify(list));
    notifyChange(HISTORY_KEY);

    if (memoryWatchedEpisodes && memoryWatchedEpisodes[slug]) {
      if (episodeSlug) {
        delete memoryWatchedEpisodes[slug][episodeSlug];
      } else {
        delete memoryWatchedEpisodes[slug];
      }
      safeSetItem(WATCHED_EPISODES_KEY, JSON.stringify(memoryWatchedEpisodes));
      notifyChange(WATCHED_EPISODES_KEY);
    }
  } catch (e) {
    console.error('[storage] Failed to remove history item:', e);
  }
}

export function getWatchedEpisodes(movieSlug: string): Record<string, WatchedEpisodeInfo> {
  if (!movieSlug) return {};
  if (!memoryWatchedEpisodes) {
    try {
      const raw = localStorage.getItem(WATCHED_EPISODES_KEY);
      memoryWatchedEpisodes = raw
        ? (JSON.parse(raw) as Record<string, Record<string, WatchedEpisodeInfo>>)
        : {};
    } catch {
      memoryWatchedEpisodes = {};
    }
  }
  return memoryWatchedEpisodes?.[movieSlug] ?? {};
}

export function isEpisodeCompleted(movieSlug: string, episodeSlug: string): boolean {
  if (!movieSlug || !episodeSlug) return false;
  const episodes = getWatchedEpisodes(movieSlug);
  return Boolean(episodes[episodeSlug]?.completed || (episodes[episodeSlug]?.progress ?? 0) >= 85);
}

export function markEpisodeWatched(
  movieSlug: string,
  episodeSlug: string,
  progress: number,
  completed = false
): void {
  if (!movieSlug || !episodeSlug) return;
  try {
    if (!memoryWatchedEpisodes) {
      const raw = localStorage.getItem(WATCHED_EPISODES_KEY);
      memoryWatchedEpisodes = raw
        ? (JSON.parse(raw) as Record<string, Record<string, WatchedEpisodeInfo>>)
        : {};
    }
    const store = memoryWatchedEpisodes ?? {};
    if (!store[movieSlug]) {
      store[movieSlug] = {};
    }
    const prev = store[movieSlug][episodeSlug];
    const normalizedProgress = Math.max(prev?.progress ?? 0, Math.min(100, Math.round(progress)));
    const isCompleted = completed || (prev?.completed ?? false) || normalizedProgress >= 85;

    store[movieSlug][episodeSlug] = {
      progress: normalizedProgress,
      completed: isCompleted,
      updatedAt: Date.now(),
    };

    memoryWatchedEpisodes = store;
    safeSetItem(WATCHED_EPISODES_KEY, JSON.stringify(store));
    notifyChange(WATCHED_EPISODES_KEY);
  } catch (e) {
    console.error('[storage] Failed to mark episode watched:', e);
  }
}

export function exportUserData(): string {
  const data = {
    favorites: getFavorites(),
    history: getHistory(),
    watchedEpisodes: memoryWatchedEpisodes || (() => {
      try {
        const raw = localStorage.getItem(WATCHED_EPISODES_KEY);
        return raw ? (JSON.parse(raw) as Record<string, Record<string, WatchedEpisodeInfo>>) : {};
      } catch {
        return {};
      }
    })(),
    exportedAt: new Date().toISOString(),
    version: '1.2',
  };
  return JSON.stringify(data, null, 2);
}

/**
 * Validate and sanitize user backup payload before committing to storage.
 * Ensures favorites and history items match strict schema rules and safe URLs.
 */
export function validateAndSanitizeBackup(parsed: Record<string, unknown>): {
  favorites: FavoriteItem[] | null;
  history: HistoryItem[] | null;
} | null {
  const hasFavorites = Array.isArray(parsed.favorites);
  const hasHistory = Array.isArray(parsed.history);
  if (!hasFavorites && !hasHistory) return null;

  let nextFavorites: FavoriteItem[] | null = null;
  let nextHistory: HistoryItem[] | null = null;

  if (hasFavorites) {
    const raw = parsed.favorites as unknown[];
    if (raw.some((item) => normalizeFavorite(item) === null)) return null;
    nextFavorites = normalizeFavorites(raw, MAX_FAVORITES);
  }

  if (hasHistory) {
    const raw = parsed.history as unknown[];
    if (raw.some((item) => normalizeHistoryItem(item) === null)) return null;
    nextHistory = normalizeHistoryList(raw, MAX_HISTORY);
  }

  return { favorites: nextFavorites, history: nextHistory };
}

/**
 * Validate and import user backup data (favorites + history).
 * Rejects corrupt data, truncates to maximum capacity, and sanitizes untrusted links.
 */
export function importUserData(jsonStr: string): boolean {
  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    const validated = validateAndSanitizeBackup(parsed);
    if (!validated) return false;

    if (validated.favorites) {
      memoryFavorites = validated.favorites;
      safeSetItem(FAVORITES_KEY, JSON.stringify(validated.favorites));
      notifyChange(FAVORITES_KEY);
    }

    if (validated.history) {
      memoryHistory = validated.history;
      safeSetItem(HISTORY_KEY, JSON.stringify(validated.history));
      notifyChange(HISTORY_KEY);
    }

    return true;
  } catch {
    return false;
  }
}

export function subscribeToStorage(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(STORAGE_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener(STORAGE_CHANGE_EVENT, callback);
  };
}

