import { useEffect, useState, useRef } from 'react';
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
import { getFavorites, getHistory, toggleFavorite, clearHistory, removeHistoryItem } from './services/storage';
import { ArrowUp, WifiOff, Play, Clock, ChevronRight } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { HeroBanner } from './components/HeroBanner';
import { MovieRow } from './components/MovieRow';
import { MovieGrid } from './components/MovieGrid';
import { MovieDetailModal } from './components/MovieDetailModal';
import { VideoPlayer } from './components/VideoPlayer';
import { LibraryView } from './components/LibraryView';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('home');
  const [genreFilter, setGenreFilter] = useState({ slug: '', name: '' });
  const [countryFilter, setCountryFilter] = useState({ slug: '', name: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const [newUpdated, setNewUpdated] = useState<MovieItem[]>([]);
  const [singleMovies, setSingleMovies] = useState<MovieItem[]>([]);
  const [seriesMovies, setSeriesMovies] = useState<MovieItem[]>([]);
  const [animeMovies, setAnimeMovies] = useState<MovieItem[]>([]);
  const [tvShows, setTvShows] = useState<MovieItem[]>([]);

  const [catalogList, setCatalogList] = useState<MovieItem[]>([]);
  const [catalogTitle, setCatalogTitle] = useState('');

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [watchingMovie, setWatchingMovie] = useState<MovieDetail | null>(null);
  const [watchServerIdx, setWatchServerIdx] = useState(0);
  const [watchEpIdx, setWatchEpIdx] = useState(0);

  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [toast, setToast] = useState<{ msg: string; type?: 'info' | 'success' } | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const showToast = (msg: string, type: 'info' | 'success' = 'info') => {
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    setToast({ msg, type });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3000);
  };

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
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ponytail: url sync uses native URLSearchParams instead of router package
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const watchSlug = params.get('watch');
    const epIdxParam = parseInt(params.get('ep') || '0', 10);
    const infoSlug = params.get('info');
    const tabParam = params.get('tab');
    const genreParam = params.get('genre');
    const genreName = params.get('genreName') || '';
    const countryParam = params.get('country');
    const countryName = params.get('countryName') || '';
    const qParam = params.get('q');
    const pageParam = parseInt(params.get('page') || '1', 10);

    if (watchSlug) {
      getMovieDetail(watchSlug).then((d) => {
        if (d) {
          setWatchingMovie(d);
          setWatchEpIdx(isNaN(epIdxParam) ? 0 : epIdxParam);
        }
      });
    } else if (infoSlug) {
      setSelectedSlug(infoSlug);
    }

    if (tabParam) setActiveTab(tabParam);
    if (genreParam) {
      setGenreFilter({ slug: genreParam, name: genreName });
      setActiveTab('genre');
    }
    if (countryParam) {
      setCountryFilter({ slug: countryParam, name: countryName });
      setActiveTab('country');
    }
    if (qParam) {
      setSearchQuery(qParam);
      setActiveTab('search');
    }
    if (pageParam > 1) setCurrentPage(pageParam);

    const onPopState = () => {
      const p = new URLSearchParams(window.location.search);
      const wSlug = p.get('watch');
      const epVal = parseInt(p.get('ep') || '0', 10);
      const iSlug = p.get('info');
      const tVal = p.get('tab') || 'home';

      if (wSlug) {
        getMovieDetail(wSlug).then((d) => {
          if (d) {
            setWatchingMovie(d);
            setWatchEpIdx(isNaN(epVal) ? 0 : epVal);
          }
        });
      } else {
        setWatchingMovie(null);
      }
      setSelectedSlug(iSlug || null);
      setActiveTab(tVal);
      if (tVal === 'genre') {
        setGenreFilter({ slug: p.get('genre') || '', name: p.get('genreName') || '' });
      }
      if (tVal === 'country') {
        setCountryFilter({ slug: p.get('country') || '', name: p.get('countryName') || '' });
      }
      if (tVal === 'search') {
        setSearchQuery(p.get('q') || '');
      }
      setCurrentPage(parseInt(p.get('page') || '1', 10));
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (watchingMovie) {
      params.set('watch', watchingMovie.slug);
      if (watchEpIdx > 0) params.set('ep', String(watchEpIdx));
    } else {
      if (selectedSlug) params.set('info', selectedSlug);
      if (activeTab !== 'home') params.set('tab', activeTab);
      if (activeTab === 'genre' && genreFilter.slug) {
        params.set('genre', genreFilter.slug);
        params.set('genreName', genreFilter.name);
      }
      if (activeTab === 'country' && countryFilter.slug) {
        params.set('country', countryFilter.slug);
        params.set('countryName', countryFilter.name);
      }
      if (activeTab === 'search' && searchQuery) params.set('q', searchQuery);
      if (currentPage > 1) params.set('page', String(currentPage));
    }
    const newSearch = params.toString();
    const currentSearch = window.location.search.replace(/^\?/, '');
    if (newSearch !== currentSearch) {
      const newUrl = newSearch ? `${window.location.pathname}?${newSearch}` : window.location.pathname;
      window.history.pushState(null, '', newUrl);
    }
  }, [watchingMovie, watchEpIdx, selectedSlug, activeTab, genreFilter, countryFilter, searchQuery, currentPage]);

  const refreshStorage = () => {
    setFavorites(getFavorites());
    setHistory(getHistory());
  };

  useEffect(() => {
    refreshStorage();
    getNewUpdatedMovies(1).then((res) => setNewUpdated(res.items));
    getCatalogMovies('phim-le', 1).then((res) => setSingleMovies(res.items.slice(0, 18)));
    getCatalogMovies('phim-bo', 1).then((res) => setSeriesMovies(res.items.slice(0, 18)));
    getCatalogMovies('hoat-hinh', 1).then((res) => setAnimeMovies(res.items.slice(0, 18)));
    getCatalogMovies('tv-shows', 1).then((res) => setTvShows(res.items.slice(0, 18)));
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (activeTab === 'home' || activeTab === 'library') return;

    setLoading(true);
    if (activeTab === 'search') {
      searchMovies(searchQuery, currentPage).then((res) => {
        setCatalogList(res.items);
        setCatalogTitle(`Tìm kiếm: "${searchQuery}"`);
        setTotalPages(res.totalPages);
        setLoading(false);
      });
    } else if (activeTab === 'genre') {
      getGenreMovies(genreFilter.slug, currentPage).then((res) => {
        setCatalogList(res.items);
        setCatalogTitle(`Thể loại: ${genreFilter.name}`);
        setTotalPages(res.totalPages);
        setLoading(false);
      });
    } else if (activeTab === 'country') {
      getCountryMovies(countryFilter.slug, currentPage).then((res) => {
        setCatalogList(res.items);
        setCatalogTitle(`Phim ${countryFilter.name}`);
        setTotalPages(res.totalPages);
        setLoading(false);
      });
    } else if (['phim-le', 'phim-bo', 'hoat-hinh', 'tv-shows'].includes(activeTab)) {
      getCatalogMovies(activeTab as any, currentPage).then((res) => {
        setCatalogList(res.items);
        setCatalogTitle(res.title || 'Danh Sách Phim');
        setTotalPages(res.totalPages);
        setLoading(false);
      });
    }
  }, [activeTab, genreFilter, countryFilter, searchQuery, currentPage]);

  const handleStartWatch = (movie: MovieDetail, sIdx = 0, epIdx = 0) => {
    setSelectedSlug(null);
    setWatchingMovie(movie);
    setWatchServerIdx(sIdx);
    setWatchEpIdx(epIdx);
  };

  const handleQuickPlay = async (movie: MovieItem) => {
    const detail = await getMovieDetail(movie.slug);
    if (detail) handleStartWatch(detail, 0, 0);
  };

  const handleResumePlay = async (h: HistoryItem) => {
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
      handleStartWatch(detail, sIdx, epIdx);
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

  const favSlugs = favorites.map((f) => f.slug);

  if (watchingMovie) {
    return (
      <VideoPlayer
        movie={watchingMovie}
        initialServerIdx={watchServerIdx}
        initialEpIdx={watchEpIdx}
        onEpChange={(idx) => setWatchEpIdx(idx)}
        onBack={() => {
          setWatchingMovie(null);
          refreshStorage();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#090a0f] text-zinc-100 flex flex-col font-sans relative overflow-x-hidden">
      {/* Ambient Top Glow */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[900px] h-[360px] bg-red-600/[0.08] blur-[140px] rounded-full z-0" />
      <div className="pointer-events-none fixed bottom-1/3 right-0 w-[500px] h-[500px] bg-indigo-600/[0.04] blur-[150px] rounded-full z-0" />

      {isOffline && (
        <div className="bg-gradient-to-r from-amber-600 to-amber-500 text-zinc-950 font-black text-xs py-2 px-4 text-center flex items-center justify-center gap-2 sticky top-0 z-50 shadow-lg">
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
      />

      <main className="flex-1 pb-20 relative z-10">
        {activeTab === 'home' && (
          <>
            <HeroBanner
              movies={newUpdated.slice(0, 8)}
              onPlay={handleQuickPlay}
              onInfo={(m) => setSelectedSlug(m.slug)}
            />

            {/* Quick Explore Category Chips */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-2">
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
                    className="shrink-0 px-3.5 py-1.5 rounded-xl glass-pill hover:bg-white/15 text-xs font-semibold text-zinc-300 hover:text-white transition-all cursor-pointer border border-white/10"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6 mt-2">
              {/* Continue Watching Row */}
              {history.length > 0 && (
                <section className="px-4 sm:px-6 max-w-7xl mx-auto w-full">
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
                            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/80 backdrop-blur-md text-amber-300 border border-amber-500/30">
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
                            <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-2 pt-1 border-t border-white/[0.04]">
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

              <MovieRow
                title="Mới Cập Nhật Hôm Nay"
                subtitle="Phim và tập mới nhất cập nhật liên tục từng phút"
                movies={newUpdated}
                onSelectMovie={(m) => setSelectedSlug(m.slug)}
                onQuickPlay={handleQuickPlay}
                favorites={favSlugs}
                onToggleFav={handleToggleFav}
              />
              <MovieRow
                title="Phim Lẻ Đỉnh Cao"
                subtitle="Bom tấn điện ảnh, chiếu rạp sắc nét chất lượng cao"
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
              <MovieRow
                title="Phim Bộ Thịnh Hành"
                subtitle="Drama Hàn Quốc, Trung Quốc, Âu Mỹ hấp dẫn"
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
      <footer className="bg-[#07080b] border-t border-white/[0.08] py-12 px-4 sm:px-6 relative z-10">
        <div className="max-w-7xl mx-auto space-y-8">
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
          slug={selectedSlug}
          onClose={() => setSelectedSlug(null)}
          onWatch={handleStartWatch}
          isFav={favSlugs.includes(selectedSlug)}
          onToggleFav={handleToggleFav}
        />
      )}

      {/* Global Toast Notification */}
      {toast && (
        <div className="fixed bottom-7 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl glass-dropdown border border-white/20 shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-none">
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
