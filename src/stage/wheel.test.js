// Phase 3 TEST LIST: stage/wheel.test.js. Port of L1044–1054 with the fixes from section 3.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWheelHandler } from './wheel.js'
import { createStore } from '../core/store.js'

const HINT_TITLE = 'You’re inside the laptop'
const HINT_BODY = 'Scroll up on the desktop, press Esc, or click ⏏ Close laptop to step back.'

describe('stage/wheel', () => {
  let t, status, ctrl, toast, handler, els

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="stage">
        <div class="desk" id="desk"></div>
        <div class="win" id="win">
          <div class="wb" id="wb"><span id="wbtext"></span></div>
        </div>
        <div class="menu-pop" id="mp"><span id="mpi"></span></div>
      </div>`
    const wb = document.getElementById('wb')
    Object.defineProperties(wb, {
      scrollTop: { value: 0, writable: true, configurable: true },
      clientHeight: { value: 100, configurable: true },
      scrollHeight: { value: 500, configurable: true },
    })
    els = {
      stage: document.getElementById('stage'),
      desk: document.getElementById('desk'),
      wb,
      wbtext: document.getElementById('wbtext'),
      mp: document.getElementById('mpi'),
    }
    t = 0
    status = 'ready'
    ctrl = {
      store: createStore({ mode: 'inside', interactive: true, narrow: false }),
      exit: vi.fn(),
    }
    toast = vi.fn()
    handler = createWheelHandler({ ctrl, sceneStatus: () => status, now: () => t, toast })
  })

  const ev = (deltaY, target) => ({ deltaY, target, preventDefault: vi.fn() })
  const fire = (deltaY, target = els.desk) => {
    const e = ev(deltaY, target)
    handler(e)
    return e
  }

  it('1. when the scene is not ready, or the mode is desk, nothing is prevented', () => {
    status = 'loading'
    expect(fire(-100).preventDefault).not.toHaveBeenCalled()
    status = 'ready'
    ctrl.store.set({ mode: 'desk' })
    expect(fire(-100).preventDefault).not.toHaveBeenCalled()
  })

  it('2. inside but not interactive: prevented, and no exit even with -1000', () => {
    ctrl.store.set({ interactive: false })
    const e = fire(-1000)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(ctrl.exit).not.toHaveBeenCalled()
  })

  it('3. a .wb with scrollTop 10 scrolling up is not prevented; with scrollTop 0 it is prevented but never accumulates', () => {
    els.wb.scrollTop = 10
    expect(fire(-100, els.wbtext).preventDefault).not.toHaveBeenCalled()

    els.wb.scrollTop = 0
    t = 0
    const first = fire(-300, els.wbtext)
    expect(first.preventDefault).toHaveBeenCalled()
    t = 100
    fire(-300, els.wbtext)
    t = 200
    fire(-300, els.wbtext)
    expect(ctrl.exit).not.toHaveBeenCalled()
  })

  it('4. a .wb that can still scroll down is not prevented for deltaY > 0', () => {
    els.wb.scrollTop = 0 // 0 + 100 < 500 - 1
    expect(fire(100, els.wbtext).preventDefault).not.toHaveBeenCalled()
  })

  it('5. desktop target: -100 at 0, 100, 200 exits once; a fourth -100 at 300 does not exit again', () => {
    t = 0
    fire(-100)
    t = 100
    fire(-100)
    t = 200
    fire(-100)
    expect(ctrl.exit).toHaveBeenCalledTimes(1)
    t = 300
    fire(-100)
    expect(ctrl.exit).toHaveBeenCalledTimes(1)
  })

  it('6. -100 at 0, 500 and 1000 never exits, because each gap is over 400 ms', () => {
    t = 0
    fire(-100)
    t = 500
    fire(-100)
    t = 1000
    fire(-100)
    expect(ctrl.exit).not.toHaveBeenCalled()
  })

  it('7. +300 shows the hint toast once; a later +300 shows no second toast', () => {
    t = 0
    const e1 = fire(300)
    expect(e1.preventDefault).toHaveBeenCalled()
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith(HINT_TITLE, HINT_BODY, 'info')
    t = 2000
    fire(300)
    expect(toast).toHaveBeenCalledTimes(1)
  })

  it('8. a target inside .menu-pop is prevented and never exits, even after -1000', () => {
    const e = fire(-1000, els.mp)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(ctrl.exit).not.toHaveBeenCalled()
  })
})
