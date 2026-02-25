/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */

import { useRef, useEffect, useCallback } from 'react'

type NavbarProps = {
  navOpen: boolean
}

const navItems = [
  { label: 'Home', link: '#home', className: 'nav-link' },
  { label: 'About', link: '#about', className: 'nav-link' },
  { label: 'Projects', link: '#project', className: 'nav-link' },
  { label: 'Experience', link: '#experience', className: 'nav-link' },
  { label: 'Contact', link: '#contact', className: 'nav-link md:hidden' },
]

const Navbar = ({ navOpen }: NavbarProps) => {
  const navRef = useRef<HTMLElement>(null)
  const activeBox = useRef<HTMLDivElement | null>(null)
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null)

  const moveActiveBox = useCallback((link: HTMLAnchorElement) => {
    if (!activeBox.current) return
    activeBox.current.style.top = link.offsetTop + 'px'
    activeBox.current.style.left = link.offsetLeft + 'px'
    activeBox.current.style.width = link.offsetWidth + 'px'
    activeBox.current.style.height = link.offsetHeight + 'px'
  }, [])

  const setActive = useCallback(
    (link: HTMLAnchorElement) => {
      if (link === activeLinkRef.current) return
      activeLinkRef.current?.classList.remove('active')
      link.classList.add('active')
      activeLinkRef.current = link
      moveActiveBox(link)
    },
    [moveActiveBox]
  )

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return

    const homeLink = nav.querySelector<HTMLAnchorElement>('a[href="#home"]')
    if (homeLink) {
      homeLink.classList.add('active')
      activeLinkRef.current = homeLink
      moveActiveBox(homeLink)
    }

    const handleScroll = () => {
      const sections = document.querySelectorAll<HTMLElement>('section[id]')
      let bestMatch: { id: string; distance: number } | null = null

      sections.forEach((section) => {
        const rect = section.getBoundingClientRect()
        const sectionTop = rect.top
        const sectionBottom = rect.bottom

        if (sectionBottom < 0) return

        const distance = Math.abs(sectionTop)
        if (!bestMatch || distance < bestMatch.distance) {
          const id = section.getAttribute('id')
          if (id) bestMatch = { id, distance }
        }
      })

      if (bestMatch && nav) {
        const link = nav.querySelector<HTMLAnchorElement>(
          `a[href="#${bestMatch.id}"]`
        )
        if (link) setActive(link)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', () => {
      if (activeLinkRef.current) moveActiveBox(activeLinkRef.current)
    })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', () => {
        if (activeLinkRef.current) moveActiveBox(activeLinkRef.current)
      })
    }
  }, [setActive, moveActiveBox])

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    setActive(e.currentTarget)
  }

  return (
    <nav ref={navRef} className={'navbar ' + (navOpen ? 'active' : '')}>
      {navItems.map(({ label, link, className }, key) => (
        <a
          href={link}
          key={key}
          className={className}
          onClick={handleClick}
        >
          {label}
        </a>
      ))}
      <div className="active-box" ref={activeBox}></div>
    </nav>
  )
}

export default Navbar
