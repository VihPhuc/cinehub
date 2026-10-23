import { readFileSync } from 'node:fs';

const html = readFileSync('frontend/dist/index.html', 'utf8');
if (html.includes('vendor-hls')) {
  console.error('Bundle guard failed: hls.js is preloaded in frontend/dist/index.html.');
  process.exit(1);
}

const entryScript = html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];
if (!entryScript) {
  console.error('Bundle guard failed: entry script not found in frontend/dist/index.html.');
  process.exit(1);
}

console.log(`Bundle guard passed: hls.js is deferred (entry: ${entryScript}).`);
