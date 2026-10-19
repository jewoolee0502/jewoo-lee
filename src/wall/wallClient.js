// Picks the wall backend. Supabase only when BOTH env vars are set (loaded lazily, its own chunk);
// otherwise the in-tab mock, so the site works with no backend at all.
import { createMockWallClient } from './mockWallClient.js'

export async function createWallClient(env = import.meta.env) {
  const url = env?.VITE_SUPABASE_URL
  const key = env?.VITE_SUPABASE_ANON_KEY
  if (url && key) {
    const { createSupabaseWallClient } = await import('./supabaseWallClient.js')
    return createSupabaseWallClient({ url, key, origin: globalThis.location?.origin })
  }
  return createMockWallClient()
}
