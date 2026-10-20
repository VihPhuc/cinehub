import React, { useState, useEffect } from 'react';
import { Play, Pause, Info, Star, ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import type { MovieItem } from '../types';
import { getImageUrl, prefetchMovieDetail } from '../services/api';

interface Props {
  movies: MovieItem[];
  onPlay: (movie: MovieItem) => void;
  onInfo: (movie: MovieItem) => void;
}

export const HeroBanner: React.FC<Props> = ({ movies, onPlay, onInfo }) => {
  const [index, setIndex] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const maxSlides = Math.min(movies.length, 6);

  // Auto rotate banner every 7s if not paused or hovered
  useEffect(() => {
    if (maxSlides <= 1 || !isAutoPlay || isHovered) return;
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % maxSlides);
    }, 7000);
    return () => clearInterval(interval);
  }, [maxSlides, isAutoPlay, isHovered]);

  const current = movies[index] || movies[0];
  const currentSlug = current?.slug;

  useEffect(() => {
    if (currentSlug) {
      prefetchMovieDetail(currentSlug);
    }
  }, [currentSlug]);

  if (!movies.length || !current) return null;
  const bg = getImageUrl(current.poster_url || current.thumb_url);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative w-full h-[480px] sm:h-[580px] lg:h-[650px] overflow-hidden bg-[#090a0f] group"
    >
      {/* Background Poster Image */}
      <div className="absolute inset-0">
        <img
          key={current.slug}
          src={bg}
          alt={current.name}
          className="w-full h-full object-cover object-top sm:object-center filter brightness-[0.4] transition-all duration-1000 ease-out scale-105 animate-in fade-in zoom-in-95"
        />
        {/* Cinematic gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#090a0f] via-[#090a0f]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#090a0f] via-[#090a0f]/75 sm:via-[#090a0f]/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent" />
      </div>

      {/* Hero Content Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 h-full flex flex-col justify-end pb-14 sm:pb-16">
        <div className="max-w-2xl sm:max-w-3xl space-y-4">
          {/* Top Badges */}
          <div className="flex items-center flex-wrap gap-2 text-xs font-bold">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/30 uppercase tracking-wider text-[11px]">
              <Flame className="w-3.5 h-3.5 fill-current" />
              TOP Nổi Bật
            </span>
            {current.quality && (
              <span className="px-2.5 py-1 rounded-full glass-pill text-zinc-100 font-extrabold uppercase text-[11px] border border-white/15">
                {current.quality}
              </span>
            )}
            {current.year && (
              <span className="px-2.5 py-1 rounded-full glass-pill text-zinc-300 font-medium text-[11px]">
                {current.year}
              </span>
            )}
            {current.tmdb?.vote_average ? (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-[11px]">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                {current.tmdb.vote_average.toFixed(1)} TMDB
              </span>
            ) : null}
          </div>

          {/* Title and Origin Name */}
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white font-heading tracking-tight drop-shadow-2xl leading-none sm:leading-tight">
              {current.name}
            </h1>
            {current.origin_name && (
              <p className="text-sm sm:text-lg text-zinc-300/90 font-medium italic drop-shadow-md">
                {current.origin_name}
              </p>
            )}
          </div>

          {/* Category Pills */}
          {current.category && current.category.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-0.5">
              {current.category.slice(0, 4).map((c) => (
                <span
                  key={c.slug}
                  className="px-3 py-1 rounded-lg glass-pill text-xs font-medium text-zinc-300"
                >
                  {c.name}
                </span>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3.5 pt-2">
            <button
              onClick={() => onPlay(current)}
              className="flex items-center gap-2.5 px-7 py-3 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-sm sm:text-base glow-red transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer shadow-xl"
            >
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              Xem Ngay
            </button>
            <button
              onClick={() => onInfo(current)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl glass-pill hover:bg-white/15 text-white font-bold text-sm sm:text-base transition-all duration-200 cursor-pointer border border-white/15 hover:border-white/30"
            >
              <Info className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-300" />
              Chi Tiết
            </button>
          </div>
        </div>
      </div>

      {/* Slide Indicators & Chevron Navigation */}
      {maxSlides > 1 && (
        <div className="absolute bottom-6 right-4 sm:right-6 z-20 flex items-center gap-4">
          {/* Progress / Dot Indicators */}
          <div className="flex items-center gap-1.5">
            {movies.slice(0, maxSlides).map((m, i) => (
              <button
                key={m.slug || i}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  index === i
                    ? 'w-7 bg-red-500 shadow-md shadow-red-500/50'
                    : 'w-2 bg-white/30 hover:bg-white/60'
                }`}
                title={m.name}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>

          {/* Controls: Play/Pause & Chevrons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsAutoPlay((prev) => !prev)}
              className={`p-2 rounded-xl glass-pill transition-all cursor-pointer border ${
                isAutoPlay
                  ? 'text-zinc-300 hover:text-white hover:bg-white/15 border-white/10'
                  : 'text-amber-400 bg-amber-500/10 border-amber-500/30'
              }`}
              title={isAutoPlay ? 'Tạm dừng tự động chuyển' : 'Bật tự động chuyển'}
              aria-label={isAutoPlay ? 'Pause auto-slide' : 'Resume auto-slide'}
            >
              {isAutoPlay ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            </button>
            <button
              onClick={() => setIndex((prev) => (prev - 1 + maxSlides) % maxSlides)}
              className="p-2 rounded-xl glass-pill hover:bg-white/15 text-zinc-300 hover:text-white transition-all cursor-pointer border border-white/10"
              aria-label="Previous Slide"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIndex((prev) => (prev + 1) % maxSlides)}
              className="p-2 rounded-xl glass-pill hover:bg-white/15 text-zinc-300 hover:text-white transition-all cursor-pointer border border-white/10"
              aria-label="Next Slide"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
