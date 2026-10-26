import React, { useState, useEffect } from 'react';
import {
  Bookmark,
  Menu,
  X,
  Sparkles,
  Download,
} from 'lucide-react';
import { type ThemeAccent } from '@/shared/theme';
import { NavbarLogo } from './NavbarLogo';
import { DesktopNav } from './DesktopNav';
import { SearchBar } from './SearchBar';
import { ThemePicker } from './ThemePicker';
import { MobileDrawer } from './MobileDrawer';
import { useRecentSearches } from './hooks/useRecentSearches';
import { useNavbarSearch } from './hooks/useNavbarSearch';
import { useThemeAccent } from './hooks/useThemeAccent';

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
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 20;
      setIsScrolled((prev) => (prev !== scrolled ? scrolled : prev));
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const {
    currentTheme,
    showThemePicker,
    themePickerRef,
    toggleThemePicker,
    selectTheme,
  } = useThemeAccent(onThemeChange);

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

  return (
    <header
      className={`sticky top-0 z-40 w-full transition-all duration-300 ${
        isScrolled
          ? 'bg-[#141414]/95 backdrop-blur-md border-b border-white/[0.08] shadow-2xl'
          : 'bg-gradient-to-b from-black/85 via-black/45 to-transparent border-b border-transparent'
      }`}
    >
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

          <ThemePicker
            currentTheme={currentTheme}
            showThemePicker={showThemePicker}
            themePickerRef={themePickerRef}
            onToggle={toggleThemePicker}
            onSelect={selectTheme}
          />

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

      <MobileDrawer
        open={menuOpen}
        activeTab={activeTab}
        currentTheme={currentTheme}
        canInstallPwa={canInstallPwa}
        onSelectTab={onSelectTab}
        onSelectGenre={onSelectGenre}
        onSelectCountry={onSelectCountry}
        onRandomMovie={onRandomMovie}
        onInstallPwa={onInstallPwa}
        onSelectTheme={selectTheme}
        onClose={() => setMenuOpen(false)}
      />
    </header>
  );
};
