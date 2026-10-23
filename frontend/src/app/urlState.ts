export interface UrlState {
  activeTab: string;
  genreFilter: { slug: string; name: string };
  countryFilter: { slug: string; name: string };
  searchQuery: string;
  currentPage: number;
  selectedSlug: string | null;
  watchSlug: string | null;
  watchEpIdx: number;
}

const MAX_PAGE = 5000;
const MAX_EPISODE = 10000;
const KNOWN_TABS = new Set([
  'home',
  'library',
  'search',
  'genre',
  'country',
  'phim-le',
  'phim-bo',
  'hoat-hinh',
  'tv-shows',
]);

function parseBoundedInt(raw: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/**
 * Parse the SPA query string into the initial app state.
 * Priority: search > country > genre > tab, matching the original reader.
 */
export function parseUrlState(search: string): UrlState {
  const params = new URLSearchParams(search);
  const genreSlug = params.get('genre')?.trim() ?? '';
  const countrySlug = params.get('country')?.trim() ?? '';
  const query = params.get('q')?.trim() ?? '';

  const genreFilter = {
    slug: genreSlug,
    name: params.get('genreName')?.trim() ?? '',
  };
  const countryFilter = {
    slug: countrySlug,
    name: params.get('countryName')?.trim() ?? '',
  };

  let activeTab = params.get('tab')?.trim() || 'home';
  if (genreSlug) activeTab = 'genre';
  if (countrySlug) activeTab = 'country';
  if (query) activeTab = 'search';

  if (activeTab === 'genre' && !genreSlug) activeTab = 'home';
  if (activeTab === 'country' && !countrySlug) activeTab = 'home';
  if (activeTab === 'search' && !query) activeTab = 'home';
  if (!KNOWN_TABS.has(activeTab)) activeTab = 'home';

  return {
    activeTab,
    genreFilter,
    countryFilter,
    searchQuery: query,
    currentPage: parseBoundedInt(params.get('page'), 1, 1, MAX_PAGE),
    selectedSlug: params.get('info')?.trim() || null,
    watchSlug: params.get('watch')?.trim() || null,
    watchEpIdx: parseBoundedInt(params.get('ep'), 0, 0, MAX_EPISODE),
  };
}

/** Serialize the app state back into a query string (without the leading `?`). */
export function buildUrlSearch(state: UrlState): string {
  const params = new URLSearchParams();
  const watchSlug = state.watchSlug?.trim();

  if (watchSlug) {
    params.set('watch', watchSlug);
    const episode = Number.isFinite(state.watchEpIdx)
      ? Math.max(0, Math.min(MAX_EPISODE, Math.floor(state.watchEpIdx)))
      : 0;
    if (episode > 0) params.set('ep', String(episode));
    return params.toString();
  }

  const infoSlug = state.selectedSlug?.trim();
  if (infoSlug) params.set('info', infoSlug);

  switch (state.activeTab) {
    case 'home':
      break;
    case 'search': {
      const query = state.searchQuery.trim();
      if (query) params.set('q', query);
      break;
    }
    case 'genre': {
      const slug = state.genreFilter.slug.trim();
      if (slug) {
        params.set('genre', slug);
        const name = state.genreFilter.name.trim();
        if (name) params.set('genreName', name);
      }
      break;
    }
    case 'country': {
      const slug = state.countryFilter.slug.trim();
      if (slug) {
        params.set('country', slug);
        const name = state.countryFilter.name.trim();
        if (name) params.set('countryName', name);
      }
      break;
    }
    default:
      params.set('tab', state.activeTab);
      break;
  }

  if (state.currentPage > 1) {
    params.set('page', String(Math.min(MAX_PAGE, Math.floor(state.currentPage))));
  }

  return params.toString();
}
