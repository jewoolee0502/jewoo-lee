// Moves the reader to the résumé below the stage (D11) and puts focus on its heading.
export function scrollToResume(behavior = 'smooth', doc = globalThis.document) {
  const resume = doc?.getElementById('resume')
  if (!resume) return
  resume.scrollIntoView({ behavior, block: 'start' })
  doc.getElementById('resume-title')?.focus({ preventScroll: true })
}
