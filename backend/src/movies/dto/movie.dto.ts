import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MovieNamedDto {
  @ApiPropertyOptional()
  id?: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;
}

export class MovieTmdbDto {
  @ApiPropertyOptional({ oneOf: [{ type: 'string' }, { type: 'number' }], nullable: true })
  id?: string | number | null;

  @ApiPropertyOptional({ nullable: true })
  type?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  season?: number | null;

  @ApiPropertyOptional({ type: Number })
  vote_average?: number;

  @ApiPropertyOptional({ type: Number })
  vote_count?: number;
}

export class MovieSummaryDto {
  @ApiPropertyOptional()
  _id?: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional()
  origin_name?: string;

  @ApiPropertyOptional()
  thumb_url?: string;

  @ApiPropertyOptional()
  poster_url?: string;

  @ApiPropertyOptional({ type: Number })
  year?: number;

  @ApiPropertyOptional()
  time?: string;

  @ApiPropertyOptional()
  episode_current?: string;

  @ApiPropertyOptional()
  quality?: string;

  @ApiPropertyOptional()
  lang?: string;

  @ApiPropertyOptional()
  chieurap?: boolean;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    example: '2026-10-24T15:56:02.000Z',
    description: 'Thời điểm cập nhật nội dung gần nhất, dạng ISO 8601 UTC',
  })
  updatedAt?: string;

  @ApiPropertyOptional({ type: () => MovieTmdbDto })
  tmdb?: MovieTmdbDto;

  @ApiPropertyOptional({ type: () => MovieNamedDto, isArray: true })
  category?: MovieNamedDto[];

  @ApiPropertyOptional({ type: () => MovieNamedDto, isArray: true })
  country?: MovieNamedDto[];
}

export class EpisodeDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional()
  filename?: string;

  @ApiProperty()
  link_embed!: string;

  @ApiProperty()
  link_m3u8!: string;
}

export class EpisodeServerDto {
  @ApiProperty()
  server_name!: string;

  @ApiProperty({ type: () => EpisodeDto, isArray: true })
  server_data!: EpisodeDto[];
}

export class MovieDetailDto extends MovieSummaryDto {
  @ApiPropertyOptional()
  content?: string;

  @ApiPropertyOptional()
  type?: string;

  @ApiPropertyOptional()
  status?: string;

  @ApiPropertyOptional()
  trailer_url?: string;

  @ApiPropertyOptional({ oneOf: [{ type: 'string' }, { type: 'number' }] })
  episode_total?: string | number;

  @ApiPropertyOptional({ type: Number })
  view?: number;

  @ApiPropertyOptional({ type: String, isArray: true })
  actor?: string[];

  @ApiPropertyOptional({ type: String, isArray: true })
  director?: string[];

  @ApiPropertyOptional({ type: () => EpisodeServerDto, isArray: true })
  episodes?: EpisodeServerDto[];
}

export class PaginationDto {
  @ApiProperty({ type: Number })
  page!: number;

  @ApiProperty({ type: Number })
  totalPages!: number;

  @ApiProperty({ type: Number })
  totalItems!: number;

  @ApiProperty({ type: Number })
  totalItemsPerPage!: number;
}

export class MovieListDto {
  @ApiProperty({ type: () => MovieSummaryDto, isArray: true })
  items!: MovieSummaryDto[];

  @ApiPropertyOptional()
  title?: string;

  @ApiProperty({ type: () => PaginationDto })
  pagination!: PaginationDto;
}

export class MovieDetailResultDto {
  @ApiProperty({ type: () => MovieDetailDto })
  movie!: MovieDetailDto;
}
