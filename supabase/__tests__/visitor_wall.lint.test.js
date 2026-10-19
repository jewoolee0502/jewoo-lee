// Static checks on the Visitor Wall migration text. These run without PGlite, so they still
// guard the RLS design when the SQL tests are skipped.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const RAW = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261018000000_visitor_wall.sql'), 'utf8')

// Drop -- comments, collapse whitespace, lower-case.
const TEXT = RAW.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim().toLowerCase()
const STATEMENTS = TEXT.split(';').map((s) => s.trim()).filter(Boolean)
const POLICIES = STATEMENTS.filter((s) => s.startsWith('create policy'))

describe('visitor wall migration (static checks)', () => {
  it('enables RLS on both tables', () => {
    expect(TEXT).toMatch(/alter table public\.admins enable row level security/)
    expect(TEXT).toMatch(/alter table public\.drawings enable row level security/)
  })

  it('has no policy that is simply true (using (true) or with check (true))', () => {
    expect(POLICIES.some((p) => /\b(using|with check)\s*\(\s*true\s*\)/.test(p))).toBe(false)
  })

  it('has exactly one update policy, and it references is_admin()', () => {
    expect(POLICIES.some((p) => /\bfor all\b/.test(p))).toBe(false)
    const updates = POLICIES.filter((p) => /\bfor update\b/.test(p))
    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatch(/is_admin\(\)/)
  })

  it('has no delete policy (soft states only)', () => {
    expect(POLICIES.filter((p) => /\bfor delete\b/.test(p))).toHaveLength(0)
  })

  it('revokes all from anon and authenticated on both tables', () => {
    expect(TEXT).toMatch(/revoke all on public\.admins from anon, authenticated/)
    expect(TEXT).toMatch(/revoke all on public\.drawings from anon, authenticated/)
  })

  it('every security definer function sets search_path, and is_admin() is one of them', () => {
    let definers = 0
    for (const m of TEXT.matchAll(/create (or replace )?function/g)) {
      const dollar = TEXT.indexOf('$$', m.index)
      const header = TEXT.slice(m.index, dollar === -1 ? undefined : dollar)
      if (!/security definer/.test(header)) continue
      definers += 1
      expect(header).toMatch(/set search_path/)
    }
    expect(definers).toBeGreaterThanOrEqual(1)
    expect(TEXT).toMatch(/create function public\.is_admin\(\)[^$]*security definer[^$]*set search_path/)
  })
})
