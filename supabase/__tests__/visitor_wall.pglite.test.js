// @vitest-environment node
// Phase 6 SQL tests: the Visitor Wall migration run in PGlite with a fake auth schema
// (auth-shim.sql). Tests share one database and run in order, because the rate-limit
// tests count the rows earlier tests inserted.
//
// Runs in the node environment (plan: `// @vitest-environment node`): PGlite cannot load its
// data files under jsdom (jsdom's Blob has no arrayBuffer). src/test/setup.js skips its DOM stubs here.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { gridToPngDataUrl, encodeIndexedPng, bytesToBase64, PNG_PREFIX } from '../../src/lib/png.js'

const SHIM = readFileSync(resolve(process.cwd(), 'supabase/__tests__/auth-shim.sql'), 'utf8')
const MIGRATION = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261018000000_visitor_wall.sql'), 'utf8')

const PAL = ['#122030', '#E8452E', '#4AA6EE', '#FFD15C']

/** Base64 of a 24×24 PNG with the given [index, colour] cells coloured (no data: prefix). */
function drawingBase64(cells = [[0, '#E8452E']]) {
  const grid = Array(576).fill(null)
  for (const [i, colour] of cells) grid[i] = colour
  return gridToPngDataUrl(grid, 24, PAL).slice(PNG_PREFIX.length)
}

const VALID = drawingBase64()
const MAGIC = 'iVBORw0KGgo'

// Fixed auth users (hex only, so they are valid uuids).
const A = '00000000-0000-0000-0000-00000000000a'
const B = '00000000-0000-0000-0000-00000000000b'
const J = '00000000-0000-0000-0000-00000000000c' // moderator
const F = '00000000-0000-0000-0000-00000000000f' // fresh visitor for the queue-full test

let pg
// Filled by earlier tests and used by later ones.
const ids = {}

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(SHIM)
  await pg.exec(MIGRATION)
  await pg.exec(`
    insert into auth.users (id, email) values ('${A}', 'a@x'), ('${B}', 'b@x'), ('${J}', 'j@x'), ('${F}', 'f@x');
    insert into public.admins (user_id) values ('${J}');
  `)
}, 60_000)

afterAll(async () => {
  await pg?.close()
})

/** Runs one statement as a role with the given JWT subject (null = no session). */
async function as(role, uid, sql, params = []) {
  await pg.exec(`set role ${role}`)
  try {
    await pg.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ''])
    return await pg.query(sql, params)
  } finally {
    await pg.exec('reset role')
  }
}

/** Superuser query (RLS does not apply). */
const db = (sql, params = []) => pg.query(sql, params)

/** Superuser insert with user triggers disabled, so rows can be placed in any state. */
async function seed(sql, params = []) {
  await pg.exec('alter table public.drawings disable trigger user')
  try {
    return await pg.query(sql, params)
  } finally {
    await pg.exec('alter table public.drawings enable trigger user')
  }
}

async function newUser(tag) {
  const r = await db(`insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id`, [`${tag}@x`])
  return r.rows[0].id
}

const INSERT = 'insert into public.drawings (png) values ($1) returning id'
const sortIds = (rows) => rows.map((r) => r.id).sort()

describe('visitor wall migration (PGlite)', () => {
  it('1. anon cannot insert a drawing (permission denied)', async () => {
    await expect(as('anon', null, 'insert into public.drawings (png) values ($1)', [VALID])).rejects.toMatchObject({
      code: '42501',
    })
  })

  it('2. A inserts a valid PNG: a pending row owned by A', async () => {
    const r = await as('authenticated', A, INSERT, [VALID])
    expect(r.rows).toHaveLength(1)
    ids.aFirst = r.rows[0].id
    const row = await db('select user_id, status from public.drawings where id = $1', [ids.aFirst])
    expect(row.rows).toEqual([{ user_id: A, status: 'pending' }])
  })

  it('3. A inserts again: A has exactly one pending and one withdrawn row', async () => {
    await as('authenticated', A, INSERT, [VALID])
    const counts = await db(
      `select status::text as status, count(*)::int as n from public.drawings
       where user_id = $1 group by 1 order by 1`,
      [A],
    )
    expect(counts.rows).toEqual([
      { status: 'pending', n: 1 },
      { status: 'withdrawn', n: 1 },
    ])
  })

  it('4. A\'s 6th insert within an hour raises rate_limited', async () => {
    // A already has 2 rows in the last hour. Three more make 5, and the 6th is refused.
    for (let i = 0; i < 3; i++) await as('authenticated', A, INSERT, [VALID])
    await expect(as('authenticated', A, INSERT, [VALID])).rejects.toThrow(/rate_limited/)
  })

  it('5. B inserts with a bad magic, a 25×24 PNG, or an over-long string: each is a check violation', async () => {
    const badMagic = 'AAAAAAAAAAA' + VALID.slice(11)
    const wide = bytesToBase64(
      encodeIndexedPng({ width: 25, height: 24, indices: new Uint8Array(600), palette: [[0, 0, 0]] }),
    )
    const tooLong = MAGIC + 'A'.repeat(5461) // 5472 characters, more than 5464
    for (const png of [badMagic, wide, tooLong]) {
      await expect(as('authenticated', B, INSERT, [png])).rejects.toMatchObject({ code: '23514' })
    }
  })

  it('6. anon sees only approved rows', async () => {
    const u1 = await newUser('approved1')
    const u2 = await newUser('pending1')
    const u3 = await newUser('rejected1')
    await seed(
      `insert into public.drawings (user_id, status, png, created_at, decided_at) values
         ($1, 'approved', $4, now() - interval '2 days', now() - interval '1 day'),
         ($2, 'pending',  $4, now() - interval '2 days', null),
         ($3, 'rejected', $4, now() - interval '2 days', now() - interval '1 day')`,
      [u1, u2, u3, VALID],
    )
    ids.approvedSeed = (await db(`select id from public.drawings where user_id = $1`, [u1])).rows[0].id
    ids.pendingSeedB = (await db(`select id from public.drawings where user_id = $1`, [u2])).rows[0].id

    const anon = await as('anon', null, 'select id, status from public.drawings')
    expect(anon.rows.every((r) => r.status === 'approved')).toBe(true)
    expect(sortIds(anon.rows)).toEqual(
      sortIds((await db(`select id from public.drawings where status = 'approved'`)).rows),
    )
    expect(anon.rows.map((r) => r.id)).toContain(ids.approvedSeed)
    expect(anon.rows.map((r) => r.id)).not.toContain(ids.pendingSeedB)
  })

  it('7. A sees approved rows plus A\'s own rows, and not B\'s pending row', async () => {
    const r = await as('authenticated', A, 'select id, status from public.drawings')
    const expected = await db(
      `select id from public.drawings where status = 'approved' or user_id = $1`,
      [A],
    )
    expect(sortIds(r.rows)).toEqual(sortIds(expected.rows))
    expect(r.rows.map((x) => x.id)).not.toContain(ids.pendingSeedB)
    expect(r.rows.some((x) => x.status === 'rejected')).toBe(false)
    const pendingSeen = r.rows.filter((x) => x.status === 'pending').map((x) => x.id)
    const aPending = (await db(`select id from public.drawings where user_id = $1 and status = 'pending'`, [A])).rows
    expect(pendingSeen).toEqual(aPending.map((x) => x.id))
    ids.aPending = aPending[0].id
  })

  it('8. A cannot approve A\'s own pending row (0 rows affected, or refused)', async () => {
    const outcome = await as('authenticated', A, "update public.drawings set status = 'approved' where id = $1", [
      ids.aPending,
    ]).then(
      (r) => ({ affected: r.affectedRows }),
      (e) => ({ error: e }),
    )
    if (outcome.error) expect(outcome.error.message).toMatch(/permission denied|forbidden/)
    else expect(outcome.affected).toBe(0)
    const row = await db('select status::text as status from public.drawings where id = $1', [ids.aPending])
    expect(row.rows).toEqual([{ status: 'pending' }])
  })

  it('9. the moderator sees all pending rows and can approve, take down, and cannot go back to pending', async () => {
    const pendingAll = await as('authenticated', J, "select id from public.drawings where status = 'pending'")
    const pendingDb = await db(`select id from public.drawings where status = 'pending'`)
    expect(sortIds(pendingAll.rows)).toEqual(sortIds(pendingDb.rows))
    expect(pendingAll.rows.map((x) => x.id)).toEqual(expect.arrayContaining([ids.aPending, ids.pendingSeedB]))

    // pending -> approved: stamped with the moderator and a decision time.
    const approve = await as('authenticated', J, "update public.drawings set status = 'approved' where id = $1", [
      ids.aPending,
    ])
    expect(approve.affectedRows).toBe(1)
    const stamped = await db(
      'select status::text as status, decided_by, decided_at from public.drawings where id = $1',
      [ids.aPending],
    )
    expect(stamped.rows[0].status).toBe('approved')
    expect(stamped.rows[0].decided_by).toBe(J)
    expect(stamped.rows[0].decided_at).not.toBeNull()

    // approved -> removed.
    const take = await as('authenticated', J, "update public.drawings set status = 'removed' where id = $1", [
      ids.aPending,
    ])
    expect(take.affectedRows).toBe(1)
    const removed = await db('select status::text as status from public.drawings where id = $1', [ids.aPending])
    expect(removed.rows).toEqual([{ status: 'removed' }])

    // approved -> pending is not an allowed transition.
    await expect(
      as('authenticated', J, "update public.drawings set status = 'pending' where id = $1", [ids.approvedSeed]),
    ).rejects.toThrow(/bad_transition/)

    // The PNG cannot be changed, even by the moderator.
    const other = drawingBase64([[1, '#4AA6EE']])
    await expect(
      as('authenticated', J, 'update public.drawings set png = $1 where id = $2', [other, ids.pendingSeedB]),
    ).rejects.toThrow(/permission denied|immutable/)
    const png = await db('select png from public.drawings where id = $1', [ids.pendingSeedB])
    expect(png.rows[0].png).toBe(VALID)
  })

  it('10. is_admin() is true for the moderator, false for A and for anon', async () => {
    expect((await as('authenticated', J, 'select public.is_admin() as v')).rows).toEqual([{ v: true }])
    expect((await as('authenticated', A, 'select public.is_admin() as v')).rows).toEqual([{ v: false }])
    expect((await as('anon', null, 'select public.is_admin() as v')).rows).toEqual([{ v: false }])
  })

  it('11. A cannot add an admin, and sees no admin rows', async () => {
    await expect(as('authenticated', A, 'insert into public.admins (user_id) values ($1)', [A])).rejects.toMatchObject({
      code: '42501',
    })
    const rows = await as('authenticated', A, 'select * from public.admins')
    expect(rows.rows).toHaveLength(0)
  })

  it('12. with 200 pending rows, a new visitor is refused with queue_full', async () => {
    await db(`insert into auth.users (id, email) select gen_random_uuid(), 'q' || g || '@x' from generate_series(1, 200) g`)
    await seed(
      `insert into public.drawings (user_id, status, png, created_at)
       select id, 'pending', $1, now() - interval '1 day' from auth.users where email like 'q%@x'`,
      [VALID],
    )
    // A has spent its hourly allowance in test 4, so the visitor here is F (no rows yet).
    await expect(as('authenticated', F, INSERT, [VALID])).rejects.toThrow(/queue_full/)
  })

  it('13. with 30 rows created in the last minute, B is refused with rate_limited', async () => {
    await db(`insert into auth.users (id, email) select gen_random_uuid(), 'm' || g || '@x' from generate_series(1, 30) g`)
    await seed(
      `insert into public.drawings (user_id, status, png)
       select id, 'approved', $1 from auth.users where email like 'm%@x'`,
      [VALID],
    )
    await expect(as('authenticated', B, INSERT, [VALID])).rejects.toThrow(/rate_limited/)
  })
})
