import React, { useState, useEffect, useRef } from 'react';
import {
  Bookmark,
  Menu,
  X,
  Sparkles,
  Download,
  Palette,
  Check,
} from 'lucide-react';
import { GENRES, COUNTRIES, NAV_TABS } from './constants';
import { THEME_OPTIONS, type ThemeAccent, applyTheme, getStoredTheme } from '@/shared/theme';
import { NavbarLogo } from './NavbarLogo';
import { DesktopNav } from './DesktopNav';
import { SearchBar } from './SearchBar';
import { useRecentSearches } from './hooks/useRecentSearches';
import { useNavbarSearch } from './hooks/useNavbarSearch';

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeAccent>(() => getStoredTheme());
  const [showThemePicker, setShowThemePicker] = useState(false);
  const themePickerRef = useRef<HTMLDivElement>(null);

  const {
    recentSearches,
    saveRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
  } = useRecentSearches();

  const {
    q,
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
  } = useNavbarSearch({
    onSearch,
    onSelectMovie,
    onCloseMobileMenu: () => setMenuOpen(false),
    saveRecentSearch,
  });

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

  return (
    <header className="sticky top-0 z-40 w-full bg-[#090a0f]/85 backdrop-blur-xl border-b border-white/[0.08] transition-all">
      <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 min-h-16 flex flex-wrap items-center justify-between gap-3 py-2 sm:h-16 sm:flex-nowrap sm:py-0 2xl:gap-6">
        {/* Left Section: Logo & Desktop Navigation */}
        <div className="flex items-center gap-3 2xl:gap-8 min-w-0">
          <NavbarLogo
            onHome={() => {
              onSelectTab('home');
              clearQuery();
            }}
          />

          <DesktopNav
            activeTab={activeTab}
            onSelectTab={onSelectTab}
            onSelectGenre={onSelectGenre}
            onSelectCountry={onSelectCountry}
          />
        </div>

        {/* Right Search & Utility Buttons */}
        <div className="contents sm:flex sm:items-center sm:gap-2 sm:shrink-0 xl:gap-2.5">
          <SearchBar
            q={q}
            visibleSuggestions={visibleSuggestions}
            isSearching={isSearching}
            showSuggestions={showSuggestions}
            highlightIdx={highlightIdx}
            recentSearches={recentSearches}
            searchBoxRef={searchBoxRef}
            searchInputRef={searchInputRef}
            onQueryChange={handleQueryChange}
            onHighlight={setHighlightIdx}
            onFocus={handleFocus}
            onKeyDown={handleSearchKeyDown}
            onSubmit={handleSubmit}
            onClearSearch={clearSearch}
            onSelectSuggestion={handleSelectSuggestion}
            onSearchAll={handleSearchAll}
            onSelectTag={handleSelectTag}
            onRemoveRecent={removeRecentSearch}
            onClearRecent={clearRecentSearches}
          />

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
              className="hidden sm:flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl glass-pill hover:bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:border-amber-500/60 transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 shrink-0"
              title="Phim ngẫu nhiên: Chọn một phim bất ngờ"
              aria-label="Phim Ngẫu Nhiên"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
            </button>
          )}

          {/* Theme Accent Picker */}
          <div className="relative order-2 ml-auto shrink-0 sm:order-none sm:ml-0" ref={themePickerRef}>
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
                className="absolute top-[calc(100%+4rem)] -right-14 w-[calc(100vw-2rem)] sm:top-[calc(100%+0.625rem)] sm:right-0 sm:w-80 glass-dropdown rounded-2xl p-3 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150 border border-white/15"
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
            className="order-2 xl:hidden sm:order-none w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.1] text-zinc-300 hover:text-white cursor-pointer transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-red-500"
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
        <div id="mobile-nav-drawer" className="xl:hidden border-t border-white/[0.08] bg-[#090a0f]/95 backdrop-blur-2xl px-4 py-4 space-y-4 max-h-[80vh] overflow-y-auto shadow-2xl animate-in fade-in slide-in-from-top-4 duration-200">
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
