import { Matches } from 'class-validator';

export class SlugParamDto {
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;
}
