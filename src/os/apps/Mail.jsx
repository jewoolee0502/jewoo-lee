// Mail · say hi (L816–820), delivering to getform. A hidden `_gotcha` honeypot catches bots:
// when it is filled the form acts as if it sent and posts nothing.
import { useEffect, useId, useRef, useState } from 'react'
import { useApp } from '../../app/AppContext.jsx'
import { PROFILE } from '../../content/index.js'

const SENT = 'Sent! Jay will get back to you soon.'
const FAILED = `Couldn’t send right now. Email ${PROFILE.email} instead.`

const HONEYPOT_STYLE = { position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }

export default function Mail() {
  const app = useApp()
  const id = useId()
  const formRef = useRef(null)
  const alive = useRef(true)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const toast = (body) => app.toasts.toast('Mail', body, 'info')

  async function onSubmit(e) {
    e.preventDefault()
    const form = formRef.current
    if (!form || sending || !form.checkValidity()) return
    if (form.elements.namedItem('_gotcha')?.value) {
      form.reset()
      toast(SENT)
      return
    }
    setSending(true)
    let ok = false
    try {
      const res = await fetch(PROFILE.getform, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      })
      ok = Boolean(res?.ok)
    } catch {
      ok = false
    }
    if (ok) form.reset()
    toast(ok ? SENT : FAILED)
    if (alive.current) setSending(false)
  }

  return (
    <>
      <p>I read everything. Pick a channel:</p>
      <div className="links">
        <a className="btn" href={PROFILE.links.github} target="_blank" rel="noopener noreferrer">
          GitHub ↗
        </a>
        <a className="btn" href={PROFILE.links.linkedin} target="_blank" rel="noopener noreferrer">
          LinkedIn ↗
        </a>
        <a className="btn" href={PROFILE.links.instagram} target="_blank" rel="noopener noreferrer">
          Instagram ↗
        </a>
        <a className="btn" href={'mailto:' + PROFILE.email}>
          Email ↗
        </a>
      </div>
      <form className="form" ref={formRef} onSubmit={onSubmit} style={{ position: 'relative' }}>
        <label htmlFor={id + 'name'}>YOUR NAME</label>
        <input id={id + 'name'} name="name" autoComplete="name" required />
        <label htmlFor={id + 'email'}>YOUR EMAIL</label>
        <input id={id + 'email'} name="email" type="email" autoComplete="email" required />
        <label htmlFor={id + 'msg'}>MESSAGE</label>
        <textarea id={id + 'msg'} name="message" required />
        <input name="_gotcha" tabIndex={-1} autoComplete="off" aria-hidden="true" style={HONEYPOT_STYLE} />
        <p style={{ marginTop: 12 }}>
          <button className="btn" type="submit" disabled={sending}>
            {sending ? 'Sending…' : 'Send ✉'}
          </button>
        </p>
      </form>
    </>
  )
}
