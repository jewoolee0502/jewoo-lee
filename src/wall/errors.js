// Visitor Wall error codes (Phase 6). Both clients throw WallError; the store and Paint read `.code`.
//   rate_limited, queue_full, auth_required, forbidden, bad_transition  raised by the database
//   bad_png, too_large, bad_size                                        failed validation
//   busy (unique pending clash), unavailable (anonymous sign-in off), network (anything else)

export class WallError extends Error {
  constructor(code, cause) {
    super(code)
    this.name = 'WallError'
    this.code = code
    if (cause !== undefined) this.cause = cause
  }
}

const MESSAGE_CODES = ['rate_limited', 'queue_full', 'auth_required', 'forbidden', 'bad_transition']
const PG_CODES = new Map([
  ['23514', 'bad_png'],
  ['23505', 'busy'],
  ['42501', 'forbidden'],
])

/** Maps a Supabase/Postgres/auth error (or anything thrown) to a WallError. */
export function mapError(e) {
  if (e instanceof WallError) return e
  const message = String(e?.message ?? '')
  const hit = MESSAGE_CODES.find((code) => message.includes(code))
  if (hit) return new WallError(hit, e)
  const pg = PG_CODES.get(String(e?.code ?? ''))
  if (pg) return new WallError(pg, e)
  if (e?.code === 'anonymous_provider_disabled' || /anonymous sign-ins are disabled/i.test(message)) {
    return new WallError('unavailable', e)
  }
  return new WallError('network', e)
}
