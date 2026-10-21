import fs from 'node:fs';

const files = [
  'src/App.tsx',
  'src/components/MovieDetailModal.tsx',
  'src/components/VideoPlayer.tsx',
  'src/components/HeroBanner.tsx',
  'src/components/Navbar.tsx',
  'src/components/MovieGrid.tsx',
  'src/components/LibraryView.tsx',
  'src/components/MovieCard.tsx',
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
  A2_race: ['src/App.tsx', /AbortController|requestKey|loadedKey/],
  B1_dedup: ['src/services/api.ts', /inFlightRequests/],
  B2_tmdbSeason: ['src/services/tmdb.ts', /season/],
  B3_importValidate: ['src/services/storage.ts', /sanitize|validate/],
  B4_eviction: ['src/services/api.ts', /MAX_MEMORY|trimMemory|evict/],
  B4_swExpiry: ['public/sw.js', /expiry|MAX_AGE|Date\.now/],
  C2_epUrl: ['src/App.tsx', /onEpChange|watchEpIdx/],
  C3_throttle: ['src/components/VideoPlayer.tsx', /lastSavedAt/],
  C8_native: ['src/components/VideoPlayer.tsx', /canPlayType/],
  E1_sanitize: ['src/components/MovieDetailModal.tsx', /DOMPurify|sanitizedContent/],
  CSP: ['vite.config.ts', /Content-Security-Policy/],
};
console.log('--- backend ---');
for (const [k, [f, re]] of Object.entries(backend)) {
  const s = fs.readFileSync(f, 'utf8');
  console.log(k.padEnd(18), re.test(s) ? 'OK' : 'MISSING');
}
