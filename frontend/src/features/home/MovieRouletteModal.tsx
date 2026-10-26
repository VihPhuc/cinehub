import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Dices, Play, Info, Star, Calendar, RefreshCw } from 'lucide-react';
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
  const [hasSpun, setHasSpun] = useState(false);
  const spinTimerRef = useRef<number | null>(null);

  // Extract unique genres from available movies
  const availableGenres = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const m of movies) {
      if (m.category) {
        for (const c of m.category) {
          if (c.slug && c.name) map.set(c.slug, c.name);
        }
      }
    }
    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
  }, [movies]);

  // Filter movies by genre
  const filteredPool = React.useMemo(() => {
    if (selectedGenre === 'all') return movies;
    return movies.filter((m) =>
      m.category?.some((c) => c.slug === selectedGenre || c.name.toLowerCase() === selectedGenre.toLowerCase())
    );
  }, [movies, selectedGenre]);

  const handleSpin = React.useCallback(() => {
    if (filteredPool.length === 0 || isSpinning) return;
    setIsSpinning(true);
    setHasSpun(true);

    let counter = 0;
    const totalSteps = 16;
    const intervalTime = 80;

    if (spinTimerRef.current) window.clearInterval(spinTimerRef.current);

    spinTimerRef.current = window.setInterval(() => {
      counter++;
      const randomIdx = Math.floor(Math.random() * filteredPool.length);
      setCurrentMovie(filteredPool[randomIdx]);

      if (counter >= totalSteps) {
        if (spinTimerRef.current) {
          window.clearInterval(spinTimerRef.current);
          spinTimerRef.current = null;
        }
        // Prioritize a well-rated movie or final random
        const candidatePool = filteredPool.filter((m) => (m.tmdb?.vote_average || 0) >= 6);
        const finalPool = candidatePool.length > 3 ? candidatePool : filteredPool;
        const finalPick = finalPool[Math.floor(Math.random() * finalPool.length)];
        setCurrentMovie(finalPick);
        setIsSpinning(false);
      }
    }, intervalTime);
  }, [filteredPool, isSpinning]);

  useEffect(() => {
    let timeoutId: number | null = null;
    if (isOpen && !hasSpun && filteredPool.length > 0) {
      timeoutId = window.setTimeout(() => {
        handleSpin();
      }, 50);
    }
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      if (spinTimerRef.current) {
        window.clearInterval(spinTimerRef.current);
        spinTimerRef.current = null;
      }
    };
  }, [isOpen, hasSpun, filteredPool.length, handleSpin]);

  if (!isOpen) return null;

  const title = currentMovie ? formatMovieTitle(currentMovie.name) : '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Vòng quay phim ngẫu nhiên"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-[#0c0e17]/95 border border-amber-500/30 shadow-2xl shadow-amber-500/10 p-6 sm:p-7 flex flex-col items-center text-center overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 via-rose-500 to-red-500" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="w-full flex items-center justify-between pb-4 mb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Dices className="w-5 h-5 animate-pulse" />
            </div>
            <div className="text-left">
              <h2 className="text-base sm:text-lg font-black font-heading text-white tracking-tight flex items-center gap-1.5">
                Vòng Quay Điện Ảnh
                <Sparkles className="w-4 h-4 text-amber-400" />
              </h2>
              <p className="text-[11px] sm:text-xs text-zinc-400">
                Không biết xem gì? Hãy để CineHub chọn cho bạn!
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Đóng vòng quay"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Genre Selector */}
        <div className="w-full flex items-center justify-between gap-2 mb-4 bg-white/[0.03] p-2 rounded-2xl border border-white/[0.06]">
          <span className="text-xs font-bold text-zinc-300 pl-2 shrink-0">Thể loại:</span>
          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            disabled={isSpinning}
            className="px-3 py-1.5 text-xs bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-400 cursor-pointer disabled:opacity-50"
          >
            <option value="all">Tất cả thể loại ({movies.length})</option>
            {availableGenres.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        {/* Movie Roulette Card */}
        {currentMovie ? (
          <div
            className={`w-full flex flex-col items-center my-2 p-4 rounded-2xl bg-white/[0.03] border transition-all duration-300 ${
              isSpinning
                ? 'border-white/10 scale-95 opacity-80 blur-[0.5px]'
                : 'border-amber-500/40 shadow-xl shadow-amber-500/10 scale-100 opacity-100'
            }`}
          >
            <div className="relative aspect-[2/3] w-36 sm:w-44 rounded-2xl overflow-hidden shadow-2xl border border-white/10 mb-3.5">
              <img
                src={getImageUrl(currentMovie.poster_url || currentMovie.thumb_url)}
                alt={title}
                className="w-full h-full object-cover"
              />
              {currentMovie.tmdb?.vote_average ? (
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-black/80 backdrop-blur-md border border-amber-500/40 text-amber-400 font-black text-xs flex items-center gap-1 shadow-lg">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {currentMovie.tmdb.vote_average.toFixed(1)}
                </div>
              ) : null}
            </div>

            <h3 className="text-base sm:text-lg font-black text-white font-heading truncate max-w-full px-2">
              {title}
            </h3>
            {currentMovie.origin_name && (
              <p className="text-xs text-zinc-400 truncate max-w-full px-2 mt-0.5 font-medium">
                {currentMovie.origin_name}
              </p>
            )}

            <div className="flex items-center gap-2 mt-2 text-xs text-zinc-300">
              {currentMovie.year && (
                <span className="flex items-center gap-1 font-semibold text-zinc-400">
                  <Calendar className="w-3.5 h-3.5" />
                  {currentMovie.year}
                </span>
              )}
              {currentMovie.quality && (
                <span className="px-1.5 py-0.5 rounded bg-red-600/80 text-white font-bold text-[10px]">
                  {currentMovie.quality}
                </span>
              )}
              {currentMovie.episode_current && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px] border border-amber-500/30">
                  {currentMovie.episode_current}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="py-16 text-center text-zinc-400 text-xs">
            Đang chuẩn bị danh sách phim...
          </div>
        )}

        {/* Action Controls */}
        <div className="w-full flex items-center justify-center gap-2.5 mt-2 flex-wrap">
          <button
            type="button"
            onClick={handleSpin}
            disabled={isSpinning || filteredPool.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-black font-black text-xs sm:text-sm cursor-pointer shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
            <span>{isSpinning ? 'Đang quay...' : 'Quay Lại Lần Nữa'}</span>
          </button>

          {currentMovie && !isSpinning && (
            <>
              {onWatchMovie && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onWatchMovie(currentMovie.slug);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs sm:text-sm cursor-pointer shadow-lg shadow-red-600/30 hover:scale-105 active:scale-95 transition-all"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Xem Phim</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSelectMovie(currentMovie.slug);
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl glass-pill hover:bg-white/15 text-zinc-200 hover:text-white font-bold text-xs sm:text-sm cursor-pointer border border-white/10 transition-all"
              >
                <Info className="w-4 h-4 text-zinc-400" />
                <span>Chi Tiết</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
