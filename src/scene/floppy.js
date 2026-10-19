// The three floppies (L1162) and the insert sequence (R14). Poses are plain {x,y,z} in rig
// coordinates; the injected `tween(obj, {p, r}, dur, done)` runs them on the scene's tween list.
export const FLOPPIES = [
  { label: 'PROJECTS', app: 'projects', col: 0x2f6fb0, hex: '#2F6FB0', home: [2.15, 0.016, 0.75, 0.3] },
  { label: 'GAMES', app: 'bugs', col: 0xe0602a, hex: '#E0602A', home: [2.32, 0.048, 1.08, -0.2] },
  { label: 'RESUME', app: 'resume', col: 0x2a2f36, hex: '#2A2F36', home: [2.08, 0.08, 1.4, 0.6] },
]

// The lane runs in front of the laptop (its front face is at rig z 1.4) above the floppy pile.
// The slot is at x 0.95 and the drive's height; seated, 0.05 of the 0.52-deep floppy sticks out.
// SLIDE_X is clear of the whole pile (its x reaches 2.32, plus a floppy's width and some room for
// the turned ones), so a floppy can rise or drop there without touching another.
export const LANE_Y = 0.13
export const LANE_Z = 1.75
export const SLIDE_X = 2.9
export const APPROACH = { x: 0.95, y: 0.085, z: 1.75 }
export const SEATED = { x: 0.95, y: 0.085, z: 1.19 }

/**
 * Every insert and eject leg's duration is its base value times this, so the whole floppy dance
 * can be sped up or slowed down in one place (0.65: a swap takes about 1.6 s, an insert into an
 * empty drive about 0.88 s).
 */
export const FLOPPY_PACE = 0.65

const at = (x, y, z) => ({ x, y, z })

/**
 * insert(f): a floppy already in the drive just reopens (`onReopen`, else `onInserted`).
 * Otherwise the one in the drive ejects first, then `f` goes in, then `onInserted(f)`. In: slide
 * out sideways (+x) at its own height until clear of the pile (the floppies are stacked 0.032
 * apart, so a slide at its own height touches none), rise to the lane (squaring up), run along it
 * to above the slot, drop to the slot's height and slide in. The lane passes over the front of
 * the pile, so the floppy only changes height where it is clear. Eject reverses it: out of the
 * slot, up to the lane, along it to SLIDE_X, back over its home z, down to its home height
 * (turning back) and slide in home. A click while a
 * sequence runs is held (the last one wins) and runs as soon as the current one ends.
 */
export function createFloppySequencer({ tween, onInserted, onReopen, onSound }) {
  let inDrive = null
  let busy = false
  let pending = null

  // The eject legs go on the tween list at once: the scene runs one object's tweens one after
  // another (createTweenList), and the last leg's done hands over to the next insert.
  function eject(o, done) {
    const [x, y, z, ry] = o.home
    tween(o.m, { p: { ...APPROACH } }, 0.25 * FLOPPY_PACE)
    tween(o.m, { p: at(APPROACH.x, LANE_Y, LANE_Z) }, 0.1 * FLOPPY_PACE)
    tween(o.m, { p: at(SLIDE_X, LANE_Y, LANE_Z) }, 0.25 * FLOPPY_PACE)
    tween(o.m, { p: at(SLIDE_X, LANE_Y, z) }, 0.2 * FLOPPY_PACE)
    tween(o.m, { p: at(SLIDE_X, y, z), r: at(0, ry, 0) }, 0.15 * FLOPPY_PACE)
    tween(o.m, { p: at(x, y, z) }, 0.2 * FLOPPY_PACE, done)
  }

  function load(f) {
    const [, y, z] = f.home
    tween(f.m, { p: at(SLIDE_X, y, z) }, 0.2 * FLOPPY_PACE, () =>
      tween(f.m, { p: at(SLIDE_X, LANE_Y, z), r: at(0, 0, 0) }, 0.15 * FLOPPY_PACE, () =>
        tween(f.m, { p: at(SLIDE_X, LANE_Y, LANE_Z) }, 0.25 * FLOPPY_PACE, () =>
          tween(f.m, { p: at(APPROACH.x, LANE_Y, LANE_Z) }, 0.3 * FLOPPY_PACE, () =>
            tween(f.m, { p: { ...APPROACH } }, 0.1 * FLOPPY_PACE, () =>
              tween(f.m, { p: { ...SEATED } }, 0.35 * FLOPPY_PACE, () => {
                busy = false
                onInserted(f)
                const next = pending
                pending = null
                if (next && next !== inDrive) insert(next)
              }),
            ),
          ),
        ),
      ),
    )
  }

  function insert(f) {
    if (busy) {
      pending = f
      return
    }
    if (inDrive === f) {
      ;(onReopen ?? onInserted)(f)
      return
    }
    busy = true
    const out = inDrive
    inDrive = f
    onSound?.()
    if (out) eject(out, () => load(f))
    else load(f)
  }

  return {
    insert,
    get inDrive() {
      return inDrive
    },
    get busy() {
      return busy
    },
  }
}
