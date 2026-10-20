import React, { useState, useEffect } from 'react';
import { Play, Info, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MovieItem } from '../types';
import { getImageUrl } from '../services/api';

interface Props {
  movies: MovieItem[];
  onPlay: (movie: MovieItem) => void;
  onInfo: (movie: MovieItem) => void;
}

export const HeroBanner: React.FC<Props> = ({ movies, onPlay, onInfo }) => {
  const [index, setIndex] = useState(0);

  // Auto rotate banner every 7s
  useEffect(() => {
    if (movies.length <= 1) return;
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % Math.min(movies.length, 6));
    }, 7000);
    return () => clearInterval(interval);
  }, [movies]);

  if (!movies.length) return null;
  const current = movies[index] || movies[0];
  const bg = getImageUrl(current.poster_url || current.thumb_url);

  return (
    <div className="relative w-full h-[450px] sm:h-[550px] lg:h-[600px] overflow-hidden bg-zinc-950">
      {/* Background with cinematic gradients */}
      <img
        src={bg}
        alt={current.name}
        className="w-full h-full object-cover object-center filter brightness-[0.45] transition-all duration-700 scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0f1015] via-[#0f1015]/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0f1015] via-[#0f1015]/50 to-transparent" />

      {/* Content */}
      <div className="absolute inset-0 max-w-7xl mx-auto px-4 sm:px-6 flex flex-col justify-end pb-12 sm:pb-16">
        <div className="max-w-2xl space-y-3">
          {/* Badges */}
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="px-2 py-0.5 rounded bg-red-600 text-white font-bold uppercase tracking-wider">
              Nổi Bật
            </span>
            {current.quality && (
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">
                {current.quality}
              </span>
            )}
            {current.year && (
              <span className="px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-300">
                {current.year}
              </span>
            )}
            {current.tmdb?.vote_average ? (
              <span className="flex items-center gap-1 text-amber-400 font-bold">
                <Star className="w-3.5 h-3.5 fill-current" />
                {current.tmdb.vote_average.toFixed(1)} TMDB
              </span>
            ) : null}
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight drop-shadow-md leading-tight">
            {current.name}
          </h1>
          {current.origin_name && (
            <p className="text-sm sm:text-base text-zinc-300 font-medium italic drop-shadow">
              {current.origin_name}
            </p>
          )}

          {/* Categories */}
          {current.category && current.category.length > 0 && (
            <div className="flex flex-wrap gap-1.5 text-xs text-zinc-400 pt-1">
              {current.category.slice(0, 4).map((c) => (
                <span key={c.slug} className="px-2 py-0.5 rounded-full bg-zinc-800/80">
                  {c.name}
                </span>
              ))}
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center gap-3 pt-3">
            <button
              onClick={() => onPlay(current)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-lg shadow-red-600/30 transition-all hover:scale-105 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              Xem Ngay
            </button>
            <button
              onClick={() => onInfo(current)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-white font-semibold text-sm backdrop-blur-md border border-zinc-700 transition cursor-pointer"
            >
              <Info className="w-4 h-4" />
              Chi Tiết
            </button>
          </div>
        </div>
      </div>

      {/* Nav Chevrons */}
      {movies.length > 1 && (
        <div className="absolute bottom-6 right-6 flex items-center gap-2 z-10">
          <button
            onClick={() => setIndex((prev) => (prev - 1 + Math.min(movies.length, 6)) % Math.min(movies.length, 6))}
            className="p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur border border-zinc-700 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIndex((prev) => (prev + 1) % Math.min(movies.length, 6))}
            className="p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur border border-zinc-700 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
