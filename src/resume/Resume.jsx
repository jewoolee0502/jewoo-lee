// The plain-HTML résumé below the scene (D12), in the blueprint style of L241–269. It is
// prerendered at build time (entry-server.jsx) and hydrated as a second root (main.jsx), so the
// render must not touch `window`; only event handlers may. The "draft blurb" chip never shows
// here (D15).
import { useApp } from '../app/AppContext.jsx'
import { PROFILE, PROJECTS, ROLES, SKILLS, CAT, projectDims, projectImage, projectSrcSet } from '../content/index.js'
import TrophiesGrid, { useGotTrophies } from './TrophiesGrid.jsx'

// Every project card reserves the same 420:263 box (CSS aspect-ratio); the image covers it. The
// width and height attributes are the original's, so the browser knows the ratio before loading.

const ext = { target: '_blank', rel: 'noopener' }

function Section({ id, title, aside, children }) {
  return (
    <section className="block" id={id} aria-labelledby={id + '-title'}>
      <div className="wrap">
        <div className="sec-head">
          <h2 id={id + '-title'}>
            {title}
            {aside}
          </h2>
        </div>
        {children}
      </div>
    </section>
  )
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** '2025-08' -> 'Aug 2025' (the content keeps the OS log's ISO style). */
const monthYear = (iso) => {
  const [y, m] = iso.split('-')
  return (MONTHS[Number(m) - 1] ?? '') + ' ' + y
}

function Dates({ value }) {
  const [from, to] = value.split(' → ')
  return (
    <p className="r-dates">
      <time dateTime={from}>{monthYear(from)}</time>
      {to ? ' – ' : null}
      {to ? <time dateTime={to}>{monthYear(to)}</time> : null}
    </p>
  )
}

function ProjectCard({ p }) {
  const { w, h } = projectDims(p)
  return (
    <article className="col r-project">
      <img
        src={projectImage(p)}
        srcSet={projectSrcSet(p, 1280)}
        sizes="(max-width: 600px) calc(100vw - 48px), (max-width: 900px) 45vw, 360px"
        alt={p.title + ' screenshot'}
        loading="lazy"
        decoding="async"
        width={w}
        height={h}
      />
      <h3>{p.title}</h3>
      <p>{p.blurb}</p>
      <ul className="r-tags" aria-label={p.title + ' stack'}>
        {p.tags.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <p className="r-links">
        {p.live ? (
          <a href={p.live} {...ext}>
            Live demo
          </a>
        ) : null}
        <a href={p.url} {...ext}>
          {p.host}
        </a>
        {p.repo ? (
          <a href={p.repo} {...ext}>
            Source
          </a>
        ) : null}
      </p>
    </article>
  )
}

function TrophyCount() {
  const { ach } = useApp()
  const got = useGotTrophies()
  return <span className="ach-count">{`${got.size}/${ach.list.length}`}</span>
}

export default function Resume() {
  const app = useApp()

  // A plain link to #top without JS; with JS it glides up and into the open laptop.
  function openLaptop(e) {
    e.preventDefault()
    app.nav.openLaptop()
  }

  const cvLink = (
    <a className="r-btn" href={PROFILE.cv} download>
      Download CV (PDF)
    </a>
  )

  return (
    <>
      <main id="resume" aria-labelledby="resume-title">
        <header className="block r-head">
          <div className="wrap">
            <p className="eyebrow">Résumé</p>
            <h1 id="resume-title" tabIndex={-1}>
              {PROFILE.name}
            </h1>
            <p className="r-tagline">{PROFILE.tagline}</p>
            <div className="r-actions">
              {cvLink}
              <a className="r-btn" href={'mailto:' + PROFILE.email}>
                Email
              </a>
              <a className="r-btn" href={PROFILE.links.github} {...ext}>
                GitHub
              </a>
              <a className="r-btn" href={PROFILE.links.linkedin} {...ext}>
                LinkedIn
              </a>
              <a className="r-btn" href={PROFILE.links.instagram} {...ext}>
                {'Instagram (@' + PROFILE.instagramHandle + ')'}
              </a>
              <a className="r-btn r-primary" href="#top" onClick={openLaptop}>
                Open the laptop ↑
              </a>
            </div>
          </div>
        </header>

        <Section id="about" title="About">
          <div className="cols">
            <div className="col">
              <p className="r-greet">{PROFILE.greeting}</p>
              <p>{PROFILE.about}</p>
            </div>
            <div className="col">
              <dl className="r-facts">
                {PROFILE.facts.map((f) => (
                  <div key={f.label}>
                    <dt>{f.label}</dt>
                    <dd>
                      {f.dot ? <span className="r-dot" aria-hidden="true" /> : null}
                      {f.value}
                    </dd>
                  </div>
                ))}
              </dl>
              <h3>Education</h3>
              <p>
                <b>{PROFILE.education.school}</b>
                {' · ' + PROFILE.education.degree + ' · ' + PROFILE.education.dates}
              </p>
            </div>
          </div>
        </Section>

        <Section id="experience" title="Experience">
          <ol className="r-roles">
            {ROLES.map((r) => (
              <li key={r.dates + r.company}>
                <article className="col">
                  <Dates value={r.dates} />
                  <h3>{r.role}</h3>
                  <p className="r-company">{r.company}</p>
                  <p>{r.summary}</p>
                </article>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="projects" title="Projects">
          <div className="r-projects">
            {PROJECTS.map((p) => (
              <ProjectCard key={p.title} p={p} />
            ))}
          </div>
        </Section>

        <Section id="skills" title="Skills">
          <div className="r-skills">
            {Object.entries(CAT).map(([key, cat]) => (
              <div className="col" key={key}>
                <h3>{cat.label}</h3>
                <ul>
                  {SKILLS.filter((s) => s.cat === key).map((s) => (
                    <li key={s.name}>
                      <b>{s.name}</b>
                      {s.usedIn.length ? <span>{' · ' + s.usedIn.join(', ')}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        <Section id="contact" title="Contact">
          <div className="col r-contact">
            <p>
              {'Email '}
              <a href={'mailto:' + PROFILE.email}>{PROFILE.email}</a>
            </p>
            <p className="r-links">
              <a href={PROFILE.links.github} {...ext}>
                GitHub
              </a>
              <a href={PROFILE.links.linkedin} {...ext}>
                LinkedIn
              </a>
              <a href={PROFILE.links.instagram} {...ext}>
                Instagram
              </a>
            </p>
            <p className="r-actions">{cvLink}</p>
          </div>
        </Section>

        <Section id="trophies" title="Trophies " aside={<TrophyCount />}>
          <TrophiesGrid />
          <p className="r-note">Unlock them inside the laptop.</p>
        </Section>
      </main>
      <footer className="r-foot">
        <div className="wrap">
          © 2026 Jewoo Lee
        </div>
      </footer>
    </>
  )
}
