import React, { useState } from 'react';
import type { MovieItem } from '../types';
import { MovieCard } from './MovieCard';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from 'lucide-react';

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
}

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
}) => {
  const [jumpPage, setJumpPage] = useState('');

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(jumpPage, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages && onPageChange) {
      onPageChange(p);
      setJumpPage('');
    }
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full">
      {title && (
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <span className="w-1.5 h-6 bg-red-600 rounded-full" />
            {title}
          </h1>
          {subtitle && <p className="text-xs sm:text-sm text-zinc-400 mt-1">{subtitle}</p>}
        </div>
      )}

      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3 text-zinc-400">
          <Loader2 className="w-8 h-8 animate-spin text-red-500" />
          <span className="text-sm">Đang tải dữ liệu phim...</span>
        </div>
      ) : movies.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-zinc-400">
          <p className="text-base font-medium">Không tìm thấy phim nào phù hợp.</p>
          <span className="text-xs text-zinc-500 mt-1">Vui lòng thử tìm kiếm hoặc lọc từ khóa khác.</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {movies.map((m) => (
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
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mt-10">
          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-center">
            <button
              onClick={() => onPageChange(1)}
              disabled={page <= 1}
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 cursor-pointer"
              title="Trang đầu"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => onPageChange(Math.max(page - 1, 1))}
              disabled={page <= 1}
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 cursor-pointer"
              title="Trang trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {getPageNumbers().map((pNum, idx) =>
              pNum === '...' ? (
                <span key={`dots-${idx}`} className="px-2 text-zinc-500 text-sm select-none">
                  ...
                </span>
              ) : (
                <button
                  key={`p-${pNum}`}
                  onClick={() => onPageChange(pNum as number)}
                  className={`w-9 h-9 rounded-lg text-xs sm:text-sm font-semibold transition cursor-pointer ${
                    page === pNum
                      ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  {pNum}
                </button>
              )
            )}

            <button
              onClick={() => onPageChange(Math.min(page + 1, totalPages))}
              disabled={page >= totalPages}
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 cursor-pointer"
              title="Trang sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onPageChange(totalPages)}
              disabled={page >= totalPages}
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 cursor-pointer"
              title="Trang cuối"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleJump} className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span>Đến trang</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpPage}
              onChange={(e) => setJumpPage(e.target.value)}
              placeholder={String(page)}
              className="w-14 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-center text-white focus:outline-none focus:border-red-500 text-xs"
            />
            <span>/ {totalPages}</span>
            <button
              type="submit"
              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold cursor-pointer border border-zinc-700"
            >
              Đi
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
