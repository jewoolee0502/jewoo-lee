import { describe, it, expect, vi } from 'vitest'
import { ZONES, formatZoneTime, formatZoneDay } from './clock.js'

const SUMMER_15TH = new Date('2026-07-15T15:04:00Z')

describe('formatZoneTime', () => {
  it('formats Montréal time (EDT) as 24-hour HH:MM', () => {
    expect(formatZoneTime(SUMMER_15TH, 'America/Toronto')).toBe('11:04')
  })

  it('formats Seoul time as 24-hour HH:MM', () => {
    expect(formatZoneTime(SUMMER_15TH, 'Asia/Seoul')).toBe('00:04')
  })

  it('returns --:-- for an invalid time zone', () => {
    expect(formatZoneTime(SUMMER_15TH, 'Invalid/Zone')).toBe('--:--')
  })
})

describe('formatZoneDay', () => {
  it('returns ? for an invalid time zone', () => {
    expect(formatZoneDay(SUMMER_15TH, 'Invalid/Zone')).toBe('?')
  })
})

describe('ZONES', () => {
  it('maps the two clock labels to their IANA zones', () => {
    expect(ZONES).toEqual({ MTL: 'America/Toronto', SEL: 'Asia/Seoul' })
  })
})
