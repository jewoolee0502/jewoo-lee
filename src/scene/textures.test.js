// Phase 7 TEST LIST: scene/textures.test.js. Draw functions take (ctx, w, h, …) and are tested
// against the recording 2D context from src/test/fakeCanvas.js (ctx.calls, ctx.sets).
import { describe, it, expect } from 'vitest'
import { drawCork, drawMirror } from './textures.js'

const ctx2d = () => document.createElement('canvas').getContext('2d')
const calls = (ctx, name) => ctx.calls.filter((c) => c[0] === name)

describe('scene/textures', () => {
  it('drawCork with no images records the title, the hint and 6 dashed empty slots', () => {
    const ctx = ctx2d()
    drawCork(ctx, 512, 350, [])
    expect(calls(ctx, 'fillText')).toContainEqual(['fillText', 'VISITOR WALL', 258, 34])
    expect(calls(ctx, 'fillText')).toContainEqual(['fillText', 'your drawing here?', 258, 334])
    expect(calls(ctx, 'strokeRect')).toHaveLength(6)
    for (const c of calls(ctx, 'strokeRect')) expect(c).toEqual(['strokeRect', -34, -34, 68, 68])
    expect(calls(ctx, 'drawImage')).toHaveLength(0)
  })

  it('drawCork lays the 6 slots out at the prototype positions (L1101–1106)', () => {
    const ctx = ctx2d()
    drawCork(ctx, 512, 350, [])
    const slots = calls(ctx, 'translate').map((c) => [c[1], c[2]])
    expect(slots).toEqual([
      [290, 96],
      [378, 96],
      [466, 96],
      [290, 204],
      [378, 204],
      [466, 204],
    ])
  })

  it('drawCork with 2 approved images draws 2 pictures in slots 0 and 1 and the count caption', () => {
    const ctx = ctx2d()
    const a = document.createElement('canvas')
    const b = document.createElement('canvas')
    drawCork(ctx, 512, 350, [a, b], 2)
    const pics = calls(ctx, 'drawImage')
    expect(pics).toHaveLength(2)
    expect(pics[0]).toEqual(['drawImage', a, -33, -33, 66, 66])
    expect(pics[1]).toEqual(['drawImage', b, -33, -33, 66, 66])
    expect(calls(ctx, 'strokeRect')).toHaveLength(4)
    expect(calls(ctx, 'fillText')).toContainEqual(['fillText', '2 pinned by visitors', 258, 334])
  })

  it('drawCork with 3 example images and approvedCount 0 writes "your drawing here?" and never the pinned count', () => {
    const ctx = ctx2d()
    const examples = [document.createElement('canvas'), document.createElement('canvas'), document.createElement('canvas')]
    drawCork(ctx, 512, 350, examples, 0)
    const texts = calls(ctx, 'fillText').map((c) => c[1])
    expect(texts).toContain('your drawing here?')
    expect(texts).not.toContain('3 pinned by visitors')
    expect(texts.some((t) => t.includes('pinned by visitors'))).toBe(false)
    expect(calls(ctx, 'fillText')).toContainEqual(['fillText', 'your drawing here?', 258, 334])
  })

  it('drawCork with 2 approved images and approvedCount 2 writes "2 pinned by visitors"', () => {
    const ctx = ctx2d()
    drawCork(ctx, 512, 350, [document.createElement('canvas'), document.createElement('canvas')], 2)
    const texts = calls(ctx, 'fillText').map((c) => c[1])
    expect(texts).toContain('2 pinned by visitors')
    expect(texts).not.toContain('your drawing here?')
  })

  it('drawMirror in standby records JAY-OS and "waking up …" centred on the screen', () => {
    const ctx = ctx2d()
    drawMirror(ctx, 512, 384, 'standby', undefined)
    const texts = calls(ctx, 'fillText').map((c) => c[1])
    expect(texts).toContain('JAY-OS')
    expect(texts).toContain('waking up …')
    expect(calls(ctx, 'fillText').find((c) => c[1] === 'waking up …')[2]).toBe(256)
  })

  it('drawMirror in boot records the three BIOS lines at x=20, y=36/60/84', () => {
    const ctx = ctx2d()
    drawMirror(ctx, 512, 384, 'boot', undefined)
    expect(calls(ctx, 'fillText')).toEqual([
      ['fillText', 'JAY-BIOS (C) 2001-2026', 20, 36],
      ['fillText', 'Memory test ... OK', 20, 60],
      ['fillText', 'Loading JAY-OS ...', 20, 84],
    ])
  })

  it('drawMirror in on draws the passed wallpaper canvas first', () => {
    const ctx = ctx2d()
    const engine = document.createElement('canvas')
    drawMirror(ctx, 512, 384, 'on', engine)
    expect(ctx.calls[0]).toEqual(['drawImage', engine, 0, 0, 512, 384])
    expect(calls(ctx, 'fillText')).toContainEqual(['fillText', '◆ JAY-OS', 8, 13])
  })

  it('drawMirror in on with no engine canvas fills the desktop blue #3D98DD and draws no picture', () => {
    const ctx = ctx2d()
    drawMirror(ctx, 512, 384, 'on', undefined)
    expect(ctx.sets).toContainEqual(['fillStyle', '#3D98DD'])
    expect(calls(ctx, 'drawImage')).toHaveLength(0)
  })

  it('drawMirror in off only fills black (#030508)', () => {
    const ctx = ctx2d()
    drawMirror(ctx, 512, 384, 'off', undefined)
    expect(ctx.sets).toContainEqual(['fillStyle', '#030508'])
    expect(ctx.calls).toEqual([['fillRect', 0, 0, 512, 384]])
  })
})
