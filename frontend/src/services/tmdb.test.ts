import { describe, expect, it } from 'vitest';
import { buildTmdbEmbedUrl } from './tmdb';

describe('buildTmdbEmbedUrl', () => {
  it('dùng tmdb.type và tmdb.season cho phim bộ', () => {
    expect(buildTmdbEmbedUrl({ id: 123, type: 'tv', season: 2 }, 'series', 5)).toBe(
      'https://vidsrc.to/embed/tv/123/2/5'
    );
  });

  it('ưu tiên tmdb.type=movie cho hoạt hình điện ảnh', () => {
    expect(buildTmdbEmbedUrl({ id: 456, type: 'movie' }, 'hoathinh')).toBe(
      'https://vidsrc.to/embed/movie/456'
    );
  });

  it('fallback theo movie.type khi thiếu tmdb.type', () => {
    expect(buildTmdbEmbedUrl({ id: '789' }, 'series', 3)).toBe(
      'https://vidsrc.to/embed/tv/789/1/3'
    );
    expect(buildTmdbEmbedUrl({ id: '789' }, 'phim-le')).toBe(
      'https://vidsrc.to/embed/movie/789'
    );
  });

  it('mặc định season/tập = 1 và trả null khi thiếu id', () => {
    expect(buildTmdbEmbedUrl({ id: 1, type: 'tv' }, 'series')).toBe(
      'https://vidsrc.to/embed/tv/1/1/1'
    );
    expect(buildTmdbEmbedUrl({}, 'movie')).toBeNull();
    expect(buildTmdbEmbedUrl(undefined, 'series')).toBeNull();
  });
});
