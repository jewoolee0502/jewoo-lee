/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */

import { useState, useCallback, useRef } from 'react'
import { ReactLenis } from 'lenis/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP, ScrollTrigger)

import LoadingScreen from './components/LoadingScreen'
import Header from './components/Header'
import SplineHero from './components/SplineHero'
import Hero from './components/Hero'
import About from './components/About'
import Skill from './components/Skill'
import Project from './components/Project'
import Experience from './components/Experience'
import Contact from './components/Contact'
import Footer from './components/Footer'

const App = () => {
  const [splineLoaded, setSplineLoaded] = useState(false)
  const [headerHidden, setHeaderHidden] = useState(true)
  const handleSplineLoad = useCallback(() => setSplineLoaded(true), [])

  const splineSectionRef = useRef<HTMLElement>(null)
  const splineInnerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!splineSectionRef.current || !splineInnerRef.current || !contentRef.current) return

    const scrollIndicator = splineInnerRef.current.querySelector('.scroll-indicator')

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: splineSectionRef.current,
        start: 'top top',
        end: 'bottom top',
        scrub: 2,
        onUpdate: (self) => {
          setHeaderHidden(self.progress < 0.3)
        },
      },
    })

    tl.to(
      splineInnerRef.current,
      { opacity: 0, scale: 0.92, y: -60, ease: 'none' },
      0
    )

    if (scrollIndicator) {
      tl.to(scrollIndicator, { opacity: 0, y: 20, ease: 'none', duration: 0.15 }, 0)
    }

    tl.fromTo(
      contentRef.current,
      { opacity: 0, y: 100 },
      { opacity: 1, y: 0, ease: 'none' },
      0.4
    )

    const elements = gsap.utils.toArray<HTMLElement>('.reveal-up')
    elements.forEach((element) => {
      gsap.to(element, {
        scrollTrigger: {
          trigger: element,
          start: '-200 bottom',
          end: 'bottom 80%',
          scrub: true,
        },
        y: 0,
        opacity: 1,
        duration: 1,
        ease: 'power2.out',
      })
    })
  })

  return (
    <ReactLenis root>
      <LoadingScreen loaded={splineLoaded} />

      <Header hidden={headerHidden} />

      <main>
        <section ref={splineSectionRef} id="home" className="relative h-[250vh]">
          <div className="sticky top-0 h-screen w-full overflow-hidden">
            <div
              ref={splineInnerRef}
              className="h-full w-full will-change-transform origin-center"
            >
              <SplineHero onSplineLoad={handleSplineLoad} />
            </div>
          </div>
        </section>

        <div ref={contentRef}>
          <Hero />
          <About />
          <Skill />
          <Project />
          <Experience />
          <Contact />
        </div>
      </main>

      <Footer />
    </ReactLenis>
  )
}

export default App
