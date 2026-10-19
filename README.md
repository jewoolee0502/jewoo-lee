# Jewoo (Jay) Lee · portfolio

A late-night Montréal dorm room in 3D. Scroll and the 90s laptop on the desk flips open, boots
**JAY-OS** and the camera dives into the screen: draggable windows, a terminal (`jaysh`), a living
pixel-art Montréal wallpaper, BugHunt, Snake, Paint and a moderated Visitor Wall. Below the scene
sits a plain, prerendered HTML résumé for recruiters, crawlers and no-JS readers.

Live: https://jewoo-lee.vercel.app · CV: [public/files/JEWOOLEE_CV.pdf](public/files/JEWOOLEE_CV.pdf)

## Stack

- React 19 and Vite 6, hand-written CSS with custom properties (no Tailwind).
- three.js r128 (pinned) with CSS3DRenderer for the room and the live OS on the laptop screen.
  It loads in a lazy chunk; without WebGL the OS runs full-screen flat.
- Supabase (Postgres + RLS, anonymous sign-in, magic link) for the Visitor Wall, also lazy.
- Vercel hosting and `@vercel/analytics`.
- Vitest, Testing Library, jsdom and PGlite for tests.

## Getting started

Requires **Node ≥ 20.19** (`.nvmrc` pins 22).

```bash
npm install
cp .env.example .env.local   # optional: every variable may stay empty
npm run dev                  # http://localhost:5173
```

With no environment variables the site runs fully: the Visitor Wall uses an in-tab mock
("Offline preview"), and moderation can be tried at `/?mod` with `Sign in (mock)`.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server. The résumé renders client-side. |
| `npm run build` | Client build, then the SSR build of `src/resume/entry-server.jsx` into `dist-ssr/`, then `scripts/prerender.mjs`, which writes the résumé HTML and the JSON-LD Person into `dist/index.html` and deletes `dist-ssr/`. |
| `npm run preview` | Serves `dist/` at http://localhost:4173. |
| `npm test` / `npm run test:watch` | Vitest (unit, component, SSR and PGlite SQL tests). |
| `npm run lint` | ESLint. Only `src/scene/createScene.js` may import `three`, and only `src/wall/supabaseWallClient.js` may import `@supabase/supabase-js`. |
| `npm run assets:images` | `design/img/*.jpg` → `public/img/projects/*.webp` (420 px wide) and `public/img/jay.jpg` (sharp). |
| `npm run assets:portrait` | Precomputes the dithered 56×72 `public/img/jay-px.png`. |
| `npm run assets:joblog` | Headless-Chrome screenshot of the Joblog demo → `joblog.webp` (pixel placeholder if offline). |

## Environment variables

All are read at **build time** (Vite inlines `VITE_*` into the bundle, so never put secrets here).

| Variable | Default | Purpose |
|---|---|---|
| `VITE_SITE_URL` | `https://jewoo-lee.vercel.app` | Public URL without a trailing slash: `<link rel="canonical">`, `og:url` and the JSON-LD `url`. Set it when a custom domain is attached. |
| `VITE_SUPABASE_URL` | empty | Supabase Project URL. |
| `VITE_SUPABASE_ANON_KEY` | empty | Supabase anon / publishable key. **Never** the `service_role` or secret key. |

The wall uses Supabase only when both Supabase variables are set; otherwise it is the mock.

## Supabase setup (Visitor Wall)

1. Create a Supabase project (the free tier is fine; region `ca-central-1`).
2. Run the schema: Dashboard > SQL Editor, paste and run
   `supabase/migrations/20261018000000_visitor_wall.sql` (or `supabase link` then `supabase db push`).
3. Authentication > Sign In / Providers: keep **Email** on (magic link), turn on
   **Allow anonymous sign-ins**, and keep "Allow new users to sign up" on (anonymous sign-in needs
   it; the app sends `shouldCreateUser:false`, so strangers cannot create email accounts).
   Optional: CAPTCHA (Cloudflare Turnstile) and a lower anonymous sign-in rate limit.
4. Authentication > URL Configuration: Site URL = your `VITE_SITE_URL` (default
   `https://jewoo-lee.vercel.app`). Redirect URLs: `<site>/?mod`, `http://localhost:5173/?mod`,
   `http://localhost:4173/?mod` and your Vercel preview pattern `https://*-<team>.vercel.app/**`.
5. Moderator: Authentication > Users > Add user (your email, confirmed). Put that email into
   `supabase/seed/admin.sql`, run it in the SQL Editor (don't commit the edit), and check with
   `select * from public.admins;`.
6. Copy Project Settings > API > URL and the anon key into `.env.local` (and Vercel, below).
7. Moderate at `https://<site>/?mod`: open the Visitor Wall, enter your email, click the magic
   link, then approve or reject. Rejected and taken-down drawings stay in the table for audit and
   are never public.

## Deploy on Vercel

1. Import the GitHub repo in Vercel. The Vite preset works as is: build command `npm run build`,
   output directory `dist`, Node 20.19 or newer (Project Settings > Build and Deployment).
2. Project Settings > Environment Variables, for Production and Preview:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_SITE_URL` if you use a custom domain.
3. Redeploy after changing a variable (they are baked in at build time).
4. Check: View Source shows the résumé text and the `application/ld+json` block, and Vercel
   Analytics receives page views.

## Project layout

```
index.html           SEO head, skip link, #app and #resume-root (prerender outlet)
scripts/             asset scripts and the prerender (prerender.mjs + pure prerender-lib.mjs)
src/app              composition root (createApp) and React context
src/core             stores, timers, sound, achievements, motion
src/content          single content source: profile, projects, roles, skills, site URL
src/stage            scroll track, HUD, controller, recruiter view, scene mount
src/scene            three.js room (lazy chunk)
src/os               JAY-OS shell and apps (terminal, games, Paint, Visitor Wall …)
src/wallpaper        living Montréal wallpaper
src/wall             Visitor Wall clients (mock and Supabase)
src/resume           résumé page, trophies grid, JSON-LD and the SSR entry
supabase/            migration, admin seed and PGlite tests
```

## Credits

Inspired by [edh.dev](https://edh.dev) by Ed Hinrichsen.

## Contact

- Email: [jewoo.lee@mail.mcgill.ca](mailto:jewoo.lee@mail.mcgill.ca)
- GitHub: [jewoolee0502](https://github.com/jewoolee0502)
- LinkedIn: [in/jewoo-lee](https://www.linkedin.com/in/jewoo-lee/)
- Instagram: [@jwuu_lee](https://www.instagram.com/jwuu_lee/)
