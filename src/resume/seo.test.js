// @vitest-environment node
// Phase 8 TEST LIST: SEO head tags. The real index.html goes through Vite's transformIndexHtml,
// so the VITE_SITE_URL substitution is tested the way the build applies it.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { JSDOM } from 'jsdom'
import { buildPersonJsonLd } from './jsonld.js'
import { PROFILE } from '../content/index.js'

const root = process.cwd()
const RAW = readFileSync(resolve(root, 'index.html'), 'utf8')
const DEFAULT_SITE = 'https://jewoo-lee.vercel.app/'

async function headDocument(siteUrl) {
  const prev = process.env.VITE_SITE_URL
  if (siteUrl === undefined) delete process.env.VITE_SITE_URL
  else process.env.VITE_SITE_URL = siteUrl
  const server = await createServer({
    root,
    configFile: resolve(root, 'vite.config.js'),
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true, hmr: false, watch: null },
  })
  try {
    const html = await server.transformIndexHtml('/', RAW)
    return new JSDOM(html).window.document
  } finally {
    await server.close()
    if (prev === undefined) delete process.env.VITE_SITE_URL
    else process.env.VITE_SITE_URL = prev
  }
}

const meta = (doc, sel) => doc.querySelector(sel)?.getAttribute('content')
const norm = (u) => new URL(u).href

describe('SEO head (index.html through Vite)', () => {
  it('title, description, theme-color and html lang are set', async () => {
    const doc = await headDocument(undefined)
    expect(doc.title).toBe('Jewoo (Jay) Lee · Full-stack developer')
    expect(meta(doc, 'meta[name="description"]')).toBe(
      'Jewoo (Jay) Lee is a full-stack developer from McGill Computer Engineering in Montréal. Step into JAY-OS, a 3D 90s laptop portfolio, or read the résumé.',
    )
    expect(meta(doc, 'meta[name="theme-color"]')).toBe('#141C2E')
    expect(doc.documentElement.getAttribute('lang')).toBe('en')
  })

  it('og:title, og:description, og:type=website and twitter:card=summary are set', async () => {
    const doc = await headDocument(undefined)
    expect(meta(doc, 'meta[property="og:title"]')).toBeTruthy()
    expect(meta(doc, 'meta[property="og:description"]')).toBeTruthy()
    expect(meta(doc, 'meta[property="og:type"]')).toBe('website')
    expect(meta(doc, 'meta[name="twitter:card"]')).toBe('summary')
  })

  it('canonical and og:url default to https://jewoo-lee.vercel.app when VITE_SITE_URL is unset', async () => {
    const doc = await headDocument(undefined)
    const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href')
    expect(canonical).toBeTruthy()
    expect(norm(canonical)).toBe(DEFAULT_SITE)
    expect(norm(meta(doc, 'meta[property="og:url"]'))).toBe(DEFAULT_SITE)
  })

  it('canonical and og:url use VITE_SITE_URL when it is set', async () => {
    const doc = await headDocument('https://example.test')
    const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href')
    expect(norm(canonical)).toBe('https://example.test/')
    expect(norm(meta(doc, 'meta[property="og:url"]'))).toBe('https://example.test/')
  })

  it('favicon is /images/favicon.svg and the Google Fonts stylesheet is kept', async () => {
    const doc = await headDocument(undefined)
    expect(doc.querySelector('link[rel="icon"]')?.getAttribute('href')).toBe('/images/favicon.svg')
    expect(doc.querySelector('link[href*="fonts.googleapis.com/css2"]')).not.toBeNull()
  })

  it('no-JS: a <noscript> block neutralises the #app:empty track height token reservation so the résumé shows at once', () => {
    const blocks = [...RAW.matchAll(/<noscript>([\s\S]*?)<\/noscript>/g)].map((m) => m[1])
    expect(blocks.length).toBeGreaterThan(0)
    const rule = blocks
      .join('\n')
      .match(/#app:empty\s*\{([^}]*)\}/)
    expect(rule, '#app:empty rule inside <noscript>').not.toBeNull()
    expect(rule[1]).toMatch(/height\s*:\s*0|display\s*:\s*none/)
  })

  // Gap A (headless UX pass): Vite injects the bundled resume.css link after the head's <noscript>, so the
  // noscript rule must out-specify resume.css's `#app:empty` (same specificity would lose on source order).
  it('no-JS: the noscript #app:empty rule out-specifies resume.css #app:empty, so the bundled track height cannot win', () => {
    // Simple count: ids, then classes/attributes/pseudo-classes, then type selectors.
    const specificity = (sel) => [
      (sel.match(/#[\w-]+/g) ?? []).length,
      (sel.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) ?? []).length,
      (sel.match(/(^|[\s>+~])[a-zA-Z][\w-]*/g) ?? []).length,
    ]
    const greater = (a, b) => {
      for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]
      return false
    }
    const noscript = [...RAW.matchAll(/<noscript>([\s\S]*?)<\/noscript>/g)].map((m) => m[1]).join('\n')
    const noscriptRule = noscript.match(/<style>\s*([^{}]*#app:empty)\s*\{([^}]*)\}/)
    expect(noscriptRule, 'noscript #app:empty selector').not.toBeNull()
    const resumeCss = readFileSync(resolve(root, 'src/styles/resume.css'), 'utf8')
    const bundled = resumeCss.match(/(#app:empty)\s*\{([^}]*height[^}]*)\}/)
    expect(bundled, 'resume.css #app:empty rule').not.toBeNull()
    expect(bundled[2]).toMatch(/height:\s*var\(--track-h\)/)
    expect(greater(specificity(noscriptRule[1].trim()), specificity(bundled[1].trim())), `${noscriptRule[1].trim()} vs ${bundled[1].trim()}`).toBe(true)
    expect(noscriptRule[2]).toMatch(/height\s*:\s*0\b/)
  })

  // Round 3 Phase R3-2 (plan-r3 V10): the first-paint script is classic and inline, so Vite leaves it verbatim.
  it('the transformed head keeps the inline view script verbatim', async () => {
    const raw = RAW.match(/<script>[\s\S]*?<\/script>/)[0]
    const doc = await headDocument(undefined)
    const scripts = [...doc.querySelectorAll('script:not([src]):not([type])')]
    expect(scripts.map((s) => s.outerHTML)).toContain(raw)
  })

  it('URL consistency: buildPersonJsonLd(PROFILE).url equals the canonical href in the built index', async () => {
    const doc = await headDocument(undefined)
    const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href')
    expect(buildPersonJsonLd(PROFILE).url).toBe(canonical)
  })
})
