// Wall store over the mock client: init, submit validation, the corkboard selector, and recovery.
import { describe, it, expect, vi } from 'vitest'
import { createWallStore, corkboardPngs, approvedCount } from './wallStore.js'
import { createMockWallClient } from './mockWallClient.js'
import { EXAMPLES } from './examples.js'
import { gridToPngDataUrl, encodeIndexedPng, bytesToBase64, PNG_PREFIX } from '../lib/png.js'

const PAL = ['#122030', '#E8452E', '#4AA6EE']
function drawingUrl(i = 0) {
  const grid = Array(576).fill(null)
  grid[i] = PAL[i % PAL.length]
  return gridToPngDataUrl(grid, 24, PAL)
}
const HOUR = 60 * 60 * 1000

function makeStore(client) {
  const toast = vi.fn()
  const wall = createWallStore({ clientFactory: () => client, toast })
  return { wall, toast }
}

// Statuses in order with consecutive repeats removed.
const collapse = (xs) => xs.filter((x, i) => i === 0 || x !== xs[i - 1])

describe('wall store', () => {
  it('ensureInit twice creates the client once', async () => {
    const client = createMockWallClient({ now: () => 0 })
    const factory = vi.fn(() => client)
    const wall = createWallStore({ clientFactory: factory, toast: vi.fn() })
    await wall.ensureInit()
    await wall.ensureInit()
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('status goes idle, loading, ready', async () => {
    const client = createMockWallClient({ now: () => 0 })
    const { wall } = makeStore(client)
    expect(wall.store.get().status).toBe('idle')
    const seen = []
    wall.store.subscribe((s) => seen.push(s.status))
    await wall.ensureInit()
    expect(collapse(seen)).toEqual(['loading', 'ready'])
    expect(wall.store.get().status).toBe('ready')
  })

  it('submit with an invalid drawing returns bad_png and never calls the client', async () => {
    const client = createMockWallClient({ now: () => 0 })
    const { wall } = makeStore(client)
    await wall.ensureInit()
    const spy = vi.spyOn(client, 'submit')
    await expect(wall.submit('bad')).resolves.toEqual({ ok: false, code: 'bad_png' })
    expect(spy).not.toHaveBeenCalled()
  })

  it('submit with a 12×12 drawing returns bad_size and never calls the client', async () => {
    const client = createMockWallClient({ now: () => 0 })
    const { wall } = makeStore(client)
    await wall.ensureInit()
    const spy = vi.spyOn(client, 'submit')
    const small = bytesToBase64(encodeIndexedPng({ width: 12, height: 12, indices: new Uint8Array(144), palette: [[0, 0, 0]] }))
    await expect(wall.submit(PNG_PREFIX + small)).resolves.toEqual({ ok: false, code: 'bad_size' })
    expect(spy).not.toHaveBeenCalled()
  })

  it('a valid submit sets myPending', async () => {
    const client = createMockWallClient({ now: () => 0 })
    const { wall } = makeStore(client)
    await wall.ensureInit()
    const url = drawingUrl(0)
    await expect(wall.submit(url)).resolves.toMatchObject({ ok: true })
    expect(wall.store.get().myPending).toMatchObject({ dataUrl: url })
  })

  it('corkboardPngs: 0 approved gives the 3 examples; 8 approved gives the 6 newest, newest first', async () => {
    const c = { now: 1_000_000 }
    const client = createMockWallClient({ now: () => c.now })
    const { wall } = makeStore(client)
    await wall.ensureInit()
    expect(corkboardPngs(wall.store.get())).toEqual(EXAMPLES)

    for (let i = 0; i < 8; i++) {
      c.now += HOUR // keeps each visitor under the hourly limit
      await wall.submit(drawingUrl(i))
      await wall.signIn('jay@example.com')
      await wall.approve(wall.store.get().pending[0].id)
      await wall.signOut()
    }
    const state = wall.store.get()
    expect(state.approved).toHaveLength(8)
    expect(corkboardPngs(state)).toEqual([7, 6, 5, 4, 3, 2].map((i) => drawingUrl(i)))
  })

  it('when listing throws, status is error, and refresh recovers', async () => {
    const client = createMockWallClient({ now: () => 0 })
    const realList = client.listApproved.bind(client)
    let failing = true
    client.listApproved = async () => {
      if (failing) throw new Error('offline')
      return realList()
    }
    const { wall } = makeStore(client)
    await wall.ensureInit()
    expect(wall.store.get().status).toBe('error')
    failing = false
    await wall.refresh()
    expect(wall.store.get().status).toBe('ready')
  })
})

describe('approvedCount (the caption count, not the example count)', () => {
  it('is 0 while only the examples are shown', () => {
    expect(approvedCount({ approved: [] })).toBe(0)
  })

  it('counts every approved drawing, including those past the 6 on the corkboard', () => {
    const approved = Array.from({ length: 8 }, (_, i) => ({ id: `d${i}`, dataUrl: drawingUrl(i), decidedAt: i }))
    expect(approvedCount({ approved })).toBe(8)
    expect(corkboardPngs({ approved })).toHaveLength(6)
  })
})
