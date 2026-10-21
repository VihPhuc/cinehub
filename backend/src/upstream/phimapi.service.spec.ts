import type { PhimApiClient } from './phimapi.client';
import { PhimApiService } from './phimapi.service';
import { MemoryCacheService } from '../cache/memory-cache.service';

function fakeClient(value: unknown): PhimApiClient {
  return {
    getJson: jest.fn().mockResolvedValue(value),
  } as unknown as PhimApiClient;
}

describe('PhimApiService', () => {
  it('shares one cache key across different query orderings', async () => {
    const client = fakeClient({ status: true, items: [] });
    const service = new PhimApiService(new MemoryCacheService(10), client);

    const first = await service.get('/v1/api/tim-kiem', { keyword: 'avatar', page: 1 }, 1000);
    const second = await service.get('/v1/api/tim-kiem', { page: 1, keyword: 'avatar' }, 1000);

    expect(first.cache).toBe('MISS');
    expect(second.cache).toBe('HIT');
    expect(client.getJson).toHaveBeenCalledTimes(1);
  });

  it('does not cache an upstream status:false envelope', async () => {
    const client = fakeClient({ status: false, msg: 'not found' });
    const service = new PhimApiService(new MemoryCacheService(10), client);

    await service.get('/phim/missing', {}, 1000);
    await service.get('/phim/missing', {}, 1000);

    expect(client.getJson).toHaveBeenCalledTimes(2);
  });

  it('does not cache a null payload', async () => {
    const client = fakeClient(null);
    const service = new PhimApiService(new MemoryCacheService(10), client);

    await service.get('/bad', {}, 1000);
    await service.get('/bad', {}, 1000);

    expect(client.getJson).toHaveBeenCalledTimes(2);
  });

  it('keeps status:true payloads cacheable', async () => {
    const client = fakeClient({ status: true, items: [{ slug: 'a' }] });
    const service = new PhimApiService(new MemoryCacheService(10), client);

    await service.get('/danh-sach/phim-moi-cap-nhat', { page: 1 }, 1000);
    const second = await service.get('/danh-sach/phim-moi-cap-nhat', { page: 1 }, 1000);

    expect(second.cache).toBe('HIT');
  });
});
