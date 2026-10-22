// Who Jay is: identity, contact, about text and the recruiter summary.
import { PROJECTS } from './projects.js'
import { resolveSiteUrl } from './site.js'

export const PROFILE = {
  name: 'Jewoo (Jay) Lee',
  short: 'Jay',
  tagline: 'Full-stack developer · B.Eng. Computer Engineering, McGill · Montréal',
  email: 'jewoo.lee@mail.mcgill.ca',
  links: {
    github: 'https://github.com/jewoolee0502',
    linkedin: 'https://www.linkedin.com/in/jewoo-lee/',
    instagram: 'https://www.instagram.com/jwuu_lee/',
  },
  instagramHandle: 'jwuu_lee',
  cv: '/files/JEWOOLEE_CV.pdf',
  getform: 'https://getform.io/f/akknzgea',
  // Build-time VITE_SITE_URL, default https://jewoo-lee.vercel.app (see site.js).
  site: resolveSiteUrl(import.meta.env.VITE_SITE_URL),
  greeting: "Hi, I'm Jewoo. Call me Jay.",
  about:
    "I'm a Computer Engineering student at McGill who loves building full-stack apps, exploring AI, and solving real-world problems with code. I also served as a Sergeant in the Republic of Korea Marine Corps, where I learned that nothing is impossible when you work as a team.",
  facts: [
    { label: 'NOW', value: 'Montréal, QC' },
    { label: 'STUDYING', value: 'B.Eng. Computer Engineering, McGill' },
    { label: 'SPEAKS', value: 'Korean, English' },
    { label: 'STATUS', value: 'Available for work', dot: true },
  ],
  education: {
    school: 'McGill University',
    degree: 'B.Eng. Computer Engineering',
    dates: 'Jan 2020 – Dec 2025',
  },
  resumeTags: ['Vue / Nuxt', 'React', 'GraphQL', 'Firebase', 'PostgreSQL', 'Spring Boot', 'Python', 'Java'],
  recruiter: [
    'Wholesale Express (2025): Vue/Nuxt, GraphQL and Firebase on a dealer vehicle-auction platform. Intern, then part-time on the v2 upgrade.',
    'Container Foam (2025): PostgreSQL schema, Google Document AI and DeepSeek for a cocktail recommender',
    `${PROJECTS.length} projects, including RecycleWise (McGill capstone), WhenAreYouFree and Duonosaur`,
    'Sergeant, ROK Marine Corps (2022–24). Korean / English interpreter in joint USMC exercises.',
  ],
}
