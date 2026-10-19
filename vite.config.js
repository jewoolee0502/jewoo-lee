import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // three r128 (D1) ships alone in the lazy createScene chunk (~530 kB, ~137 kB gzip).
  build: { chunkSizeWarningLimit: 600 },
  // One pre-bundled copy of three for both entry points in dev.
  optimizeDeps: { include: ['three', 'three/examples/jsm/renderers/CSS3DRenderer.js'] },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: [
      'src/**/*.test.{js,jsx}',
      'supabase/**/*.test.js',
      'scripts/**/*.test.mjs',
    ],
    css: false,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
})
