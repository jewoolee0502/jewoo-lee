/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import { useState, useEffect, useRef } from 'react'
import { ReactLenis } from 'lenis/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

/**
 * Register gsap plugins
 */
gsap.registerPlugin(useGSAP, ScrollTrigger)

/**
 * Comopnents
 */
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
  const splineHeroRef = useRef<HTMLElement>(null)
  const [headerHidden, setHeaderHidden] = useState(true)

  useEffect(() => {
    const el = splineHeroRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setHeaderHidden(entry.isIntersecting),
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useGSAP(() => {
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
      <Header hidden={headerHidden} />
      <main>
        <SplineHero ref={splineHeroRef} />
        <Hero />
        <About />
        <Skill />
        <Project />
        <Experience />
        <Contact />
      </main>
      <Footer />
    </ReactLenis>
  )
}

export default App
