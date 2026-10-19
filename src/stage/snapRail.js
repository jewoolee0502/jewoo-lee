// The snap rail (plan-r2 §7 U2): one `<i class="stop">` at diveEnd (scroll-snap-stop: always),
// then one plain `<i>` per snap point, positioned in #track. Synced once per layout change, never
// per frame, and with as few DOM writes as possible: a node whose value did not change is never
// touched, so the browser keeps a page that is snapped to it where it is.
const last = new WeakMap()

function place(node, px) {
  if (last.get(node) === px) return
  last.set(node, px)
  node.style.top = px + 'px'
}

export function syncSnapRail(el, { stop, points }) {
  if (!el) return
  const want = [stop, ...points]
  const nodes = el.children
  const n = Math.min(nodes.length, want.length)
  for (let i = 0; i < n; i++) place(nodes[i], want[i])
  while (el.children.length > want.length) el.lastElementChild.remove()
  if (want.length > n) {
    const doc = el.ownerDocument
    const frag = doc.createDocumentFragment()
    for (let i = n; i < want.length; i++) {
      const node = doc.createElement('i')
      if (i === 0) node.className = 'stop'
      place(node, want[i])
      frag.appendChild(node)
    }
    el.appendChild(frag)
  }
}
