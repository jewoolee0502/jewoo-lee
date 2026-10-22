import { describe, it, expect } from 'vitest'
import { renderWithApp } from '../test/renderWithApp.jsx'
import OsPortal from './OsPortal.jsx'

describe('OsPortal', () => {
  it('mounts the OS content inside app.host.osEl', () => {
    const { app } = renderWithApp(<OsPortal />)

    expect(app.host.osEl.querySelector('.l-standby')).not.toBeNull()
    expect(app.host.osEl.querySelector('.sb-logo')).not.toBeNull()
  })

  it('removes the OS content from app.host.osEl on unmount', () => {
    const { app, unmount } = renderWithApp(<OsPortal />)

    unmount()

    expect(app.host.osEl.querySelector('.l-standby')).toBeNull()
    expect(app.host.osEl.childNodes).toHaveLength(0)
  })
})
