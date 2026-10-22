// Bug J: overflow:hidden containers still scroll programmatically (focus, find-in-page,
// scrollIntoView). The CSS3D OS sits inside such containers, so any offset pushes it off-screen.
// pinScroll resets the element's scroll offsets to 0 whenever it scrolls; returns a cleanup.
export function pinScroll(el) {
  if (!el) return () => {}
  const onScroll = () => {
    if (el.scrollTop !== 0) el.scrollTop = 0
    if (el.scrollLeft !== 0) el.scrollLeft = 0
  }
  el.addEventListener('scroll', onScroll, { passive: true })
  return () => el.removeEventListener('scroll', onScroll, { passive: true })
}
