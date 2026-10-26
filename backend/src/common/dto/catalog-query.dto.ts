import { IsIn } from 'class-validator';
import { MovieListQueryDto } from './movie-list-query.dto';

export const CATALOG_TYPES = ['phim-le', 'phim-bo', 'hoat-hinh', 'tv-shows'] as const;
export type CatalogType = (typeof CATALOG_TYPES)[number];

export class CatalogQueryDto extends MovieListQueryDto {
  @IsIn(CATALOG_TYPES)
  type!: CatalogType;
}
