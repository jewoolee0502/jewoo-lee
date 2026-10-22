// Tracked timeouts, intervals and animation frames (fix B5). Every handle can be
// cancelled on its own, and clearAll() cancels everything in the group and its children.

const defaultRaf = (cb) => globalThis.requestAnimationFrame(cb)
const defaultCaf = (id) => globalThis.cancelAnimationFrame(id)

export function createTimers({ raf = defaultRaf, caf = defaultCaf } = {}) {
  const cancels = new Set()
  const children = new Set()

  function track(cancelFn) {
    let done = false
    const cancel = () => {
      if (done) return
      done = true
      cancels.delete(cancel)
      cancelFn()
    }
    cancels.add(cancel)
    return cancel
  }

  const group = {
    timeout(fn, ms) {
      let cancel = null
      const id = setTimeout(() => {
        cancels.delete(cancel)
        fn()
      }, ms)
      cancel = track(() => clearTimeout(id))
      return cancel
    },
    interval(fn, ms) {
      const id = setInterval(fn, ms)
      return track(() => clearInterval(id))
    },
    raf(fn) {
      let cancel = null
      const id = raf((t) => {
        cancels.delete(cancel)
        fn(t)
      })
      cancel = track(() => caf(id))
      return cancel
    },
    child() {
      const c = createTimers({ raf, caf })
      children.add(c)
      return c
    },
    clearAll() {
      for (const cancel of [...cancels]) cancel()
      for (const c of children) c.clearAll()
      children.clear()
    },
  }
  return group
}
