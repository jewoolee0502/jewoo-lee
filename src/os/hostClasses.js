// Keeps the host's `div.os` classes and data-state in sync with the OS and scene stores (D2).
// Both JayOS and the Stage bind it, so the fallback class is right even before the OS renders.
export function bindHostClasses({ os, host, sceneStore }) {
  const sync = () => {
    const s = os.store.get()
    host.syncClasses({
      state: s.state,
      collapsing: s.collapsing,
      disco: s.disco,
      fallback: sceneStore?.get().status === 'unavailable',
    })
  }
  sync()
  const offOs = os.store.subscribe(sync)
  const offScene = sceneStore?.subscribe(sync)
  return () => {
    offOs()
    offScene?.()
  }
}
