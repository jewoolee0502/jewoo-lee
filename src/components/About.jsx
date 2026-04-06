/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */

import { useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

const About = ({ isDesktop }) => {
  const sectionRef = useRef(null)

  useGSAP(() => {
    const section = sectionRef.current
    const image = section.querySelector('.about-image')
    const textEls = section.querySelectorAll('.about-text-reveal')
    const label = section.querySelector('.about-label')

    if (!isDesktop) {
      ScrollTrigger.create({
        trigger: section,
        start: 'top 75%',
        once: true,
        onEnter: () => {
          const tl = gsap.timeline()
          tl.fromTo(label, { x: -30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: 'power3.out', clearProps: 'all' })
            .fromTo(image, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0)', duration: 1.2, ease: 'power4.out', clearProps: 'clipPath' }, '-=0.3')
            .fromTo(textEls, { opacity: 0, y: 30 }, { opacity: 1, y: 0, stagger: 0.12, duration: 0.7, ease: 'power2.out', clearProps: 'all' }, '-=0.6')
        }
      })
    }
  }, { scope: sectionRef, dependencies: [] })

  return (
    <section
      id="about"
      ref={sectionRef}
      className={isDesktop ? 'p-12 lg:p-16 xl:p-20' : 'section'}
    >
      <div className={isDesktop ? '' : 'container'}>
        {/* Section label */}
        <div className="about-label flex items-center gap-4 mb-8 sm:mb-14">
          <span className="font-display text-[11px] font-bold tracking-[0.25em] uppercase text-ember">
            About
          </span>
          <div className="flex-1 h-px bg-gradient-to-r from-ember/20 to-transparent" />
        </div>

        <div className="grid lg:grid-cols-[0.8fr,1fr] gap-12 lg:gap-20 items-start">
          <figure
            className="about-image relative rounded-2xl overflow-hidden aspect-[3/5] w-full max-w-[280px] sm:max-w-[380px]"
            style={{ clipPath: 'inset(0)' }}
          >
            <img
              src="/images/jewoolee_edited.webp"
              alt="Jewoo Lee"
              className="w-full h-full object-cover"
            />
            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-void/60 via-transparent to-transparent" />
          </figure>

          <div className="lg:pt-8">
            <h2 className="about-text-reveal headline-2 mb-4 sm:mb-6">
              I build things that {' '}
              <span className="text-ember">feel right.</span>
            </h2>

            <p className="about-text-reveal font-body text-base sm:text-lg text-muted leading-relaxed mb-4 sm:mb-5">
              I'm Jay, a Computer Engineering student at McGill University who
              builds things for the web. I care about clean code, thoughtful
              design, and solving problems that matter.
            </p>

            <p className="about-text-reveal font-body text-base sm:text-lg text-muted leading-relaxed">
              When I'm not coding, you'll find me exploring new technologies,
              collaborating on creative projects, and constantly pushing to
              grow as a developer and engineer.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default About
