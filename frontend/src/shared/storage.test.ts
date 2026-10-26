import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

describe('importUserData', () => {
  it('từ chối backup có item sai schema và giữ nguyên dữ liệu cũ', async () => {
    localStorage.setItem(
      'cineflix_favorites',
      JSON.stringify([{ slug: 'old', name: 'Phim Cũ', savedAt: 1 }])
    );
    const { importUserData, getFavorites } = await import('./storage');

    const ok = importUserData(
      JSON.stringify({ favorites: [{ slug: 'bad', name: {} }] })
    );

    expect(ok).toBe(false);
    expect(getFavorites().map((f) => f.slug)).toEqual(['old']);
  });

  it('từ chối history thiếu thông tin tập phim', async () => {
    const { importUserData } = await import('./storage');

    const ok = importUserData(
      JSON.stringify({ history: [{ slug: 'a', name: 'A' }] })
    );

    expect(ok).toBe(false);
    expect(localStorage.getItem('cineflix_history')).toBeNull();
  });

  it('giới hạn 100 favorites và dedupe theo slug', async () => {
    const { importUserData, getFavorites } = await import('./storage');
    const favorites = Array.from({ length: 120 }, (_, i) => ({
      slug: `s${i}`,
      name: `Phim ${i}`,
      savedAt: i,
    }));

    const ok = importUserData(JSON.stringify({ favorites }));

    expect(ok).toBe(true);
    expect(getFavorites()).toHaveLength(100);
    expect(getFavorites()[0].slug).toBe('s0');
  });

  it('bỏ URL ảnh không an toàn khi import', async () => {
    const { importUserData, getFavorites } = await import('./storage');

    const ok = importUserData(
      JSON.stringify({
        favorites: [
          {
            slug: 'a',
            name: 'A',
            poster_url: 'javascript:alert(1)',
            thumb_url: 'https://phimimg.com/a.jpg',
          },
        ],
      })
    );

    expect(ok).toBe(true);
    expect(getFavorites()[0].poster_url).toBeUndefined();
    expect(getFavorites()[0].thumb_url).toBe('https://phimimg.com/a.jpg');
  });

  it('bỏ qua mảng không được cung cấp và báo false nếu không có gì hợp lệ', async () => {
    const { importUserData } = await import('./storage');

    expect(importUserData(JSON.stringify({}))).toBe(false);
    expect(importUserData('không phải json')).toBe(false);
  });
});

describe('getFavorites/getHistory với dữ liệu localStorage hỏng', () => {
  it('lọc item sai schema thay vì trả nguyên', async () => {
    localStorage.setItem(
      'cineflix_favorites',
      JSON.stringify([{ slug: 'ok', name: 'OK' }, { slug: 'bad', name: {} }])
    );
    localStorage.setItem(
      'cineflix_history',
      JSON.stringify([
        {
          slug: 'ok',
          name: 'OK',
          episodeSlug: 'tap-1',
          episodeName: 'Tập 1',
          serverName: 'VIP',
          currentTime: 10,
          duration: 100,
          updatedAt: 1,
        },
        { slug: 'bad', name: 'Bad' },
      ])
    );

    const { getFavorites, getHistory } = await import('./storage');

    expect(getFavorites().map((f) => f.slug)).toEqual(['ok']);
    expect(getHistory().map((h) => h.slug)).toEqual(['ok']);
  });
});

describe('Watched Episodes tracking', () => {
  it('lưu tiến trình và đánh dấu hoàn thành tập phim chính xác', async () => {
    const { getWatchedEpisodes, markEpisodeWatched, isEpisodeCompleted } = await import('./storage');

    expect(isEpisodeCompleted('naruto', 'tap-1')).toBe(false);

    markEpisodeWatched('naruto', 'tap-1', 45, false);
    expect(isEpisodeCompleted('naruto', 'tap-1')).toBe(false);
    expect(getWatchedEpisodes('naruto')['tap-1'].progress).toBe(45);

    markEpisodeWatched('naruto', 'tap-1', 90, false);
    expect(isEpisodeCompleted('naruto', 'tap-1')).toBe(true);

    markEpisodeWatched('naruto', 'tap-2', 10, true);
    expect(isEpisodeCompleted('naruto', 'tap-2')).toBe(true);
    expect(getWatchedEpisodes('naruto')['tap-2'].completed).toBe(true);
  });
});

describe('Custom Collections Management', () => {
  it('tạo, thêm/bớt phim và xóa bộ sưu tập chính xác', async () => {
    const {
      getCollections,
      createCollection,
      deleteCollection,
      toggleMovieInCollection,
      isMovieInCollection,
      getMovieCollections,
    } = await import('./storage');

    expect(getCollections()).toHaveLength(0);

    const col = createCollection('Phim Hay', 'Các phim tâm đắc');
    expect(col).not.toBeNull();
    expect(col?.name).toBe('Phim Hay');
    expect(col?.description).toBe('Các phim tâm đắc');
    expect(getCollections()).toHaveLength(1);

    const added = toggleMovieInCollection(col!.id, 'avatar-2');
    expect(added).toBe(true);
    expect(isMovieInCollection(col!.id, 'avatar-2')).toBe(true);
    expect(getMovieCollections('avatar-2')).toContain(col!.id);

    // Toggle again removes it
    const removed = toggleMovieInCollection(col!.id, 'avatar-2');
    expect(removed).toBe(false);
    expect(isMovieInCollection(col!.id, 'avatar-2')).toBe(false);

    // Delete collection
    const deleted = deleteCollection(col!.id);
    expect(deleted).toBe(true);
    expect(getCollections()).toHaveLength(0);
  });
});

describe('mergeUserData', () => {
  it('hợp nhất favorites, history và collections mà không ghi đè dữ liệu cũ', async () => {
    localStorage.setItem(
      'cineflix_favorites',
      JSON.stringify([{ slug: 'old-fav', name: 'Old Favorite', savedAt: 100 }])
    );
    const { getFavorites, getCollections, mergeUserData } = await import('./storage');

    const backupPayload = JSON.stringify({
      favorites: [{ slug: 'new-fav', name: 'New Favorite', savedAt: 200 }],
      collections: [
        {
          id: 'col-1',
          name: 'Bộ Phim Mới',
          createdAt: 300,
          slugs: ['dune-2'],
        },
      ],
    });

    const ok = mergeUserData(backupPayload);
    expect(ok).toBe(true);

    const favSlugs = getFavorites().map((f) => f.slug);
    expect(favSlugs).toContain('old-fav');
    expect(favSlugs).toContain('new-fav');

    const cols = getCollections();
    expect(cols).toHaveLength(1);
    expect(cols[0].name).toBe('Bộ Phim Mới');
  });
});
