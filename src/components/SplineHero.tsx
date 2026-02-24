/**
 * Cinematic Spline Hero
 */

import { useEffect, useRef, useState } from 'react'
import Spline from '@splinetool/react-spline'
import { ButtonPrimary, ButtonOutline } from './Button'

const clamp = (value: number, min: number, max: number) => {
  if (value < min) return min
  if (value > max) return max
  return value
}

const SplineHero = () => {
  const sectionRef = useRef<HTMLElement | null>(null)
  const [scrollProgress, setScrollProgress] = useState(0)
  const splineAppRef = useRef<any>(null)

  useEffect(() => {
    const handleScroll = () => {
      const section = sectionRef.current
      if (!section) return

      const rect = section.getBoundingClientRect()
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight

      const start = -viewportHeight
      const end = rect.height
      const rawProgress = (rect.top - start) / (end - start)
      const progress = clamp(1 - rawProgress, 0, 1)

      setScrollProgress(progress)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [])

  useEffect(() => {
    if (!splineAppRef.current) return

    try {
      // This assumes a Spline variable named "scrollProgress" exists in the scene.
      splineAppRef.current.setVariable('scrollProgress', scrollProgress)
    } catch {
      // Ignore errors if variable is not defined in the Spline scene.
    }
  }, [scrollProgress])

  return (
    <section
      id="home"
      ref={sectionRef}
      className="relative h-screen w-full overflow-hidden bg-black text-white"
    >
      <div className="absolute inset-0">
        <Spline
          scene="https://prod.spline.design/UWqFUDwTtvtxSBak/scene.splinecode"
          onLoad={(app) => {
            splineAppRef.current = app
          }}
        />
      </div>

      <div className="relative z-10 h-full">
        <div className="container h-full flex flex-col justify-center">
          <div className="max-w-xl space-y-6">
            <p className="flex items-center gap-2 text-sm text-zinc-300">
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Available for Work
            </p>

            <h1 className="headline-1">
              Jewoo (Jay) Lee
            </h1>

            <p className="max-w-md text-zinc-300">
              Software engineer crafting playful, cinematic web experiences that blend 3D and motion.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <ButtonPrimary
                href="/files/JEWOOLEE_CV.pdf"
                target="_blank"
                rel="noopener noreferrer"
                label="Download CV"
                icon="download"
              />

              <ButtonOutline href="#about" label="Scroll down" icon="arrow_downward" />
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black to-transparent" />
    </section>
  )
}

export default SplineHero

