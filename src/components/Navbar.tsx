import React, { useState, useEffect, useRef } from 'react';
import {
  Film,
  Search,
  Bookmark,
  ChevronDown,
  Menu,
  X,
  Loader2,
  Sparkles,
  Download,
  TrendingUp,
  History,
  Palette,
  Check,
} from 'lucide-react';
import { GENRES, COUNTRIES, NAV_TABS } from '../constants/filters';
import { searchMovies, getImageUrl, formatMovieTitle } from '../services/api';
import type { MovieItem } from '../types';
import { THEME_OPTIONS, type ThemeAccent, applyTheme, getStoredTheme } from '../lib/theme';

const RECENT_SEARCHES_KEY = 'cinehub_recent_searches';
const TRENDING_TAGS = [
  'Phim Chiếu Rạp',
  'Anime Mới',
  'Hàn Quốc',
  'Kinh Dị',
  'Hành Động',
  'Gia Đình',
];

interface Props {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onSearch: (q: string) => void;
  onSelectGenre: (slug: string, name: string) => void;
  onSelectCountry: (slug: string, name: string) => void;
  onSelectMovie?: (slug: string) => void;
  onRandomMovie?: () => void;
  onInstallPwa?: () => void;
  canInstallPwa?: boolean;
  onThemeChange?: (theme: ThemeAccent) => void;
}

export const Navbar: React.FC<Props> = ({
  activeTab,
  onSelectTab,
  onSearch,
  onSelectGenre,
  onSelectCountry,
  onSelectMovie,
  onRandomMovie,
  onInstallPwa,
  canInstallPwa,
  onThemeChange,
}) => {
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'genre' | 'country' | null>(null);
  const [suggestions, setSuggestions] = useState<MovieItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [currentTheme, setCurrentTheme] = useState<ThemeAccent>(() => getStoredTheme());
  const [showThemePicker, setShowThemePicker] = useState(false);
  const themePickerRef = useRef<HTMLDivElement>(null);

  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const saveRecentSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const next = [
      trimmed,
      ...recentSearches.filter((s) => s.toLowerCase() !== trimmed.toLowerCase()),
    ].slice(0, 5);
    setRecentSearches(next);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  };

  const removeRecentSearch = (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = recentSearches.filter((s) => s !== term);
    setRecentSearches(next);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  };

  const clearRecentSearches = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  };

  const handleSelectTag = (tag: string) => {
    setQ(tag);
    saveRecentSearch(tag);
    setShowSuggestions(false);
    onSearch(tag);
    setMenuOpen(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setShowSuggestions(true);
      } else if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
        setShowSuggestions(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!showThemePicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (themePickerRef.current && !themePickerRef.current.contains(e.target as Node)) {
        setShowThemePicker(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowThemePicker(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [showThemePicker]);

  const handleSelectTheme = (themeId: ThemeAccent) => {
    setCurrentTheme(themeId);
    applyTheme(themeId);
    setShowThemePicker(false);
    onThemeChange?.(themeId);
  };

  useEffect(() => {
    if (!q.trim() || q.trim().length < 2) return;

    const abortCtrl = new AbortController();
    const timer = setTimeout(() => {
      setIsSearching(true);
      searchMovies(q.trim(), 1, abortCtrl.signal)
        .then((res) => {
          if (!abortCtrl.signal.aborted) {
            setSuggestions(res.items.slice(0, 6));
            setIsSearching(false);
          }
        })
        .catch(() => {
          if (!abortCtrl.signal.aborted) {
            setIsSearching(false);
          }
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      abortCtrl.abort();
    };
  }, [q]);

  const visibleSuggestions = q.trim().length >= 2 ? suggestions : [];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setShowSuggestions(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const count = visibleSuggestions.length;
      if (count > 0) {
        setHighlightIdx((prev) => (prev + 1) % count);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const count = visibleSuggestions.length;
      if (count > 0) {
        setHighlightIdx((prev) => (prev - 1 + count) % count);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowSuggestions(false);
      setHighlightIdx(-1);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
      setMenuOpen(false);
    }
  };
  return (
    <header className="sticky top-0 z-40 w-full bg-[#090a0f]/85 backdrop-blur-xl border-b border-white/[0.08] transition-all">
      <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 2xl:gap-6">
        {/* Left Section: Logo & Desktop Navigation */}
        <div className="flex items-center gap-3 2xl:gap-8 min-w-0">
          {/* Logo */}
          <button
            onClick={() => {
              onSelectTab('home');
              setQ('');
            }}
            className="group flex items-center gap-2.5 cursor-pointer text-left focus:outline-none shrink-0"
          >
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 flex items-center justify-center shadow-lg shadow-red-600/30 group-hover:shadow-red-600/50 group-hover:scale-105 transition-all shrink-0">
              <Film className="w-5 h-5 text-white" />
              <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-xl font-black tracking-tight font-heading text-white">
                CINE<span className="bg-gradient-to-r from-red-500 via-rose-500 to-amber-400 bg-clip-text text-transparent">HUB</span>
              </span>
              <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-red-600/20 text-red-400 border border-red-500/30">
                HD
              </span>
            </div>
          </button>

          {/* Desktop Nav Items */}
          <nav className="hidden xl:flex items-center gap-1 2xl:gap-1.5 shrink-0">
            {NAV_TABS.filter((t) => !['genres', 'countries', 'library'].includes(t.id)).map((t) => {
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => onSelectTab(t.id)}
                  className={`relative h-9 px-2.5 2xl:px-3 text-xs 2xl:text-sm whitespace-nowrap shrink-0 transition-colors duration-200 cursor-pointer inline-flex items-center justify-center rounded-lg ${
                    isActive
                      ? 'text-white font-bold after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:bg-gradient-to-r after:from-red-500 after:via-rose-500 after:to-amber-500 after:rounded-full after:shadow-[0_0_10px_rgba(239,68,68,0.9)]'
                      : 'text-zinc-400 hover:text-white font-medium hover:bg-white/[0.05]'
                  }`}
                >
                  {t.id === 'hoat-hinh' ? (
                    <span>
                      Anime<span className="hidden 2xl:inline"> / Hoạt Hình</span>
                    </span>
                  ) : (
                    <span>{t.label}</span>
                  )}
                </button>
              );
            })}

            {/* Genre Dropdown */}
            <div className="relative shrink-0" onMouseLeave={() => setOpenDropdown(null)}>
              <button
                onClick={() => setOpenDropdown(openDropdown === 'genre' ? null : 'genre')}
                className={`h-9 px-2.5 2xl:px-3 text-xs 2xl:text-sm whitespace-nowrap shrink-0 inline-flex items-center gap-1 transition-colors cursor-pointer rounded-lg ${
                  activeTab === 'genre'
                    ? 'text-white font-bold relative after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:bg-gradient-to-r after:from-red-500 after:via-rose-500 after:to-amber-500 after:rounded-full after:shadow-[0_0_10px_rgba(239,68,68,0.9)]'
                    : 'text-zinc-400 hover:text-white font-medium hover:bg-white/[0.05]'
                }`}
              >
                <span>Thể Loại</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 shrink-0 ${openDropdown === 'genre' ? 'rotate-180' : ''}`} />
              </button>
              {openDropdown === 'genre' && (
                <div className="absolute top-full left-0 pt-2 w-80 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="glass-dropdown rounded-2xl p-2.5 grid grid-cols-2 gap-1">
                    <div className="col-span-2 px-2 py-1 text-[11px] font-bold text-zinc-400 uppercase tracking-wider border-b border-white/[0.08] mb-1">
                      Khám phá thể loại
                    </div>
                    {GENRES.map((g) => (
                      <button
                        key={g.slug}
                        onClick={() => {
                          onSelectGenre(g.slug, g.name);
                          setOpenDropdown(null);
                        }}
                        className="flex items-center gap-2 text-left text-xs px-2.5 py-2 rounded-lg hover:bg-red-600/20 hover:text-red-300 text-zinc-300 transition-colors cursor-pointer group"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 group-hover:bg-red-500 transition-colors shrink-0" />
                        <span className="truncate">{g.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Country Dropdown */}
            <div className="relative shrink-0" onMouseLeave={() => setOpenDropdown(null)}>
              <button
                onClick={() => setOpenDropdown(openDropdown === 'country' ? null : 'country')}
                className={`h-9 px-2.5 2xl:px-3 text-xs 2xl:text-sm whitespace-nowrap shrink-0 inline-flex items-center gap-1 transition-colors cursor-pointer rounded-lg ${
                  activeTab === 'country'
                    ? 'text-white font-bold relative after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:bg-gradient-to-r after:from-red-500 after:via-rose-500 after:to-amber-500 after:rounded-full after:shadow-[0_0_10px_rgba(239,68,68,0.9)]'
                    : 'text-zinc-400 hover:text-white font-medium hover:bg-white/[0.05]'
                }`}
              >
                <span>Quốc Gia</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 shrink-0 ${openDropdown === 'country' ? 'rotate-180' : ''}`} />
              </button>
              {openDropdown === 'country' && (
                <div className="absolute top-full left-0 pt-2 w-64 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="glass-dropdown rounded-2xl p-2.5 grid grid-cols-2 gap-1">
                    <div className="col-span-2 px-2 py-1 text-[11px] font-bold text-zinc-400 uppercase tracking-wider border-b border-white/[0.08] mb-1">
                      Chọn quốc gia
                    </div>
                    {COUNTRIES.map((c) => (
                      <button
                        key={c.slug}
                        onClick={() => {
                          onSelectCountry(c.slug, c.name);
                          setOpenDropdown(null);
                        }}
                        className="flex items-center gap-2 text-left text-xs px-2.5 py-2 rounded-lg hover:bg-red-600/20 hover:text-red-300 text-zinc-300 transition-colors cursor-pointer group"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 group-hover:bg-red-500 transition-colors shrink-0" />
                        <span className="truncate">{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Library Link (Tủ Phim) */}
            <button
              onClick={() => onSelectTab('library')}
              className={`h-9 px-2.5 2xl:px-3 text-xs 2xl:text-sm whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'library'
                  ? 'text-white font-bold relative after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:bg-gradient-to-r after:from-red-500 after:via-rose-500 after:to-amber-500 after:rounded-full after:shadow-[0_0_10px_rgba(239,68,68,0.9)]'
                  : 'text-zinc-400 hover:text-white font-medium hover:bg-white/[0.05]'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5 shrink-0" />
              <span>Tủ Phim</span>
            </button>
          </nav>
        </div>

        {/* Right Search & Utility Buttons */}
        <div className="flex items-center gap-2 xl:gap-2.5 shrink-0">
          <div ref={searchBoxRef} className="relative w-48 sm:w-64 lg:w-72 xl:w-64 2xl:w-72">
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
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={handleSearchKeyDown}
                onChange={(e) => {
                  setQ(e.target.value);
                  setShowSuggestions(true);
                  setHighlightIdx(-1);
                }}
                placeholder="Tìm phim, diễn viên..."
                className="w-full h-9 bg-white/[0.06] hover:bg-white/[0.09] text-white placeholder-zinc-400 text-xs sm:text-sm rounded-full pl-8.5 pr-12 py-0 border border-white/[0.1] focus:outline-none focus:border-red-500/80 focus:ring-2 focus:ring-red-500/25 transition-all"
              />
              <Search className="w-4 h-4 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              {q ? (
                <button
                  type="button"
                  aria-label="Xóa từ khóa tìm kiếm"
                  onClick={() => {
                    setQ('');
                    setSuggestions([]);
                    setShowSuggestions(false);
                    setHighlightIdx(-1);
                  }}
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

            {/* Suggestions & Discovery Popup */}
            {showSuggestions && (
              <div
                id="navbar-search-suggestions"
                role="listbox"
                className="absolute top-full right-0 mt-2 w-80 sm:w-96 glass-dropdown rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
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
                            onClick={() => {
                              saveRecentSearch(formatMovieTitle(m.name));
                              setShowSuggestions(false);
                              setQ('');
                              setHighlightIdx(-1);
                              onSelectMovie?.(m.slug);
                            }}
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
                          onClick={() => {
                            saveRecentSearch(q.trim());
                            setShowSuggestions(false);
                            onSearch(q.trim());
                          }}
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
                            onClick={clearRecentSearches}
                            className="text-[11px] text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
                          >
                            Xóa hết
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {recentSearches.map((s) => (
                            <div
                              key={s}
                              onClick={() => handleSelectTag(s)}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs text-zinc-200 hover:text-white transition-colors cursor-pointer group"
                            >
                              <span>{s}</span>
                              <button
                                type="button"
                                onClick={(e) => removeRecentSearch(s, e)}
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
                            onClick={() => handleSelectTag(tag)}
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
            )}
          </div>

          {/* Quick Library Button (Shown on mobile & tablets where nav is collapsed) */}
          <button
            onClick={() => onSelectTab('library')}
            className={`hidden sm:flex xl:hidden items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl border transition-all cursor-pointer shrink-0 ${
              activeTab === 'library'
                ? 'bg-red-600/25 border-red-500/40 text-red-400 shadow-sm shadow-red-500/20'
                : 'glass-pill text-zinc-300 hover:text-white hover:bg-white/15 border-white/10'
            }`}
            title="Tủ phim đã lưu"
            aria-label="Tủ phim đã lưu"
          >
            <Bookmark className="w-4 h-4" />
          </button>

          {/* Random Movie Button */}
          {onRandomMovie && (
            <button
              onClick={onRandomMovie}
              className="flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl glass-pill hover:bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:border-amber-500/60 transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 shrink-0"
              title="Phim ngẫu nhiên: Chọn một phim bất ngờ"
              aria-label="Phim Ngẫu Nhiên"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
            </button>
          )}

          {/* Theme Accent Picker */}
          <div className="relative shrink-0" ref={themePickerRef}>
            <button
              type="button"
              onClick={() => setShowThemePicker(!showThemePicker)}
              className={`flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl glass-pill hover:bg-white/15 text-zinc-300 hover:text-white border transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 shrink-0 ${
                showThemePicker ? 'border-white/40 bg-white/15 ring-2 ring-white/20' : 'border-white/10'
              }`}
              title="Tùy chọn tông màu giao diện"
              aria-label="Tùy chọn tông màu giao diện"
              aria-haspopup="dialog"
              aria-expanded={showThemePicker}
              aria-controls="theme-picker-popover"
            >
              <Palette className="w-4 h-4 text-zinc-200" />
            </button>

            {showThemePicker && (
              <div
                id="theme-picker-popover"
                role="dialog"
                aria-label="Bảng chọn tông màu giao diện"
                className="absolute top-full right-0 mt-2 w-72 sm:w-80 glass-dropdown rounded-2xl p-3 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150 border border-white/15"
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.08]">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-zinc-400" />
                    Tông màu giao diện
                  </span>
                  <span className="text-[10px] text-zinc-400 font-medium">Lưu tự động</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {THEME_OPTIONS.map((theme) => {
                    const isSelected = currentTheme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => handleSelectTheme(theme.id)}
                        className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all cursor-pointer relative group ${
                          isSelected
                            ? 'bg-white/[0.12] border-white/30 shadow-md ring-1 ring-white/20'
                            : 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] hover:border-white/20'
                        }`}
                        aria-label={`Chọn tông màu ${theme.name}`}
                      >
                        <div className="flex items-center justify-between w-full mb-1.5">
                          <div
                            className={`w-5 h-5 rounded-full bg-gradient-to-tr ${theme.gradient} shadow-sm group-hover:scale-110 transition-transform`}
                          />
                          {isSelected ? (
                            <Check className="w-3.5 h-3.5 text-white" />
                          ) : (
                            <span className="text-[9px] text-zinc-400 font-semibold">{theme.badge}</span>
                          )}
                        </div>
                        <span className="text-xs font-bold text-white">{theme.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* PWA Install Button */}
          {canInstallPwa && onInstallPwa && (
            <button
              onClick={onInstallPwa}
              className="hidden sm:flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-gradient-to-r from-red-600/20 to-rose-600/20 hover:from-red-600/30 hover:to-rose-600/30 text-red-400 border border-red-500/40 transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 shrink-0"
              title="Cài đặt ứng dụng CineHub"
              aria-label="Cài App"
            >
              <Download className="w-4 h-4 text-red-400" />
            </button>
          )}

          {/* Mobile menu toggle button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="xl:hidden w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.1] text-zinc-300 hover:text-white cursor-pointer transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-red-500"
            aria-label={menuOpen ? "Đóng danh mục menu" : "Mở danh mục menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-drawer"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {menuOpen && (
        <div id="mobile-nav-drawer" className="xl:hidden border-t border-white/[0.08] bg-[#090a0f]/95 backdrop-blur-2xl px-4 py-4 space-y-4 max-h-[calc(100vh-4rem)] overflow-y-auto shadow-2xl animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="grid grid-cols-2 gap-2">
            {NAV_TABS.filter((t) => !['genres', 'countries', 'library'].includes(t.id)).map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  onSelectTab(t.id);
                  setMenuOpen(false);
                }}
                className={`px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-left transition cursor-pointer ${
                  activeTab === t.id
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-600/30'
                    : 'bg-white/[0.05] text-zinc-300 hover:text-white border border-white/[0.06]'
                }`}
              >
                {t.label}
              </button>
            ))}
            <button
              onClick={() => {
                onSelectTab('library');
                setMenuOpen(false);
              }}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-left transition cursor-pointer col-span-2 ${
                activeTab === 'library'
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-600/30'
                  : 'bg-white/[0.05] text-zinc-300 hover:text-white border border-white/[0.06]'
              }`}
            >
              <Bookmark className="w-4 h-4 text-red-400" /> Tủ Phim Đã Lưu
            </button>
            {onRandomMovie && (
              <button
                onClick={() => {
                  onRandomMovie();
                  setMenuOpen(false);
                }}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-left transition cursor-pointer col-span-2 bg-amber-500/10 text-amber-300 border border-amber-500/30"
              >
                <Sparkles className="w-4 h-4 text-amber-400" /> Chọn Phim Ngẫu Nhiên
              </button>
            )}
            {canInstallPwa && onInstallPwa && (
              <button
                onClick={() => {
                  onInstallPwa();
                  setMenuOpen(false);
                }}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-left transition cursor-pointer col-span-2 bg-red-600/20 text-red-400 border border-red-500/40"
              >
                <Download className="w-4 h-4 text-red-400" /> Cài Đặt Ứng Dụng (PWA)
              </button>
            )}
          </div>

          {/* Mobile Theme Accent Selector */}
          <div className="pt-2 border-t border-white/[0.08]">
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-zinc-400" />
              Tông màu giao diện
            </div>
            <div className="grid grid-cols-2 gap-2">
              {THEME_OPTIONS.map((theme) => {
                const isSelected = currentTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => handleSelectTheme(theme.id)}
                    className={`flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white/[0.12] border-white/30 shadow-sm'
                        : 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08]'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full bg-gradient-to-tr ${theme.gradient} shrink-0`} />
                    <span className="text-xs font-semibold text-white truncate">{theme.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-white ml-auto shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile Genres */}
          <div className="space-y-2 pt-2 border-t border-white/[0.08]">
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Thể Loại Phim</div>
            <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto p-1.5 bg-black/40 rounded-xl border border-white/[0.05]">
              {GENRES.map((g) => (
                <button
                  key={g.slug}
                  onClick={() => {
                    onSelectGenre(g.slug, g.name);
                    setMenuOpen(false);
                  }}
                  className="text-left text-[11px] p-2 rounded-lg hover:bg-red-600/20 hover:text-red-400 text-zinc-300 truncate"
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile Countries */}
          <div className="space-y-2 pt-2 border-t border-white/[0.08]">
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Quốc Gia</div>
            <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-black/40 rounded-xl border border-white/[0.05]">
              {COUNTRIES.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => {
                    onSelectCountry(c.slug, c.name);
                    setMenuOpen(false);
                  }}
                  className="text-left text-[11px] p-2 rounded-lg hover:bg-red-600/20 hover:text-red-400 text-zinc-300 truncate"
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
