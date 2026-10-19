// Supabase wall client against the fake @supabase/supabase-js (no network). The client
// receives base64 PNG strings and returns data URLs, as in mockWallClient.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resetFakeSupabase } from '../test/fakeSupabase.js'
import { createSupabaseWallClient } from './supabaseWallClient.js'
import { WallError } from './errors.js'

vi.mock('@supabase/supabase-js', async () => {
  const mod = await import('../test/fakeSupabase.js')
  return { createClient: (...args) => mod.createClient(...args) }
})

const URL_ = 'https://example.supabase.co'
const KEY = 'anon-key'
const ORIGIN = 'http://localhost:3000'
const BASE64 = 'QUJD'

let fake
let client

beforeEach(() => {
  fake = resetFakeSupabase()
  client = createSupabaseWallClient({ url: URL_, key: KEY, origin: ORIGIN })
})

describe('supabase wall client', () => {
  it('creates the client with PKCE auth options and persisted sessions', () => {
    expect(fake.createArgs).toHaveLength(1)
    expect(fake.createArgs[0]).toEqual({
      url: URL_,
      key: KEY,
      options: { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' } },
    })
  })

  it('listApproved queries the approved rows newest decision first, limit 60, and maps png to a data URL', async () => {
    fake.queue({
      data: [
        {
          id: 'd1',
          png: BASE64,
          status: 'approved',
          created_at: '2026-10-01T00:00:00Z',
          decided_at: '2026-10-02T00:00:00Z',
        },
      ],
      error: null,
    })
    const list = await client.listApproved()
    expect(fake.queries()).toEqual([
      [
        ['from', 'drawings'],
        ['select', 'id,png,status,created_at,decided_at'],
        ['eq', 'status', 'approved'],
        ['order', 'decided_at', { ascending: false }],
        ['limit', 60],
      ],
    ])
    expect(list).toEqual([{ id: 'd1', dataUrl: 'data:image/png;base64,QUJD', decidedAt: '2026-10-02T00:00:00Z' }])
  })

  it('submit with no session signs in anonymously once, then inserts the png', async () => {
    fake.queue({ data: { id: 'd9', status: 'pending', created_at: '2026-10-18T10:00:00Z' }, error: null })
    const result = await client.submit(BASE64)
    expect(fake.authCalls('signInAnonymously')).toHaveLength(1)
    expect(fake.queries()).toEqual([
      [
        ['from', 'drawings'],
        ['insert', { png: BASE64 }],
        ['select', 'id,status,created_at'],
        ['single'],
      ],
    ])
    expect(result).toEqual({ id: 'd9', createdAt: '2026-10-18T10:00:00Z' })
  })

  it('submit with a session does not sign in', async () => {
    fake.state.session = { user: { id: 'u1', email: null, is_anonymous: true } }
    fake.queue({ data: { id: 'd9', status: 'pending', created_at: '2026-10-18T10:00:00Z' }, error: null })
    await client.submit(BASE64)
    expect(fake.authCalls('signInAnonymously')).toHaveLength(0)
  })

  it('an insert error with message rate_limited throws WallError rate_limited', async () => {
    fake.state.session = { user: { id: 'u1', email: null, is_anonymous: true } }
    fake.queue({ data: null, error: { message: 'rate_limited', code: 'P0001' } })
    const err = await client.submit(BASE64).catch((e) => e)
    expect(err).toBeInstanceOf(WallError)
    expect(err.code).toBe('rate_limited')
  })

  it('a Postgres check violation (23514) maps to bad_png', async () => {
    fake.state.session = { user: { id: 'u1', email: null, is_anonymous: true } }
    fake.queue({ data: null, error: { message: 'new row violates check constraint "png_magic"', code: '23514' } })
    await expect(client.submit(BASE64)).rejects.toMatchObject({ code: 'bad_png' })
  })

  it('any other error maps to network', async () => {
    fake.state.session = { user: { id: 'u1', email: null, is_anonymous: true } }
    fake.queue({ data: null, error: { message: 'Failed to fetch', code: '' } })
    await expect(client.submit(BASE64)).rejects.toMatchObject({ code: 'network' })
  })

  it('signInWithEmail sends a magic link for existing users only, back to /?mod on this origin', async () => {
    await client.signInWithEmail('j@x')
    expect(fake.authCalls('signInWithOtp')).toEqual([
      {
        kind: 'auth',
        name: 'signInWithOtp',
        args: [
          {
            email: 'j@x',
            options: { shouldCreateUser: false, emailRedirectTo: 'http://localhost:3000/?mod' },
          },
        ],
      },
    ])
  })

  it('getSession reports isAdmin from rpc is_admin', async () => {
    expect(await client.getSession()).toBeNull()
    fake.state.session = { user: { id: 'j1', email: 'j@x', is_anonymous: false } }
    fake.rpcResults.is_admin = { data: true, error: null }
    expect(await client.getSession()).toEqual({ email: 'j@x', isAnonymous: false, isAdmin: true })
    expect(fake.log.some((e) => e.kind === 'rpc' && e.name === 'is_admin')).toBe(true)
  })

  it('setStatus that returns no row throws forbidden', async () => {
    fake.state.session = { user: { id: 'j1', email: 'j@x', is_anonymous: false } }
    fake.queue({ data: null, error: null })
    await expect(client.setStatus('d1', 'approved')).rejects.toMatchObject({ code: 'forbidden' })
    expect(fake.queries()).toEqual([
      [
        ['from', 'drawings'],
        ['update', { status: 'approved' }],
        ['eq', 'id', 'd1'],
        ['select', 'id,status'],
        ['single'],
      ],
    ])
  })
})
