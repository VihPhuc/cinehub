import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.resetModules();
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('api search dedup', () => {
  it('không hủy request dùng chung khi một caller abort', async () => {
    let release!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });

    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal;
      return new Promise<Response>((resolve, reject) => {
        signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
        pending.then(resolve);
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { searchMovies } = await import('./api');
    const userAbort = new AbortController();
    const userRequest = searchMovies('dune', 1, userAbort.signal);
    const otherRequest = searchMovies('dune', 1, new AbortController().signal);

    userAbort.abort();
    release(
      jsonResponse({
        data: {
          items: [{ slug: 'dune', name: 'Dune' }],
          params: { pagination: { totalPages: 1 } },
        },
      })
    );

    await expect(userRequest).resolves.toEqual({ items: [], totalPages: 1 });
    await expect(otherRequest).resolves.toEqual({
      items: [{ slug: 'dune', name: 'Dune' }],
      totalPages: 1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('api catalog abort', () => {
  it('trả rỗng ngay khi caller hủy, không treo loading', async () => {
    let release!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const fetchMock = vi.fn(() => pending);
    vi.stubGlobal('fetch', fetchMock);

    const { getCatalogMovies } = await import('./api');
    const controller = new AbortController();
    const request = getCatalogMovies('phim-le', 1, controller.signal);

    controller.abort();

    await expect(request).resolves.toEqual({ items: [], title: '', totalPages: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    release(
      jsonResponse({
        data: { items: [{ slug: 'dune', name: 'Dune' }], params: { pagination: { totalPages: 1 } } },
      })
    );
  });
});

describe('api cache freshness', () => {
  const listUrl = 'https://phimapi.com/danh-sach/phim-moi-cap-nhat?page=1';
  const listCacheKey = `cinehub_api_${listUrl}`;

  it('does not serve expired cache when network fails', async () => {
    sessionStorage.setItem(
      listCacheKey,
      JSON.stringify({
        data: {
          items: [{ slug: 'stale-movie', name: 'Stale Movie' }],
          pagination: { totalPages: 3 },
        },
        expiry: Date.now() - 1000,
      })
    );
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { getNewUpdatedMovies } = await import('./api');

    await expect(getNewUpdatedMovies(1)).resolves.toEqual({ items: [], totalPages: 1 });
  });

  it('clearApiCache removes only api cache keys', async () => {
    sessionStorage.setItem(`cinehub_api_${listUrl}`, '{}');
    sessionStorage.setItem('cinehub_api_https://phimapi.com/phim/one', '{}');
    sessionStorage.setItem('unrelated_key', 'keep-me');

    const api = await import('./api');
    api.clearApiCache();

    expect(sessionStorage.getItem(`cinehub_api_${listUrl}`)).toBeNull();
    expect(sessionStorage.getItem('cinehub_api_https://phimapi.com/phim/one')).toBeNull();
    expect(sessionStorage.getItem('unrelated_key')).toBe('keep-me');
  });
});

describe('api TMDB embed', () => {  it('dùng đúng season 2 cho phim bộ', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          status: true,
          movie: {
            slug: 'khach-san',
            name: 'Khách Sạn Sát Thủ',
            type: 'series',
            tmdb: { id: 123, type: 'tv', season: 2 },
          },
          episodes: [],
        })
      )
    );

    const { getMovieDetail } = await import('./api');
    const detail = await getMovieDetail('khach-san');
    const intl = detail?.episodes?.find((server) => server.server_name.includes('VidSrc'));

    expect(intl?.server_data[0].link_embed).toBe('https://vidsrc.to/embed/tv/123/2/1');
  });

  it('dùng tmdb.type=movie cho hoạt hình điện ảnh', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          status: true,
          movie: {
            slug: 'anime-movie',
            name: 'Anime Movie',
            type: 'hoathinh',
            tmdb: { id: 456, type: 'movie' },
          },
          episodes: [],
        })
      )
    );

    const { getMovieDetail } = await import('./api');
    const detail = await getMovieDetail('anime-movie');
    const intl = detail?.episodes?.find((server) => server.server_name.includes('VidSrc'));

    expect(intl?.server_data[0].link_embed).toBe('https://vidsrc.to/embed/movie/456');
  });

  it('không chèn server VidSrc khi thiếu tmdb id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          status: true,
          movie: { slug: 'no-tmdb', name: 'No TMDB', type: 'series' },
          episodes: [],
        })
      )
    );

    const { getMovieDetail } = await import('./api');
    const detail = await getMovieDetail('no-tmdb');

    expect(detail?.episodes).toEqual([]);
  });
});

describe('formatMovieTitle', () => {
  it('loại bỏ tên phụ sau dấu gạch chéo và giữ lại chỉ định mùa nếu tên chính chưa có', async () => {
    const { formatMovieTitle } = await import('./api');

    expect(
      formatMovieTitle('Từng Bước Bên Nhau / Tiến Sĩ Yêu Đương (Phần 1)')
    ).toBe('Từng Bước Bên Nhau (Phần 1)');

    expect(
      formatMovieTitle('Tình Yêu Trong Vỏ Bọc / Tình Yêu Ngụy Trang')
    ).toBe('Tình Yêu Trong Vỏ Bọc');

    expect(
      formatMovieTitle('Ao Ashi: Tân Binh Sân Cỏ / Thiên Tài Bóng Đá Ashito (Phần 2)')
    ).toBe('Ao Ashi: Tân Binh Sân Cỏ (Phần 2)');

    expect(
      formatMovieTitle('Yêu Nhầm Cảnh Sát / Thanh Tra Theer Yêu Dấu / Vợ Sắp Cưới Của Thanh Tra')
    ).toBe('Yêu Nhầm Cảnh Sát');

    expect(
      formatMovieTitle('Khách Sạn Sát Thủ (Phần 2) / Hotel Continental')
    ).toBe('Khách Sạn Sát Thủ (Phần 2)');

    expect(formatMovieTitle('Vạn Giới Độc Tôn')).toBe('Vạn Giới Độc Tôn');

    // Không ảnh hưởng tới tên chứa dấu slash nội bộ không khoảng trắng
    expect(formatMovieTitle('V/H/S/Mixtape')).toBe('V/H/S/Mixtape');
  });
});

describe('api baseUrl configuration and fallback', () => {
  it('uses VITE_API_BASE_URL when defined and strips trailing slashes', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3001/api/compat///');
    const { getBaseUrl } = await import('./api');
    expect(getBaseUrl()).toBe('http://localhost:3001/api/compat');
  });

  it('falls back to https://phimapi.com when env var is absent or empty', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const { getBaseUrl } = await import('./api');
    expect(getBaseUrl()).toBe('https://phimapi.com');
  });
});

describe('api 6 compat endpoints routes and encoding', () => {
  it('dispatches getNewUpdatedMovies to compat path', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3001/api/compat');
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        status: true,
        items: [{ slug: 'new-movie', name: 'Phim Mới' }],
        pagination: { totalPages: 5 },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { getNewUpdatedMovies } = await import('./api');
    const res = await getNewUpdatedMovies(2);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/compat/danh-sach/phim-moi-cap-nhat?page=2',
      expect.any(Object)
    );
    expect(res.items[0].slug).toBe('new-movie');
  });

  it('dispatches getCatalogMovies to /v1/api/danh-sach/:type', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3001/api/compat');
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        status: true,
        data: {
          titlePage: 'Phim Bộ',
          items: [{ slug: 'series-1', name: 'Series 1' }],
          params: { pagination: { totalPages: 10 } },
        },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { getCatalogMovies } = await import('./api');
    const res = await getCatalogMovies('phim-bo', 3);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/compat/v1/api/danh-sach/phim-bo?page=3',
      expect.any(Object)
    );
    expect(res.title).toBe('Phim Bộ');
  });

  it('dispatches getGenreMovies to /v1/api/the-loai/:slug with encoded slug', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3001/api/compat');
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        status: true,
        data: {
          titlePage: 'Hành Động',
          items: [{ slug: 'action-1', name: 'Action 1' }],
          params: { pagination: { totalPages: 4 } },
        },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { getGenreMovies } = await import('./api');
    await getGenreMovies('hanh-dong', 1);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/compat/v1/api/the-loai/hanh-dong?page=1',
      expect.any(Object)
    );
  });

  it('dispatches getCountryMovies to /v1/api/quoc-gia/:slug with encoded slug', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3001/api/compat');
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        status: true,
        data: {
          titlePage: 'Hàn Quốc',
          items: [{ slug: 'korea-1', name: 'Korea 1' }],
          params: { pagination: { totalPages: 8 } },
        },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { getCountryMovies } = await import('./api');
    await getCountryMovies('han-quoc', 2);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/compat/v1/api/quoc-gia/han-quoc?page=2',
      expect.any(Object)
    );
  });

  it('dispatches searchMovies with keyword param and encoded query', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3001/api/compat');
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        status: true,
        data: {
          items: [{ slug: 'avatar-2', name: 'Avatar: Dòng Chảy' }],
          params: { pagination: { totalPages: 1 } },
        },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { searchMovies } = await import('./api');
    await searchMovies('avatar 2', 1);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/compat/v1/api/tim-kiem?keyword=avatar%202&page=1',
      expect.any(Object)
    );
  });

  it('dispatches getMovieDetail to /phim/:slug with encoded slug', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3001/api/compat');
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        status: true,
        movie: { slug: 'avatar-2', name: 'Avatar 2', type: 'single' },
        episodes: [],
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { getMovieDetail } = await import('./api');
    const detail = await getMovieDetail('avatar-2');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/compat/phim/avatar-2',
      expect.any(Object)
    );
    expect(detail?.slug).toBe('avatar-2');
  });
});

describe('api error resiliency and safe fallbacks', () => {
  it('returns safe empty state on 400 Bad Request error without crashing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'Invalid page', path: '/api/v1/movies' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );

    const { getCatalogMovies } = await import('./api');
    const res = await getCatalogMovies('phim-le', 9999);

    expect(res).toEqual({ items: [], title: '', totalPages: 1 });
    expect(sessionStorage.length).toBe(0);
  });

  it('returns null on 404 Not Found without caching or crashing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ statusCode: 404, error: 'Not Found', message: 'Movie not found', path: '/phim/non-existent' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );

    const { getMovieDetail } = await import('./api');
    const detail = await getMovieDetail('non-existent');

    expect(detail).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it('handles 502/503/504 upstream errors gracefully without throwing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const status of [502, 503, 504]) {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({ statusCode: status, error: 'Upstream Error', message: 'Failure', path: '/api/v1/movies' }),
            { status, headers: { 'Content-Type': 'application/json' } }
          )
        )
      );

      const { getNewUpdatedMovies } = await import('./api');
      const res = await getNewUpdatedMovies(1);

      expect(res).toEqual({ items: [], totalPages: 1 });
      expect(sessionStorage.length).toBe(0);
    }
  });

  it('does not cache 200 responses with status: false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ status: false, msg: 'Phim không tồn tại' })
      )
    );

    const { getMovieDetail } = await import('./api');
    const detail = await getMovieDetail('invalid-slug');

    expect(detail).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
});

