// Visitor Wall store (Phase 6): one per app. Nothing touches the backend until ensureInit()
// (the scene becoming ready, the Visitor Wall app mounting, `?mod` in the URL, or a first pin).
// The moderator view depends only on `isAdmin`, which comes from the server (or the mock sign-in).
import { createStore } from '../core/store.js'
import { validateDrawingDataUrl } from '../lib/png.js'
import { EXAMPLES } from './examples.js'
import { mapError } from './errors.js'
import { createWallClient } from './wallClient.js'

const INITIAL = {
  status: 'idle', // 'idle' | 'loading' | 'ready' | 'error'
  mode: null, // 'supabase' | 'mock'
  approved: [], // [{id, dataUrl, decidedAt}], newest decision first
  myPending: null, // {id, dataUrl, createdAt} | null
  pending: [], // moderator queue
  session: null, // {email, isAnonymous, isAdmin} | null
  isAdmin: false,
  signInSent: false,
}

const CORKBOARD_SLOTS = 6

/** The drawings on the 3D corkboard: the 6 newest approved, or the examples while none are. */
export function corkboardPngs(state) {
  return state.approved.length ? state.approved.slice(0, CORKBOARD_SLOTS).map((d) => d.dataUrl) : EXAMPLES
}

/** The corkboard caption count (D16): approved drawings only, never the examples. */
export const approvedCount = (state) => state.approved.length

export function createWallStore({ clientFactory = () => createWallClient(), toast = () => {} } = {}) {
  const store = createStore(INITIAL)
  let client = null
  let initPromise = null
  let unsubscribeAuth = null
  let running = null
  let queued = null

  async function load() {
    if (store.get().status !== 'ready') store.set({ status: 'loading' })
    try {
      const [approved, session] = await Promise.all([client.listApproved(), client.getSession()])
      const isAdmin = Boolean(session?.isAdmin)
      const [myPending, pending] = await Promise.all([
        isAdmin ? null : client.getMyPending(),
        isAdmin ? client.listPending() : [],
      ])
      store.set({ status: 'ready', approved, session, isAdmin, myPending, pending })
    } catch {
      store.set({ status: 'error' })
    }
  }

  /** Reloads everything. A call made while a load runs waits for one more load after it. */
  function refresh() {
    if (!client) return ensureInit()
    if (running) {
      queued ??= running.then(() => {
        queued = null
        return refresh()
      })
      return queued
    }
    running = load().finally(() => {
      running = null
    })
    return running
  }

  function ensureInit() {
    initPromise ??= (async () => {
      store.set({ status: 'loading' })
      try {
        client = await clientFactory()
      } catch {
        initPromise = null
        store.set({ status: 'error' })
        return
      }
      store.set({ mode: client.mode })
      unsubscribeAuth = client.onAuthChange?.(() => {
        refresh()
      })
      await refresh()
    })()
    return initPromise
  }

  async function submit(dataUrl) {
    const v = validateDrawingDataUrl(dataUrl)
    if (!v.ok) return { ok: false, code: v.code }
    await ensureInit()
    if (!client) return { ok: false, code: 'network' }
    try {
      const { id, createdAt } = await client.submit(v.base64)
      store.set({ myPending: { id, dataUrl, createdAt } })
      return { ok: true }
    } catch (e) {
      return { ok: false, code: mapError(e).code }
    }
  }

  async function decide(id, status) {
    if (!client) return { ok: false, code: 'network' }
    try {
      await client.setStatus(id, status)
      await refresh()
      return { ok: true }
    } catch (e) {
      const { code } = mapError(e)
      toast('Visitor Wall', 'Couldn’t update that drawing. Try again.', 'info')
      await refresh()
      return { ok: false, code }
    }
  }

  async function signIn(email) {
    await ensureInit()
    if (!client) return { ok: false, code: 'network' }
    try {
      await client.signInWithEmail(String(email).trim())
      store.set({ signInSent: true })
      await refresh()
      return { ok: true }
    } catch (e) {
      toast('Visitor Wall', 'Couldn’t send the sign-in link. Try again.', 'info')
      return { ok: false, code: mapError(e).code }
    }
  }

  async function signOut() {
    if (!client) return { ok: true }
    try {
      await client.signOut()
    } catch {
      // The local session is cleared even when the request fails.
    }
    store.set({ signInSent: false })
    await refresh()
    return { ok: true }
  }

  return {
    store,
    ensureInit,
    refresh,
    submit,
    approve: (id) => decide(id, 'approved'),
    reject: (id) => decide(id, 'rejected'),
    takeDown: (id) => decide(id, 'removed'),
    signIn,
    signOut,
    dispose() {
      unsubscribeAuth?.()
      unsubscribeAuth = null
    },
  }
}
