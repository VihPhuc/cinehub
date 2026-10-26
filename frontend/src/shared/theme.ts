export type ThemeAccent = 'ruby' | 'amber' | 'cyan' | 'purple';

export interface ThemeOption {
  id: ThemeAccent;
  name: string;
  badge: string;
  colorHex: string;
  gradient: string;
  glowClass: string;
}

export const THEME_STORAGE_KEY = 'cinehub_theme_accent';

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'ruby',
    name: 'Đỏ Netflix',
    badge: 'Mặc định',
    colorHex: '#E50914',
    gradient: 'from-[#E50914] via-red-600 to-rose-600',
    glowClass: 'shadow-red-600/35',
  },
  {
    id: 'amber',
    name: 'Vàng Kim',
    badge: 'Hoàng Gia',
    colorHex: '#f59e0b',
    gradient: 'from-amber-500 via-orange-500 to-yellow-400',
    glowClass: 'shadow-amber-500/30',
  },
  {
    id: 'cyan',
    name: 'Neon Cyber',
    badge: 'Công Nghệ',
    colorHex: '#06b6d4',
    gradient: 'from-cyan-500 via-teal-500 to-emerald-400',
    glowClass: 'shadow-cyan-500/30',
  },
  {
    id: 'purple',
    name: 'Tím Huyền Bí',
    badge: 'Huyễn Tưởng',
    colorHex: '#a855f7',
    gradient: 'from-purple-500 via-violet-500 to-fuchsia-500',
    glowClass: 'shadow-purple-500/30',
  },
];

export function getStoredTheme(): ThemeAccent {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeAccent;
    if (saved && ['ruby', 'amber', 'cyan', 'purple'].includes(saved)) {
      return saved;
    }
  } catch {
    // ignore
  }
  return 'ruby';
}

export function applyTheme(theme: ThemeAccent): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.documentElement.setAttribute('data-theme', theme);
  } catch {
    // ignore
  }
}
