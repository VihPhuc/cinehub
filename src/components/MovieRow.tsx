import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronRight as ArrowRight } from 'lucide-react';
import type { MovieItem } from '../types';
import { MovieCard } from './MovieCard';

interface Props {
  title: string;
  subtitle?: string;
  movies: MovieItem[];
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

  return (
    <section className="py-4 px-4 sm:px-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <span className="w-1.5 h-5 bg-red-600 rounded-full inline-block" />
            {title}
          </h2>
          {subtitle && <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2">
          {onViewMore && (
            <button
              onClick={onViewMore}
              className="text-xs font-semibold text-zinc-400 hover:text-red-400 flex items-center gap-0.5 cursor-pointer"
            >
              Xem tất cả <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => scroll('left')}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal List */}
      <div
        ref={scrollerRef}
        className="flex gap-3 sm:gap-4 overflow-x-auto pb-3 pt-1 scroll-smooth no-scrollbar scrollbar-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {movies.map((movie) => (
          <div key={movie.slug} className="w-[140px] sm:w-[170px] lg:w-[190px] shrink-0">
            <MovieCard
              movie={movie}
              onClick={() => onSelectMovie(movie)}
              onQuickPlay={() => (onQuickPlay ? onQuickPlay(movie) : onSelectMovie(movie))}
              isFav={favorites.includes(movie.slug)}
              onToggleFav={() => onToggleFav(movie)}
            />
          </div>
        ))}
      </div>
    </section>
  );
};
