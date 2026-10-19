// Imperative host elements for JAY-OS (D2). `holder` becomes the CSS3DObject element;
// `osEl` moves between the holder and the flat host. React renders into `osEl` through a
// portal, and only this module writes classes, data-state and inline size on these nodes.
import { OS_W, OS_H } from '../core/constants.js'

export function createOsHost({ doc = globalThis.document } = {}) {
  const holder = doc.createElement('div')
  holder.id = 'os-holder'
  holder.style.width = OS_W + 'px'
  holder.style.height = OS_H + 'px'

  const osEl = doc.createElement('div')
  osEl.className = 'os'
  osEl.id = 'os'
  osEl.dataset.state = 'standby'
  holder.appendChild(osEl)

  let park = null
  let flatHost = null
  let curW = OS_W
  let curH = OS_H

  /** Parks the holder in `.park` while nothing else (the CSS3D renderer) owns it. */
  function attachPark(el) {
    park = el
    if (el && !holder.parentNode) el.appendChild(holder)
  }

  function detachPark() {
    if (park && holder.parentNode === park) park.removeChild(holder)
    park = null
  }

  function bindFlatHost(el) {
    flatHost = el
  }

  /** L677 */
  function size() {
    return { w: osEl.clientWidth || OS_W, h: osEl.clientHeight || OS_H }
  }

  /** L691: rendered width over layout width (1 when there is no layout). */
  function scale() {
    const k = osEl.getBoundingClientRect().width / osEl.offsetWidth
    return Number.isFinite(k) && k > 0 ? k : 1
  }

  /** L754–755. Returns {shrunk}; makes no style write when the size is unchanged. */
  function setSize(w, h) {
    w = Math.round(w)
    h = Math.round(h)
    if (w === curW && h === curH) return { shrunk: false }
    const shrunk = w < curW || h < curH
    curW = w
    curH = h
    holder.style.width = osEl.style.width = w + 'px'
    holder.style.height = osEl.style.height = h + 'px'
    return { shrunk }
  }

  /** L747–750: full screen keeps the zoomed-in scale and grows the desk to fill the host.
   *  Returns the 2D scale it applied (1 for the compact layout, or when not flat). */
  function fitFlat() {
    if (!osEl.classList.contains('flat')) return 1
    if (osEl.classList.contains('compact')) {
      osEl.style.width = osEl.style.height = osEl.style.transform = ''
      return 1
    }
    if (!flatHost) return 1
    const W = flatHost.clientWidth
    const H = flatHost.clientHeight
    const k = Math.min(W / OS_W, H / OS_H)
    if (!(k > 0)) return 1
    osEl.style.transformOrigin = '0 0'
    osEl.style.transform = 'scale(' + k + ')'
    osEl.style.width = W / k + 'px'
    osEl.style.height = H / k + 'px'
    return k
  }

  /** L757–761. Returns whether the OS is now flat. The flat host fades in only for the compact
   *  layout: the scaled one replaces the 3D screen at the same size and place (R4). */
  function setFlat(v, compact) {
    v = Boolean(v)
    osEl.classList.toggle('compact', Boolean(compact))
    flatHost?.classList.toggle('fade', Boolean(compact))
    if (v !== osEl.classList.contains('flat')) {
      if (v) {
        if (!flatHost) return false
        flatHost.appendChild(osEl)
        osEl.classList.add('flat')
        flatHost.classList.add('on')
      } else {
        holder.appendChild(osEl)
        osEl.classList.remove('flat')
        flatHost?.classList.remove('on')
        osEl.style.transform = ''
        curW = curH = 0
        setSize(OS_W, OS_H)
      }
    }
    if (v) fitFlat()
    return osEl.classList.contains('flat')
  }

  /** L756. Window scroll offsets survive (R9): `.os:not(.live) .wb` is overflow:hidden. */
  function setLive(v) {
    osEl.classList.toggle('live', Boolean(v))
  }

  function syncClasses({ state, collapsing, disco, fallback }) {
    if (state != null && osEl.dataset.state !== state) osEl.dataset.state = state
    osEl.classList.toggle('collapsing', Boolean(collapsing))
    osEl.classList.toggle('disco', Boolean(disco))
    osEl.classList.toggle('fallback', Boolean(fallback))
  }

  return {
    holder,
    osEl,
    attachPark,
    detachPark,
    bindFlatHost,
    size,
    scale,
    setSize,
    fitFlat,
    setFlat,
    setLive,
    syncClasses,
  }
}
