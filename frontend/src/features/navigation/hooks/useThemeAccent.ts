import { useCallback, useRef, useState } from 'react';
import { applyTheme, getStoredTheme, type ThemeAccent } from '@/shared/theme';
import { useClickOutside } from './useClickOutside';

export function useThemeAccent(onThemeChange?: (theme: ThemeAccent) => void) {
  const [currentTheme, setCurrentTheme] = useState<ThemeAccent>(() => getStoredTheme());
  const [showThemePicker, setShowThemePicker] = useState(false);
  const themePickerRef = useRef<HTMLDivElement>(null);

  const closeThemePicker = useCallback(() => setShowThemePicker(false), []);
  useClickOutside(themePickerRef, closeThemePicker, showThemePicker, true);

  const selectTheme = useCallback((themeId: ThemeAccent) => {
    setCurrentTheme(themeId);
    applyTheme(themeId);
    setShowThemePicker(false);
    onThemeChange?.(themeId);
  }, [onThemeChange]);

  const toggleThemePicker = () => setShowThemePicker((open) => !open);

  return {
    currentTheme,
    showThemePicker,
    themePickerRef,
    toggleThemePicker,
    closeThemePicker,
    selectTheme,
  };
}
