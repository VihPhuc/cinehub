import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronRight as ArrowRight } from 'lucide-react';
import type { MovieItem } from '../types';
import { MovieCard } from './MovieCard';

interface Props {
  title: string;
  subtitle?: string;
  movies: MovieItem[];
  isTop10?: boolean;
  onSelectMovie: (m: MovieItem) => void;
  onQuickPlay?: (m: MovieItem) => void;
  onViewMore?: () => void;
  favorites: string[];
  onToggleFav: (m: MovieItem) => void;
}

export const MovieRow: React.FC<Props> = ({
  title,
  subtitle,
  movies,
  isTop10,
  onSelectMovie,
  onQuickPlay,
  onViewMore,
  favorites,
  onToggleFav,
}) => {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollerRef.current) {
      const offset = direction === 'left' ? -600 : 600;
      scrollerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  if (!movies.length) return null;
  const displayMovies = isTop10 ? movies.slice(0, 10) : movies;

  return (
    <section className="py-5 px-4 sm:px-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white font-heading flex items-center gap-2.5 tracking-tight">
            <span className="w-1.5 h-6 rounded-full bg-gradient-to-b from-red-500 via-rose-500 to-amber-500 shadow-sm shadow-red-500/50" />
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 font-medium pl-4">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {onViewMore && (
            <button
              onClick={onViewMore}
              className="group text-xs sm:text-sm font-bold text-zinc-400 hover:text-red-400 flex items-center gap-1 cursor-pointer transition-colors px-3 py-1.5 rounded-xl hover:bg-white/[0.05]"
            >
              Xem tất cả
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          )}
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              onClick={() => scroll('left')}
              className="p-2 rounded-xl glass-pill hover:bg-white/15 text-zinc-300 hover:text-white transition-all cursor-pointer border border-white/10 hover:border-white/20 active:scale-95"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="p-2 rounded-xl glass-pill hover:bg-white/15 text-zinc-300 hover:text-white transition-all cursor-pointer border border-white/10 hover:border-white/20 active:scale-95"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal List */}
      <div
        ref={scrollerRef}
        className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 pt-1 scroll-smooth no-scrollbar"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {displayMovies.map((movie, idx) =>
          isTop10 ? (
            <div key={movie.slug} className="flex items-center shrink-0 pl-1">
              <span
                className="text-7xl sm:text-8xl lg:text-9xl font-black font-heading select-none -mr-4 sm:-mr-6 z-10 pointer-events-none drop-shadow-2xl"
                style={{
                  WebkitTextStroke: '2.5px rgba(255, 255, 255, 0.4)',
                  WebkitTextFillColor: '#0c0e16',
                  filter: 'drop-shadow(0 6px 16px rgba(225, 29, 72, 0.35))',
                }}
              >
                {idx + 1}
              </span>
              <div className="w-[145px] sm:w-[175px] lg:w-[195px] shrink-0">
                <MovieCard
                  movie={movie}
                  onClick={() => onSelectMovie(movie)}
                  onQuickPlay={() => (onQuickPlay ? onQuickPlay(movie) : onSelectMovie(movie))}
                  isFav={favorites.includes(movie.slug)}
                  onToggleFav={() => onToggleFav(movie)}
                />
              </div>
            </div>
          ) : (
            <div key={movie.slug} className="w-[145px] sm:w-[175px] lg:w-[195px] shrink-0">
              <MovieCard
                movie={movie}
                onClick={() => onSelectMovie(movie)}
                onQuickPlay={() => (onQuickPlay ? onQuickPlay(movie) : onSelectMovie(movie))}
                isFav={favorites.includes(movie.slug)}
                onToggleFav={() => onToggleFav(movie)}
              />
            </div>
          )
        )}
      </div>
    </section>
  );
};
