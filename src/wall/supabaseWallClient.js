// Supabase wall client (D8/D9). The only module that imports @supabase/supabase-js; wallClient.js
// loads it with a dynamic import, so the SDK lands in its own chunk and loads only when the env
// vars are set and the wall is first needed. Rules live in the database (RLS + triggers):
// this client never decides who may moderate, it only asks.
import { createClient } from '@supabase/supabase-js'
import { PNG_PREFIX } from '../lib/png.js'
import { WallError, mapError } from './errors.js'

const LIST_LIMIT = 60
const QUEUE_LIMIT = 200

export function createSupabaseWallClient({ url, key, origin = globalThis.location?.origin ?? '' }) {
  const sb = createClient(url, key, {
    auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' },
  })

  async function rawSession() {
    const { data, error } = await sb.auth.getSession()
    if (error) throw mapError(error)
    return data?.session ?? null
  }

  async function isAdmin(session) {
    if (!session || session.user?.is_anonymous) return false
    const { data, error } = await sb.rpc('is_admin')
    if (error) throw mapError(error)
    return data === true
  }

  async function run(query) {
    const { data, error } = await query
    if (error) throw mapError(error)
    return data
  }

  const toItem = (row) => ({ id: row.id, dataUrl: PNG_PREFIX + row.png, createdAt: row.created_at })

  return {
    mode: 'supabase',

    async listApproved() {
      const rows = await run(
        sb
          .from('drawings')
          .select('id,png,status,created_at,decided_at')
          .eq('status', 'approved')
          .order('decided_at', { ascending: false })
          .limit(LIST_LIMIT),
      )
      return (rows ?? []).map((r) => ({ id: r.id, dataUrl: PNG_PREFIX + r.png, decidedAt: r.decided_at }))
    },

    async getMyPending() {
      const session = await rawSession()
      if (!session || (await isAdmin(session))) return null
      // RLS shows a visitor only their own non-approved rows.
      const rows = await run(
        sb
          .from('drawings')
          .select('id,png,status,created_at')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1),
      )
      return rows?.[0] ? toItem(rows[0]) : null
    },

    /** submit(base64 without the data: prefix) -> {id, createdAt}; throws WallError. */
    async submit(png) {
      if (!(await rawSession())) {
        const { error } = await sb.auth.signInAnonymously()
        if (error) throw mapError(error)
      }
      const row = await run(sb.from('drawings').insert({ png }).select('id,status,created_at').single())
      if (!row) throw new WallError('network')
      return { id: row.id, createdAt: row.created_at }
    },

    async getSession() {
      const session = await rawSession()
      if (!session) return null
      const user = session.user ?? {}
      return { email: user.email ?? null, isAnonymous: Boolean(user.is_anonymous), isAdmin: await isAdmin(session) }
    },

    onAuthChange(cb) {
      // supabase-js runs this callback under its auth lock: defer, so cb may call back into the client.
      const { data } = sb.auth.onAuthStateChange((event) => {
        setTimeout(() => cb(event), 0)
      })
      return () => data?.subscription?.unsubscribe()
    },

    async signInWithEmail(email) {
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: origin + '/?mod' },
      })
      if (error) throw mapError(error)
    },

    async signOut() {
      const { error } = await sb.auth.signOut()
      if (error) throw mapError(error)
    },

    async listPending() {
      const rows = await run(
        sb
          .from('drawings')
          .select('id,png,status,created_at')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(QUEUE_LIMIT),
      )
      return (rows ?? []).map(toItem)
    },

    async setStatus(id, status) {
      const { data, error } = await sb.from('drawings').update({ status }).eq('id', id).select('id,status').single()
      // No row back means RLS hid it from this user: not a moderator.
      if (error?.code === 'PGRST116') throw new WallError('forbidden', error)
      if (error) throw mapError(error)
      if (!data) throw new WallError('forbidden')
      return data
    },
  }
}
