import React from 'react';
import { Home, Film, Tv, Sparkles, Bookmark } from 'lucide-react';

interface Props {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onRandomMovie?: () => void;
  onOpenRoulette?: () => void;
  favoriteCount?: number;
}

export const MobileBottomNav: React.FC<Props> = React.memo(({
  activeTab,
  onSelectTab,
  onRandomMovie,
  onOpenRoulette,
  favoriteCount = 0,
}) => {
  const triggerRoulette = onOpenRoulette || onRandomMovie || (() => {});

  const navItems = [
    {
      id: 'home',
      label: 'Trang Chủ',
      icon: Home,
      action: () => onSelectTab('home'),
      isActive: activeTab === 'home',
    },
    {
      id: 'phim-le',
      label: 'Phim Lẻ',
      icon: Film,
      action: () => onSelectTab('phim-le'),
      isActive: activeTab === 'phim-le',
    },
    {
      id: 'roulette',
      label: 'Ngẫu Nhiên',
      icon: Sparkles,
      action: triggerRoulette,
      isActive: false,
      isSpecial: true,
    },
    {
      id: 'phim-bo',
      label: 'Phim Bộ',
      icon: Tv,
      action: () => onSelectTab('phim-bo'),
      isActive: activeTab === 'phim-bo',
    },
    {
      id: 'library',
      label: 'Tủ Phim',
      icon: Bookmark,
      action: () => onSelectTab('library'),
      isActive: activeTab === 'library',
      badge: favoriteCount > 0 ? (favoriteCount > 99 ? '99+' : String(favoriteCount)) : undefined,
    },
  ];

  return (
    <nav
      aria-label="Điều hướng di động nhanh"
      className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-[#141414]/95 backdrop-blur-2xl border-t border-white/[0.08] shadow-[0_-10px_35px_rgba(0,0,0,0.8)] px-2 pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom,0px))]"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.action}
              className={`relative flex flex-col items-center justify-center py-1 px-2 rounded-2xl min-h-[48px] min-w-[54px] transition-all duration-200 cursor-pointer active:scale-95 ${
                item.isActive
                  ? 'text-[#E50914] font-black'
                  : item.isSpecial
                  ? 'text-[#E50914] font-bold'
                  : 'text-zinc-400 hover:text-zinc-200 font-medium'
              }`}
              aria-current={item.isActive ? 'page' : undefined}
            >
              {/* Icon Container with subtle active pill glow */}
              <div
                className={`relative p-1 rounded-xl transition-all ${
                  item.isActive
                    ? 'bg-[#E50914]/15 shadow-sm shadow-[#E50914]/30'
                    : item.isSpecial
                    ? 'bg-[#E50914]/15 border border-[#E50914]/35 shadow-sm shadow-[#E50914]/25'
                    : ''
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    item.isActive ? 'scale-110 stroke-[2.5]' : 'scale-100'
                  }`}
                />

                {/* Counter Badge for Library */}
                {item.badge && (
                  <span className="absolute -top-1 -right-2 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-gradient-to-r from-red-600 to-rose-500 text-white shadow-md shadow-red-600/50 min-w-[16px] text-center leading-tight border border-[#090a0f]">
                    {item.badge}
                  </span>
                )}
              </div>

              {/* Text Label */}
              <span className="text-[10px] tracking-tight leading-none mt-0.5">
                {item.label}
              </span>

              {/* Active Indicator Dot */}
              {item.isActive && (
                <span className="absolute bottom-0 w-1 h-1 rounded-full bg-red-500 shadow-sm shadow-red-500" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
});
