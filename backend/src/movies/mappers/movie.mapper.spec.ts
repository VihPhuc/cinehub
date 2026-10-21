import { mapListResponse, mapMovieDetail, mapMovieSummary } from './movie.mapper';

describe('movie mapper', () => {
  it('maps the stable summary fields and drops unknown fields', () => {
    const result = mapMovieSummary({
      _id: 'id-1',
      name: 'Tên 1 / Tên 2',
      slug: 'ten-phim',
      origin_name: 'Original',
      year: 2026,
      time: '120 phút',
      episode_current: 'Full',
      quality: 'HD',
      lang: 'Vietsub',
      chieurap: false,
      tmdb: { id: 123, type: 'movie', season: null, vote_average: 7.5 },
      category: [{ id: '1', name: 'Hành Động', slug: 'hanh-dong' }],
      country: [{ name: 'Việt Nam', slug: 'viet-nam' }],
      modified: 'ignored',
    } as never);

    expect(result).toMatchObject({
      _id: 'id-1',
      name: 'Tên 1 / Tên 2',
      slug: 'ten-phim',
      year: 2026,
      tmdb: { id: 123, type: 'movie' },
      category: [{ name: 'Hành Động', slug: 'hanh-dong' }],
    });
    expect(result).not.toHaveProperty('modified');
  });

  it('maps new/list pagination and titles from both upstream shapes', () => {
    const newResult = mapListResponse({
      status: true,
      items: [{ name: 'A', slug: 'a' }],
      pagination: { currentPage: 1, totalPages: 2, totalItems: 30, totalItemsPerPage: 24 },
    });
    expect(newResult.items).toHaveLength(1);
    expect(newResult.pagination).toEqual({
      page: 1,
      totalPages: 2,
      totalItems: 30,
      totalItemsPerPage: 24,
    });

    const catalogResult = mapListResponse({
      status: true,
      data: {
        titlePage: 'Phim Lẻ',
        items: [{ name: 'B', slug: 'b' }],
        params: { pagination: { currentPage: 2, totalPages: 3, totalItems: 50, totalItemsPerPage: 24 } },
      },
    });
    expect(catalogResult.title).toBe('Phim Lẻ');
    expect(catalogResult.items[0].slug).toBe('b');
    expect(catalogResult.pagination.page).toBe(2);
  });

  it('maps detail episodes and drops unsafe or empty links', () => {
    const result = mapMovieDetail({
      status: true,
      movie: { name: 'Phim', slug: 'phim', content: '<p>ok</p>', type: 'series' },
      episodes: [
        {
          server_name: 'Vietsub',
          server_data: [
            { name: 'Tập 1', slug: 'tap-1', link_embed: 'https://e/1', link_m3u8: 'https://m/1' },
            { name: 'Bad', slug: 'bad', link_embed: 'javascript:alert(1)', link_m3u8: '' },
            { name: 'Empty', slug: 'empty' },
          ],
        },
      ],
    });

    expect(result?.name).toBe('Phim');
    expect(result?.content).toBe('<p>ok</p>');
    expect(result?.episodes).toEqual([
      {
        server_name: 'Vietsub',
        server_data: [
          { name: 'Tập 1', slug: 'tap-1', link_embed: 'https://e/1', link_m3u8: 'https://m/1' },
        ],
      },
    ]);
  });

  it('returns null for a failed or missing detail', () => {
    expect(mapMovieDetail({ status: false, movie: { name: 'A', slug: 'a' } })).toBeNull();
    expect(mapMovieDetail({ status: true })).toBeNull();
  });
});
