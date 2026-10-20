import { useEffect, useState } from 'react';
import {
  getCatalogMovies,
  getCountryMovies,
  getGenreMovies,
  getNewUpdatedMovies,
  getMovieDetail,
  searchMovies,
} from './services/api';
import type { MovieDetail, MovieItem, FavoriteItem, HistoryItem } from './types';
import { getFavorites, getHistory, toggleFavorite, clearHistory, removeHistoryItem } from './services/storage';
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
    toggleFavorite(movie);
    refreshStorage();
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
    <div className="min-h-screen bg-[#0f1015] text-zinc-100 flex flex-col font-sans">
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

      <main className="flex-1 pb-16">
        {activeTab === 'home' && (
          <>
            <HeroBanner
              movies={newUpdated.slice(0, 8)}
              onPlay={handleQuickPlay}
              onInfo={(m) => setSelectedSlug(m.slug)}
            />
            <div className="space-y-4 mt-2">
              <MovieRow
                title="Mới Cập Nhật Hôm Nay"
                subtitle="Phim và tập mới nhất cập nhật từng phút"
                movies={newUpdated}
                onSelectMovie={(m) => setSelectedSlug(m.slug)}
                onQuickPlay={handleQuickPlay}
                favorites={favSlugs}
                onToggleFav={handleToggleFav}
              />
              <MovieRow
                title="Phim Lẻ Đỉnh Cao"
                subtitle="Bom tấn điện ảnh, chiếu rạp chất lượng cao"
                movies={singleMovies}
                onSelectMovie={(m) => setSelectedSlug(m.slug)}
                onQuickPlay={handleQuickPlay}
                onViewMore={() => { setActiveTab('phim-le'); setCurrentPage(1); }}
                favorites={favSlugs}
                onToggleFav={handleToggleFav}
              />
              <MovieRow
                title="Phim Bộ Thịnh Hành"
                subtitle="Drama Hàn Quốc, Trung Quốc, Âu Mỹ hấp dẫn"
                movies={seriesMovies}
                onSelectMovie={(m) => setSelectedSlug(m.slug)}
                onQuickPlay={handleQuickPlay}
                onViewMore={() => { setActiveTab('phim-bo'); setCurrentPage(1); }}
                favorites={favSlugs}
                onToggleFav={handleToggleFav}
              />
              <MovieRow
                title="Thế Giới Anime & Hoạt Hình"
                subtitle="Tuyển tập anime hot, 3D Trung Quốc vietsub"
                movies={animeMovies}
                onSelectMovie={(m) => setSelectedSlug(m.slug)}
                onQuickPlay={handleQuickPlay}
                onViewMore={() => { setActiveTab('hoat-hinh'); setCurrentPage(1); }}
                favorites={favSlugs}
                onToggleFav={handleToggleFav}
              />
              <MovieRow
                title="TV Shows Đặc Sắc"
                subtitle="Chương trình truyền hình thực tế vui nhộn"
                movies={tvShows}
                onSelectMovie={(m) => setSelectedSlug(m.slug)}
                onQuickPlay={handleQuickPlay}
                onViewMore={() => { setActiveTab('tv-shows'); setCurrentPage(1); }}
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
            }}
            onRemoveHistoryItem={(slug, epSlug) => {
              removeHistoryItem(slug, epSlug);
              refreshStorage();
            }}
            onClearHistory={() => {
              clearHistory();
              refreshStorage();
            }}
            onDataImported={refreshStorage}
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

      <footer className="bg-zinc-950 border-t border-zinc-900 py-8 px-4 text-center text-xs text-zinc-500">
        <p className="font-semibold text-zinc-400 mb-1">CINEHUB - Web Xem Phim Toàn Diện</p>
        <p>Kho phim tổng hợp đa nguồn từ cổ điển tới chiếu rạp mới nhất. Hỗ trợ xem trực tuyến m3u8 và embed tốc độ cao.</p>
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
    </div>
  );
}

export default App;
