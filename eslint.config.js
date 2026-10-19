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
    files: ['vite.config.js', 'eslint.config.js', 'scripts/**'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // Tests run in Node (jsdom env) and import describe/it/expect/vi explicitly
    // even when `vi` is unused (phase 5 common rule).
    files: ['**/*.test.{js,jsx,mjs}', 'src/test/**'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^(?:[A-Z_]|vi$)' }],
    },
  },
  {
    files: ['src/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'three', message: LAZY_ONLY }],
          patterns: [{ group: ['three/*'], message: LAZY_ONLY }],
        },
      ],
    },
  },
  {
    files: ['src/scene/createScene.js'],
    rules: { 'no-restricted-imports': 'off' },
  },
]
