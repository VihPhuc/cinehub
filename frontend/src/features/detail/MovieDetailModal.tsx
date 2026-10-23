import React, { useEffect, useMemo, useState, useRef } from 'react';
import DOMPurify from 'dompurify';
import { X, Play, Bookmark, Star, Calendar, Clock, Loader2, Share2, Check, Video, Users, User, AlertCircle, RefreshCw, QrCode, Smartphone } from 'lucide-react';
import type { MovieDetail, MovieItem } from '@/shared/types';
import { getImageUrl, getMovieDetail, getGenreMovies, formatMovieTitle } from '@/shared/api';

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
  onSelectSlug?: (newSlug: string) => void;
}

export const MovieDetailModal: React.FC<Props> = ({
  slug,
  onClose,
  onWatch,
  isFav,
  onToggleFav,
  onSelectSlug,
}) => {
  const [activeSlug, setActiveSlug] = useState(slug);
  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [relatedMovies, setRelatedMovies] = useState<MovieItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [selectedServerIdx, setSelectedServerIdx] = useState(0);

  useEffect(() => {
    if (!showQrModal || !movie || qrDataUrl) return;
    let ok = true;
    const movieUrl = `${window.location.origin}${window.location.pathname}?info=${movie.slug}`;
    import('qrcode')
      .then((QRCode) => {
        return QRCode.toDataURL(movieUrl, {
          width: 320,
          margin: 2,
          color: {
            dark: '#090a0f',
            light: '#ffffff',
          },
        });
      })
      .then((url) => {
        if (ok) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('QR code generation failed:', err);
      });
    return () => {
      ok = false;
    };
  }, [showQrModal, movie, qrDataUrl]);

  const isGeneratingQr = showQrModal && !qrDataUrl;

  const handleShare = () => {
    const url = `${window.location.origin}${window.location.pathname}?info=${movie?.slug || activeSlug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const modalPanelRef = useRef<HTMLDivElement>(null);

  // Lock body scroll and save previous active element to restore on unmount
  useEffect(() => {
    previousActiveElementRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      previousActiveElementRef.current?.focus?.();
    };
  }, []);

  // Set initial focus to the close button or first interactive element once modal content is ready
  useEffect(() => {
    if (!loading && !hasError && movie) {
      const timer = setTimeout(() => {
        const firstFocusable = modalPanelRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [loading, hasError, movie]);

  // Keyboard navigation: Escape key closes modal; Tab key traps focus inside dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const activeDialog = document.querySelector<HTMLElement>('[role="dialog"]');
        if (!activeDialog) return;

        const focusables = Array.from(
          activeDialog.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);

        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !activeDialog.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !activeDialog.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const fetchDetail = (targetSlug: string) => {
    let ok = true;
    getMovieDetail(targetSlug)
      .then((res) => {
        if (!ok || !res) {
          if (ok) {
            setHasError(true);
            setLoading(false);
          }
          return;
        }
        setMovie(res);
        setSelectedServerIdx(0);
        setLoading(false);
        const genreSlug = res.category?.[0]?.slug;
        if (genreSlug) {
          getGenreMovies(genreSlug, 1)
            .then((gRes) => {
              if (ok && gRes?.items) {
                setRelatedMovies(gRes.items.filter((item) => item.slug !== targetSlug).slice(0, 6));
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (ok) {
          setHasError(true);
          setLoading(false);
        }
      });
    return () => {
      ok = false;
    };
  };

  useEffect(() => {
    return fetchDetail(activeSlug);
  }, [activeSlug]);

  const handleSelectRelated = (newSlug: string) => {
    setLoading(true);
    setHasError(false);
    setMovie(null);
    setRelatedMovies([]);
    setActiveSlug(newSlug);
    onSelectSlug?.(newSlug);
  };

  // The API returns third-party HTML for the synopsis. Sanitize before injecting
  // it into the DOM so a malicious/compromised response cannot run scripts in
  // our origin (and read localStorage).
  const movieContent = movie?.content;
  const sanitizedContent = useMemo(() => {
    if (!movieContent) return '';
    return DOMPurify.sanitize(movieContent, {
      ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'a'],
      ALLOWED_ATTR: ['href', 'title'],
    });
  }, [movieContent]);

  if (loading) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Đang tải thông tin phim"
        aria-busy="true"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl"
      >
        <div className="relative p-8 rounded-3xl bg-[#0c0e16]/95 border border-white/10 flex flex-col items-center gap-4 text-center max-w-sm">
          <Loader2 className="w-10 h-10 animate-spin text-red-500" />
          <p className="text-sm font-semibold text-zinc-300">Đang tải thông tin phim...</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-zinc-300 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    );
  }

  if (hasError || !movie) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Lỗi tải phim"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl"
      >
        <div className="relative p-8 rounded-3xl bg-[#0c0e16]/95 border border-white/10 flex flex-col items-center gap-4 text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <h3 className="text-base font-bold text-white">Không thể tải thông tin phim</h3>
          <p className="text-xs text-zinc-400">
            Có thể kết nối mạng gặp sự cố hoặc máy chủ phim đang bảo trì.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                fetchDetail(activeSlug);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Thử lại
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    );
  }

  const poster = getImageUrl(movie.poster_url || movie.thumb_url);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-movie-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-2xl overflow-y-auto animate-in fade-in duration-200"
    >
      <div ref={modalPanelRef} className="relative w-full max-w-4xl bg-[#0c0e16]/95 border border-white/[0.12] rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-2.5 rounded-full bg-black/70 hover:bg-black text-white hover:scale-105 transition-all cursor-pointer border border-white/10 focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Đóng chi tiết phim"
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
                  <span className="px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md">
                    {movie.quality}
                  </span>
                )}
                {movie.lang && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-black/60 backdrop-blur-md text-zinc-200 border border-white/10">
                    {movie.lang}
                  </span>
                )}
                {movie.episode_current && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-black/80 backdrop-blur-md text-amber-300 border border-amber-500/30">
                    {movie.episode_current}
                  </span>
                )}
              </div>
              <h2 id="modal-movie-title" className="text-2xl sm:text-3xl font-black text-white font-heading tracking-tight leading-tight drop-shadow-lg">
                {formatMovieTitle(movie.name)}
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
              onClick={() => onWatch(movie, selectedServerIdx, 0)}
              className="flex items-center gap-2 px-7 py-3 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-sm glow-red shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer focus-visible:ring-2 focus-visible:ring-red-400"
              aria-label={`Xem ngay phim ${formatMovieTitle(movie.name)}`}
            >
              <Play className="w-4 h-4 fill-current" />
              Xem Phim Ngay
            </button>
            {getYouTubeEmbedUrl(movie.trailer_url) && (
              <button
                onClick={() => setShowTrailer(!showTrailer)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-400 ${
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
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-400 ${
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
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-white ${
                copied
                  ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40'
                  : 'glass-pill text-zinc-300 border-white/10 hover:bg-white/15 hover:text-white'
              }`}
              title="Sao chép liên kết thông tin phim"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
              {copied ? 'Đã Sao Chép Link' : 'Chia Sẻ'}
            </button>
            <button
              onClick={() => setShowQrModal(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold border glass-pill text-amber-300 border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/10 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400"
              title="Quét mã QR để xem ngay trên điện thoại di động"
              aria-label="Quét mã QR xem trên điện thoại di động"
            >
              <QrCode className="w-4 h-4 text-amber-400" />
              <span>Xem Trên Mobile (QR)</span>
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
                sandbox="allow-scripts allow-same-origin allow-presentation"
                referrerPolicy="no-referrer"
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
                dangerouslySetInnerHTML={{ __html: sanitizedContent }}
              />
            </div>
          )}

          {/* Episode List with Server Selector */}
          {movie.episodes && movie.episodes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xs font-black text-zinc-400 uppercase tracking-wider font-heading">
                  Danh Sách Tập ({movie.episodes[selectedServerIdx]?.server_data?.length || 0} tập)
                </h3>
                {movie.episodes.length > 1 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-zinc-400">Server:</span>
                    {movie.episodes.map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedServerIdx(idx)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          selectedServerIdx === idx
                            ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-sm'
                            : 'glass-pill text-zinc-300 hover:text-white'
                        }`}
                      >
                        {s.server_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto p-1.5 bg-black/40 rounded-2xl border border-white/[0.06]">
                {movie.episodes[selectedServerIdx]?.server_data?.map((ep, idx) => (
                  <button
                    key={ep.slug}
                    onClick={() => onWatch(movie, selectedServerIdx, idx)}
                    className="px-3.5 py-2 rounded-xl glass-pill hover:bg-gradient-to-r hover:from-red-600 hover:to-rose-600 hover:text-white text-xs font-bold text-zinc-300 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
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
                  <button
                    key={rel.slug}
                    type="button"
                    onClick={() => handleSelectRelated(rel.slug)}
                    className="group cursor-pointer rounded-xl overflow-hidden bg-white/[0.03] border border-white/[0.08] hover:border-red-500/50 transition-all hover:-translate-y-1 text-left flex flex-col focus-visible:ring-2 focus-visible:ring-red-500"
                    aria-label={`Xem chi tiết phim ${formatMovieTitle(rel.name)}`}
                  >
                    <div className="aspect-[2/3] w-full bg-[#11131c] overflow-hidden">
                      <img
                        src={getImageUrl(rel.poster_url || rel.thumb_url)}
                        alt={formatMovieTitle(rel.name)}
                        className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-2 bg-[#0e1017]/80 w-full flex-1">
                      <p className="text-[11px] font-bold text-zinc-200 truncate group-hover:text-red-400 transition-colors">
                        {formatMovieTitle(rel.name)}
                      </p>
                      <span className="text-[11px] text-zinc-400 font-semibold">{rel.year}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile QR Code Popover Dialog */}
      {showQrModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-modal-title"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowQrModal(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-3xl bg-[#0d0f17] border border-white/20 p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              aria-label="Đóng bảng mã QR"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center gap-1.5 pt-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shadow-lg shadow-amber-500/20 mb-1">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 id="qr-modal-title" className="text-lg font-black text-white font-heading tracking-tight">
                Quét Mã Xem Trên Mobile
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-xs">
                Mở ứng dụng Camera hoặc Zalo trên điện thoại để quét mã và tiếp tục xem ngay tức thì.
              </p>
            </div>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-xl mx-auto w-fit">
              {isGeneratingQr ? (
                <div className="w-56 h-56 flex flex-col items-center justify-center gap-2 text-zinc-600">
                  <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
                  <span className="text-xs font-bold">Đang tạo mã QR...</span>
                </div>
              ) : qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`Mã QR xem phim ${movie.name}`}
                  className="w-56 h-56 object-contain"
                />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-xs text-zinc-500">
                  Không thể tạo mã QR
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 bg-white/[0.05] border border-white/[0.1] rounded-xl p-2 text-left">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}${window.location.pathname}?info=${movie.slug}`}
                className="text-[11px] text-zinc-300 font-mono bg-transparent flex-1 outline-none px-1 truncate"
              />
              <button
                type="button"
                onClick={handleShare}
                className="px-2.5 py-1 rounded-lg bg-red-600/30 hover:bg-red-600 text-white text-xs font-bold transition cursor-pointer shrink-0"
              >
                {copied ? 'Đã chép' : 'Chép link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
