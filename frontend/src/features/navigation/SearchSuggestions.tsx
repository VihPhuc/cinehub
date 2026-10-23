import { History, Loader2, TrendingUp, X } from 'lucide-react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { formatMovieTitle, getImageUrl } from '@/shared/api';
import type { MovieItem } from '@/shared/types';

const TRENDING_TAGS = [
  'Phim Chiếu Rạp',
  'Anime Mới',
  'Hàn Quốc',
  'Kinh Dị',
  'Hành Động',
  'Gia Đình',
];

interface SearchSuggestionsProps {
  q: string;
  visibleSuggestions: MovieItem[];
  isSearching: boolean;
  highlightIdx: number;
  recentSearches: string[];
  onHighlight: (index: number) => void;
  onSelectSuggestion: (movie: MovieItem) => void;
  onSearchAll: () => void;
  onSelectTag: (tag: string) => void;
  onRemoveRecent: (term: string, event: ReactMouseEvent) => void;
  onClearRecent: (event: ReactMouseEvent) => void;
}

export function SearchSuggestions({
  q,
  visibleSuggestions,
  isSearching,
  highlightIdx,
  recentSearches,
  onHighlight,
  onSelectSuggestion,
  onSearchAll,
  onSelectTag,
  onRemoveRecent,
  onClearRecent,
}: SearchSuggestionsProps) {
  return (
    <div
      id="navbar-search-suggestions"
      role="listbox"
      className="absolute top-full right-0 mt-2 w-full sm:w-96 glass-dropdown rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
    >
      {q.trim().length >= 2 ? (
        <>
          <div className="p-2.5 border-b border-white/[0.08] text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
            <span>Kết quả gợi ý</span>
            {isSearching && <Loader2 className="w-3.5 h-3.5 text-red-500 animate-spin" />}
          </div>
          {visibleSuggestions.length === 0 && !isSearching ? (
            <div className="p-4 text-center text-xs text-zinc-400">
              Không tìm thấy phim phù hợp
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.05]">
              {visibleSuggestions.map((m, idx) => (
                <button
                  id={`suggestion-item-${idx}`}
                  key={m.slug}
                  role="option"
                  aria-selected={highlightIdx === idx}
                  type="button"
                  onMouseEnter={() => onHighlight(idx)}
                  onClick={() => onSelectSuggestion(m)}
                  className={`w-full flex items-center gap-3 p-2.5 transition-colors text-left cursor-pointer group ${
                    highlightIdx === idx ? 'bg-white/[0.14] border-l-2 border-red-500' : 'hover:bg-white/[0.08]'
                  }`}
                >
                  <img
                    src={getImageUrl(m.thumb_url || m.poster_url)}
                    alt={formatMovieTitle(m.name)}
                    className="w-10 h-14 object-cover rounded-lg bg-zinc-950 shrink-0 border border-white/[0.08] group-hover:border-red-500/40 transition-colors"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-zinc-100 group-hover:text-red-400 transition-colors truncate">
                      {formatMovieTitle(m.name)}
                    </p>
                    {m.origin_name && (
                      <p className="text-[11px] text-zinc-400 truncate italic">
                        {m.origin_name}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-400">
                      {m.year && <span className="text-zinc-300 font-semibold">{m.year}</span>}
                      {m.quality && (
                        <span className="px-1.5 py-0.2 rounded bg-red-600/80 text-white font-bold">
                          {m.quality}
                        </span>
                      )}
                      {m.episode_current && (
                        <span className="text-amber-400 font-medium truncate">
                          {m.episode_current}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
              <button
                type="button"
                onClick={onSearchAll}
                className="w-full p-2.5 text-center text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-600/10 transition-colors cursor-pointer"
              >
                Xem tất cả kết quả cho "{q}" →
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="p-3.5 space-y-3.5">
          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                <span className="flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-zinc-400" />
                  Tìm kiếm gần đây
                </span>
                <button
                  type="button"
                  onClick={onClearRecent}
                  className="text-[11px] text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
                >
                  Xóa hết
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recentSearches.map((s) => (
                  <div
                    key={s}
                    onClick={() => onSelectTag(s)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs text-zinc-200 hover:text-white transition-colors cursor-pointer group"
                  >
                    <span>{s}</span>
                    <button
                      type="button"
                      onClick={(e) => onRemoveRecent(s, e)}
                      className="text-zinc-400 hover:text-red-400 p-0.5 cursor-pointer"
                      title="Xóa"
                      aria-label={`Xóa lịch sử tìm kiếm ${s}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trending Searches */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-red-500" />
              Xu hướng tìm kiếm
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TRENDING_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onSelectTag(tag)}
                  className="px-2.5 py-1 rounded-xl glass-pill hover:bg-red-600/20 hover:text-red-300 text-xs text-zinc-300 transition-all cursor-pointer border border-white/10"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
