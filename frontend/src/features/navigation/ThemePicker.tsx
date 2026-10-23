import { Check, Palette } from 'lucide-react';
import type { RefObject } from 'react';
import { THEME_OPTIONS, type ThemeAccent } from '@/shared/theme';

interface ThemePickerProps {
  currentTheme: ThemeAccent;
  showThemePicker: boolean;
  themePickerRef: RefObject<HTMLDivElement | null>;
  onToggle: () => void;
  onSelect: (theme: ThemeAccent) => void;
}

export function ThemePicker({
  currentTheme,
  showThemePicker,
  themePickerRef,
  onToggle,
  onSelect,
}: ThemePickerProps) {
  return (
    <div
      className="relative order-2 ml-auto shrink-0 sm:order-none sm:ml-0"
      ref={themePickerRef}
    >
      <button
        type="button"
        onClick={onToggle}
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
                  onClick={() => onSelect(theme.id)}
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
  );
}
