// Fallback notice (L1279).
const STYLE = { position: 'absolute', left: 16, bottom: 16, zIndex: 50, maxWidth: 340 }

export default function NoWebGLNotice() {
  return (
    <div className="toast info" style={STYLE}>
      3D is unavailable in this browser, so JAY-OS runs flat. Everything still works.
    </div>
  )
}
