// Recording 2D context for jsdom (which has no canvas drawing).
// Every method call is recorded as [name, ...args] in ctx.calls and every
// property set as [name, value] in ctx.sets.

function makeGradient(record) {
  const stops = []
  return {
    stops,
    addColorStop(offset, color) {
      stops.push([offset, color])
      record('addColorStop', offset, color)
    },
  }
}

function imageData(w, h) {
  const width = Math.max(0, Math.floor(w) || 0)
  const height = Math.max(0, Math.floor(h) || 0)
  return { data: new Uint8ClampedArray(width * height * 4), width, height }
}

// Properties that inspectors (await, pretty-format, JSON, React) probe on any
// object. They must not look like recorded canvas methods.
const NOT_METHODS = new Set([
  'then',
  'toJSON',
  'asymmetricMatch',
  '$$typeof',
  'nodeType',
  'tagName',
  'constructor',
  '@@__IMMUTABLE_ITERABLE__@@',
  '@@__IMMUTABLE_RECORD__@@',
])

export function createRecordingContext(canvas) {
  const calls = []
  const sets = []
  const state = {}
  const record = (name, ...args) => calls.push([name, ...args])

  const special = {
    getImageData: (_x, _y, w, h) => imageData(w, h),
    createImageData: (w, h) =>
      typeof w === 'object' && w ? imageData(w.width, w.height) : imageData(w, h),
    createLinearGradient: () => makeGradient(record),
    createRadialGradient: () => makeGradient(record),
    createConicGradient: () => makeGradient(record),
    createPattern: () => ({ setTransform() {} }),
    measureText: (text) => ({ width: String(text ?? '').length * 6 }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    getLineDash: () => [],
    isPointInPath: () => false,
    isPointInStroke: () => false,
  }

  const target = { canvas, calls, sets }

  return new Proxy(target, {
    get(t, prop) {
      if (prop in t) return t[prop]
      if (typeof prop === 'symbol' || NOT_METHODS.has(prop)) return undefined
      if (Object.prototype.hasOwnProperty.call(state, prop)) return state[prop]
      return (...args) => {
        record(prop, ...args)
        const fn = special[prop]
        return fn ? fn(...args) : undefined
      }
    },
    set(t, prop, value) {
      if (prop === 'calls' || prop === 'sets' || prop === 'canvas') {
        t[prop] = value
        return true
      }
      state[prop] = value
      sets.push([prop, value])
      return true
    },
  })
}
