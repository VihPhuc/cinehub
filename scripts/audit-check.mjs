import fs from 'node:fs';

const files = [
  'frontend/src/app/App.tsx',
  'frontend/src/features/detail/MovieDetailModal.tsx',
  'frontend/src/features/player/VideoPlayer.tsx',
  'frontend/src/features/home/HeroBanner.tsx',
  'frontend/src/features/navigation/Navbar.tsx',
  'frontend/src/features/catalog/MovieGrid.tsx',
  'frontend/src/features/library/LibraryView.tsx',
  'frontend/src/features/catalog/MovieCard.tsx',
];

const pats = {
  D1_dialog: /role="dialog"|aria-modal/,
  E2_sandbox: /sandbox=/,
  D9_main: /<main/,
  D5_live: /aria-live|role="status"/,
  D4_aria: /aria-expanded|aria-controls|aria-label/,
  D2_rolebutton: /role="button"/,
  D7_lazy: /loading="lazy"/,
  C4_allow: /allowFullScreen|allow=/,
  A4_modalUrl: /onSelectSlug/,
};

for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  const hits = Object.entries(pats)
    .filter(([, re]) => re.test(s))
    .map(([k]) => k);
  console.log(f.split('/').pop().padEnd(24), hits.join(',') || '(none)');
}

// Backend / infra checks
const backend = {
  A2_race: ['frontend/src/app/App.tsx', /AbortController|requestKey|loadedKey/],
  B1_dedup: ['frontend/src/shared/api.ts', /inFlightRequests/],
  B2_tmdbSeason: ['frontend/src/shared/tmdb.ts', /season/],
  B3_importValidate: ['frontend/src/shared/storage.ts', /sanitize|validate/],
  B4_eviction: ['frontend/src/shared/api.ts', /MAX_MEMORY|trimMemory|evict/],
  B4_swExpiry: ['frontend/public/sw.js', /expiry|MAX_AGE|Date\.now/],
  C2_epUrl: ['frontend/src/app/App.tsx', /onEpChange|watchEpIdx/],
  C3_throttle: ['frontend/src/features/player/VideoPlayer.tsx', /lastSavedAt/],
  C8_native: ['frontend/src/features/player/VideoPlayer.tsx', /canPlayType/],
  E1_sanitize: ['frontend/src/features/detail/MovieDetailModal.tsx', /DOMPurify|sanitizedContent/],
  CSP: ['frontend/vite.config.ts', /Content-Security-Policy/],
};
console.log('--- backend ---');
for (const [k, [f, re]] of Object.entries(backend)) {
  const s = fs.readFileSync(f, 'utf8');
  console.log(k.padEnd(18), re.test(s) ? 'OK' : 'MISSING');
}
