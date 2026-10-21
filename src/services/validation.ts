import type { FavoriteItem, HistoryItem } from '../types';

export const MAX_FAVORITES = 100;
export const MAX_HISTORY = 50;

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function cleanNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Only https URLs or local relative paths are accepted for stored artwork. */
export function safeImageUrl(value: unknown): string | undefined {
  const raw = cleanString(value);
  if (!raw) return undefined;
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;

  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Only https URLs are accepted for media streams (HLS manifests and iframe
 * embeds). Anything else — javascript:, data:, http: — is rejected so a
 * tampered API response cannot inject code into the player.
 */
export function safeStreamUrl(value: unknown): string | undefined {
  const raw = cleanString(value);
  if (!raw) return undefined;

  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function normalizeFavorite(value: unknown): FavoriteItem | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const slug = cleanString(item.slug);
  const name = cleanString(item.name);
  if (!slug || !name) return null;

  return {
    slug,
    name,
    origin_name: cleanString(item.origin_name),
    poster_url: safeImageUrl(item.poster_url),
    thumb_url: safeImageUrl(item.thumb_url),
    year: cleanNumber(item.year),
    quality: cleanString(item.quality),
    lang: cleanString(item.lang),
    savedAt: cleanNumber(item.savedAt) ?? Date.now(),
  };
}

export function normalizeHistoryItem(value: unknown): HistoryItem | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const slug = cleanString(item.slug);
  const name = cleanString(item.name);
  const episodeSlug = cleanString(item.episodeSlug);
  const episodeName = cleanString(item.episodeName);
  if (!slug || !name || !episodeSlug || !episodeName) return null;

  return {
    slug,
    name,
    origin_name: cleanString(item.origin_name),
    poster_url: safeImageUrl(item.poster_url),
    thumb_url: safeImageUrl(item.thumb_url),
    serverName: cleanString(item.serverName) ?? 'Server',
    episodeSlug,
    episodeName,
    currentTime: Math.max(0, Math.floor(cleanNumber(item.currentTime) ?? 0)),
    duration: Math.max(0, Math.floor(cleanNumber(item.duration) ?? 0)),
    updatedAt: cleanNumber(item.updatedAt) ?? Date.now(),
  };
}

export function normalizeFavorites(
  value: unknown,
  limit = MAX_FAVORITES
): FavoriteItem[] {
  if (!Array.isArray(value)) return [];

  const result: FavoriteItem[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const item = normalizeFavorite(entry);
    if (!item || seen.has(item.slug)) continue;
    seen.add(item.slug);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

export function normalizeHistoryList(
  value: unknown,
  limit = MAX_HISTORY
): HistoryItem[] {
  if (!Array.isArray(value)) return [];

  const result: HistoryItem[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const item = normalizeHistoryItem(entry);
    if (!item) continue;
    const key = `${item.slug}\u0000${item.episodeSlug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}
