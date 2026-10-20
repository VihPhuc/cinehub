import React from 'react';
import { Play, Star, Bookmark } from 'lucide-react';
import type { MovieItem } from '../types';
import { getImageUrl } from '../services/api';

interface Props {
  movie: MovieItem;
  onClick: () => void;
  onQuickPlay?: () => void;
  isFav?: boolean;
  onToggleFav?: () => void;
}

export const MovieCard: React.FC<Props> = ({
  movie,
  onClick,
  onQuickPlay,
  isFav,
  onToggleFav,
}) => {
  const poster = getImageUrl(movie.poster_url || movie.thumb_url);

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/60 cursor-pointer"
    >
      {/* Poster Image Container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-950">
        <img
          src={poster}
          alt={movie.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Quality / Lang Badges */}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {movie.quality && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-600/90 text-white shadow">
              {movie.quality}
            </span>
          )}
          {movie.lang && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/60 backdrop-blur-md text-zinc-200 border border-white/10">
              {movie.lang}
            </span>
          )}
        </div>

        {/* Episode current badge */}
        {movie.episode_current && (
          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-900/85 backdrop-blur-md text-amber-300 border border-amber-500/30">
            {movie.episode_current}
          </div>
        )}

        {/* Bookmark quick button */}
        {onToggleFav && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFav();
            }}
            className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md transition cursor-pointer ${
              isFav ? 'bg-red-600 text-white' : 'bg-black/60 text-zinc-300 hover:text-white hover:bg-black/80'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 fill-current" />
          </button>
        )}

        {/* Hover Overlay with Play Button */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQuickPlay ? onQuickPlay() : onClick();
            }}
            className="w-12 h-12 rounded-full bg-red-600/90 hover:bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-600/40 transform scale-75 group-hover:scale-100 transition-all duration-300 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current translate-x-0.5" />
          </button>
        </div>
      </div>

      {/* Title & Info */}
      <div className="p-2.5 flex flex-col flex-1 justify-between gap-1">
        <div>
          <h3 className="text-xs sm:text-sm font-semibold text-zinc-100 line-clamp-1 group-hover:text-red-400 transition-colors">
            {movie.name}
          </h3>
          {movie.origin_name && (
            <p className="text-[11px] text-zinc-400 line-clamp-1 italic">
              {movie.origin_name}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1">
          <span>{movie.year || '2026'}</span>
          {movie.tmdb?.vote_average ? (
            <span className="flex items-center gap-0.5 text-amber-400 font-medium">
              <Star className="w-3 h-3 fill-current" />
              {movie.tmdb.vote_average.toFixed(1)}
            </span>
          ) : (
            movie.time && <span>{movie.time}</span>
          )}
        </div>
      </div>
    </div>
  );
};
