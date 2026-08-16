import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  plugins: [react()],

  define: {
    // package.json is the single source of the version. The server reads the
    // same field at boot (server/version.mjs), so the About dialog and the API
    // can never disagree about which build this is.
    __APP_VERSION__: JSON.stringify(version),
  },

  build: {
    // Sourcemaps for a production build. They are not referenced by the bundle
    // unless devtools asks, so they cost a visitor nothing — and without them a
    // stack trace from a self-hosted instance is unreadable minified noise,
    // which is the only bug report this product ever gets.
    sourcemap: true,
    rollupOptions: {
      output: {
        // The app shipped as one 1.1MB chunk, so a visitor paid for the SCORM
        // exporter and the whole rich-text stack before the dashboard could
        // paint. These three are big, stable and independently cacheable: a
        // release that changes app code no longer invalidates them.
        //
        // Matched on module path rather than by package name. A package's entry
        // point and its actual implementation file are different modules —
        // naming "react-dom" moved only its two-line re-export and left the
        // 130kB build to be placed by Rollup's own heuristic, which put it in
        // whichever chunk happened to reach it first.
        manualChunks(id) {
          const path = id.replace(/\\/g, '/')
          if (!path.includes('/node_modules/')) return
          if (/\/node_modules\/(react|react-dom|scheduler|zustand)\//.test(path)) return 'vendor'
          if (/\/node_modules\/(@tiptap|prosemirror-|@popperjs|orderedmap|rope-sequence|w3c-keyname)/.test(path)) {
            return 'editor'
          }
          if (/\/node_modules\/(jszip|pako|setimmediate)/.test(path)) return 'export'
        },
      },
    },
  },

  server: {
    proxy: {
      // `npm run dev` alone is still a complete, local-only app — nothing here
      // has to be running. When `npm run dev:server` *is* up, this puts it on
      // the same origin as the dev server so cookies and the CSRF header
      // behave exactly as they do in production. With no server, the proxy
      // refuses the connection and the client falls back to local-only, which
      // is the same code path as the static deployment.
      '/api': { target: 'http://127.0.0.1:8080', changeOrigin: false },
    },
  },

  test: {
    // jsdom for everything: the review anchoring code parses block HTML with a
    // real DOM (`review/anchor.ts`, `review/blockText.ts`), and splitting the
    // suite by environment costs more in config than jsdom costs in startup.
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'server/**/*.test.mjs'],
  },
})
