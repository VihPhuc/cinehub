import React, { useEffect, useState } from 'react';
import { X, Play, Bookmark, Star, Calendar, Clock, Loader2 } from 'lucide-react';
import type { MovieDetail } from '../types';
import { getImageUrl, getMovieDetail } from '../services/api';

interface Props {
  slug: string;
  onClose: () => void;
  onWatch: (m: MovieDetail, sIdx?: number, epIdx?: number) => void;
  isFav: boolean;
  onToggleFav: (m: MovieDetail) => void;
}

export const MovieDetailModal: React.FC<Props> = ({
  slug,
  onClose,
  onWatch,
  isFav,
  onToggleFav,
}) => {
  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ok = true;
    getMovieDetail(slug).then((res) => {
      if (ok) {
        setMovie(res);
        setLoading(false);
      }
    });
    return () => { ok = false; };
  }, [slug]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  if (!movie) return null;
  const poster = getImageUrl(movie.poster_url || movie.thumb_url);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-2 rounded-full bg-black/70 hover:bg-black text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative h-56 sm:h-64 w-full overflow-hidden shrink-0">
          <img src={poster} alt={movie.name} className="w-full h-full object-cover brightness-[0.35]" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/50 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 flex items-end gap-3">
            <img src={poster} alt={movie.name} className="w-24 aspect-[2/3] object-cover rounded-lg border border-zinc-700 shadow-xl hidden sm:block" />
            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap gap-1">
                {movie.quality && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white">{movie.quality}</span>}
                {movie.lang && <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-300">{movie.lang}</span>}
                {movie.episode_current && <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300">{movie.episode_current}</span>}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">{movie.name}</h2>
              {movie.origin_name && <p className="text-xs text-zinc-400 italic">{movie.origin_name}</p>}
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onWatch(movie, 0, 0)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" /> Xem Phim
            </button>
            <button
              onClick={() => onToggleFav(movie)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border cursor-pointer ${
                isFav ? 'bg-red-600/20 text-red-400 border-red-500/40' : 'bg-zinc-800 text-zinc-300 border-zinc-700'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
              {isFav ? 'Đã Lưu' : 'Thêm Vào Tủ'}
            </button>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-zinc-400 border-y border-zinc-800 py-2.5">
            {movie.year && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {movie.year}</span>}
            {movie.time && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {movie.time}</span>}
            {movie.tmdb?.vote_average ? (
              <span className="flex items-center gap-1 text-amber-400 font-bold">
                <Star className="w-3.5 h-3.5 fill-current" /> {movie.tmdb.vote_average.toFixed(1)} TMDB
              </span>
            ) : null}
            {movie.country && <span>Quốc gia: {movie.country.map((c) => c.name).join(', ')}</span>}
          </div>

          {movie.content && (
            <div>
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Nội Dung</h3>
              <div
                className="text-xs sm:text-sm text-zinc-300 leading-relaxed max-h-32 overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: movie.content }}
              />
            </div>
          )}

          {movie.episodes && movie.episodes.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                Tập Phim ({movie.episodes[0]?.server_data.length} tập)
              </h3>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                {movie.episodes[0]?.server_data.map((ep, idx) => (
                  <button
                    key={ep.slug}
                    onClick={() => onWatch(movie, 0, idx)}
                    className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-red-600 text-xs text-zinc-300 hover:text-white cursor-pointer"
                  >
                    {ep.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
