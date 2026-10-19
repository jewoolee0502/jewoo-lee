import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
