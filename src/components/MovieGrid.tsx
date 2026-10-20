import React from 'react';
import type { MovieItem } from '../types';
import { MovieCard } from './MovieCard';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

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
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => onPageChange(Math.max(page - 1, 1))}
            disabled={page <= 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm font-medium text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" /> Trước
          </button>

          <span className="text-sm font-medium text-zinc-400 px-3">
            Trang <span className="text-red-400 font-bold">{page}</span> / {totalPages}
          </span>

          <button
            onClick={() => onPageChange(Math.min(page + 1, totalPages))}
            disabled={page >= totalPages}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm font-medium text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 cursor-pointer"
          >
            Sau <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
