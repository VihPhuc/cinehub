import React, { useState, useMemo } from 'react';
import type { MovieItem } from '@/shared/types';
import { MovieCard } from './MovieCard';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw,
  Search,
  X,
  SlidersHorizontal,
  Share2,
  Check,
} from 'lucide-react';

interface Props {
  title?: string;
  subtitle?: string;
  movies: MovieItem[];
  loading?: boolean;
  page?: number;
  totalPages?: number;
  onPageChange?: (p: number) => void;
  onSelectMovie: (m: MovieItem) => void;
  favorites: string[];
  onToggleFav: (m: MovieItem) => void;
  initialSort?: SortKey;
  initialYear?: string;
  initialRating?: string;
  onFacetChange?: (facets: { sort?: SortKey; year?: string; rating?: string }) => void;
}

export type SortKey =
  | 'updated-desc'
  | 'default'
  | 'rating'
  | 'votes'
  | 'year-desc'
  | 'year-asc'
  | 'name';

export const MovieGrid: React.FC<Props> = ({
  title,
  subtitle,
  movies,
  loading,
  page = 1,
  totalPages = 1,
  onPageChange,
  onSelectMovie,
  favorites,
  onToggleFav,
  initialSort,
  initialYear,
  initialRating,
  onFacetChange,
}) => {
  const [jumpPage, setJumpPage] = useState('');
  const [jumpError, setJumpError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>(initialYear || 'all');
  const [selectedRating, setSelectedRating] = useState<string>(initialRating || 'all');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedLang, setSelectedLang] = useState<string>('all');
  const [selectedCinema, setSelectedCinema] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>(initialSort || 'updated-desc');
  const [filterSearch, setFilterSearch] = useState('');
  const [copiedFilter, setCopiedFilter] = useState(false);

  const availableYears = useMemo(() => {
    return Array.from(new Set(movies.map((m) => m.year).filter(Boolean))).sort(
      (a, b) => (b as number) - (a as number)
    );
  }, [movies]);

  const availableGenres = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of movies) {
      if (m.category) {
        for (const c of m.category) {
          if (c.slug && c.name) map.set(c.slug, c.name);
        }
      }
    }
    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
  }, [movies]);

  const availableCountries = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of movies) {
      if (m.country) {
        for (const c of m.country) {
          if (c.slug && c.name) map.set(c.slug, c.name);
        }
      }
    }
    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
  }, [movies]);

  const hasActiveFilters =
    selectedYear !== 'all' ||
    selectedRating !== 'all' ||
    selectedGenre !== 'all' ||
    selectedCountry !== 'all' ||
    selectedLang !== 'all' ||
    selectedCinema !== 'all' ||
    (sortBy !== 'updated-desc' && sortBy !== 'default') ||
    filterSearch.trim() !== '';

  const resetFilters = () => {
    setSelectedYear('all');
    setSelectedRating('all');
    setSelectedGenre('all');
    setSelectedCountry('all');
    setSelectedLang('all');
    setSelectedCinema('all');
    setSortBy('updated-desc');
    setFilterSearch('');
    onFacetChange?.({ sort: 'updated-desc', year: 'all', rating: 'all' });
  };

  const displayedMovies = useMemo(() => {
    return movies
      .filter((m) => {
        // Filter year
        if (selectedYear !== 'all' && String(m.year) !== selectedYear) return false;

        // Filter rating
        if (selectedRating !== 'all') {
          const minScore = Number(selectedRating);
          const score = m.tmdb?.vote_average || 0;
          if (score < minScore) return false;
        }

        // Filter genre
        if (selectedGenre !== 'all') {
          if (
            !m.category ||
            !m.category.some(
              (c) => c.slug === selectedGenre || c.name.toLowerCase() === selectedGenre.toLowerCase()
            )
          ) {
            return false;
          }
        }

        // Filter country
        if (selectedCountry !== 'all') {
          if (
            !m.country ||
            !m.country.some(
              (c) => c.slug === selectedCountry || c.name.toLowerCase() === selectedCountry.toLowerCase()
            )
          ) {
            return false;
          }
        }

        // Filter language
        if (selectedLang !== 'all') {
          const l = (m.lang || '').toLowerCase();
          if (selectedLang === 'vietsub' && !l.includes('vietsub')) return false;
          if (selectedLang === 'thuyet-minh' && !l.includes('thuyết minh') && !l.includes('thuyet minh')) return false;
          if (selectedLang === 'long-tieng' && !l.includes('lồng tiếng') && !l.includes('long tieng')) return false;
        }

        // Filter cinema
        if (selectedCinema === 'chieurap' && !m.chieurap) return false;

        // Filter local keyword search
        if (filterSearch.trim()) {
          const kw = filterSearch.toLowerCase().trim();
          const matchName = m.name.toLowerCase().includes(kw);
          const matchOrigin = (m.origin_name || '').toLowerCase().includes(kw);
          if (!matchName && !matchOrigin) return false;
        }

        return true;
      })
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        if (sortBy === 'updated-desc' || sortBy === 'default') {
          const timeA = a.item.updatedAt ? Date.parse(a.item.updatedAt) : NaN;
          const timeB = b.item.updatedAt ? Date.parse(b.item.updatedAt) : NaN;
          const hasA = !Number.isNaN(timeA);
          const hasB = !Number.isNaN(timeB);

          if (hasA && hasB) {
            const diff = timeB - timeA;
            if (diff !== 0) return diff;
            return a.index - b.index;
          }
          if (hasA) return -1;
          if (hasB) return 1;
          return a.index - b.index;
        }
        if (sortBy === 'rating') {
          const rA = a.item.tmdb?.vote_average || 0;
          const rB = b.item.tmdb?.vote_average || 0;
          if (rB !== rA) return rB - rA;
          return a.index - b.index;
        }
        if (sortBy === 'votes') {
          const vA = a.item.tmdb?.vote_count || 0;
          const vB = b.item.tmdb?.vote_count || 0;
          if (vB !== vA) return vB - vA;
          return a.index - b.index;
        }
        if (sortBy === 'name') return a.item.name.localeCompare(b.item.name);
        if (sortBy === 'year-desc') {
          const yA = a.item.year || 0;
          const yB = b.item.year || 0;
          if (yB !== yA) return yB - yA;
          return a.index - b.index;
        }
        if (sortBy === 'year-asc') {
          const yA = a.item.year || 0;
          const yB = b.item.year || 0;
          if (yA !== yB) return yA - yB;
          return a.index - b.index;
        }
        return a.index - b.index;
      })
      .map(({ item }) => item);
  }, [
    movies,
    selectedYear,
    selectedRating,
    selectedGenre,
    selectedCountry,
    selectedLang,
    selectedCinema,
    filterSearch,
    sortBy,
  ]);

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onPageChange) return;

    const p = Number(jumpPage);
    if (!jumpPage.trim() || !Number.isInteger(p) || p < 1 || p > totalPages) {
      setJumpError(`Trang phải là số từ 1 đến ${totalPages}.`);
      return;
    }

    setJumpError(null);
    onPageChange(p);
    setJumpPage('');
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (page < totalPages - 2) pages.push('...');
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }
    return pages;
  };
  return (
    <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header and Filter Controls */}
      <div className="space-y-4 mb-6 pb-5 border-b border-white/[0.08]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            {title && (
              <h1 className="text-xl sm:text-3xl font-black text-white font-heading flex items-center gap-2.5 tracking-tight">
                <span className="w-1.5 h-6 sm:h-7 rounded-full bg-gradient-to-b from-red-500 via-rose-500 to-amber-500 shadow-sm shadow-red-500/50" />
                {title}
                {!loading && movies.length > 0 && (
                  <span className="text-xs font-bold text-zinc-300 bg-white/[0.08] border border-white/[0.1] px-2.5 py-0.5 rounded-full font-sans">
                    {hasActiveFilters ? `${displayedMovies.length}/${movies.length} phim (trên trang)` : `${movies.length} phim`}
                  </span>
                )}
              </h1>
            )}
            {subtitle && (
              <p className="text-xs sm:text-sm text-zinc-400 mt-1 font-medium pl-4">
                {subtitle}
              </p>
            )}
          </div>

          {/* Quick reset button and share filter on the right if active */}
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-bold px-3 py-1.5 rounded-xl bg-red-600/10 hover:bg-red-600/20 border border-red-500/30 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Xóa bộ lọc
              </button>
            )}
            <button
              onClick={() => {
                const url = new URL(window.location.href);
                if (selectedYear !== 'all') url.searchParams.set('year', selectedYear);
                else url.searchParams.delete('year');
                if (selectedRating !== 'all') url.searchParams.set('rating', selectedRating);
                else url.searchParams.delete('rating');
                if (sortBy !== 'updated-desc' && sortBy !== 'default') url.searchParams.set('sort', sortBy);
                else url.searchParams.delete('sort');
                navigator.clipboard.writeText(url.toString());
                setCopiedFilter(true);
                setTimeout(() => setCopiedFilter(false), 2000);
              }}
              className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white px-3 py-1.5 rounded-xl glass-pill hover:bg-white/15 border border-white/10 transition-colors cursor-pointer"
              title="Sao chép liên kết bộ lọc đang chọn"
            >
              {copiedFilter ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-zinc-400" />}
              <span>{copiedFilter ? 'Đã sao chép link' : 'Chia sẻ bộ lọc'}</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        {!loading && movies.length > 0 && (
          <div className="flex items-center gap-2.5 flex-wrap pt-2">
            {/* Quick in-page filter search */}
            <div className="relative flex-1 min-w-[160px] sm:max-w-xs">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Lọc nhanh tên phim..."
                className="w-full bg-white/[0.05] hover:bg-white/[0.08] focus:bg-white/[0.09] border border-white/[0.1] focus:border-red-500/50 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-zinc-400 focus:outline-none transition-all"
              />
              {filterSearch && (
                <button
                  onClick={() => setFilterSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Genre filter */}
            {availableGenres.length > 1 && (
              <div className="flex items-center gap-1 text-xs text-zinc-300">
                <select
                  value={selectedGenre}
                  onChange={(e) => setSelectedGenre(e.target.value)}
                  aria-label="Lọc theo thể loại"
                  className="bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-red-500 cursor-pointer transition-colors"
                >
                  <option value="all" className="bg-[#10121a]">Tất cả thể loại</option>
                  {availableGenres.map((g) => (
                    <option key={g.slug} value={g.slug} className="bg-[#10121a]">
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Country filter */}
            {availableCountries.length > 1 && (
              <div className="flex items-center gap-1 text-xs text-zinc-300">
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  aria-label="Lọc theo quốc gia"
                  className="bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-red-500 cursor-pointer transition-colors"
                >
                  <option value="all" className="bg-[#10121a]">Tất cả quốc gia</option>
                  {availableCountries.map((c) => (
                    <option key={c.slug} value={c.slug} className="bg-[#10121a]">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Language filter */}
            <div className="flex items-center gap-1 text-xs text-zinc-300">
              <select
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value)}
                className="bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-red-500 cursor-pointer transition-colors"
              >
                <option value="all" className="bg-[#10121a]">Tất cả bản dịch</option>
                <option value="vietsub" className="bg-[#10121a]">Vietsub</option>
                <option value="thuyet-minh" className="bg-[#10121a]">Thuyết Minh</option>
                <option value="long-tieng" className="bg-[#10121a]">Lồng Tiếng</option>
              </select>
            </div>

            {/* Cinema filter */}
            <div className="flex items-center gap-1 text-xs text-zinc-300">
              <select
                value={selectedCinema}
                onChange={(e) => setSelectedCinema(e.target.value)}
                className="bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-red-500 cursor-pointer transition-colors"
              >
                <option value="all" className="bg-[#10121a]">Tất cả định dạng</option>
                <option value="chieurap" className="bg-[#10121a]">Phim Chiếu Rạp</option>
              </select>
            </div>

            {/* Rating filter */}
            <div className="flex items-center gap-1 text-xs text-zinc-300">
              <select
                value={selectedRating}
                onChange={(e) => setSelectedRating(e.target.value)}
                aria-label="Lọc theo điểm đánh giá"
                className="bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-red-500 cursor-pointer transition-colors"
              >
                <option value="all" className="bg-[#10121a]">Mọi điểm số</option>
                <option value="8" className="bg-[#10121a]">⭐ Từ 8.0 trở lên</option>
                <option value="7" className="bg-[#10121a]">⭐ Từ 7.0 trở lên</option>
                <option value="6" className="bg-[#10121a]">⭐ Từ 6.0 trở lên</option>
              </select>
            </div>

            {/* Year filter */}
            {availableYears.length > 1 && (
              <div className="flex items-center gap-1 text-xs text-zinc-300">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  aria-label="Lọc theo năm phát hành"
                  className="bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-red-500 cursor-pointer transition-colors"
                >
                  <option value="all" className="bg-[#10121a]">Tất cả năm</option>
                  {availableYears.map((y) => (
                    <option key={y} value={String(y)} className="bg-[#10121a]">
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Sort by */}
            <div className="flex items-center gap-1.5 text-xs text-zinc-300 ml-auto">
              <span className="hidden sm:inline font-semibold text-zinc-400">
                <SlidersHorizontal className="w-3.5 h-3.5 inline mr-1" />
                Sắp xếp:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                aria-label="Sắp xếp danh sách phim"
                className="bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-red-500 cursor-pointer transition-colors"
              >
                <option value="updated-desc" className="bg-[#10121a]">Mới cập nhật</option>
                <option value="rating" className="bg-[#10121a]">⭐ Điểm TMDB cao nhất</option>
                <option value="votes" className="bg-[#10121a]">🔥 Đánh giá nhiều nhất</option>
                <option value="year-desc" className="bg-[#10121a]">📅 Năm phát hành mới nhất</option>
                <option value="year-asc" className="bg-[#10121a]">⏳ Năm cũ nhất</option>
                <option value="name" className="bg-[#10121a]">🔤 Tên A-Z</option>
              </select>
            </div>
          </div>
        )}

        {/* Client-side sort notice */}
        {!loading && movies.length > 0 && (
          <p className="text-[11px] text-zinc-400/80 italic pl-1">
            * Ghi chú: Sắp xếp client-side chỉ áp dụng cho 24 phim trên trang này. Muốn sắp xếp toàn bộ danh mục cần backend sort.
          </p>
        )}

        {/* Active Filter Chips */}
        {!loading && hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
            <span className="text-zinc-400 font-semibold text-[11px]">Đang lọc:</span>
            {selectedYear !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-red-600/15 border border-red-500/30 text-red-300 font-medium text-[11px]">
                Năm: {selectedYear}
                <button
                  type="button"
                  onClick={() => setSelectedYear('all')}
                  className="hover:text-white ml-0.5 cursor-pointer"
                  title="Bỏ lọc năm"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedRating !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-medium text-[11px]">
                ⭐ {selectedRating}.0+
                <button
                  type="button"
                  onClick={() => setSelectedRating('all')}
                  className="hover:text-white ml-0.5 cursor-pointer"
                  title="Bỏ lọc điểm đánh giá"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedGenre !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-rose-600/15 border border-rose-500/30 text-rose-300 font-medium text-[11px]">
                {availableGenres.find((g) => g.slug === selectedGenre)?.name || selectedGenre}
                <button
                  type="button"
                  onClick={() => setSelectedGenre('all')}
                  className="hover:text-white ml-0.5 cursor-pointer"
                  title="Bỏ lọc thể loại"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedCountry !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-sky-600/15 border border-sky-500/30 text-sky-300 font-medium text-[11px]">
                {availableCountries.find((c) => c.slug === selectedCountry)?.name || selectedCountry}
                <button
                  type="button"
                  onClick={() => setSelectedCountry('all')}
                  className="hover:text-white ml-0.5 cursor-pointer"
                  title="Bỏ lọc quốc gia"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedLang !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-purple-600/15 border border-purple-500/30 text-purple-300 font-medium text-[11px]">
                {selectedLang === 'vietsub'
                  ? 'Vietsub'
                  : selectedLang === 'thuyet-minh'
                    ? 'Thuyết Minh'
                    : 'Lồng Tiếng'}
                <button
                  type="button"
                  onClick={() => setSelectedLang('all')}
                  className="hover:text-white ml-0.5 cursor-pointer"
                  title="Bỏ lọc bản dịch"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedCinema !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-medium text-[11px]">
                Chiếu Rạp
                <button
                  type="button"
                  onClick={() => setSelectedCinema('all')}
                  className="hover:text-white ml-0.5 cursor-pointer"
                  title="Bỏ lọc chiếu rạp"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {sortBy !== 'updated-desc' && sortBy !== 'default' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white/10 border border-white/20 text-zinc-200 font-medium text-[11px]">
                {sortBy === 'rating'
                  ? '⭐ Điểm TMDB'
                  : sortBy === 'votes'
                    ? '🔥 Đánh giá nhiều nhất'
                    : sortBy === 'year-desc'
                      ? '📅 Năm phát hành mới nhất'
                      : sortBy === 'year-asc'
                        ? '⏳ Năm cũ nhất'
                        : '🔤 Tên A-Z'}
                <button
                  type="button"
                  onClick={() => setSortBy('updated-desc')}
                  className="hover:text-white ml-0.5 cursor-pointer"
                  title="Bỏ sắp xếp"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={resetFilters}
              className="text-red-400 hover:text-red-300 text-[11px] font-bold underline ml-1 cursor-pointer"
            >
              Xóa tất cả
            </button>
          </div>
        )}
      </div>

      {/* Grid Content with Skeleton Loaders */}
      {loading ? (
        <div
          role="status"
          aria-label="Đang tải danh sách phim"
          aria-busy="true"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3.5 sm:gap-4.5"
        >
          {Array.from({ length: 14 }).map((_, idx) => (
            <div
              key={`skeleton-${idx}`}
              className="rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.06] flex flex-col"
            >
              <div className="aspect-[2/3] w-full animate-shimmer" />
              <div className="p-3 space-y-2">
                <div className="h-4 w-3/4 rounded animate-shimmer" />
                <div className="h-3 w-1/2 rounded animate-shimmer" />
              </div>
            </div>
          ))}
        </div>
      ) : displayedMovies.length === 0 ? (
        <div
          role="status"
          className="py-20 flex flex-col items-center justify-center text-zinc-400 glass-panel rounded-2xl max-w-md mx-auto text-center p-6 space-y-3"
        >
          <p className="text-base font-bold text-zinc-200">Không tìm thấy phim nào phù hợp</p>
          <span className="text-xs text-zinc-400">
            {hasActiveFilters
              ? 'Các bộ lọc đang chọn không có kết quả phù hợp trên trang này.'
              : 'Vui lòng thử tìm kiếm hoặc chọn danh mục khác.'}
          </span>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md shadow-red-600/30 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-white"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Xóa tất cả bộ lọc
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3.5 sm:gap-4.5">
          {displayedMovies.map((m) => (
            <MovieCard
              key={m.slug}
              movie={m}
              onClick={() => onSelectMovie(m)}
              isFav={favorites.includes(m.slug)}
              onToggleFav={() => onToggleFav(m)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && onPageChange && !loading && (
        <nav aria-label="Phân trang" className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12 pt-6 border-t border-white/[0.08]">
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            <button
              onClick={() => onPageChange(1)}
              disabled={page <= 1}
              className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl glass-pill text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/15 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-red-500"
              title="Trang đầu"
              aria-label="Trang đầu tiên"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => onPageChange(Math.max(page - 1, 1))}
              disabled={page <= 1}
              className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl glass-pill text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/15 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-red-500"
              title="Trang trước"
              aria-label="Trang trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {getPageNumbers().map((pNum, idx) =>
              pNum === '...' ? (
                <span key={`dots-${idx}`} className="w-8 h-11 flex items-center justify-center text-zinc-400 text-sm select-none">
                  ...
                </span>
              ) : (
                <button
                  key={`p-${pNum}`}
                  onClick={() => onPageChange(pNum as number)}
                  className={`w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500 ${
                    page === pNum
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/40 glow-red-sm scale-105'
                      : 'glass-pill text-zinc-300 hover:text-white hover:bg-white/15'
                  }`}
                  aria-label={`Trang ${pNum}`}
                  aria-current={page === pNum ? 'page' : undefined}
                >
                  {pNum}
                </button>
              )
            )}

            <button
              onClick={() => onPageChange(Math.min(page + 1, totalPages))}
              disabled={page >= totalPages}
              className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl glass-pill text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/15 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-red-500"
              title="Trang sau"
              aria-label="Trang sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onPageChange(totalPages)}
              disabled={page >= totalPages}
              className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl glass-pill text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/15 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-red-500"
              title="Trang cuối"
              aria-label="Trang cuối cùng"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>

          <form
            noValidate
            onSubmit={handleJump}
            className="flex flex-col items-center gap-1 text-xs text-zinc-400"
          >
            <div className="flex items-center gap-2">
              <span>Đến trang:</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpPage}
                onChange={(e) => {
                  setJumpPage(e.target.value);
                  if (jumpError) setJumpError(null);
                }}
                placeholder={String(page)}
                aria-invalid={jumpError ? true : undefined}
                aria-describedby={jumpError ? 'jump-page-error' : undefined}
                className="w-14 h-11 min-h-[44px] bg-white/[0.06] border border-white/[0.1] rounded-xl px-2.5 py-1.5 text-center text-white focus:outline-none focus:border-red-500 text-xs font-semibold"
              />
              <span className="font-semibold text-zinc-300">/ {totalPages}</span>
              <button
                type="submit"
                className="h-11 min-h-[44px] px-3.5 flex items-center justify-center rounded-xl bg-white/[0.08] hover:bg-white/20 text-zinc-200 text-xs font-bold cursor-pointer border border-white/[0.1] transition-colors"
              >
                Đi
              </button>
            </div>
            {jumpError && (
              <span id="jump-page-error" role="alert" className="text-[11px] font-semibold text-red-400">
                {jumpError}
              </span>
            )}
          </form>
        </nav>
      )}
    </div>
  );
};
