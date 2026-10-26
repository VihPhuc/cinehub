import React from 'react';
import { Play, Bookmark, Clock } from 'lucide-react';
import type { MovieItem } from '@/shared/types';
import { getImageUrl, prefetchMovieDetail, formatMovieTitle, formatUpdatedAtBadge } from '@/shared/api';

interface Props {
  movie: MovieItem;
  onClick: () => void;
  onQuickPlay?: () => void;
  isFav?: boolean;
  onToggleFav?: () => void;
  showUpdatedAt?: boolean;
  rank?: number;
}

export const MovieCard: React.FC<Props> = React.memo(({
  movie,
  onClick,
  onQuickPlay,
  isFav,
  onToggleFav,
  showUpdatedAt,
  rank,
}) => {
  const [imgError, setImgError] = React.useState(false);
  const prefetchTimerRef = React.useRef<number | null>(null);
  const poster = getImageUrl(movie.poster_url || movie.thumb_url);
  const title = formatMovieTitle(movie.name);

  const handleMouseEnter = () => {
    if (prefetchTimerRef.current) window.clearTimeout(prefetchTimerRef.current);
    prefetchTimerRef.current = window.setTimeout(() => {
      prefetchMovieDetail(movie.slug);
    }, 180);
  };

  const handleMouseLeave = () => {
    if (prefetchTimerRef.current) {
      window.clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }
  };

  React.useEffect(() => {
    return () => {
      if (prefetchTimerRef.current) window.clearTimeout(prefetchTimerRef.current);
    };
  }, []);

  return (
    <article
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="group relative flex flex-col rounded-md sm:rounded-lg overflow-hidden bg-[#181818] border border-white/[0.08] hover:border-white/25 transition-all duration-300 ease-out hover:scale-[1.04] hover:shadow-2xl hover:shadow-black/95 hover:z-20"
    >
      {/* Primary Clickable Backdrop Button (covers entire card for keyboard/pointer) */}
      <button
        type="button"
        onClick={onClick}
        aria-label={`Xem chi tiết phim ${title}`}
        className="absolute inset-0 z-0 w-full h-full cursor-pointer rounded-md sm:rounded-lg focus-visible:ring-2 focus-visible:ring-[#E50914] focus-visible:outline-none"
      />

      {/* Poster Image Container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#141414] pointer-events-none">
        {!imgError ? (
          <img
            src={poster}
            alt={title}
            loading="lazy"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-b from-zinc-900 to-black">
            <span className="text-2xl mb-1">🎬</span>
            <span className="text-[11px] font-bold text-zinc-400 line-clamp-2">{title}</span>
          </div>
        )}

        {/* Top Badges (Rank, Quality & Lang) */}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1 z-10 pointer-events-none">
          {rank ? (
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-black uppercase tracking-wider shadow-lg flex items-center gap-1 ${
                rank === 1
                  ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-black shadow-amber-500/40 ring-1 ring-amber-300'
                  : rank === 2
                  ? 'bg-gradient-to-r from-slate-100 via-zinc-200 to-slate-300 text-zinc-950 shadow-slate-300/30 ring-1 ring-white/60'
                  : rank === 3
                  ? 'bg-gradient-to-r from-amber-600 via-orange-500 to-amber-700 text-white shadow-orange-600/30 ring-1 ring-amber-400/50'
                  : 'bg-black/85 backdrop-blur-md text-zinc-200 border border-white/20'
              }`}
            >
              <span>TOP {rank}</span>
            </span>
          ) : movie.quality ? (
            <span className="px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-black uppercase tracking-wider bg-[#E50914] text-white shadow-md">
              {movie.quality}
            </span>
          ) : null}
          {movie.lang && (
            <span className="px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold bg-black/70 backdrop-blur-md text-zinc-200 border border-white/10">
              {movie.lang}
            </span>
          )}
        </div>

        {/* Episode current badge */}
        {movie.episode_current && (
          <div className="absolute bottom-2 left-2 max-w-[50%] truncate px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-bold bg-black/85 backdrop-blur-md text-amber-300 border border-amber-500/30 shadow-sm z-10 pointer-events-none">
            {movie.episode_current}
          </div>
        )}

        {/* Updated at badge */}
        {showUpdatedAt && movie.updatedAt && (
          <div
            className="absolute bottom-2 right-2 max-w-[50%] truncate px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/85 backdrop-blur-md text-emerald-300 border border-emerald-500/30 shadow-sm z-10 pointer-events-none flex items-center gap-1"
            title={`Cập nhật lúc ${new Date(movie.updatedAt).toLocaleString('vi-VN')}`}
            aria-label={`Cập nhật lúc ${new Date(movie.updatedAt).toLocaleString('vi-VN')}`}
          >
            <Clock className="w-2.5 h-2.5 shrink-0 text-emerald-400" />
            <span className="truncate">{formatUpdatedAtBadge(movie.updatedAt)}</span>
          </div>
        )}
      </div>

      {/* Bookmark quick button */}
      {onToggleFav && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFav();
          }}
          className={`absolute top-2 right-2 w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full backdrop-blur-md transition-all duration-200 z-10 cursor-pointer focus-visible:ring-2 focus-visible:ring-white ${
            isFav
              ? 'bg-[#E50914] text-white shadow-md shadow-red-600/40 scale-105'
              : 'bg-black/60 text-zinc-300 hover:text-white hover:bg-black/90 hover:scale-110 border border-white/10'
          }`}
          title={isFav ? 'Bỏ lưu' : 'Lưu phim'}
          aria-label={isFav ? `Bỏ lưu phim ${title}` : `Lưu phim ${title}`}
        >
          <Bookmark className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
        </button>
      )}

      {/* Hover & Focus Overlay with Netflix White Play Button */}
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onQuickPlay) {
              onQuickPlay();
            } else {
              onClick();
            }
          }}
          className="w-12 h-12 rounded-full bg-white hover:bg-white/90 text-black flex items-center justify-center transform scale-75 group-hover:scale-100 group-focus-within:scale-100 transition-all duration-200 cursor-pointer shadow-2xl hover:scale-110 focus-visible:ring-2 focus-visible:ring-white pointer-events-auto"
          title="Xem ngay"
          aria-label={`Xem ngay phim ${title}`}
        >
          <Play className="w-5 h-5 fill-black text-black translate-x-0.5" />
        </button>
      </div>

      {/* Title & Info Footer (Netflix Style) */}
      <div className="p-2.5 sm:p-3 flex flex-col flex-1 justify-between gap-1.5 bg-[#181818] pointer-events-none relative z-0">
        <div>
          <h3 className="text-xs sm:text-sm font-bold text-zinc-100 line-clamp-1 group-hover:text-white transition-colors">
            {title}
          </h3>
          {movie.origin_name && (
            <p className="text-[11px] text-zinc-400 line-clamp-1 italic mt-0.5">
              {movie.origin_name}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-white/[0.06]">
          <span className="font-semibold text-zinc-400">{movie.year ? String(movie.year) : '—'}</span>
          {movie.tmdb?.vote_average ? (
            <span className="text-[#46d369] font-bold text-[11px] flex items-center gap-1">
              <span>{Math.round(movie.tmdb.vote_average * 10)}% Phù hợp</span>
            </span>
          ) : (
            movie.time && <span className="text-zinc-400 font-medium">{movie.time}</span>
          )}
        </div>
      </div>
    </article>
  );
});
