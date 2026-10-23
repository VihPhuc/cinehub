import { Search, X } from 'lucide-react';
import type {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  RefObject,
} from 'react';
import type { MovieItem } from '@/shared/types';
import { SearchSuggestions } from './SearchSuggestions';

interface SearchBarProps {
  q: string;
  visibleSuggestions: MovieItem[];
  isSearching: boolean;
  showSuggestions: boolean;
  highlightIdx: number;
  recentSearches: string[];
  searchBoxRef: RefObject<HTMLDivElement | null>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  onQueryChange: (value: string) => void;
  onHighlight: (index: number) => void;
  onFocus: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent) => void;
  onClearSearch: () => void;
  onSelectSuggestion: (movie: MovieItem) => void;
  onSearchAll: () => void;
  onSelectTag: (tag: string) => void;
  onRemoveRecent: (term: string, event: ReactMouseEvent) => void;
  onClearRecent: (event: ReactMouseEvent) => void;
}

export function SearchBar({
  q,
  visibleSuggestions,
  isSearching,
  showSuggestions,
  highlightIdx,
  recentSearches,
  searchBoxRef,
  searchInputRef,
  onQueryChange,
  onHighlight,
  onFocus,
  onKeyDown,
  onSubmit,
  onClearSearch,
  onSelectSuggestion,
  onSearchAll,
  onSelectTag,
  onRemoveRecent,
  onClearRecent,
}: SearchBarProps) {
  return (
    <div
      ref={searchBoxRef}
      className="relative order-3 w-full sm:order-none sm:w-48 md:w-64 lg:w-72 xl:w-64 2xl:w-72"
    >
      <form onSubmit={onSubmit} role="search">
        <label htmlFor="navbar-search-input" className="sr-only">
          Tìm kiếm phim, diễn viên
        </label>
        <input
          id="navbar-search-input"
          ref={searchInputRef}
          type="text"
          role="combobox"
          aria-expanded={showSuggestions}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-controls="navbar-search-suggestions"
          aria-activedescendant={highlightIdx >= 0 ? `suggestion-item-${highlightIdx}` : undefined}
          value={q}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Tìm phim, diễn viên..."
          className="w-full h-9 bg-white/[0.06] hover:bg-white/[0.09] text-white placeholder-zinc-400 text-xs sm:text-sm rounded-full pl-8.5 pr-12 py-0 border border-white/[0.1] focus:outline-none focus:border-red-500/80 focus:ring-2 focus:ring-red-500/25 transition-all"
        />
        <Search className="w-4 h-4 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        {q ? (
          <button
            type="button"
            aria-label="Xóa từ khóa tìm kiếm"
            onClick={onClearSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white w-8 h-8 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-full hover:bg-white/10 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <kbd className="hidden xl:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold text-zinc-400 bg-white/[0.08] border border-white/10 rounded absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none select-none">
            Ctrl K
          </kbd>
        )}
      </form>
      {showSuggestions && (
        <SearchSuggestions
          q={q}
          visibleSuggestions={visibleSuggestions}
          isSearching={isSearching}
          highlightIdx={highlightIdx}
          recentSearches={recentSearches}
          onHighlight={onHighlight}
          onSelectSuggestion={onSelectSuggestion}
          onSearchAll={onSearchAll}
          onSelectTag={onSelectTag}
          onRemoveRecent={onRemoveRecent}
          onClearRecent={onClearRecent}
        />
      )}
    </div>
  );
}
