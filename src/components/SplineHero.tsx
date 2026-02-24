/**
 * Cinematic Spline Hero
 */

import Spline from '@splinetool/react-spline'
import { ButtonPrimary, ButtonOutline } from './Button'

const SplineHero = () => {
  return (
    <section id="home" className="relative h-screen w-full overflow-hidden bg-black text-white">
      <div className="absolute inset-0">
        <Spline scene="https://prod.spline.design/UWqFUDwTtvtxSBak/scene.splinecode" />
      </div>

      <div className="relative z-10 h-full pointer-events-none">
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

            <div className="flex flex-wrap items-center gap-3 pointer-events-auto">
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

