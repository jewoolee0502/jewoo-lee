// Build step 3 (D12): put the server-rendered résumé and the Person JSON-LD into
// dist/index.html, then delete the temporary SSR bundle.
// Runs after `vite build` and `vite build --ssr src/resume/entry-server.jsx --outDir dist-ssr`.
import { readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { injectResume } from './prerender-lib.mjs'

const root = resolve(import.meta.dirname, '..')
const htmlPath = resolve(root, 'dist/index.html')
const ssrDir = resolve(root, 'dist-ssr')
const entry = resolve(ssrDir, 'entry-server.js')

if (!existsSync(entry)) throw new Error('prerender: ' + entry + ' is missing (run the SSR build first)')

const { renderResumeHtml, personJsonLd } = await import(pathToFileURL(entry).href)
const html = injectResume(readFileSync(htmlPath, 'utf8'), renderResumeHtml(), personJsonLd())
writeFileSync(htmlPath, html)
rmSync(ssrDir, { recursive: true, force: true })
console.log('prerender: résumé and JSON-LD written to dist/index.html')
