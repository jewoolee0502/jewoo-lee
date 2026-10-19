// The three floppies (L1162) and the insert sequence (L1185–1188). Poses are plain {x,y,z};
// the injected `tween(obj, {p, r}, dur, done)` runs them on the scene's tween list.
export const FLOPPIES = [
  { label: 'PROJECTS', app: 'projects', col: 0x2f6fb0, hex: '#2F6FB0', home: [2.15, 0.016, 0.75, 0.3] },
  { label: 'GAMES', app: 'bugs', col: 0xe0602a, hex: '#E0602A', home: [2.32, 0.048, 1.08, -0.2] },
  { label: 'RESUME', app: 'resume', col: 0x2a2f36, hex: '#2A2F36', home: [2.08, 0.08, 1.4, 0.6] },
]

const OUT = { x: 2.3, y: 0.09, z: 0.9 }
const IN = { x: 2.35, y: 0.09, z: 0.9 }
const DRIVE = { x: 1.2, y: 0.09, z: 0.9 }

/**
 * insert(f): a floppy already in the drive just reopens (`onReopen`, else `onInserted`).
 * Otherwise the one in the drive goes out and home, and `f` slides in, then `onInserted(f)`.
 */
export function createFloppySequencer({ tween, onInserted, onReopen, onSound }) {
  let inDrive = null

  function insert(f) {
    if (inDrive === f) {
      ;(onReopen ?? onInserted)(f)
      return
    }
    if (inDrive) {
      const o = inDrive
      tween(o.m, { p: { ...OUT } }, 0.3, () =>
        tween(o.m, { p: { x: o.home[0], y: o.home[1], z: o.home[2] }, r: { x: 0, y: o.home[3], z: 0 } }, 0.45),
      )
    }
    inDrive = f
    onSound?.()
    tween(f.m, { p: { ...IN }, r: { x: 0, y: 0, z: 0 } }, 0.45, () =>
      tween(f.m, { p: { ...DRIVE } }, 0.35, () => onInserted(f)),
    )
  }

  return {
    insert,
    get inDrive() {
      return inDrive
    },
  }
}
