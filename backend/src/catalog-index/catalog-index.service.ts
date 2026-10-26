import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CATALOG_TYPES, type CatalogType } from '../common/dto/catalog-query.dto';
import {
  DISCOVER_LANGUAGES,
  type DiscoverLanguage,
  type DiscoverQueryDto,
  type DiscoverSort,
} from '../common/dto/discover-query.dto';
import type { MovieSummaryDto } from '../movies/dto/movie.dto';
import type {
  CatalogIndexEntry,
  CatalogIndexSnapshot,
  CatalogIndexStatus,
  DiscoverFacets,
  DiscoverResult,
  FacetNamed,
} from './catalog-index.types';
import {
  CATALOG_INDEX_VERSION,
  CATALOG_PAGE_SIZE,
  LANGUAGE_LABELS,
  languageKeys,
  normalizeText,
} from './catalog-index.utils';

const INDEX_NOT_READY = 'Catalog index is not built. Run npm run index:refresh.';
const CATALOG_TYPE_SET = new Set<string>(CATALOG_TYPES);
const collator = new Intl.Collator('vi', { sensitivity: 'base' });

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

function parseSnapshot(value: unknown): CatalogIndexSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Snapshot is not an object');
  }
  const record = value as Partial<CatalogIndexSnapshot>;
  if (record.version !== CATALOG_INDEX_VERSION) {
    throw new Error(`Unsupported snapshot version: ${String(record.version)}`);
  }
  if (
    typeof record.generatedAt !== 'string' ||
    !Number.isFinite(Date.parse(record.generatedAt))
  ) {
    throw new Error('Snapshot generatedAt is invalid');
  }
  if (!Array.isArray(record.entries)) {
    throw new Error('Snapshot entries are missing');
  }

  const entries = record.entries
    .map(toEntry)
    .filter((entry): entry is CatalogIndexEntry => entry !== null);
  if (entries.length === 0) {
    throw new Error('Snapshot has no valid entries');
  }

  return {
    version: CATALOG_INDEX_VERSION,
    generatedAt: new Date(Date.parse(record.generatedAt)).toISOString(),
    totalItems: entries.length,
    entries,
  };
}

function toEntry(value: unknown): CatalogIndexEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Partial<CatalogIndexEntry>;
  const movie = record.movie;
  if (!movie || typeof movie !== 'object' || Array.isArray(movie)) return null;
  if (typeof movie.slug !== 'string' || movie.slug.length === 0) return null;
  if (typeof movie.name !== 'string') return null;

  const types = Array.isArray(record.types)
    ? record.types.filter((type): type is CatalogType => CATALOG_TYPE_SET.has(type))
    : [];
  if (types.length === 0) return null;

  const search =
    typeof record.search === 'string'
      ? record.search
      : normalizeText([movie.name, movie.origin_name].filter(Boolean).join(' '));

  return { movie, types: [...new Set(types)], search };
}

function increment<K>(map: Map<K, number>, key: K): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function incrementNamed(map: Map<string, FacetNamed>, slug: string, name: string): void {
  const current = map.get(slug);
  if (current) {
    current.count += 1;
    return;
  }
  map.set(slug, { slug, name: name || slug, count: 1 });
}

function buildFacets(entries: CatalogIndexEntry[], generatedAt: string): DiscoverFacets {
  const years = new Map<number, number>();
  const categories = new Map<string, FacetNamed>();
  const countries = new Map<string, FacetNamed>();
  const languages = new Map<DiscoverLanguage, number>();

  for (const entry of entries) {
    const movie = entry.movie;
    if (movie.year !== undefined) increment(years, movie.year);

    const seenCategories = new Set<string>();
    for (const category of movie.category ?? []) {
      if (!category.slug || seenCategories.has(category.slug)) continue;
      seenCategories.add(category.slug);
      incrementNamed(categories, category.slug, category.name);
    }

    const seenCountries = new Set<string>();
    for (const country of movie.country ?? []) {
      if (!country.slug || seenCountries.has(country.slug)) continue;
      seenCountries.add(country.slug);
      incrementNamed(countries, country.slug, country.name);
    }

    for (const language of new Set(languageKeys(movie.lang))) {
      increment(languages, language);
    }
  }

  return {
    years: [...years.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((left, right) => right.value - left.value),
    categories: [...categories.values()].sort(
      (left, right) =>
        right.count - left.count || collator.compare(left.name, right.name)
    ),
    countries: [...countries.values()].sort(
      (left, right) =>
        right.count - left.count || collator.compare(left.name, right.name)
    ),
    languages: DISCOVER_LANGUAGES.map((value) => ({
      value,
      label: LANGUAGE_LABELS[value],
      count: languages.get(value) ?? 0,
    })),
    totalItems: entries.length,
    generatedAt,
  };
}

function sortValue(movie: MovieSummaryDto, sort: DiscoverSort): number | string | undefined {
  switch (sort) {
    case 'updated': {
      const timestamp = Date.parse(movie.updatedAt ?? '');
      return Number.isFinite(timestamp) ? timestamp : undefined;
    }
    case 'year':
      return movie.year;
    case 'rating':
      return movie.tmdb?.vote_average;
    case 'votes':
      return movie.tmdb?.vote_count;
    case 'name': {
      const name = movie.name.trim();
      return name.length > 0 ? name : undefined;
    }
  }
}

function compareValues(
  left: number | string | undefined,
  right: number | string | undefined,
  order: 'asc' | 'desc'
): number {
  if (left === undefined || right === undefined) {
    if (left === undefined && right === undefined) return 0;
    return left === undefined ? 1 : -1;
  }
  const direction = order === 'asc' ? 1 : -1;
  if (typeof left === 'string' && typeof right === 'string') {
    return collator.compare(left, right) * direction;
  }
  if (typeof left === 'number' && typeof right === 'number') {
    return (left - right) * direction;
  }
  return 0;
}

function matches(entry: CatalogIndexEntry, query: DiscoverQueryDto): boolean {
  const movie = entry.movie;
  if (query.type && !entry.types.includes(query.type)) return false;
  if (query.year !== undefined && movie.year !== query.year) return false;
  if (query.category && !movie.category?.some((item) => item.slug === query.category)) {
    return false;
  }
  if (query.country && !movie.country?.some((item) => item.slug === query.country)) {
    return false;
  }
  if (query.rating !== undefined && query.rating > 0) {
    const rating = movie.tmdb?.vote_average;
    if (rating === undefined || rating < query.rating) return false;
  }
  if (query.language && !languageKeys(movie.lang).includes(query.language)) {
    return false;
  }
  if (query.chieurap === 'true' && movie.chieurap !== true) return false;
  if (query.chieurap === 'false' && movie.chieurap !== false) return false;
  if (query.q && !entry.search.includes(normalizeText(query.q))) return false;
  return true;
}

@Injectable()
export class CatalogIndexService implements OnModuleInit {
  private readonly logger = new Logger(CatalogIndexService.name);
  private snapshot: CatalogIndexSnapshot | null = null;
  private facets = new Map<'all' | CatalogType, DiscoverFacets>();
  private status: CatalogIndexStatus = { ready: false, totalItems: 0 };

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    const path = resolve(this.config.getOrThrow<string>('catalogIndex.path'));
    try {
      const raw = await readFile(path, 'utf8');
      const snapshot = parseSnapshot(JSON.parse(raw));
      this.snapshot = snapshot;
      this.facets = new Map([['all', buildFacets(snapshot.entries, snapshot.generatedAt)]]);
      for (const type of CATALOG_TYPES) {
        this.facets.set(
          type,
          buildFacets(
            snapshot.entries.filter((entry) => entry.types.includes(type)),
            snapshot.generatedAt
          )
        );
      }
      this.status = {
        ready: true,
        generatedAt: snapshot.generatedAt,
        totalItems: snapshot.totalItems,
      };
      this.logger.log(
        `Catalog index loaded: ${snapshot.totalItems} movies from ${snapshot.generatedAt}`
      );
    } catch (error) {
      const message = errorMessage(error);
      this.snapshot = null;
      this.facets.clear();
      this.status = { ready: false, totalItems: 0, error: message };
      this.logger.warn(`Catalog index unavailable: ${message}`);
    }
  }

  getStatus(): CatalogIndexStatus {
    return { ...this.status };
  }

  query(query: DiscoverQueryDto): DiscoverResult {
    if (!this.snapshot) {
      throw new ServiceUnavailableException(INDEX_NOT_READY);
    }

    const filtered = this.snapshot.entries.filter((entry) => matches(entry, query));
    const sorted = filtered
      .map((entry, index) => ({ entry, index }))
      .sort((left, right) => {
        const compared = compareValues(
          sortValue(left.entry.movie, query.sort),
          sortValue(right.entry.movie, query.sort),
          query.order
        );
        return compared !== 0 ? compared : left.index - right.index;
      })
      .map(({ entry }) => entry);

    const totalItems = sorted.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / CATALOG_PAGE_SIZE));
    const start = (query.page - 1) * CATALOG_PAGE_SIZE;
    const items = sorted
      .slice(start, start + CATALOG_PAGE_SIZE)
      .map((entry) => entry.movie);

    return {
      items,
      pagination: {
        page: query.page,
        totalPages,
        totalItems,
        totalItemsPerPage: CATALOG_PAGE_SIZE,
      },
      facets: this.facets.get(query.type ?? 'all') ?? buildFacets([], this.snapshot.generatedAt),
    };
  }
}
