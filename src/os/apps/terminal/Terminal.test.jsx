// jaysh window (plan Phase 4 TEST LIST; prototype L876–930, keys per L931–935).
// Assumed: Terminal.jsx default-exports the window component taking `win`.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithApp } from '../../../test/renderWithApp.jsx'
import { AppProvider } from '../../../app/AppContext.jsx'
import Terminal from './Terminal.jsx'
import { JayOS } from '../../JayOS.jsx'

const HELP_FIRST = 'whoami        who is Jay'
const HELP = [
  'whoami        who is Jay',
  'neofetch      system info, but make it a flex',
  'ls            list the desktop',
  'projects      list projects   (open p1 … p9)',
  'open <thing>  open an app or project',
  'skills        what Jay works with',
  'experience    the career log',
  'contact       ways to reach Jay',
  'snake · bugs     play',
  'matrix · weather · lamp  mess with the room',
  'wallpaper     pick a Montréal desktop scene',
  'salute        Marine Corps salute',
  'sudo hire-jay ...you know you want to',
  'clear · history · exit · shutdown',
]

function mount(win = { id: 'term', cmd: null }) {
  const result = renderWithApp(<Terminal win={win} />)
  const input = screen.getByLabelText('Terminal command')
  // Text of each output row (banner, echoes, results, pre blocks).
  const out = () => [...document.querySelectorAll('.t-out > *')].map((n) => n.textContent)
  return { ...result, input, out }
}

describe('Terminal', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the banner, and typing help plus Enter prints the 14 help lines and clears the input', async () => {
    const user = userEvent.setup()
    const { input, out } = mount()
    expect(out()[0]).toBe('jaysh 0.2 · type "help" to see what this computer can do.')
    await user.type(input, 'help{Enter}')
    expect(out().slice(1)).toEqual(['jay@jay-os:~$ help', ...HELP])
    expect(input.value).toBe('')
  })

  it('ArrowUp and ArrowDown walk through history: pwd, ls, pwd, then empty', async () => {
    const user = userEvent.setup()
    const { input } = mount()
    await user.type(input, 'ls{Enter}')
    await user.type(input, 'pwd{Enter}')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input.value).toBe('pwd')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input.value).toBe('ls')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.value).toBe('pwd')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.value).toBe('')
  })

  it('Tab completes a unique prefix to the full name plus a space', async () => {
    const user = userEvent.setup()
    const { input } = mount()
    // `neo` (the plan's `nea` is not a prefix of neofetch; L935 uses startsWith).
    await user.type(input, 'neo')
    fireEvent.keyDown(input, { key: 'Tab' })
    expect(input.value).toBe('neofetch ')
  })

  it('Tab on h prints every match joined by two spaces in class d', async () => {
    const user = userEvent.setup()
    const { input, out } = mount()
    await user.type(input, 'h')
    fireEvent.keyDown(input, { key: 'Tab' })
    const row = document.querySelectorAll('.t-out > *')
    expect(out().at(-1)).toBe('help  hello  hi  history')
    expect(row[row.length - 1].className).toBe('d')
  })

  it('opening with a cmd prints it without typing, and re-sending the same cmd prints it again', () => {
    const { app, out, rerender } = mount({ id: 'term', cmd: { text: 'help', nonce: 1 } })
    expect(out().filter((t) => t === HELP_FIRST)).toHaveLength(1)
    rerender(
      <AppProvider app={app}>
        <Terminal win={{ id: 'term', cmd: { text: 'help', nonce: 2 } }} />
      </AppProvider>,
    )
    expect(out().filter((t) => t === HELP_FIRST)).toHaveLength(2)
  })

  it('focuses the input 60 ms after mount', () => {
    vi.useFakeTimers()
    const { input } = mount()
    act(() => {
      vi.advanceTimersByTime(60)
    })
    expect(input).toHaveFocus()
  })

  // Bug J: programmatic and click focus inside the OS must not scroll overflow:hidden ancestors.
  it('focus calls pass { preventScroll: true }, both on mount and on a click in the terminal', () => {
    vi.useFakeTimers()
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus')
    try {
      const { input, container } = mount()
      act(() => {
        vi.advanceTimersByTime(60)
      })
      expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true })
      expect(focusSpy.mock.contexts).toContain(input)
      focusSpy.mockClear()
      fireEvent.click(container.querySelector('.term'))
      expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true })
      expect(focusSpy.mock.contexts).toContain(input)
    } finally {
      focusSpy.mockRestore()
    }
  })

  // The signal is the window's `opened` counter (osController bumps it when openApp finds the window
  // already open, e.g. the desktop icon). A z change alone is a focus, not a re-open, so it must not
  // pull the caret into the terminal.
  it('a new `opened` count (re-opened) moves focus to the input; a z change alone does not', () => {
    vi.useFakeTimers()
    const { input, rerender, app } = mount({ id: 'term', cmd: null, z: 21, opened: 0 })
    act(() => {
      vi.advanceTimersByTime(60)
    })
    const elsewhere = document.createElement('button')
    document.body.append(elsewhere)
    try {
      act(() => {
        elsewhere.focus()
      })
      expect(input).not.toHaveFocus()

      rerender(
        <AppProvider app={app}>
          <Terminal win={{ id: 'term', cmd: null, z: 22, opened: 0 }} />
        </AppProvider>,
      )
      expect(input).not.toHaveFocus()

      rerender(
        <AppProvider app={app}>
          <Terminal win={{ id: 'term', cmd: null, z: 22, opened: 1 }} />
        </AppProvider>,
      )
      expect(document.activeElement).toBe(input)
    } finally {
      elsewhere.remove()
    }
  })

  // The real window (OS + Window + Terminal): a pointerdown that brings the terminal to the front
  // keeps the keyboard where it was, and re-opening it from the desktop icon puts it in the prompt.
  describe('focus through the OS window', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    function bootedWithTerm() {
      const result = renderWithApp(<JayOS />)
      act(() => {
        result.app.os.boot()
      })
      act(() => {
        vi.advanceTimersByTime(2200)
      })
      act(() => {
        result.app.os.openApp('term')
      })
      // The mount focus (60 ms) runs first; then another window takes focus, so z moves past it.
      act(() => {
        vi.advanceTimersByTime(300)
      })
      act(() => {
        result.app.os.openApp('about')
      })
      const input = screen.getByLabelText('Terminal command')
      const win = document.querySelector('section.win[data-app="term"]')
      const elsewhere = document.createElement('button')
      document.body.append(elsewhere)
      return { ...result, input, win, elsewhere }
    }

    it('a pointerdown that focuses the terminal window does not move focus into its input', () => {
      const { app, input, win, elsewhere } = bootedWithTerm()
      try {
        act(() => {
          elsewhere.focus()
        })
        const zBefore = app.os.store.get().wins.find((w) => w.id === 'term').z
        fireEvent.pointerDown(win)
        expect(app.os.store.get().wins.find((w) => w.id === 'term').z).toBeGreaterThan(zBefore)
        expect(app.os.store.get().focusedId).toBe('term')
        expect(input).not.toHaveFocus()
        expect(document.activeElement).toBe(elsewhere)
      } finally {
        elsewhere.remove()
      }
    })

    it('re-opening the terminal (openApp on the open window, as the desktop icon does) focuses its input', () => {
      const { app, input, elsewhere } = bootedWithTerm()
      try {
        act(() => {
          elsewhere.focus()
        })
        expect(input).not.toHaveFocus()
        act(() => {
          app.os.openApp('term')
        })
        expect(input).toHaveFocus()
      } finally {
        elsewhere.remove()
      }
    })
  })
})
