import { describe, it, expect, vi } from 'vitest'
import { PROJECTS, ROLES, SKILLS, CAT, PROFILE } from './index.js'

describe('PROJECTS', () => {
  it('has 9 projects: the prototype 8 in order, then Joblog', () => {
    expect(PROJECTS).toHaveLength(9)
    expect(PROJECTS.map((p) => p.title)).toEqual([
      'RecycleWise',
      'WhenAreYouFree',
      'Duonosaur',
      'MenuLens',
      'Martlet Nest',
      'adStar',
      'HTTP · Health and Toning Targeted Program',
      'Library Management System',
      'Joblog',
    ])
  })

  it('Joblog has the exact url, live link, tags and blurb', () => {
    const joblog = PROJECTS[8]
    expect(joblog).toMatchObject({
      title: 'Joblog',
      image: 'joblog',
      host: 'GitHub',
      url: 'https://github.com/jewoolee0502/Joblog',
      live: 'https://joblog-nine.vercel.app',
      tags: ['React', 'TypeScript', 'Express', 'Prisma', 'PostgreSQL/Supabase', 'Claude API', 'Chrome Extension'],
      blurb:
        'An AI-powered job-application tracker. Applications move through a Kanban pipeline, an LLM classifier reads Gmail or Outlook emails and moves each one to the right stage automatically, and a Chrome extension saves job postings in one click. Follow-up nudges and analytics keep the search moving.',
    })
  })

  it('only adStar and HTTP are marked draft', () => {
    const drafts = PROJECTS.filter((p) => p.draft === true).map((p) => p.title)
    expect(drafts).toEqual(['adStar', 'HTTP · Health and Toning Targeted Program'])
    expect(PROJECTS.filter((p) => p.draft !== true)).toHaveLength(7)
  })

  it('every project has title, image, host, url and a non-empty tags array', () => {
    for (const p of PROJECTS) {
      expect(p.title, p.title).toBeTruthy()
      expect(p.image, p.title).toBeTruthy()
      expect(p.host, p.title).toBeTruthy()
      expect(p.url, p.title).toBeTruthy()
      expect(Array.isArray(p.tags), p.title).toBe(true)
      expect(p.tags.length, p.title).toBeGreaterThan(0)
    }
  })
})

describe('ROLES', () => {
  it('has 7 roles, starting with Wholesale Express', () => {
    expect(ROLES).toHaveLength(7)
    expect(ROLES[0].company).toBe('Wholesale Express')
  })
})

describe('SKILLS', () => {
  it('has 16 skills', () => {
    expect(SKILLS).toHaveLength(16)
  })

  it('React, TypeScript and PostgreSQL list Joblog under usedIn', () => {
    for (const name of ['React', 'TypeScript', 'PostgreSQL']) {
      const skill = SKILLS.find((s) => s.name === name)
      expect(skill, name).toBeDefined()
      expect(skill.usedIn, name).toContain('Joblog')
    }
  })

  it('every skill cat is a key of CAT', () => {
    const keys = Object.keys(CAT)
    for (const s of SKILLS) {
      expect(keys, s.name).toContain(s.cat)
    }
  })
})

describe('PROFILE', () => {
  it('has the contact email', () => {
    expect(PROFILE.email).toBe('jewoo.lee@mail.mcgill.ca')
  })

  it('the recruiter bullet counts all projects', () => {
    // Bullet 3 is built from PROJECTS.length, so it reads 9 projects.
    expect(JSON.stringify(PROFILE)).toContain(
      '9 projects, including RecycleWise (McGill capstone), WhenAreYouFree and Duonosaur',
    )
  })
})
