import type { ConfigService } from '@nestjs/config';

const TTL_KEYS = {
  list: 'cache.ttlListMs',
  new: 'cache.ttlNewMs',
  search: 'cache.ttlSearchMs',
  detail: 'cache.ttlDetailMs',
} as const;

export type TtlKind = keyof typeof TTL_KEYS;

export function ttlFor(config: ConfigService, kind: TtlKind): number {
  return config.getOrThrow<number>(TTL_KEYS[kind]);
}
