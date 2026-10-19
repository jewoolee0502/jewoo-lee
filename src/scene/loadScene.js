// Lazy scene loader: the WebGL probe (L1057), then `import('./createScene.js')`, which is the
// only module that imports three, so three lands in its own chunk. Returns null (flat
// fallback) when there is no WebGL or the chunk fails to load.

export function defaultCanGL() {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl') || c.getContext('experimental-webgl'))
  } catch {
    return false
  }
}

export async function loadScene({ canGL = defaultCanGL, importer = () => import('./createScene.js') } = {}) {
  if (!canGL()) return null
  try {
    return await importer()
  } catch (e) {
    console.error('scene', e)
    return null
  }
}
