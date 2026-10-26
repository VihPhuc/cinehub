import type { CatalogType } from '../common/dto/catalog-query.dto';
import type { DiscoverLanguage } from '../common/dto/discover-query.dto';
import type { MovieSummaryDto, PaginationDto } from '../movies/dto/movie.dto';

export interface CatalogIndexEntry {
  movie: MovieSummaryDto;
  types: CatalogType[];
  search: string;
}

export interface CatalogIndexSnapshot {
  version: 1;
  generatedAt: string;
  totalItems: number;
  entries: CatalogIndexEntry[];
}

export interface FacetCount {
  value: number;
  count: number;
}

export interface FacetNamed {
  slug: string;
  name: string;
  count: number;
}

export interface FacetLanguage {
  value: DiscoverLanguage;
  label: string;
  count: number;
}

export interface DiscoverFacets {
  years: FacetCount[];
  categories: FacetNamed[];
  countries: FacetNamed[];
  languages: FacetLanguage[];
  totalItems: number;
  generatedAt: string;
}

export interface DiscoverResult {
  items: MovieSummaryDto[];
  pagination: PaginationDto;
  facets: DiscoverFacets;
}

export interface CatalogIndexStatus {
  ready: boolean;
  generatedAt?: string;
  totalItems: number;
  error?: string;
}
