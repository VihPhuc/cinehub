import { describe, expect, it, beforeEach } from 'vitest';
import { applyTheme, getStoredTheme, THEME_OPTIONS, THEME_STORAGE_KEY } from './theme';

describe('theme accent service', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('provides all 4 predefined theme options', () => {
    expect(THEME_OPTIONS.map((t) => t.id)).toEqual(['ruby', 'amber', 'cyan', 'purple']);
    for (const opt of THEME_OPTIONS) {
      expect(opt.name).toBeTruthy();
      expect(opt.colorHex).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(opt.gradient).toBeTruthy();
    }
  });

  it('defaults to ruby when no theme is stored', () => {
    expect(getStoredTheme()).toBe('ruby');
  });

  it('retrieves valid stored theme from localStorage', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'amber');
    expect(getStoredTheme()).toBe('amber');

    localStorage.setItem(THEME_STORAGE_KEY, 'cyan');
    expect(getStoredTheme()).toBe('cyan');

    localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    expect(getStoredTheme()).toBe('purple');
  });

  it('falls back to ruby when stored theme is invalid or corrupted', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'invalid-theme-xyz');
    expect(getStoredTheme()).toBe('ruby');
  });

  it('applyTheme saves preference and sets data-theme attribute on documentElement', () => {
    applyTheme('cyan');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('cyan');
    expect(document.documentElement.getAttribute('data-theme')).toBe('cyan');

    applyTheme('purple');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('purple');
    expect(document.documentElement.getAttribute('data-theme')).toBe('purple');
  });
});
