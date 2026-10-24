import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Info, Heart, Star, ChevronLeft, ChevronRight, Video, X } from 'lucide-react';
import type { MovieItem, MovieDetail } from '@/shared/types';
import { getImageUrl, prefetchMovieDetail, getMovieDetail, formatMovieTitle } from '@/shared/api';

function getYouTubeId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

function parseTitleWithSeason(title: string): { main: string; season: string | null } {
  if (!title) return { main: '', season: null };
  const seasonMatch = title.match(/\s*(\((?:Phần|Season|Mùa|Part)\s*\d+[^)]*\)|(?:Phần|Season|Mùa|Part)\s*\d+)/i);
  if (!seasonMatch) return { main: title.trim(), season: null };
  return {
    main: title.replace(seasonMatch[0], '').trim(),
    season: seasonMatch[1].replace(/[()]/g, '').trim(),
  };
}

interface Props {
  movies: MovieItem[];
  onPlay: (movie: MovieItem) => void;
  onInfo: (movie: MovieItem) => void;
  favorites?: string[];
  onToggleFav?: (movie: MovieItem) => void;
}

export const HeroBanner: React.FC<Props> = ({
  movies,
  onPlay,
  onInfo,
  favorites = [],
  onToggleFav,
}) => {
  const [index, setIndex] = useState(0);
  const [detailMap, setDetailMap] = useState<Record<string, MovieDetail>>({});
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  const attemptedSlugsRef = useRef<Set<string>>(new Set());
  const maxSlides = Math.min(movies.length, 8);

  const current = movies[index] || movies[0];
  const currentSlug = current?.slug;
  const nextMovie = movies[(index + 1) % maxSlides];
  const nextSlug = nextMovie?.slug;
  const activeDetail = currentSlug ? detailMap[currentSlug] : null;
  const trailerId = getYouTubeId(activeDetail?.trailer_url);

  // Fetch active slide detail and prefetch next slide detail
  useEffect(() => {
    if (!currentSlug) return;
    let active = true;

    if (!detailMap[currentSlug] && !attemptedSlugsRef.current.has(currentSlug)) {
      attemptedSlugsRef.current.add(currentSlug);
      getMovieDetail(currentSlug).then((d) => {
        if (active && d) {
          setDetailMap((prev) => ({ ...prev, [currentSlug]: d }));
        }
      });
    }

    // Prefetch the next slide
    if (nextSlug && !detailMap[nextSlug] && !attemptedSlugsRef.current.has(nextSlug)) {
      attemptedSlugsRef.current.add(nextSlug);
      prefetchMovieDetail(nextSlug);
      getMovieDetail(nextSlug).then((d) => {
        if (active && d) {
          setDetailMap((prev) => ({ ...prev, [nextSlug]: d }));
        }
      });
    }

    return () => {
      active = false;
    };
  }, [currentSlug, nextSlug, detailMap]);

  const handleNext = useCallback(() => {
    setIndex((prev) => (prev + 1) % maxSlides);
  }, [maxSlides]);

  const handlePrev = useCallback(() => {
    setIndex((prev) => (prev - 1 + maxSlides) % maxSlides);
  }, [maxSlides]);

  const handleSelect = useCallback((newIndex: number) => {
    setIndex(newIndex);
  }, []);

  // Uninterrupted auto-slide every 5 seconds: advances slide reliably without stopping
  useEffect(() => {
    if (maxSlides <= 1 || showTrailerModal) return;

    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % maxSlides);
    }, 5000);

    return () => clearInterval(interval);
  }, [maxSlides, showTrailerModal]);

  if (!movies.length || !current) return null;

  const movieTitle = formatMovieTitle(current.name);
  const parsedTitle = parseTitleWithSeason(movieTitle);
  const bg = getImageUrl(current.thumb_url || current.poster_url);
  const isFav = favorites.includes(current.slug);
  const plainSynopsis = activeDetail?.content
    ? activeDetail.content.replace(/<[^>]*>?/gm, '').trim()
    : '';

  const countryName = activeDetail?.country?.[0]?.name || current.country?.[0]?.name;
  const topKicker = countryName
    ? `PHIM ${countryName.toUpperCase()} HÀNG ĐẦU`
    : 'PHIM ĐỀ XUẤT HÀNG ĐẦU';

  const episodeInfo =
    activeDetail?.episode_current ||
    (activeDetail?.episode_total ? `Tập ${activeDetail.episode_total}` : null) ||
    current.quality ||
    'Full HD';

  return (
    <div className="relative w-full h-[540px] sm:h-[640px] lg:h-[720px] overflow-hidden bg-[#07080d] select-none">
      {/* Background Poster Image: Crisp, bright, high-contrast and 100% free of YouTube controls */}
      <div className="absolute inset-0">
        <img
          key={current.slug}
          src={bg}
          alt={movieTitle}
          fetchPriority="high"
          className="w-full h-full object-cover object-center filter brightness-[0.96] contrast-[1.06] saturate-[1.12] transition-all duration-1000 ease-out scale-100"
        />
      </div>

      {/* Cinematic Ambient Gradients:
          - Left: Deep, smooth protection for text and action dock
          - Bottom: Soft fade into page background
          - Top: Subtle header fade for navbar readability
          - Right: 100% crystal clear so characters and scene shine brightly
      */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#07080d]/90 via-[#07080d]/60 via-35% md:via-[#07080d]/25 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#07080d] via-[#07080d]/40 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#07080d]/60 via-transparent to-transparent pointer-events-none" />

      {/* Main Container: Full-width Cinematic Hero Info */}
      <div className="relative z-10 w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-end pb-16 sm:pb-20">
        {/* Hero Information */}
        <div className="flex-1 max-w-xl sm:max-w-2xl lg:max-w-3xl space-y-3.5 sm:space-y-4">
          {/* Top Category Kicker */}
          <p className="text-[11px] sm:text-xs font-extrabold uppercase tracking-[0.2em] text-white/90 drop-shadow-md">
            {topKicker}
          </p>

          {/* Main Title & English Origin Subtitle with Non-breaking Season Badge */}
          <div className="space-y-1 sm:space-y-1.5">
            <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white font-heading tracking-tight leading-[1.12] drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)]">
              {parsedTitle.main}
              {parsedTitle.season && (
                <span className="inline-block whitespace-nowrap ml-2.5 text-xl sm:text-3xl lg:text-4xl font-bold text-amber-400/95 align-baseline">
                  ({parsedTitle.season})
                </span>
              )}
            </h1>
            {current.origin_name && (
              <p className="text-xs sm:text-sm md:text-base font-semibold text-amber-400/95 tracking-wide drop-shadow">
                {current.origin_name}
              </p>
            )}
          </div>

          {/* Minimalist Outlined Metadata Badges */}
          <div className="flex items-center flex-wrap gap-2 text-xs">
            {current.year && (
              <span className="px-2.5 py-0.5 rounded-md border border-white/30 bg-black/35 backdrop-blur-sm text-white/90 font-semibold text-[11px] sm:text-xs">
                {current.year}
              </span>
            )}
            {countryName && (
              <span className="px-2.5 py-0.5 rounded-md border border-white/30 bg-black/35 backdrop-blur-sm text-white/90 font-semibold text-[11px] sm:text-xs">
                {countryName}
              </span>
            )}
            {parsedTitle.season && (
              <span className="px-2.5 py-0.5 rounded-md border border-amber-400/40 bg-amber-500/10 backdrop-blur-sm text-amber-300 font-bold text-[11px] sm:text-xs">
                {parsedTitle.season}
              </span>
            )}
            {episodeInfo && (
              <span className="px-2.5 py-0.5 rounded-md border border-white/30 bg-black/35 backdrop-blur-sm text-white/90 font-semibold text-[11px] sm:text-xs">
                {episodeInfo}
              </span>
            )}
            {current.tmdb?.vote_average ? (
              <span className="px-2.5 py-0.5 rounded-md border border-amber-400/40 bg-black/35 backdrop-blur-sm text-amber-300 font-bold text-[11px] sm:text-xs flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                {current.tmdb.vote_average.toFixed(1)} TMDB
              </span>
            ) : null}
          </div>

          {/* Plot Synopsis Teaser */}
          {plainSynopsis && (
            <p className="text-xs sm:text-sm text-zinc-200/95 leading-relaxed line-clamp-2 max-w-xl font-normal drop-shadow">
              {plainSynopsis}
            </p>
          )}

          {/* Action Controls: Circular Play Button + Capsule Dock */}
          <div className="flex items-center gap-3.5 pt-2 sm:pt-3">
            {/* Big Circular Golden Play Button */}
            <button
              type="button"
              onClick={() => onPlay(current)}
              className="w-13 h-13 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 hover:brightness-110 active:scale-95 text-black shadow-xl shadow-amber-500/30 flex items-center justify-center cursor-pointer transition-all duration-300 hover:scale-105"
              aria-label={`Xem ngay phim ${movieTitle}`}
              title="Xem Ngay"
            >
              <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-black text-black ml-0.5" />
            </button>

            {/* Sleek Pill Capsule Dock (Matching Reference Image) */}
            <div className="rounded-full bg-black/60 backdrop-blur-xl border border-white/20 px-3 sm:px-5 py-2 sm:py-2.5 flex items-center gap-3 sm:gap-5 shadow-2xl">
              {/* Heart / Favorite */}
              {onToggleFav && (
                <button
                  type="button"
                  onClick={() => onToggleFav(current)}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-zinc-300 hover:text-white hover:bg-white/10 transition-transform active:scale-90 cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400"
                  aria-label={isFav ? 'Bỏ yêu thích' : 'Yêu thích'}
                  title={isFav ? 'Bỏ yêu thích' : 'Yêu thích'}
                >
                  <Heart className={`w-5 h-5 transition-colors ${isFav ? 'fill-red-500 text-red-500' : 'text-white hover:text-red-400'}`} />
                </button>
              )}

              {/* Info */}
              <button
                type="button"
                onClick={() => onInfo(current)}
                className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-zinc-300 hover:text-white hover:bg-white/10 transition-transform active:scale-90 cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400"
                aria-label={`Xem chi tiết phim ${movieTitle}`}
                title="Xem chi tiết"
              >
                <Info className="w-5 h-5 text-white" />
              </button>

              {/* Trailer Button */}
              {trailerId && (
                <button
                  type="button"
                  onClick={() => setShowTrailerModal(true)}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-zinc-300 hover:text-white hover:bg-white/10 transition-transform active:scale-90 cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400"
                  aria-label="Xem trailer phim"
                  title="Xem trailer"
                >
                  <Video className="w-5 h-5 text-amber-400 hover:text-amber-300" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom-Right Slide Controls: Dash Indicators + Circular Outline Arrows */}
      {maxSlides > 1 && (
        <div className="absolute bottom-6 sm:bottom-8 right-4 sm:right-8 z-20 flex items-center gap-4 sm:gap-6">
          {/* Dash Pagination Indicators */}
          <div className="flex items-center gap-1 sm:gap-1.5" role="tablist" aria-label="Danh sách phim nổi bật">
            {movies.slice(0, maxSlides).map((m, i) => {
              const isActive = index === i;
              return (
                <button
                  key={m.slug || i}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleSelect(i)}
                  className="py-3 px-1 min-h-[44px] min-w-[28px] sm:min-w-[32px] flex items-center justify-center cursor-pointer group focus-visible:ring-1 focus-visible:ring-amber-400 focus-visible:outline-none rounded"
                  title={formatMovieTitle(m.name)}
                  aria-label={`Chuyển tới phim ${formatMovieTitle(m.name)}`}
                >
                  <span
                    className={`relative block h-1 sm:h-1.5 rounded-full overflow-hidden transition-all duration-300 ${
                      isActive
                        ? 'w-7 sm:w-10 bg-white/30'
                        : 'w-3.5 sm:w-5 bg-white/25 group-hover:bg-white/60'
                    }`}
                  >
                    {isActive && (
                      <span
                        key={`slide-progress-${index}`}
                        className="absolute inset-0 bg-white rounded-full animate-slide-progress"
                      />
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Circular Outline Prev & Next Arrows (44x44px minimum touch targets) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border border-white/50 hover:border-white text-white flex items-center justify-center transition-all hover:bg-white/10 active:scale-95 cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400"
              title="Phim trước"
              aria-label="Phim trước"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border border-white/50 hover:border-white text-white flex items-center justify-center transition-all hover:bg-white/10 active:scale-95 cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400"
              title="Phim sau"
              aria-label="Phim sau"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Trailer Popup Modal (Plays with full sound, HD quality, and zero clutter on the banner) */}
      {showTrailerModal && trailerId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${movieTitle} Trailer`}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowTrailerModal(false)}
        >
          <div
            className="relative w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowTrailerModal(false)}
              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/70 hover:bg-black text-white hover:text-red-400 transition cursor-pointer"
              aria-label="Đóng trailer"
            >
              <X className="w-5 h-5" />
            </button>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${trailerId}?autoplay=1&rel=0`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              sandbox="allow-scripts allow-same-origin allow-presentation"
              referrerPolicy="no-referrer"
              allowFullScreen
              title={`${movieTitle} Trailer`}
            />
          </div>
        </div>
      )}
    </div>
  );
};
