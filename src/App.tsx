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
} from './services/api';
import type { MovieDetail, MovieItem, FavoriteItem, HistoryItem } from './types';
import { getFavorites, getHistory, toggleFavorite, clearHistory, removeHistoryItem, subscribeToStorage } from './services/storage';
import { buildUrlSearch, parseUrlState } from './lib/urlState';
import { ArrowUp, WifiOff, Play, Clock, ChevronRight, Trophy, Sparkles, Flame, Zap, Clapperboard, Tv } from 'lucide-react';
import { THEME_OPTIONS } from './lib/theme';
import { Navbar } from './components/Navbar';
import { HeroBanner } from './components/HeroBanner';
import { MovieRow } from './components/MovieRow';
import { MovieGrid } from './components/MovieGrid';
import { MovieDetailModal } from './components/MovieDetailModal';
import { LibraryView } from './components/LibraryView';

// Keep hls.js out of the initial bundle: it is only needed once a movie plays.
const VideoPlayer = lazy(() =>
  import('./components/VideoPlayer').then((module) => ({ default: module.VideoPlayer }))
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

  const handleRandomMovie = () => {
    const pool = [
      ...newUpdated,
      ...singleMovies,
      ...seriesMovies,
      ...animeMovies,
      ...tvShows,
      ...koreanMovies,
      ...actionMovies,
    ];
    if (pool.length > 0) {
      const randomIdx = Math.floor(Math.random() * pool.length);
      const picked = pool[randomIdx];
      setSelectedSlug(picked.slug);
      showToast(`🎲 Đã chọn ngẫu nhiên: "${picked.name}"`, 'success');
    } else {
      showToast('Đang tải danh sách phim, vui lòng thử lại sau...', 'info');
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
  }, [watchingMovie, watchEpIdx, selectedSlug, activeTab, genreFilter, countryFilter, searchQuery, currentPage]);

  const refreshStorage = () => {
    setFavorites(getFavorites());
    setHistory(getHistory());
  };

  useEffect(() => {
    return subscribeToStorage(() => {
      refreshStorage();
    });
  }, []);

  useEffect(() => {
    getNewUpdatedMovies(1).then((res) => setNewUpdated(res.items));
    getCatalogMovies('phim-le', 1).then((res) => setSingleMovies(res.items.slice(0, 18)));
    getCatalogMovies('phim-bo', 1).then((res) => setSeriesMovies(res.items.slice(0, 18)));
    getCatalogMovies('hoat-hinh', 1).then((res) => setAnimeMovies(res.items.slice(0, 18)));
    getCatalogMovies('tv-shows', 1).then((res) => setTvShows(res.items.slice(0, 18)));
    getCountryMovies('han-quoc', 1).then((res) => setKoreanMovies(res.items.slice(0, 18)));
    getGenreMovies('hanh-dong', 1).then((res) => setActionMovies(res.items.slice(0, 18)));
  }, []);

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
        onThemeChange={(themeId) => {
          const themeObj = THEME_OPTIONS.find((t) => t.id === themeId);
          showToast(`Đã chuyển tông màu: ${themeObj?.name || themeId} ✨`, 'success');
        }}
      />

      <main id="main-content" className="flex-1 pb-20 relative z-10">
        {activeTab === 'home' && (
          <>
            <HeroBanner
              movies={newUpdated.slice(0, 8)}
              onPlay={handleQuickPlay}
              onInfo={(m) => setSelectedSlug(m.slug)}
              favorites={favSlugs}
              onToggleFav={handleToggleFav}
            />

            {/* Quick Explore Category Chips */}
            <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider shrink-0 mr-1">
                  Khám phá nhanh:
                </span>
                {[
                  { id: 'phim-le', label: '🎬 Phim Lẻ Bom Tấn' },
                  { id: 'phim-bo', label: '📺 Phim Bộ Thịnh Hành' },
                  { id: 'hoat-hinh', label: '⚡ Anime / Hoạt Hình' },
                  { id: 'tv-shows', label: '🎪 TV Shows' },
                  { id: 'library', label: '⭐ Tủ Phim Của Bạn' },
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

              {/* TOP 10 Trending Row with Giant Ranking Numbers */}
              {newUpdated.length >= 5 && (
                <MovieRow
                  title="TOP 10 Thịnh Hành Nhất Hôm Nay"
                  subtitle="Bảng xếp hạng 10 siêu phẩm được quan tâm và xem nhiều nhất trong ngày"
                  badge="BẢNG XẾP HẠNG"
                  icon={<Trophy className="w-5 h-5 text-amber-400" />}
                  accentGradient="bg-gradient-to-b from-amber-400 via-orange-500 to-red-500 shadow-sm shadow-amber-500/50"
                  movies={newUpdated}
                  isTop10
                  onSelectMovie={(m) => setSelectedSlug(m.slug)}
                  onQuickPlay={handleQuickPlay}
                  favorites={favSlugs}
                  onToggleFav={handleToggleFav}
                />
              )}

              <MovieRow
                title="Mới Cập Nhật Hôm Nay"
                subtitle="Phim và tập mới nhất cập nhật liên tục từng phút"
                badge="HOT MỚI NHẤT"
                icon={<Sparkles className="w-5 h-5 text-rose-400" />}
                movies={newUpdated}
                onSelectMovie={(m) => setSelectedSlug(m.slug)}
                onQuickPlay={handleQuickPlay}
                favorites={favSlugs}
                onToggleFav={handleToggleFav}
              />

              {/* Curated Collection 1: K-Drama Hot */}
              <MovieRow
                title="K-Drama: Phim Bộ Hàn Quốc Gây Sốt"
                subtitle="Những tựa phim truyền hình xứ Kim Chi làm mưa làm gió khắp châu Á"
                badge="K-DRAMA TUYỂN CHỌN"
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
                title="Phim Lẻ Đỉnh Cao"
                subtitle="Bom tấn điện ảnh, chiếu rạp sắc nét chất lượng cao"
                badge="ĐIỆN ẢNH CHỌN LỌC"
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
                title="Siêu Phẩm Hành Động & Kịch Tính"
                subtitle="Những pha rượt đuổi nghẹt thở, kỹ xảo mãn nhãn đỉnh nóc kịch trần"
                badge="BLOCKBUSTER ACTION"
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
                title="Phim Bộ Thịnh Hành"
                subtitle="Drama Hàn Quốc, Trung Quốc, Âu Mỹ hấp dẫn"
                badge="SERIES DÀI TẬP"
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
          />
        )}
      </main>

      {/* Enhanced Footer */}
      <footer className="bg-[#07080b] border-t border-white/[0.08] py-12 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="w-full max-w-[1720px] mx-auto space-y-8">
          {/* Top Feature Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-8 border-b border-white/[0.06]">
            <div className="glass-panel p-4 rounded-2xl flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-400 flex items-center justify-center shrink-0 border border-red-500/30">
                🚀
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-zinc-100">Luồng Phát Tốc Độ Cao</h4>
                <p className="text-[11px] text-zinc-400">Xem m3u8 không giật lag, hỗ trợ Full HD & 4K</p>
              </div>
            </div>
            <div className="glass-panel p-4 rounded-2xl flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">
                📱
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-zinc-100">Hỗ Trợ PWA Ngoại Tuyến</h4>
                <p className="text-[11px] text-zinc-400">Cài đặt như app native trên điện thoại & máy tính</p>
              </div>
            </div>
            <div className="glass-panel p-4 rounded-2xl flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                ⭐
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-zinc-100">Tủ Phim Cá Nhân</h4>
                <p className="text-[11px] text-zinc-400">Lưu yêu thích, nhớ thời gian và sao lưu JSON</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="text-base font-black font-heading text-white tracking-tight">
                CINE<span className="bg-gradient-to-r from-red-500 to-amber-400 bg-clip-text text-transparent">HUB</span>
              </span>
              <span className="text-zinc-600">|</span>
              <span>Trải nghiệm xem phim điện ảnh trực tuyến chuẩn hiện đại</span>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <button onClick={() => { setActiveTab('home'); setCurrentPage(1); }} className="hover:text-white cursor-pointer">Trang Chủ</button>
              <button onClick={() => { setActiveTab('phim-le'); setCurrentPage(1); }} className="hover:text-white cursor-pointer">Phim Lẻ</button>
              <button onClick={() => { setActiveTab('phim-bo'); setCurrentPage(1); }} className="hover:text-white cursor-pointer">Phim Bộ</button>
              <button onClick={() => { setActiveTab('hoat-hinh'); setCurrentPage(1); }} className="hover:text-white cursor-pointer">Anime</button>
              <button onClick={() => { setActiveTab('library'); }} className="hover:text-white cursor-pointer">Tủ Phim</button>
            </div>
          </div>

          <div className="text-center text-[11px] text-zinc-400 border-t border-white/[0.04] pt-6">
            <p>© 2026 CineHub. Dữ liệu tổng hợp từ nguồn phim công khai PhimAPI và CDN quốc tế.</p>
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
        />
      )}

      {/* Global Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-7 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl glass-dropdown border border-white/20 shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-none"
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
          className="fixed bottom-6 right-6 p-3.5 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white shadow-2xl glow-red cursor-pointer transition-all z-40 hover:scale-110 active:scale-95 border border-white/20"
          title="Cuộn lên đầu trang"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

export default App;
