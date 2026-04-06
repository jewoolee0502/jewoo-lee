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
    const stats = container.querySelectorAll('.hero-stat')
    const arrow = container.querySelector('.hero-arrow')

    const tl = gsap.timeline({ delay: 0.2 })

    tl.from(line, {
      scaleX: 0,
      transformOrigin: 'left',
      duration: 1,
      ease: 'power4.out'
    })
    .from(chars, {
      y: 120,
      rotateX: -90,
      opacity: 0,
      stagger: 0.04,
      duration: 1.2,
      ease: 'power4.out'
    }, '-=0.6')
    .from(subtitle, {
      opacity: 0,
      y: 20,
      duration: 0.8,
      ease: 'power3.out'
    }, '-=0.3')
    .from(stats, {
      opacity: 0,
      y: 20,
      stagger: 0.1,
      duration: 0.6,
      ease: 'power2.out'
    }, '-=0.4')

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
      className={`relative flex flex-col justify-center px-6 sm:px-12 lg:px-20 ${
        isDesktop ? 'h-full' : 'min-h-screen'
      }`}
    >
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-ember/[0.03] blur-[120px] pointer-events-none" />

      <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-12 lg:gap-20 max-w-6xl">
        <div className="flex-1">
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
            Software Engineer
          </p>
        </div>

        {/* Stats */}
        <div className="flex flex-row lg:flex-col gap-6 sm:gap-8 lg:gap-6 lg:pb-4">
          {[
            { number: '10+', label: 'Projects' },
            { number: '1+', label: 'Years Exp.' },
            { number: '3+', label: 'Internships' },
          ].map(({ number, label }) => (
            <div key={label} className="hero-stat">
              <span className="font-display text-2xl sm:text-3xl font-extrabold text-ink">{number}</span>
              <p className="font-body text-xs sm:text-sm text-faint mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="hidden lg:block">
          <figure className="w-full max-w-[480px] ml-auto bg-gradient-to-t from-sky-400 via-25% via-sky-400/40 to-65% rounded-[60px] overflow-hidden">
            <img
              src="/images/jewoolee_edited.webp"
              width={656}
              height={800}
              alt="Jewoo Lee"
              className="w-full" 
            />
          </figure>
        </div>

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
