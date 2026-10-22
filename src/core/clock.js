// Zone clocks (L727, L918).
import { useEffect, useState } from 'react'

export const ZONES = { MTL: 'America/Toronto', SEL: 'Asia/Seoul' }

export function formatZoneTime(date, tz) {
  try {
    return date.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' })
  } catch {
    return '--:--'
  }
}

/** Weekday plus time, as the terminal `date` command prints it (L918). */
export function formatZoneDay(date, tz) {
  try {
    return date.toLocaleString('en-GB', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return '?'
  }
}

/** Returns the current Date, refreshed every `ms` while mounted. */
export function useClock(ms = 15000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}
