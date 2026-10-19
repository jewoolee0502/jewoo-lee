// Phase 8 TEST LIST: resume/Resume.test.jsx (client render, server render and hydration).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { renderWithApp } from '../test/renderWithApp.jsx'
import { AppProvider } from '../app/AppContext.jsx'
import { createApp } from '../app/createApp.js'
import Resume from './Resume.jsx'
import { renderResumeHtml, createServerApp } from './entry-server.jsx'

function serverMarkup() {
  return renderToString(
    <AppProvider app={createServerApp()}>
      <Resume />
    </AppProvider>,
  )
}

function toContainer(html) {
  const div = document.createElement('div')
  div.innerHTML = html
  document.body.appendChild(div)
  return div
}

describe('resume/Resume', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('1. renders main#resume labelled by an h1 "Jewoo (Jay) Lee" with id resume-title', () => {
    const { container } = renderWithApp(<Resume />)
    const main = container.querySelector('main#resume')
    expect(main).not.toBeNull()
    expect(main).toHaveAttribute('aria-labelledby', 'resume-title')
    const h1 = screen.getByRole('heading', { level: 1, name: 'Jewoo (Jay) Lee' })
    expect(h1).toHaveAttribute('id', 'resume-title')
    expect(h1).toHaveAttribute('tabindex', '-1')
  })

  it('2. has sections about, experience, projects, skills, contact and trophies, each with its h2', () => {
    const { container } = renderWithApp(<Resume />)
    const expected = [
      ['about', 'About'],
      ['experience', 'Experience'],
      ['projects', 'Projects'],
      ['skills', 'Skills'],
      ['contact', 'Contact'],
      ['trophies', /^Trophies/],
    ]
    for (const [id, name] of expected) {
      const section = container.querySelector('#' + id)
      expect(section, id).not.toBeNull()
      expect(section.tagName, id).toBe('SECTION')
      expect(within(section).getByRole('heading', { level: 2, name }), id).toBeInTheDocument()
    }
  })

  it('3. experience has 7 articles; the first names Wholesale Express, its role and a time element', () => {
    const { container } = renderWithApp(<Resume />)
    const articles = container.querySelectorAll('#experience article')
    expect(articles).toHaveLength(7)
    const first = articles[0]
    expect(first).toHaveTextContent('Wholesale Express')
    expect(first).toHaveTextContent('Full-Stack Developer (Part-time)')
    expect(first.querySelector('time')).not.toBeNull()
  })

  it('4. projects has 9 articles; Joblog links its live demo and repo; no draft blurb; images are lazy with width and height', () => {
    const { container } = renderWithApp(<Resume />)
    const articles = container.querySelectorAll('#projects article')
    expect(articles).toHaveLength(9)

    const joblog = screen.getByRole('heading', { level: 3, name: 'Joblog' }).closest('article')
    expect(joblog).not.toBeNull()
    expect(joblog.querySelector('a[href="https://joblog-nine.vercel.app"]')).not.toBeNull()
    expect(joblog.querySelector('a[href="https://github.com/jewoolee0502/Joblog"]')).not.toBeNull()

    expect(screen.queryByText(/draft blurb/i)).toBeNull()

    const images = container.querySelectorAll('#projects img')
    expect(images.length).toBeGreaterThanOrEqual(9)
    for (const img of images) {
      expect(img).toHaveAttribute('loading', 'lazy')
      expect(img).toHaveAttribute('decoding', 'async')
      expect(img).toHaveAttribute('width', '420')
      expect(img.getAttribute('height')).toMatch(/^\d+$/)
    }
  })

  it('5. skills has 4 category groups (Language, Framework, Data, Tool) that name all 16 skills', () => {
    const { container } = renderWithApp(<Resume />)
    const skills = container.querySelector('#skills')
    const groups = within(skills).getAllByRole('heading', { level: 3 })
    expect(groups.map((h) => h.textContent)).toEqual(['Language', 'Framework', 'Data', 'Tool'])
    expect(within(skills).getAllByRole('list')).toHaveLength(4)
    for (const name of [
      'Python', 'Java', 'JavaScript', 'TypeScript', 'CSS', 'Vue.js', 'Nuxt', 'React',
      'Spring Boot', 'Tailwind', 'Firebase', 'PostgreSQL', 'MongoDB', 'NumPy', 'Git', 'Figma',
    ]) {
      expect(skills.textContent, name).toContain(name)
    }
  })

  it('6. contact has the McGill mailto, GitHub, LinkedIn, Instagram and the CV download link', () => {
    const { container } = renderWithApp(<Resume />)
    const contact = container.querySelector('#contact')
    expect(contact.querySelector('a[href="mailto:jewoo.lee@mail.mcgill.ca"]')).not.toBeNull()
    expect(contact.querySelector('a[href="https://github.com/jewoolee0502"]')).not.toBeNull()
    expect(contact.querySelector('a[href="https://www.linkedin.com/in/jewoo-lee/"]')).not.toBeNull()
    expect(contact.querySelector('a[href="https://www.instagram.com/jwuu_lee/"]')).not.toBeNull()
    const cv = within(contact).getByRole('link', { name: 'Download CV (PDF)' })
    expect(cv).toHaveAttribute('href', '/files/JEWOOLEE_CV.pdf')
    expect(cv).toHaveAttribute('download')
  })

  it('7. footer is the copyright line only: "© 2026 Jewoo Lee", no edh.dev credit and no link', () => {
    const { container } = renderWithApp(<Resume />)
    const footer = container.querySelector('footer')
    expect(footer).not.toBeNull()
    expect(footer).toHaveTextContent('© 2026 Jewoo Lee')
    expect(footer.textContent.trim()).toBe('© 2026 Jewoo Lee')
    expect(footer.textContent).not.toMatch(/Inspired by/)
    expect(footer.textContent).not.toMatch(/edh\.dev/)
    expect(footer.querySelector('a')).toBeNull()
  })

  it('8. trophies: the server render shows 0/12 and 12 locked cards; a client render with boot shows 1/12 and ★ Power User', () => {
    const server = toContainer(serverMarkup())
    expect(server.querySelector('#trophies .ach-count').textContent).toBe('0/12')
    expect(server.querySelectorAll('.ach.lock')).toHaveLength(12)
    server.remove()

    localStorage.setItem('jayos-ach', JSON.stringify(['boot']))
    const { container } = renderWithApp(<Resume />)
    expect(container.querySelector('#trophies .ach-count').textContent).toBe('1/12')
    expect(container.querySelectorAll('.ach.got')).toHaveLength(1)
    expect(container.querySelector('.ach.got')).toHaveTextContent('★ Power User')
  })

  it('9. hydrating the prerendered markup with stored achievements has no mismatch and then shows 1/12', async () => {
    localStorage.setItem('jayos-ach', JSON.stringify(['boot']))
    const container = toContainer(renderResumeHtml())
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const recoverable = vi.fn()
    const app = createApp()

    let root
    await act(async () => {
      root = hydrateRoot(
        container,
        <AppProvider app={app}>
          <Resume />
        </AppProvider>,
        { onRecoverableError: recoverable },
      )
    })
    await waitFor(() => {
      expect(container.querySelector('#trophies .ach-count').textContent).toBe('1/12')
    })

    expect(recoverable).not.toHaveBeenCalled()
    const mismatch = consoleError.mock.calls.filter((args) =>
      /hydrat|did not match|mismatch/i.test(args.map(String).join(' ')),
    )
    expect(mismatch).toEqual([])

    await act(async () => root.unmount())
    app.dispose()
    container.remove()
  })

  it('10. "Open the laptop ↑" scrolls to the top and calls nav.openLaptop', async () => {
    const openLaptop = vi.fn()
    const goToResume = vi.fn()
    renderWithApp(<Resume />, { nav: { openLaptop, goToResume } })
    fireEvent.click(screen.getByText('Open the laptop ↑'))
    expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }))
    await waitFor(() => expect(openLaptop).toHaveBeenCalledTimes(1))
  })

  it('11. experience dates read "Aug 2025 – Dec 2025" for Wholesale Express; raw "2025-08" is not in the résumé text', () => {
    const server = toContainer(serverMarkup())
    const experience = server.querySelector('#experience')
    expect(experience.textContent).not.toContain('2025-08')
    const first = experience.querySelectorAll('article')[0]
    expect(first).toHaveTextContent('Aug 2025 – Dec 2025')
    expect(first.querySelector('time')).not.toBeNull()
    server.remove()
  })

  it('12. "Open the laptop ↑" is a no-JS link to #top in the prerendered markup', () => {
    const server = toContainer(serverMarkup())
    const link = within(server).getByRole('link', { name: 'Open the laptop ↑' })
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '#top')
    server.remove()
  })
})
