import React, { useState } from 'react';
import { Film, Search, Bookmark, ChevronDown, Menu, X } from 'lucide-react';
import { GENRES, COUNTRIES, NAV_TABS } from '../constants/filters';

interface Props {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onSearch: (q: string) => void;
  onSelectGenre: (slug: string, name: string) => void;
  onSelectCountry: (slug: string, name: string) => void;
}

export const Navbar: React.FC<Props> = ({
  activeTab,
  onSelectTab,
  onSearch,
  onSelectGenre,
  onSelectCountry,
}) => {
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'genre' | 'country' | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) {
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
          <form onSubmit={onSubmit} className="relative w-40 sm:w-60">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm phim, anime..."
              className="w-full bg-zinc-900 text-white placeholder-zinc-500 text-xs sm:text-sm rounded-full pl-9 pr-3 py-1.5 border border-zinc-700 focus:outline-none focus:border-red-500"
            />
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </form>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden p-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </header>
  );
};
