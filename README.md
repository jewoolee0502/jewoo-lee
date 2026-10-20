# Jewoo (Jay) Lee · portfolio

A late-night Montréal dorm room in 3D. Scroll and the 90s laptop on the desk flips open, boots
**JAY-OS** and you dive into the screen: draggable windows, a terminal (`jaysh`), a living
pixel-art Montréal wallpaper, BugHunt and Snake. Scrolling only opens and closes the laptop:
wheel, trackpad, touch, keys and the scrollbar all drive the same native page scroll, the camera
follows it, and the page ends at the open laptop, so even a hard fling stops there. Scroll back
up or press Esc to close it.

The résumé is a second view: **Résumé** in the HUD (or **Read the résumé** inside the laptop)
switches to a plain, prerendered HTML résumé that scrolls on its own, and **← Laptop view**
returns to the laptop where you left it. Browser Back works between the two, and a `#resume` link
opens the résumé directly. Without JS (crawlers, no-JS readers) the résumé is simply on the page.

Live: https://jewoo-lee.vercel.app · CV: [public/files/JEWOOLEE_CV.pdf](public/files/JEWOOLEE_CV.pdf)

## Stack

- React 19 and Vite 6, hand-written CSS with custom properties (no Tailwind).
- three.js r128 (pinned) with CSS3DRenderer for the room and the live OS on the laptop screen.
  It loads in a lazy chunk; without WebGL the OS runs full-screen flat.
- Vercel hosting and `@vercel/analytics`.
- Vitest, Testing Library and jsdom for tests.

## Getting started

Requires **Node ≥ 20.19** (`.nvmrc` pins 22).

```bash
npm install
cp .env.example .env.local   # optional: every variable may stay empty
npm run dev                  # http://localhost:5173
```

With no environment variables the site runs fully.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server. The résumé renders client-side. |
| `npm run build` | Client build, then the SSR build of `src/resume/entry-server.jsx` into `dist-ssr/`, then `scripts/prerender.mjs`, which writes the résumé HTML and the JSON-LD Person into `dist/index.html` and deletes `dist-ssr/`. |
| `npm run preview` | Serves `dist/` at http://localhost:4173. |
| `npm test` / `npm run test:watch` | Vitest (unit, component and SSR tests). |
| `npm run lint` | ESLint. Only `src/scene/createScene.js` may import `three`. |
| `npm run assets:images` | Project screenshots from `design/img/originals/<name>.png` (full resolution; falls back to the 420 px `design/img/<name>.jpg` when there is no original) → WebP at 640, 1280 and 1920 px wide, never enlarged (`public/img/projects/<name>-<width>.webp`, quality 82), plus the generated manifest `src/content/projectImages.js` (natural size and files per project; do not edit by hand) and `public/img/jay.jpg` (sharp). The components build `srcset` from the manifest and `sizes` from the OS scale. `design/img/*.jpg` stay for the prototype `design/revamp-lab.html`. |
| `npm run assets:portrait` | Precomputes the dithered 56×72 `public/img/jay-px.png`. |
| `npm run assets:joblog` | Headless-Chrome screenshot of the Joblog demo at 2× (2560×1600) → `design/img/originals/joblog.png`, then `assets:images`. If the capture fails the existing source is kept. |

## Environment variables

All are read at **build time** (Vite inlines `VITE_*` into the bundle, so never put secrets here).

| Variable | Default | Purpose |
|---|---|---|
| `VITE_SITE_URL` | `https://jewoo-lee.vercel.app` | Public URL without a trailing slash: `<link rel="canonical">`, `og:url` and the JSON-LD `url`. Set it when a custom domain is attached. |

## Deploy on Vercel

1. Import the GitHub repo in Vercel. The Vite preset works as is: build command `npm run build`,
   output directory `dist`, Node 20.19 or newer (Project Settings > Build and Deployment).
2. Project Settings > Environment Variables, for Production and Preview: `VITE_SITE_URL` if you
   use a custom domain.
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
src/stage            the two views, laptop scroll track, glide, HUD, controller, recruiter view
src/scene            three.js room (lazy chunk)
src/os               JAY-OS shell and apps (terminal, games …)
src/wallpaper        living Montréal wallpaper
src/resume           résumé page, trophies grid, JSON-LD and the SSR entry
```

## Contact

- Email: [jewoo.lee@mail.mcgill.ca](mailto:jewoo.lee@mail.mcgill.ca)
- GitHub: [jewoolee0502](https://github.com/jewoolee0502)
- LinkedIn: [in/jewoo-lee](https://www.linkedin.com/in/jewoo-lee/)
- Instagram: [@jwuu_lee](https://www.instagram.com/jwuu_lee/)
