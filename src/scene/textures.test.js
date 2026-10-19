// Phase 7 TEST LIST: scene/textures.test.js. Draw functions take (ctx, w, h, …) and are tested
// against the recording 2D context from src/test/fakeCanvas.js (ctx.calls, ctx.sets).
import { describe, it, expect } from 'vitest'
import * as textures from './textures.js'
import { drawMirror, drawMugLabel } from './textures.js'

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

// Round 2 Phase 4 TEST LIST 3 (R16, McGill mug label). The recording context's measureText is
// replaced by one whose width is text length · font px · 0.5, so the shrink loop is exact.
describe('scene/textures drawMugLabel', () => {
  function mugCtx() {
    const ctx = ctx2d()
    const measured = []
    ctx.measureText = (text) => {
      const px = Number(/(\d+)px/.exec(String(ctx.font))[1])
      const width = String(text).length * px * 0.5
      measured.push({ text, width })
      return { width }
    }
    return { ctx, measured }
  }

  it('fills the whole 1024 × 400 label with McGill red #ED1B2F first', () => {
    const { ctx } = mugCtx()
    drawMugLabel(ctx, 1024, 400)
    expect(ctx.sets).toContainEqual(['fillStyle', '#ED1B2F'])
    expect(calls(ctx, 'fillRect')[0]).toEqual(['fillRect', 0, 0, 1024, 400])
  })

  it('writes exactly one "McGill" in white, centred at (w/2, h/2) = (512, 200)', () => {
    const { ctx } = mugCtx()
    drawMugLabel(ctx, 1024, 400)
    expect(calls(ctx, 'fillText')).toEqual([['fillText', 'McGill', 512, 200]])
    const lastFill = ctx.sets.filter((s) => s[0] === 'fillStyle').at(-1)
    expect(lastFill).toEqual(['fillStyle', '#FFFFFF'])
    expect(ctx.sets).toContainEqual(['textAlign', 'center'])
    expect(ctx.sets).toContainEqual(['textBaseline', 'middle'])
  })

  it('uses a 500 weight in "EB Garamond" with Garamond and serif fallbacks', () => {
    const { ctx } = mugCtx()
    drawMugLabel(ctx, 1024, 400)
    const font = ctx.sets.filter((s) => s[0] === 'font').at(-1)[1]
    expect(font).toMatch(/^500 \d+px "EB Garamond", Garamond, "Times New Roman", serif$/)
  })

  it('shrinks from 150 px by 2 px until McGill is at most 30 % of the width: it stops at 102 px (306 ≤ 307.2 < 312)', () => {
    const { ctx, measured } = mugCtx()
    drawMugLabel(ctx, 1024, 400)
    const last = measured.at(-1)
    expect(last.text).toBe('McGill')
    expect(last.width).toBeLessThanOrEqual(0.3 * 1024)
    expect(measured.at(-2).width).toBeGreaterThan(0.3 * 1024)
    const font = ctx.sets.filter((s) => s[0] === 'font').at(-1)[1]
    expect(font).toMatch(/^500 102px /)
  })
})
