/**
 * Cinematic Spline Hero – animation-only layer with CRT effects and mouse parallax.
 */

import { useRef, useCallback } from 'react'
import Spline from '@splinetool/react-spline'

interface SplineHeroProps {
  onSplineLoad?: () => void
}

const SplineHero = ({ onSplineLoad }: SplineHeroProps) => {
  const parallaxRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = parallaxRef.current
    if (!el) return
    const x = (e.clientX / window.innerWidth - 0.5) * 2
    const y = (e.clientY / window.innerHeight - 0.5) * 2
    el.style.transform = `translate(${x * 8}px, ${y * 6}px)`
  }, [])

  const handleMouseLeave = useCallback(() => {
    const el = parallaxRef.current
    if (!el) return
    el.style.transition = 'transform 0.6s ease-out'
    el.style.transform = 'translate(0, 0)'
    setTimeout(() => {
      if (el) el.style.transition = ''
    }, 600)
  }, [])

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-black"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Spline scene with parallax wrapper */}
      <div ref={parallaxRef} className="absolute inset-0 will-change-transform">
        <Spline
          scene="https://prod.spline.design/UWqFUDwTtvtxSBak/scene.splinecode"
          onLoad={onSplineLoad}
        />
      </div>

      {/* CRT scanlines overlay */}
      <div className="crt-scanlines pointer-events-none absolute inset-0 z-10" />

      {/* CRT vignette */}
      <div className="pointer-events-none absolute inset-0 z-10 shadow-[inset_0_0_120px_rgba(0,0,0,0.7)]" />

      {/* Bottom gradient */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 z-10 bg-gradient-to-t from-black to-transparent" />

      {/* Scroll indicator */}
      <div className="scroll-indicator pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
        <span className="text-zinc-500 text-xs tracking-[0.3em] uppercase">Scroll</span>
        <span className="block w-px h-8 bg-gradient-to-b from-zinc-500 to-transparent animate-bounce" />
      </div>
    </div>
  )
}

export default SplineHero
