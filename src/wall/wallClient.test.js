// Chooses the wall client from the env. Only both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
// select Supabase; anything less uses the mock. The Supabase module is mocked here.
import { describe, it, expect, vi } from 'vitest'
import { createWallClient } from './wallClient.js'

vi.mock('./supabaseWallClient.js', () => ({
  createSupabaseWallClient: (opts) => ({ mode: 'supabase', opts }),
}))

describe('createWallClient', () => {
  it('with no env vars, uses the mock', async () => {
    const client = await createWallClient({})
    expect(client.mode).toBe('mock')
  })

  it('with empty env vars, uses the mock', async () => {
    const client = await createWallClient({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' })
    expect(client.mode).toBe('mock')
  })

  it('with both env vars, loads the Supabase client with them', async () => {
    const client = await createWallClient({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'anon-key',
    })
    expect(client.mode).toBe('supabase')
    expect(client.opts).toMatchObject({ url: 'https://example.supabase.co', key: 'anon-key' })
  })

  it('with only the URL, uses the mock', async () => {
    const client = await createWallClient({ VITE_SUPABASE_URL: 'https://example.supabase.co' })
    expect(client.mode).toBe('mock')
  })

  it('with only the anon key, uses the mock', async () => {
    const client = await createWallClient({ VITE_SUPABASE_ANON_KEY: 'anon-key' })
    expect(client.mode).toBe('mock')
  })
})
