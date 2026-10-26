import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { CATALOG_TYPES, type CatalogType } from './catalog-query.dto';
import { PageQueryDto } from './page-query.dto';
import { SLUG_PATTERN } from './slug-param.dto';
import { MOVIE_ORDERS, type MovieOrder } from './sortable-page-query.dto';

export const DISCOVER_SORTS = ['updated', 'year', 'rating', 'votes', 'name'] as const;
export type DiscoverSort = (typeof DISCOVER_SORTS)[number];

export const DISCOVER_LANGUAGES = ['vietsub', 'thuyet-minh', 'long-tieng'] as const;
export type DiscoverLanguage = (typeof DISCOVER_LANGUAGES)[number];

export const CHIEURAP_VALUES = ['true', 'false'] as const;
export type ChieurapValue = (typeof CHIEURAP_VALUES)[number];

export class DiscoverQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(DISCOVER_SORTS)
  sort: DiscoverSort = 'updated';

  @IsOptional()
  @IsIn(MOVIE_ORDERS)
  order: MovieOrder = 'desc';

  @IsOptional()
  @IsIn(CATALOG_TYPES)
  type?: CatalogType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1888)
  @Max(2100)
  year?: number;

  @IsOptional()
  @Matches(SLUG_PATTERN)
  category?: string;

  @IsOptional()
  @Matches(SLUG_PATTERN)
  country?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(10)
  rating?: number;

  @IsOptional()
  @IsIn(DISCOVER_LANGUAGES)
  language?: DiscoverLanguage;

  @IsOptional()
  @IsIn(CHIEURAP_VALUES)
  chieurap?: ChieurapValue;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  q?: string;
}
