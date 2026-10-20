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
      className="group relative flex flex-col rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.07] hover:border-red-500/50 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-red-600/20 cursor-pointer"
    >
      {/* Poster Image Container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#11131c]">
        <img
          src={poster}
          alt={movie.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
        />

        {/* Top Badges (Quality & Lang) */}
        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5 z-10">
          {movie.quality && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-600/30">
              {movie.quality}
            </span>
          )}
          {movie.lang && (
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-black/60 backdrop-blur-md text-zinc-200 border border-white/10">
              {movie.lang}
            </span>
          )}
        </div>

        {/* Episode current badge */}
        {movie.episode_current && (
          <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/80 backdrop-blur-md text-amber-300 border border-amber-500/30 shadow-sm z-10">
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
            className={`absolute top-2.5 right-2.5 p-2 rounded-full backdrop-blur-md transition-all duration-200 z-10 cursor-pointer ${
              isFav
                ? 'bg-red-600 text-white shadow-md shadow-red-600/40 scale-105'
                : 'bg-black/60 text-zinc-300 hover:text-white hover:bg-black/90 hover:scale-110 border border-white/10'
            }`}
            title={isFav ? 'Bỏ lưu' : 'Lưu phim'}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
          </button>
        )}

        {/* Hover Overlay with Play Button */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#090a0f] via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onQuickPlay) {
                onQuickPlay();
              } else {
                onClick();
              }
            }}
            className="w-12 h-12 rounded-full bg-gradient-to-tr from-red-600 to-rose-500 text-white flex items-center justify-center glow-red-sm transform scale-75 group-hover:scale-100 transition-all duration-300 cursor-pointer shadow-xl hover:scale-110"
            title="Xem ngay"
          >
            <Play className="w-5 h-5 fill-current translate-x-0.5" />
          </button>
        </div>
      </div>

      {/* Title & Info Footer */}
      <div className="p-3 flex flex-col flex-1 justify-between gap-1.5 bg-[#0e1017]/50">
        <div>
          <h3 className="text-xs sm:text-sm font-bold text-zinc-100 line-clamp-1 group-hover:text-red-400 transition-colors">
            {movie.name}
          </h3>
          {movie.origin_name && (
            <p className="text-[11px] text-zinc-400 line-clamp-1 italic mt-0.5">
              {movie.origin_name}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-white/[0.05]">
          <span className="font-semibold text-zinc-400">{movie.year || '2026'}</span>
          {movie.tmdb?.vote_average ? (
            <span className="flex items-center gap-1 text-amber-400 font-bold">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              {movie.tmdb.vote_average.toFixed(1)}
            </span>
          ) : (
            movie.time && <span className="text-zinc-500">{movie.time}</span>
          )}
        </div>
      </div>
    </div>
  );
};
