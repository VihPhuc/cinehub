import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { CATALOG_TYPES, type CatalogType } from '../common/dto/catalog-query.dto';
import { mapMovieSummary } from '../movies/mappers/movie.mapper';
import { PhimApiClient } from '../upstream/phimapi.client';
import type { UpstreamListResponse, UpstreamMovie } from '../upstream/upstream.types';
import type { CatalogIndexEntry, CatalogIndexSnapshot } from './catalog-index.types';
import { CATALOG_INDEX_VERSION, normalizeText } from './catalog-index.utils';

export interface CatalogIndexRefreshResult {
  path: string;
  totalItems: number;
  generatedAt: string;
  pagesFetched: number;
}

interface FirstPage {
  type: CatalogType;
  items: UpstreamMovie[];
  totalPages: number;
}

interface PageJob {
  type: CatalogType;
  page: number;
}

const MAX_PAGES_PER_TYPE = 5000;
const TYPE_ORDER = new Map<CatalogType, number>(
  CATALOG_TYPES.map((type, index) => [type, index])
);

function listItems(raw: UpstreamListResponse): UpstreamMovie[] {
  if (!raw || typeof raw !== 'object' || raw.status === false) {
    throw new Error('Upstream returned an invalid list payload');
  }
  const items = Array.isArray(raw.items) ? raw.items : raw.data?.items;
  if (!Array.isArray(items)) {
    throw new Error('Upstream returned an invalid list payload');
  }
  return items.filter(
    (item): item is UpstreamMovie => Boolean(item) && typeof item === 'object'
  );
}

function pageCount(raw: UpstreamListResponse): number {
  const value = raw.pagination?.totalPages ?? raw.data?.params?.pagination?.totalPages;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) return 1;
  return Math.min(Math.floor(value), MAX_PAGES_PER_TYPE);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  const workerCount = Math.min(Math.max(1, limit), items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

function toEntry(raw: UpstreamMovie, type: CatalogType): CatalogIndexEntry | null {
  const movie = mapMovieSummary(raw);
  if (movie.slug.length === 0 || movie.name.length === 0) return null;
  return {
    movie,
    types: [type],
    search: normalizeText([movie.name, movie.origin_name].filter(Boolean).join(' ')),
  };
}

function sortEntries(entries: CatalogIndexEntry[]): CatalogIndexEntry[] {
  return entries.sort((left, right) => {
    const leftTime = Date.parse(left.movie.updatedAt ?? '');
    const rightTime = Date.parse(right.movie.updatedAt ?? '');
    const leftValue = Number.isFinite(leftTime) ? leftTime : Number.NEGATIVE_INFINITY;
    const rightValue = Number.isFinite(rightTime) ? rightTime : Number.NEGATIVE_INFINITY;
    if (leftValue !== rightValue) return rightValue - leftValue;
    return left.movie.slug.localeCompare(right.movie.slug);
  });
}

@Injectable()
export class CatalogIndexerService {
  private readonly logger = new Logger(CatalogIndexerService.name);

  constructor(
    private readonly client: PhimApiClient,
    private readonly config: ConfigService
  ) {}

  async refresh(): Promise<CatalogIndexRefreshResult> {
    const path = resolve(this.config.getOrThrow<string>('catalogIndex.path'));
    const concurrency = this.config.getOrThrow<number>('catalogIndex.concurrency');
    const startedAt = Date.now();

    const firstPages = await mapWithConcurrency(
      [...CATALOG_TYPES],
      concurrency,
      async (type): Promise<FirstPage> => {
        const raw = await this.client.getJson<UpstreamListResponse>(
          `/v1/api/danh-sach/${type}`,
          { page: 1 }
        );
        return { type, items: listItems(raw), totalPages: pageCount(raw) };
      }
    );

    const jobs: PageJob[] = [];
    for (const firstPage of firstPages) {
      for (let page = 2; page <= firstPage.totalPages; page += 1) {
        jobs.push({ type: firstPage.type, page });
      }
    }

    const extraPages = await mapWithConcurrency(jobs, concurrency, async (job) => {
      const raw = await this.client.getJson<UpstreamListResponse>(
        `/v1/api/danh-sach/${job.type}`,
        { page: job.page }
      );
      return listItems(raw);
    });

    const bySlug = new Map<string, CatalogIndexEntry>();
    const addItems = (type: CatalogType, items: UpstreamMovie[]): void => {
      for (const raw of items) {
        const entry = toEntry(raw, type);
        if (!entry) continue;
        const existing = bySlug.get(entry.movie.slug);
        if (!existing) {
          bySlug.set(entry.movie.slug, entry);
          continue;
        }
        if (!existing.types.includes(type)) existing.types.push(type);
      }
    };

    for (const firstPage of firstPages) addItems(firstPage.type, firstPage.items);
    for (let index = 0; index < jobs.length; index += 1) {
      addItems(jobs[index].type, extraPages[index]);
    }

    for (const entry of bySlug.values()) {
      entry.types.sort((left, right) => (TYPE_ORDER.get(left) ?? 0) - (TYPE_ORDER.get(right) ?? 0));
    }
    const entries = sortEntries([...bySlug.values()]);
    if (entries.length === 0) {
      throw new Error('Catalog index crawl returned no movies');
    }

    const generatedAt = new Date().toISOString();
    const snapshot: CatalogIndexSnapshot = {
      version: CATALOG_INDEX_VERSION,
      generatedAt,
      totalItems: entries.length,
      entries,
    };
    await this.writeSnapshot(path, snapshot);
    const pagesFetched = firstPages.reduce((total, firstPage) => total + firstPage.totalPages, 0);

    this.logger.log(
      `Catalog index refreshed: ${entries.length} movies, ${pagesFetched} pages in ${Date.now() - startedAt}ms`
    );
    return { path, totalItems: entries.length, generatedAt, pagesFetched };
  }

  private async writeSnapshot(path: string, snapshot: CatalogIndexSnapshot): Promise<void> {
    const target = resolve(path);
    const temp = `${target}.tmp-${process.pid}-${Date.now()}`;
    await mkdir(dirname(target), { recursive: true });
    try {
      await writeFile(temp, JSON.stringify(snapshot));
      await rename(temp, target);
    } catch (error) {
      await rm(temp, { force: true }).catch(() => undefined);
      throw error;
    }
  }
}
