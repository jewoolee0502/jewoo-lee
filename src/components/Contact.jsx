/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */

import { useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

const socialLinks = [
  { label: 'GitHub', href: 'https://github.com/jewoolee0502' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/jewoo-lee/' },
  { label: 'Instagram', href: 'https://www.instagram.com/jwuu_lee/' },
]

const Contact = ({ isDesktop }) => {
  const sectionRef = useRef(null)

  useGSAP(() => {
    const label = sectionRef.current.querySelector('.section-label')
    const elements = sectionRef.current.querySelectorAll('.contact-reveal')

    if (!isDesktop) {
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top 75%',
        once: true,
        onEnter: () => {
          const tl = gsap.timeline()
          tl.fromTo(label, { x: -30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: 'power3.out', clearProps: 'all' })
            .fromTo(elements,
              { opacity: 0, y: 30 },
              { opacity: 1, y: 0, stagger: 0.1, duration: 0.6, ease: 'power2.out', clearProps: 'all' },
              '-=0.3'
            )
        }
      })
    }
  }, { scope: sectionRef, dependencies: [] })

  return (
    <section
      id="contact"
      ref={sectionRef}
      className={isDesktop ? 'p-12 lg:p-16 xl:p-20' : 'section'}
    >
      <div className={isDesktop ? '' : 'container'}>
        {/* Section label */}
        <div className="section-label flex items-center gap-4 mb-8 sm:mb-14">
          <span className="font-display text-[11px] font-bold tracking-[0.25em] uppercase text-ember">
            Contact
          </span>
          <div className="flex-1 h-px bg-gradient-to-r from-ember/20 to-transparent" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-16 lg:gap-20">
          <div>
            <h2 className="contact-reveal headline-2 mb-4">
              Let's build something {' '}
              <span className="text-ember">together.</span>
            </h2>

            <p className="contact-reveal font-body text-base sm:text-lg italic text-muted mt-3 sm:mt-4 mb-6 sm:mb-8 max-w-[40ch]">
              Have a project in mind or just want to chat? I'd love to hear from you.
            </p>

            <a
              href="mailto:jewoo.lee@mail.mcgill.ca"
              className="contact-reveal inline-block font-display text-base sm:text-xl font-bold text-ember hover:text-ember-glow transition-colors duration-300 py-1"
            >
              jewoo.lee@mail.mcgill.ca
            </a>

            <div className="contact-reveal flex items-center gap-5 sm:gap-6 mt-6 sm:mt-8">
              {socialLinks.map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-display text-[11px] font-bold tracking-widest uppercase text-faint hover:text-ember transition-colors duration-300"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>

          <form
            action="https://getform.io/f/akknzgea"
            method="POST"
            className="contact-reveal space-y-4"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <input
                type="text"
                name="name"
                autoComplete="name"
                required
                placeholder="Name"
                className="text-field"
              />
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                placeholder="Email"
                className="text-field"
              />
            </div>

            <textarea
              name="message"
              placeholder="Your message..."
              required
              className="text-field resize-y min-h-32 max-h-80"
            />

            <button
              type="submit"
              className="btn btn-primary w-full [&]:max-w-full justify-center"
            >
              Send Message
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}

export default Contact
