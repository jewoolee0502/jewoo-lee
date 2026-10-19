// Visitor Wall (L839–861, rebuilt for the real backend). Visitors see the approved drawings
// (or the examples while none are approved, D16) and their own pending one. The moderation view
// shows only when the server says the session is an admin (`isAdmin`), and the sign-in form only
// on `?mod`. There is no visitor/moderator toggle.
import { useEffect, useState } from 'react'
import { useApp } from '../../app/AppContext.jsx'
import { useStore } from '../../core/store.js'
import { EXAMPLES } from '../../wall/examples.js'

const hasModParam = () => new URLSearchParams(globalThis.location?.search ?? '').has('mod')

function Grid({ items, onTakeDown }) {
  return (
    <div className="pgrid wall-grid">
      {items.map((it) => (
        <div key={it.id} className="pcard wall-card">
          <img alt="Visitor drawing" src={it.dataUrl} />
          {it.example && <span className="ex">example</span>}
          {onTakeDown && (
            <button type="button" className="btn wall-down" onClick={() => onTakeDown(it.id)}>
              Take down
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function SignIn({ wall, state }) {
  const [email, setEmail] = useState('')
  const { session, signInSent, mode } = state
  if (session && !session.isAnonymous && session.email) {
    return (
      <section className="wall-mod">
        <h3>Moderator sign-in</h3>
        <p>{`Signed in as ${session.email}, but this account isn’t a moderator.`}</p>
        <button type="button" className="btn" onClick={() => wall.signOut()}>
          Sign out
        </button>
      </section>
    )
  }
  const submit = (e) => {
    e.preventDefault()
    if (email.trim()) wall.signIn(email.trim())
  }
  return (
    <section className="wall-mod">
      <h3>Moderator sign-in</h3>
      {signInSent ? (
        <p>Check your inbox for a sign-in link.</p>
      ) : (
        <form className="game-row" onSubmit={submit}>
          <input
            className="wall-email"
            type="email"
            autoComplete="email"
            aria-label="Moderator email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" className="btn">
            {mode === 'mock' ? 'Sign in (mock)' : 'Send magic link'}
          </button>
        </form>
      )}
    </section>
  )
}

function VisitorView({ app, wall, state, mod }) {
  const { status, approved, myPending } = state
  const items = approved.length ? approved : EXAMPLES.map((dataUrl, i) => ({ id: 'ex' + i, dataUrl, example: true }))
  return (
    <>
      <h2>Visitor Wall</h2>
      <p className="muted">Drawings from people who stopped by. Draw one in Paint and press "Pin to wall".</p>
      {myPending && (
        <div className="notice">
          <img alt="Your pending drawing" src={myPending.dataUrl} />
          <span>Your drawing is waiting for Jay to approve it.</span>
        </div>
      )}
      {(status === 'idle' || status === 'loading') && <p className="muted">Loading the wall…</p>}
      {status === 'error' && (
        <div className="game-row">
          <p className="muted">Couldn’t load the wall right now.</p>
          <button type="button" className="btn" onClick={() => wall.refresh()}>
            Retry
          </button>
        </div>
      )}
      {status === 'ready' &&
        (items.length ? <Grid items={items} /> : <p className="muted">Nothing on the wall right now.</p>)}
      <p className="wall-go">
        <button type="button" className="btn" onClick={() => app.os.openApp('paint')}>
          Open Paint
        </button>
      </p>
      {mod && <SignIn wall={wall} state={state} />}
    </>
  )
}

function AdminView({ app, wall, state }) {
  const { session, pending, approved } = state
  const approve = async (id) => {
    const r = await wall.approve(id)
    if (r?.ok) app.toasts.toast('Visitor Wall', 'Approved. It’s on the wall and the corkboard now.', 'info')
  }
  return (
    <>
      <h2>Visitor Wall · moderation</h2>
      <p className="muted">Nothing goes public until you approve it. Each visitor holds one spot in the queue.</p>
      <div className="game-row">
        <span>{`Signed in as ${session?.email ?? ''}`}</span>
        <button type="button" className="btn" style={{ background: '#fff' }} onClick={() => wall.signOut()}>
          Sign out
        </button>
      </div>
      <h3 className="wall-h">{`Waiting for approval (${pending.length})`}</h3>
      {pending.length === 0 && <p className="muted">The queue is empty.</p>}
      {pending.map((it) => (
        <div key={it.id} className="wall-row">
          <img alt="Pending drawing" src={it.dataUrl} />
          <span>{'sent ' + new Date(it.createdAt).toLocaleString()}</span>
          <button type="button" className="btn" onClick={() => approve(it.id)}>
            Approve
          </button>
          <button type="button" className="btn" style={{ background: '#fff' }} onClick={() => wall.reject(it.id)}>
            Reject
          </button>
        </div>
      ))}
      <h3 className="wall-h">{`On the wall (${approved.length})`}</h3>
      {approved.length ? (
        <Grid items={approved} onTakeDown={(id) => wall.takeDown(id)} />
      ) : (
        <p className="muted">Nothing on the wall right now.</p>
      )}
      <p className="wall-go">
        <button type="button" className="btn" onClick={() => app.os.openApp('paint')}>
          Open Paint
        </button>
      </p>
    </>
  )
}

export default function VisitorWall() {
  const app = useApp()
  const wall = app.wall
  const state = useStore(wall.store)
  const mod = hasModParam()

  useEffect(() => {
    wall.ensureInit()
  }, [wall])

  return (
    <div className="wall-app">
      {state.mode === 'mock' && (
        <div className="game-row">
          <span className="draft" style={{ margin: 0 }}>
            Offline preview · drawings stay in this tab
          </span>
        </div>
      )}
      {state.isAdmin ? (
        <AdminView app={app} wall={wall} state={state} />
      ) : (
        <VisitorView app={app} wall={wall} state={state} mod={mod} />
      )}
    </div>
  )
}
