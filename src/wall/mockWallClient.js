// In-memory wall client for when the Supabase env vars are absent (the "Offline preview").
// It mirrors the database rules: one pending drawing per visitor (a new one withdraws the old),
// 5 drawings per visitor per hour, a 200-drawing queue, and moderator-only status changes.
// The tab is one visitor. signInWithEmail(any) makes that tab the moderator (mock only).
import { PNG_PREFIX, validateDrawingDataUrl } from '../lib/png.js'
import { WallError } from './errors.js'

const HOUR = 60 * 60 * 1000
const PER_HOUR = 5
const QUEUE_MAX = 200
const LIST_LIMIT = 60
const TRANSITIONS = new Map([
  ['pending', new Set(['approved', 'rejected'])],
  ['approved', new Set(['removed'])],
])

const iso = (ms) => new Date(ms).toISOString()

export function createMockWallClient({ now = () => Date.now() } = {}) {
  const rows = [] // {id, png, status, createdAt, decidedAt, seq}
  const listeners = new Set()
  let session = null
  let nextId = 1
  let seq = 0

  const isAdmin = () => Boolean(session?.isAdmin)
  const dataUrl = (row) => PNG_PREFIX + row.png
  const emit = (event) => {
    for (const cb of [...listeners]) cb(event)
  }

  return {
    mode: 'mock',

    async listApproved() {
      return rows
        .filter((r) => r.status === 'approved')
        .sort((a, b) => b.decidedAt - a.decidedAt || b.seq - a.seq)
        .slice(0, LIST_LIMIT)
        .map((r) => ({ id: r.id, dataUrl: dataUrl(r), decidedAt: iso(r.decidedAt) }))
    },

    async getMyPending() {
      if (isAdmin()) return null
      const mine = rows.find((r) => r.status === 'pending')
      return mine ? { id: mine.id, dataUrl: dataUrl(mine), createdAt: iso(mine.createdAt) } : null
    },

    /** submit(base64 | data URL) -> {id, createdAt}; throws WallError. */
    async submit(png) {
      const text = String(png ?? '')
      const v = validateDrawingDataUrl(text.startsWith(PNG_PREFIX) ? text : PNG_PREFIX + text)
      if (!v.ok) throw new WallError(v.code)
      const t = now()
      // Every row in this tab belongs to the one visitor.
      if (rows.filter((r) => r.createdAt > t - HOUR).length >= PER_HOUR) throw new WallError('rate_limited')
      if (rows.filter((r) => r.status === 'pending').length >= QUEUE_MAX) throw new WallError('queue_full')
      for (const r of rows) {
        if (r.status === 'pending') Object.assign(r, { status: 'withdrawn', decidedAt: t })
      }
      const row = { id: 'mock-' + nextId++, png: v.base64, status: 'pending', createdAt: t, decidedAt: null, seq: seq++ }
      rows.push(row)
      return { id: row.id, createdAt: iso(t) }
    },

    async getSession() {
      return session ? { ...session } : null
    },

    onAuthChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },

    async signInWithEmail(email) {
      session = { email: String(email), isAnonymous: false, isAdmin: true }
      emit('SIGNED_IN')
    },

    async signOut() {
      session = null
      emit('SIGNED_OUT')
    },

    async listPending() {
      if (!isAdmin()) return []
      return rows
        .filter((r) => r.status === 'pending')
        .sort((a, b) => b.createdAt - a.createdAt || b.seq - a.seq)
        .map((r) => ({ id: r.id, dataUrl: dataUrl(r), createdAt: iso(r.createdAt) }))
    },

    async setStatus(id, status) {
      if (!isAdmin()) throw new WallError('forbidden')
      const row = rows.find((r) => r.id === id)
      if (!row) throw new WallError('forbidden')
      if (!TRANSITIONS.get(row.status)?.has(status)) throw new WallError('bad_transition')
      Object.assign(row, { status, decidedAt: now(), seq: seq++ })
      return { id, status }
    },
  }
}
