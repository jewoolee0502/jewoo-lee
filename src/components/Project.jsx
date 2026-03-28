/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */

import { useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

const projects = [
  {
    imgSrc: '/images/RecycleWise.png',
    title: 'RecycleWise',
    description: 'Smart recycling platform with QR scanning and Google Maps integration',
    tags: ['React.js', 'Supabase', 'PostgreSQL', 'Google Maps API'],
    projectLink: 'https://github.com/jewoolee0502/RecycleWise'
  },
  {
    imgSrc: '/images/WhenAreYouFree.png',
    title: 'WhenAreYouFree',
    description: 'Scheduling coordination app built with modern full-stack tools',
    tags: ['Vue/Nuxt.js', 'Express.js', 'PostgreSQL', 'Prisma ORM'],
    projectLink: 'https://github.com/jewoolee0502/WhenAreYouFree'
  },
  {
    imgSrc: '/images/Duonosaur.png',
    title: 'Duonosaur',
    description: 'Mobile language learning game with speech recognition',
    tags: ['React Native', 'TypeScript', 'Speech Recognition API'],
    projectLink: 'https://devpost.com/software/duonosaur'
  },
  {
    imgSrc: '/images/MenuLens.png',
    title: 'MenuLens',
    description: 'AI-powered menu translator using OCR and prompt engineering',
    tags: ['Python', 'OCR', 'AI Prompting'],
    projectLink: 'https://devpost.com/software/menulens'
  },
  {
    imgSrc: '/images/MarletNests.png',
    title: 'Marlet Nests',
    description: 'Real-time housing platform for McGill students',
    tags: ['Python', 'API', 'Realtime Database'],
    projectLink: 'https://devpost.com/software/martlet-s-nest'
  },
  {
    imgSrc: '/images/adStar.png',
    title: 'adStar',
    description: 'Ad performance analysis with machine learning predictions',
    tags: ['Machine Learning', 'API', 'Data Analysis'],
    projectLink: 'https://devpost.com/software/adstar'
  },
  {
    imgSrc: '/images/HTTP.png',
    title: 'HTTP',
    description: 'Health and toning workout tracking application',
    tags: ['SpringBoot', 'SQL', 'React', 'Agile'],
    projectLink: 'https://github.com/jewoolee0502/ECSE428_HTTP'
  },
  {
    imgSrc: '/images/Library.png',
    title: 'Library Management System',
    description: 'Full-stack library app across web and mobile platforms',
    tags: ['Java', 'Gradle', 'Vue', 'Agile'],
    projectLink: 'https://github.com/jewoolee0502/project-group-04'
  },
]

const Project = ({ isDesktop }) => {
  const sectionRef = useRef(null)

  useGSAP(() => {
    const label = sectionRef.current.querySelector('.section-label')
    const items = sectionRef.current.querySelectorAll('.project-item')

    if (!isDesktop) {
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top 70%',
        once: true,
        onEnter: () => {
          const tl = gsap.timeline()
          tl.fromTo(label,
            { x: -30, opacity: 0 },
            { x: 0, opacity: 1, duration: 0.6, ease: 'power3.out', clearProps: 'all' }
          )
          .fromTo(items,
            { opacity: 0, y: 30 },
            { opacity: 1, y: 0, stagger: 0.08, duration: 0.6, ease: 'power3.out', clearProps: 'all' },
            '-=0.3'
          )
        }
      })
    }
  }, { scope: sectionRef, dependencies: [] })

  return (
    <section
      id="project"
      ref={sectionRef}
      className={isDesktop ? 'p-12 lg:p-16 xl:p-20' : 'section'}
    >
      <div className={isDesktop ? '' : 'container'}>
        {/* Section label */}
        <div className="section-label flex items-center gap-4 mb-8 sm:mb-14">
          <span className="font-display text-[11px] font-bold tracking-[0.25em] uppercase text-ember">
            Projects
          </span>
          <div className="flex-1 h-px bg-gradient-to-r from-ember/20 to-transparent" />
        </div>

        <div className="space-y-0">
          {projects.map(({ imgSrc, title, description, tags, projectLink }, index) => (
            <div key={index}>
              <a
                href={projectLink}
                target="_blank"
                rel="noopener noreferrer"
                className="project-item group grid grid-cols-1 sm:grid-cols-[1fr,auto] gap-4 sm:gap-6 py-5 sm:py-7 transition-all duration-500"
                data-cursor-view
              >
                <div className="flex items-start gap-4 sm:gap-6">
                  {/* Index number */}
                  <span className="font-display text-sm sm:text-base font-bold text-faint/40 pt-1 shrink-0">
                    _{String(index + 1).padStart(2, '0')}.
                  </span>

                  <div className="flex flex-col justify-center">
                    <h3 className="font-display text-lg sm:text-2xl font-bold tracking-tight text-ink group-hover:text-ember transition-colors duration-400">
                      {title}
                    </h3>
                    <p className="font-body text-sm sm:text-[15px] text-muted mt-1.5 sm:mt-2 max-w-md italic">
                      {description}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {tags.slice(0, 3).map((tag, i) => (
                        <span
                          key={i}
                          className="font-display text-[10px] font-medium tracking-wider uppercase text-faint group-hover:text-muted transition-colors duration-400"
                        >
                          {tag}{i < Math.min(tags.length, 3) - 1 ? ' \u00B7' : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Thumbnail — always visible */}
                <div className="relative w-full sm:w-52 aspect-[16/10] sm:aspect-video rounded-lg overflow-hidden bg-surface shrink-0 border border-ink/[0.04]">
                  <img
                    src={imgSrc}
                    alt={title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-void/0 group-hover:bg-void/30 transition-all duration-500">
                    <span className="material-symbols-rounded text-ink opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 group-hover:rotate-45 transition-all duration-500 text-xl">
                      arrow_outward
                    </span>
                  </div>
                </div>
              </a>
              {index < projects.length - 1 && (
                <div className="h-px bg-ink/[0.04]" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Project
