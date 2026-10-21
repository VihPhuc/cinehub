import { IsIn } from 'class-validator';
import { CATALOG_TYPES, type CatalogType } from './catalog-query.dto';

export class TypeParamDto {
  @IsIn(CATALOG_TYPES)
  type!: CatalogType;
}
