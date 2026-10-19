// The public site URL (canonical, og:url, JSON-LD). Set at build time with VITE_SITE_URL;
// unset or empty falls back to the Vercel URL. Shared by profile.js and vite.config.js.
export const DEFAULT_SITE_URL = 'https://jewoo-lee.vercel.app'

/** Trims the value and drops trailing slashes; empty or missing gives DEFAULT_SITE_URL. */
export function resolveSiteUrl(value) {
  const v = typeof value === 'string' ? value.trim().replace(/\/+$/, '') : ''
  return v || DEFAULT_SITE_URL
}
