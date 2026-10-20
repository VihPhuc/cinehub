import type { FavoriteItem, HistoryItem, MovieDetail, MovieItem } from '../types';

const FAVORITES_KEY = 'cineflix_favorites';
const HISTORY_KEY = 'cineflix_history';

export function getFavorites(): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isFavorite(slug: string): boolean {
  const list = getFavorites();
  return list.some((item) => item.slug === slug);
}

export function toggleFavorite(movie: MovieItem | MovieDetail): boolean {
  const list = getFavorites();
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
    nowFavorite = true;
  }

  localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
  return nowFavorite;
}

export function getHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
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
  try {
    const list = getHistory();
    const filtered = list.filter((item) => item.slug !== entry.movie.slug);
    filtered.unshift({
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
    // Keep max 40 items
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered.slice(0, 40)));
  } catch (e) {
    console.error('Failed to save history:', e);
  }
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}
