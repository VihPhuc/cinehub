import React, { useState, useEffect, useRef } from 'react';
import { Film, Search, Bookmark, ChevronDown, Menu, X, Loader2 } from 'lucide-react';
import { GENRES, COUNTRIES, NAV_TABS } from '../constants/filters';
import { searchMovies, getImageUrl } from '../services/api';
import type { MovieItem } from '../types';

interface Props {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onSearch: (q: string) => void;
  onSelectGenre: (slug: string, name: string) => void;
  onSelectCountry: (slug: string, name: string) => void;
  onSelectMovie?: (slug: string) => void;
}

export const Navbar: React.FC<Props> = ({
  activeTab,
  onSelectTab,
  onSearch,
  onSelectGenre,
  onSelectCountry,
  onSelectMovie,
}) => {
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'genre' | 'country' | null>(null);
  const [suggestions, setSuggestions] = useState<MovieItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    if (!q.trim() || q.trim().length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(() => {
      setIsSearching(true);
      searchMovies(q.trim(), 1)
        .then((res) => {
          setSuggestions(res.items.slice(0, 6));
          setIsSearching(false);
        })
        .catch(() => {
          setIsSearching(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) {
      setShowSuggestions(false);
      onSearch(q.trim());
      setMenuOpen(false);
    }
  };
  return (
    <header className="sticky top-0 z-40 w-full bg-[#090a0f]/80 backdrop-blur-xl border-b border-white/[0.08] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Logo */}
        <button
          onClick={() => {
            onSelectTab('home');
            setQ('');
          }}
          className="group flex items-center gap-2.5 cursor-pointer text-left focus:outline-none"
        >
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 flex items-center justify-center shadow-lg shadow-red-600/30 group-hover:shadow-red-600/50 group-hover:scale-105 transition-all">
            <Film className="w-5 h-5 text-white" />
            <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xl font-black tracking-tight font-heading text-white">
              CINE<span className="bg-gradient-to-r from-red-500 via-rose-500 to-amber-400 bg-clip-text text-transparent">HUB</span>
            </span>
            <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-red-600/20 text-red-400 border border-red-500/30">
              HD
            </span>
          </div>
        </button>

        {/* Desktop Nav Items */}
        <nav className="hidden lg:flex items-center gap-1">
          {NAV_TABS.filter((t) => !['genres', 'countries', 'library'].includes(t.id)).map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onSelectTab(t.id)}
                className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-red-600/25 to-rose-600/15 text-red-400 border border-red-500/40 shadow-sm shadow-red-500/20'
                    : 'text-zinc-300 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                {t.label}
              </button>
            );
          })}

          {/* Genre Dropdown */}
          <div className="relative" onMouseLeave={() => setOpenDropdown(null)}>
            <button
              onClick={() => setOpenDropdown(openDropdown === 'genre' ? null : 'genre')}
              className={`flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                activeTab === 'genre'
                  ? 'bg-gradient-to-r from-red-600/25 to-rose-600/15 text-red-400 border border-red-500/40'
                  : 'text-zinc-300 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              Thể Loại <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openDropdown === 'genre' ? 'rotate-180' : ''}`} />
            </button>
            {openDropdown === 'genre' && (
              <div className="absolute top-full left-0 mt-1.5 w-80 glass-dropdown rounded-2xl p-2.5 grid grid-cols-2 gap-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
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
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 group-hover:bg-red-500 transition-colors" />
                    <span className="truncate">{g.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Country Dropdown */}
          <div className="relative" onMouseLeave={() => setOpenDropdown(null)}>
            <button
              onClick={() => setOpenDropdown(openDropdown === 'country' ? null : 'country')}
              className={`flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                activeTab === 'country'
                  ? 'bg-gradient-to-r from-red-600/25 to-rose-600/15 text-red-400 border border-red-500/40'
                  : 'text-zinc-300 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              Quốc Gia <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openDropdown === 'country' ? 'rotate-180' : ''}`} />
            </button>
            {openDropdown === 'country' && (
              <div className="absolute top-full left-0 mt-1.5 w-64 glass-dropdown rounded-2xl p-2.5 grid grid-cols-2 gap-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
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
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 group-hover:bg-red-500 transition-colors" />
                    <span className="truncate">{c.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Library Link */}
          <button
            onClick={() => onSelectTab('library')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
              activeTab === 'library'
                ? 'bg-gradient-to-r from-red-600/25 to-rose-600/15 text-red-400 border border-red-500/40 shadow-sm shadow-red-500/20'
                : 'text-zinc-300 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            <Bookmark className="w-4 h-4" /> Tủ Phim
          </button>
        </nav>

        {/* Right Search & Mobile Menu Button */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div ref={searchBoxRef} className="relative w-48 sm:w-64 lg:w-72">
            <form onSubmit={onSubmit}>
              <input
                ref={searchInputRef}
                type="text"
                value={q}
                onFocus={() => setShowSuggestions(true)}
                onChange={(e) => {
                  setQ(e.target.value);
                  setShowSuggestions(true);
                }}
                placeholder="Tìm phim, diễn viên..."
                className="w-full bg-white/[0.06] hover:bg-white/[0.09] text-white placeholder-zinc-400 text-xs sm:text-sm rounded-full pl-9 pr-14 py-2 border border-white/[0.1] focus:outline-none focus:border-red-500/80 focus:ring-2 focus:ring-red-500/25 transition-all"
              />
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              {q ? (
                <button
                  type="button"
                  onClick={() => {
                    setQ('');
                    setShowSuggestions(false);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold text-zinc-400 bg-white/[0.08] border border-white/10 rounded absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none select-none">
                  Ctrl K
                </kbd>
              )}
            </form>

            {/* Suggestions Popup */}
            {showSuggestions && q.trim().length >= 2 && (
              <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 glass-dropdown rounded-2xl shadow-2xl overflow-hidden z-50">
                <div className="p-2.5 border-b border-white/[0.08] text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Kết quả gợi ý</span>
                  {isSearching && <Loader2 className="w-3.5 h-3.5 text-red-500 animate-spin" />}
                </div>
                {suggestions.length === 0 && !isSearching ? (
                  <div className="p-4 text-center text-xs text-zinc-400">
                    Không tìm thấy phim phù hợp
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.05]">
                    {suggestions.map((m) => (
                      <button
                        key={m.slug}
                        type="button"
                        onClick={() => {
                          setShowSuggestions(false);
                          setQ('');
                          onSelectMovie?.(m.slug);
                        }}
                        className="w-full flex items-center gap-3 p-2.5 hover:bg-white/[0.08] transition-colors text-left cursor-pointer group"
                      >
                        <img
                          src={getImageUrl(m.thumb_url || m.poster_url)}
                          alt={m.name}
                          className="w-10 h-14 object-cover rounded-lg bg-zinc-950 shrink-0 border border-white/[0.08] group-hover:border-red-500/40 transition-colors"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-zinc-100 group-hover:text-red-400 transition-colors truncate">
                            {m.name}
                          </p>
                          {m.origin_name && (
                            <p className="text-[11px] text-zinc-400 truncate italic">
                              {m.origin_name}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-400">
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
                        setShowSuggestions(false);
                        onSearch(q.trim());
                      }}
                      className="w-full p-2.5 text-center text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-600/10 transition-colors cursor-pointer"
                    >
                      Xem tất cả kết quả cho "{q}" →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile menu toggle button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden p-2 rounded-xl bg-white/[0.06] border border-white/[0.1] text-zinc-300 hover:text-white cursor-pointer transition-colors"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {menuOpen && (
        <div className="lg:hidden border-t border-white/[0.08] bg-[#090a0f]/95 backdrop-blur-2xl px-4 py-4 space-y-4 max-h-[calc(100vh-4rem)] overflow-y-auto shadow-2xl animate-in fade-in slide-in-from-top-4 duration-200">
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
