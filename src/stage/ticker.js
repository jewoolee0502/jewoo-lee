// The single rAF loop (D6) for the controller, scene and wallpaper. The stage's
// IntersectionObserver starts and stops it.
export function createTicker({
  raf = (cb) => globalThis.requestAnimationFrame(cb),
  caf = (id) => globalThis.cancelAnimationFrame(id),
  now = () => performance.now(),
  onFrame,
}) {
  let id = null
  let last = 0

  const frame = (t) => {
    id = null
    const dt = Math.min(0.05, (t - last) / 1000 || 0.016)
    last = t
    onFrame(t, dt)
    if (ticker.running) id = raf(frame)
  }

  const ticker = {
    running: false,
    start() {
      if (ticker.running) return
      ticker.running = true
      last = now()
      id = raf(frame)
    },
    stop() {
      if (!ticker.running) return
      ticker.running = false
      if (id !== null) caf(id)
      id = null
    },
  }
  return ticker
}
