import { ApiProperty } from '@nestjs/swagger';
import { MovieListDto } from '../../movies/dto/movie.dto';

export class FacetCountDto {
  @ApiProperty({ type: Number })
  value!: number;

  @ApiProperty({ type: Number })
  count!: number;
}

export class FacetNamedDto {
  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: Number })
  count!: number;
}

export class FacetLanguageDto {
  @ApiProperty()
  value!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty({ type: Number })
  count!: number;
}

export class DiscoverFacetsDto {
  @ApiProperty({ type: () => FacetCountDto, isArray: true })
  years!: FacetCountDto[];

  @ApiProperty({ type: () => FacetNamedDto, isArray: true })
  categories!: FacetNamedDto[];

  @ApiProperty({ type: () => FacetNamedDto, isArray: true })
  countries!: FacetNamedDto[];

  @ApiProperty({ type: () => FacetLanguageDto, isArray: true })
  languages!: FacetLanguageDto[];

  @ApiProperty({ type: Number })
  totalItems!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  generatedAt!: string;
}

export class DiscoverResponseDto extends MovieListDto {
  @ApiProperty({ type: () => DiscoverFacetsDto })
  facets!: DiscoverFacetsDto;
}
