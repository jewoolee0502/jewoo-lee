/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */

import { useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import ExperienceCard from './ExperienceCard'

const experiences = [
  {
    title: 'Full-Stack Developer',
    company: 'Wholesale Express',
    date: 'Aug – Dec 2025',
    description: `Transitioned from internship to permanent contract with increased technical ownership. Led platform-wide v2 upgrade, modernizing frontend and reorganizing backend services with GraphQL and Firebase Realtime Database.\n\nTook on deeper backend-focused work optimizing API calls, improving data synchronization, and enhancing platform reliability. Collaborated remotely in an Agile environment while independently driving technical improvements.`
  },
  {
    title: 'Full-Stack Developer (Internship)',
    company: 'Wholesale Express',
    date: 'May – Aug 2025',
    description: `Contributed to a large-scale vehicle auction platform enabling car dealerships to buy and sell vehicles. Built features using Vue.js/Nuxt frontend with Firebase and GraphQL backend in Agile two-week sprints.\n\nDeveloped a public vehicle information page for sharing data with non-members via secure email links. Adapted to a fully remote team by proactively scheduling meetings and building cross-functional communication.`
  },
  {
    title: 'Back-End Developer',
    company: 'Container Foam',
    date: 'Mar – May 2025',
    description: `Built Cocktail App, a personalized drink recommendation platform suggesting recipes based on mood, preferences, and available ingredients. Designed PostgreSQL schema and integrated Google Document AI for recipe extraction.\n\nLeveraged OpenRouter DeepSeek AI for real-time cocktail recommendations. Delivered all assigned tasks within a two-month scope, establishing scalable infrastructure.`
  },
  {
    title: 'Credit Risk Analyst (Internship)',
    company: 'CI Guarantee',
    date: 'Apr – Jul 2024',
    description: `Evaluated financial credibility of partner companies by analyzing annual statements, cash flow reports, and ownership credit data. Translated insights into quantitative risk scores to support loan and insurance decisions.\n\nServed as point of contact for clients regarding rankings and guided them through credit evaluation applications.`
  },
  {
    title: 'Communication & Intelligence Marine',
    company: 'Republic of Korea Marine Corps',
    date: 'Sep 2022 – Mar 2024',
    description: `Advanced from Private First Class to Sergeant as a Communication and Intelligence Marine. Facilitated critical communication between U.S. and Korean Marine Corps during joint operations including FreedomShield and Ssang Yong exercises.\n\nProvided linguistic and cultural interpretation in high-intensity training environments, strengthening leadership and cross-cultural collaboration skills under extreme pressure.`
  },
  {
    title: 'Project Management (Internship)',
    company: 'Hansan Global',
    date: 'Jun – Sep 2021',
    description: `Supported launch of Korean cosmetics import business in the Egyptian market. Conducted market research evaluating consumer demand and distribution channels.\n\nDeveloped social media marketing strategy leading to successful product sales during pilot phase. Engaged directly with CEOs and retail companies to initiate partnerships.`
  },
  {
    title: 'Project Support Assistant (Internship)',
    company: 'KOTRA',
    date: 'Jun – Jul 2019',
    description: `Provided operational and presentation support for projects promoting Korean businesses abroad at Korea Trade-Investment Promotion Agency. Delivered client-facing presentations and handled inquiries with cultural sensitivity.`
  }
]

const Experience = ({ isDesktop }) => {
  const sectionRef = useRef(null)

  useGSAP(() => {
    const label = sectionRef.current.querySelector('.section-label')
    const items = sectionRef.current.querySelectorAll('.exp-item')

    if (!isDesktop) {
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top 75%',
        once: true,
        onEnter: () => {
          const tl = gsap.timeline()
          tl.fromTo(label, { x: -30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: 'power3.out', clearProps: 'all' })
            .fromTo(items,
              { opacity: 0, y: 25 },
              { opacity: 1, y: 0, stagger: 0.06, duration: 0.5, ease: 'power2.out', clearProps: 'all' },
              '-=0.3'
            )
        }
      })
    }
  }, { scope: sectionRef, dependencies: [] })

  return (
    <section
      id="experience"
      ref={sectionRef}
      className={isDesktop ? 'p-12 lg:p-16 xl:p-20' : 'section'}
    >
      <div className={isDesktop ? '' : 'container'}>
        {/* Section label */}
        <div className="section-label flex items-center gap-4 mb-8 sm:mb-14">
          <span className="font-display text-[11px] font-bold tracking-[0.25em] uppercase text-ember">
            Experience
          </span>
          <div className="flex-1 h-px bg-gradient-to-r from-ember/20 to-transparent" />
        </div>

        <div>
          {experiences.map((exp, index) => (
            <div key={index}>
              <div className="exp-item">
                <ExperienceCard
                  title={exp.title}
                  company={exp.company}
                  date={exp.date}
                  description={exp.description}
                />
              </div>
              {index < experiences.length - 1 && (
                <div className="h-px bg-ink/[0.04]" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Experience
