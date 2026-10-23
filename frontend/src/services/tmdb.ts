import type { MovieTMDB } from '../types';

const VIDSRC_EMBED_BASE = 'https://vidsrc.to/embed';

/**
 * Build a VidSrc embed URL from TMDB metadata.
 * vid: correct season/type instead of always season 1, episode 1.
 */
export function buildTmdbEmbedUrl(
  tmdb: MovieTMDB | undefined,
  movieType?: string,
  episode = 1
): string | null {
  const id = tmdb?.id;
  if (id === undefined || id === null || String(id).trim() === '') return null;

  const safeId = encodeURIComponent(String(id));
  const isTv = tmdb?.type
    ? tmdb.type === 'tv'
    : ['series', 'tvshows', 'hoathinh'].includes(movieType ?? '');

  if (!isTv) return `${VIDSRC_EMBED_BASE}/movie/${safeId}`;

  const season =
    typeof tmdb?.season === 'number' && Number.isFinite(tmdb.season) && tmdb.season > 0
      ? Math.floor(tmdb.season)
      : 1;
  const episodeNumber =
    Number.isFinite(episode) && episode > 0 ? Math.floor(episode) : 1;

  return `${VIDSRC_EMBED_BASE}/tv/${safeId}/${season}/${episodeNumber}`;
}
