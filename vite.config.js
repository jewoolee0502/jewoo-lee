import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolveSiteUrl } from './src/content/site.js'

/** Fills %SITE_URL% in index.html (canonical, og:url) from VITE_SITE_URL or the default. */
function siteUrlPlugin(siteUrl) {
  return {
    name: 'jewoo:site-url',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.replaceAll('%SITE_URL%', siteUrl),
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // process.env wins over .env files, so VITE_SITE_URL=… npm run build works too.
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [react(), siteUrlPlugin(resolveSiteUrl(env.VITE_SITE_URL))],
    // three r128 (D1) ships alone in the lazy createScene chunk (~530 kB, ~137 kB gzip).
    build: { chunkSizeWarningLimit: 600 },
    // One pre-bundled copy of three for both entry points in dev.
    optimizeDeps: { include: ['three', 'three/examples/jsm/renderers/CSS3DRenderer.js'] },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.js'],
      include: [
        'src/**/*.test.{js,jsx}',
        'scripts/**/*.test.mjs',
      ],
      css: false,
      restoreMocks: true,
      unstubEnvs: true,
      unstubGlobals: true,
    },
  }
})
