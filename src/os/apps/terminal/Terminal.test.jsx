// jaysh window (plan Phase 4 TEST LIST; prototype L876–930, keys per L931–935).
// Assumed: Terminal.jsx default-exports the window component taking `win`.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithApp } from '../../../test/renderWithApp.jsx'
import { AppProvider } from '../../../app/AppContext.jsx'
import Terminal from './Terminal.jsx'

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
  'snake · bugs · paint     play',
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
})
