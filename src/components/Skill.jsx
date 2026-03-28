/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */

import { useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

const skillCategories = [
  {
    category: 'Languages',
    skills: ['Python', 'Java', 'JavaScript', 'TypeScript']
  },
  {
    category: 'Frontend',
    skills: ['React', 'Vue.js', 'Nuxt', 'Tailwind CSS']
  },
  {
    category: 'Backend & Data',
    skills: ['Spring Boot', 'Firebase', 'Supabase', 'PostgreSQL', 'SQL', 'MongoDB', 'NumPy']
  },
  {
    category: 'Tools',
    skills: ['Git', 'Azure', 'Figma']
  }
]

const Skill = ({ isDesktop }) => {
  const sectionRef = useRef(null)

  useGSAP(() => {
    const label = sectionRef.current.querySelector('.section-label')
    const rows = sectionRef.current.querySelectorAll('.skill-row')

    if (!isDesktop) {
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top 75%',
        once: true,
        onEnter: () => {
          const tl = gsap.timeline()
          tl.fromTo(label, { x: -30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: 'power3.out', clearProps: 'all' })
            .fromTo(rows,
              { opacity: 0, x: -40 },
              { opacity: 1, x: 0, stagger: 0.12, duration: 0.7, ease: 'power3.out', clearProps: 'all' },
              '-=0.3'
            )
        }
      })
    }
  }, { scope: sectionRef, dependencies: [] })

  return (
    <section ref={sectionRef} className={isDesktop ? 'p-12 lg:p-16 xl:p-20' : 'section'}>
      <div className={isDesktop ? '' : 'container'}>
        {/* Section label */}
        <div className="section-label flex items-center gap-4 mb-8 sm:mb-14">
          <span className="font-display text-[11px] font-bold tracking-[0.25em] uppercase text-ember">
            Skills
          </span>
          <div className="flex-1 h-px bg-gradient-to-r from-ember/20 to-transparent" />
        </div>

        <div className="space-y-0">
          {skillCategories.map(({ category, skills }, i) => (
            <div
              key={category}
              className="skill-row group flex flex-col sm:flex-row sm:items-baseline gap-1.5 sm:gap-10 py-5 sm:py-7 border-b border-ink/[0.04] last:border-b-0"
            >
              <span className="font-display text-xs sm:text-sm font-bold tracking-wider uppercase text-ember/80 shrink-0 sm:w-40">
                {category}
              </span>
              <div className="flex flex-wrap gap-x-1 gap-y-1">
                {skills.map((skill, j) => (
                  <span key={skill} className="font-body text-base sm:text-lg text-muted group-hover:text-ink transition-colors duration-500">
                    {skill}{j < skills.length - 1 && <span className="text-faint mx-2">/</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Skill
