import type { DiscoverLanguage } from '../common/dto/discover-query.dto';

export const CATALOG_INDEX_VERSION = 1;
export const CATALOG_PAGE_SIZE = 24;

export const LANGUAGE_LABELS: Record<DiscoverLanguage, string> = {
  vietsub: 'Vietsub',
  'thuyet-minh': 'Thuyết Minh',
  'long-tieng': 'Lồng Tiếng',
};

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/đ/g, 'd');
}

export function languageKeys(lang: string | undefined): DiscoverLanguage[] {
  if (!lang) return [];
  const normalized = normalizeText(lang);
  const keys: DiscoverLanguage[] = [];
  if (normalized.includes('vietsub')) keys.push('vietsub');
  if (normalized.includes('thuyet minh')) keys.push('thuyet-minh');
  if (normalized.includes('long tieng')) keys.push('long-tieng');
  return keys;
}
