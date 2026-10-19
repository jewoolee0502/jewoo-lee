// Pure jaysh parsing helpers (L901–905, L927–930). No object-literal lookups (fix B1).

/** Splits a raw line into {line, cmd, args, c0}; `args` has its whitespace collapsed. */
export function parseLine(raw) {
  const line = String(raw ?? '').trim()
  if (!line) return { line: '', cmd: '', args: '', c0: '' }
  const parts = line.split(/\s+/)
  const c0 = parts[0]
  return { line, cmd: c0.toLowerCase(), args: parts.slice(1).join(' '), c0 }
}

/** Edit distance (L927). */
export function levenshtein(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) m[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return m[a.length][b.length]
}

/** The first name (in `names` order) at the minimum distance from `cmd`, if that distance is ≤ 2. */
export function suggest(cmd, names) {
  let best = null
  let bestD = Infinity
  for (const name of names) {
    const d = levenshtein(cmd, name)
    if (d < bestD) {
      best = name
      bestD = d
    }
  }
  return best !== null && bestD <= 2 ? best : null
}

const squash = (s) => s.toLowerCase().replace(/\s+/g, '')

/**
 * What `open <a>` refers to (L901–905): a 1-based project number (`p3`, `3`, multi-digit; fix B15),
 * a NAMES alias, or a project-title prefix.
 * Returns {kind:'project', index} | {kind:'app', id, name} | {kind:'none', shown}.
 */
export function resolveOpen(a, { projects, names }) {
  const s = String(a ?? '')
    .toLowerCase()
    .replace(/\.(txt|log|inv|exe|pdf)$/, '')
    .replace(/\s+/g, '')
  const m = s.match(/^p?(\d+)$/)
  if (m) {
    const index = Number(m[1]) - 1
    if (index >= 0 && index < projects.length) return { kind: 'project', index }
  }
  const id = names.get(s)
  if (id !== undefined) return { kind: 'app', id, name: s }
  if (s) {
    const index = projects.findIndex((p) => squash(p.title).startsWith(s))
    if (index >= 0) return { kind: 'project', index }
  }
  return { kind: 'none', shown: s || '(nothing)' }
}
