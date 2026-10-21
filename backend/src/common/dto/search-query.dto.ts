import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { PageQueryDto } from './page-query.dto';

export class SearchQueryDto extends PageQueryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  q!: string;
}
