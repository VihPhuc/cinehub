import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { PageQueryDto } from './page-query.dto';

export class KeywordQueryDto extends PageQueryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  keyword!: string;
}
