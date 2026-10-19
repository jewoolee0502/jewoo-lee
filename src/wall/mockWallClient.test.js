// Mock wall client (in memory, one tab). Methods take base64 PNG strings (no data: prefix)
// and return data URLs. `now` is injected so the hourly limit can be tested.
import { describe, it, expect } from 'vitest'
import { createMockWallClient } from './mockWallClient.js'
import { WallError } from './errors.js'
import { gridToPngDataUrl, PNG_PREFIX } from '../lib/png.js'

const PAL = ['#122030', '#E8452E', '#4AA6EE']
function drawingUrl(i = 0) {
  const grid = Array(576).fill(null)
  grid[i] = PAL[i % PAL.length]
  return gridToPngDataUrl(grid, 24, PAL)
}
const b64 = (i) => drawingUrl(i).slice(PNG_PREFIX.length)
const HOUR = 60 * 60 * 1000

function clock(start = 1_000_000) {
  let t = start
  return { now: () => t, advance: (ms) => (t += ms) }
}

describe('mock wall client', () => {
  it('submit then getMyPending returns that drawing', async () => {
    const mock = createMockWallClient({ now: clock().now })
    const sub = await mock.submit(b64(0))
    const mine = await mock.getMyPending()
    expect(mine).toMatchObject({ id: sub.id, dataUrl: drawingUrl(0) })
  })

  it('a second submit replaces the pending drawing, so there is one pending', async () => {
    const mock = createMockWallClient({ now: clock().now })
    await mock.submit(b64(0))
    const second = await mock.submit(b64(1))
    const mine = await mock.getMyPending()
    expect(mine.id).toBe(second.id)
    expect(mine.dataUrl).toBe(drawingUrl(1))
    await mock.signInWithEmail('jay@example.com')
    expect(await mock.listPending()).toHaveLength(1)
  })

  it('a 6th submit within an hour throws rate_limited; after one hour it is allowed', async () => {
    const c = clock()
    const mock = createMockWallClient({ now: c.now })
    for (let i = 0; i < 5; i++) await mock.submit(b64(i))
    await expect(mock.submit(b64(5))).rejects.toMatchObject({ code: 'rate_limited' })
    c.advance(HOUR)
    await expect(mock.submit(b64(5))).resolves.toBeTruthy()
  })

  it('an invalid drawing throws bad_png', async () => {
    const mock = createMockWallClient({ now: clock().now })
    await expect(mock.submit('data:image/png;base64,AAAA')).rejects.toBeInstanceOf(WallError)
    await expect(mock.submit('data:image/png;base64,AAAA')).rejects.toMatchObject({ code: 'bad_png' })
  })

  it('after signInWithEmail the session is admin; approve shows the drawing, remove takes it off', async () => {
    const mock = createMockWallClient({ now: clock().now })
    const sub = await mock.submit(b64(0))
    await mock.signInWithEmail('x@y')
    expect(await mock.getSession()).toMatchObject({ email: 'x@y', isAdmin: true })

    await mock.setStatus(sub.id, 'approved')
    const approved = await mock.listApproved()
    expect(approved[0]).toMatchObject({ id: sub.id, dataUrl: drawingUrl(0) })

    await mock.setStatus(sub.id, 'removed')
    expect(await mock.listApproved()).toHaveLength(0)
  })

  it('setStatus by a non-admin throws forbidden', async () => {
    const mock = createMockWallClient({ now: clock().now })
    const sub = await mock.submit(b64(0))
    await expect(mock.setStatus(sub.id, 'approved')).rejects.toMatchObject({ code: 'forbidden' })
  })
})
