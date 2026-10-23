import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { formatMovieTitle, searchMovies } from '@/shared/api';
import type { MovieItem } from '@/shared/types';
import { useClickOutside } from './useClickOutside';

interface UseNavbarSearchOptions {
  onSearch: (q: string) => void;
  onSelectMovie?: (slug: string) => void;
  onCloseMobileMenu: () => void;
  saveRecentSearch: (term: string) => void;
}

export function useNavbarSearch({
  onSearch,
  onSelectMovie,
  onCloseMobileMenu,
  saveRecentSearch,
}: UseNavbarSearchOptions) {
  const [q, setQ] = useState('');
  const [suggestions, setSuggestions] = useState<MovieItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        setShowSuggestions(true);
      } else if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        searchInputRef.current?.focus();
        setShowSuggestions(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setIsSearching(true);
      searchMovies(q.trim(), 1, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) {
            setSuggestions(result.items.slice(0, 6));
            setIsSearching(false);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) setIsSearching(false);
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  const closeSuggestions = useCallback(() => setShowSuggestions(false), []);
  useClickOutside(searchBoxRef, closeSuggestions);

  const visibleSuggestions = q.trim().length >= 2 ? suggestions : [];

  const handleQueryChange = (value: string) => {
    setQ(value);
    setShowSuggestions(true);
    setHighlightIdx(-1);
  };

  const handleFocus = () => setShowSuggestions(true);
  const clearQuery = () => setQ('');
  const clearSearch = () => {
    setQ('');
    setSuggestions([]);
    setShowSuggestions(false);
    setHighlightIdx(-1);
  };

  const handleSelectSuggestion = (movie: MovieItem) => {
    saveRecentSearch(formatMovieTitle(movie.name));
    setShowSuggestions(false);
    setQ('');
    setHighlightIdx(-1);
    onSelectMovie?.(movie.slug);
  };

  const handleSearchAll = () => {
    const term = q.trim();
    if (!term) return;
    saveRecentSearch(term);
    setShowSuggestions(false);
    onSearch(term);
  };

  const handleSelectTag = (tag: string) => {
    setQ(tag);
    saveRecentSearch(tag);
    setShowSuggestions(false);
    onSearch(tag);
    onCloseMobileMenu();
  };

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        setShowSuggestions(true);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const count = visibleSuggestions.length;
      if (count > 0) setHighlightIdx((prev) => (prev + 1) % count);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const count = visibleSuggestions.length;
      if (count > 0) setHighlightIdx((prev) => (prev - 1 + count) % count);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setShowSuggestions(false);
      setHighlightIdx(-1);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (highlightIdx >= 0 && highlightIdx < visibleSuggestions.length) {
      const selected = visibleSuggestions[highlightIdx];
      saveRecentSearch(selected.name);
      setShowSuggestions(false);
      setQ('');
      setHighlightIdx(-1);
      onSelectMovie?.(selected.slug);
      return;
    }

    if (q.trim()) {
      saveRecentSearch(q.trim());
      setShowSuggestions(false);
      setHighlightIdx(-1);
      onSearch(q.trim());
      onCloseMobileMenu();
    }
  };

  return {
    q,
    setQ,
    suggestions,
    visibleSuggestions,
    isSearching,
    showSuggestions,
    highlightIdx,
    setHighlightIdx,
    searchBoxRef,
    searchInputRef,
    handleQueryChange,
    handleFocus,
    clearQuery,
    clearSearch,
    handleSelectSuggestion,
    handleSearchAll,
    handleSelectTag,
    handleSearchKeyDown,
    handleSubmit,
  };
}
