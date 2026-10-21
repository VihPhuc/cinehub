import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CatalogQueryDto } from './catalog-query.dto';
import { KeywordQueryDto } from './keyword-query.dto';
import { PageQueryDto } from './page-query.dto';
import { SearchQueryDto } from './search-query.dto';
import { SlugParamDto } from './slug-param.dto';

async function errors<T extends object>(dto: new () => T, value: object): Promise<string[]> {
  const instance = plainToInstance(dto, value);
  const result = await validate(instance);
  return result.flatMap((item) => Object.keys(item.constraints ?? {}));
}

describe('query DTO validation', () => {
  it('defaults page to 1 and accepts 1..5000', async () => {
    expect(await errors(PageQueryDto, {})).toEqual([]);
    expect(await errors(PageQueryDto, { page: '2' })).toEqual([]);
    expect(await errors(PageQueryDto, { page: '0' })).not.toEqual([]);
    expect(await errors(PageQueryDto, { page: '5001' })).not.toEqual([]);
    expect(await errors(PageQueryDto, { page: 'abc' })).not.toEqual([]);
  });

  it('requires a known catalog type', async () => {
    expect(await errors(CatalogQueryDto, { type: 'phim-le' })).toEqual([]);
    expect(await errors(CatalogQueryDto, { type: 'unknown' })).not.toEqual([]);
  });

  it('trims search q and rejects empty or overlong values', async () => {
    const instance = plainToInstance(SearchQueryDto, { q: '  avatar  ' });
    expect(instance.q).toBe('avatar');
    expect(await errors(SearchQueryDto, { q: 'avatar' })).toEqual([]);
    expect(await errors(SearchQueryDto, { q: '   ' })).not.toEqual([]);
    expect(await errors(SearchQueryDto, { q: 'x'.repeat(101) })).not.toEqual([]);
  });

  it('requires keyword for compat search', async () => {
    expect(await errors(KeywordQueryDto, { keyword: 'avatar' })).toEqual([]);
    expect(await errors(KeywordQueryDto, {})).not.toEqual([]);
  });

  it('rejects unsafe slugs', async () => {
    expect(await errors(SlugParamDto, { slug: 'ten-phim-1' })).toEqual([]);
    expect(await errors(SlugParamDto, { slug: '../secret' })).not.toEqual([]);
    expect(await errors(SlugParamDto, { slug: 'Ten Phim' })).not.toEqual([]);
  });
});
