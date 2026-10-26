import { IsIn, IsOptional } from 'class-validator';
import { PageQueryDto } from './page-query.dto';

export const MOVIE_SORTS = ['updated', 'year'] as const;
export type MovieSort = (typeof MOVIE_SORTS)[number];

export const MOVIE_ORDERS = ['desc', 'asc'] as const;
export type MovieOrder = (typeof MOVIE_ORDERS)[number];

export class SortablePageQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(MOVIE_SORTS)
  sort: MovieSort = 'updated';

  @IsOptional()
  @IsIn(MOVIE_ORDERS)
  order: MovieOrder = 'desc';
}
