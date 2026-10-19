// Content windows (plan Phase 4 TEST LIST, items 1–10). Apps open through os.openApp on a
// booted OS (JayOS rendered, boot fast-forwarded). Registry keys follow the prototype
// (exp, aboutos, ach, bin, service, resume, skills, projects, about, mail).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, screen, within } from '@testing-library/react'
import { renderWithApp } from '../../test/renderWithApp.jsx'
import { JayOS } from '../JayOS.jsx'
import { createSound } from '../../core/sound.js'
import Trophies from './Trophies.jsx'

// Renders the OS, boots it (2200 ms with the default motion setting) and returns the app.
function bootedApp(overrides = {}) {
  const result = renderWithApp(<JayOS />, overrides)
  act(() => {
    result.app.os.boot()
  })
  act(() => {
    vi.advanceTimersByTime(2200)
  })
  return result
}

function open(app, id) {
  act(() => {
    app.os.openApp(id)
  })
  return windowEl(id)
}

const windowEl = (id) => document.querySelector(`section.win[data-app="${id}"]`)

beforeEach(() => {
  vi.useFakeTimers()
})

describe('About', () => {
  it('shows the heading, the pixel portrait, availability and both clocks', () => {
    // 15:04 UTC is 11:04 in Montréal (EDT) and 00:04 in Seoul.
    vi.setSystemTime(new Date('2026-10-18T15:04:00Z'))
    const { app } = bootedApp()
    const w = open(app, 'about')
    expect(within(w).getByRole('heading', { name: "Hi, I'm Jewoo. Call me Jay." })).toBeInTheDocument()
    const img = w.querySelector('img.jay-px')
    expect(img.getAttribute('src')).toBe('/img/jay-px.png')
    expect(img.getAttribute('alt')).toBe('Pixel-art portrait of Jewoo Lee')
    expect(within(w).getByText('hi, it’s me')).toBeInTheDocument()
    expect(within(w).getByText('Available for work')).toBeInTheDocument()
    expect(w.querySelector('.clk-mtl').textContent).toBe('11:04')
    expect(w.querySelector('.clk-sel').textContent).toBe('00:04')
  })
})

describe('Projects and ProjectDetail', () => {
  it('lists 9 projects under the derived title, and Joblog opens p:8 with the right links', () => {
    const { app } = bootedApp()
    const sec = open(app, 'projects')
    expect(sec.querySelector('.tb-t').textContent).toBe('Projects  ·  9 items')
    expect(sec.querySelectorAll('button.pcard')).toHaveLength(9)

    fireEvent.click(within(sec).getByText('Joblog').closest('button'))
    const p8 = windowEl('p:8')
    expect(p8).not.toBeNull()
    expect(within(p8).getByRole('heading', { level: 2, name: 'Joblog' })).toBeInTheDocument()
    const links = [...p8.querySelectorAll('a')]
    expect(links.map((a) => a.textContent)).toEqual(['Live demo ↗', 'Open on GitHub ↗'])
    expect(links[0].getAttribute('href')).toBe('https://joblog-nine.vercel.app')
    expect(links[1].getAttribute('href')).toBe('https://github.com/jewoolee0502/Joblog')
    expect(within(p8).queryByText('Source on GitHub ↗')).toBeNull()
  })

  it('Duonosaur (p:2) shows live, url and repo links in that order', () => {
    const { app } = bootedApp()
    const w = open(app, 'p:2')
    const links = [...w.querySelectorAll('a')]
    expect(links.map((a) => a.textContent)).toEqual([
      'Live demo ↗',
      'Open on Devpost ↗',
      'Source on GitHub ↗',
    ])
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      'https://duonosaur.vercel.app',
      'https://devpost.com/software/duonosaur',
      'https://github.com/jewoolee0502/CodeJam15-Duonosaur',
    ])
  })

  it('adStar (p:5) and HTTP (p:6) show the draft blurb chip, RecycleWise (p:0) does not', () => {
    const { app } = bootedApp()
    expect(open(app, 'p:5').querySelector('.draft').textContent).toBe('draft blurb')
    expect(open(app, 'p:6').querySelector('.draft').textContent).toBe('draft blurb')
    expect(open(app, 'p:0').querySelector('.draft')).toBeNull()
  })

  it('every project link opens in a new tab with noopener', () => {
    const { app } = bootedApp()
    const w = open(app, 'p:2')
    for (const a of w.querySelectorAll('a')) {
      expect(a.getAttribute('target')).toBe('_blank')
      expect(a.getAttribute('rel')).toContain('noopener')
    }
  })
})

describe('Experience', () => {
  it('shows 7 entries with only the first open, and the first summary names the role', () => {
    const { app } = bootedApp()
    const w = open(app, 'exp')
    const details = [...w.querySelectorAll('details')]
    expect(details).toHaveLength(7)
    expect(details.map((d) => d.open)).toEqual([true, false, false, false, false, false, false])
    const summary = details[0].querySelector('summary').textContent
    expect(summary).toContain('2025-08 → 2025-12')
    expect(summary).toContain('Wholesale Express')
    expect(summary).toContain('Full-Stack Developer (Part-time)')
  })
})

describe('Skills', () => {
  it('shows 16 slots with two-letter badges, and clicking React fills in its details', () => {
    const snd = createSound()
    const tone = vi.spyOn(snd, 'tone')
    const { app } = bootedApp({ snd })
    const w = open(app, 'skills')
    const slots = [...w.querySelectorAll('.slot')]
    expect(slots).toHaveLength(16)
    expect(slots[0].querySelector('b').textContent).toBe('PY')
    expect(slots[5].querySelector('b').textContent).toBe('VU')

    const react = slots.find((s) => s.querySelector('span').textContent === 'React')
    fireEvent.click(react)
    expect(react.classList.contains('on')).toBe(true)
    expect(slots.filter((s) => s !== react).some((s) => s.classList.contains('on'))).toBe(false)
    expect(w.querySelector('.inv-d h3').textContent).toBe('React')
    expect(w.querySelector('.inv-d .rar').textContent).toBe('FRAMEWORK · Framework')
    expect([...w.querySelectorAll('.inv-d ul li')].map((li) => li.textContent)).toEqual([
      'RecycleWise',
      'HTTP',
      'this website',
      'Joblog',
    ])
    expect(tone).toHaveBeenCalledWith(740, 0.06, 'square', 0.03)
  })

  it('shows the fallback line for a skill with no projects (MongoDB)', () => {
    const { app } = bootedApp()
    const w = open(app, 'skills')
    const mongo = [...w.querySelectorAll('.slot')].find((s) => s.querySelector('span').textContent === 'MongoDB')
    fireEvent.click(mongo)
    expect([...w.querySelectorAll('.inv-d ul li')].map((li) => li.textContent)).toEqual([
      'Listed on the current site. A project that shows it off would help!',
    ])
  })
})

describe('ResumeApp', () => {
  it('shows the name, 8 tags, 5 roles, the CV link and a full-résumé button', () => {
    const nav = { goToResume: vi.fn(), openLaptop: vi.fn() }
    const { app } = bootedApp({ nav })
    const w = open(app, 'resume')
    expect(within(w).getByRole('heading', { name: 'Jewoo (Jay) Lee' })).toBeInTheDocument()
    expect(w.querySelectorAll('.tags span')).toHaveLength(8)
    const items = [...w.querySelectorAll('li')]
    expect(items).toHaveLength(5)
    expect(items[0].textContent).toBe('Wholesale Express: Full-Stack Developer (Part-time) (2025-08 → 2025-12)')
    const cv = w.querySelector('a[href="/files/JEWOOLEE_CV.pdf"]')
    expect(cv).not.toBeNull()
    expect(cv.textContent).toBe('Download CV (PDF) ↓')
    fireEvent.click(within(w).getByText('Read the full résumé'))
    expect(nav.goToResume).toHaveBeenCalledTimes(1)
  })
})

describe('Service', () => {
  it('Salute prints the phrase, unlocks Once a Marine and plays the two tones', () => {
    const { app } = bootedApp()
    const w = open(app, 'service')
    expect(w.textContent).not.toContain('필승')
    const unlock = vi.spyOn(app.ach, 'unlock')
    const tone = vi.spyOn(app.snd, 'tone')
    fireEvent.click(within(w).getByRole('button', { name: 'Salute' }))
    expect(w.textContent).toContain('필승! (Pilseung: “certain victory”)')
    expect(unlock).toHaveBeenCalledWith('tags')
    // The first unlock also plays the achievement chime (snd.ach -> tone), so check the first two.
    expect(tone.mock.calls.slice(0, 2)).toEqual([
      [392, 0.15, 'square', 0.05],
      [523, 0.3, 'square', 0.05, 0.15],
    ])
  })
})

describe('Trophies', () => {
  it('shows 0 of 13 with 13 locked items, then updates live when an achievement unlocks', () => {
    // Rendered on its own so the boot achievement does not count.
    const { app } = renderWithApp(<Trophies win={{ id: 'ach' }} />)
    expect(screen.getByText('0 of 13 unlocked. Progress stays in this browser.')).toBeInTheDocument()
    const items = () => [...document.querySelectorAll('ul.achl li')]
    expect(items()).toHaveLength(13)
    expect(items().every((li) => li.classList.contains('lock'))).toBe(true)

    act(() => {
      app.ach.unlock('boot')
    })
    expect(screen.getByText('1 of 13 unlocked. Progress stays in this browser.')).toBeInTheDocument()
    expect(items()[0].classList.contains('lock')).toBe(false)
    expect(items()[0].textContent).toContain('Power User')
  })
})

describe('Bin', () => {
  it('the RecycleWise card opens p:0', () => {
    const { app } = bootedApp()
    const w = open(app, 'bin')
    fireEvent.click(within(w).getByText('RecycleWise · open').closest('button'))
    expect(windowEl('p:0')).not.toBeNull()
  })
})

describe('AboutOs', () => {
  it('shows the title, the build line and the inspiration line', () => {
    const { app } = bootedApp()
    const w = open(app, 'aboutos')
    expect(within(w).getByText('JAY-OS 2.0')).toBeInTheDocument()
    expect(w.textContent).toContain('Built with React, Three.js and a lot of CSS.')
    expect(w.textContent).toContain('Inspired by ED-Linux on edh.dev')
  })
})

describe('Art', () => {
  it('shows a saved drawing from art:0 with its caption', () => {
    const { app } = bootedApp()
    let n
    act(() => {
      n = app.os.addArt('data:image/png;base64,QQ==')
    })
    expect(n).toBe(0)
    const w = open(app, 'art:0')
    expect(w.querySelector('img').getAttribute('src')).toBe('data:image/png;base64,QQ==')
    expect(within(w).getByText('Drawn by you. Jay would love to see it.')).toBeInTheDocument()
  })
})
