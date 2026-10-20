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
    <header className="sticky top-0 z-40 w-full bg-[#0a0a0f]/90 backdrop-blur-md border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <button
          onClick={() => { onSelectTab('home'); setQ(''); }}
          className="flex items-center gap-2 cursor-pointer text-left"
        >
          <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/30">
            <Film className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-xl font-black tracking-wider bg-gradient-to-r from-red-500 to-amber-400 bg-clip-text text-transparent">
              CINEHUB
            </div>
          </div>
        </button>

        <nav className="hidden lg:flex items-center gap-1">
          {NAV_TABS.filter((t) => !['genres', 'countries', 'library'].includes(t.id)).map((t) => (
            <button
              key={t.id}
              onClick={() => onSelectTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                activeTab === t.id ? 'bg-red-600/20 text-red-400 border border-red-500/30' : 'text-zinc-300 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}

          {/* Genre */}
          <div className="relative" onMouseLeave={() => setOpenDropdown(null)}>
            <button
              onClick={() => setOpenDropdown(openDropdown === 'genre' ? null : 'genre')}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:text-white cursor-pointer"
            >
              Thể Loại <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {openDropdown === 'genre' && (
              <div className="absolute top-full left-0 w-72 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-2 grid grid-cols-2 gap-1 z-50">
                {GENRES.map((g) => (
                  <button
                    key={g.slug}
                    onClick={() => { onSelectGenre(g.slug, g.name); setOpenDropdown(null); }}
                    className="text-left text-xs p-1.5 rounded hover:bg-red-600/20 hover:text-red-400 text-zinc-300"
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Country */}
          <div className="relative" onMouseLeave={() => setOpenDropdown(null)}>
            <button
              onClick={() => setOpenDropdown(openDropdown === 'country' ? null : 'country')}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:text-white cursor-pointer"
            >
              Quốc Gia <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {openDropdown === 'country' && (
              <div className="absolute top-full left-0 w-56 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-2 grid grid-cols-2 gap-1 z-50">
                {COUNTRIES.map((c) => (
                  <button
                    key={c.slug}
                    onClick={() => { onSelectCountry(c.slug, c.name); setOpenDropdown(null); }}
                    className="text-left text-xs p-1.5 rounded hover:bg-red-600/20 hover:text-red-400 text-zinc-300"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => onSelectTab('library')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer ${
              activeTab === 'library' ? 'bg-red-600/20 text-red-400 border border-red-500/30' : 'text-zinc-300 hover:text-white'
            }`}
          >
            <Bookmark className="w-4 h-4" /> Tủ Phim
          </button>
        </nav>

        <div className="flex items-center gap-2">
          <div ref={searchBoxRef} className="relative w-44 sm:w-64">
            <form onSubmit={onSubmit}>
              <input
                type="text"
                value={q}
                onFocus={() => setShowSuggestions(true)}
                onChange={(e) => {
                  setQ(e.target.value);
                  setShowSuggestions(true);
                }}
                placeholder="Tìm phim, anime..."
                className="w-full bg-zinc-900 text-white placeholder-zinc-500 text-xs sm:text-sm rounded-full pl-9 pr-3 py-1.5 border border-zinc-700 focus:outline-none focus:border-red-500"
              />
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </form>

            {showSuggestions && q.trim().length >= 2 && (
              <div className="absolute top-full right-0 mt-2 w-72 sm:w-80 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl overflow-hidden z-50">
                <div className="p-2 border-b border-zinc-800 text-[11px] font-semibold text-zinc-400 flex items-center justify-between">
                  <span>Gợi ý kết quả</span>
                  {isSearching && <Loader2 className="w-3 h-3 text-red-500 animate-spin" />}
                </div>
                {suggestions.length === 0 && !isSearching ? (
                  <div className="p-3 text-center text-xs text-zinc-500">
                    Không tìm thấy phim phù hợp
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto divide-y divide-zinc-800/60">
                    {suggestions.map((m) => (
                      <button
                        key={m.slug}
                        type="button"
                        onClick={() => {
                          setShowSuggestions(false);
                          setQ('');
                          onSelectMovie?.(m.slug);
                        }}
                        className="w-full flex items-center gap-2.5 p-2 hover:bg-zinc-800/80 transition-colors text-left cursor-pointer"
                      >
                        <img
                          src={getImageUrl(m.thumb_url || m.poster_url)}
                          alt={m.name}
                          className="w-9 h-12 object-cover rounded bg-zinc-950 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-zinc-200 truncate">{m.name}</p>
                          <p className="text-[10px] text-zinc-400 truncate">{m.origin_name || m.year}</p>
                        </div>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setShowSuggestions(false);
                        onSearch(q.trim());
                      }}
                      className="w-full p-2 text-center text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-zinc-800/60 transition-colors cursor-pointer"
                    >
                      Xem tất cả kết quả cho "{q}" →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden p-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white cursor-pointer"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {menuOpen && (
        <div className="lg:hidden border-t border-zinc-800 bg-[#0a0a0f]/95 backdrop-blur-xl px-4 py-4 space-y-4 max-h-[calc(100vh-4rem)] overflow-y-auto shadow-2xl">
          <div className="grid grid-cols-2 gap-2">
            {NAV_TABS.filter((t) => !['genres', 'countries', 'library'].includes(t.id)).map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  onSelectTab(t.id);
                  setMenuOpen(false);
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium text-left transition cursor-pointer ${
                  activeTab === t.id ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-300 hover:text-white'
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
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-left transition cursor-pointer col-span-2 ${
                activeTab === 'library' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-300 hover:text-white'
              }`}
            >
              <Bookmark className="w-4 h-4" /> Tủ Phim Đã Lưu
            </button>
          </div>

          {/* Mobile Genres */}
          <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Thể Loại</div>
            <div className="grid grid-cols-3 gap-1 max-h-36 overflow-y-auto p-1 bg-zinc-950/60 rounded-lg">
              {GENRES.map((g) => (
                <button
                  key={g.slug}
                  onClick={() => {
                    onSelectGenre(g.slug, g.name);
                    setMenuOpen(false);
                  }}
                  className="text-left text-[11px] p-1.5 rounded hover:bg-red-600/20 hover:text-red-400 text-zinc-300 truncate"
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile Countries */}
          <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Quốc Gia</div>
            <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto p-1 bg-zinc-950/60 rounded-lg">
              {COUNTRIES.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => {
                    onSelectCountry(c.slug, c.name);
                    setMenuOpen(false);
                  }}
                  className="text-left text-[11px] p-1.5 rounded hover:bg-red-600/20 hover:text-red-400 text-zinc-300 truncate"
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
