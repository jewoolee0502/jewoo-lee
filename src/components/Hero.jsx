/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */

import { useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

const Hero = ({ isDesktop }) => {
  const containerRef = useRef(null)

  useGSAP(() => {
    const container = containerRef.current
    const chars = container.querySelectorAll('.hero-char')
    const subtitle = container.querySelector('.hero-subtitle')
    const line = container.querySelector('.hero-line')
    const arrow = container.querySelector('.hero-arrow')

    const tl = gsap.timeline({ delay: 0.2 })

    // Line draws in
    tl.from(line, {
      scaleX: 0,
      transformOrigin: 'left',
      duration: 1,
      ease: 'power4.out'
    })
    // Characters cascade in with rotation
    .from(chars, {
      y: 120,
      rotateX: -90,
      opacity: 0,
      stagger: 0.04,
      duration: 1.2,
      ease: 'power4.out'
    }, '-=0.6')
    // Subtitle fades in
    .from(subtitle, {
      opacity: 0,
      y: 20,
      duration: 0.8,
      ease: 'power3.out'
    }, '-=0.3')

    if (arrow) {
      tl.from(arrow, { opacity: 0, duration: 0.5 }, '-=0.2')
      gsap.to(arrow, {
        y: 12,
        duration: 1.8,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: 2.5
      })
    }
  }, { scope: containerRef, dependencies: [] })

  const renderName = (text, className = '') => (
    text.split('').map((char, i) => (
      <span
        key={i}
        className={`hero-char inline-block ${char === ' ' ? 'w-[0.3em]' : ''} ${className}`}
        style={{ perspective: '600px' }}
      >
        {char === ' ' ? '\u00A0' : char}
      </span>
    ))
  )

  return (
    <section
      id="home"
      ref={containerRef}
      className={`relative flex flex-col items-start justify-center px-6 sm:px-12 lg:px-20 ${
        isDesktop ? 'h-full' : 'min-h-screen'
      }`}
    >
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-ember/[0.03] blur-[120px] pointer-events-none" />

      <div className="relative max-w-4xl">
        {/* Decorative line */}
        <div className="hero-line w-12 sm:w-16 h-[2px] bg-ember mb-6 sm:mb-10" />

        <h1 className="font-display text-[44px] sm:text-7xl lg:text-[96px] font-extrabold leading-[0.92] tracking-tighter">
          <span className="block overflow-hidden py-1">
            {renderName('Jewoo')}
          </span>
          <span className="block overflow-hidden py-1">
            {renderName('Lee', 'text-ember')}
          </span>
        </h1>

        <p className="hero-subtitle mt-6 sm:mt-8 font-body text-lg sm:text-2xl italic text-muted max-w-md">
          Crafting thoughtful digital experiences with code, curiosity, and care.
        </p>
      </div>

      {!isDesktop && (
        <div className="hero-arrow absolute bottom-12 left-1/2 -translate-x-1/2">
          <span className="material-symbols-rounded text-faint text-2xl">
            expand_more
          </span>
        </div>
      )}
    </section>
  )
}

export default Hero
