import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, screen, within } from '@testing-library/react'
import { renderWithApp } from '../test/renderWithApp.jsx'
import { JayOS } from './JayOS.jsx'
import { createOsController } from './osController.js'
import { createOsHost } from './osHost.js'
import { createTimers } from '../core/timers.js'
import { createMotion } from '../core/motion.js'
import { createToasts } from '../core/toasts.js'
import { createSound } from '../core/sound.js'
import { createAchievements } from '../core/achievements.js'
import { createStore } from '../core/store.js'

// jsdom has no PointerEvent. A MouseEvent with pointerId is enough for these tests.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type, init = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
      this.pointerType = init.pointerType ?? 'mouse'
    }
  }
  window.PointerEvent = PointerEventPolyfill
}

// Stub registry, as the plan specifies, with `b` added for the focus test.
const REGISTRY = {
  a: { title: 'A', w: 300, h: 200, Component: () => <p>App A</p> },
  b: { title: 'B', w: 340, h: 250, x: 520, y: 50, Component: () => <p>App B</p> },
  term: {
    title: 'Terminal',
    w: 520,
    h: 400,
    Component: ({ win }) => <p data-testid="cmd">{win.cmd?.text}</p>,
  },
}

function setup() {
  const timers = createTimers()
  const motion = createMotion()
  const toasts = createToasts({ timers: timers.child() })
  const snd = createSound()
  const ach = createAchievements({ toast: (...args) => toasts.toast(...args), snd })
  const host = createOsHost()
  const ctrl = { store: createStore({}), exit: vi.fn(), enter: vi.fn() }
  const nav = { goToResume: vi.fn(), openLaptop: vi.fn() }
  const os = createOsController({
    host,
    registry: REGISTRY,
    ach,
    toasts,
    snd,
    motion,
    timers,
    scene: () => null,
    ctrl: () => ctrl,
  })
  const result = renderWithApp(<JayOS />, { timers, motion, toasts, snd, ach, host, os, nav, ctrl })
  return { ...result, os, host, toasts, snd, ach, nav, ctrl }
}

// Boots to `on` (boot is 2200 ms with the default motion setting).
function bootOn(os) {
  act(() => {
    os.boot()
  })
  act(() => {
    vi.advanceTimersByTime(2200)
  })
}

function mockScale(host, scale) {
  // scale() = getBoundingClientRect().width / offsetWidth
  vi.spyOn(host.osEl, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    width: 900 * scale,
    height: 675,
    right: 900 * scale,
    bottom: 675,
  })
  Object.defineProperty(host.osEl, 'offsetWidth', { configurable: true, value: 900 })
}

beforeEach(() => {
  vi.useFakeTimers()
})

describe('JayOS shell', () => {
  it('standby layer shows JAY-OS and "waking up …", and the OS element is in standby', () => {
    const { container, host } = setup()

    expect(container.querySelector('.sb-logo')).toHaveTextContent('JAY-OS')
    expect(container.querySelector('.sb-blink')).toHaveTextContent('waking up …')
    expect(host.osEl.dataset.state).toBe('standby')
  })

  it('after boot() and 150 ms, the boot log shows 2 lines and the OK line has span.ok', () => {
    const { container, os } = setup()

    act(() => {
      os.boot()
    })
    act(() => {
      vi.advanceTimersByTime(150)
    })

    const log = container.querySelector('pre')
    expect(log.children).toHaveLength(2)
    const okLine = [...log.children].find((line) => line.querySelector('span.ok'))
    expect(okLine).toBeDefined()
    expect(okLine.querySelector('span.ok')).toHaveTextContent('OK')
  })

  it('when on, the left and right icon labels appear in the prototype order, with PNG icons', () => {
    const { container, os } = setup()
    bootOn(os)

    const labels = (side) =>
      [...container.querySelectorAll(`.icons.${side} button.ic`)].map((b) => b.querySelector('span').textContent)
    expect(labels('l')).toEqual([
      'About.txt',
      'Projects',
      'Experience.log',
      'Skills.inv',
      'Terminal',
      'Resume.pdf',
      'Mail',
      'Wallpaper',
    ])
    expect(labels('r')).toEqual(['BugHunt.exe', 'Snake.exe', 'Service.txt', 'Trophies', 'Recycle Bin'])
    const imgs = [...container.querySelectorAll('button.ic img')]
    expect(imgs.length).toBe(13)
    for (const img of imgs) expect(img.getAttribute('src')).toMatch(/^data:image\/png/)
  })

  it('clicking About.txt calls os.openApp("about")', () => {
    const { os } = setup()
    bootOn(os)
    const spy = vi.spyOn(os, 'openApp')

    fireEvent.click(screen.getByRole('button', { name: 'About.txt' }))

    expect(spy).toHaveBeenCalledWith('about')
  })

  it('the ◆ JAY-OS button shows the menu; a pointerdown on the desktop hides it', () => {
    const { os, container } = setup()
    bootOn(os)

    fireEvent.click(screen.getByRole('button', { name: '◆ JAY-OS' }))

    const menu = container.querySelector('.menu-pop')
    expect(menu).not.toBeNull()
    expect(within(menu).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'About JAY-OS',
      'Desktop Background…',
      'Trophies',
      'Résumé',
      'Restart',
      'Shut Down…',
    ])

    fireEvent.pointerDown(container.querySelector('.l-desk'))

    expect(screen.queryByRole('button', { name: 'Restart' })).not.toBeInTheDocument()
  })

  it('menu Résumé calls nav.goToResume once and closes the menu', () => {
    const { os, container, nav } = setup()
    bootOn(os)
    fireEvent.click(screen.getByRole('button', { name: '◆ JAY-OS' }))

    fireEvent.click(within(container.querySelector('.menu-pop')).getByRole('button', { name: 'Résumé' }))

    expect(nav.goToResume).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Résumé' })).not.toBeInTheDocument()
  })

  it('menu Shut Down… reaches off at 600 ms, and ctrl.exit is called 900 ms later', () => {
    const { os, container, ctrl } = setup()
    bootOn(os)
    fireEvent.click(screen.getByRole('button', { name: '◆ JAY-OS' }))

    fireEvent.click(within(container.querySelector('.menu-pop')).getByRole('button', { name: 'Shut Down…' }))

    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(os.store.get().state).toBe('off')
    expect(ctrl.exit).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(899)
    })
    expect(ctrl.exit).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(ctrl.exit).toHaveBeenCalledTimes(1)
  })

  it('Help opens the terminal with the help command', () => {
    const { os } = setup()
    bootOn(os)

    fireEvent.click(screen.getByRole('button', { name: 'Help' }))

    expect(screen.getByTestId('cmd')).toHaveTextContent('help')
  })

  it('the menubar clock shows MTL and SEL times, updates every 15 s, and the MTL click adds a toast', () => {
    // The clock reads the time on mount, so set the system time before rendering.
    vi.setSystemTime(new Date('2026-07-15T15:04:00Z'))
    const { os, container, toasts } = setup()
    bootOn(os)

    expect(container.querySelector('.mb-mtl').textContent).toBe('MTL 11:04')
    expect(container.querySelector('.mb-sel').textContent).toBe(' · SEL 00:04')

    vi.setSystemTime(new Date('2026-07-15T15:05:00Z'))
    act(() => {
      vi.advanceTimersByTime(15000)
    })
    expect(container.querySelector('.mb-mtl').textContent).toBe('MTL 11:05')

    fireEvent.click(container.querySelector('.mb-mtl'))
    expect(toasts.store.get().list).toContainEqual(
      expect.objectContaining({
        title: 'Two time zones',
        body: 'Montréal, where Jay studies, and Seoul, where Jay’s from.',
        kind: 'info',
      }),
    )
  })

  it('⏏ Close laptop calls ctrl.exit and has the Esc title', () => {
    const { os, ctrl } = setup()
    bootOn(os)
    const button = screen.getByRole('button', { name: '⏏ Close laptop' })

    expect(button).toHaveAttribute('title', 'Step back from the laptop (Esc)')
    fireEvent.click(button)

    expect(ctrl.exit).toHaveBeenCalledTimes(1)
  })

  it('the Sound button turns sound on: "Sound: on" with aria-pressed="true"', () => {
    const { os } = setup()
    bootOn(os)

    fireEvent.click(screen.getByRole('button', { name: 'Sound: off' }))

    expect(screen.getByRole('button', { name: 'Sound: on' })).toHaveAttribute('aria-pressed', 'true')
  })

  describe('window a', () => {
    it('shows title A and body App A, and the close button removes it', () => {
      const { os, container } = setup()
      bootOn(os)
      act(() => {
        os.openApp('a')
      })

      const win = container.querySelector('[data-app="a"]')
      expect(win.querySelector('.tb-t')).toHaveTextContent('A')
      expect(win.querySelector('.wb')).toHaveTextContent('App A')

      fireEvent.click(within(win).getByRole('button', { name: 'Close window' }))

      expect(container.querySelector('[data-app="a"]')).toBeNull()
      expect(os.store.get().wins).toHaveLength(0)
    })

    it('a pointerdown on a gives a the focused class and removes it from b', () => {
      const { os, container } = setup()
      bootOn(os)
      act(() => {
        os.openApp('a')
        os.openApp('b')
      })
      const a = container.querySelector('[data-app="a"]')
      const b = container.querySelector('[data-app="b"]')

      fireEvent.pointerDown(a)

      expect(a.classList.contains('focused')).toBe(true)
      expect(b.classList.contains('focused')).toBe(false)
    })

    it('dragging the header (scale 0.5) moves the window and commits moveWindow on pointerup', () => {
      const { os, container, host } = setup()
      bootOn(os)
      act(() => {
        os.openApp('a')
      })
      mockScale(host, 0.5)
      const moveSpy = vi.spyOn(os, 'moveWindow')
      const win = container.querySelector('[data-app="a"]')
      const header = win.querySelector('.tb')

      fireEvent.pointerDown(header, { clientX: 100, clientY: 100, pointerId: 1 })
      fireEvent.pointerMove(header, { clientX: 110, clientY: 105, pointerId: 1 })

      expect(win.style.left).toBe(130 + 20 + 'px')
      expect(win.style.top).toBe(46 + 10 + 'px')

      fireEvent.pointerUp(header, { clientX: 110, clientY: 105, pointerId: 1 })
      expect(moveSpy).toHaveBeenCalledWith('a', 150, 56)
    })

    it('a drag that starts on the close button does not move the window', () => {
      const { os, container, host } = setup()
      bootOn(os)
      act(() => {
        os.openApp('a')
      })
      mockScale(host, 0.5)
      const moveSpy = vi.spyOn(os, 'moveWindow')
      const win = container.querySelector('[data-app="a"]')
      const close = within(win).getByRole('button', { name: 'Close window' })

      fireEvent.pointerDown(close, { clientX: 100, clientY: 100, pointerId: 1 })
      fireEvent.pointerMove(close, { clientX: 110, clientY: 105, pointerId: 1 })
      fireEvent.pointerUp(close, { clientX: 110, clientY: 105, pointerId: 1 })

      expect(win.style.left).toBe('130px')
      expect(moveSpy).not.toHaveBeenCalled()
    })

    it('in compact mode, a drag does not move the window', () => {
      const { os, container, host } = setup()
      bootOn(os)
      act(() => {
        os.openApp('a')
        os.setFlat(false, true)
      })
      mockScale(host, 0.5)
      const win = container.querySelector('[data-app="a"]')
      const header = win.querySelector('.tb')

      fireEvent.pointerDown(header, { clientX: 100, clientY: 100, pointerId: 1 })
      fireEvent.pointerMove(header, { clientX: 110, clientY: 105, pointerId: 1 })
      fireEvent.pointerUp(header, { clientX: 110, clientY: 105, pointerId: 1 })

      expect(win.style.left).toBe('130px')
      expect(win.style.top).toBe('46px')
    })
  })

  it('the Zoom into the screen button calls nav.openLaptop and boots from standby', () => {
    const { os, nav } = setup()

    fireEvent.click(screen.getByRole('button', { name: 'Zoom into the screen' }))

    expect(nav.openLaptop).toHaveBeenCalledTimes(1)
    expect(os.store.get().state).toBe('boot')
  })

  it('after shutdown the off layer says it is safe to turn off', () => {
    const { os, container } = setup()
    bootOn(os)
    act(() => {
      os.shutdown(() => {})
    })
    act(() => {
      vi.advanceTimersByTime(600)
    })

    expect(os.store.get().state).toBe('off')
    expect(container).toHaveTextContent("It's now safe to turn off")
    expect(container).toHaveTextContent('press the power button to boot again')
  })

  it('os.matrix() renders canvas.fx, which is gone after 4600 ms', () => {
    const { os, container } = setup()
    bootOn(os)

    act(() => {
      os.matrix()
    })
    expect(container.querySelector('canvas.fx')).not.toBeNull()

    act(() => {
      vi.advanceTimersByTime(4600)
    })
    expect(container.querySelector('canvas.fx')).toBeNull()
  })
})
