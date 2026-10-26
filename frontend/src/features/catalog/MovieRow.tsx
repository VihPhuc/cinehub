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
    <section className="py-5 px-4 sm:px-6 lg:px-8 max-w-[1720px] mx-auto w-full">
      {/* Header */}
      <div className="flex items-end justify-between mb-4">
        <div>
          {badge && (
            <div className="flex items-center gap-2 mb-1.5 pl-4">
              <span className="px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-black uppercase tracking-wider bg-white/[0.08] text-zinc-200 border border-white/15 backdrop-blur-md shadow-sm">
                {badge}
              </span>
            </div>
          )}
          <h2 className="text-xl sm:text-2xl font-black text-white font-heading flex items-center gap-2.5 tracking-tight">
            <span
              className={`w-1.5 h-6 rounded-full shrink-0 ${
                accentGradient || 'bg-gradient-to-b from-red-500 via-rose-500 to-amber-500 shadow-sm shadow-red-500/50'
              }`}
            />
            {icon && <span className="shrink-0 flex items-center">{icon}</span>}
            <span>{title}</span>
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
              className="group text-xs sm:text-sm font-bold text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors px-3 py-1.5 rounded-xl hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-red-500 min-h-[44px] min-w-[44px]"
            >
              Xem tất cả
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          )}
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              onClick={() => scroll('left')}
              className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl glass-pill hover:bg-white/15 text-zinc-300 hover:text-white transition-all cursor-pointer border border-white/10 hover:border-white/20 active:scale-95 focus-visible:ring-2 focus-visible:ring-red-500"
              title="Cuộn sang trái"
              aria-label="Cuộn sang trái"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl glass-pill hover:bg-white/15 text-zinc-300 hover:text-white transition-all cursor-pointer border border-white/10 hover:border-white/20 active:scale-95 focus-visible:ring-2 focus-visible:ring-red-500"
              title="Cuộn sang phải"
              aria-label="Cuộn sang phải"
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
    </section>
  );
});
