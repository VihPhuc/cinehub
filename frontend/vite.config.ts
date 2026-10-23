import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https: data:",
  "connect-src 'self' https: blob: http://localhost:3001 http://127.0.0.1:3001",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "frame-src https:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ')

// Production-only CSP: Vite's dev server injects an inline React Refresh preamble,
// so applying this meta tag in dev would break HMR.
function cspPlugin(): Plugin {
  return {
    name: 'cinehub-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return {
        html,
        tags: [
          {
            tag: 'meta',
            attrs: {
              'http-equiv': 'Content-Security-Policy',
              content: CONTENT_SECURITY_POLICY,
            },
            injectTo: 'head-prepend',
          },
        ],
      }
    },
  }
}

// Static hosts that support `_headers` / `_redirects` (Netlify, Cloudflare
// Pages) get the same CSP as the meta tag plus deployment-only protections.
// The files are generated so the CSP cannot drift from the build config.
function securityHeadersPlugin(): Plugin {
  return {
    name: 'cinehub-security-headers',
    apply: 'build',
    generateBundle() {
      const headers = [
        '/*',
        `  Content-Security-Policy: ${CONTENT_SECURITY_POLICY}; frame-ancestors 'none'`,
        '  X-Content-Type-Options: nosniff',
        '  X-Frame-Options: DENY',
        '  Referrer-Policy: strict-origin-when-cross-origin',
        '  Permissions-Policy: camera=(), microphone=(), geolocation=()',
        '  Strict-Transport-Security: max-age=31536000; includeSubDomains',
        '',
        '/assets/*',
        '  Cache-Control: public, max-age=31536000, immutable',
        '',
        '/sw.js',
        '  Cache-Control: no-cache',
        '',
        '/index.html',
        '  Cache-Control: no-cache',
        '',
      ].join('\n');

      this.emitFile({ type: 'asset', fileName: '_headers', source: headers });
      this.emitFile({
        type: 'asset',
        fileName: '_redirects',
        source: '/*    /index.html   200\n',
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), cspPlugin(), securityHeadersPlugin()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('hls.js')) return 'vendor-hls';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
          }
        },
      },
    },
  },
})

