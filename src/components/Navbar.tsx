/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import { useRef, useEffect } from 'react'
import type { MouseEvent, Ref } from 'react'

type NavbarProps = {
  navOpen: boolean
}

const Navbar = ({ navOpen }: NavbarProps) => {
  const lastActiveLink = useRef<HTMLAnchorElement | null>(null)
  const activeBox = useRef<HTMLDivElement | null>(null)

  const initActiveBox = () => {
    if (!activeBox.current || !lastActiveLink.current) {
      return
    }

    activeBox.current.style.top = lastActiveLink.current.offsetTop + 'px'
    activeBox.current.style.left = lastActiveLink.current.offsetLeft + 'px'
    activeBox.current.style.width = lastActiveLink.current.offsetWidth + 'px'
    activeBox.current.style.height = lastActiveLink.current.offsetHeight + 'px'
  }

  useEffect(() => {
    const handleScroll = () => {
      const sections = document.querySelectorAll<HTMLElement>('section[id]')
      const scrollY = window.scrollY

      sections.forEach((section) => {
        const sectionTop = section.offsetTop - 100 // Offset to trigger early
        const sectionHeight = section.offsetHeight
        const sectionId = section.getAttribute('id')

        if (sectionId && scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
          const currentLink = document.querySelector<HTMLAnchorElement>(
            `a[href="#${sectionId}"]`,
          )

          if (
            currentLink &&
            currentLink !== lastActiveLink.current &&
            lastActiveLink.current &&
            activeBox.current
          ) {
            lastActiveLink.current.classList.remove('active')
            currentLink.classList.add('active')
            lastActiveLink.current = currentLink

            // Animate active box
            activeBox.current.style.top = currentLink.offsetTop + 'px'
            activeBox.current.style.left = currentLink.offsetLeft + 'px'
            activeBox.current.style.width = currentLink.offsetWidth + 'px'
            activeBox.current.style.height = currentLink.offsetHeight + 'px'
          }
        }
      })
    }

    window.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', initActiveBox)
    initActiveBox() // Initialize position once on mount

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', initActiveBox)
    }
  }, [])

  const activeCurrentLink = (event: MouseEvent<HTMLAnchorElement>) => {
    const target = event.currentTarget

    lastActiveLink.current?.classList.remove('active')
    target.classList.add('active')
    lastActiveLink.current = target

    if (!activeBox.current) {
      return
    }

    activeBox.current.style.top = target.offsetTop + 'px'
    activeBox.current.style.left = target.offsetLeft + 'px'
    activeBox.current.style.width = target.offsetWidth + 'px'
    activeBox.current.style.height = target.offsetHeight + 'px'
  }

  const navItems: Array<{
    label: string
    link: string
    className: string
    ref?: Ref<HTMLAnchorElement>
  }> = [
    {
      label: 'Home',
      link: '#home',
      className: 'nav-link active',
      ref: lastActiveLink,
    },
    {
      label: 'About',
      link: '#about',
      className: 'nav-link',
    },
    {
      label: 'Projects',
      link: '#project',
      className: 'nav-link',
    },
    {
      label: 'Experience',
      link: '#experience',
      className: 'nav-link',
    },
    {
      label: 'Contact',
      link: '#contact',
      className: 'nav-link md:hidden',
    },
  ]

  return (
    <nav className={'navbar ' + (navOpen ? 'active' : '')}>
      {navItems.map(({ label, link, className, ref }, key) => (
        <a
          href={link}
          key={key}
          ref={ref}
          className={className}
          onClick={activeCurrentLink}
        >
          {label}
        </a>
      ))}
      <div className="active-box" ref={activeBox}></div>
    </nav>
  )
}

export default Navbar
