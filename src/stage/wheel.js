// Stage wheel (L1044–1054). Inside the laptop the wheel belongs to the OS: windows scroll their
// own content, and an upward scroll on the desktop itself steps back out. The page never scrolls
// underneath. Attach with addEventListener('wheel', h, {passive:false}) on #stage.
import { WHEEL_EXIT, WHEEL_GAP_MS } from '../core/constants.js'

export const WHEEL_HINT = [
  'You’re inside the laptop',
  'Scroll up on the desktop, press Esc, or click ⏏ Close laptop to step back.',
  'info',
]

export function createWheelHandler({ ctrl, sceneStatus, now = () => performance.now(), toast }) {
  let acc = 0
  let last = 0
  let hinted = false

  return function onWheel(e) {
    const { mode, interactive } = ctrl.store.get()
    if (sceneStatus() !== 'ready' || mode !== 'inside') return
    if (!interactive) {
      e.preventDefault()
      return
    }
    const target = e.target instanceof Element ? e.target : null
    const sc = target?.closest('.wb,.t-out')
    if (
      sc &&
      ((e.deltaY < 0 && sc.scrollTop > 0) ||
        (e.deltaY > 0 && sc.scrollTop + sc.clientHeight < sc.scrollHeight - 1))
    )
      return
    e.preventDefault()
    if (target?.closest('.win,.menu-pop')) return
    const t = now()
    if (t - last > WHEEL_GAP_MS) acc = 0
    last = t
    acc += e.deltaY
    if (acc < -WHEEL_EXIT) {
      acc = 0
      ctrl.exit()
    } else if (acc > WHEEL_EXIT && !hinted) {
      hinted = true
      toast(...WHEEL_HINT)
    }
  }
}
