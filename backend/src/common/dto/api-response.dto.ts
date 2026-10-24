import { ApiProperty } from '@nestjs/swagger';

export class ApiErrorDto {
  @ApiProperty({ type: Number })
  statusCode!: number;

  @ApiProperty()
  error!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty()
  path!: string;
}

export class CacheStatsDto {
  @ApiProperty({ type: Number })
  size!: number;

  @ApiProperty({ type: Number })
  hits!: number;

  @ApiProperty({ type: Number })
  misses!: number;

  @ApiProperty({ type: Number })
  inFlight!: number;
}

export class HealthDto {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({ type: Number, description: 'Process uptime in seconds' })
  uptime!: number;

  @ApiProperty({ type: () => CacheStatsDto })
  cache!: CacheStatsDto;
}
