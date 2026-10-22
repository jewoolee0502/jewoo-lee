// Skills (L461–466). Joblog is appended to "used in" for TypeScript, React and PostgreSQL (D15).

export const CAT = {
  lang: { label: 'Language', color: '#2F7FD0' },
  fw: { label: 'Framework', color: '#E0702E' },
  data: { label: 'Data', color: '#1F9A63' },
  tool: { label: 'Tool', color: '#8A62D6' },
}

export const SKILLS = [
  ['Python', 'Language', 'lang', ['MenuLens', 'Martlet Nest']],
  ['Java', 'Language', 'lang', ['Library Management System']],
  ['JavaScript', 'Language', 'lang', ['Duonosaur', 'this website']],
  ['TypeScript', 'Language', 'lang', ['Duonosaur', 'Joblog']],
  ['CSS', 'Styling', 'lang', ['this website']],
  ['Vue.js', 'Framework', 'fw', ['WhenAreYouFree', 'Library Management System', 'Wholesale Express']],
  ['Nuxt', 'Framework', 'fw', ['WhenAreYouFree', 'Wholesale Express']],
  ['React', 'Framework', 'fw', ['RecycleWise', 'HTTP', 'this website', 'Joblog']],
  ['Spring Boot', 'Backend framework', 'fw', ['HTTP']],
  ['Tailwind', 'CSS framework', 'fw', ['the previous version of this site']],
  ['Firebase', 'Realtime database', 'data', ['Wholesale Express']],
  ['PostgreSQL', 'Relational database', 'data', ['RecycleWise', 'WhenAreYouFree', 'Container Foam', 'Joblog']],
  ['MongoDB', 'Document database', 'data', []],
  ['NumPy', 'Data processing', 'data', []],
  ['Git', 'Version control', 'tool', ['every project here']],
  ['Figma', 'Design tool', 'tool', ['the current site design']],
].map(([name, label, cat, usedIn]) => ({ name, label, cat, usedIn }))
