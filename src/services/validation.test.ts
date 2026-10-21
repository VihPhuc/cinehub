import { describe, expect, it } from 'vitest';
import {
  normalizeFavorite,
  normalizeFavorites,
  normalizeHistoryItem,
  normalizeHistoryList,
  safeImageUrl,
} from './validation';

describe('validation dữ liệu người dùng', () => {
  it('loại bỏ favorite có name không phải string', () => {
    expect(normalizeFavorite({ slug: 'a', name: {} })).toBeNull();
    expect(normalizeFavorite({ slug: '', name: 'A' })).toBeNull();
    expect(normalizeFavorite(null)).toBeNull();
  });

  it('chuẩn hóa favorite hợp lệ và bỏ URL ảnh không an toàn', () => {
    const item = normalizeFavorite({
      slug: 'a',
      name: 'A',
      poster_url: 'javascript:alert(1)',
      thumb_url: 'https://phimimg.com/a.jpg',
      savedAt: 123,
    });

    expect(item).toMatchObject({ slug: 'a', name: 'A', savedAt: 123 });
    expect(item?.poster_url).toBeUndefined();
    expect(item?.thumb_url).toBe('https://phimimg.com/a.jpg');
  });

  it('chỉ chấp nhận ảnh https hoặc đường dẫn tương đối', () => {
    expect(safeImageUrl('https://phimimg.com/a.jpg')).toBe('https://phimimg.com/a.jpg');
    expect(safeImageUrl('/uploads/a.jpg')).toBe('/uploads/a.jpg');
    expect(safeImageUrl('//evil.example/a.jpg')).toBeUndefined();
    expect(safeImageUrl('http://phimimg.com/a.jpg')).toBeUndefined();
    expect(safeImageUrl('data:image/png;base64,abc')).toBeUndefined();
    expect(safeImageUrl('javascript:alert(1)')).toBeUndefined();
  });

  it('giới hạn 100 favorites và dedupe theo slug', () => {
    const list = Array.from({ length: 120 }, (_, i) => ({
      slug: `s${i}`,
      name: `Phim ${i}`,
    }));
    const normalized = normalizeFavorites([...list, { slug: 's0', name: 'Trùng' }]);

    expect(normalized).toHaveLength(100);
    expect(normalized[0].slug).toBe('s0');
    expect(normalized.filter((f) => f.slug === 's0')).toHaveLength(1);
  });

  it('history yêu cầu đủ trường tập phim và số hợp lệ', () => {
    expect(normalizeHistoryItem({ slug: 'a', name: 'A' })).toBeNull();

    const item = normalizeHistoryItem({
      slug: 'a',
      name: 'A',
      episodeSlug: 'tap-1',
      episodeName: 'Tập 1',
      serverName: 'VIP',
      currentTime: 30,
      duration: 120,
      updatedAt: 99,
    });

    expect(item).toMatchObject({
      slug: 'a',
      episodeSlug: 'tap-1',
      currentTime: 30,
      duration: 120,
    });
  });

  it('giới hạn 50 history và dedupe theo slug + tập', () => {
    const list = Array.from({ length: 60 }, (_, i) => ({
      slug: 'a',
      name: 'A',
      episodeSlug: `tap-${i}`,
      episodeName: `Tập ${i}`,
      serverName: 'VIP',
      currentTime: i,
      duration: 100,
      updatedAt: i,
    }));
    const normalized = normalizeHistoryList([
      ...list,
      { ...list[0], episodeName: 'Trùng' },
    ]);

    expect(normalized).toHaveLength(50);
    expect(normalized.filter((h) => h.episodeSlug === 'tap-0')).toHaveLength(1);
  });
});
