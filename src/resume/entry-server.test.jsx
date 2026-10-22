// @vitest-environment node
// Phase 8 TEST LIST: resume/entry-server (node environment, no window). The prerender runs here.
import { describe, it, expect } from 'vitest'
import { renderResumeHtml, createServerApp } from './entry-server.jsx'

describe('resume/entry-server (node, no DOM)', () => {
  it('runs without a window object', () => {
    expect(typeof window).toBe('undefined')
    expect(typeof document).toBe('undefined')
  })

  it('renderResumeHtml returns the full résumé markup as a string', () => {
    const html = renderResumeHtml()
    expect(typeof html).toBe('string')
    expect(html).toContain('<main id="resume"')
    expect(html).toContain('Wholesale Express')
    expect(html).toContain('Joblog')
    expect(html).toContain('href="mailto:jewoo.lee@mail.mcgill.ca"')
    expect(html).toContain('0/12')
  })

  it('prerendered project images carry srcset and sizes (phase 5)', () => {
    const html = renderResumeHtml()
    expect(html.match(/srcSet="|srcset="/g)).toHaveLength(9)
    expect(html).toMatch(/srcSet="\/img\/projects\/recyclewise-640\.webp 640w/)
  })

  // Round 3 Phase R3-2 (plan-r3 V13): the server render's nav has every call the résumé makes.
  it('createServerApp().nav has goToResume, openLaptop and backToLaptop as no-ops (R3-2)', () => {
    const { nav } = createServerApp()
    for (const name of ['goToResume', 'openLaptop', 'backToLaptop']) {
      expect(typeof nav[name], name).toBe('function')
    }
  })

  it('does not contain the outlet comment, a draft blurb or placeholder values', () => {
    const html = renderResumeHtml()
    expect(html).not.toContain('<!--resume-outlet-->')
    expect(html).not.toMatch(/draft blurb/i)
    expect(html).not.toMatch(/undefined|NaN|\[object Object\]/)
  })
})
