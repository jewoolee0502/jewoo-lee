# Current codebase exploration (feat/website-revamp worktree)

Scope: read-only survey of the current React/Vite portfolio before the revamp. Nothing was modified, no `npm install` was run, and no build/lint was executed (there is no `node_modules`). `design/` was already untracked at start and was only read.

Root: `/Users/jewoo.lee/Desktop/Jewoo/Projects/jewoo-lee/.worktrees/feat-website-revamp`

---

## 1. Stack and tooling

| Area | Current |
|---|---|
| Framework | React 19.1.0 + react-dom 19.1.0 (`"type": "module"`) |
| Build | Vite 6 (lock resolves 6.4.1), `@vitejs/plugin-react` 4.4.1 |
| CSS | Tailwind CSS 3.4.17 via PostCSS (`autoprefixer`), `tailwind-scrollbar` 3.1.0 plugin, Inter font (Google Fonts), Material Symbols Rounded (Google Fonts) |
| Animation / scroll | gsap 3.13.0, @gsap/react 2.1.2 (`useGSAP`), ScrollTrigger, lenis 1.3.4 (`ReactLenis root`) |
| Analytics | @vercel/analytics 1.5.0 (`<Analytics />` in `main.jsx`) |
| Other runtime deps | prop-types 15.8.1 (used for all component propTypes) |
| Lint | ESLint 9.27.0 (flat config), `@eslint/js`, `globals`, `eslint-plugin-react-hooks` 5.x, `eslint-plugin-react-refresh` 0.4.x |
| Types | `@types/react`, `@types/react-dom` installed but project is plain JS/JSX (no tsconfig) |
| Lockfile | `package-lock.json`, lockfileVersion 3 (npm) |
| Hosting | Vercel (per README). No `vercel.json`, no `.vercel/` dir. |
| License | Apache-2.0 (LICENSE file, full text). File headers say `@copyright 2025 Jewoo Lee` / `@license Apache-2.0`. |

### Scripts (package.json)
- `npm run dev` -> `vite`
- `npm run build` -> `vite build` (outputs `dist/`, which is gitignored)
- `npm run lint` -> `eslint .`
- `npm run preview` -> `vite preview`

README still says `npm start` (does not exist in scripts). README also says "Node.js v16 or later recommended". That is stale.

### Node version constraints
- No `engines` field in package.json, no `.nvmrc`, no `.node-version`.
- Vite 6 requires Node 18, 20 or 22+ (its own engines field). Node 16 from the README would not work with Vite 6.
- ESLint 9 flat config (`eslint.config.js`) requires Node 18.18+ (its own engines field).
- Recommendation for the revamp: add `"engines": {"node": ">=20.19"}` (or `>=20`) and/or an `.nvmrc`, and fix the README.

### Config files (verbatim summaries)
- `vite.config.js`: `defineConfig({ plugins: [react()] })`. Nothing else.
- `postcss.config.js`: `tailwindcss: {}`, `autoprefixer: {}`.
- `tailwind.config.js`: content = `./index.html`, `./src/**/*.{js,ts,jsx,tsx}`. Only extends `fontFamily.sans = ['Inter', 'sans-serif']`. Plugin `tailwind-scrollbar`. No color tokens, no custom screens. Everything custom is in `src/index.css` with `@apply`.
- `eslint.config.js`: ignores `dist`; `files: **/*.{js,jsx}`; `js.configs.recommended` + react-hooks recommended; `no-unused-vars` with `varsIgnorePattern: '^[A-Z_]'`; `react-refresh/only-export-components` as warn. No `eslint-plugin-react` (so no jsx-prop-types rules).
- `.gitignore`: node_modules, dist, dist-ssr, *.local, editor/OS files, logs. Standard Vite template.
- `index.html`: `lang="en"`, `<html class="scrollbar-thin scrollbar-track-zinc-800 scrollbar-thumb-zinc-500">`, title `Jewoo Lee - Portfolio`, favicon `/images/favicon.svg`, preconnects + Google Fonts for Inter (400/500/600) and Material Symbols Rounded. Body only has `<div id="root">`.
- `src/main.jsx`: `StrictMode` + `App` + `<Analytics />`; imports `./index.css` and `lenis/dist/lenis.css`.
- `src/App.jsx`: registers `useGSAP` and `ScrollTrigger`; one `useGSAP` block that finds all `.reveal-up` elements and animates them to `y: 0, opacity: 1` on scroll (scrub: true). Layout: `ReactLenis root` > `Header`, `<main>` (Hero, About, Skill, Project, Experience, Contact), `Footer`.

### Test framework
**None.** No vitest, jest, playwright, or @testing-library in package.json, package-lock.json or src. No test files, no `test` script.

---

## 2. Component inventory and content

### src/index.css (styles)
- Tailwind layers, `html { scroll-behavior: smooth }`, `body { bg-zinc-900 text-zinc-50 }`.
- Custom classes: `.headline-1` (gradient text, 5xl / lg 55px), `.headline-2` (3xl / lg 4xl), `.title-1` (22px), `.material-symbols-rounded`, `.container` (px-4, lg px-8, xl max-w-6xl), `.img-box`, `.img-cover`, `.section` (pt-20 / lg pt-32), `.reveal-up` (translate-y-20, opacity-0), `.menu-btn`, `.navbar` (mobile dropdown; desktop inline at md), `.nav-link`, `.active-box`, `.btn`, `.btn-secondary`, `.btn-primary` (sky-400), `.btn-outline`, `.label`, `.text-field`.
- Dark-only palette: zinc-900 base, zinc-800 cards, sky-400 accent, emerald-400 availability dot. No light theme.

### src/components/Header.jsx
- Fixed header, `h1` containing logo link `/` with `/images/logo.svg` (40x40, alt "Jewoo Lee").
- Mobile menu button (Material icon `menu` / `close`) toggles `Navbar`.
- Desktop-only "Contact Me" button -> `#contact`.

### src/components/Navbar.jsx
- Nav items (in order): Home `#home` (initially `active`), About `#about`, Projects `#project`, Experience `#experience`, Contact `#contact` (`md:hidden`, mobile only).
- Sliding "active-box" highlight, positioned via DOM refs. Scroll listener picks active section from `section[id]` elements (ids: home, about, project, experience, contact).
- Note: Skill section has no id, so it is not in the nav. Footer has no id.

### src/components/Hero.jsx
- Availability row: green pulsing dot + "Available for Work".
- Portrait thumbnail `/images/jewoolee1.jpg` (alt "Jewoo Lee portrait").
- H2 headline (`headline-1`): **"Jewoo (Jay) Lee"**. There is no separate tagline/subtitle.
- Buttons: `ButtonPrimary` "Download CV" (icon `download`) -> `/files/JEWOOLEE_CV.pdf` (target _blank); `ButtonOutline` "Scroll down" (icon `arrow_downward`) -> `#about`.
- Desktop only (lg+): large portrait `/images/jewoolee_edited.webp` (656x800 attr) inside a sky gradient rounded frame.

### src/components/About.jsx
- Paragraph, exact text:
  > Hi 👋 I'm Jewoo (Jay), a passionate and detail-oriented Computer Engineering student at McGill University with a strong interest in software development, AI, and full-stack web technologies. I thrive on solving real-world problems through code and have experience building dynamic applications using modern frameworks. This website showcases my projects, technical skills, and experiences as I continue growing as a developer and aspiring engineer.
- Stats (`aboutItems`): `10+` "Project done"; `1+` "Years of experience".
- Logo `/images/logo.svg` at the right edge.

### src/components/Skill.jsx + SkillCard.jsx
- Heading (`headline-2`): **"Essential Tools I use"**
- Sub-copy: "Discover the powerfull tools and technologies I use to create exceptional, high-performing websites & applications." (typo "powerfull" is in the source)
- Grid of 16 cards (`imgSrc`, label, desc):

| # | Label | Icon path | Desc |
|---|---|---|---|
| 1 | Python | /images/python-5.svg | Programming Language |
| 2 | Java | /images/java-4.svg | Programming Language |
| 3 | Figma | /images/figma.svg | Design tool |
| 4 | CSS | /images/css3.svg | User Interface |
| 5 | JavaScript | /images/javascript.svg | Interaction |
| 6 | TypeScript | /images/typescript.svg | Interaction |
| 7 | Vue.js | /images/vue-9.svg | Framework |
| 8 | Nuxt | /images/nuxt-2.svg | Web Framework |
| 9 | Firebase | /images/firebase-1.svg | Realtime Database |
| 10 | PostgreSQL | /images/postgresql.svg | Object-Relational Database |
| 11 | MongoDB | /images/mongodb.svg | Database |
| 12 | Spring Boot | /images/spring-boot-1.svg | Backend Framework |
| 13 | React | /images/react.svg | Framework |
| 14 | TailwindCSS | /images/tailwindcss.svg | Framework |
| 15 | Git | /images/git-bash.svg | Version Control |
| 16 | Numpy | /images/numpy-1.svg | Data Processing |

- SkillCard: 48px icon tile (32x32 img), label h3, desc. `alt` = label. Note: `SkillCard` has a bug-looking className concatenation (`... transition-colors group:` + classes), so `reveal-up` is appended after `group:` and likely has no effect as a class name.

### src/components/Project.jsx + ProjectCard.jsx
- Heading (`headline-2`): **"My Portfolio Highlights"**
- Grid of 8 cards, all rendering an image (aspect-square), title, tag chips, arrow button, and whole-card link (new tab):

| # | Title (as shown) | Image | Tags | Link |
|---|---|---|---|---|
| 1 | RecycleWise | /images/RecycleWise.webp | React.js, Supabase, PostgreSQL, Google Maps API, QR Code | https://github.com/jewoolee0502/RecycleWise |
| 2 | WhenAreYouFree | /images/WhenAreYouFree.webp | Azure DevOps, Express.js, Vue/Nuxt.js, PostgreSQL, Agile, Prisma ORM | https://github.com/jewoolee0502/WhenAreYouFree |
| 3 | Duonosaur | /images/Duonosaur.webp | React Native, JavaScript/TypeScript, Speech Recognition API, Node.js | https://devpost.com/software/duonosaur |
| 4 | MenuLens | /images/MenuLens.webp | API, OCR, AI Prompting, Prompt Engineering, Python | https://devpost.com/software/menulens |
| 5 | Marlet Nests (sic; prototype says "Martlet Nest") | /images/MarletNests.webp | API, Python, Realtime Database | https://devpost.com/software/martlet-s-nest |
| 6 | adStar | /images/adStar.webp | Machine Learning, API, Data Analysis | https://devpost.com/software/adstar |
| 7 | Health and Toning Targeted Program (HTTP) | /images/HTTP.webp | SpringBoot, SQL, React, Agile/Scrum | https://github.com/jewoolee0502/ECSE428_HTTP |
| 8 | Library Management System Application | /images/Library.webp | Java, Gradle, Vue, Web/Android/iOS, Agile/Scrum | https://github.com/jewoolee0502/project-group-04 |

- Bug: `ProjectCard.propTypes.tags` is `PropTypes.string.isRequired` but receives an array.

### src/components/Experience.jsx (timeline)
- Section `id="experience"`, `bg-neutral-900`, heading **"My Career Highlights"**. Alternating left/right timeline cards with a center line and circles. Each card click toggles expand; long descriptions (over 5 lines) are masked with "Show more / Show less". Descriptions are split on `\n\n`.
- Uses `neutral`/`gray` colors, which differ from the zinc palette used elsewhere (inconsistent).
- Bug: `useState`, `useRef`, `useEffect` are called inside `experiences.map(...)`, which breaks the rules of hooks (ESLint `react-hooks/rules-of-hooks` will flag this once lint runs).
- Bug: `"CI Guaranteee"` typo in company name (`CI Guarantee` is correct per prototype).

| # | Title | Company | Date | Full description location |
|---|---|---|---|---|
| 1 | Full-Stack Developer (Part-time) | Wholesale Express | August 2025 – December 2025 | Experience.jsx, `experiences[0]` (v2 upgrade; GraphQL + Firebase RTDB; remote Agile) |
| 2 | Full-Stack Developer (Internship) | Wholesale Express | May 2025 – August 2025 | `experiences[1]` (Vue/Nuxt, Firebase RTDB, GraphQL, public vehicle info page, remote adaptation) |
| 3 | Full-Stack Developer (Part-time) | Container Foam | Mar 2025 – May 2025 | `experiences[2]` (Cocktail App; PostgreSQL schema, Google Document AI, OpenRouter DeepSeek) |
| 4 | Credit Risk Analyst (Internship) | CI Guaranteee [sic] | Apr 2024 – Jul 2024 | `experiences[3]` (credit assessment, client contact) |
| 5 | Sergeant | Republic of Korea Marine Corps (ROKMC) | Sept 2022 – Mar 2024 | `experiences[4]` (Comms & Intelligence Marine; FreedomShield '23/'24, Ssang Yong '23; interpreter) |
| 6 | Project Intern | Hansan Global | Jun 2021 – Sept 2021 | `experiences[5]` (Cairo cosmetics import market research, social media) |
| 7 | Summer Intern | Korea Trade-Investment Promotion Agency (KOTRA) | Jun 2019 – Jul 2019 | `experiences[6]` (operational/presentation support) |

The description paragraphs are long (about 4 to 5 sentences each, 3 to 4 paragraphs for some). They are kept verbatim in the source file rather than duplicated here.

### src/components/Contact.jsx
- Section `id="contact"`. Heading **"Contact Me"**. Sub-copy: "Reach out today to discuss your project needs and start collaborating on something amazing!"
- Social icon buttons (inline SVG, new tab): GitHub `https://github.com/jewoolee0502`; LinkedIn `https://www.linkedin.com/in/jewoo-lee/`; **Instagram `https://www.instagram.com/jwuu_lee/`**.
- Form: `action="https://getform.io/f/akknzgea"` POST (live third-party form endpoint). Fields: Name (`name`, placeholder "John Doe", required), Email (`email`, placeholder "john.doe@example.com", required), Message (`message`, placeholder "Hi! I would love to collaborate with you!", required). Button "Submit" (`btn-primary`).

### src/components/Footer.jsx
- Heading "Let's collaborate!" + `ButtonPrimary` "Start Project" (icon `chevron_right`) -> `mailto:jewoo.lee@mail.mcgill.ca`.
- Sitemap column: Home `#home`, About `#about`, Projects `#project`, Contact Me `#contact`.
- Socials column: GitHub, LinkedIn, Instagram (same URLs as above).
- Logo link `/` and copyright `© 2025 Jewoo Lee`.

### src/components/Button.jsx
- Exports `ButtonPrimary` (`btn btn-primary`) and `ButtonOutline` (`btn btn-outline`). Both render `<a>` when `href` is set, else `<button>`. Optional trailing Material Symbol icon.
- Bug: `ButtonPrimary` passes `relValue={relValue}` (camelCase typo, should be `rel`), so `rel` is not applied to the link.

---

## 3. Public assets and references

### public/images (all referenced from src, none orphaned)
| File | Size (bytes) | Pixel size | Referenced by |
|---|---|---|---|
| jewoolee1.jpg | 135,173 | 413 x 531 | Hero (40px thumbnail, displayed far smaller than source) |
| jewoolee_edited.webp | 43,344 | 806 x 1340 | Hero (desktop portrait) |
| logo.svg | 670 | vector | Header, About, Footer |
| favicon.svg | 1,009 | vector | index.html |
| RecycleWise.webp | 106,000 | 3356 x 1798 | Project card 1 |
| WhenAreYouFree.webp | 25,044 | 1964 x 964 | Project card 2 |
| Duonosaur.webp | 33,662 | 704 x 1538 | Project card 3 |
| MenuLens.webp | 42,988 | 3042 x 1544 | Project card 4 |
| MarletNests.webp | 246,918 | 2736 x 1544 | Project card 5 (largest project image) |
| adStar.webp | 105,724 | 2344 x 1354 | Project card 6 |
| HTTP.webp | 40,344 | 3264 x 1598 | Project card 7 |
| Library.webp | 18,856 | 1772 x 1040 | Project card 8 |
| python-5.svg, java-4.svg, figma.svg, css3.svg, javascript.svg, typescript.svg, vue-9.svg, nuxt-2.svg, firebase-1.svg, postgresql.svg (6,791), mongodb.svg, spring-boot-1.svg, react.svg, tailwindcss.svg, git-bash.svg, numpy-1.svg | 375 to 6,791 each | vector | Skill cards 1 to 16 |

Total `public/images` is about 1.75 MB on disk. Biggest wins: MarletNests (247 KB), RecycleWise and adStar (about 106 KB each), jewoolee1.jpg (135 KB for a 40px thumbnail). Project cards render at about 280 px wide, so the 2000 to 3300 px sources are oversized; resizing to about 800 to 1000 px wide would cut weight substantially.

### public/files
- `public/files/JEWOOLEE_CV.pdf`, 123,843 bytes, PDF 1.5. Referenced by Hero's "Download CV" button (`/files/JEWOOLEE_CV.pdf`) and linked from README.md.

### design/img (prototype only, not in public/)
- adstar.jpg, duonosaur.jpg, http.jpg, jay.jpg, library.jpg, marletnests.jpg, menulens.jpg, recyclewise.jpg, whenareyoufree.jpg. All 420 px wide or smaller. Used by `design/revamp-lab.html`.

### Assets not in public/
- No fonts are self-hosted; Inter and Material Symbols come from Google Fonts.
- No `og:image`, `robots.txt`, `sitemap.xml`, or `manifest` exists. `index.html` has no meta description or OG tags.

---

## 4. Reuse vs delete for a full revamp

| Item | Recommendation | Notes |
|---|---|---|
| Vite 6 + React 19 + `@vitejs/plugin-react` | Reuse | Current, fine. Keep `vite.config.js`. |
| Tailwind 3.4 + PostCSS + autoprefixer | Reuse (or upgrade to v4 deliberately) | Tailwind v4 would need `@tailwindcss/vite` and removal of `tailwind.config.js`, `postcss.config.js`, and `tailwind-scrollbar` plugin (v4 has no v3 plugin API; use `@plugin` or CSS). Decide before the revamp, not during. |
| `tailwind-scrollbar` | Reuse only if the revamp keeps the custom scrollbar; otherwise delete | Used only via `index.html` class names and `tailwind.config.js`. |
| gsap + @gsap/react + ScrollTrigger | Reuse | Good fit for scroll-reveal. Currently only a single `.reveal-up` pattern; the `reveal-up` class is also misused in `SkillCard` (see bug above). |
| lenis (ReactLenis root) | Reuse, but make it optional | Smooth scroll; conflicts with native `scroll-behavior: smooth` in index.css, which should be removed when lenis stays. |
| @vercel/analytics | Reuse | Keep unless the hosting changes. Harmless in dev. |
| prop-types | Delete if converting to TS, otherwise keep | Only used for propTypes in components. |
| Google Fonts (Inter, Material Symbols Rounded) | Reuse or replace | Inter is the Tailwind `sans` default. Material Symbols is used for every icon (menu, close, download, arrow_downward, chevron_right, arrow_outward). The new prototype uses Bricolage Grotesque, Instrument Sans, JetBrains Mono, Silkscreen, VT323, Caveat. Pick one set and self-host if performance matters. |
| favicon.svg | Keep (or replace with the new logo) | 1 KB SVG, referenced in index.html. |
| logo.svg | Keep | Used in Header, About, Footer. |
| `src/components/Experience.jsx` | Rewrite | Hooks-in-map bug, off-palette colors, typo. |
| `src/components/Button.jsx` | Rewrite | `relValue` typo; duplicated ButtonPrimary/ButtonOutline. |
| `src/components/SkillCard.jsx` | Rewrite | Broken class concatenation. |
| `ProjectCard.jsx` tags propType | Fix or rewrite | string vs array. |
| `Navbar.jsx` | Rewrite | Hardcoded active class, direct DOM manipulation. |
| Contact form (getform.io) | Decide | Live endpoint `akknzgea`. Keep if the form still goes to the same inbox; otherwise move to a new service or `mailto`. |
| `design/` directory | Keep until the revamp ships | Untracked. Holds the prototype and thumbnails. Remove or commit before merge. |
| `package-lock.json` | Keep and regenerate after dependency changes | |
| `README.md` | Rewrite | Says `npm start`, "Node v16", and "Dark theme"; also a placeholder clone URL. |

---

## 5. Recommendations

### 5.1 Test setup (Vitest + Testing Library + jsdom)

Compatible with React 19.1, Vite 6.x, Node 20+.

Versions to pin (all at least 2 weeks old per the project's version rule; confirm the current latest on install):
- `vitest` 3.x (Vite 6 compatible; Vitest 4 targets Vite 6/7 but check peer deps first)
- `@testing-library/react` 16.x (supports React 19 and needs `@testing-library/dom` as a peer)
- `@testing-library/dom` 10.x
- `@testing-library/jest-dom` 6.x (import in `vitest.setup.js`)
- `@testing-library/user-event` 14.x (optional, for interactions such as the Navbar and Experience toggles)
- `jsdom` 25.x or 26.x

Suggested wiring:
- Add `"test": "vitest run"` and `"test:watch": "vitest"` to package.json scripts.
- Add to `vite.config.js`:
  ```js
  test: { environment: 'jsdom', setupFiles: './vitest.setup.js', globals: false }
  ```
  (Vitest reads this from the same config; `defineConfig` from `vitest/config` is the typed option.)
- Create `vitest.setup.js` importing `@testing-library/jest-dom/vitest`.
- ESLint: add `globals.node` or a `files: ['**/*.test.{js,jsx}']` override with `globals.vitest` (or `globals.jest`) so `describe`/`it` are not flagged by `no-undef`.
- Test priority for this site: `Experience` (expand/collapse, overflow detection uses `getComputedStyle` and `scrollHeight`, which jsdom returns as 0, so mock it), `Navbar` (active-link state), `Button` (`rel` regression test), `SkillCard`/`ProjectCard` rendering from data, and `Contact` (required fields and form action).
- GSAP and Lenis: mock `lenis/react` and stub `gsap.to` or skip `App` in unit tests. Render components in isolation.
- No Playwright is recommended until the revamp is stable. A 3D canvas scene needs visual regression tests, which are a separate decision.

### 5.2 Adding `three` (for the 3D prototype)

- The prototype currently loads Three.js r128 and CSS3DRenderer from cdnjs and jsdelivr (`design/revamp-lab.html` lines 427 and 428). That is old and not version-pinned to an npm package.
- For the real site: `npm install three` (pin to the current major/minor, at least 2 weeks old). Use ES module imports, e.g. `import * as THREE from 'three'` and `import { CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js'`. The `three/examples/js/...` path used by the prototype is removed in recent versions; use `three/addons/`.
- Option A: raw three.js in a `useEffect` with a ref, cleaned up on unmount (dispose renderer, geometries, materials, cancel the animation frame). Fits the prototype's approach.
- Option B: `@react-three/fiber` + `@react-three/drei`. The prototype's own note mentions R3F as the "real" path. R3F 9.x targets React 19. Check its peer deps against React 19.1 before adding.
- Lazy-load the 3D scene (`React.lazy` or dynamic `import('three')`) and keep the hero's `lg:block` fallback image so mobile does not download Three.js.
- Testing: stub the WebGL context in jsdom (`HTMLCanvasElement.prototype.getContext` returns null) and assert the fallback renders.

### 5.3 Other quick wins
- Add `"engines"` (Node 20+) and an `.nvmrc`.
- Fix README (`npm start` does not exist, Node v16 claim, placeholder clone URL).
- Add meta description and OG tags to `index.html`; add `public/robots.txt` if desired.
- Resize `public/images/*.webp` project images to about 1000 px wide; downsize `jewoolee1.jpg` (about 40 KB target).
- Fix the Experience hooks-in-map bug and the Button `relValue` typo before lint is enforced.

---

## 6. Content gaps: current site vs revamp prototype (`design/revamp-lab.html`)

Method: string search over the prototype HTML (Python `str.count`). Counts are substring matches, so treat "present" as "mentioned," not "faithfully reproduced."

### Projects: all 8 present in the prototype
- RecycleWise, WhenAreYouFree, Duonosaur, MenuLens, Martlet Nest (current site says "Marlet Nests"), adStar (prototype notes its README is a stock Flask template), HTTP (prototype notes the ECSE428_HTTP repo is private, so its link 404s for visitors), Library Management System (current title is "Library Management System Application").

### Roles: all 7 entries present, though summarized differently
- Wholesale Express x2 (prototype combines them into one bullet "Wholesale Express (2025): Vue/Nuxt, GraphQL and Firebase ... Intern, then part-time").
- Container Foam (Cocktail App, PostgreSQL schema, Google Document AI, DeepSeek).
- CI Guarantee (prototype spells it correctly).
- ROK Marine Corps (prototype: "Sergeant, ROK Marine Corps (2022–24). Korean / English interpreter in joint USMC exercises.").
- Hansan Global (Cairo, Project Intern, Jun 2021 to Sep 2021).
- KOTRA (Summer Intern, 2019).

### Skills: all 16 present (counts are substring matches)
- Python 4, Java 5, JavaScript 2, TypeScript 2, CSS 7, Vue 8, Nuxt 8, React 10, Spring 3, Tailwind 1, Firebase 8, PostgreSQL 8, MongoDB 1, NumPy 1, Git 9, Figma 1.

### Content in the current site that is MISSING from the prototype
- Contact email `jewoo.lee@mail.mcgill.ca` (used by Footer "Start Project" mailto and README): 0 matches.
- "Download CV" button and `JEWOOLEE_CV.pdf` link: 0 matches for "Download CV" (the prototype has "CV" twice and a "resume" mention, so the file may be linked differently; verify).
- "Contact Me" section heading and sub-copy, "Let's collaborate!", "Start Project" CTA: 0 matches.
- The contact form and getform.io endpoint: prototype has no real form (one `<form>` tag, not verified as a contact form).
- Stats "10+ Project done" and "1+ Years of experience": 0 matches.
- Section headings "Essential Tools I use", "My Portfolio Highlights", "My Career Highlights": 0 matches (the prototype uses its own section copy).
- Hero copy "Available for Work" is present; "Jewoo (Jay) Lee" is present (3 matches).
- Footer sitemap and socials list: the prototype has Instagram (`instagram.com/jwuu_lee`), GitHub, LinkedIn; no "Sitemap"/"Socials" headings.
- The full About paragraph is not copied verbatim; the prototype paraphrases it ("B.Eng. Computer Engineering, McGill · Montréal").

If the revamp should keep the current site's wording, copy these strings into the revamp content file: the About paragraph, the Contact copy, the Footer CTA, the stat labels, and the full Experience descriptions.

---

## 7. Summary

1. Stack: React 19.1 + Vite 6 + Tailwind 3.4 + gsap 3.13 + lenis 1.3 + @vercel/analytics 1.5, plain JS/JSX, ESLint 9 flat config, no tests, Node 18+ required (no engines field, README says v16).
2. Content: 8 projects, 7 experience entries, 16 skill cards, Hero, About, Contact (GitHub, LinkedIn, Instagram, getform.io form), Footer (mailto CTA, sitemap, socials). Resume at `public/files/JEWOOLEE_CV.pdf`.
3. Prototype `design/revamp-lab.html` covers all projects, all roles and all skills, but drops the email, CV button, contact copy, and stat labels; it also uses CDN three.js r128.
4. Bugs to fix or drop in the rewrite: hooks inside `Experience.map`, `Button` `relValue` typo, `SkillCard` broken class, `ProjectCard` tags propType, "CI Guaranteee" typo, and oversized project images (up to 3300 px for about 280 px display).
5. Recommend Vitest 3 + Testing Library 16 + jsdom with a `vitest.setup.js`, and `npm install three` with `three/addons/` imports (lazy-loaded) for the 3D scene; add an `engines` field and fix the README.
