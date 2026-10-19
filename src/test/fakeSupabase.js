// Test double for @supabase/supabase-js (Phase 6). Records every call and answers from queues.
// Query chains are thenable: awaiting one resolves the next queued {data, error} (default empty).
// Tests reach the active fake through resetFakeSupabase(); the module mock forwards createClient to it.

export function createFakeSupabase() {
  const log = [] // {kind:'query', chain} | {kind:'rpc', name, args} | {kind:'auth', name, args}
  const queued = [] // FIFO results for awaited query chains
  const rpcResults = {} // name -> {data, error}
  const createArgs = [] // [{url, key, options}] per createClient call
  const authListeners = new Set()
  const state = { session: null, anonError: null, otpError: null }

  function builder(table) {
    const chain = [['from', table]]
    const b = {
      then(onOk, onErr) {
        log.push({ kind: 'query', chain: chain.map((c) => [...c]) })
        const res = queued.length ? queued.shift() : { data: null, error: null }
        return Promise.resolve(res).then(onOk, onErr)
      },
    }
    const proxy = new Proxy(b, {
      get(target, prop) {
        if (prop in target) return target[prop]
        if (typeof prop === 'symbol') return undefined
        return (...args) => {
          chain.push([prop, ...args])
          return proxy
        }
      },
    })
    return proxy
  }

  const notify = () => {
    for (const cb of [...authListeners]) cb('SIGNED_IN', state.session)
  }

  const auth = {
    async getSession() {
      log.push({ kind: 'auth', name: 'getSession', args: [] })
      return { data: { session: state.session }, error: null }
    },
    async signInAnonymously() {
      log.push({ kind: 'auth', name: 'signInAnonymously', args: [] })
      if (state.anonError) return { data: { user: null, session: null }, error: state.anonError }
      state.session = { user: { id: 'anon-user', email: null, is_anonymous: true } }
      notify()
      return { data: { user: state.session.user, session: state.session }, error: null }
    },
    async signInWithOtp(args) {
      log.push({ kind: 'auth', name: 'signInWithOtp', args: [args] })
      return { data: {}, error: state.otpError }
    },
    async signOut() {
      log.push({ kind: 'auth', name: 'signOut', args: [] })
      state.session = null
      notify()
      return { error: null }
    },
    onAuthStateChange(cb) {
      authListeners.add(cb)
      return { data: { subscription: { unsubscribe: () => authListeners.delete(cb) } } }
    },
  }

  const client = {
    from: (table) => builder(table),
    rpc: async (name, args) => {
      log.push({ kind: 'rpc', name, args })
      return rpcResults[name] ?? { data: null, error: null }
    },
    auth,
  }

  return {
    client,
    log,
    state,
    rpcResults,
    createArgs,
    /** Queues the result of the next awaited query chain. */
    queue(result) {
      queued.push(result)
    },
    createClient(url, key, options) {
      createArgs.push({ url, key, options })
      return client
    },
    authCalls(name) {
      return log.filter((e) => e.kind === 'auth' && e.name === name)
    },
    queries() {
      return log.filter((e) => e.kind === 'query').map((e) => e.chain)
    },
  }
}

export const supabaseMock = { current: createFakeSupabase() }

/** Starts a fresh fake; the @supabase/supabase-js module mock forwards to it. */
export function resetFakeSupabase() {
  supabaseMock.current = createFakeSupabase()
  return supabaseMock.current
}

export function createClient(url, key, options) {
  return supabaseMock.current.createClient(url, key, options)
}
