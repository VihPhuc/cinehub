import { MemoryCacheService } from './memory-cache.service';

describe('MemoryCacheService', () => {
  it('returns a hit for a fresh entry', async () => {
    const cache = new MemoryCacheService(10);
    const loader = jest.fn(async () => ({ value: 1 }));

    const first = await cache.getOrLoad('key', 1000, loader);
    const second = await cache.getOrLoad('key', 1000, loader);

    expect(first).toEqual({ value: { value: 1 }, cache: 'MISS' });
    expect(second).toEqual({ value: { value: 1 }, cache: 'HIT' });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('expires entries after their TTL', async () => {
    const cache = new MemoryCacheService(10);
    const first = await cache.getOrLoad('key', 10, async () => 'old');
    expect(first.value).toBe('old');

    await new Promise((resolve) => setTimeout(resolve, 25));

    const second = await cache.getOrLoad('key', 10, async () => 'new');
    expect(second.value).toBe('new');
  });

  it('evicts the least recently used entry', async () => {
    const cache = new MemoryCacheService(2);
    await cache.getOrLoad('a', 1000, async () => 'a');
    await cache.getOrLoad('b', 1000, async () => 'b');
    await cache.getOrLoad('c', 1000, async () => 'c');

    const result = await cache.getOrLoad('a', 1000, async () => 'a-miss');
    expect(result.value).toBe('a-miss');
    expect(result.cache).toBe('MISS');
  });

  it('coalesces concurrent loads for the same key', async () => {
    const cache = new MemoryCacheService(10);
    const loader = jest.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return 'value';
    });

    const [a, b] = await Promise.all([
      cache.getOrLoad('key', 1000, loader),
      cache.getOrLoad('key', 1000, loader),
    ]);

    expect(a.value).toBe('value');
    expect(b.value).toBe('value');
    expect(loader).toHaveBeenCalledTimes(1);
    expect(cache.getStats().inFlight).toBe(0);
  });

  it('does not cache when shouldCache returns false', async () => {
    const cache = new MemoryCacheService(10);
    const loader = jest.fn(async () => ({ status: false }));

    await cache.getOrLoad('key', 1000, loader, () => false);
    await cache.getOrLoad('key', 1000, loader, () => false);

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('clear removes all cached entries', async () => {
    const cache = new MemoryCacheService(10);
    const loader = jest.fn(async () => 'value');
    await cache.getOrLoad('key', 1000, loader);
    cache.clear();
    await cache.getOrLoad('key', 1000, loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
