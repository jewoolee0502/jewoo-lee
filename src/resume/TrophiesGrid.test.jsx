// Phase 8 TEST LIST: resume/TrophiesGrid (driven by the achievements store, server snapshot empty).
import { describe, it, expect, afterEach, vi } from 'vitest'
import { act, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { renderWithApp } from '../test/renderWithApp.jsx'
import { AppProvider } from '../app/AppContext.jsx'
import { createApp } from '../app/createApp.js'
import TrophiesGrid from './TrophiesGrid.jsx'
import { ACH } from '../core/achievements.js'

describe('resume/TrophiesGrid', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders one card per achievement (12), with ★ for unlocked and ☆ for locked', () => {
    localStorage.setItem('jayos-ach', JSON.stringify(['boot', 'term']))
    const { container } = renderWithApp(<TrophiesGrid />)
    const cards = container.querySelectorAll('.ach')
    expect(cards).toHaveLength(12)
    expect(ACH).toHaveLength(12)
    expect(container.querySelectorAll('.ach.got')).toHaveLength(2)
    expect(container.querySelectorAll('.ach.lock')).toHaveLength(10)

    const power = within(container).getByText('Power User').closest('.ach')
    expect(power).toHaveClass('got')
    expect(power).toHaveTextContent('★ Power User')
    expect(power).toHaveTextContent('Boot JAY-OS')

    const owl = within(container).getByText('Night Owl').closest('.ach')
    expect(owl).toHaveClass('lock')
    expect(owl).toHaveTextContent('☆ Night Owl')
    expect(within(container).queryByText('Artist in Residence')).toBeNull()
  })

  it('updates live when an achievement is unlocked in the store', () => {
    const { container, app } = renderWithApp(<TrophiesGrid />)
    expect(container.querySelectorAll('.ach.got')).toHaveLength(0)
    act(() => {
      app.ach.unlock('lamp')
    })
    expect(container.querySelectorAll('.ach.got')).toHaveLength(1)
    expect(within(container).getByText('Night Owl').closest('.ach')).toHaveClass('got')
  })

  it('the server render (getServerSnapshot) shows every card locked, even with stored progress', () => {
    localStorage.setItem('jayos-ach', JSON.stringify(['boot', 'term', 'lamp']))
    const html = renderToString(
      <AppProvider app={createApp()}>
        <TrophiesGrid />
      </AppProvider>,
    )
    const div = document.createElement('div')
    div.innerHTML = html
    expect(div.querySelectorAll('.ach.lock')).toHaveLength(12)
    expect(div.querySelectorAll('.ach.got')).toHaveLength(0)
  })
})
