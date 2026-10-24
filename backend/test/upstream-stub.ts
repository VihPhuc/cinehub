import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export const movieFixture = {
  _id: 'movie-1',
  name: 'Phim Test',
  slug: 'phim-test',
  origin_name: 'Test Movie',
  thumb_url: 'https://images.test/thumb.jpg',
  poster_url: 'https://images.test/poster.jpg',
  year: 2026,
  time: '120 phút',
  episode_current: 'Full',
  quality: 'HD',
  lang: 'Vietsub',
  chieurap: false,
  tmdb: { id: 123, type: 'movie', season: null, vote_average: 7.5 },
  category: [{ name: 'Hành Động', slug: 'hanh-dong' }],
  country: [{ name: 'Việt Nam', slug: 'viet-nam' }],
  modified: { time: '2026-10-24T15:56:02.000Z' },
};

export const newUpdatedFixture = {
  status: true,
  msg: '',
  items: [movieFixture],
  pagination: {
    totalItems: 1,
    totalItemsPerPage: 24,
    currentPage: 1,
    totalPages: 1,
  },
};

export const catalogFixture = {
  status: true,
  msg: '',
  data: {
    titlePage: 'Phim Lẻ',
    items: [movieFixture],
    params: {
      pagination: {
        totalItems: 1,
        totalItemsPerPage: 24,
        currentPage: 1,
        totalPages: 1,
      },
    },
  },
};

export const detailFixture = {
  status: true,
  msg: '',
  movie: {
    ...movieFixture,
    content: '<p>Nội dung phim</p>',
    type: 'movie',
    status: 'completed',
    episode_total: 'Full',
    view: 42,
    actor: ['Diễn viên A'],
    director: ['Đạo diễn B'],
  },
  episodes: [
    {
      server_name: 'Vietsub',
      server_data: [
        {
          name: 'Full',
          slug: 'full',
          filename: 'phim-test.mp4',
          link_embed: 'https://embed.test/1',
          link_m3u8: 'https://stream.test/1.m3u8',
        },
      ],
    },
  ],
};

export type StubHandler = (request: IncomingMessage, response: ServerResponse) => void;

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

export const defaultStubHandler: StubHandler = (request, response) => {
  const path = (request.url ?? '').split('?')[0];
  if (request.method !== 'GET') return sendJson(response, 405, { error: 'method' });
  if (path === '/danh-sach/phim-moi-cap-nhat') return sendJson(response, 200, newUpdatedFixture);
  if (path === '/v1/api/danh-sach/phim-le') return sendJson(response, 200, catalogFixture);
  if (path === '/v1/api/the-loai/hanh-dong') return sendJson(response, 200, catalogFixture);
  if (path === '/v1/api/quoc-gia/viet-nam') return sendJson(response, 200, catalogFixture);
  if (path === '/v1/api/tim-kiem') return sendJson(response, 200, catalogFixture);
  if (path === '/phim/missing') return sendJson(response, 404, { status: false, msg: 'not found' });
  if (path.startsWith('/phim/')) return sendJson(response, 200, detailFixture);
  return sendJson(response, 404, { status: false, msg: 'not found' });
};

export interface UpstreamStub {
  baseUrl: string;
  requests: string[];
  close: () => Promise<void>;
}

export async function startUpstreamStub(
  handler: StubHandler = defaultStubHandler
): Promise<UpstreamStub> {
  const requests: string[] = [];
  const server = createServer((request, response) => {
    requests.push(request.url ?? '');
    handler(request, response);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
