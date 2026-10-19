// Phase 8 TEST LIST: scripts/prerender.test.mjs (injectResume, pure, on a fixture template).
import { describe, it, expect } from 'vitest'
import { injectResume } from './prerender-lib.mjs'

const TEMPLATE =
  '<!doctype html><html><head><title>Jewoo</title></head><body><div id="app"></div>' +
  '<div id="resume-root"><!--resume-outlet--></div><script type="module" src="/assets/index.js"></script></body></html>'
const MARKUP = '<main id="resume"><h1>Jewoo (Jay) Lee</h1><p>Wholesale Express</p></main>'
const LD = { '@context': 'https://schema.org', '@type': 'Person', name: 'Jewoo (Jay) Lee' }

function ldBlock(out) {
  const m = out.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
  return m ? m[1] : null
}

describe('scripts/prerender injectResume', () => {
  it('replaces the outlet exactly once with the résumé markup', () => {
    const out = injectResume(TEMPLATE, MARKUP, LD)
    expect(out.split(MARKUP)).toHaveLength(2)
    expect(out).not.toContain('<!--resume-outlet-->')
    expect(out).toContain('<div id="resume-root"><main id="resume">')
  })

  it('inserts the JSON-LD script before </head> and it parses back to the input', () => {
    const out = injectResume(TEMPLATE, MARKUP, LD)
    const block = ldBlock(out)
    expect(block).not.toBeNull()
    expect(out.indexOf('<script type="application/ld+json">')).toBeLessThan(out.indexOf('</head>'))
    expect(JSON.parse(block)).toEqual(LD)
  })

  it('throws when the outlet is missing', () => {
    expect(() => injectResume('<!doctype html><html><head></head><body></body></html>', MARKUP, LD)).toThrow()
  })

  it('escapes "</script>" sequences inside the JSON-LD so the block cannot be broken out of', () => {
    const evil = { ...LD, name: '</script><script>alert(1)</script>' }
    const out = injectResume(TEMPLATE, MARKUP, evil)
    expect(out).not.toContain('</script><script>alert(1)')
    const block = ldBlock(out)
    expect(block).not.toBeNull()
    expect(block).not.toContain('</script')
    expect(JSON.parse(block).name).toBe(evil.name)
  })
})
