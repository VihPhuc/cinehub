import { Matches } from 'class-validator';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class SlugParamDto {
  @Matches(SLUG_PATTERN)
  slug!: string;
}
