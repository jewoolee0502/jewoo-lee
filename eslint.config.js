import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

const LAZY_ONLY = 'lazy chunk only'

export default [
  { ignores: ['dist', 'dist-ssr', 'coverage', 'design'] },
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ['vite.config.js', 'eslint.config.js', 'scripts/**', 'supabase/**'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ['src/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'three', message: LAZY_ONLY },
            { name: '@supabase/supabase-js', message: LAZY_ONLY },
          ],
          patterns: [{ group: ['three/*'], message: LAZY_ONLY }],
        },
      ],
    },
  },
  {
    files: ['src/scene/createScene.js', 'src/wall/supabaseWallClient.js'],
    rules: { 'no-restricted-imports': 'off' },
  },
]
