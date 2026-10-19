// Projects (L442–449, then Joblog appended as p9 so p:0 stays RecycleWise; D15).

export const PROJECTS = [
  {
    title: 'RecycleWise',
    image: 'recyclewise',
    host: 'GitHub',
    url: 'https://github.com/jewoolee0502/RecycleWise',
    live: 'https://recyclewise-ten.vercel.app',
    tags: ['React.js', 'Supabase', 'PostgreSQL', 'Google Maps API', 'QR Code'],
    blurb:
      'A recycling platform for Montréal that connects people with local recycling centres. It has a map-based finder, a points system with QR-code verification by businesses, and separate dashboards for users, businesses and admins. Built as a McGill capstone project.',
  },
  {
    title: 'WhenAreYouFree',
    image: 'whenareyoufree',
    host: 'GitHub',
    url: 'https://github.com/jewoolee0502/WhenAreYouFree',
    tags: ['Azure DevOps', 'Express.js', 'Vue/Nuxt.js', 'PostgreSQL', 'Prisma ORM'],
    blurb:
      'A scheduling app that plugs into Google Calendar, Microsoft Outlook and Apple iCloud to find the time everyone is free. Built with Bun, Express, Prisma, Nuxt and PostgreSQL.',
  },
  {
    title: 'Duonosaur',
    image: 'duonosaur',
    host: 'Devpost',
    url: 'https://devpost.com/software/duonosaur',
    repo: 'https://github.com/jewoolee0502/CodeJam15-Duonosaur',
    live: 'https://duonosaur.vercel.app',
    tags: ['React Native', 'TypeScript', 'Speech Recognition API', 'Node.js'],
    blurb:
      'French-learning games built at McGill CodeJam 15. In Dinolingo, a Chrome-dino-style runner, you jump and duck by saying French words out loud, using on-device speech recognition. In Grammaire Smash!, a whack-a-mole, you smash the moles holding AI-generated French sentences with grammar mistakes.',
  },
  {
    title: 'MenuLens',
    image: 'menulens',
    host: 'Devpost',
    url: 'https://devpost.com/software/menulens',
    repo: 'https://github.com/jewoolee0502/Mchacks12',
    tags: ['OCR', 'AI Prompting', 'Prompt Engineering', 'Python'],
    blurb:
      'Built at McHacks 12. Snap a photo of a menu and MenuLens parses it, translates it into your language, converts prices into your currency, and adds descriptions, ingredients and photos. Allergy and category filters plus a cart total up your order.',
  },
  {
    title: 'Martlet Nest',
    image: 'marletnests',
    host: 'Devpost',
    url: 'https://devpost.com/software/martlet-s-nest',
    repo: 'https://github.com/jewoolee0502/Martlet-Nest-CodeJam14',
    tags: ['API', 'Python', 'Realtime Database'],
    blurb:
      'A housing board for McGill students, built at McGill CodeJam 14. Students sign in with a McGill email (Firebase auth) to browse and post listings for rent, sale, exchange or roommates, and set up meetings with the poster.',
  },
  {
    title: 'adStar',
    image: 'adstar',
    host: 'Devpost',
    url: 'https://devpost.com/software/adstar',
    repo: 'https://github.com/jewoolee0502/adStar',
    draft: true,
    tags: ['Machine Learning', 'API', 'Data Analysis'],
    blurb:
      'An ad planner for digital screens. Advertisers pick a screen and book hourly slots across the week, backed by machine learning and data analysis.',
  },
  {
    title: 'HTTP · Health and Toning Targeted Program',
    image: 'http',
    host: 'GitHub',
    url: 'https://github.com/jewoolee0502/ECSE428_HTTP',
    draft: true,
    tags: ['Spring Boot', 'SQL', 'React', 'Agile/Scrum'],
    blurb: 'A fitness program app with customer and admin sign-in, built in Agile/Scrum sprints for McGill ECSE 428.',
  },
  {
    title: 'Library Management System',
    image: 'library',
    host: 'GitHub',
    url: 'https://github.com/jewoolee0502/project-group-04',
    tags: ['Java', 'Gradle', 'Vue', 'Web/Android/iOS'],
    blurb:
      'A website and Android app where members search, reserve and check out library items and get due-date reminders, while librarians manage items and opening hours. McGill ECSE 321 team project, Fall 2021, built over four sprints.',
  },
  {
    title: 'Joblog',
    image: 'joblog',
    host: 'GitHub',
    url: 'https://github.com/jewoolee0502/Joblog',
    live: 'https://joblog-nine.vercel.app',
    tags: ['React', 'TypeScript', 'Express', 'Prisma', 'PostgreSQL/Supabase', 'Claude API', 'Chrome Extension'],
    blurb:
      'An AI-powered job-application tracker. Applications move through a Kanban pipeline, an LLM classifier reads Gmail or Outlook emails and moves each one to the right stage automatically, and a Chrome extension saves job postings in one click. Follow-up nudges and analytics keep the search moving.',
  },
]

/** Public URL of a project's optimized image. */
export const projectImage = (p) => `/img/projects/${p.image}.webp`
