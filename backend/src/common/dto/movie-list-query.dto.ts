import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { SLUG_PATTERN } from './slug-param.dto';
import { SortablePageQueryDto } from './sortable-page-query.dto';

export class MovieListQueryDto extends SortablePageQueryDto {
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
}
