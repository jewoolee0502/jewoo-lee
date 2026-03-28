/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */

import { useRef, useEffect, useState } from 'react'

const navItems = [
  { label: 'Home', href: '#home' },
  { label: 'About', href: '#about' },
  { label: 'Projects', href: '#project' },
  { label: 'Experience', href: '#experience' },
  // { label: 'Contact', href: '#contact' },
]

const Navbar = () => {
  const [activeId, setActiveId] = useState('home')
  const observerRef = useRef(null)

  useEffect(() => {
    // Only run IntersectionObserver on mobile (scroll layout)
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches
    if (isDesktop) return

    const sections = document.querySelectorAll('section[id]')
    if (sections.length === 0) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        })
      },
      { rootMargin: '-40% 0px -55% 0px' }
    )

    sections.forEach((section) => {
      observerRef.current.observe(section)
    })

    return () => observerRef.current?.disconnect()
  }, [])

  return (
    <nav className="flex items-center gap-1">
      {navItems.map(({ label, href }) => {
        const id = href.replace('#', '')
        const isActive = activeId === id

        return (
          <a
            key={label}
            href={href}
            className={`relative px-4 py-2 text-sm transition-colors duration-300 ${
              isActive ? 'text-warm-text' : 'text-warm-muted hover:text-warm-text'
            }`}
          >
            {label}
            {isActive && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />
            )}
          </a>
        )
      })}
    </nav>
  )
}

export default Navbar
