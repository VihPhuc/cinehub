import { useState } from 'react';
import { Bookmark, ChevronDown } from 'lucide-react';
import { GENRES, COUNTRIES, NAV_TABS } from './constants';

interface DesktopNavProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onSelectGenre: (slug: string, name: string) => void;
  onSelectCountry: (slug: string, name: string) => void;
}

interface NavDropdownProps {
  label: string;
  title: string;
  active: boolean;
  open: boolean;
  widthClass: string;
  items: { name: string; slug: string }[];
  onToggle: () => void;
  onClose: () => void;
  onSelect: (slug: string, name: string) => void;
}

function NavDropdown({
  label,
  title,
  active,
  open,
  widthClass,
  items,
  onToggle,
  onClose,
  onSelect,
}: NavDropdownProps) {
  return (
    <div className="relative shrink-0" onMouseLeave={onClose}>
      <button
        onClick={onToggle}
        className={`h-9 px-2.5 2xl:px-3 text-xs 2xl:text-sm whitespace-nowrap shrink-0 inline-flex items-center gap-1 transition-colors cursor-pointer rounded-lg ${
          active
            ? 'text-white font-bold relative after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:bg-gradient-to-r after:from-red-500 after:via-rose-500 after:to-amber-500 after:rounded-full after:shadow-[0_0_10px_rgba(239,68,68,0.9)]'
            : 'text-zinc-400 hover:text-white font-medium hover:bg-white/[0.05]'
        }`}
      >
        <span>{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className={`absolute top-full left-0 pt-2 ${widthClass} z-50 animate-in fade-in slide-in-from-top-2 duration-200`}>
          <div className="glass-dropdown rounded-2xl p-2.5 grid grid-cols-2 gap-1">
            <div className="col-span-2 px-2 py-1 text-[11px] font-bold text-zinc-400 uppercase tracking-wider border-b border-white/[0.08] mb-1">
              {title}
            </div>
            {items.map((item) => (
              <button
                key={item.slug}
                onClick={() => {
                  onSelect(item.slug, item.name);
                  onClose();
                }}
                className="flex items-center gap-2 text-left text-xs px-2.5 py-2 rounded-lg hover:bg-red-600/20 hover:text-red-300 text-zinc-300 transition-colors cursor-pointer group"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 group-hover:bg-red-500 transition-colors shrink-0" />
                <span className="truncate">{item.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function DesktopNav({
  activeTab,
  onSelectTab,
  onSelectGenre,
  onSelectCountry,
}: DesktopNavProps) {
  const [openDropdown, setOpenDropdown] = useState<'genre' | 'country' | null>(null);

  return (
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

      <NavDropdown
        label="Thể Loại"
        title="Khám phá thể loại"
        active={activeTab === 'genre'}
        open={openDropdown === 'genre'}
        widthClass="w-80"
        items={GENRES}
        onToggle={() => setOpenDropdown(openDropdown === 'genre' ? null : 'genre')}
        onClose={() => setOpenDropdown(null)}
        onSelect={onSelectGenre}
      />

      <NavDropdown
        label="Quốc Gia"
        title="Chọn quốc gia"
        active={activeTab === 'country'}
        open={openDropdown === 'country'}
        widthClass="w-64"
        items={COUNTRIES}
        onToggle={() => setOpenDropdown(openDropdown === 'country' ? null : 'country')}
        onClose={() => setOpenDropdown(null)}
        onSelect={onSelectCountry}
      />

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
  );
}
