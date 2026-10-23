import { readFileSync } from 'node:fs';

function required(file, checks) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    console.error(`Deploy guard failed: missing ${file}. Run npm run build first.`);
    process.exit(1);
  }

  for (const check of checks) {
    if (!check.test(content)) {
      console.error(`Deploy guard failed: ${file} is missing ${check}.`);
      process.exit(1);
    }
  }
}

required('frontend/dist/_headers', [
  /Content-Security-Policy:/,
  /frame-ancestors 'none'/,
  /X-Content-Type-Options: nosniff/,
  /Strict-Transport-Security:/,
  /\/assets\/\*/,
  /Cache-Control: public, max-age=31536000, immutable/,
  /\/sw\.js/,
  /Cache-Control: no-cache/,
]);

required('frontend/dist/_redirects', [/\/\*\s+\/index\.html\s+200/]);

console.log('Deploy guard passed: security headers and SPA fallback are generated.');
