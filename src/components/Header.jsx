/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */

import { useState, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

const Header = () => {
  const [navOpen, setNavOpen] = useState(false)
  const headerRef = useRef(null)

  useGSAP(() => {
    ScrollTrigger.create({
      trigger: '#home',
      start: 'bottom top+=100',
      onEnter: () => {
        gsap.to(headerRef.current, {
          backgroundColor: 'rgba(8, 8, 12, 0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(237, 232, 224, 0.04)',
          duration: 0.4
        })
      },
      onLeaveBack: () => {
        gsap.to(headerRef.current, {
          backgroundColor: 'transparent',
          backdropFilter: 'blur(0px)',
          borderBottom: '1px solid transparent',
          duration: 0.4
        })
      }
    })
  })

  const navItems = [
    { label: 'Home', href: '#home' },
    { label: 'About', href: '#about' },
    { label: 'Projects', href: '#project' },
    { label: 'Experience', href: '#experience' },
    { label: 'Contact', href: '#contact' },
  ]

  return (
    <header
      ref={headerRef}
      className="fixed top-0 left-0 w-full h-20 flex items-center z-40"
      style={{ borderBottom: '1px solid transparent' }}
    >
      <div className="max-w-screen-2xl w-full mx-auto px-5 flex justify-between items-center">
        <a href="/" className="font-display text-xl font-bold tracking-tight text-ink hover:text-ember transition-colors duration-300">
          Jewoo Lee
        </a>

        <button
          className="w-10 h-10 grid place-items-center text-ink"
          onClick={() => setNavOpen((prev) => !prev)}
          aria-label="Toggle menu"
        >
          <span className="material-symbols-rounded">
            {navOpen ? 'close' : 'menu'}
          </span>
        </button>
      </div>

      {/* Fullscreen mobile overlay */}
      {navOpen && (
        <div className="fixed inset-0 bg-void/95 backdrop-blur-2xl z-50 flex flex-col items-center justify-center">
          <button
            className="absolute top-6 right-5 w-10 h-10 grid place-items-center text-ink"
            onClick={() => setNavOpen(false)}
            aria-label="Close menu"
          >
            <span className="material-symbols-rounded text-2xl">close</span>
          </button>

          <nav className="flex flex-col items-center gap-6">
            {navItems.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                onClick={() => setNavOpen(false)}
                className="font-display text-3xl font-bold tracking-tight text-ink hover:text-ember transition-colors duration-300"
              >
                {label}
              </a>
            ))}
          </nav>

          <a
            href="/files/JEWOOLEE_CV.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-12 font-display text-[11px] font-bold tracking-widest uppercase text-faint hover:text-ember transition-colors duration-300"
          >
            Download Resume
          </a>
        </div>
      )}
    </header>
  )
}

export default Header
