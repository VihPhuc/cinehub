import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronRight as ArrowRight } from 'lucide-react';
import type { MovieItem } from '@/shared/types';
import { MovieCard } from './MovieCard';

interface Props {
  title: string;
  subtitle?: string;
  movies: MovieItem[];
  isTop10?: boolean;
  icon?: React.ReactNode;
  badge?: string;
  accentGradient?: string;
  onSelectMovie: (m: MovieItem) => void;
  onQuickPlay?: (m: MovieItem) => void;
  onViewMore?: () => void;
  favorites: string[];
  onToggleFav: (m: MovieItem) => void;
  showUpdatedAt?: boolean;
}

export const MovieRow: React.FC<Props> = React.memo(({
  title,
  subtitle,
  movies,
  isTop10,
  icon,
  badge,
  accentGradient,
  onSelectMovie,
  onQuickPlay,
  onViewMore,
  favorites,
  onToggleFav,
  showUpdatedAt,
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
    <section className="py-4 px-4 sm:px-6 lg:px-8 max-w-[1720px] mx-auto w-full group/row relative">
      {/* Header */}
      <div className="flex items-end justify-between mb-3">
        <div>
          {badge && (
            <div className="flex items-center gap-2 mb-1.5 pl-3.5">
              <span className="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-black uppercase tracking-wider bg-white/[0.08] text-zinc-200 border border-white/15 backdrop-blur-md shadow-sm">
                {badge}
              </span>
            </div>
          )}
          <h2 className="text-lg sm:text-xl md:text-2xl font-black text-white font-heading flex items-center gap-2.5 tracking-tight">
            <span
              className={`w-1 h-5 sm:h-6 rounded-full shrink-0 ${
                accentGradient || 'bg-gradient-to-b from-[#E50914] via-red-600 to-rose-600 shadow-sm shadow-red-600/50'
              }`}
            />
            {icon && <span className="shrink-0 flex items-center">{icon}</span>}
            <span>{title}</span>
          </h2>
          {subtitle && (
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 font-medium pl-3.5">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {onViewMore && (
            <button
              onClick={onViewMore}
              className="group text-xs sm:text-sm font-bold text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors px-3 py-1.5 rounded-md hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-red-500 min-h-[40px]"
            >
              Xem tất cả
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          )}
        </div>
      </div>

      {/* Horizontal List with Netflix Side Paddles */}
      <div className="relative">
        {/* Left Side Paddle */}
        <button
          type="button"
          onClick={() => scroll('left')}
          className="hidden md:flex absolute left-0 top-0 bottom-4 w-10 sm:w-11 bg-black/60 hover:bg-black/90 text-white items-center justify-center z-30 cursor-pointer opacity-0 group-hover/row:opacity-100 transition-all backdrop-blur-sm rounded-r-md border-r border-y border-white/10 shadow-2xl"
          aria-label={`Cuộn sang trái ${title}`}
          title="Cuộn sang trái"
        >
          <ChevronLeft className="w-6 h-6 group-hover:scale-125 transition-transform" />
        </button>

        {/* Right Side Paddle */}
        <button
          type="button"
          onClick={() => scroll('right')}
          className="hidden md:flex absolute right-0 top-0 bottom-4 w-10 sm:w-11 bg-black/60 hover:bg-black/90 text-white items-center justify-center z-30 cursor-pointer opacity-0 group-hover/row:opacity-100 transition-all backdrop-blur-sm rounded-l-md border-l border-y border-white/10 shadow-2xl"
          aria-label={`Cuộn sang phải ${title}`}
          title="Cuộn sang phải"
        >
          <ChevronRight className="w-6 h-6 group-hover:scale-125 transition-transform" />
        </button>

        <div
          ref={scrollerRef}
          className="flex gap-2.5 sm:gap-3.5 overflow-x-auto pb-4 pt-1 scroll-smooth no-scrollbar"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {displayMovies.map((movie, idx) =>
            isTop10 ? (
              <div key={movie.slug} className="flex items-center shrink-0 pl-1 group">
                <span
                  className="text-6xl sm:text-7xl lg:text-8xl font-black font-heading select-none -mr-3 sm:-mr-4 z-10 pointer-events-none drop-shadow-2xl transition-transform duration-300 group-hover:scale-105"
                  style={{
                    background:
                      idx === 0
                        ? 'linear-gradient(180deg, #FEF08A 0%, #EAB308 50%, #92400E 100%)'
                        : idx === 1
                        ? 'linear-gradient(180deg, #FFFFFF 0%, #E2E8F0 50%, #64748B 100%)'
                        : idx === 2
                        ? 'linear-gradient(180deg, #FED7AA 0%, #F97316 50%, #9A3412 100%)'
                        : 'linear-gradient(180deg, #FFFFFF 0%, #94A3B8 60%, #334155 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    WebkitTextStroke: '1.5px rgba(255, 255, 255, 0.5)',
                    filter:
                      idx === 0
                        ? 'drop-shadow(0 4px 18px rgba(234, 179, 8, 0.45))'
                        : idx === 1
                        ? 'drop-shadow(0 4px 16px rgba(148, 163, 184, 0.4))'
                        : idx === 2
                        ? 'drop-shadow(0 4px 16px rgba(249, 115, 22, 0.4))'
                        : 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.6))',
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
                    showUpdatedAt={showUpdatedAt}
                    rank={idx + 1}
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
                  showUpdatedAt={showUpdatedAt}
                />
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
});
