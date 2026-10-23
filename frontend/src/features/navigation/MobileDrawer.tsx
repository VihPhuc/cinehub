import { Bookmark, Check, Download, Palette, Sparkles } from 'lucide-react';
import { GENRES, COUNTRIES, NAV_TABS } from './constants';
import { THEME_OPTIONS, type ThemeAccent } from '@/shared/theme';

interface MobileDrawerProps {
  open: boolean;
  activeTab: string;
  currentTheme: ThemeAccent;
  canInstallPwa?: boolean;
  onSelectTab: (tab: string) => void;
  onSelectGenre: (slug: string, name: string) => void;
  onSelectCountry: (slug: string, name: string) => void;
  onRandomMovie?: () => void;
  onInstallPwa?: () => void;
  onSelectTheme: (theme: ThemeAccent) => void;
  onClose: () => void;
}

export function MobileDrawer({
  open,
  activeTab,
  currentTheme,
  canInstallPwa,
  onSelectTab,
  onSelectGenre,
  onSelectCountry,
  onRandomMovie,
  onInstallPwa,
  onSelectTheme,
  onClose,
}: MobileDrawerProps) {
  if (!open) return null;

  return (
    <div id="mobile-nav-drawer" className="xl:hidden border-t border-white/[0.08] bg-[#090a0f]/95 backdrop-blur-2xl px-4 py-4 space-y-4 max-h-[80vh] overflow-y-auto shadow-2xl animate-in fade-in slide-in-from-top-4 duration-200">
      <div className="grid grid-cols-2 gap-2">
        {NAV_TABS.filter((t) => !['genres', 'countries', 'library'].includes(t.id)).map((t) => (
          <button
            key={t.id}
            onClick={() => {
              onSelectTab(t.id);
              onClose();
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
            onClose();
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
              onClose();
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
              onClose();
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
                onClick={() => onSelectTheme(theme.id)}
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
                onClose();
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
                onClose();
              }}
              className="text-left text-[11px] p-2 rounded-lg hover:bg-red-600/20 hover:text-red-400 text-zinc-300 truncate"
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
