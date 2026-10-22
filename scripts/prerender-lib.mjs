// Pure HTML injection for the prerender (D12). Kept apart from prerender.mjs so it can be tested.

export const OUTLET = '<!--resume-outlet-->'

/**
 * JSON for an inline <script>: `<`, `>`, `&` and the JS line separators are written as \u
 * escapes, so no `</script>` or `<!--` can end the block early. JSON.parse reads them back.
 */
export function safeJson(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
}

/**
 * Replaces the single résumé outlet with `markup` and adds the JSON-LD script before </head>.
 * Throws when the outlet or </head> is missing, or the outlet appears more than once.
 */
export function injectResume(html, markup, jsonld) {
  const at = html.indexOf(OUTLET)
  if (at === -1) throw new Error('prerender: ' + OUTLET + ' not found in index.html')
  if (html.indexOf(OUTLET, at + OUTLET.length) !== -1) throw new Error('prerender: more than one ' + OUTLET)
  const head = html.indexOf('</head>')
  if (head === -1 || head > at) throw new Error('prerender: </head> not found before the outlet')

  const script = '<script type="application/ld+json">' + safeJson(jsonld) + '</script>\n'
  // Plain slicing (not String.replace) so `$` sequences in the markup are never patterns.
  return (
    html.slice(0, head) + script + html.slice(head, at) + markup + html.slice(at + OUTLET.length)
  )
}
