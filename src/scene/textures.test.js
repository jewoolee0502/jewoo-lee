// Phase 7 TEST LIST: scene/textures.test.js. Draw functions take (ctx, w, h, …) and are tested
// against the recording 2D context from src/test/fakeCanvas.js (ctx.calls, ctx.sets).
import { describe, it, expect } from 'vitest'
import * as textures from './textures.js'
import { drawMirror } from './textures.js'

const ctx2d = () => document.createElement('canvas').getContext('2d')
const calls = (ctx, name) => ctx.calls.filter((c) => c[0] === name)

describe('scene/textures', () => {
  it('drawCork and CORK_SLOTS are gone with the corkboard', () => {
    expect(textures).not.toHaveProperty('drawCork')
    expect(textures).not.toHaveProperty('CORK_SLOTS')
    expect(textures).not.toHaveProperty('PINS')
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
