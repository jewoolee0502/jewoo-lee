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

  // Round 4 R4-1: the mirror is 640 × 416 (the 1040 × 676 OS at k = 640/1040 = 0.61538).
  it('drawMirror in standby records JAY-OS and "waking up …" centred on the 640 px mirror', () => {
    const ctx = ctx2d()
    drawMirror(ctx, 640, 416, 'standby', undefined)
    const texts = calls(ctx, 'fillText').map((c) => c[1])
    expect(texts).toContain('JAY-OS')
    expect(texts).toContain('waking up …')
    expect(calls(ctx, 'fillText').find((c) => c[1] === 'waking up …')[2]).toBe(320)
  })

  // Centre-relative: logo at (OS_H/2 − 0.5) = 337.5 OS px and blink text at (OS_H/2 + 60.5) = 398.5,
  // scaled by 416/676 and rounded: 208 and 245. At native size they round to 338 and 399.
  it('drawMirror in standby puts the logo at y 208 and "waking up" at y 245 (337.5 and 398.5 OS px)', () => {
    const ctx = ctx2d()
    drawMirror(ctx, 640, 416, 'standby', undefined)
    const logo = calls(ctx, 'fillText').find((c) => c[1] === 'JAY-OS')
    const wake = calls(ctx, 'fillText').find((c) => c[1] === 'waking up …')
    expect(logo.slice(2)).toEqual([320, 208])
    expect(wake.slice(2)).toEqual([320, 245])
  })

  it('drawMirror in standby at native 1040 × 676 rounds the baselines to 338 and 399', () => {
    const ctx = ctx2d()
    drawMirror(ctx, 1040, 676, 'standby', undefined)
    const logo = calls(ctx, 'fillText').find((c) => c[1] === 'JAY-OS')
    const wake = calls(ctx, 'fillText').find((c) => c[1] === 'waking up …')
    expect(logo[3]).toBe(338)
    expect(wake[3]).toBe(399)
  })

  it('drawMirror in standby sets the logo to 39 px and "waking up" to 21 px (round(64k), round(34k))', () => {
    const ctx = ctx2d()
    drawMirror(ctx, 640, 416, 'standby', undefined)
    const fonts = ctx.sets.filter((s) => s[0] === 'font').map((s) => s[1])
    expect(fonts.some((f) => /^39px /.test(f))).toBe(true)
    expect(fonts.some((f) => /^21px /.test(f))).toBe(true)
  })

  it('drawMirror in boot records the three BIOS lines at x=21, y=32/50/69 in a 15 px font', () => {
    const ctx = ctx2d()
    drawMirror(ctx, 640, 416, 'boot', undefined)
    expect(calls(ctx, 'fillText')).toEqual([
      ['fillText', 'JAY-BIOS (C) 2001-2026', 21, 32],
      ['fillText', 'Memory test ... OK', 21, 50],
      ['fillText', 'Loading JAY-OS ...', 21, 69],
    ])
    const fonts = ctx.sets.filter((s) => s[0] === 'font').map((s) => s[1])
    expect(fonts.some((f) => /^15px /.test(f))).toBe(true)
  })

  it('drawMirror in on draws the passed wallpaper canvas across 640 × 416 first', () => {
    const ctx = ctx2d()
    const engine = document.createElement('canvas')
    drawMirror(ctx, 640, 416, 'on', engine)
    expect(ctx.calls[0]).toEqual(['drawImage', engine, 0, 0, 640, 416])
  })

  it('drawMirror in on paints a 21 px menubar (round(34k)) with the title at (10, 13) in an 8 px font', () => {
    const ctx = ctx2d()
    drawMirror(ctx, 640, 416, 'on', undefined)
    expect(calls(ctx, 'fillRect')).toContainEqual(['fillRect', 0, 0, 640, 21])
    expect(calls(ctx, 'fillText')).toContainEqual(['fillText', '◆ JAY-OS', 10, 13])
    const fonts = ctx.sets.filter((s) => s[0] === 'font').map((s) => s[1])
    expect(fonts.some((f) => /^8px /.test(f))).toBe(true)
  })

  it('drawMirror in on with no engine canvas fills the desktop blue #3D98DD and draws no picture', () => {
    const ctx = ctx2d()
    drawMirror(ctx, 640, 416, 'on', undefined)
    expect(ctx.sets).toContainEqual(['fillStyle', '#3D98DD'])
    expect(calls(ctx, 'drawImage')).toHaveLength(0)
  })

  it('drawMirror in off only fills black (#030508) over the whole 640 × 416 mirror', () => {
    const ctx = ctx2d()
    drawMirror(ctx, 640, 416, 'off', undefined)
    expect(ctx.sets).toContainEqual(['fillStyle', '#030508'])
    expect(calls(ctx, 'fillRect')).toEqual([['fillRect', 0, 0, 640, 416]])
  })

  // R4-1: every state ends with the two top-corner masks of radius round(10 · 640/1040) = 6, so the
  // mirror matches the rounded DOM screen. The masks are arcTo paths drawn after all the content.
  it.each(['standby', 'boot', 'on', 'off'])('%s ends with the top-corner masks: arcTo radius 6, drawn last', (state) => {
    const ctx = ctx2d()
    drawMirror(ctx, 640, 416, state, undefined)
    const arcs = calls(ctx, 'arcTo')
    expect(arcs.length).toBeGreaterThanOrEqual(2)
    for (const c of arcs) expect(c[5]).toBe(6)
    const lastArc = ctx.calls.findLastIndex((c) => c[0] === 'arcTo')
    const lastPaint = ctx.calls.findLastIndex((c) => ['fillText', 'fillRect', 'drawImage'].includes(c[0]))
    expect(lastArc).toBeGreaterThan(lastPaint)
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
