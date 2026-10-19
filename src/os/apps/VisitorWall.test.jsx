// Visitor Wall app (registry id `wall`, 660×540). Rendered on its own with the wall store built
// over the mock client, so the tests do not touch the network. The moderator UI appears only
// for a signed-in admin, and the sign-in form only when the URL has `?mod`.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import { renderWithApp } from '../../test/renderWithApp.jsx'
import VisitorWall from './VisitorWall.jsx'
import { createWallStore } from '../../wall/wallStore.js'
import { createMockWallClient } from '../../wall/mockWallClient.js'
import { gridToPngDataUrl } from '../../lib/png.js'

const PAL = ['#122030', '#E8452E', '#4AA6EE']
function drawing(i = 0) {
  const grid = Array(576).fill(null)
  grid[i] = PAL[i % PAL.length]
  return gridToPngDataUrl(grid, 24, PAL)
}

afterEach(() => {
  history.replaceState(null, '', '/')
})

/** Renders the app with a wall store over `client`. Returns the store and the app. */
function mount({ client = createMockWallClient({ now: () => Date.now() }), wall } = {}) {
  let app
  const store =
    wall ??
    createWallStore({
      clientFactory: () => client,
      toast: (...args) => app.toasts.toast(...args),
    })
  const result = renderWithApp(<VisitorWall win={{ id: 'wall' }} />, { wall: store })
  app = result.app
  return { ...result, wall: store, client }
}

const toastList = (app) => app.toasts.store.get().list

function signInAsModerator(email = 'jay@example.com') {
  fireEvent.change(screen.getByLabelText('Moderator email'), { target: { value: email } })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in (mock)' }))
}

describe('Visitor Wall app', () => {
  it('visitor view: heading, intro, offline chip, 3 example cards, and no moderation controls', async () => {
    mount()
    expect(await screen.findByRole('heading', { level: 2, name: 'Visitor Wall' })).toBeInTheDocument()
    expect(
      screen.getByText('Drawings from people who stopped by. Draw one in Paint and press "Pin to wall".'),
    ).toBeInTheDocument()
    expect(screen.getByText('Offline preview · drawings stay in this tab')).toBeInTheDocument()
    expect(await screen.findAllByText('example')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
    expect(screen.queryByText(/Jay \(moderator\)/)).toBeNull()
  })

  it('the offline chip is shown only in mock mode', async () => {
    const client = Object.assign(createMockWallClient({ now: () => 0 }), { mode: 'supabase' })
    mount({ client })
    await screen.findByRole('heading', { level: 2, name: 'Visitor Wall' })
    expect(screen.queryByText('Offline preview · drawings stay in this tab')).toBeNull()
  })

  it('after a submit, the notice shows with the drawing', async () => {
    const { wall } = mount()
    await screen.findByRole('heading', { level: 2, name: 'Visitor Wall' })
    const png = drawing(0)
    await act(async () => {
      await wall.submit(png)
    })
    const notice = await screen.findByText('Your drawing is waiting for Jay to approve it.')
    expect(notice.closest('.notice').querySelector('img').getAttribute('src')).toBe(png)
  })

  it('without ?mod there is no sign-in form', async () => {
    mount()
    await screen.findByRole('heading', { level: 2, name: 'Visitor Wall' })
    expect(screen.queryByText('Moderator sign-in')).toBeNull()
  })

  it('with ?mod the sign-in form appears, and signing in shows the moderation view', async () => {
    history.replaceState(null, '', '/?mod')
    const { wall } = mount()
    expect(await screen.findByRole('heading', { level: 3, name: 'Moderator sign-in' })).toBeInTheDocument()
    await act(async () => {
      await wall.submit(drawing(0))
    })
    await act(async () => {
      signInAsModerator('jay@example.com')
    })
    expect(await screen.findByRole('heading', { level: 2, name: 'Visitor Wall · moderation' })).toBeInTheDocument()
    expect(screen.getByText(/Signed in as jay@example\.com/)).toBeInTheDocument()
    expect(
      screen.getByText('Nothing goes public until you approve it. Each visitor holds one spot in the queue.'),
    ).toBeInTheDocument()
    expect(await screen.findByText('Waiting for approval (1)')).toBeInTheDocument()
  })

  it('a signed-in account that is not a moderator sees the refusal and can sign out', async () => {
    history.replaceState(null, '', '/?mod')
    const client = Object.assign(createMockWallClient({ now: () => 0 }), {
      getSession: async () => ({ email: 'guest@example.com', isAnonymous: false, isAdmin: false }),
    })
    mount({ client })
    expect(
      await screen.findByText('Signed in as guest@example.com, but this account isn’t a moderator.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
  })

  it('Approve moves the drawing to On the wall, and toasts that it is approved', async () => {
    history.replaceState(null, '', '/?mod')
    const { wall, app } = mount()
    const png = drawing(0)
    await act(async () => {
      await wall.submit(png)
    })
    await act(async () => {
      await wall.signIn('jay@example.com')
    })
    await screen.findByText('Waiting for approval (1)')
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(await screen.findByText('On the wall (1)')).toBeInTheDocument()
    expect(screen.getByText('The queue is empty.')).toBeInTheDocument()
    expect([...document.querySelectorAll('img')].some((img) => img.getAttribute('src') === png)).toBe(true)
    expect(toastList(app)).toContainEqual(
      expect.objectContaining({
        title: 'Visitor Wall',
        body: 'Approved. It’s on the wall and the corkboard now.',
        kind: 'info',
      }),
    )
  })

  it('Reject removes the row and leaves the wall unchanged', async () => {
    history.replaceState(null, '', '/?mod')
    const { wall } = mount()
    await act(async () => {
      await wall.submit(drawing(0))
    })
    await act(async () => {
      await wall.signIn('jay@example.com')
    })
    await screen.findByText('Waiting for approval (1)')
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(await screen.findByText('The queue is empty.')).toBeInTheDocument()
    expect(screen.getByText('On the wall (0)')).toBeInTheDocument()
    expect(wall.store.get().approved).toEqual([])
  })

  it('Take down removes the card, and the examples return when nothing is approved', async () => {
    history.replaceState(null, '', '/?mod')
    const { wall } = mount()
    await act(async () => {
      await wall.submit(drawing(0))
    })
    await act(async () => {
      await wall.signIn('jay@example.com')
    })
    await screen.findByText('Waiting for approval (1)')
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    await screen.findByText('On the wall (1)')
    fireEvent.click(screen.getByRole('button', { name: 'Take down' }))
    expect(await screen.findByText('On the wall (0)')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(await screen.findAllByText('example')).toHaveLength(3)
  })

  it('Sign out returns to the visitor view', async () => {
    history.replaceState(null, '', '/?mod')
    const { wall } = mount()
    await act(async () => {
      await wall.signIn('jay@example.com')
    })
    await screen.findByRole('heading', { level: 2, name: 'Visitor Wall · moderation' })
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Visitor Wall' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
    expect(screen.queryByText('Visitor Wall · moderation')).toBeNull()
  })

  it('Open Paint opens the paint app', async () => {
    const { app } = mount()
    await screen.findByRole('heading', { level: 2, name: 'Visitor Wall' })
    const spy = vi.spyOn(app.os, 'openApp')
    fireEvent.click(screen.getByRole('button', { name: 'Open Paint' }))
    expect(spy).toHaveBeenCalledWith('paint')
  })

  it('when the list fails, shows the error and Retry calls refresh', async () => {
    const client = createMockWallClient({ now: () => 0 })
    client.listApproved = async () => {
      throw new Error('offline')
    }
    let app
    const wall = createWallStore({ clientFactory: () => client, toast: (...a) => app.toasts.toast(...a) })
    const refresh = vi.spyOn(wall, 'refresh')
    const result = renderWithApp(<VisitorWall win={{ id: 'wall' }} />, { wall })
    app = result.app
    expect(await screen.findByText('Couldn’t load the wall right now.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(refresh).toHaveBeenCalled()
  })
})
