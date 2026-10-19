// Scene hotspots (L1192–1205): label -> action. `local` holds the scene-side effects
// {swingTags, insertFloppy(i), hopMug, toggleLamp, boostSnow(s)}; the rest goes through `app`.
import { FLOPPIES } from './floppy.js'

/** Walks up from a raycast hit to the first object carrying `userData.hot`; returns that data. */
export function hotspotOf(obj) {
  for (let o = obj; o; o = o.parent) if (o.userData?.hot) return o.userData.hot
  return null
}

export function createHotspotActions({ app, local }) {
  const enter = () => app.ctrl.enter()
  const open = (id, opts) => (opts ? app.os.openApp(id, opts) : app.os.openApp(id))
  const toast = (...args) => app.toasts.toast(...args)

  const actions = new Map([
    [
      'Laptop · open me',
      () => {
        app.os.boot()
        enter()
      },
    ],
    [
      'Power button',
      () => {
        if (app.os.state === 'on') app.os.shutdown()
        else {
          app.os.boot()
          enter()
        }
      },
    ],
  ])
  FLOPPIES.forEach((f, i) => actions.set('Floppy · ' + f.label, () => local.insertFloppy(i)))
  actions.set('Dog tags', () => {
    local.swingTags()
    app.ach.unlock('tags')
    toast('한번 해병은 영원한 해병', 'Once a Marine, always a Marine. Opening Service.txt.', 'info')
    enter()
    open('service')
  })
  actions.set('McGill mug', () => {
    local.hopMug()
    toast('McGill mug', 'Refilled. Productivity +10%.', 'info')
    app.snd.tone(300, 0.1, 'sine', 0.06)
  })
  actions.set('Desk lamp', () => local.toggleLamp())
  actions.set('Polaroid', () => {
    enter()
    open('about')
  })
  // The prototype ran `help` 100 ms after opening; the terminal takes it as an open option.
  actions.set('Sticky note', () => {
    enter()
    open('term', { cmd: 'help' })
  })
  actions.set('Keyboard', () => {
    enter()
    open('term')
  })
  actions.set('Window', () => {
    local.boostSnow(8)
    toast('Montréal', 'It’s snowing. Obviously.', 'info')
  })
  return actions
}
