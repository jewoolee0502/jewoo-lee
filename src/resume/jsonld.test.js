// Phase 8 TEST LIST: resume/jsonld.test.js (buildPersonJsonLd) and the site URL default (D-override).
import { describe, it, expect, afterEach, vi } from 'vitest'
import { buildPersonJsonLd } from './jsonld.js'
import { PROFILE } from '../content/index.js'

describe('resume/jsonld buildPersonJsonLd', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns a schema.org Person with name, job title and alumni school', () => {
    const ld = buildPersonJsonLd(PROFILE)
    expect(ld['@context']).toBe('https://schema.org')
    expect(ld['@type']).toBe('Person')
    expect(ld.name).toBe('Jewoo (Jay) Lee')
    expect(ld.jobTitle).toBe('Full-stack developer')
    expect(ld.alumniOf).toEqual({ '@type': 'CollegeOrUniversity', name: 'McGill University' })
  })

  it('email is a mailto: URI for the McGill address', () => {
    const ld = buildPersonJsonLd(PROFILE)
    expect(ld.email).toMatch(/^mailto:/)
    expect(ld.email).toBe('mailto:jewoo.lee@mail.mcgill.ca')
  })

  it('sameAs lists exactly the GitHub, LinkedIn and Instagram URLs', () => {
    const ld = buildPersonJsonLd(PROFILE)
    expect(ld.sameAs).toHaveLength(3)
    expect(ld.sameAs).toEqual(
      expect.arrayContaining([
        'https://github.com/jewoolee0502',
        'https://www.linkedin.com/in/jewoo-lee/',
        'https://www.instagram.com/jwuu_lee/',
      ]),
    )
  })

  it('url is the site URL (VITE_SITE_URL, default https://jewoo-lee.vercel.app) and never jewoolee.dev', () => {
    const ld = buildPersonJsonLd(PROFILE)
    // Equals the canonical href (PROFILE.site plus the root slash), per review round 1.
    expect(ld.url).toBe(PROFILE.site + '/')
    expect(ld.url).not.toMatch(/jewoolee\.dev/)
  })

  it('JSON.stringify round-trips to the same object', () => {
    const ld = buildPersonJsonLd(PROFILE)
    expect(JSON.parse(JSON.stringify(ld))).toEqual(ld)
  })
})

describe('content/profile site URL', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults to https://jewoo-lee.vercel.app when VITE_SITE_URL is unset or empty', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_SITE_URL', '')
    const { PROFILE: p } = await import('../content/profile.js')
    expect(p.site).toBe('https://jewoo-lee.vercel.app')
  })

  it('uses VITE_SITE_URL when it is set', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_SITE_URL', 'https://example.test')
    const { PROFILE: p } = await import('../content/profile.js')
    expect(p.site).toBe('https://example.test')
  })
})
