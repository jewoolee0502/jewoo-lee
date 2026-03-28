/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { ReactLenis } from 'lenis/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP, ScrollTrigger)

import Cursor from './components/Cursor'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Hero from './components/Hero'
import About from './components/About'
import Skill from './components/Skill'
import Project from './components/Project'
import Experience from './components/Experience'
import Contact from './components/Contact'
import Footer from './components/Footer'

const sections = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'about', label: 'About', icon: 'person' },
  { id: 'skills', label: 'Skills', icon: 'code' },
  { id: 'project', label: 'Projects', icon: 'work' },
  { id: 'experience', label: 'Experience', icon: 'timeline' },
  // { id: 'contact', label: 'Contact', icon: 'mail' },
]

const App = () => {
  const [activeSection, setActiveSection] = useState('home')
  const [isDesktop, setIsDesktop] = useState(false)
  const contentRef = useRef(null)

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)')
    const handleChange = (e) => setIsDesktop(e.matches)
    handleChange(mql)
    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [])

  const navigateTo = useCallback((sectionId) => {
    if (!isDesktop) return
    if (sectionId === activeSection) return

    const content = contentRef.current
    if (!content) {
      setActiveSection(sectionId)
      return
    }

    // Fade out current content
    gsap.to(content, {
      opacity: 0,
      y: 20,
      duration: 0.2,
      ease: 'power2.in',
      onComplete: () => {
        setActiveSection(sectionId)
        content.scrollTop = 0
      }
    })
  }, [activeSection, isDesktop])

  // Fade in after React renders the new section
  useEffect(() => {
    if (!isDesktop || !contentRef.current) return
    gsap.fromTo(contentRef.current,
      { opacity: 0, y: -15 },
      { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
    )
  }, [activeSection, isDesktop])

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'home': return <Hero isDesktop={isDesktop} />
      case 'about': return <About isDesktop={isDesktop} />
      case 'skills': return <Skill isDesktop={isDesktop} />
      case 'project': return <Project isDesktop={isDesktop} />
      case 'experience': return <Experience isDesktop={isDesktop} />
      case 'contact': return <Contact isDesktop={isDesktop} />
      default: return <Hero isDesktop={isDesktop} />
    }
  }

  // Desktop: sidebar + content panel
  if (isDesktop) {
    return (
      <>
        <Cursor />
        <div className="flex h-screen overflow-hidden bg-void">
          <Sidebar
            sections={sections}
            activeSection={activeSection}
            onNavigate={navigateTo}
          />

          <main
            ref={contentRef}
            className="flex-1 overflow-y-auto"
          >
            {renderActiveSection()}
          </main>
        </div>
      </>
    )
  }

  // Mobile: scrollable layout
  return (
    <ReactLenis root>
      <Cursor />
      <Header />

      <main>
        <Hero />
        <About />
        <Skill />
        <Project />
        <Experience />
        {/* <Contact /> */}
      </main>

      <Footer />
    </ReactLenis>
  )
}

export default App
