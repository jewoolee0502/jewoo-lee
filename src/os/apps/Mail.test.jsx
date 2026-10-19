// Mail app (plan Phase 4 TEST LIST, Mail items 1–4). fetch is mocked; the endpoint is
// PROFILE.getform, https://getform.io/f/akknzgea.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithApp } from '../../test/renderWithApp.jsx'
import Mail from './Mail.jsx'

const ENDPOINT = 'https://getform.io/f/akknzgea'
const OK_TOAST = { title: 'Mail', body: 'Sent! Jay will get back to you soon.', kind: 'info' }
const FAIL_TOAST = {
  title: 'Mail',
  body: 'Couldn’t send right now. Email jewoo.lee@mail.mcgill.ca instead.',
  kind: 'info',
}

let fetchMock

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function setup() {
  const result = renderWithApp(<Mail win={{ id: 'mail' }} />)
  const form = document.querySelector('form.form')
  return {
    ...result,
    form,
    name: screen.getByLabelText('YOUR NAME'),
    email: screen.getByLabelText('YOUR EMAIL'),
    message: screen.getByLabelText('MESSAGE'),
    button: within(form).getByRole('button', { name: 'Send ✉' }),
    honeypot: form.querySelector('input[name="_gotcha"]'),
    toasts: () => result.app.toasts.store.get().list,
  }
}

function fillValid(els) {
  fireEvent.change(els.name, { target: { value: 'Jay Tester' } })
  fireEvent.change(els.email, { target: { value: 'tester@example.com' } })
  fireEvent.change(els.message, { target: { value: 'Hello from the test' } })
}

describe('Mail form', () => {
  it('has the YOUR NAME, YOUR EMAIL and MESSAGE fields, all required, and a hidden honeypot', () => {
    const els = setup()
    expect(els.name).toBeRequired()
    expect(els.email).toBeRequired()
    expect(els.email).toHaveAttribute('type', 'email')
    expect(els.message).toBeRequired()
    expect(els.honeypot).not.toBeNull()
  })

  it('links to the channels, with a mailto link for email', () => {
    const { container } = setup()
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual([
      'https://github.com/jewoolee0502',
      'https://www.linkedin.com/in/jewoo-lee/',
      'https://www.instagram.com/jwuu_lee/',
      expect.stringMatching(/^mailto:/),
    ])
  })

  it('does not call fetch when a required field is empty', async () => {
    const user = userEvent.setup()
    const els = setup()
    await user.click(els.button)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts valid values to getform with FormData and the Accept header, and shows Sending… while pending', async () => {
    let resolveFetch
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve
      }),
    )
    const els = setup()
    fillValid(els)
    fireEvent.submit(els.form)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(ENDPOINT)
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
    expect(init.body.get('name')).toBe('Jay Tester')
    expect(init.body.get('email')).toBe('tester@example.com')
    expect(init.body.get('message')).toBe('Hello from the test')
    expect(init.headers.Accept).toBe('application/json')

    expect(els.button.textContent).toBe('Sending…')
    expect(els.button).toBeDisabled()

    await act(async () => {
      resolveFetch({ ok: true })
    })
    await waitFor(() => expect(els.name.value).toBe(''))
    expect(els.email.value).toBe('')
    expect(els.message.value).toBe('')
    expect(els.toasts()).toEqual(expect.arrayContaining([expect.objectContaining(OK_TOAST)]))
  })

  it('ok:false shows the failure toast and keeps the field values', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false })
    const els = setup()
    fillValid(els)
    fireEvent.submit(els.form)
    await waitFor(() => expect(els.toasts()).toEqual(expect.arrayContaining([expect.objectContaining(FAIL_TOAST)])))
    expect(els.name.value).toBe('Jay Tester')
    expect(els.email.value).toBe('tester@example.com')
    expect(els.message.value).toBe('Hello from the test')
  })

  it('a rejected promise shows the same failure toast and keeps the values', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    const els = setup()
    fillValid(els)
    fireEvent.submit(els.form)
    await waitFor(() => expect(els.toasts()).toEqual(expect.arrayContaining([expect.objectContaining(FAIL_TOAST)])))
    expect(els.message.value).toBe('Hello from the test')
  })

  it('a filled honeypot sends nothing', () => {
    const els = setup()
    fillValid(els)
    fireEvent.change(els.honeypot, { target: { value: 'I am a bot' } })
    fireEvent.submit(els.form)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
