// Fallback notice (L1279). plan-r2 §7 U11: a note in the fallback's top bar, not a floating toast.
export default function NoWebGLNotice() {
  return (
    <p className="fallback-note" role="note">
      3D is unavailable in this browser, so JAY-OS runs flat. Everything still works.
    </p>
  )
}
