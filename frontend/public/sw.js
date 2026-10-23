// CineHub service worker: app shell + API + image runtime caching.
// Keep cache versions in sync with releases; old caches are removed on activate.
const SHELL_CACHE = 'cinehub-shell-v5';
const API_CACHE = 'cinehub-api-v3';
const IMAGE_CACHE = 'cinehub-images-v1';
const API_TTL_MS = 4 * 60 * 1000;
const MAX_API_ENTRIES = 120;
const MAX_IMAGE_ENTRIES = 80;
const MAX_STATIC_ENTRIES = 80;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.all(
        STATIC_ASSETS.map(async (url) => {
          try {
            await cache.add(url);
          } catch {
            // Optional asset (e.g. icon missing in an older deploy)
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (![SHELL_CACHE, API_CACHE, IMAGE_CACHE].includes(key)) {
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim();
    })()
  );
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((request) => cache.delete(request)));
}

function isApiRequest(url) {
  return (
    url.hostname === 'phimapi.com' ||
    url.hostname.endsWith('.phimapi.com') ||
    url.pathname.startsWith('/api/compat') ||
    url.pathname.startsWith('/api/v1')
  );
}

function isImageRequest(request, url) {
  return (
    request.destination === 'image' &&
    (url.hostname === 'phimimg.com' ||
      url.hostname.endsWith('.phimimg.com') ||
      url.hostname === 'images.unsplash.com')
  );
}

function isVideoRequest(request, url) {
  return (
    request.destination === 'video' ||
    url.hostname.includes('kkphim') ||
    url.pathname.endsWith('.m3u8') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.m4s') ||
    url.pathname.endsWith('.mp4')
  );
}

async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(SHELL_CACHE);
      // Cache the app shell once, not every SPA URL with its query string.
      await cache.put('/index.html', response.clone());
    }
    return response;
  } catch {
    return (
      (await caches.match(request)) ||
      (await caches.match('/index.html')) ||
      (await caches.match('/')) ||
      new Response('Offline', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    );
  }
}

async function handleApi(request) {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then(async (response) => {
      if (response && response.status === 200) {
        try {
          await cache.put(request, response.clone());
          await trimCache(API_CACHE, MAX_API_ENTRIES);
        } catch {
          // Quota or opaque response; keep serving the network response.
        }
      }
      return response;
    })
    .catch(() => null);

  if (cached && isFreshApiCache(cached)) {
    // Stale-while-revalidate: fresh cache is instant; the network refreshes it.
    network.catch(() => {});
    return cached;
  }

  const response = await network;
  if (response) return response;

  // Only fall back to an expired entry when the network is unavailable.
  if (cached) return cached;

  return new Response(JSON.stringify({ status: false, message: 'offline' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function isFreshApiCache(response) {
  const date = response.headers.get('date');
  const timestamp = date ? Date.parse(date) : NaN;
  return Number.isFinite(timestamp) && Date.now() - timestamp <= API_TTL_MS;
}

async function staleWhileRevalidate(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then(async (response) => {
      if (response && (response.ok || response.type === 'opaque')) {
        try {
          await cache.put(request, response.clone());
          await trimCache(cacheName, maxEntries);
        } catch {
          // Ignore cache write failures (quota, unsupported response).
        }
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    network.catch(() => {});
    return cached;
  }

  const response = await network;
  if (response) return response;

  if (request.destination === 'image') {
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="60" viewBox="0 0 40 60"><rect width="40" height="60" fill="#1a1a22"/><path d="M16 24l10 6-10 6z" fill="#52525b"/></svg>',
      { status: 200, headers: { 'Content-Type': 'image/svg+xml' } }
    );
  }

  return new Response('', { status: 504, statusText: 'Gateway Timeout' });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (isVideoRequest(request, url)) return;

  if (isApiRequest(url)) {
    event.respondWith(handleApi(request));
    return;
  }

  if (isImageRequest(request, url)) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE, MAX_IMAGE_ENTRIES));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE, MAX_STATIC_ENTRIES));
  }
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'CLEAR_API_CACHE') {
    event.waitUntil(caches.delete(API_CACHE));
  }
});
