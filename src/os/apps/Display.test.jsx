// Phase 5 TEST LIST: os/apps/Display.test.jsx. The Display app (L831–838) picks the desktop
// wallpaper: Auto (follows Montréal time) or one of the three modes. Opened on a booted OS so
// the Desktop (and its #wp-cap caption) is rendered too.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, within } from '@testing-library/react'
import { renderWithApp } from '../../test/renderWithApp.jsx'
import { JayOS } from '../JayOS.jsx'

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

const windowEl = (id) => document.querySelector(`section.win[data-app="${id}"]`)

function openDisplay(app) {
  act(() => {
    app.os.openApp('display')
  })
  return windowEl('display')
}

beforeEach(() => {
  vi.useFakeTimers()
})

describe('Display app', () => {
  it('shows the intro, then four cards in order: Auto, Montréal by night, Golden hour, Snow day', () => {
    const { app } = bootedApp()
    const w = openDisplay(app)
    expect(within(w).getByText(
      'The desktop is a living pixel-art Montréal. Pick the time of day, or let it follow the real clock in Montréal. Then click around the city: it hides a few secrets.',
    )).toBeInTheDocument()
    const labels = [...w.querySelectorAll('button.pcard span')].map((s) => s.textContent)
    expect(labels).toEqual([
      'Auto · follows Montréal time',
      'Montréal by night',
      'Golden hour',
      'Snow day',
    ])
  })

  it('marks Auto as the current choice on open', () => {
    const { app } = bootedApp()
    const w = openDisplay(app)
    const on = w.querySelectorAll('button.pcard.on')
    expect(on).toHaveLength(1)
    expect(on[0].textContent).toBe('Auto · follows Montréal time')
  })

  it('clicking Golden hour sets the choice, moves the on marker and updates the caption', () => {
    const { app } = bootedApp()
    const w = openDisplay(app)
    fireEvent.click(within(w).getByText('Golden hour').closest('button'))
    expect(app.wallpaper.store.get().choice).toBe('golden')
    const on = w.querySelectorAll('button.pcard.on')
    expect(on).toHaveLength(1)
    expect(on[0].textContent).toBe('Golden hour')
    expect(document.querySelector('#wp-cap').textContent).toBe('vieux-port · 7:12 pm')
  })

  // D14: only `jayos-ach` persists (booting unlocks "Power User"); the wallpaper choice never does.
  it('stores nothing about the wallpaper in localStorage', () => {
    const { app } = bootedApp()
    const w = openDisplay(app)
    const before = Object.keys(localStorage)
    fireEvent.click(within(w).getByText('Golden hour').closest('button'))
    expect(Object.keys(localStorage)).toEqual(before)
    expect(Object.keys(localStorage).filter((k) => k !== 'jayos-ach')).toEqual([])
    for (const k of Object.keys(localStorage)) expect(localStorage.getItem(k)).not.toContain('golden')
  })

  it('the desk renders the wallpaper canvas, and a card click switches the live engine mode', () => {
    const { app } = bootedApp()
    expect(document.querySelector('#l-desk canvas.wallpaper')).not.toBeNull()
    const w = openDisplay(app)
    fireEvent.click(within(w).getByText('Snow day').closest('button'))
    expect(app.wallpaperEngine.mode).toBe('day')
  })
})
