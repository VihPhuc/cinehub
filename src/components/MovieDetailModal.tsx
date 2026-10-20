import React, { useEffect, useState } from 'react';
import { X, Play, Bookmark, Star, Calendar, Clock, Loader2, Share2, Check, Video, Users, User } from 'lucide-react';
import type { MovieDetail, MovieItem } from '../types';
import { getImageUrl, getMovieDetail, getGenreMovies } from '../services/api';

function getYouTubeEmbedUrl(url?: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? `https://www.youtube.com/embed/${match[2]}?autoplay=1` : null;
}

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
  const [activeSlug, setActiveSlug] = useState(slug);
  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [relatedMovies, setRelatedMovies] = useState<MovieItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);

  const handleShare = () => {
    const url = `${window.location.origin}${window.location.pathname}?info=${movie?.slug || activeSlug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  useEffect(() => {
    setActiveSlug(slug);
  }, [slug]);

  useEffect(() => {
    let ok = true;
    setLoading(true);
    getMovieDetail(activeSlug)
      .then((res) => {
        if (!ok || !res) {
          if (ok) setLoading(false);
          return;
        }
        setMovie(res);
        setLoading(false);
        const genreSlug = res.category?.[0]?.slug;
        if (genreSlug) {
          getGenreMovies(genreSlug, 1)
            .then((gRes) => {
              if (ok && gRes?.items) {
                setRelatedMovies(gRes.items.filter((item) => item.slug !== activeSlug).slice(0, 6));
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (ok) setLoading(false);
      });
    return () => {
      ok = false;
    };
  }, [activeSlug]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-2xl overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-[#0c0e16]/95 border border-white/[0.12] rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-2.5 rounded-full bg-black/70 hover:bg-black text-white hover:scale-105 transition-all cursor-pointer border border-white/10"
          aria-label="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cinematic Backdrop Header */}
        <div className="relative h-60 sm:h-72 w-full overflow-hidden shrink-0">
          <img
            src={poster}
            alt={movie.name}
            className="w-full h-full object-cover object-center filter brightness-[0.35] scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c0e16] via-[#0c0e16]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0c0e16] via-[#0c0e16]/40 to-transparent" />

          {/* Floating Poster & Main Info */}
          <div className="absolute bottom-5 left-5 right-5 flex items-end gap-4 sm:gap-5 z-20">
            <img
              src={poster}
              alt={movie.name}
              className="w-28 sm:w-32 aspect-[2/3] object-cover rounded-2xl border-2 border-white/20 shadow-2xl hidden sm:block shrink-0"
            />
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {movie.quality && (
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md">
                    {movie.quality}
                  </span>
                )}
                {movie.lang && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-black/60 backdrop-blur-md text-zinc-200 border border-white/10">
                    {movie.lang}
                  </span>
                )}
                {movie.episode_current && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/80 backdrop-blur-md text-amber-300 border border-amber-500/30">
                    {movie.episode_current}
                  </span>
                )}
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white font-heading tracking-tight leading-tight drop-shadow-lg">
                {movie.name}
              </h2>
              {movie.origin_name && (
                <p className="text-xs sm:text-sm text-zinc-300/90 italic font-medium">
                  {movie.origin_name}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-5">
          {/* Action Buttons Row */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => onWatch(movie, 0, 0)}
              className="flex items-center gap-2 px-7 py-3 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-sm glow-red shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              Xem Phim Ngay
            </button>
            {getYouTubeEmbedUrl(movie.trailer_url) && (
              <button
                onClick={() => setShowTrailer(!showTrailer)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold border transition-all cursor-pointer ${
                  showTrailer
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white border-red-500 shadow-md shadow-red-600/30'
                    : 'glass-pill text-zinc-200 border-white/10 hover:bg-white/15'
                }`}
              >
                <Video className="w-4 h-4 text-red-400" />
                {showTrailer ? 'Đóng Trailer' : 'Xem Trailer'}
              </button>
            )}
            <button
              onClick={() => onToggleFav(movie)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold border transition-all cursor-pointer ${
                isFav
                  ? 'bg-red-600/20 text-red-400 border-red-500/40 shadow-sm shadow-red-500/20'
                  : 'glass-pill text-zinc-200 border-white/10 hover:bg-white/15'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
              {isFav ? 'Đã Lưu Vào Tủ' : 'Lưu Vào Tủ Phim'}
            </button>
            <button
              onClick={handleShare}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold border transition-all cursor-pointer ${
                copied
                  ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40'
                  : 'glass-pill text-zinc-300 border-white/10 hover:bg-white/15 hover:text-white'
              }`}
              title="Sao chép liên kết thông tin phim"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
              {copied ? 'Đã Sao Chép Link' : 'Chia Sẻ'}
            </button>
          </div>

          {/* Embedded Trailer Player */}
          {showTrailer && getYouTubeEmbedUrl(movie.trailer_url) && (
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-white/15 shadow-2xl bg-black animate-in fade-in zoom-in-95">
              <iframe
                src={getYouTubeEmbedUrl(movie.trailer_url)!}
                title={`${movie.name} Trailer`}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          {/* Quick Meta Info Badges */}
          <div className="flex flex-wrap gap-4 sm:gap-6 text-xs text-zinc-300 border-y border-white/[0.08] py-3.5">
            {movie.year && (
              <span className="flex items-center gap-1.5 font-semibold">
                <Calendar className="w-4 h-4 text-zinc-400" /> {movie.year}
              </span>
            )}
            {movie.time && (
              <span className="flex items-center gap-1.5 font-semibold">
                <Clock className="w-4 h-4 text-zinc-400" /> {movie.time}
              </span>
            )}
            {movie.tmdb?.vote_average ? (
              <span className="flex items-center gap-1 text-amber-400 font-bold">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                {movie.tmdb.vote_average.toFixed(1)} TMDB
              </span>
            ) : null}
            {movie.country && (
              <span className="font-medium text-zinc-400">
                Quốc gia: <strong className="text-zinc-200">{movie.country.map((c) => c.name).join(', ')}</strong>
              </span>
            )}
            {movie.category && (
              <span className="font-medium text-zinc-400">
                Thể loại: <strong className="text-zinc-200">{movie.category.map((c) => c.name).join(', ')}</strong>
              </span>
            )}
          </div>

          {/* Directors & Actors */}
          {(Boolean(movie.director?.length) || Boolean(movie.actor?.length)) && (
            <div className="space-y-2.5 text-xs">
              {movie.director && movie.director.length > 0 && movie.director[0] && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-zinc-400 flex items-center gap-1 shrink-0">
                    <User className="w-3.5 h-3.5 text-red-500" /> Đạo diễn:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {movie.director.map((d, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg glass-pill text-zinc-200 font-bold">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {movie.actor && movie.actor.length > 0 && movie.actor[0] && (
                <div className="flex items-start gap-2 flex-wrap">
                  <span className="font-bold text-zinc-400 flex items-center gap-1 shrink-0 pt-1">
                    <Users className="w-3.5 h-3.5 text-red-500" /> Diễn viên:
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {movie.actor.map((a, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg glass-pill text-zinc-300 font-medium">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Movie Synopsis */}
          {movie.content && (
            <div className="space-y-1.5">
              <h3 className="text-xs font-black text-zinc-400 uppercase tracking-wider font-heading">
                Nội Dung Phim
              </h3>
              <div
                className="text-xs sm:text-sm text-zinc-300/95 leading-relaxed max-h-36 overflow-y-auto pr-2"
                dangerouslySetInnerHTML={{ __html: movie.content }}
              />
            </div>
          )}

          {/* Episode List */}
          {movie.episodes && movie.episodes.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-black text-zinc-400 uppercase tracking-wider font-heading">
                Danh Sách Tập ({movie.episodes[0]?.server_data.length} tập)
              </h3>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1 bg-black/30 rounded-2xl border border-white/[0.05]">
                {movie.episodes[0]?.server_data.map((ep, idx) => (
                  <button
                    key={ep.slug}
                    onClick={() => onWatch(movie, 0, idx)}
                    className="px-3.5 py-1.5 rounded-xl glass-pill hover:bg-gradient-to-r hover:from-red-600 hover:to-rose-600 hover:text-white text-xs font-bold text-zinc-300 transition-all cursor-pointer"
                  >
                    {ep.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Related Movies */}
          {relatedMovies.length > 0 && (
            <div className="pt-3 border-t border-white/[0.08] space-y-3">
              <h3 className="text-xs font-black text-zinc-400 uppercase tracking-wider font-heading">
                Phim Cùng Thể Loại Đáng Xem
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {relatedMovies.map((rel) => (
                  <div
                    key={rel.slug}
                    onClick={() => setActiveSlug(rel.slug)}
                    className="group cursor-pointer rounded-xl overflow-hidden bg-white/[0.03] border border-white/[0.08] hover:border-red-500/50 transition-all hover:-translate-y-1"
                  >
                    <div className="aspect-[2/3] w-full bg-[#11131c] overflow-hidden">
                      <img
                        src={getImageUrl(rel.poster_url || rel.thumb_url)}
                        alt={rel.name}
                        className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-2 bg-[#0e1017]/80">
                      <p className="text-[11px] font-bold text-zinc-200 truncate group-hover:text-red-400 transition-colors">
                        {rel.name}
                      </p>
                      <span className="text-[10px] text-zinc-400 font-semibold">{rel.year}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
