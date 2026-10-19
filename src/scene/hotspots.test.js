// Phase 7 TEST LIST: scene/hotspots.test.js. Fakes for app and local; every label and action
// comes from the prototype hotspot table (L1194–1205).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHotspotActions, hotspotOf } from './hotspots.js'

const LABELS = [
  'Laptop · open me',
  'Power button',
  'Floppy · PROJECTS',
  'Floppy · GAMES',
  'Floppy · RESUME',
  'Dog tags',
  'McGill mug',
  'Desk lamp',
  'Polaroid',
  'Sticky note',
  'Keyboard',
  'Window',
]

function setup(state = 'standby') {
  const os = { state, boot: vi.fn(), shutdown: vi.fn(), openApp: vi.fn(() => null) }
  const ctrl = { enter: vi.fn() }
  const ach = { unlock: vi.fn() }
  const toasts = { toast: vi.fn() }
  const snd = { tone: vi.fn() }
  const local = {
    swingTags: vi.fn(),
    insertFloppy: vi.fn(),
    hopMug: vi.fn(),
    toggleLamp: vi.fn(),
    boostSnow: vi.fn(),
  }
  const app = { os, ctrl, ach, toasts, snd }
  const actions = createHotspotActions({ app, local })
  return { actions, os, ctrl, ach, toasts, snd, local }
}

describe('scene/hotspots', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('Laptop · open me calls os.boot and ctrl.enter', () => {
    const { actions, os, ctrl } = setup('standby')
    actions.get('Laptop · open me')()
    expect(os.boot).toHaveBeenCalled()
    expect(ctrl.enter).toHaveBeenCalled()
  })

  it('Power button with os on calls os.shutdown() with no arguments', () => {
    const { actions, os, ctrl } = setup('on')
    actions.get('Power button')()
    expect(os.shutdown).toHaveBeenCalledWith()
    expect(os.boot).not.toHaveBeenCalled()
    expect(ctrl.enter).not.toHaveBeenCalled()
  })

  it('Power button with os off calls os.boot and ctrl.enter', () => {
    const { actions, os, ctrl } = setup('off')
    actions.get('Power button')()
    expect(os.boot).toHaveBeenCalled()
    expect(ctrl.enter).toHaveBeenCalled()
    expect(os.shutdown).not.toHaveBeenCalled()
  })

  it('Dog tags calls local.swingTags, unlock(tags), the Marine toast, enter and openApp(service)', () => {
    const { actions, os, ctrl, ach, toasts, local } = setup()
    actions.get('Dog tags')()
    expect(local.swingTags).toHaveBeenCalled()
    expect(ach.unlock).toHaveBeenCalledWith('tags')
    expect(toasts.toast).toHaveBeenCalledWith(
      '한번 해병은 영원한 해병',
      'Once a Marine, always a Marine. Opening Service.txt.',
      'info',
    )
    expect(ctrl.enter).toHaveBeenCalled()
    expect(os.openApp).toHaveBeenCalledWith('service')
  })

  it('McGill mug calls local.hopMug, the refill toast, and snd.tone(300,.1,"sine",.06)', () => {
    const { actions, toasts, snd, local } = setup()
    actions.get('McGill mug')()
    expect(local.hopMug).toHaveBeenCalled()
    expect(toasts.toast).toHaveBeenCalledWith('McGill mug', 'Refilled. Productivity +10%.', 'info')
    expect(snd.tone).toHaveBeenCalledWith(300, 0.1, 'sine', 0.06)
  })

  it('Desk lamp calls local.toggleLamp', () => {
    const { actions, local } = setup()
    actions.get('Desk lamp')()
    expect(local.toggleLamp).toHaveBeenCalled()
  })

  it('there is no Visitor wall hotspot any more (the corkboard is gone)', () => {
    const { actions, os, ctrl } = setup()
    expect(actions.get('Visitor wall')).toBeUndefined()
    expect(actions.has('Visitor wall')).toBe(false)
    expect(os.openApp).not.toHaveBeenCalledWith('wall')
    expect(ctrl.enter).not.toHaveBeenCalled()
  })

  it('Polaroid zooms in (ctrl.enter) and opens about (L1201)', () => {
    const { actions, os, ctrl } = setup()
    actions.get('Polaroid')()
    expect(ctrl.enter).toHaveBeenCalled()
    expect(os.openApp).toHaveBeenCalledWith('about')
  })

  it('Sticky note calls ctrl.enter and openApp(term, {cmd:"help"})', () => {
    const { actions, os, ctrl } = setup()
    actions.get('Sticky note')()
    expect(ctrl.enter).toHaveBeenCalled()
    expect(os.openApp).toHaveBeenCalledWith('term', { cmd: 'help' })
  })

  it('Keyboard zooms in and opens the terminal (L1203)', () => {
    const { actions, os, ctrl } = setup()
    actions.get('Keyboard')()
    expect(ctrl.enter).toHaveBeenCalled()
    expect(os.openApp).toHaveBeenCalledWith('term')
  })

  it('Window calls local.boostSnow(8) and the snow toast with the curly apostrophe', () => {
    const { actions, toasts, local } = setup()
    actions.get('Window')()
    expect(local.boostSnow).toHaveBeenCalledWith(8)
    expect(toasts.toast).toHaveBeenCalledWith('Montréal', 'It’s snowing. Obviously.', 'info')
  })

  it('Floppy · PROJECTS calls local.insertFloppy(0)', () => {
    const { actions, local } = setup()
    actions.get('Floppy · PROJECTS')()
    expect(local.insertFloppy).toHaveBeenCalledWith(0)
  })

  it('the labels are the 12 hotspot labels left after the Visitor wall is removed (three floppies)', () => {
    const { actions } = setup()
    expect([...actions.keys()].sort()).toEqual([...LABELS].sort())
    expect(actions.size).toBe(12)
  })

  it('hotspotOf(hit) walks up the parents to the first object with userData.hot, or null', () => {
    const hot = { label: 'Desk lamp', fn: vi.fn() }
    const group = { parent: null, userData: { hot } }
    const mesh = { parent: group, userData: {} }
    const child = { parent: mesh, userData: {} }
    expect(hotspotOf(child)).toBe(hot)
    expect(hotspotOf(mesh)).toBe(hot)
    expect(hotspotOf({ parent: null, userData: {} })).toBeNull()
  })
})
