import { IsIn } from 'class-validator';
import { PageQueryDto } from './page-query.dto';

export const CATALOG_TYPES = ['phim-le', 'phim-bo', 'hoat-hinh', 'tv-shows'] as const;
export type CatalogType = (typeof CATALOG_TYPES)[number];

export class CatalogQueryDto extends PageQueryDto {
  @IsIn(CATALOG_TYPES)
  type!: CatalogType;
}
