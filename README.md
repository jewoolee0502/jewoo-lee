# Jewoo (Jay) Lee · Portfolio

A 3D Montréal dorm room where the laptop on the desk boots **JAY-OS**, a retro desktop holding my projects, experience and games, with a plain résumé one click away.

**Live:** https://jewoo-lee.vercel.app · **CV:** [`public/files/JEWOOLEE_CV.pdf`](public/files/JEWOOLEE_CV.pdf)

## What it is

Scroll down and the camera dives into a laptop on a late-night Montréal desk. The lid opens and JAY-OS boots: draggable windows, a terminal, a live pixel-art Montréal wallpaper and two small games. If you just want the facts, the **Résumé** button switches to a plain HTML résumé.

| View | What you get |
| --- | --- |
| **Laptop view** (default) | The 3D room and JAY-OS. Scroll, click and type to explore. |
| **Résumé view** | A plain, prerendered HTML résumé: fast, printable and readable by search engines. Open it with **Résumé** in the top bar or any `#resume` link; **← Laptop view** goes back. |

### Things to try

- Scroll down to open the laptop; scroll back up or press **Esc** to close it.
- Click the floppy disks on the desk: **PROJECTS** opens my projects, **GAMES** starts BugHunt, **RESUME** opens the résumé window.
- Open the Terminal and type `help` (then try `neofetch`, `snake` or `sudo hire-jay`).
- Click the props: the polaroid opens About, the dog tags open my military service, and the mug, lamp and snowy window all react.
- Play **BugHunt.exe** or **Snake.exe** from the desktop.
- Find the hidden secrets in the wallpaper. It moves from day to golden hour to night with Montréal time.
- Enter the Konami code: ↑ ↑ ↓ ↓ ← → ← → B A.
- Collect achievements: the ★ counter in the top bar tracks them, and the Trophies app lists them.

### Works everywhere

- **No WebGL:** JAY-OS runs flat without the 3D room; everything else still works.
- **No JavaScript:** the prerendered résumé is still on the page.
- **Reduced motion:** animations are skipped and the boot is shorter.
- **Small screens:** JAY-OS switches to a compact layout.

## Run it locally

**You need:** [Node.js](https://nodejs.org/) **20.19 or newer** (`.nvmrc` pins 22) and [Git](https://git-scm.com/).

```bash
git clone https://github.com/jewoolee0502/jewoo-lee.git
cd jewoo-lee
nvm use        # optional: switches to Node 22 if you use nvm
npm install
npm run dev
```

Open **http://localhost:5173**. No `.env` file or environment variables are needed.

To check the production build (with the prerendered résumé): `npm run build && npm run preview`, then open **http://localhost:4173**.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server at http://localhost:5173 |
| `npm run build` | Build to `dist/` and prerender the résumé into `index.html` |
| `npm run preview` | Serve the built `dist/` at http://localhost:4173 |
| `npm test` | Run all tests once (Vitest); `npm run test:watch` for watch mode |
| `npm run lint` | Lint with ESLint |
| `npm run assets:images` | Turn screenshots in `design/img/originals/` into WebP and regenerate `src/content/projectImages.js` |

## Edit the content

All text lives in `src/content/`. The JAY-OS apps and the résumé both read from it, so one edit updates both.

| To change | Edit | Notes |
| --- | --- | --- |
| Name, email, links, about, education | `src/content/profile.js` | |
| Projects | `src/content/projects.js` | `draft: true` adds a "draft blurb" label |
| Work experience | `src/content/roles.js` | One entry per role, newest first |
| Skills | `src/content/skills.js` | |
| Project screenshots | `design/img/originals/<name>.png` | Then run `npm run assets:images`; never edit `projectImages.js` by hand |
| CV download | `public/files/JEWOOLEE_CV.pdf` | Replace the file, or update `cv` in `profile.js` |

## Tech stack

| Area | Tools |
| --- | --- |
| UI | React 19, Vite 6, hand-written CSS |
| 3D | three.js 0.128.0 (pinned) with CSS3DRenderer, loaded only when the laptop is shown |
| Tests & lint | Vitest, Testing Library, jsdom, ESLint 9 |
| Hosting | Vercel + `@vercel/analytics` |
| Images | sharp (WebP project screenshots) |

<details>
<summary><strong>Project structure</strong></summary>

```
index.html        SEO head, skip link, mount points for the app and the prerendered résumé
src/
├── content/      The only content source: profile, projects, roles, skills, site URL
├── stage/        The two views, scrolling, top bar, recruiter view, keyboard shortcuts
├── scene/        The three.js room and laptop (lazy-loaded)
├── os/           JAY-OS: desktop, windows, apps, terminal, games
├── wallpaper/    The live pixel-art Montréal wallpaper
├── resume/       The HTML résumé, JSON-LD and the server-render entry
└── core/         Shared stores, sound, achievements, motion settings
scripts/          Prerender step and asset scripts
public/           Static files: CV, images, robots.txt
```

</details>

<details>
<summary><strong>Developer notes</strong></summary>

- Only `src/scene/createScene.js` may import `three`. ESLint enforces this, and tests mock it (`src/test/threeMock.js`).
- `three` is pinned to exactly `0.128.0`; don't bump it casually.
- Run `npm run lint` and `npm test` before opening a PR.

</details>

<details>
<summary><strong>Deploy on Vercel</strong></summary>

1. Import the GitHub repo into Vercel. The Vite preset works as is (build `npm run build`, output `dist`).
2. Set Node to 20.19 or newer in Project Settings.
3. Optional, for a custom domain: set `VITE_SITE_URL` (e.g. `https://example.com`, no trailing slash) for Production and Preview, then redeploy. It sets the canonical link, `og:url` and JSON-LD URL, and defaults to `https://jewoo-lee.vercel.app`. It is baked in at build time, so never put secrets in `VITE_*` variables.

</details>

## Contact

- Email: [jewoo.lee@mail.mcgill.ca](mailto:jewoo.lee@mail.mcgill.ca)
- GitHub: [jewoolee0502](https://github.com/jewoolee0502)
- LinkedIn: [in/jewoo-lee](https://www.linkedin.com/in/jewoo-lee/)
- Instagram: [@jwuu_lee](https://www.instagram.com/jwuu_lee/)

## License

[Apache 2.0](LICENSE)
