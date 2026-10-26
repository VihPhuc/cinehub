interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getCatalogMovies,
  getCountryMovies,
  getGenreMovies,
  getNewUpdatedMovies,
  getMovieDetail,
  searchMovies,
  getImageUrl,
  sortMoviesByUpdatedAtDesc,
  selectTopRatedMovies,
} from '@/shared/api';
import type { MovieDetail, MovieItem, FavoriteItem, HistoryItem } from '@/shared/types';
import { getFavorites, getHistory, toggleFavorite, clearHistory, removeHistoryItem, subscribeToStorage } from '@/shared/storage';
import { buildUrlSearch, parseUrlState } from './urlState';
import { ArrowUp, WifiOff, Play, Clock, ChevronRight, Trophy, Sparkles, Flame, Zap, Clapperboard, Tv, RefreshCw } from 'lucide-react';
import { Navbar } from '@/features/navigation/Navbar';
import { HeroBanner } from '@/features/home/HeroBanner';
import { MovieRow } from '@/features/catalog/MovieRow';
import { MovieGrid } from '@/features/catalog/MovieGrid';
import type { SortKey } from '@/features/catalog/MovieGrid';
import { MovieDetailModal } from '@/features/detail/MovieDetailModal';
import { LibraryView } from '@/features/library/LibraryView';
import { MovieRouletteModal } from '@/features/home/MovieRouletteModal';
import { MobileBottomNav } from '@/features/navigation/MobileBottomNav';

// Keep hls.js out of the initial bundle: it is only needed once a movie plays.
const VideoPlayer = lazy(() =>
  import('@/features/player/VideoPlayer').then((module) => ({ default: module.VideoPlayer }))
);

function PlayerFallback() {
  return (
    <div className="min-h-screen bg-[#090a0f] text-zinc-100 flex flex-col items-center justify-center gap-3">
      <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-red-500 animate-spin" />
      <p className="text-sm text-zinc-400 font-medium">Đang tải trình phát...</p>
    </div>
  );
}

type CatalogTab = 'phim-le' | 'phim-bo' | 'hoat-hinh' | 'tv-shows';
const CATALOG_TABS: CatalogTab[] = ['phim-le', 'phim-bo', 'hoat-hinh', 'tv-shows'];
function isCatalogTab(tab: string): tab is CatalogTab {
  return (CATALOG_TABS as string[]).includes(tab);
}

export function App() {
  const [urlState] = useState(() => parseUrlState(window.location.search));
  const [activeTab, setActiveTab] = useState(urlState.activeTab);
  const [genreFilter, setGenreFilter] = useState(urlState.genreFilter);
  const [countryFilter, setCountryFilter] = useState(urlState.countryFilter);
  const [searchQuery, setSearchQuery] = useState(urlState.searchQuery);
  const [currentPage, setCurrentPage] = useState(urlState.currentPage);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showRouletteModal, setShowRouletteModal] = useState(false);
  const [gridSort, setGridSort] = useState<SortKey>((urlState.sortFilter as SortKey) || 'updated-desc');
  const [gridYear, setGridYear] = useState<string>(urlState.yearFilter || 'all');
  const [gridRating, setGridRating] = useState<string>(urlState.ratingFilter || 'all');

  const [newUpdated, setNewUpdated] = useState<MovieItem[]>([]);
  const [singleMovies, setSingleMovies] = useState<MovieItem[]>([]);
  const [seriesMovies, setSeriesMovies] = useState<MovieItem[]>([]);
  const [animeMovies, setAnimeMovies] = useState<MovieItem[]>([]);
  const [tvShows, setTvShows] = useState<MovieItem[]>([]);
  const [koreanMovies, setKoreanMovies] = useState<MovieItem[]>([]);
  const [actionMovies, setActionMovies] = useState<MovieItem[]>([]);

  const [catalogList, setCatalogList] = useState<MovieItem[]>([]);
  const [catalogTitle, setCatalogTitle] = useState('');

  const [selectedSlug, setSelectedSlug] = useState<string | null>(urlState.selectedSlug);
  const [watchingMovie, setWatchingMovie] = useState<MovieDetail | null>(null);
  const [watchServerIdx, setWatchServerIdx] = useState(0);
  const [watchEpIdx, setWatchEpIdx] = useState(urlState.watchEpIdx);
  const [resumeFromHistory, setResumeFromHistory] = useState(false);

  const [favorites, setFavorites] = useState<FavoriteItem[]>(() => getFavorites());
  const [history, setHistory] = useState<HistoryItem[]>(() => getHistory());
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [toast, setToast] = useState<{ msg: string; type?: 'info' | 'success' } | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const watchRequestSeqRef = useRef(0);
  const didSyncUrlRef = useRef(false);
  const suppressUrlSyncRef = useRef(false);
  const catalogRequestIdRef = useRef(0);
  const catalogQueryKeyRef = useRef<string | null>(null);

  const showToast = useCallback((msg: string, type: 'info' | 'success' = 'info') => {
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    setToast({ msg, type });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3000);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      showToast('Đã kết nối Internet trở lại!', 'success');
    };
    const handleOffline = () => {
      setIsOffline(true);
      showToast('Bạn đang ở chế độ ngoại tuyến', 'info');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showToast]);

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        showToast('Đang cài đặt CineHub...', 'success');
      }
      setDeferredPrompt(null);
    } else {
      showToast('Ứng dụng đã sẵn sàng chạy trên trình duyệt của bạn', 'info');
    }
  };

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const shouldShow = window.scrollY > 400;
          setShowScrollTop((prev) => (prev !== shouldShow ? shouldShow : prev));
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Restore a watch deep link once, then keep state in sync with back/forward.
  useEffect(() => {
    const loadWatch = (slug: string, episode: number) => {
      suppressUrlSyncRef.current = true;
      const requestId = ++watchRequestSeqRef.current;
      getMovieDetail(slug)
        .then((detail) => {
          if (requestId !== watchRequestSeqRef.current) return;
          if (detail) {
            setResumeFromHistory(false);
            setWatchingMovie(detail);
            setWatchEpIdx(episode);
          } else {
            setWatchingMovie(null);
            showToast('Không tìm thấy phim hoặc tập phim này.', 'info');
          }
          suppressUrlSyncRef.current = false;
        })
        .catch(() => {
          if (requestId !== watchRequestSeqRef.current) return;
          setWatchingMovie(null);
          showToast('Không thể tải phim. Vui lòng thử lại.', 'info');
          suppressUrlSyncRef.current = false;
        });
    };

    if (urlState.watchSlug) {
      loadWatch(urlState.watchSlug, urlState.watchEpIdx);
    }

    const onPopState = () => {
      const next = parseUrlState(window.location.search);
      setSelectedSlug(next.selectedSlug);
      setActiveTab(next.activeTab);
      setGenreFilter(next.genreFilter);
      setCountryFilter(next.countryFilter);
      setSearchQuery(next.searchQuery);
      setCurrentPage(next.currentPage);

      if (next.watchSlug) {
        // Apply the target episode immediately so the URL-sync effect does not
        // briefly push the previous episode before the detail request resolves.
        setWatchEpIdx(next.watchEpIdx);
        setResumeFromHistory(false);
        loadWatch(next.watchSlug, next.watchEpIdx);
      } else {
        watchRequestSeqRef.current += 1;
        suppressUrlSyncRef.current = false;
        setWatchingMovie(null);
      }
      setGridSort((next.sortFilter as SortKey) || 'updated-desc');
      setGridYear(next.yearFilter || 'all');
      setGridRating(next.ratingFilter || 'all');
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [urlState.watchSlug, urlState.watchEpIdx, showToast]);

  // Sync state to the URL. Skip the first run so a deep link is never
  // overwritten by the default state before its detail request resolves.
  useEffect(() => {
    if (!didSyncUrlRef.current) {
      didSyncUrlRef.current = true;
      return;
    }
    // A watch detail request is restoring the target state; the current URL is
    // already correct, so do not normalize/push until it resolves.
    if (suppressUrlSyncRef.current) return;

    const newSearch = buildUrlSearch({
      activeTab,
      genreFilter,
      countryFilter,
      searchQuery,
      currentPage,
      selectedSlug,
      watchSlug: watchingMovie?.slug ?? null,
      watchEpIdx,
      sortFilter: gridSort,
      yearFilter: gridYear,
      ratingFilter: gridRating,
    });
    const currentSearch = window.location.search.replace(/^\?/, '');
    // Treat semantically equivalent URLs as equal too (e.g. ep=0 vs omitted ep,
    // or a redundant tab=search param), otherwise hydration would add a
    // duplicate history entry before the user does anything.
    const canonicalCurrentSearch = buildUrlSearch(parseUrlState(window.location.search));
    if (newSearch === currentSearch || newSearch === canonicalCurrentSearch) return;

    const newUrl = newSearch
      ? `${window.location.pathname}?${newSearch}`
      : window.location.pathname;
    window.history.pushState(null, '', newUrl);
  }, [
    watchingMovie,
    watchEpIdx,
    selectedSlug,
    activeTab,
    genreFilter,
    countryFilter,
    searchQuery,
    currentPage,
    gridSort,
    gridYear,
    gridRating,
  ]);

  const refreshStorage = () => {
    setFavorites(getFavorites());
    setHistory(getHistory());
  };

  useEffect(() => {
    return subscribeToStorage(() => {
      refreshStorage();
    });
  }, []);

  const [lastHomeUpdatedAt, setLastHomeUpdatedAt] = useState<number | null>(null);
  const [isHomeRefreshing, setIsHomeRefreshing] = useState(false);
  const homeLoadingRef = useRef(false);
  const lastHomeLoadTimeRef = useRef(0);

  const loadHome = useCallback(async (force = false) => {
    if (homeLoadingRef.current) return;
    homeLoadingRef.current = true;
    if (force) setIsHomeRefreshing(true);

    const reqOpts = force ? { bypassCache: true } : undefined;

    try {
      const [
        resNew,
        resSingle,
        resSeries,
        resAnime,
        resTv,
        resKorean,
        resAction,
      ] = await Promise.allSettled([
        getNewUpdatedMovies(1, reqOpts),
        getCatalogMovies('phim-le', 1, reqOpts),
        getCatalogMovies('phim-bo', 1, reqOpts),
        getCatalogMovies('hoat-hinh', 1, reqOpts),
        getCatalogMovies('tv-shows', 1, reqOpts),
        getCountryMovies('han-quoc', 1, reqOpts),
        getGenreMovies('hanh-dong', 1, reqOpts),
      ]);

      if (resNew.status === 'fulfilled' && resNew.value.items.length > 0) {
        setNewUpdated(resNew.value.items);
      }
      if (resSingle.status === 'fulfilled' && resSingle.value.items.length > 0) {
        setSingleMovies(resSingle.value.items.slice(0, 18));
      }
      if (resSeries.status === 'fulfilled' && resSeries.value.items.length > 0) {
        setSeriesMovies(resSeries.value.items.slice(0, 18));
      }
      if (resAnime.status === 'fulfilled' && resAnime.value.items.length > 0) {
        setAnimeMovies(resAnime.value.items.slice(0, 18));
      }
      if (resTv.status === 'fulfilled' && resTv.value.items.length > 0) {
        setTvShows(resTv.value.items.slice(0, 18));
      }
      if (resKorean.status === 'fulfilled' && resKorean.value.items.length > 0) {
        setKoreanMovies(resKorean.value.items.slice(0, 18));
      }
      if (resAction.status === 'fulfilled' && resAction.value.items.length > 0) {
        setActionMovies(resAction.value.items.slice(0, 18));
      }

      const now = Date.now();
      lastHomeLoadTimeRef.current = now;
      setLastHomeUpdatedAt(now);
    } finally {
      homeLoadingRef.current = false;
      setIsHomeRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadHome(false);

    const checkAndRefresh = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastHomeLoadTimeRef.current;
        if (elapsed > 60000) {
          loadHome(true);
        }
      }
    };

    document.addEventListener('visibilitychange', checkAndRefresh);
    window.addEventListener('focus', checkAndRefresh);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastHomeLoadTimeRef.current;
        if (elapsed >= 60000) {
          loadHome(true);
        }
      }
    }, 60000);

    return () => {
      document.removeEventListener('visibilitychange', checkAndRefresh);
      window.removeEventListener('focus', checkAndRefresh);
      clearInterval(interval);
    };
  }, [loadHome]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (activeTab === 'home' || activeTab === 'library') {
      return;
    }

    const queryKey = `${activeTab}|${genreFilter.slug}|${countryFilter.slug}|${searchQuery}`;
    const previousKey = catalogQueryKeyRef.current;
    catalogQueryKeyRef.current = queryKey;
    const requestId = ++catalogRequestIdRef.current;
    if (previousKey !== null && previousKey !== queryKey && currentPage !== 1) {
      Promise.resolve().then(() => {
        if (requestId === catalogRequestIdRef.current) setCurrentPage(1);
      });
      return;
    }

    const controller = new AbortController();
    const title =
      activeTab === 'search'
        ? `Tìm kiếm: "${searchQuery}"`
        : activeTab === 'genre'
          ? `Thể loại: ${genreFilter.name}`
          : activeTab === 'country'
            ? `Phim ${countryFilter.name}`
            : 'Danh Sách Phim';

    let request: Promise<{ items: MovieItem[]; title?: string; totalPages: number }>;

    if (activeTab === 'search') {
      request = searchMovies(searchQuery, currentPage, controller.signal);
    } else if (activeTab === 'genre') {
      request = getGenreMovies(genreFilter.slug, currentPage, controller.signal);
    } else if (activeTab === 'country') {
      request = getCountryMovies(countryFilter.slug, currentPage, controller.signal);
    } else if (isCatalogTab(activeTab)) {
      request = getCatalogMovies(activeTab, currentPage, controller.signal);
    } else {
      return;
    }

    Promise.resolve().then(() => {
      if (requestId === catalogRequestIdRef.current) {
        setLoading(true);
        setCatalogList([]);
        setCatalogTitle(title);
        setTotalPages(1);
      }
    });

    const apply = (res: { items: MovieItem[]; title?: string; totalPages: number }) => {
      if (requestId !== catalogRequestIdRef.current) return;
      setCatalogList(res.items);
      setCatalogTitle(res.title || title);
      setTotalPages(res.totalPages);
      setLoading(false);
    };

    const fail = () => {
      if (requestId !== catalogRequestIdRef.current) return;
      setCatalogList([]);
      setTotalPages(1);
      setLoading(false);
      showToast('Không thể tải danh sách phim. Vui lòng thử lại.', 'info');
    };

    request.then(apply).catch(fail);
    return () => controller.abort();
  }, [activeTab, genreFilter, countryFilter, searchQuery, currentPage, showToast]);

  const handleStartWatch = (movie: MovieDetail, sIdx = 0, epIdx = 0, resume = false) => {
    watchRequestSeqRef.current += 1;
    suppressUrlSyncRef.current = false;
    setSelectedSlug(null);
    setResumeFromHistory(resume);
    setWatchingMovie(movie);
    setWatchServerIdx(sIdx);
    setWatchEpIdx(epIdx);
  };

  const handleQuickPlay = async (movie: MovieItem) => {
    watchRequestSeqRef.current += 1;
    const detail = await getMovieDetail(movie.slug);
    if (detail) {
      handleStartWatch(detail, 0, 0);
    } else {
      suppressUrlSyncRef.current = false;
    }
  };

  const handleResumePlay = async (h: HistoryItem) => {
    watchRequestSeqRef.current += 1;
    const detail = await getMovieDetail(h.slug);
    if (detail) {
      let sIdx = 0;
      let epIdx = 0;
      if (detail.episodes) {
        const foundS = detail.episodes.findIndex((s) => s.server_name === h.serverName);
        if (foundS >= 0) {
          sIdx = foundS;
          const foundE = detail.episodes[foundS].server_data.findIndex((e) => e.slug === h.episodeSlug);
          if (foundE >= 0) epIdx = foundE;
        }
      }
      handleStartWatch(detail, sIdx, epIdx, true);
    } else {
      suppressUrlSyncRef.current = false;
    }
  };

  const handleToggleFav = (movie: MovieItem | MovieDetail) => {
    const isNowFav = toggleFavorite(movie);
    refreshStorage();
    showToast(
      isNowFav ? `Đã lưu "${movie.name}" vào tủ phim` : `Đã bỏ lưu "${movie.name}"`,
      isNowFav ? 'success' : 'info'
    );
  };

  const favSlugs = useMemo(() => favorites.map((f) => f.slug), [favorites]);
  const { latestMovies, heroBannerMovies, topRatedMovies } = useMemo(() => {
    const latest = sortMoviesByUpdatedAtDesc(newUpdated);
    return {
      latestMovies: latest,
      heroBannerMovies: latest.slice(0, 8),
      topRatedMovies: selectTopRatedMovies(latest, 10, 20),
    };
  }, [newUpdated]);

  const roulettePool = useMemo(() => {
    return [
      ...latestMovies,
      ...singleMovies,
      ...seriesMovies,
      ...animeMovies,
      ...tvShows,
      ...koreanMovies,
      ...actionMovies,
    ];
  }, [latestMovies, singleMovies, seriesMovies, animeMovies, tvShows, koreanMovies, actionMovies]);

  const handleRandomMovie = () => {
    if (roulettePool.length > 0) {
      setShowRouletteModal(true);
    } else {
      showToast('Đang tải danh sách phim, vui lòng thử lại sau...', 'info');
    }
  };

  if (watchingMovie) {
    return (
      <Suspense fallback={<PlayerFallback />}>
        <VideoPlayer
          key={watchingMovie.slug}
          movie={watchingMovie}
          initialServerIdx={watchServerIdx}
          initialEpIdx={watchEpIdx}
          resumeFromHistory={resumeFromHistory}
          onEpChange={(idx) => setWatchEpIdx(idx)}
          onBack={() => {
            watchRequestSeqRef.current += 1;
            suppressUrlSyncRef.current = false;
            setWatchingMovie(null);
            refreshStorage();
          }}
        />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-[#090a0f] text-zinc-100 flex flex-col font-sans relative overflow-x-hidden">
      {/* Skip to Main Content Link for Keyboard / Screen Reader Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-red-600 focus:text-white focus:font-bold focus:rounded-xl focus:shadow-2xl focus:outline-none focus:ring-2 focus:ring-white"
      >
        Chuyển đến nội dung chính
      </a>

      {/* Ambient Top Glow */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[900px] h-[360px] bg-red-600/[0.08] blur-[140px] rounded-full z-0" />
      <div className="pointer-events-none fixed bottom-1/3 right-0 w-[500px] h-[500px] bg-indigo-600/[0.04] blur-[150px] rounded-full z-0" />

      {isOffline && (
        <div
          role="status"
          aria-live="polite"
          className="bg-gradient-to-r from-amber-600 to-amber-500 text-zinc-950 font-black text-xs py-2 px-4 text-center flex items-center justify-center gap-2 relative z-50 shadow-lg"
        >
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>Bạn đang ở chế độ ngoại tuyến. Bạn vẫn có thể xem danh sách Phim Đã Lưu và Lịch Sử.</span>
        </div>
      )}

      <Navbar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setCurrentPage(1);
        }}
        onSearch={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
          setActiveTab('search');
        }}
        onSelectGenre={(slug, name) => {
          setGenreFilter({ slug, name });
          setCurrentPage(1);
          setActiveTab('genre');
        }}
        onSelectCountry={(slug, name) => {
          setCountryFilter({ slug, name });
          setCurrentPage(1);
          setActiveTab('country');
        }}
        onSelectMovie={(slug) => setSelectedSlug(slug)}
        onRandomMovie={handleRandomMovie}
        onInstallPwa={handleInstallApp}
        canInstallPwa={Boolean(deferredPrompt)}
      />

      <main id="main-content" className="flex-1 pb-24 md:pb-16 relative z-10">
        {activeTab === 'home' && (
          <>
            <HeroBanner
              movies={heroBannerMovies}
              onPlay={handleQuickPlay}
              onInfo={(m) => setSelectedSlug(m.slug)}
              favorites={favSlugs}
              onToggleFav={handleToggleFav}
            />

            {/* Quick Explore Category Chips & Refresh Indicator */}
            <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider shrink-0 mr-1">
                    Khám phá:
                  </span>
                  {[
                    { id: 'phim-le', label: '🎬 Phim Lẻ' },
                    { id: 'phim-bo', label: '📺 Phim Bộ' },
                    { id: 'hoat-hinh', label: '⚡ Anime' },
                    { id: 'tv-shows', label: '🎪 TV Shows' },
                    { id: 'library', label: '⭐ Tủ Phim' },
                  ].map((chip) => (
                    <button
                      key={chip.id}
                      onClick={() => {
                        setActiveTab(chip.id);
                        setCurrentPage(1);
                      }}
                      className="shrink-0 px-3.5 py-1.5 rounded-xl glass-pill hover:bg-white/15 text-xs font-semibold text-zinc-300 hover:text-white transition-all cursor-pointer border border-white/10 focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      {chip.label}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowRouletteModal(true)}
                    className="shrink-0 px-3.5 py-1.5 rounded-xl bg-[#E50914]/15 border border-[#E50914]/30 text-[#E50914] hover:bg-[#E50914]/25 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    title="Gợi ý phim ngẫu nhiên thông minh"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#E50914]" />
                    <span>Gợi Ý Phim</span>
                  </button>
                </div>

                {lastHomeUpdatedAt && (
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto text-xs text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-zinc-400" />
                      Cập nhật lúc{' '}
                      <strong className="text-zinc-200 font-semibold">
                        {new Date(lastHomeUpdatedAt).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => loadHome(true)}
                      disabled={isHomeRefreshing}
                      aria-label="Làm mới trang chủ"
                      title="Làm mới dữ liệu trang chủ"
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-zinc-300 hover:text-white transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500 text-xs font-semibold ${
                        isHomeRefreshing ? 'opacity-70 cursor-not-allowed' : ''
                      }`}
                    >
                      <RefreshCw className={`w-3 h-3 ${isHomeRefreshing ? 'animate-spin text-red-400' : ''}`} />
                      <span>{isHomeRefreshing ? 'Đang tải...' : 'Làm mới'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6 mt-2">
              {/* Continue Watching Row */}
              {history.length > 0 && (
                <section className="px-4 sm:px-6 lg:px-8 max-w-[1720px] mx-auto w-full">
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-5 rounded-full bg-red-500 shadow-sm shadow-red-500/50" />
                      <h2 className="text-lg sm:text-xl font-black text-white font-heading tracking-tight flex items-center gap-2">
                        Tiếp Tục Xem
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-600/20 text-red-400 border border-red-500/30 font-sans font-bold">
                          {history.length}
                        </span>
                      </h2>
                    </div>
                    <button
                      onClick={() => setActiveTab('library')}
                      className="text-xs font-bold text-zinc-400 hover:text-red-400 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      Xem tất cả <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex gap-3.5 overflow-x-auto pb-3 scrollbar-none snap-x">
                    {history.slice(0, 10).map((item) => {
                      const progress =
                        item.duration > 0
                          ? Math.min(100, Math.round((item.currentTime / item.duration) * 100))
                          : 0;
                      const img = getImageUrl(item.thumb_url || item.poster_url);
                      return (
                        <div
                          key={`${item.slug}-${item.episodeSlug}`}
                          onClick={() => handleResumePlay(item)}
                          className="group relative shrink-0 w-60 sm:w-72 rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.08] hover:border-red-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-red-600/15 cursor-pointer snap-start flex flex-col"
                        >
                          {/* Thumbnail */}
                          <div className="relative aspect-video w-full bg-[#11131c] overflow-hidden">
                            <img
                              src={img}
                              alt={item.name}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                            {/* Play Overlay */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg glow-red-sm transform scale-75 group-hover:scale-100 transition-transform">
                                <Play className="w-4 h-4 fill-current translate-x-0.5" />
                              </div>
                            </div>
                            {/* Episode pill */}
                            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md text-[11px] font-bold bg-black/80 backdrop-blur-md text-amber-300 border border-amber-500/30">
                              {item.episodeName || 'Đang xem'}
                            </div>
                            {/* Progress bar */}
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                              <div
                                className="h-full bg-gradient-to-r from-red-600 to-rose-500 shadow-sm shadow-red-500"
                                style={{ width: `${progress || 5}%` }}
                              />
                            </div>
                          </div>

                          {/* Info */}
                          <div className="p-3 bg-[#0d0f17]/60 flex-1 flex flex-col justify-between">
                            <div>
                              <h3 className="text-xs sm:text-sm font-bold text-zinc-100 group-hover:text-red-400 transition-colors truncate">
                                {item.name}
                              </h3>
                              {item.origin_name && (
                                <p className="text-[11px] text-zinc-400 truncate italic">
                                  {item.origin_name}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-2 pt-1 border-t border-white/[0.04]">
                              <span className="text-red-400 font-semibold">{progress}% đã xem</span>
                              <span className="flex items-center gap-1 text-zinc-400">
                                <Clock className="w-3 h-3" />
                                {item.serverName || 'Server VIP'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* TOP 10 Rated Row (requires at least 5 movies with TMDB rating) */}
              {topRatedMovies.length >= 5 && (
                <MovieRow
                  title="TOP 10 Được Đánh Giá Cao"
                  subtitle="Điểm TMDB cao nhất trong các phim vừa cập nhật"
                  badge="ĐÁNH GIÁ CAO"
                  icon={<Trophy className="w-5 h-5 text-amber-400" />}
                  accentGradient="bg-gradient-to-b from-amber-400 via-orange-500 to-red-500 shadow-sm shadow-amber-500/50"
                  movies={topRatedMovies}
                  isTop10
                  onSelectMovie={(m) => setSelectedSlug(m.slug)}
                  onQuickPlay={handleQuickPlay}
                  favorites={favSlugs}
                  onToggleFav={handleToggleFav}
                />
              )}

              <MovieRow
                title="Mới Cập Nhật"
                subtitle="Phim và tập mới được cập nhật gần nhất"
                badge="MỚI CẬP NHẬT"
                icon={<Sparkles className="w-5 h-5 text-rose-400" />}
                movies={latestMovies}
                showUpdatedAt
                onSelectMovie={(m) => setSelectedSlug(m.slug)}
                onQuickPlay={handleQuickPlay}
                favorites={favSlugs}
                onToggleFav={handleToggleFav}
              />

              {/* Curated Collection 1: Korean Movies */}
              <MovieRow
                title="Phim Hàn Mới Cập Nhật"
                subtitle="Phim truyền hình và điện ảnh xứ Kim Chi vừa cập nhật"
                badge="PHIM HÀN"
                icon={<Flame className="w-5 h-5 text-rose-500" />}
                accentGradient="bg-gradient-to-b from-rose-500 via-pink-500 to-purple-500 shadow-sm shadow-rose-500/50"
                movies={koreanMovies}
                onSelectMovie={(m) => setSelectedSlug(m.slug)}
                onQuickPlay={handleQuickPlay}
                onViewMore={() => {
                  setCountryFilter({ name: 'Hàn Quốc', slug: 'han-quoc' });
                  setCurrentPage(1);
                  setActiveTab('country');
                }}
                favorites={favSlugs}
                onToggleFav={handleToggleFav}
              />

              <MovieRow
                title="Phim Lẻ Mới Cập Nhật"
                subtitle="Bom tấn điện ảnh, chiếu rạp vừa cập nhật"
                badge="PHIM LẺ"
                icon={<Clapperboard className="w-5 h-5 text-red-500" />}
                movies={singleMovies}
                onSelectMovie={(m) => setSelectedSlug(m.slug)}
                onQuickPlay={handleQuickPlay}
                onViewMore={() => {
                  setActiveTab('phim-le');
                  setCurrentPage(1);
                }}
                favorites={favSlugs}
                onToggleFav={handleToggleFav}
              />

              {/* Curated Collection 2: Action Blockbusters */}
              <MovieRow
                title="Hành Động Mới Cập Nhật"
                subtitle="Phim hành động, võ thuật và kịch tính vừa cập nhật"
                badge="HÀNH ĐỘNG"
                icon={<Zap className="w-5 h-5 text-amber-500" />}
                accentGradient="bg-gradient-to-b from-amber-500 via-red-500 to-rose-600 shadow-sm shadow-amber-500/50"
                movies={actionMovies}
                onSelectMovie={(m) => setSelectedSlug(m.slug)}
                onQuickPlay={handleQuickPlay}
                onViewMore={() => {
                  setGenreFilter({ name: 'Hành Động', slug: 'hanh-dong' });
                  setCurrentPage(1);
                  setActiveTab('genre');
                }}
                favorites={favSlugs}
                onToggleFav={handleToggleFav}
              />

              <MovieRow
                title="Phim Bộ Mới Cập Nhật"
                subtitle="Phim bộ dài tập, drama hấp dẫn vừa cập nhật"
                badge="PHIM BỘ"
                icon={<Tv className="w-5 h-5 text-sky-400" />}
                movies={seriesMovies}
                onSelectMovie={(m) => setSelectedSlug(m.slug)}
                onQuickPlay={handleQuickPlay}
                onViewMore={() => {
                  setActiveTab('phim-bo');
                  setCurrentPage(1);
                }}
                favorites={favSlugs}
                onToggleFav={handleToggleFav}
              />

              <MovieRow
                title="Thế Giới Anime & Hoạt Hình"
                subtitle="Tuyển tập anime hot, 3D Trung Quốc vietsub"
                badge="ANIME UNIVERSE"
                icon={<Sparkles className="w-5 h-5 text-emerald-400" />}
                accentGradient="bg-gradient-to-b from-emerald-400 via-teal-500 to-cyan-500 shadow-sm shadow-emerald-500/50"
                movies={animeMovies}
                onSelectMovie={(m) => setSelectedSlug(m.slug)}
                onQuickPlay={handleQuickPlay}
                onViewMore={() => {
                  setActiveTab('hoat-hinh');
                  setCurrentPage(1);
                }}
                favorites={favSlugs}
                onToggleFav={handleToggleFav}
              />

              <MovieRow
                title="TV Shows Đặc Sắc"
                subtitle="Chương trình truyền hình thực tế vui nhộn"
                badge="GIẢI TRÍ ĐẶC SẮC"
                icon={<Tv className="w-5 h-5 text-purple-400" />}
                accentGradient="bg-gradient-to-b from-purple-500 via-indigo-500 to-sky-500 shadow-sm shadow-purple-500/50"
                movies={tvShows}
                onSelectMovie={(m) => setSelectedSlug(m.slug)}
                onQuickPlay={handleQuickPlay}
                onViewMore={() => {
                  setActiveTab('tv-shows');
                  setCurrentPage(1);
                }}
                favorites={favSlugs}
                onToggleFav={handleToggleFav}
              />
            </div>
          </>
        )}

        {activeTab === 'library' && (
          <LibraryView
            favorites={favorites}
            history={history}
            onSelectMovie={(slug) => setSelectedSlug(slug)}
            onResumePlay={handleResumePlay}
            onRemoveFav={(slug) => {
              toggleFavorite({ slug, name: '' });
              refreshStorage();
              showToast('Đã xóa khỏi danh sách đã lưu', 'info');
            }}
            onRemoveHistoryItem={(slug, epSlug) => {
              removeHistoryItem(slug, epSlug);
              refreshStorage();
              showToast('Đã xóa phim khỏi lịch sử xem', 'info');
            }}
            onClearHistory={() => {
              clearHistory();
              refreshStorage();
              showToast('Đã xóa sạch lịch sử xem', 'info');
            }}
            onDataImported={() => {
              refreshStorage();
              showToast('Đã khôi phục dữ liệu sao lưu thành công!', 'success');
            }}
          />
        )}

        {!['home', 'library'].includes(activeTab) && (
          <MovieGrid
            key={`${activeTab}-${genreFilter.slug}-${countryFilter.slug}-${searchQuery}`}
            title={catalogTitle}
            movies={catalogList}
            loading={loading}
            page={currentPage}
            totalPages={totalPages}
            onPageChange={(p) => setCurrentPage(p)}
            onSelectMovie={(m) => setSelectedSlug(m.slug)}
            favorites={favSlugs}
            onToggleFav={handleToggleFav}
            initialSort={gridSort}
            initialYear={gridYear}
            initialRating={gridRating}
            onFacetChange={({ sort, year, rating }) => {
              if (sort) setGridSort(sort);
              if (year) setGridYear(year);
              if (rating) setGridRating(rating);
            }}
          />
        )}
      </main>

      {/* Sleek Minimalist Footer */}
      <footer className="bg-[#050608] border-t border-white/[0.08] pt-8 pb-28 md:pb-8 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="w-full max-w-[1720px] mx-auto space-y-5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-zinc-400">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-center md:text-left">
              <span className="text-base font-black font-heading text-white tracking-tight">
                CINE<span className="bg-gradient-to-r from-red-500 to-amber-400 bg-clip-text text-transparent">HUB</span>
              </span>
              <span className="hidden sm:inline text-zinc-700">|</span>
              <span className="text-zinc-400">Trải nghiệm xem phim điện ảnh trực tuyến chuẩn hiện đại, tốc độ cao & miễn phí</span>
            </div>

            <nav aria-label="Liên kết chân trang" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-zinc-400">
              <button
                onClick={() => {
                  setActiveTab('home');
                  setCurrentPage(1);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Trang Chủ
              </button>
              <button
                onClick={() => {
                  setActiveTab('phim-le');
                  setCurrentPage(1);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Phim Lẻ
              </button>
              <button
                onClick={() => {
                  setActiveTab('phim-bo');
                  setCurrentPage(1);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Phim Bộ
              </button>
              <button
                onClick={() => {
                  setActiveTab('hoat-hinh');
                  setCurrentPage(1);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Anime
              </button>
              <button
                onClick={() => {
                  setActiveTab('tv-shows');
                  setCurrentPage(1);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="hover:text-white transition-colors cursor-pointer"
              >
                TV Shows
              </button>
              <button
                onClick={() => {
                  setActiveTab('library');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Tủ Phim
              </button>
            </nav>
          </div>

          <div className="text-center text-[11px] text-zinc-500 border-t border-white/[0.04] pt-4 space-y-1">
            <p>© 2026 CineHub. Dữ liệu tổng hợp từ nguồn phim công khai PhimAPI và CDN quốc tế.</p>
            <p className="text-[10px] text-zinc-600">Trang web phi lợi nhuận phục vụ mục đích học tập và giải trí cá nhân.</p>
          </div>
        </div>
      </footer>

      {selectedSlug && (
        <MovieDetailModal
          key={selectedSlug}
          slug={selectedSlug}
          onClose={() => setSelectedSlug(null)}
          onWatch={handleStartWatch}
          isFav={favSlugs.includes(selectedSlug)}
          onToggleFav={handleToggleFav}
          onSelectSlug={(newSlug) => setSelectedSlug(newSlug)}
          onSearchPerson={(personName) => {
            setSelectedSlug(null);
            setSearchQuery(personName);
            setActiveTab('search');
            setCurrentPage(1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}

      {/* Smart Movie Roulette Modal */}
      <MovieRouletteModal
        isOpen={showRouletteModal}
        onClose={() => setShowRouletteModal(false)}
        movies={roulettePool}
        onSelectMovie={(slug) => {
          setShowRouletteModal(false);
          setSelectedSlug(slug);
        }}
        onWatchMovie={(slug) => {
          setShowRouletteModal(false);
          getMovieDetail(slug)
            .then((m) => {
              if (m) handleStartWatch(m);
            })
            .catch(() => {});
        }}
      />

      {/* Global Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-[5.25rem] sm:bottom-7 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl glass-dropdown border border-white/20 shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-none"
        >
          <div
            className={`w-2 h-2 rounded-full shrink-0 ${
              toast.type === 'success'
                ? 'bg-emerald-400 shadow-sm shadow-emerald-400'
                : 'bg-red-500 shadow-sm shadow-red-500'
            }`}
          />
          <span className="text-xs sm:text-sm font-semibold text-white tracking-wide">
            {toast.msg}
          </span>
        </div>
      )}

      {/* Floating Scroll to Top button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-[5.25rem] right-4 sm:bottom-6 sm:right-6 p-3 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white shadow-2xl glow-red cursor-pointer transition-all z-40 hover:scale-110 active:scale-95 border border-white/20"
          title="Cuộn lên đầu trang"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setCurrentPage(1);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenRoulette={() => setShowRouletteModal(true)}
        favoriteCount={favSlugs.length}
      />
    </div>
  );
}

export default App;
