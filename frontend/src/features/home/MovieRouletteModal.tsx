import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Sparkles, Play, Info, Calendar, RefreshCw, Film } from 'lucide-react';
import type { MovieItem } from '@/shared/types';
import { getImageUrl, formatMovieTitle } from '@/shared/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  movies: MovieItem[];
  onSelectMovie: (slug: string) => void;
  onWatchMovie?: (slug: string) => void;
}

export const MovieRouletteModal: React.FC<Props> = ({
  isOpen,
  onClose,
  movies,
  onSelectMovie,
  onWatchMovie,
}) => {
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentMovie, setCurrentMovie] = useState<MovieItem | null>(null);

  const spinTimerRef = useRef<number | null>(null);
  const spinActiveRef = useRef<boolean>(false);

  // Extract unique genres from available movies
  const availableGenres = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of movies) {
      if (m.category) {
        for (const c of m.category) {
          if (c.slug && c.name) map.set(c.slug, c.name);
        }
      }
    }
    return Array.from(map.entries())
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [movies]);

  // Filter movies by genre
  const filteredPool = useMemo(() => {
    if (selectedGenre === 'all') return movies;
    return movies.filter((m) =>
      m.category?.some(
        (c) => c.slug === selectedGenre || c.name.toLowerCase() === selectedGenre.toLowerCase()
      )
    );
  }, [movies, selectedGenre]);

  // Physics-based ease-out shuffle function
  const spin = useCallback((pool: MovieItem[]) => {
    if (!pool || pool.length === 0 || spinActiveRef.current) return;
    spinActiveRef.current = true;
    setIsSpinning(true);

    if (spinTimerRef.current) {
      window.clearTimeout(spinTimerRef.current);
      spinTimerRef.current = null;
    }

    const totalSteps = 14;
    let step = 0;

    const tick = () => {
      step++;
      const randomIdx = Math.floor(Math.random() * pool.length);
      setCurrentMovie(pool[randomIdx]);

      if (step >= totalSteps) {
        // Prioritize a well-rated movie or pick random from the pool
        const candidatePool = pool.filter((m) => (m.tmdb?.vote_average || 0) >= 6.5);
        const finalPool = candidatePool.length >= 3 ? candidatePool : pool;
        const finalPick = finalPool[Math.floor(Math.random() * finalPool.length)];

        setCurrentMovie(finalPick);
        setIsSpinning(false);
        spinActiveRef.current = false;
        spinTimerRef.current = null;
      } else {
        // Deceleration ease-out curve (fast at start, slower at end)
        const progress = step / totalSteps;
        const delay = Math.round(50 + progress * progress * 240);
        spinTimerRef.current = window.setTimeout(tick, delay);
      }
    };

    tick();
  }, []);

  // Trigger spin when modal opens
  useEffect(() => {
    if (isOpen && movies.length > 0) {
      const pool = selectedGenre === 'all'
        ? movies
        : movies.filter((m) =>
            m.category?.some(
              (c) => c.slug === selectedGenre || c.name.toLowerCase() === selectedGenre.toLowerCase()
            )
          );
      const activePool = pool.length > 0 ? pool : movies;
      spin(activePool);
    }

    return () => {
      if (spinTimerRef.current) {
        window.clearTimeout(spinTimerRef.current);
        spinTimerRef.current = null;
      }
      spinActiveRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // Intentionally only trigger on modal open/close

  const handleSelectGenre = (newGenre: string) => {
    setSelectedGenre(newGenre);
    const newPool = newGenre === 'all'
      ? movies
      : movies.filter((m) =>
          m.category?.some(
            (c) => c.slug === newGenre || c.name.toLowerCase() === newGenre.toLowerCase()
          )
        );
    if (newPool.length > 0) {
      spin(newPool);
    }
  };

  const handleManualSpin = () => {
    if (!isSpinning && filteredPool.length > 0) {
      spin(filteredPool);
    }
  };

  if (!isOpen) return null;

  const title = currentMovie ? formatMovieTitle(currentMovie.name) : '';
  const matchPercent = currentMovie?.tmdb?.vote_average
    ? Math.min(99, Math.max(65, Math.round(currentMovie.tmdb.vote_average * 10)))
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Gợi ý phim ngẫu nhiên"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-2xl animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md rounded-3xl bg-[#181818] border border-white/[0.1] shadow-[0_20px_60px_rgba(0,0,0,0.8)] p-5 sm:p-6 flex flex-col items-center text-center overflow-hidden">
        {/* Ambient Top Glow (Netflix Red) */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#E50914] to-transparent" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#E50914]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="w-full flex items-center justify-between pb-3.5 mb-3.5 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#E50914]/15 border border-[#E50914]/30 text-[#E50914] flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-left">
              <h2 className="text-sm sm:text-base font-extrabold font-heading text-white tracking-tight flex items-center gap-1.5">
                Gợi Ý Phim Bất Ngờ
              </h2>
              <p className="text-[11px] text-zinc-400">
                Để CineHub chọn bộ phim hoàn hảo cho bạn!
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.15] text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Đóng gợi ý phim"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Genre Filter */}
        <div className="w-full flex items-center justify-between gap-2 mb-3.5 bg-black/40 px-3 py-2 rounded-xl border border-white/[0.06]">
          <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5 shrink-0">
            <Film className="w-3.5 h-3.5 text-[#E50914]" />
            Thể loại:
          </span>
          <select
            value={selectedGenre}
            onChange={(e) => handleSelectGenre(e.target.value)}
            disabled={isSpinning}
            className="px-2.5 py-1 text-xs bg-[#222] border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#E50914] cursor-pointer disabled:opacity-50"
          >
            <option value="all">Tất cả thể loại ({movies.length})</option>
            {availableGenres.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        {/* Movie Shuffle Preview Card */}
        {currentMovie ? (
          <div
            className={`w-full flex flex-col items-center p-3.5 rounded-2xl bg-black/30 border transition-all duration-300 ${
              isSpinning
                ? 'border-white/10 scale-95 opacity-80 blur-[0.4px]'
                : 'border-[#E50914]/40 shadow-xl shadow-[#E50914]/10 scale-100 opacity-100'
            }`}
          >
            {/* Poster with Netflix Badges */}
            <div className="relative aspect-[2/3] w-36 sm:w-40 rounded-xl overflow-hidden shadow-2xl border border-white/10 mb-3">
              <img
                src={getImageUrl(currentMovie.poster_url || currentMovie.thumb_url)}
                alt={title}
                className="w-full h-full object-cover"
                loading="eager"
              />

              {/* Match Score Badge (Netflix Green) */}
              {matchPercent && (
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur-md border border-[#46d369]/40 text-[#46d369] font-black text-[11px] shadow-lg">
                  {matchPercent}% Phù hợp
                </div>
              )}

              {/* Quality Badge */}
              <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-[#E50914] text-white font-black text-[9px] uppercase tracking-wider shadow-md">
                {currentMovie.quality || 'HD'}
              </div>
            </div>

            {/* Title & Metadata */}
            <h3 className="text-base sm:text-lg font-black text-white font-heading truncate max-w-full px-2">
              {title}
            </h3>
            {currentMovie.origin_name && (
              <p className="text-xs text-zinc-400 truncate max-w-full px-2 mt-0.5 font-medium">
                {currentMovie.origin_name}
              </p>
            )}

            <div className="flex items-center gap-2 mt-2 text-xs text-zinc-300 flex-wrap justify-center">
              {currentMovie.year && (
                <span className="flex items-center gap-1 font-semibold text-zinc-400">
                  <Calendar className="w-3.5 h-3.5" />
                  {currentMovie.year}
                </span>
              )}
              {currentMovie.episode_current && (
                <span className="px-2 py-0.5 rounded bg-white/[0.08] text-zinc-300 font-bold text-[11px]">
                  {currentMovie.episode_current}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="py-14 text-center text-zinc-400 text-xs">
            {filteredPool.length === 0
              ? 'Không có phim phù hợp trong thể loại này.'
              : 'Đang chuẩn bị danh sách phim...'}
          </div>
        )}

        {/* Action Controls */}
        <div className="w-full flex items-center justify-center gap-2 mt-4 flex-wrap">
          {isSpinning ? (
            <div className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-white/10 text-zinc-300 font-bold text-xs sm:text-sm">
              <RefreshCw className="w-4 h-4 animate-spin text-[#E50914]" />
              <span>Đang chọn phim...</span>
            </div>
          ) : (
            <>
              {currentMovie && onWatchMovie && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onWatchMovie(currentMovie.slug);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white hover:bg-white/85 text-black font-extrabold text-xs sm:text-sm cursor-pointer shadow-xl transition-transform active:scale-95"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Xem Phim</span>
                </button>
              )}

              {currentMovie && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSelectMovie(currentMovie.slug);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-zinc-700/80 hover:bg-zinc-700 text-white font-bold text-xs sm:text-sm cursor-pointer backdrop-blur-md transition-transform active:scale-95"
                >
                  <Info className="w-4 h-4 text-zinc-300" />
                  <span>Chi Tiết</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleManualSpin}
                disabled={filteredPool.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-white/20 hover:border-white text-zinc-300 hover:text-white font-bold text-xs sm:text-sm cursor-pointer hover:bg-white/10 transition-all active:scale-95 disabled:opacity-50"
                title="Đổi sang phim ngẫu nhiên khác"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Đổi Phim</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
