// Scroll cue (L282–285). The controller writes its opacity straight to the element every frame.
export default function Cue({ ref }) {
  return (
    <div className="cue" id="cue" role="img" aria-label="Scroll down to open the laptop" ref={ref}>
      <svg width="26" height="40" viewBox="0 0 26 40" fill="none" aria-hidden="true">
        <rect x="1.5" y="1.5" width="23" height="37" rx="11.5" stroke="currentColor" strokeWidth="3" />
        <rect className="wheel" x="11" y="8" width="4" height="8" rx="2" fill="currentColor" />
      </svg>
      <svg className="chev" width="18" height="10" viewBox="0 0 18 10" fill="none" aria-hidden="true">
        <path d="M2 2l7 6 7-6" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
      </svg>
    </div>
  )
}
