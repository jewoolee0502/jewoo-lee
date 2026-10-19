# Implementation plan: JAY-OS portfolio revamp

> Round 2 (design/notes/plan-r2.md) removed Paint, the Visitor Wall, Supabase, the corkboard and the edh.dev credit; text below about them is historical.

Branch `feat/website-revamp`, worktree `.worktrees/feat-website-revamp`.
Source of truth for look, feel and behaviour: `design/revamp-lab.html` (cited as `L<n>`).
Investigator specs (`design/notes/explore-*.md`) were checked against the source. Corrections are noted where they matter (for example, the terminal `help` prints **14** lines, not 15, and Tab on `h` lists `help  hello  hi  history`).

Build loop per phase: Haiku test-writer writes the failing tests from the phase TEST LIST. Opus implementer makes them pass. Haiku reviewer checks the ACCEPTANCE list and the cited prototype lines. Repeat until there are no gaps. After phase 8, a manual pass in real Chrome (section 7).

---

## 1. Decisions made in this plan (final unless the user objects)

| # | Decision | Why |
|---|---|---|
| D1 | **Pin `three@0.128.0`** (npm, exact). Import `three` and `three/examples/jsm/renderers/CSS3DRenderer.js`. | The prototype was tuned on r128 (L427–428). r128 has legacy lights (×π irradiance, legacy distance falloff `pow(saturate(1-d/cutoff), decay)`), no `ColorManagement`, and the same `outputEncoding`/`sRGBEncoding` names, so the scene code ports line for line with the same lighting and colour. Current three (r186) would need `ColorManagement.enabled=false`, every intensity ×π, *and* a patched `getDistanceAttenuation` shader chunk to match the lamp/screen point lights. That is more code and more risk than the benefit. r128 also keeps WebGL1, so fewer devices fall back to flat mode. Cost: about 150 KB gzip, in a lazy chunk, and no future three updates. That cost does not matter because the scene loads only our own static assets. Upgrade recipe: section 8. |
| D2 | **React owns all UI content. Imperative modules own the WebGL/CSS3D layers and two host elements.** `createOsHost()` makes `div#os-holder` (900×675, the CSS3DObject element) and, inside it, `div.os#os` (the element that moves between holder and `.flat-host`). React renders the whole OS **into `div.os` with `createPortal`**. | CSS3DObject re-parents the holder into the CSS3D camera element (r128 `CSS3DRenderer.renderObject` re-appends it every frame). `setFlat` moves `#os` between holder and flat-host (L757–761). React must never own a node whose parent changes, but it can own the *children* of a portal container that moves. React attaches event listeners to portal containers (`preparePortalMount`), so events still work wherever the container sits. The React tree stays mounted across 3D/flat switches, so open windows, terminal history and game state survive. Classes and data on `div.os` (`data-state`, `live`, `flat`, `compact`, `collapsing`, `disco`) are written by the host, not by JSX. |
| D3 | **Remove `lenis`, `gsap`, `@gsap/react`.** | The stage captures `wheel` with `passive:false` and `preventDefault` while inside (L1047–1054). The controller reads `getBoundingClientRect()` every frame and uses native `window.scrollTo` (L1013, L1025, L1028). Lenis virtualises wheel and scroll, so it would fight both and add lag before the `p > .02` trigger. GSAP was only used for `.reveal-up`, which the résumé does not need. Removing them saves about 70 KB. |
| D4 | **Remove Tailwind** (`tailwindcss`, `tailwind-scrollbar`, `postcss`, `autoprefixer`, both configs) and port the prototype CSS verbatim into `src/styles/*.css`. Also remove `prop-types`. | The approved look is hand-written CSS with custom properties (L8–270). Tailwind preflight would change base element styles (buttons, images, headings). No Tailwind classes remain once the old components are deleted. |
| D5 | **Composition root plus small external stores** (`createApp()`), instead of an event bus. React reads stores through `useSyncExternalStore`. Cross-module calls go through the `app` object, using late-bound getters to avoid import cycles. | This mirrors the prototype's globals (`OS`, `Ctrl`, `Scene`, `Wall`, `unlock`, `toast`, `Snd`) but makes them injectable, so they can be tested and created once per mount. No per-frame `setState`. |
| D6 | **One rAF ticker** for the controller, scene and wallpaper, gated by an IntersectionObserver on the stage. | Replaces three unremoved loops (L600, L1268, L1280). Easy to stop and test. |
| D7 | **Tool versions (Node ≥ 20.19):** `vitest@4.1.11`, `jsdom@26.1.0`, `@testing-library/react@16.3.0`, `@testing-library/dom@10.4.1`, `@testing-library/jest-dom@6.10.0`, `@testing-library/user-event@14.6.1`, `@supabase/supabase-js@2.109.0`, `@electric-sql/pglite@0.5.8`, `sharp@0.34.5` (dev, for asset scripts only). All are older than two weeks. | `vitest@5`, `jest-dom@7` and `supabase-js ≥ 2.110` require Node 22, and the user asked for Node ≥ 20. `vitest@4.1` supports Vite 6. Add `.nvmrc` with `22` for local use. |
| D8 | **Visitors authenticate with Supabase anonymous sign-in, created lazily on the first "Pin to wall".** Jay authenticates with a magic link (`shouldCreateUser:false`). Moderators are listed in `public.admins`, and every check uses `is_admin()` in RLS and triggers. | Gives each visitor a real `auth.uid()`, so the "one pending per visitor" rule and per-visitor rate limits work in the database rather than trusting a client key. Supabase also rate-limits anonymous sign-ins per IP. Nothing calls Supabase until it is needed. |
| D9 | **Drawings are stored as base64 text in the table** (no Storage bucket). CHECK constraints limit size (≤ 5464 chars, which is 4096 bytes), require the PNG magic, and require IHDR = 24×24. | The drawings are tiny (about 1 KB). One query returns the wall. RLS covers the data directly. |
| D10 | **Paint and the icons use a pure-JS indexed PNG encoder** (`src/lib/png.js`), not `canvas.toDataURL`. | Output is deterministic, so it is testable in jsdom (which has no canvas). Server validation becomes trivial. Pixel icons (L615–635) and wall examples (L768–771) work without a canvas. |
| D11 | **Add a "Résumé ↓" HUD button and a skip link, and add `ctrl.goToResume()`**, which exits if inside and suppresses auto-enter until the page passes `p > .6`. | In the prototype, wheel and touch can never reach content below the track. Any downward scroll at the top auto-enters, and inside, the wheel is captured. The prototype's "Design notes" item even re-triggers auto-enter on the way down (L724 plus L1016). The résumé must be reachable. |
| D12 | **Prerender the résumé at build time** (Vite SSR build plus `scripts/prerender.mjs`) into `index.html`, then hydrate it as a second React root. | "Plain, SEO-friendly HTML": crawlers and no-JS readers get the full résumé. |
| D13 | **The OS Resume.pdf window offers "Download CV" and "Read the full résumé" buttons, with no PDF embed.** | Chrome's PDF viewer inside a CSS 3D-transformed element is unreliable, and it is poor on phones. |
| D14 | **Persistence:** only `localStorage['jayos-ach']`. The wallpaper choice is in memory (Auto on every load). Sound is off on load. Exception: supabase-js keeps its auth session in localStorage, which is required for the moderator login and for the per-visitor pending rule. | User decision 5, with the auth exception stated. |
| D15 | **Content changes:** Joblog becomes `p9` (appended, so `p:0` is still RecycleWise for the Recycle Bin). It is added to Skills "used in" for React, TypeScript and PostgreSQL. About JAY-OS text changes from "the real one would use React Three Fiber" to "Built with React, Three.js and a lot of CSS." The Recruiter view gains a "CV (PDF)" link and a "Full résumé ↓" link. The résumé page does not show the "draft blurb" chip (the data keeps `draft:true` and the OS project window still shows the chip). | Keeps one content source and accurate copy. |
| D16 | **Visitor Wall examples** (3 client-side 12×12 drawings, L768–772) show only while there are 0 approved drawings: on the corkboard, and in the app labelled "example". The corkboard caption counts approved drawings only. | Keeps the room from looking empty without mixing fake items into real moderation. |
| D17 | **Fonts:** keep the Google Fonts link from L3–5 (`display=swap`, preconnect). Canvas textures are redrawn after `document.fonts.load(...)` for the four canvas fonts. | Faithful, and needs no new dependencies. Self-hosting is an optional follow-up. |

---

## 2. Target tree

```
index.html                     SEO head, fonts, <a class="skip">, #app, #resume-root with <!--resume-outlet-->
vite.config.js                 react plugin + vitest config
eslint.config.js               + test/node globals, restricted imports for lazy chunks
.nvmrc  .env.example           22 ; VITE_SUPABASE_URL= / VITE_SUPABASE_ANON_KEY=
package.json                   engines node >=20.19 ; scripts dev/build/preview/lint/test/test:watch/assets:*
public/
  files/JEWOOLEE_CV.pdf        (kept)
  images/favicon.svg           (kept; every other file in public/images is deleted)
  img/jay.jpg                  portrait, 420w max
  img/jay-px.png               precomputed 56×72 dithered portrait
  img/projects/*.webp          9 project images, 420w max (incl. joblog.webp)
  robots.txt
scripts/
  optimize-images.mjs          sharp: design/img/*.jpg -> public/img/projects/*.webp, public/img/jay.jpg
  make-pixel-portrait.mjs      sharp raw + src/lib/dither.js -> public/img/jay-px.png
  capture-joblog.sh            headless Chrome screenshot -> optimize -> joblog.webp (fallback: pixel placeholder)
  prerender.mjs                injects résumé HTML + JSON-LD into dist/index.html
supabase/
  migrations/20261018000000_visitor_wall.sql
  seed/admin.sql               template: add Jay to public.admins by email
  __tests__/auth-shim.sql      fake auth schema/roles for PGlite
  __tests__/visitor_wall.pglite.test.js
src/
  main.jsx                     createApp(); createRoot(#app) <App/> ; hydrate/create #resume-root <Resume/>
  App.jsx                      <AppProvider><Stage/><OsPortal/><Analytics/></AppProvider>
  app/createApp.js             composition root (section 3)
  app/AppContext.jsx           AppProvider, useApp()
  core/constants.js            OS_W 900, OS_H 675, NARROW_PX 760, CAM_NARROW_ASPECT 1.05, WHEEL_EXIT 240, WHEEL_GAP_MS 400 …
  core/math.js                 clamp, ss (smoothstep, L435), easeIO (cubic, L1011), easeQuad (L1254), lerp
  core/store.js                createStore(initial) {get,set,subscribe}; useStore(store, selector)
  core/storage.js              safe JSON get/set (L436)
  core/motion.js               reducedMotion store, live matchMedia subscription
  core/timers.js               createTimers(): timeout/interval/raf tracked, clearAll()
  core/own.js                  own(map, key) -> value | undefined (Object.hasOwn)
  core/toasts.js               toast store + toast(title, body, kind)
  core/sound.js                Snd (L638–649) with injectable AudioContext factory
  core/achievements.js         ACH (L655–660), store, unlock()
  core/clock.js                formatZoneTime(date, tz), useClock(intervalMs)
  content/profile.js projects.js roles.js skills.js index.js
  lib/png.js                   indexed PNG encoder + readPngInfo + validateDrawingDataUrl
  lib/pixelIcons.js            PAL, BMP (L615–632) -> ICON data URLs
  lib/dither.js                PXPAL, BAYER, retroDither (L469–475, pure)
  stage/Stage.jsx Hud.jsx Cue.jsx Toasts.jsx RecruiterView.jsx NoWebGLNotice.jsx
  stage/controller.js          Ctrl state machine (L1011–1031 + fixes)
  stage/ticker.js              single rAF loop
  stage/wheel.js keys.js       stage wheel (L1044–1054), keydown/Konami/Escape (L1038–1042)
  stage/useStageBindings.js    attaches listeners/observers; cleans up
  stage/SceneMount.jsx         lazy scene, StrictMode-safe
  os/osController.js           OS state machine + window manager (L673–764)
  os/osHost.js                 imperative holder/os elements, setFlat/fitFlat/setSize/setLive/syncClasses
  os/windowMath.js             openRect, dragPosition, fitWindows (pure)
  os/registry.js               Map of app defs + dynApp (p:N, art:N)
  os/OsPortal.jsx JayOS.jsx StandbyLayer.jsx BootLayer.jsx OffLayer.jsx Desktop.jsx MenuBar.jsx MenuPop.jsx
  os/DesktopIcons.jsx WindowLayer.jsx Window.jsx Fx.jsx DesktopContext.js
  os/apps/About.jsx Projects.jsx ProjectDetail.jsx Experience.jsx Skills.jsx ResumeApp.jsx Mail.jsx
  os/apps/Service.jsx Trophies.jsx Bin.jsx AboutOs.jsx Art.jsx Display.jsx VisitorWall.jsx
  os/apps/terminal/Terminal.jsx commands.js parse.js neofetch.js
  os/apps/bughunt/BugHunt.jsx bugLogic.js
  os/apps/snake/Snake.jsx snakeLogic.js
  os/apps/paint/Paint.jsx paintLogic.js
  wallpaper/modes.js layout.js render.js secrets.js engine.js snapshot.js wallpaperStore.js WallpaperCanvas.jsx
  wall/examples.js errors.js mockWallClient.js supabaseWallClient.js wallClient.js wallStore.js
  scene/loadScene.js createScene.js sceneMath.js textures.js hotspots.js floppy.js
  resume/Resume.jsx TrophiesGrid.jsx jsonld.js entry-server.jsx
  styles/tokens.css stage.css os.css apps.css resume.css
  test/setup.js fakeCanvas.js renderWithApp.jsx fakeSupabase.js fixtures/
```
Tests sit next to modules as `*.test.js(x)`.

---

## 3. Module boundaries and the shared store

```
core  <-  content, lib  <-  os, wallpaper, wall  <-  stage, scene, resume  <-  app/createApp  <-  main/App
```
- Nothing in `core`, `content` or `lib` imports React components, `three` or Supabase.
- Only `src/scene/createScene.js` imports `three` (ESLint `no-restricted-imports` enforces this). `loadScene.js` imports it with `import('./createScene.js')`, so it becomes its own chunk.
- Only `src/wall/supabaseWallClient.js` imports `@supabase/supabase-js`. `wallClient.js` loads it lazily, and only when both env vars are set.

`createApp(overrides = {})` returns one object. Tests pass fakes for any field.
```
app = {
  timers,                       // core/timers (root group)
  motion:   { store {reduce}, reduce() },
  toasts:   { store {list}, toast(title, body, kind) },
  snd:      { store {on}, setOn(v), tone, noise, click, chime, floppy, pop, ach, off },
  ach:      { list: ACH, store {got:Set}, unlock(id) },
  wallpaper:{ store {choice}, setChoice(k) -> bool, current(now?) -> mode key },
  wall:     wallStore (section Phase 6),
  host:     createOsHost(),                     // imperative elements
  os:       createOsController({host, registry, ach, toasts, snd, motion, timers, scene:()=>app.scene.api, ctrl:()=>app.ctrl}),
  scene:    { store {status:'loading'|'ready'|'unavailable'}, api: null, setApi(api|null), setStatus(s) },
  ctrl:     createController({...}),            // store of discrete fields {mode, interactive, narrow}
  ui:       { store {recOpen:false, stageVisible:false} },
  nav:      { goToResume(), openLaptop() },     // openLaptop = ctrl.enter()
  wallpaperEngine: null | engine (set by WallpaperCanvas),
}
```
Subscriptions (all removed on cleanup):
- Scene → `os.store` (state change → `onOS`, the mirror redraw), `wall.store` (corkboard PNGs → `setWall`), `wallpaper.store` (mode → `onOS(os.state)`, same as L611).
- The host's class sync → `os.store` and `scene.store` (fallback flag).
- Controller → `scene.store` (status change → `applyFlat`).
- HUD → `ach.store`, `snd.store`, `ctrl.store`.
- Per-frame values (z, p, cue opacity, OS size) are never put in React state. The controller writes cue opacity and the `zoomed` class through injected callbacks.

---

## 4. Prototype bugs fixed (and where)

| ID | Bug | Fix | Phase |
|---|---|---|---|
| B1 | Unsafe object-key lookups: `C[cmd]`, `NAMES[a]`, `WP[a]` (`wallpaper constructor` saves junk, then crashes at L611), `APPS[id]` (`open constructor`), `keys[...]`, Snake `K[...]` | `Map` or `own()` everywhere | 1, 2, 4, 5 |
| B2 | Snake `reset()` leaves the old "Ate: …" line (L968) | reset restores "Arrow keys / WASD, swipe, or the pad below." | 5 |
| B3 | Paint: no `pointercancel`/`lostpointercapture` (L995), so `down` sticks | handle both, plus `touch-action:none` (already in CSS L212) | 6 |
| B4 | Wallpaper city re-rolls whenever W changes, including on resize (L502, L594) | per-feature seeded RNG streams in normalised units (layout stable across W), rebuild debounced 200 ms, never during a camera tween | 5 |
| B5 | Unremoved listeners, intervals and rAF (L599–600, L612, L729, L979, L1036–1054, L1236, L1268, L1280); untracked `setTimeout`s (L948, L1202, L924–925) | `useEffect` cleanup, `createTimers()`, single ticker | all |
| B6 | StrictMode double mount creates two WebGL contexts | `SceneMount` cancel flag plus a complete `dispose()` | 3, 7 |
| B7 | `initScene` throwing after `stage.prepend(canvas)` leaves a stale canvas (L1276) | `createScene` disposes partial work before rethrowing | 7 |
| B8 | `armed:true` at load: a restored mid-track scroll position auto-enters on load | `armed` starts `null`, and the first update sets `armed = p < .01` | 3 |
| B9 | Navigating to content below re-triggers auto-enter on the way down | `goToResume()` suppression flag | 3 |
| B10 | Fallback: `.flat-host.on{touch-action:none}` (L50) traps phone users without WebGL, who can't scroll past | `touch-action:none; overscroll-behavior:contain` only with `.flat-host.trap`, which is set while `ctrl.interactive` | 3 |
| B11 | Konami calls `Scene.disco(6)` under reduced motion when the OS is not on (L1041) | skip when reduce | 3 |
| B12 | Dead code: `#hud-exit` (always hidden, L70), `lidForce`, `Ctrl.ease` | dropped | 3, 7 |
| B13 | `unlock(unknownId)` throws (`a[1]` of undefined, L662) | ignore unknown ids | 1 |
| B14 | Display app re-snapshots 4 scenes on every render (L835) | cache per resolved mode | 5 |
| B15 | `open` matches single digits only (L901) | `/^p?(\d+)$/` | 4 |
| B16 | Hard-coded counts: "p1 … p8" (L896), "8 projects" (L921), "C: projects (8)" (L680), "Projects · 8 items" (L796), "8 projects" in Recruiter view (L296), "0/12" (L349) | derived from content / `ACH.length` | 2, 3, 4 |
| B17 | `⏏ Close laptop` does nothing in fallback | hidden when scene status is `unavailable` | 3 |

---

## 5. Phases

Common rules for every phase:
- `npm test`, `npm run lint` and `npm run build` must pass at the end of the phase.
- Keep StrictMode on in `main.jsx`.
- Every test file imports `describe/it/expect/vi` from `vitest` explicitly (no globals).
- jsdom cannot render WebGL, CSS3D, CSS animations or real layout (`clientWidth` is 0, `getBoundingClientRect` is zeros) and has no `<canvas>` drawing. Tests use `Object.defineProperty` for sizes, the recording canvas from `src/test/fakeCanvas.js`, fake timers (`vi.useFakeTimers()`), and injected clocks and RNGs.
- Exact strings come from the cited prototype lines unless the plan says otherwise. The test-writer must copy them from the source, including curly quotes, `·`, `…`, `’` and Korean text.

---

### Phase 0: Tooling and test harness

**Goal:** a test runner and the conventions every later phase relies on, without breaking the current site.

**Files**
- `package.json`:
  - add `"engines": {"node": ">=20.19"}`.
  - scripts: `"test": "vitest run"`, `"test:watch": "vitest"`, `"lint": "eslint ."`. Keep dev/build/preview.
  - devDeps (exact): `vitest@4.1.11 jsdom@26.1.0 @testing-library/react@16.3.0 @testing-library/dom@10.4.1 @testing-library/jest-dom@6.10.0 @testing-library/user-event@14.6.1 @electric-sql/pglite@0.5.8 sharp@0.34.5`.
  - deps (exact): `three@0.128.0 @supabase/supabase-js@2.109.0`.
  - Do **not** remove the old dependencies yet (phase 3 does).
- `.nvmrc` (`22`), `.env.example`. `.gitignore` adds `coverage`, `dist-ssr`, `.env` (`*.local` is already there).
- `vite.config.js`: `import { defineConfig } from 'vitest/config'`, plus
  `test: { environment: 'jsdom', setupFiles: ['./src/test/setup.js'], include: ['src/**/*.test.{js,jsx}', 'supabase/**/*.test.js', 'scripts/**/*.test.mjs'], css: false, restoreMocks: true, unstubEnvs: true, unstubGlobals: true }`.
- `eslint.config.js`:
  - ignores `dist`, `dist-ssr`, `coverage`, `design`.
  - add a block with `globals.node` for `vite.config.js`, `eslint.config.js`, `scripts/**`, `supabase/**`.
  - add `no-restricted-imports` for `src/**` with paths `three`, `@supabase/supabase-js` and pattern `three/*`, each with the message "lazy chunk only".
  - add override blocks that turn the rule off for `src/scene/createScene.js` and `src/wall/supabaseWallClient.js`.
- `src/test/setup.js`:
  - `import '@testing-library/jest-dom/vitest'`.
  - `afterEach`: `cleanup()`, `localStorage.clear()`, `sessionStorage.clear()`, `vi.useRealTimers()`.
  - stubs:
    - `HTMLCanvasElement.prototype.getContext` returns `createRecordingContext(canvas)`, and `toDataURL` returns `'data:image/png;base64,TEST'`.
    - `window.matchMedia` is controllable: export `setReducedMotion(bool)`, which fires `change` listeners.
    - `IntersectionObserver` and `ResizeObserver` mocks with exported `triggerIntersection(el, bool)` and `triggerResize(el, {width, height})`.
    - `window.scrollTo` and `Element.prototype.scrollIntoView` are `vi.fn()`.
    - `Element.prototype.setPointerCapture`, `releasePointerCapture` and `hasPointerCapture` are no-ops.
    - `document.fonts = { ready: Promise.resolve(), load: () => Promise.resolve([]) }`.
    - `requestAnimationFrame` and `cancelAnimationFrame` fall back to `setTimeout(cb(performance.now()), 16)` if missing.
- `src/test/fakeCanvas.js`: `createRecordingContext(canvas)`. A Proxy object that:
  - records every method call as `[name, ...args]` in `ctx.calls`, and every property set in `ctx.sets`.
  - returns `{data: new Uint8ClampedArray(w*h*4), width, height}` from `getImageData` and `createImageData`.
  - returns a stub gradient from `createLinearGradient` (`addColorStop` records).
  - returns `{width: text.length * 6}` from `measureText`.
- `src/test/renderWithApp.jsx`: `renderWithApp(ui, overrides)` builds `createApp(overrides)` (the stub until phase 1 exists; skip the helper test until then) and renders inside `AppProvider`.

**TEST LIST** (`src/test/setup.test.js`)
1. A jest-dom matcher works: an element appended to `document.body` passes `toBeInTheDocument()`.
2. `canvas.getContext('2d').fillRect(0,0,1,1)` records `['fillRect',0,0,1,1]` in `ctx.calls`, and `ctx.fillStyle='#fff'` records `['fillStyle','#fff']` in `ctx.sets`.
3. `canvas.toDataURL()` starts with `data:image/png;base64,`.
4. `matchMedia('(prefers-reduced-motion: reduce)').matches` is false. After `setReducedMotion(true)` it is true, and a registered `change` listener was called once.
5. `triggerIntersection(el, true)` calls the callback of an observer observing `el` with `[{target: el, isIntersecting: true}]`. `triggerResize` behaves the same way for ResizeObserver.
6. `window.scrollTo` is a mock function.
7. `localStorage.setItem('x','1')` in test A, and in test B `localStorage.getItem('x')` is null.
8. `document.fonts.ready` resolves.

**ACCEPTANCE**
- `npm test` runs and passes.
- `npm run lint` passes, with the old components still present (fix only what the new config flags; do not refactor old code).
- `npm run build` still builds the current site.
- `node -e "require('three/package.json').version"` prints `0.128.0`.

**Risks:** ESLint may flag `rules-of-hooks` in the old `Experience.jsx`. If so, add a temporary file-level disable comment, because the file is deleted in phase 3.

---

### Phase 1: Foundations, content and assets

**Goal:** the pure building blocks and the single content module, plus optimized images and the pixel portrait.

**Files:** `src/core/*`, `src/content/*`, `src/lib/*`, `src/wallpaper/modes.js`, `src/wallpaper/wallpaperStore.js`, `src/app/createApp.js` (core fields only), `src/app/AppContext.jsx`, `scripts/optimize-images.mjs`, `scripts/make-pixel-portrait.mjs`, `scripts/capture-joblog.sh`, `public/img/**`.

**Design notes**

- **`core/math.js`**
  - `clamp`.
  - `ss(a,b,x)`, L435.
  - `easeIO`, L1011: `t<.5 ? 4t³ : 1-(-2t+2)³/2`.
  - `easeQuad`, L1254: `k<.5 ? 2k² : 1-(-2k+2)²/2`.
- **`core/store.js`**
  - `createStore(init)` returns `{get, set(partial|fn), subscribe(fn) -> unsubscribe}`.
  - `set` emits only if a shallow comparison finds a change.
  - `useStore(store, selector = s => s)` uses `useSyncExternalStore(store.subscribe, () => selector(store.get()), getServerSnapshot)`.
  - `getServerSnapshot` defaults to `() => selector(store.initial)`.
- **`core/timers.js`**: `createTimers({raf, caf})`
  - `timeout(fn, ms)`, `interval(fn, ms)` and `raf(fn)` each return a cancel function.
  - `clearAll()` cancels everything.
  - `child()` creates a sub-group, which is cleared together with its parent.
- **`core/motion.js`**
  - store `{reduce}` from `matchMedia('(prefers-reduced-motion: reduce)')`.
  - subscribes to `change` (L433 read it once; this is a fix).
  - `dispose()`.
- **`core/toasts.js`**
  - `toast(title, body, kind)` pushes `{id, title, body, kind, fading:false}`.
  - after **3200 ms** it sets `fading:true`; after **3600 ms** it removes the toast (L653–654).
- **`core/sound.js`**
  - port of L638–649. `ctxFactory` defaults to `window.AudioContext || webkitAudioContext`.
  - `tone` and `noise` return early unless `on`.
  - `setOn(v)` sets the store, creates the context when `v`, and plays `tone(660,.12,'square',.05)` when turning on.
- **`core/achievements.js`**
  - `ACH`: copy the 13 tuples from L655–660 verbatim into `{id, title, desc, icon}`.
  - Load `got` from `storage.get('jayos-ach', [])`, keeping only known ids.
  - `unlock(id)`: no-op if the id is unknown or already got (fix B13). Otherwise add it, persist the array, call `toast('★ Achievement unlocked', title)` and `snd.ach()`.
- **`core/clock.js`**
  - `formatZoneTime(date, tz)` uses `toLocaleTimeString('en-GB',{timeZone, hour:'2-digit', minute:'2-digit'})`, and returns `'--:--'` if that throws (L727).
  - `formatZoneDay(date, tz)` is the same with `weekday:'short'` (L918), and returns `'?'` if it throws.
  - `ZONES = {MTL:'America/Toronto', SEL:'Asia/Seoul'}`.
  - `useClock(ms=15000)` returns `Date` and re-renders on an interval, which is cleared on unmount.
- **Content** (rename fields for readability):
  - `PROJECTS`: `{title, image, host, url, live?, repo?, draft?, tags, blurb}`. Copy L442–449 verbatim (note `draft:true` on adStar and HTTP). Image basenames are `recyclewise`, `whenareyoufree`, `duonosaur`, `menulens`, `marletnests`, `adstar`, `http`, `library`, and the path is `/img/projects/<image>.webp`. Append:
    ```js
    { title:'Joblog', image:'joblog', host:'GitHub', url:'https://github.com/jewoolee0502/Joblog', live:'https://joblog-nine.vercel.app',
      tags:['React','TypeScript','Express','Prisma','PostgreSQL/Supabase','Claude API','Chrome Extension'],
      blurb:'An AI-powered job-application tracker. Applications move through a Kanban pipeline, an LLM classifier reads Gmail or Outlook emails and moves each one to the right stage automatically, and a Chrome extension saves job postings in one click. Follow-up nudges and analytics keep the search moving.' }
    ```
  - `ROLES`: `{dates, role, company, summary}` from L452–458.
  - `SKILLS`: `{name, label, cat, usedIn}` from L461–464. Add `'Joblog'` to the end of `usedIn` for TypeScript, React and PostgreSQL. `CAT` from L466.
  - `PROFILE`:
    - name `Jewoo (Jay) Lee`; short `Jay`; tagline `Full-stack developer · B.Eng. Computer Engineering, McGill · Montréal` (L292).
    - email `jewoo.lee@mail.mcgill.ca`; links github `https://github.com/jewoolee0502`, linkedin `https://www.linkedin.com/in/jewoo-lee/`, instagram `https://www.instagram.com/jwuu_lee/` (handle `jwuu_lee`).
    - cv `/files/JEWOOLEE_CV.pdf`; getform `https://getform.io/f/akknzgea`.
    - about paragraph (L791); facts (L792); education `{school:'McGill University', degree:'B.Eng. Computer Engineering', dates:'Jan 2020 – Dec 2025'}` (from the CV PDF).
    - `resumeTags` (L813); recruiter bullets (L294–297), with bullet 3 built as `${PROJECTS.length} projects, including RecycleWise (McGill capstone), WhenAreYouFree and Duonosaur`.
    - `site`: build-time `VITE_SITE_URL`, default `https://jewoo-lee.vercel.app` (the CV domain does not resolve; lead decision).
- **`lib/png.js`**
  - `encodeIndexedPng({width, height, indices, palette, alpha})` returns a `Uint8Array`:
    - signature; IHDR with bit depth 8 and colour type 3.
    - PLTE; tRNS (only when some alpha < 255).
    - IDAT: zlib header `78 01`, *stored* deflate blocks of ≤ 65535 bytes (BFINAL/BTYPE=00, LEN/NLEN little-endian), filter byte 0 per row, Adler-32 big-endian.
    - IEND.
    - CRC-32 table (poly `0xEDB88320`).
  - `bytesToBase64`, `base64ToBytes` (use `btoa`/`atob` on a binary string).
  - `gridToPngDataUrl(grid: (hex|null)[], size, paletteHex[])`: index 0 is transparent, and colours map to 1..n.
  - `readPngInfo(bytes)` returns `{ok, width, height, colorType}`.
  - `validateDrawingDataUrl(url)` returns `{ok:true, base64}` or `{ok:false, code}`. Codes:
    - `bad_png`: no `data:image/png;base64,` prefix, bad base64 or bad signature.
    - `too_large`: more than **4096** decoded bytes.
    - `bad_size`: IHDR is not 24×24.
- **`lib/pixelIcons.js`**: `PAL` and `BMP` verbatim from L615–632. `ICON[key]` is the 12×12 data URL from `encodeIndexedPng` ('.' is transparent).
- **`lib/dither.js`**: `PXPAL` and `BAYER` from L469–470. `retroDither(data: Uint8ClampedArray, w, h, pal, strength)` returns a new array. It follows the L472–475 algorithm exactly, and sets alpha to 255.
- **`wallpaper/modes.js`**
  - `MODES` (L486–488 verbatim), `CROSS` (L490), `RAC`, `RPAL`, `BOAT` (L491–493).
  - `isMode(k)` uses `own`.
  - `autoWp(date = new Date(), tz = 'America/Toronto')`: hour from `Intl.DateTimeFormat('en-GB',{timeZone:tz, hour:'2-digit', hourCycle:'h23'})`, then `% 24`, falling back to 12 if that throws. Hours 7–16 give `day`, 17–19 give `golden`, everything else gives `night` (L608).
  - `clampWidth(w, h) = max(160, min(420, round(180 * (w||900) / (h||675))))` (L594).
- **`wallpaper/wallpaperStore.js`**
  - `{choice:'auto'}` is **in memory only**: it never reads or writes storage.
  - `setChoice(k)` accepts `'auto'` or `isMode(k)` and returns a boolean.
  - `current(now)` returns `choice==='auto' ? autoWp(now) : choice`.
  - A 60 s interval re-emits while the choice is auto (L612). It is started and stopped by the app.
- **Assets**
  - `npm run assets:images` runs `scripts/optimize-images.mjs`: for each `design/img/*.jpg` except `jay.jpg`, `sharp(...).resize({width:420, withoutEnlargement:true}).webp({quality:72})` into `public/img/projects/<name>.webp`. It also writes `jay.jpg` to `public/img/jay.jpg` at mozjpeg quality 78.
  - `npm run assets:portrait` runs `scripts/make-pixel-portrait.mjs`: crop the top `sw × min(sh, sw*72/56)` (L477), resize to 56×72 (`fit:'fill'`), take raw RGBA, run `retroDither(…, PXPAL, 28)`, and write `public/img/jay-px.png`.
  - `scripts/capture-joblog.sh`:
    ```
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
      --window-size=1280,800 --virtual-time-budget=8000 --screenshot=/tmp/joblog.png https://joblog-nine.vercel.app
    ```
    then `node scripts/optimize-images.mjs --one /tmp/joblog.png joblog`.
  - If the capture fails (offline, or the page is blank), generate a 16:10 pixel placeholder: a 48×30 grid of three Kanban columns in `PAL` colours, encoded with `png.js` and upscaled ×8 nearest by sharp into `joblog.webp`.
  - Commit the generated files. The scripts are not part of `npm run build`.

**TEST LIST**
- `core/math.test.js`:
  - `clamp(5,0,1)===1`.
  - `ss(0,1,.5)===.5`; `ss(0,1,-1)===0`; `ss(0,1,2)===1`.
  - `easeIO(0)===0`, `easeIO(.5)===.5`, `easeIO(1)===1`, `easeIO(.25)===.0625`.
  - `easeQuad(.25)===.125`.
- `core/store.test.js`:
  - `set` notifies subscribers.
  - Setting identical values does not notify.
  - Unsubscribe works.
  - `useStore` re-renders a component only when the selected slice changes. Render a counter with a selector on `a`, set `b`, and check the render count is unchanged.
- `core/storage.test.js`:
  - get returns the default when the key is missing.
  - get returns the default when the stored JSON is invalid.
  - set swallows an exception from `localStorage.setItem` (stubbed to throw).
- `core/timers.test.js` (fake timers):
  - a timeout fires.
  - `clearAll` cancels pending timeouts, intervals and rafs.
  - a child group is cleared by its parent's `clearAll`.
- `core/motion.test.js`:
  - the initial value follows `matchMedia`.
  - `setReducedMotion(true)` updates the store.
  - `dispose` removes the listener (a later change does not update).
- `core/toasts.test.js` (fake timers):
  - a toast appears with its fields.
  - at 3199 ms it is not fading; at 3200 ms it is fading; at 3600 ms it is removed.
- `core/sound.test.js`:
  - with sound off, `tone()` never calls the factory.
  - `setOn(true)` calls the factory once and creates one oscillator (fake AudioContext records `createOscillator`) with frequency 660.
  - `setOn(false)` then `tone()` creates nothing new.
  - store `on` toggles.
- `core/achievements.test.js`:
  - `ACH.length===13`; ids are in order `boot, floppy, term, neofetch, hire, bugs, snake, paint, tags, lamp, konami, shutdown, local`.
  - `unlock('boot')` adds the id, persists `["boot"]` to `jayos-ach`, calls the toast with `('★ Achievement unlocked','Power User')`, and calls `snd.ach` once.
  - a second `unlock('boot')` adds no toast and plays no sound.
  - `unlock('nope')` is a no-op and does not throw.
  - stored `["boot","bogus"]` loads as `{boot}`.
  - stored invalid JSON loads as an empty set.
- `core/clock.test.js`:
  - `formatZoneTime(new Date('2026-07-15T15:04:00Z'),'America/Toronto')==='11:04'`.
  - `formatZoneTime(…,'Asia/Seoul')==='00:04'`.
  - an invalid tz gives `'--:--'`.
  - `formatZoneDay` with an invalid tz gives `'?'`.
- `core/own.test.js`:
  - `own({a:1},'a')===1`.
  - `own({}, 'constructor')`, `own({}, 'toString')` and `own({}, '__proto__')` are all `undefined`.
- `content/content.test.js`:
  - `PROJECTS.length===9`; titles in order (the prototype's 8, then `Joblog`).
  - `PROJECTS[8]` has the exact Joblog url, live and tags.
  - adStar and HTTP have `draft===true`, and no other project does.
  - every project has `title`, `image`, `host`, `url` and a non-empty `tags` array.
  - `ROLES.length===7`, and the first company is `Wholesale Express`.
  - `SKILLS.length===16`; React's `usedIn` includes `Joblog`.
  - `PROFILE.email==='jewoo.lee@mail.mcgill.ca'`; the recruiter bullet includes `9 projects, including RecycleWise`.
  - every skill `cat` is a key of `CAT`.
- `lib/png.test.js`:
  - encode a 2×2 image with palette `[[255,0,0],[0,0,255]]`, alpha `[0,255]` and indices `[0,1,1,0]`. Assert:
    - the signature bytes.
    - IHDR fields (2, 2, depth 8, type 3).
    - the PLTE length is 6 and tRNS is `[0,255]`.
    - every chunk CRC equals a recomputed CRC.
    - `zlib.inflateSync` (from `node:zlib`) of the concatenated IDAT data equals `[0,0,1, 0,1,0]`.
  - a 24×24 all-transparent paint grid encodes to ≤ 4096 bytes.
  - `validateDrawingDataUrl`:
    - that grid gives `{ok:true}`.
    - a 25×24 image gives `bad_size`.
    - `'data:image/jpeg;base64,AAAA'` gives `bad_png`.
    - a prefix plus 6000 bytes of signature-valid junk gives `too_large`.
  - `readPngInfo` on random bytes gives `ok:false`.
- `lib/pixelIcons.test.js`:
  - `ICON` has the 15 keys from `BMP`.
  - each value starts with `data:image/png;base64,`.
  - `readPngInfo` of each is 12×12.
- `lib/dither.test.js`:
  - every output pixel's RGB is a member of `PXPAL`, and alpha is 255.
  - same input gives the same output.
  - an all-`[16,14,24]` input gives an all-`PXPAL[0]` output.
- `wallpaper/modes.test.js`:
  - `autoWp` for July (EDT):
    | UTC input | expected |
    |---|---|
    | `2026-07-15T10:59Z` | night |
    | `T11:00Z` | day |
    | `T20:59Z` | day |
    | `T21:00Z` | golden |
    | `T23:59Z` | golden |
    | `2026-07-16T00:00Z` | night |
    | `T04:00Z` | night |
  - January: `2026-01-15T12:00Z` gives day.
  - tz `'Invalid/Zone'` gives day.
  - `clampWidth(900,675)===240`, `clampWidth(0,0)===240`, `clampWidth(100,675)===160`, `clampWidth(2000,675)===420`.
  - `isMode('constructor')===false`.
- `wallpaper/wallpaperStore.test.js`:
  - the default is `auto`.
  - `setChoice('golden')` returns true and `current()==='golden'`.
  - `setChoice('constructor')` returns false and leaves the choice unchanged.
  - `localStorage` is untouched after `setChoice`, and a new store starts at `auto`.
  - in auto, `current(date)` equals `autoWp(date)`.
- `app/createApp.test.js`:
  - `createApp()` returns `motion`, `toasts`, `snd`, `ach` and `wallpaper`.
  - an overrides object replaces a field.

**ACCEPTANCE**
- `public/img/projects/` holds 9 `.webp` files, each 420 px wide or less and each 40 KB or less.
- `public/img/jay-px.png` is 56×72.
- `public/img/jay.jpg` exists.
- No module in `core/`, `content/` or `lib/` touches `window` at import time (all access is inside functions), so SSR prerender is safe.
- The reviewer compares the content strings against L442–466 and L655–660.

**Risks**
- The Joblog live demo may render a login page or nothing headless. The placeholder path is acceptable; flag it to the user.
- `sharp` must install a prebuilt binary. On failure, run the scripts on a machine where it installs; the outputs are committed.

---

### Phase 2: JAY-OS shell

**Goal:** the OS state machine, the window manager, the imperative host, and the React shell (layers, menubar, menu, icons, windows, fx). No real apps yet: tests use a stub registry.

**Files:** `src/os/osController.js`, `osHost.js`, `windowMath.js`, `registry.js` (empty `Map` plus `dynApp`), `OsPortal.jsx`, `JayOS.jsx`, `StandbyLayer.jsx`, `BootLayer.jsx`, `OffLayer.jsx`, `Desktop.jsx`, `MenuBar.jsx`, `MenuPop.jsx`, `DesktopIcons.jsx`, `WindowLayer.jsx`, `Window.jsx`, `Fx.jsx`, `DesktopContext.js`; `src/styles/os.css` (L86–167 verbatim); `src/styles/apps.css` (L169–239 verbatim); `createApp` gains `host` and `os`.

**Design notes**

- **`osHost`**:
  - `createOsHost()` creates `holder` (`div#os-holder`, inline width 900px, height 675px) and `osEl` (`div.os#os`, `data-state="standby"`) inside it.
  - `attachPark(el)` / `detachPark()`: parks the holder in `.park` when it has no parent.
  - `bindFlatHost(el)`.
  - `size()` returns `{w: osEl.clientWidth || 900, h: osEl.clientHeight || 675}` (L677).
  - `scale()` returns `osEl.getBoundingClientRect().width / osEl.offsetWidth || 1` (L691; NaN becomes 1).
  - `setSize(w, h)` (L754–755): rounds, does nothing if unchanged, writes holder and os width/height, and returns `{shrunk}`.
  - `fitFlat()` (L747–750).
  - `setFlat(v, compact)` (L757–761): toggles `compact`. When `v` changes, it moves osEl and toggles `flat` and flat-host `on`. When turning flat off, it clears transform, resets the size cache, and calls `setSize(900,675)`. When `v` is set, it calls `fitFlat()`.
  - `setLive(v)` (L756): toggles `live`, and on false resets `scrollTop` of `.wb, .t-out` inside osEl.
  - `syncClasses({state, collapsing, disco, fallback})`: sets `dataset.state` and toggles `collapsing`, `disco` and `fallback`.
  - `setTrap(v)`: toggles flat-host `trap` (B10).
- **`osController`** store:
  `{state:'standby', bootLines:[], splashing:false, barFull:false, collapsing:false, disco:false, fx:null, wins:[], focusedId:null, menuOpen:false, art:[], flat:false, compact:false, live:false}`
  - **`boot()`** (L682–686):
    - returns if the state is `boot` or `on`.
    - sets state `boot`, `bootLines=[]`, `splashing=false`, `barFull=false`.
    - ticks every **150 ms** (**30** with reduce). Lines come from `BOOT_LINES(content)`, which copies L679–681 exactly but builds line 4 as `Detecting drives:  A: 3½" floppy   C: projects (${PROJECTS.length})` and line 6 as `Mounting /experience (${ROLES.length} roles) ................ ` with tag `OK`. Tags render as `ok` (`OK`) or `warn` (`LOW` shows as `LOW (refill advised)`). Each line calls `scene()?.drive(.2)`.
    - After line 8: set `splashing`, and 16 ms later `barFull` (the CSS does `.8s steps(12)`).
    - After **1000 ms** (**150** with reduce), if the state is still `boot`: set state `on`, call `snd.chime()`, `ach.unlock('boot')`, and flush the queue in order.
  - **`shutdown(then)`** (L687–688):
    - only from `on`. Remove all windows, set `menuOpen=false`, `fx=null`, `collapsing=true`, call `snd.off()`.
    - after **600 ms** (**50** with reduce): `collapsing=false`, state `off`, `unlock('shutdown')`, then call `then` after **900 ms**.
  - **`openApp(id, opts={})`** (L696–709):
    - if the state is not `on`: queue it, boot if the state is `off` or `standby`, and return null.
    - if the window is already open: focus it, `shakeNonce++`, and if `opts.cmd` is set, `win.cmd = {text, nonce++}`. Return the record.
    - `def = own-lookup(registry, id) ?? dynApp(id)`; return null if there is none.
    - size and position use `openRect(def, size, cascade)`, then `cascade=(cascade+1)%6`.
    - record `{id, title, color: def.color ?? '#4AA6EE', x, y, w, h, z: ++z (z starts 20), opening:true, shakeNonce:0, cmd: opts.cmd ? {text, nonce:1} : null}`.
    - focus it, play `snd.tone(520,.05,'square',.03)`, and clear `opening` after **220 ms**.
  - `closeApp(id)`, `focus(id)` (`z=++z`, `focusedId`), `moveWindow(id,x,y)`, `addArt(dataUrl) -> n`.
  - `setMenu(open)`.
  - `disco()` (L741): no-op with reduce; otherwise `disco=true` for **6000 ms** and `scene()?.disco(6)`.
  - `matrix()` / `confetti()`: `fx = {kind, nonce}`. `stopFx()`.
  - `setSize(w,h)`: calls `host.setSize`; if it shrank, `wins = fitWindows(wins, size)`, setting the store only when the array changed.
  - `setFlat(v, compact)` / `setLive(v)`: call the host, then the store.
  - getter `state`.
  - Every timer goes through a `timers.child()` that `dispose()` clears.
- **`windowMath`**
  - `openRect(def, {w:W, h:H}, cascade)` (L700–701):
    - `w=min(def.w??520, W-20)`, `h=min(def.h??400, H-50)`.
    - `x = def.x!=null ? clamp(def.x, 8, W-w-8) : clamp(130+cascade*30, 8, W-w-8)`.
    - `y = def.y!=null ? def.y : clamp(46+cascade*26, 40, H-h-8)`.
  - `dragPosition(start{l,t,x,y,s}, clientX, clientY, winW, {w:W,h:H})` (L694):
    - `left = clamp(l+(clientX-x)/s, -winW+90, W-90)`.
    - `top = clamp(t+(clientY-y)/s, 34, H-34)`.
  - `fitWindows(wins, {w:W,h:H})` (L743–744): `ww=min(w, W-20)`, `hh=min(h, H-50)`, `x=clamp(x, 8, W-ww-8)`, `y=clamp(y, 40, H-hh-8)`. Returns the *same array* if no record changed.
- **`registry.js`**
  - `registry = new Map()`. Later phases register `{title, color, w, h, x?, y?, Component}`.
  - `dynApp(id)`:
    - `p:<n>` → `PROJECTS[n]` gives `{title: p.title, color:'#FFD15C', w:600, h:540, Component: ProjectDetail}` (ProjectDetail is a placeholder until phase 4).
    - `art:<n>` gives `{title:'my-art-'+n+'.png', color:'#FFD15C', w:320, h:390}`.
    - `n` must match `/^\d+$/`; otherwise null (L868–874).
- **React shell**
  - `OsPortal` returns `createPortal(<JayOS/>, app.host.osEl)`. `JayOS` subscribes to the store and calls `host.syncClasses` in an effect.
  - Layers (L313–340): standby shows `JAY-OS` and `waking up …`; boot shows `pre` lines plus the splash with `JAY-OS` and `.bar i` (width 100% when `barFull`); desk; off (exact text L339).
  - `button.glass` (aria-label `Zoom into the screen`). Click: `app.nav.openLaptop()`, and boot if the state is `standby` or `off` (L726).
  - **MenuBar** (L317–324):
    - `◆ JAY-OS` toggles the menu (`aria-expanded`, class `on`).
    - `Help` calls `openApp('term', {cmd:'help'})` (L718).
    - spacer.
    - `⏏ Close laptop` (`id=mb-exit`, title `Step back from the laptop (Esc)`) calls `app.ctrl.exit()`.
    - `Sound: off|on` (`id=mb-snd`, `aria-pressed`) calls `snd.setOn(!on)`.
    - clock button `MTL HH:MM` + ` · SEL HH:MM` (classes `mb-mtl`, `mb-sel`). Click: `toast('Two time zones','Montréal, where Jay studies, and Seoul, where Jay’s from.','info')`.
  - A `pointerdown` on the OS outside the menu and logo closes the menu (L722).
  - **MenuPop** (L325–333), with `data-act`:
    - `About JAY-OS` (aboutos), `Desktop Background…` (display), `Trophies` (ach) open those apps.
    - **`Résumé`** (`resume-page`) calls `app.nav.goToResume()`.
    - `<hr>`.
    - `Restart` calls `shutdown(()=>boot())`.
    - `Shut Down…` calls `shutdown(()=>app.ctrl.exit())`.
    - Every item closes the menu.
  - **DesktopIcons** (L712–716): left and right lists exactly as at L712–713, `button.ic > img(ICON) + span`. Art icons `my-art-N.png` are appended to the right column (L1002–1003).
  - Wallmark (L336): `span#wp-cap` (caption from `MODES[wallpaper.current()].cap`) + `<br>psst · the city is clickable`.
  - **Window** (L702–709):
    - `section.win[data-app]` with style left/top/width/height/z-index and `--wc`; classes `focused` and `opening`.
    - On `shakeNonce` change: remove `shake`, force a reflow, add `shake`.
    - Header `.tb` contains `span.tb-t` and `button.tb-x` (`aria-label="Close window"`, `✕`, click stops propagation and closes). Body `.wb` renders `def.Component` with `{win}`.
    - `pointerdown` on the section focuses it.
    - **Drag** (L692–695): only on the header; ignored if the target is in a `button` or the store has `compact`. Use `setPointerCapture`; record `{l,t,x,y,s: host.scale()}`; on move, write `el.style.left/top` from `dragPosition`; on `pointerup`/`pointercancel`, commit `moveWindow` and reset the cursor.
  - **Fx** (L732–740): renders `canvas.fx` sized to `host.size()` while `fx` is set.
    - matrix: chars `ジェウ제우JAY01アカサタナ`, 16 px columns, fill `rgba(0,8,2,.12)`, `#7CFFA0`, `16px VT323, monospace`, 4500 ms.
    - confetti: 140 particles, colours `['#FFD15C','#4AA6EE','#E8452E','#3BB273','#C9A7FF']`, gravity .35, 2600 ms.
    - It ends by calling `stopFx()`. Uses `app.timers` rafs.
  - **DesktopContext** provides the `.l-desk` element (for the BugHunt layer in phase 5).

**TEST LIST**
- `os/windowMath.test.js`:
  - `openRect({w:300,h:200},{w:900,h:675},0)` → `{x:130,y:46,w:300,h:200}`; cascade 1 → `{x:160,y:72}`.
  - `{w:2000,h:2000}` → `w:880,h:625`.
  - `{w:340,h:250,x:520,y:50}` → `x:520` (`clamp(520,8,552)`), `y:50`.
  - `{x:800,w:340}` → `x:552`.
  - `dragPosition` with `s=1` moves by the delta; with `s=.5` it moves by twice the delta; it clamps left to `-winW+90` and `W-90`, and top to `34` and `H-34`.
  - `fitWindows`: a window `{x:600,w:300}` in `{w:700,h:500}` gets `x:392`; an unchanged input returns the identical reference (`toBe`).
- `os/osHost.test.js`:
  - the elements are created with the right ids and classes, holder style `900px/675px`, `data-state="standby"`.
  - `attachPark` puts the holder in the park.
  - `setFlat(true,false)` moves osEl into the flat host (`flatHost.contains(osEl)`), with classes `flat` and `on`.
  - `fitFlat` with flat-host 1200×675 (defineProperty) gives transform `scale(1)`, width `1200px` and height `675px`; with 450×675 it gives `scale(0.5)`, width `900px` and height `1350px`.
  - `setFlat(true,true)` (compact) clears transform, width and height.
  - `setFlat(false)` puts osEl back in the holder with empty transform and width `900px`.
  - `setSize(1000,700)` sets both widths and returns `{shrunk:false}`; then `setSize(950,650)` returns `{shrunk:true}`; the same size again returns `{shrunk:false}` and makes no style write.
  - `setLive(false)` resets `scrollTop` of a `.wb` and a `.t-out` (preset to 50) to 0.
  - `syncClasses` toggles the classes and sets `dataset.state`.
  - `scale()` returns 1 in jsdom, and returns .5 with a mocked `getBoundingClientRect().width=450` and `offsetWidth=900`.
- `os/osController.test.js` (fake timers, stub registry `{a:{title:'A',w:300,h:200}, b:{title:'B',w:340,h:250,x:520,y:50}}`, fake `ach`, `snd`, `scene`, `ctrl`):
  1. The initial state is `standby`.
  2. `boot()`:
     - state `boot`.
     - the first tick is synchronous, so there is 1 line right after `boot()`, still 1 at 149 ms, 2 at 150 ms, and all 8 at 1050 ms (7 × 150).
     - line 1 text is `JAY-BIOS (C) 2001-2026 · Montréal Edition`.
     - line 4 is exactly `Detecting drives:  A: 3½" floppy   C: projects (9)`.
     - line 7 has tag `LOW`.
     - `scene.drive` was called 8 times with `.2`.
     - `splashing` becomes true on the tick after the 8th line, and state `on` comes 1000 ms after that.
     - `unlock('boot')` and `snd.chime` are each called once.
  3. With reduce: lines every 30 ms, and the splash takes 150 ms.
  4. `boot()` during `boot` or `on` changes nothing (lines are not reset).
  5. `openApp('a')` in standby returns null and starts boot; after boot completes, window `a` exists. Two queued ids open in queue order.
  6. When on:
     - `openApp('a')` → x 130, y 46, z 21, `opening` true; after 220 ms `opening` is false; `snd.tone` was called with `(520,.05,'square',.03)`.
     - `openApp('b')` → x 520, y 50.
     - a third window cascades to x 190 (cascade 2).
  7. Re-opening `a` adds no window, increments `shakeNonce`, focuses `a` (highest z), and returns the same id.
  8. `openApp('a', {cmd:'help'})` on an open window sets `cmd.text==='help'`, and the nonce increases on every call.
  9. `openApp('nope')`, `openApp('constructor')` and `openApp('__proto__')` return null without throwing.
  10. `dynApp`: `p:0` gives title `RecycleWise` 600×540; `p:8` gives `Joblog`; `p:9` gives null; `p:x` gives null; `art:0` gives null before `addArt`, and after it gives title `my-art-0.png`, 320×390.
  11. `shutdown(then)` with 2 windows: wins empty at once, `collapsing` true, `snd.off` called; at 600 ms state `off`, `collapsing` false, `unlock('shutdown')`; at 1500 ms `then` has been called. With reduce, state `off` at 50 ms. `shutdown` from `standby` is a no-op.
  12. Restart `shutdown(()=>c.boot())` reaches state `on` again.
  13. `disco()`: true, `scene.disco(6)`, false at 6000 ms. With reduce, nothing happens.
  14. `matrix()` sets `fx.kind==='matrix'`; `shutdown` clears fx.
  15. `setSize`: shrinking calls `fitWindows` (a window moved into bounds); growing leaves window records unchanged (same reference).
  16. `dispose()` clears pending boot timers (no state change after advancing).
- `os/JayOS.test.jsx` (`renderWithApp`, registry stub with `a` rendering `<p>App A</p>` and `term` rendering `<p data-testid="cmd">{win.cmd?.text}</p>`):
  1. The standby layer shows `JAY-OS` and `waking up …`, and `app.host.osEl.dataset.state==='standby'`.
  2. After `os.boot()` and advancing 150 ms, the boot log shows 2 lines; the line with `OK` contains a `span.ok`.
  3. When on:
     - left icon labels in order: `About.txt, Projects, Experience.log, Skills.inv, Terminal, Resume.pdf, Mail, Wallpaper`.
     - right: `BugHunt.exe, Snake.exe, Paint, Visitor Wall, Service.txt, Trophies, Recycle Bin`.
     - every icon `img` has a `data:image/png` src.
  4. Clicking `About.txt` calls `os.openApp('about')` (spy).
  5. Clicking `◆ JAY-OS` shows the menu with items `About JAY-OS, Desktop Background…, Trophies, Résumé, Restart, Shut Down…`. A `pointerdown` on the desktop hides it.
  6. Menu `Résumé` calls `nav.goToResume` once and closes the menu. `Shut Down…` leads to state `off` after the timers, and `ctrl.exit` is called 900 ms later.
  7. `Help` opens `term`, and the test id shows `help`.
  8. Clock (`vi.setSystemTime('2026-07-15T15:04:00Z')`): the menubar shows `MTL 11:04` and ` · SEL 00:04`. Advancing 15 s with the time moved one minute updates it to `11:05`. Clicking the clock adds the `Two time zones` toast.
  9. `⏏ Close laptop` calls `ctrl.exit`, and its title is `Step back from the laptop (Esc)`.
  10. Sound button: click shows `Sound: on` with `aria-pressed="true"`.
  11. Window `a`:
      - title `A`, body `App A`, close button labelled `Close window`; clicking close removes the window.
      - opening `a` and `b`, then a `pointerdown` on `a`, gives `a` the class `focused` and `b` not.
  12. Drag (scale mocked to .5): `pointerdown` on the header at (100,100), then `pointermove` to (110,105), gives `style.left === (130+20)+'px'` and `top === (46+10)+'px'`; `pointerup` commits `moveWindow('a',150,56)`. A drag starting on the close button doesn't move. With `compact` true, a drag doesn't move.
  13. Glass button (`Zoom into the screen`): click calls `nav.openLaptop` and boots from standby.
  14. After shutdown, the off layer contains `It's now safe to turn off` and `press the power button to boot again`.
  15. Fx: `os.matrix()` renders `canvas.fx`; after advancing 4600 ms it is gone.

**ACCEPTANCE**
- Behaviour matches L673–764 and L712–729 apart from the deliberate changes (menu `Résumé`, derived counts, own-lookup).
- No `innerHTML` with dynamic values.
- `os.css` and `apps.css` are verbatim from L86–239.
- All timers are owned by the controller's timer group.

**Risks**
- Shake restart needs a forced reflow (`void el.offsetWidth`) in an effect keyed on the nonce.
- Window drag must not re-render the whole desktop per move (it writes styles directly).

---

### Phase 3: Stage, controller and app composition (site runs end-to-end in flat fallback)

**Goal:** replace the old site with the new page shell: track, sticky stage, HUD, cue, toasts, recruiter view, controller, wheel, keys, ticker, scene mount (loader stub returns null), and fallback flat mode. Delete the old components and dependencies.

**Files**
- `src/stage/*`, `src/scene/loadScene.js` (stub: `export async function loadScene(){ return null }`), `src/App.jsx`, `src/main.jsx`, `src/styles/tokens.css` (L8–40 plus L270), `src/styles/stage.css` (L42–84 plus additions).
- `index.html`: title, fonts link L3–5, `#app`, a `#resume-root` placeholder, and remove the scrollbar classes.
- **Delete:** `src/components/**`, `src/index.css`, `tailwind.config.js`, `postcss.config.js`, every `public/images/*` except `favicon.svg`.
- `package.json` removes `gsap @gsap/react lenis prop-types tailwind-scrollbar tailwindcss postcss autoprefixer`.

**Design notes**

- **Stage markup** (L273–308, without `#hud-exit`):
  ```
  section.track#track > div.stage#stage
    div.scene-layer (ref)
    div.flat-host#flat-host (ref)
    div.hud: [Recruiter view] [Résumé ↓] [★ n/13] [Sound: off]
    div.cue#cue role=img aria-label="Scroll down to open the laptop" (SVGs L283–284)
    Toasts (div.toasts aria-live=polite)
    div.tip3d#tip3d hidden (ref)
    RecruiterView (div.rec > div.rec-card role=dialog aria-modal=true aria-label="Recruiter view")
    NoWebGLNotice
  ```
  followed by `div.park` (ref).
- **CSS additions in `stage.css`**:
  - `.scene-layer{position:absolute;inset:0}`.
  - Change L50 to `.flat-host.on{display:block;animation:fsIn .18s ease-out}` and `.flat-host.on.trap{touch-action:none;overscroll-behavior:contain}`.
  - `.os.fallback #mb-exit{display:none}`.
  - `.skip` visually-hidden-until-focus link.
- **Recruiter view** (L289–304):
  - eyebrow `The 10-second version`, h2, tagline, bullets from `PROFILE.recruiter`.
  - row: `GitHub`, `LinkedIn`, `CV (PDF)` (cv href, `download`), `Full résumé ↓` (calls `nav.goToResume()` and closes the view), spacer, `Back to the fun` button.
  - On open, focus `Back to the fun`. Close on that button, on a backdrop click (the target is the `.rec` element itself), or on Escape. Return focus to the HUD button.
- **HUD**:
  - `Recruiter view` sets `ui.recOpen`.
  - `Résumé ↓` calls `nav.goToResume()`.
  - `★ n/13` calls `nav.openLaptop()` then `os.openApp('ach')` (L1033).
  - Sound calls `snd.setOn(!on)`; the text and `aria-pressed` stay in sync with the menubar (L649).
- **`controller.js`**: `createController({getTrackRect, innerHeight, scrollY, scrollTo, reduce, sceneStatus, os, ui:{setCue, setZoomed, setTrap}, scrollToResume, timers})`. The store holds `{mode, interactive, narrow}`; the fields `p`, `z` and `tw` are plain properties. `armed` starts `null` and `suppress` starts false.
  - **`update(dt)`**:
    1. `r = getTrackRect(); max = max(1, r.height - innerHeight()); p = clamp(-r.top/max, 0, 1)` (L1013).
    2. `status = sceneStatus()`.
    3. If `status === 'unavailable'`: `setCue(1 - ss(.01,.2,p))`; if `p > .1 && os.state === 'standby'` call `os.boot()`; return (L1014).
    4. Armed rules:
       - if `armed === null`, set `armed = p < .01` (B8).
       - else if `p < .01 && !suppress`, set `armed = true`.
       - else if `p > .6`, set `armed = false` and `suppress = false` (L1015, B9).
    5. If `status === 'loading'`: `setCue(.8)`; return.
    6. If `mode === 'desk' && armed && !tw && p > .02 && !suppress`, call `enter()` (L1016).
    7. If `tw`: `tw.t = min(1, tw.t + dt/tw.dur); z = tw.from + (tw.to - tw.from) * easeIO(tw.t)`. If `tw.t >= 1`: `tw = null` and run `tw.done?.()`.
    8. `setCue(.8 * (1 - ss(0,.15,z)))` (L1019).
    9. `inter = mode === 'inside' && !tw`. If it changed: store `interactive`, `setZoomed(inter)`, `os.setLive(inter)`, `setTrap(inter)`, `applyFlat()` (L1020).
  - `applyFlat()`: `os.setFlat((interactive && narrow) || status === 'unavailable', status === 'unavailable' ? true : narrow)`. The fallback forces compact, as at L1280.
  - `setNarrow(n)` (stage `ResizeObserver`: `stage.clientWidth < 760`) then `applyFlat()`. When the scene status changes, call `applyFlat()`.
  - **`enter()`** (L1023–1025):
    - returns unless `status === 'ready'` and `mode !== 'inside'`.
    - `mode = 'inside'`, `armed = false`, `os.boot()`.
    - `tw = {from: z, to: 1, t: 0, dur: reduce ? .01 : max(.5, 1.9*(1-z))}`.
    - if `r.top > 1`, `scrollTo({top: scrollY() + r.top + 2, behavior: reduce ? 'auto' : 'smooth'})`.
  - **`exit()`** (L1026–1028):
    - returns unless `status === 'ready'` and `mode !== 'desk'`.
    - `mode = 'desk'`, `tw = {from: z, to: 0, t: 0, dur: reduce ? .01 : max(.5, 1.5*z)}`.
    - if `p > .005`, `scrollTo({top: r.top + scrollY(), behavior})`.
  - **`goToResume()`** (new):
    - `suppress = true`, `armed = false`.
    - if `mode === 'inside'` and the scene is ready: `mode = 'desk'`; `tw` as in exit, with `done = () => timers.timeout(() => scrollToResume(behavior), 100)`. No scroll to the top.
    - otherwise call `scrollToResume(behavior)` now.
  - `scrollToResume` (in `Stage`): `document.getElementById('resume')?.scrollIntoView({behavior, block:'start'})`, then focus `#resume-title` with `preventScroll`.
- **`wheel.js`**: `createWheelHandler({ctrl, sceneStatus, now, toast})` returns `(e) => void`. Port of L1047–1054 with `!Scene` replaced by `sceneStatus() !== 'ready'`. Thresholds −240 / +240, gap 400 ms. Hint toast `('You’re inside the laptop','Scroll up on the desktop, press Esc, or click ⏏ Close laptop to step back.','info')`, once per controller lifetime. Attach it with `addEventListener('wheel', h, {passive:false})` on `#stage`.
- **`keys.js`**:
  - `KONAMI` (L1039).
  - `pushKonami(buf, key)` returns `{buf, matched}`. The key name is lower-cased when `key.length === 1`; the buffer keeps the last 10.
  - `createKeyHandler({app})` (L1040–1042):
    - `scene.api?.pressKey(e.key)`.
    - if sound is on and the key is a single character, `snd.click()`.
    - Konami match: `ach.unlock('konami')`, `toast('Cheat code','Disco mode enabled. You’re welcome.','info')`, then `os.state === 'on' ? os.disco() : (!reduce && scene.api?.disco(6))`.
    - Escape: `ui.recOpen ? close : (ctrl.interactive && status === 'ready' && ctrl.exit())`.
- **`ticker.js`**: `createTicker({raf, caf, now, onFrame})` with `start()`, `stop()` and `running`. `dt = min(.05, (t-last)/1000 || .016)`; `last` is reset on start. `onFrame(t, dt)` calls `ctrl.update(dt)`, then `scene.api?.frame(t, dt)`, then `app.wallpaperEngine?.tick(t)`. An IntersectionObserver on the stage (threshold 0) starts and stops it, and also sets `ui.stageVisible`.
- **`SceneMount`**:
  ```js
  useEffect(() => {
    let cancelled = false, api = null;
    app.scene.setStatus('loading');
    loadScene().then(mod => {
      if (cancelled) return;
      if (!mod) return app.scene.setStatus('unavailable');
      try {
        api = mod.createScene({...});
        app.scene.setApi(api);
        app.scene.setStatus('ready');
      } catch (e) {
        console.error(e);
        app.scene.setStatus('unavailable');
      }
    });
    return () => { cancelled = true; api?.dispose(); app.scene.setApi(null); };
  }, []);
  ```
  `loadScene` is injectable for tests (`app.loadScene`).
- **Fallback** (L1279–1280):
  - `NoWebGLNotice` renders `.toast.info` absolutely at `left:16px; bottom:16px; z-index:50; max-width:340px` with the text `3D is unavailable in this browser, so JAY-OS runs flat. Everything still works.`
  - flat-host gets inline `z-index:5`.
  - the host gets the `fallback` class.
- **`main.jsx`**:
  - `const app = createApp()`.
  - `createRoot(#app).render(<StrictMode><App app={app}/></StrictMode>)`.
  - `<Analytics/>` stays inside `App`.

**TEST LIST**
- `stage/controller.test.js`. Harness: `H=1000`, track height `2200` (so max = 1200), `rect = {top: -scrollY, height: 2200}`; `status` is a variable; `os` and `ui` are fakes; `step(sec)` calls `update(.05)` repeatedly.
  1. At scrollY 0: `p==0`, mode `desk`, `setCue(.8)`.
  2. B8: the first update at scrollY 360 (p .3) does not enter, and `armed` is false. A later update at scrollY 36 still does not enter, until scrollY 0 then 36, which enters.
  3. scrollY 24 (p .02): no enter. scrollY 36: enters, mode `inside`, `os.boot` called once, `tw.dur === 1.9`.
  4. Stepping 0.95 s gives `z ≈ .5` (±.01). Stepping to 1.9 s total gives `z === 1`, `tw === null`, `interactive === true`, `setZoomed(true)`, `os.setLive(true)`, `setTrap(true)`, `os.setFlat(false,false)`.
  5. Same as 4 with `setNarrow(true)` first: the last `setFlat` call is `(true,true)`.
  6. From z 1 with scrollY 36, `exit()` → mode `desk`, `tw.dur === 1.5`, `scrollTo({top:0, behavior:'smooth'})`; after 1.5 s, `z === 0` and `interactive === false`.
  7. Duration formulas: exit from z .4 → .6; exit from z .3 → .5; enter from z .6 → .76.
  8. Reduce: enter duration .01, scrollTo behavior `auto`.
  9. Armed: scrollY 800 (p .67) gives armed false; scrollY 36 gives no enter; scrollY 6 (p .005) then 36 enters.
  10. `enter()` twice: the second call does not replace `tw` (same object reference).
  11. Exit during the enter tween at z ≈ .3 gives `tw.from ≈ .3`, `to: 0`.
  12. `enter()` with `rect.top = 200` (page above the track; scrollY 50) calls `scrollTo({top: 252, …})`.
  13. Status `loading` at scrollY 36: no enter, `setCue(.8)`. Switching status to `ready`: the next update enters.
  14. Status `unavailable`: `setCue` at p .1 equals `1 - ss(.01,.2,.1)`; at p .11 with os `standby`, `os.boot` is called; `enter()` is a no-op; `applyFlat` calls `setFlat(true,true)`.
  15. `goToResume()` while inside at z 1: mode `desk`, no `scrollTo`. After 1.5 s plus 100 ms, `scrollToResume('smooth')` has been called. Then scrolling scrollY 0 → 12 → 36 → 400 (each with an update): no enter. Then scrollY 800 (clears suppress), then 0, then 36: enters.
  16. `goToResume()` in desk mode: `scrollToResume` is called immediately; with reduce the behavior is `auto`.
- `stage/wheel.test.js`. DOM fixture: `#stage > .desk` and `.win > .wb` (scroll metrics via defineProperty). Events are `{deltaY, target, preventDefault: vi.fn()}`. `now` is injected.
  1. Status not ready, or mode desk: no `preventDefault`.
  2. Inside and not interactive: `preventDefault`, and no exit even with −1000.
  3. Target in `.wb` with `scrollTop` 10 and deltaY < 0: no `preventDefault`. With `scrollTop` 0: `preventDefault`, but no accumulation (target in `.win`).
  4. `.wb` that can scroll down (`scrollTop + clientHeight < scrollHeight - 1`) with deltaY > 0: not prevented.
  5. Desktop target: −100 at t 0, 100 and 200 calls `ctrl.exit` once; a fourth −100 at 300 does not exit again (the accumulator reset).
  6. −100 at t 0, 500 and 1000: no exit.
  7. +300: toast once; another +300 later: no second toast.
  8. A target inside `.menu-pop`: prevented, and no exit after −1000.
- `stage/keys.test.js`:
  1. `pushKonami` over the 10 keys matches only on the last one, and the buffer is empty after the match.
  2. Leading noise keys still match.
  3. `'B'`, `'A'` are accepted as `b`, `a`.
  4. Handler, on a match: `unlock('konami')` and the toast. With `os.state === 'on'`, `os.disco` is called. With `standby`, `scene.api.disco(6)` is called. With `standby` and reduce, neither is called.
  5. Escape with `recOpen` true: rec closes and `ctrl.exit` is not called. With `recOpen` false, interactive and ready: `ctrl.exit` is called. With interactive false: nothing.
  6. Every key calls `scene.api.pressKey(e.key)`. With sound on, `'a'` calls `snd.click()` and `'Shift'` does not.
- `stage/ticker.test.js` (manual raf queue):
  1. `start()` schedules a frame. `onFrame` gets `dt === .016` for the first frame when `t - last` is 0, and `dt` is clamped to `.05` after a 1 s gap.
  2. `stop()` cancels.
  3. `triggerIntersection(stage, false)` stops it, and `true` restarts it with `last` reset.
- `stage/Stage.test.jsx` (`renderWithApp` with `loadScene` overridable):
  1. The HUD shows `Recruiter view`, `Résumé ↓`, `★ 0/13` and `Sound: off` (`aria-pressed="false"`). With `jayos-ach = ["boot","term"]` preset, it shows `★ 2/13`.
  2. Clicking `Sound: off` shows `Sound: on` on both the HUD button and the menubar `#mb-snd`.
  3. Recruiter view:
     - click opens the dialog named `Recruiter view`, and focus is on `Back to the fun`.
     - the text contains `9 projects, including RecycleWise (McGill capstone), WhenAreYouFree and Duonosaur`.
     - links GitHub/LinkedIn have `target=_blank` and `rel` containing `noopener`; `CV (PDF)` has href `/files/JEWOOLEE_CV.pdf`.
     - Escape closes it; a backdrop click closes it; a click on the card text does not.
     - `Full résumé ↓` calls `nav.goToResume` and closes.
  4. `★ 0/13` calls `nav.openLaptop` and `os.openApp('ach')`.
  5. `loadScene` resolving null:
     - status becomes `unavailable` and the notice text is shown.
     - `app.host.osEl` is inside `.flat-host.on` and has classes `flat`, `compact` and `fallback`.
     - flat-host `style.zIndex === '5'` and it does not have `trap`.
  6. StrictMode with a fake module whose `createScene` counts `created`/`disposed`: after the effects settle (`await` the promise), `created - disposed === 1` and status is `ready`. After `unmount()`, `created - disposed === 0`.
  7. `createScene` throws: status `unavailable` and no exception escapes.
  8. The cue has `role="img"` and name `Scroll down to open the laptop`.
  9. Unmount removes the window `keydown` and stage `wheel` listeners: spy on `addEventListener`/`removeEventListener` and assert equal counts for `keydown` and `wheel`.
- `stage/structure.test.js` (reads files with `node:fs`):
  - `src/components` does not exist.
  - `package.json` has no `gsap`, `lenis`, `tailwindcss` or `prop-types`.
  - `tailwind.config.js` does not exist.

**ACCEPTANCE**
- `npm run dev` shows the dark stage. With the stub loader it runs fallback flat mode: scrolling past 10% boots JAY-OS full screen, the HUD works, and the recruiter view works.
- The build passes with no old components.
- The controller code is a faithful port of L1011–1054, with only the listed fixes.

**Risks**
- `dvh` support (the prototype has a vh fallback, L44): keep both declarations.
- The flat-host is inside the stage, so it scrolls away with the sticky stage at the end of the track. That is intended for the fallback.

---

### Phase 4: Content apps, Mail and Terminal

**Goal:** every content window, the getform Mail app, and jaysh.

**Files:** `src/os/apps/*.jsx` (About, Projects, ProjectDetail, Experience, Skills, ResumeApp, Mail, Service, Trophies, Bin, AboutOs, Art), `src/os/apps/terminal/*`; register them in `registry.js`.

**Design notes**

Registry entries copy L788–866 for title, colour and size. Changes from the prototype:
- `Projects  ·  9 items` (with two spaces around `·`, as at L796; built from `PROJECTS.length`).
- `ResumeApp`: replace the L815 note with links `Download CV (PDF) ↓` (`href=PROFILE.cv download`) and `Read the full résumé` (`nav.goToResume()`).
- `AboutOs` (D15).
- Mail (below).

Per app:
- **About** (L788–795):
  - portrait `img.jay-px src="/img/jay-px.png" alt="Pixel-art portrait of Jewoo Lee"`, caption `hi, it’s me`.
  - h2 `Hi, I'm Jewoo. Call me Jay.`; bio; `dl.facts`.
  - clocks `MONTRÉAL` and `SEOUL` via `useClock` (classes `clk-mtl`, `clk-sel`).
  - hint `Psst: open the Terminal and type neofetch.`
- **Projects** (L796–798): `Click a project to open it.` and 9 `button.pcard` (img `/img/projects/<image>.webp`, `loading="lazy"`, `width=420 height=263`). Click calls `openApp('p:'+i)`.
- **ProjectDetail** (L869–872):
  - `img.shot` (alt `<title> screenshot`); h2 title, plus `span.draft` `draft blurb` if `draft`.
  - blurb; tags.
  - links, in order, only those present: `[live,'Live demo ↗']`, `[url,'Open on '+host+' ↗']`, `[repo,'Source on GitHub ↗']`, each with `target=_blank rel="noopener noreferrer"`.
- **Experience** (L799–802): `$ tail -n 7 ~/experience.log` (built from `ROLES.length`), then 7 `details` with the first one open.
- **Skills** (L803–809):
  - 16 slots with `--sc` set to the category colour.
  - click: toggle `on`; show h3 name, `.rar` as `CATLABEL · label` coloured; `Used in:`; a list or the fallback `Listed on the current site. A project that shows it off would help!`; `snd.tone(740,.06,'square',.03)`.
- **Service** (L824–829): Salute sets the output to `필승! (Pilseung: “certain victory”)`, plays tones `(392,.15,'square',.05)` and `(523,.3,'square',.05,.15)`, and calls `unlock('tags')`.
- **Trophies** (L669–670): `N of 13 unlocked. Progress stays in this browser.` and `ul.achl` with 13 `li` (class `lock` when not got), icon, title and description. Subscribes to `ach.store`, so it updates live.
- **Bin** (L861–863), **Art** (L873).
- **Mail** (L816–820 plus getform):
  - text `I read everything. Pick a channel:`.
  - links GitHub ↗, LinkedIn ↗, Instagram ↗, plus `Email ↗` (`mailto:`).
  - `form.form` with labels `YOUR NAME` (`name`, required), `YOUR EMAIL` (`email`, `type=email`, required), `MESSAGE` (`message`, required); a hidden honeypot `input name="_gotcha" tabIndex=-1 autoComplete="off"`; button `Send ✉`.
  - Submit: `preventDefault`. If the honeypot has a value, act as if it succeeded and send nothing. Otherwise `fetch(PROFILE.getform, {method:'POST', body: new FormData(form), headers:{Accept:'application/json'}})`. The button is disabled with the text `Sending…` while waiting.
  - `res.ok`: reset the form and `toast('Mail','Sent! Jay will get back to you soon.','info')`.
  - Otherwise, or on a thrown error: `toast('Mail','Couldn’t send right now. Email jewoo.lee@mail.mcgill.ca instead.','info')`, and keep the field values.
- **Terminal**:
  - `parse.js`:
    - `parseLine(raw)` returns `{line, cmd, args, c0}` (`trim`, split on `/\s+/`, `cmd` lower-cased, `args` joined with a single space).
    - `levenshtein(a,b)` (L927).
    - `suggest(cmd, names)`: the first name with the minimum distance, in names order, if that distance is ≤ 2; otherwise null.
    - `resolveOpen(a, {projects, names})` (L901–905): normalise (`toLowerCase`, strip `.(txt|log|inv|exe|pdf)$`, remove whitespace); `/^p?(\d+)$/` (B15); then `NAMES`; then the project-title prefix (lower-cased, whitespace removed). Returns `{kind:'project', index}`, `{kind:'app', id, name}` or `{kind:'none', shown: a || '(nothing)'}`.
  - `NAMES` is a `Map` from L894.
  - `commands.js`: `createCommands(ctx)` returns a `Map`, in the **same insertion order as L895–926**, because Tab completion and `suggest` depend on it. `ctx = {say, pre, clear, history, os, ctrl, scene, ach, wallpaper, content, timers}`.
  - Output strings are verbatim from L893–925, except:
    - `help` line 4 is `projects      list projects   (open p1 … p${n})`.
    - `git` says `On branch feat/website-revamp. ${n} projects, 0 regrets.`
    - `wallpaper` does not persist; it calls `wallpaper.setChoice(a)`, and the store emit updates the caption and mirror.
    - `lamp` prints `no lamp in flat mode.` when `scene()` is null.
    - `exit` and `shutdown` use `timers.timeout` with 400 and 500 ms and call `ctrl.exit()`.
    - `sudo` with a `/hire/` match calls `os.confetti()`, `os.openApp('resume')` and `unlock('hire')`.
  - `run(raw)` (L928–930): echo `jay@jay-os:~$ <line>` (class `c`); return if the line is empty; push to history (`hi = len`); `unlock('term')`; dispatch; unknown commands print `jaysh: command not found: <c0>` + (`. Did you mean "<best>"?` or `. Try "help".`) with class `w`.
  - `Terminal.jsx`:
    - banner `jaysh 0.2 · type "help" to see what this computer can do.` (class `d`).
    - output is a list of `{id, text, cls, pre}`, auto-scrolled to the bottom.
    - input `.t-in` with `spellcheck=false`, `autocomplete=off`, `autocapitalize=off`, `aria-label="Terminal command"`.
    - keys per L931–935: Enter, ArrowUp/ArrowDown (with `preventDefault`), Tab (unique prefix becomes `name + ' '`; multiple matches print them joined with two spaces, class `d`).
    - a click on `.term` focuses the input with `preventScroll`; it is also focused 60 ms after mount.
    - when `win.cmd.nonce` changes, call `run(win.cmd.text)`.

**TEST LIST**
- `os/apps/apps.test.jsx`. Render each app inside a `Window` through `os.openApp` on a booted OS (helper `bootedApp()` that fast-forwards the boot).
  1. About: heading `Hi, I'm Jewoo. Call me Jay.`; portrait src `/img/jay-px.png` with its alt; `Available for work`; clocks show `11:04` and `00:04` (system time set).
  2. Projects:
     - window title `Projects  ·  9 items`; 9 cards.
     - the card `Joblog` opens `p:8`, whose window shows h2 `Joblog`, the links `Live demo ↗` → `https://joblog-nine.vercel.app` and `Open on GitHub ↗` → the GitHub URL, and no `Source on GitHub ↗`.
     - `p:2` (Duonosaur) shows all three links in the order live, url, repo.
     - `p:5` (adStar) and `p:6` (HTTP) show `draft blurb`; `p:0` does not.
     - all links have `target="_blank"` and `rel` containing `noopener`.
  3. Experience: 7 `details`; only the first is open; the first summary contains `2025-08 → 2025-12`, `Wholesale Express` and `Full-Stack Developer (Part-time)`.
  4. Skills:
     - 16 slots with badges like `PY`.
     - clicking `React` adds `on` to that slot only, shows `FRAMEWORK · Framework`, and lists `RecycleWise, HTTP, this website, Joblog`.
     - clicking `MongoDB` shows the fallback line.
     - `snd.tone` was called with 740.
  5. ResumeApp: h2 `Jewoo (Jay) Lee`; 8 tag chips; 5 `li` starting with `Wholesale Express: Full-Stack Developer (Part-time) (2025-08 → 2025-12)`; the CV link href is `/files/JEWOOLEE_CV.pdf`; `Read the full résumé` calls `nav.goToResume`.
  6. Service: before the click there is no `필승`; Salute shows `필승! (Pilseung: “certain victory”)`, calls `unlock('tags')` and plays two tones.
  7. Trophies: `0 of 13 unlocked. Progress stays in this browser.` with 13 items, all `lock`. After `ach.unlock('boot')`, the text updates to `1 of 13` and the first item loses `lock`.
  8. Bin: the card `RecycleWise · open` opens `p:0`.
  9. AboutOs: contains `JAY-OS 2.0`, `Built with React, Three.js and a lot of CSS.` and `Inspired by ED-Linux on edh.dev`.
  10. Art: after `os.addArt('data:image/png;base64,QQ==')`, `openApp('art:0')` shows that image and `Drawn by you. Jay would love to see it.`
- `os/apps/Mail.test.jsx` (`vi.stubGlobal('fetch', vi.fn())`):
  1. The labels `YOUR NAME`, `YOUR EMAIL` and `MESSAGE` exist, and the inputs are required.
  2. Submitting valid values:
     - fetch is called once with the getform URL, method `POST`, a `FormData` body containing `name`, `email` and `message`, and header `Accept: application/json`.
     - the button shows `Sending…` and is disabled while the promise is pending.
     - on `ok:true`, the fields are cleared and the toast `Sent! Jay will get back to you soon.` appears.
  3. `ok:false` (or a rejected promise): the failure toast appears and the fields keep their values.
  4. A filled honeypot: fetch is not called.
- `os/apps/terminal/parse.test.js`:
  - `parseLine('   ')` gives an empty line.
  - `parseLine('OPEN   Snake.exe')` gives `cmd:'open', args:'Snake.exe'`.
  - `parseLine('echo a   b')` gives args `'a b'`.
  - `resolveOpen`: `'p1'` → project 0; `'P9'` → 8; `'9'` → 8; `'p10'` → none; `'p0'` → none; `'Visitor Wall'` → app `wall`; `'recycle bin'` → `bin`; `'Trophies.exe'` → `ach`; `'rec'` → project 0; `'jo'` → project 8; `'constructor'` → none; `''` → none with `shown === '(nothing)'`.
  - `suggest`: `'hepl'` → `help`; `'snak'` → `snake`; `'xyz'` → null.
- `os/apps/terminal/commands.test.js` (harness: `run(line)` returns an array of `[text, cls]`; fake os, ctrl, scene, ach, wallpaper; fake timers):
  1. `help` gives exactly **14** lines, with line 4 `projects      list projects   (open p1 … p9)`.
  2. `whoami` gives the exact L897 text.
  3. `neofetch` gives one `pre` whose text contains `OS: JAY-OS 2.0 (Montréal ed.)`, and calls `unlock('neofetch')`.
  4. `projects` gives 9 lines; the last is `  p9  Joblog` with class `b`.
  5. `open p1` calls `os.openApp('p:0')` and prints `opening RecycleWise …`. `open snake.exe` prints `opening snake …` and opens `snake`. `open nothing-here` prints `open: no such thing: nothing-here. Try "ls".` (class `w`).
  6. `cat about` opens `about`.
  7. `skills` joins the 16 names with ` · `.
  8. `experience` gives 7 lines; the first is `  2025-08  Wholesale Express`.
  9. `contact` prints the L909 text and opens `mail`.
  10. `matrix` calls `os.matrix` and prints `wake up, recruiter…` (class `d`).
  11. `weather` calls `scene.snow(10)`; with a null scene, it only prints.
  12. `lamp` with a scene where `lamp()` returns false prints `lamp: off`; with a null scene it prints `no lamp in flat mode.` (class `w`).
  13. `wallpaper golden` calls `setChoice('golden')` and prints `wallpaper: Golden hour`. `wallpaper auto` prints `wallpaper: auto (<name of current>)`. `wallpaper constructor` and `wallpaper` print `usage: wallpaper auto | night | golden | day` (class `d`) and open `display`. `localStorage` stays empty.
  14. `salute` prints the L915 text and calls `unlock('tags')`.
  15. `sudo hire-jay` prints 2 lines, calls confetti, opens `resume` and calls `unlock('hire')`. `sudo rm` prints `Nice try.`
  16. `git` prints `On branch feat/website-revamp. 9 projects, 0 regrets.`
  17. `date` prints 2 lines starting `Montréal  ` and `Seoul     `.
  18. `history` after 2 commands prints 3 numbered lines (including `history`). `clear` empties the output but keeps the history.
  19. `exit` prints the L924 text and calls `ctrl.exit` at 400 ms. `shutdown` calls `os.shutdown` at 500 ms with a function that calls `ctrl.exit`.
  20. `hepl` prints `jaysh: command not found: hepl. Did you mean "help"?`. `Xyz` prints `jaysh: command not found: Xyz. Try "help".`
  21. `toString` and `constructor` are not commands: they print command not found.
  22. Every non-empty command calls `unlock('term')`; an empty line does not.
- `os/apps/terminal/Terminal.test.jsx` (user-event):
  1. The banner is rendered. Typing `help` + Enter adds the 14 help lines and clears the input.
  2. After `ls` and `pwd`, ArrowUp fills the input with `pwd`, ArrowUp again gives `ls`, ArrowDown gives `pwd`, ArrowDown again gives empty.
  3. Typing `nea` then Tab gives `neofetch `. Typing `h` then Tab prints the line `help  hello  hi  history`.
  4. Opening with `{cmd:'help'}` prints help without typing. Re-sending the cmd prints it again.
  5. The input is focused 60 ms after mount.

**ACCEPTANCE**
- All strings match the prototype lines cited.
- Mail posts to getform.
- No object-literal command lookups.
- Terminal history lives in the component and is lost when the window closes (faithful).

**Risks**
- getform might reject AJAX without `Accept`; it is set. If CORS blocks, the failure toast still explains how to email. Check during the manual pass.

---

### Phase 5: Living Montréal wallpaper, Display, BugHunt and Snake

**Goal:** the animated desktop, its secrets, the background picker, and two games.

**Files:** `src/wallpaper/layout.js`, `render.js`, `secrets.js`, `engine.js`, `snapshot.js`, `WallpaperCanvas.jsx`; `src/os/apps/Display.jsx`; `bughunt/*`; `snake/*`. Desktop renders `WallpaperCanvas`.

**Design notes**

- **`layout.js`**: `buildLayout(W)`. Same geometry as L502–519, but with **per-feature Park–Miller streams in normalised units** (B4):
  - `rng(seed)` is `seed = seed*16807 % 2147483647`.
  - Seeds: trees 11, buildings 12, windows 13, stars 14, flakes 15, cars 16, clouds 17.
  - The hill, `peakX/Y`, wheel, clock, bridge and `oly` are pure formulas of W (L503–504, L511–514).
  - Trees: walk `x` from 0 while `x < W*.62` using `gap = 2 + (r()*3|0)` and `h = 2 + (r()*3|0)` from the tree stream (unchanged formula, own stream).
  - Buildings: `w = 6 + (r()*7|0)`, `rh = r()*26|0` from the building stream. `h = 24 + rh + round(sin(u*π)*24)`. Special picks at fractions .5 / .75 / .25 of the count (L508–509).
  - Windows: `v` comes from the window stream, in building order.
  - Stars: `{x: r()*W|0, y: r()*92|0, p: r()*9}` from the star stream (x scales with W).
  - The raccoon reset rule is L519.
  - Result: the same W always gives an identical layout, and a different W reuses the same random sequences, so the skyline extends or shrinks instead of reshuffling.
- **`render.js`**:
  - `drawStatic(g, L, mode, W)` (L521–538).
  - `drawFrame(g, state, L, mode, W, dt, T, rand=Math.random)` (L540–573). Returns `hot[]`. `state` is `{wheelA, wheelV, cross, bagel, shades, boatX, boatV, rac, off, flick}`, the per-session `S` (L495).
  - `hitTest(hot, p)` (L590): searches in reverse.
- **`secrets.js`**:
  - `SECRETS` (L575–582 verbatim, curly quotes).
  - `createSecretTracker({toast, unlock})` exposes `found(k)` (L583): first time per key it toasts `Secret ${size} · ${title}` with kind `info`; at ≥ 3 it calls `unlock('local')`.
  - `act(state, hit, {snd})` (L584–588): calls `snd.tone(660,.05,'square',.04)`; the boat also plays `snd.tone(150,.35,'sawtooth',.05)`.
- **`engine.js`**: `createWallpaperEngine({canvas, getOsSize, getOsState, isTweening, reduce, snd, tracker})`
  - `tick(now)` gating (L596–598): skip if `document.hidden`, if `getOsState() !== 'on'`, if `isTweening() && !dirty`, if `reduce() && !dirty`, or if `now - lastDraw < 70 && !dirty`. Otherwise `sync()`, `T += reduce ? 0 : dt`, `drawFrame`.
  - `sync()`:
    - `W' = clampWidth(getOsSize())`.
    - If `W' !== W`, schedule a rebuild after it has been stable for **200 ms** (or immediately when there is no static layer yet).
    - A rebuild sets `canvas.width = W`, `height = 180`, rebuilds the layout and redraws the static layer.
  - `setMode(k)` (L602), `click(e)` and `move(e)` (L589–592; use the canvas `getBoundingClientRect`).
  - `dispose()`. Intervals and listeners are added only by `WallpaperCanvas`.
- **`snapshot.js`**: `snapshot(modeKey)` builds a fresh layout at W 240 and fresh default state, draws onto a new canvas, and returns `toDataURL`. It never touches the engine (fixes L603–605). Results are cached in a `Map` by mode key (B14).
- **`WallpaperCanvas`**: renders `canvas.wallpaper` (`aria-label` from L316), creates the engine, sets `app.wallpaperEngine`, subscribes to `wallpaper.store` for `setMode(current())`, and sets `#wp-cap`. On unmount it disposes and nulls `app.wallpaperEngine`. Ticks come from the shared ticker.
- **Display** (L831–838):
  - intro text from L832.
  - 4 `pcard`s: `Auto · follows Montréal time` (snapshot of `autoWp()`), then the 3 mode names. Image style is `pixelated`, aspect `4/3`.
  - `on` marks the current choice. A click calls `setChoice(k)` and moves `on`. No storage.
- **BugHunt** (L941–958):
  - `bugLogic.js`: `spawnInterval(left) = max(.25, .8-(20-left)*.03)`; `speed(left, r) = 60 + r*90 + (20-left)*6`; `spawnBug(size, left, rand)` gives `{x, y, a, sp, turn:0, dead:false}` (L946–947); `stepBug(bug, dt, rand)` (L952); `isOut(bug, size)` (L953: x < −60, x > W+60, y < −60, y > H+30).
  - `BugHunt.jsx` renders the window UI (L942) and a portal into the DesktopContext element: `div.bug-layer`.
  - Bugs are imperative `button.bugx` (aria-label `Squash bug`, img `ICON.bug`).
  - Pointerdown squashes: `stopPropagation`; once only; class `splat`; score+1; `snd.pop()`; removed after 400 ms through tracked timers (B16).
  - The rAF loop uses `app.timers`. The round is 20 s.
  - At the end: button `Play again`, toast `('BugHunt','You squashed N bugs. ' + (N>=10 ? 'Exterminator-level work.' : 'The bugs win this round.'),'info')`, and `unlock('bugs')` if N ≥ 10.
  - Unmount stops everything and the layer goes with the portal.
- **Snake** (L962–982):
  - `snakeLogic.js` (pure, injected `rand`): `createGame()` gives the state of L968; `turn(state, dx, dy)` ignores the reverse of `dir` (L976); `step(state, rand)` returns `{state, event:'move'|'eat'|'die'}` (L973–975) with `CW=19`, `CH=15`, food cycling `SKILLS[fi%16]`; `placeFood(snake, rand)`.
  - `Snake.jsx`: canvas 380×300 with `tabIndex=0` and its aria-label; drawing per L969–972; interval 120 ms (160 with reduce) through `app.timers`.
  - Keys: arrows and WASD through a `Map` (B1), handled by `onKeyDown` on the app root, only while alive.
  - D-pad buttons; swipe > 20 px; `unlock('snake')` at 5 eaten; tone 880 on eat; `snd.off()` on death.
  - **reset restores the `.sn-ate` text** (B2).
  - Buttons `Start` → `Restart` → `Retry`.

**TEST LIST**
- `wallpaper/layout.test.js`:
  1. `buildLayout(240)` deep-equals another `buildLayout(240)`.
  2. `L.peakX === 72` at W 240; `L.wheel` is `{x:60, y:112, r:22}`; `L.bridge` is `{x0:173, t1:187, t2:226}`.
  3. Stability: let `a = buildLayout(240)` and `b = buildLayout(300)`. For `i < min(len)`, `a.blds[i].w === b.blds[i].w` and `a.blds[i].rh === b.blds[i].rh`. The tree gaps sequence is equal for the overlapping prefix. `a.stars[i].x / 240 ≈ b.stars[i].x / 300` (±1/240).
  4. There is exactly one building of each of the kinds `pvm`, `pyr` and `step`, and `pvm` has `h === 78` and `w === 10`.
- `wallpaper/render.test.js` (fake ctx, fixed rand):
  1. The hot list in `night` contains `moon`, `cross`, `wheel`, `boat`, `raccoon` and one `bld` per building, but no `sun`.
  2. `day` has `sun` and no `bld` and no `moon`.
  3. `golden` has `bld` and neither `sun` nor `moon`.
  4. `hitTest` at a point inside both the cross box and a building box returns the `bld` entry. A point inside the raccoon and boat boxes returns `raccoon`.
  5. With `state.rac.run = true` and `x = W+5`, the raccoon is not in the hot list after the frame, and `rac.away === 14`.
  6. `wheelV` decays toward .35.
- `wallpaper/secrets.test.js`:
  - `found('moon')` twice gives one toast, `Secret 1 · That’s a bagel now`.
  - three distinct keys call `unlock('local')` once.
  - `act` with `moon` toggles `bagel`; `cross` cycles 0 → 1 … 4 → 0; `boat` sets `boatV = 26` and plays two tones; `raccoon` sets `run = true`.
- `wallpaper/engine.test.js` (fake canvas, fake now):
  1. OS state `boot`: `tick` draws nothing (no `drawImage` calls recorded).
  2. On: the first tick draws. A second tick 30 ms later does not; one 80 ms later does.
  3. `isTweening` true and not dirty: no draw. After `click` on the moon (mapped through mocked `getBoundingClientRect`), it is dirty and draws even while tweening.
  4. With reduce: draws only when dirty, and `T` stays 0.
  5. Changing the OS size from 900×675 to 1200×675 rebuilds after 200 ms, not before (canvas width becomes 320).
  6. `setMode('golden')` redraws immediately.
- `wallpaper/snapshot.test.js`:
  - `snapshot('night')` returns the stub data URL.
  - a second call for the same key does not create another canvas (spy on `document.createElement`).
  - snapshotting does not change an existing engine's layout (engine `W` stays 320 after `snapshot`).
- `os/apps/Display.test.jsx`:
  - 4 cards with labels in order `Auto · follows Montréal time, Montréal by night, Golden hour, Snow day`.
  - `Auto` has `on` initially.
  - clicking `Golden hour` sets the store choice to `golden`, moves `on`, and updates `#wp-cap` to `vieux-port · 7:12 pm`.
  - `localStorage.length === 0`.
- `os/apps/bughunt/bugLogic.test.js`:
  - `spawnInterval(20) === .8`; `spawnInterval(0) === .25`; `spawnInterval(10) === .5`.
  - `speed(20,0) === 60`; `speed(0,1) === 270`.
  - `spawnBug` with `rand` returning 0 gives edge 0 and `x === -20`.
  - `isOut` boundaries.
- `os/apps/bughunt/BugHunt.test.jsx` (fake timers, rand stub):
  1. `Start hunt` changes the button to `Hunting…` (disabled) and creates the `.bug-layer` inside the desktop element.
  2. After ≥ 1 s, at least one `button[aria-label="Squash bug"]` exists. A pointerdown increments `SCORE`; a second pointerdown on the same bug does not.
  3. At 20 s: the button reads `Play again` and the toast `You squashed 1 bugs. The bugs win this round.` appears.
  4. With 10 squashes (spawn more by stubbing the interval) it calls `unlock('bugs')`.
  5. Closing the window mid-round removes the layer, and no rAF remains (the timers group is empty).
- `os/apps/snake/snakeLogic.test.js`:
  1. The initial snake is `[{6,7},{5,7},{4,7}]` with dir `{1,0}`.
  2. `turn(-1,0)` while moving right is ignored; `turn(0,1)` is accepted.
  3. With food placed at `{7,7}`, `step` gives `eat`, length 4, eaten `['Python']`, and the next food skill is `Java`.
  4. A head at x 18 moving right gives `die`.
  5. Self-collision gives `die`.
  6. `placeFood` never lands on the snake (with `rand` returning snake cells first).
- `os/apps/snake/Snake.test.jsx` (fake timers, rand):
  1. Before start, a `fillText` call with `PRESS START` is recorded.
  2. `Start` changes the button to `Restart`, and the canvas receives focus.
  3. ArrowDown changes direction (the next head y is 8).
  4. The D-pad `Up` button works even while dead (it calls `turn`).
  5. After a death, `GAME OVER · 1 SKILLS` is drawn and the button reads `Retry`.
  6. **After eating, then dying, then `Retry`, the `.sn-ate` text equals `Arrow keys / WASD, swipe, or the pad below.`** (B2).
  7. Eating 5 calls `unlock('snake')` once.
  8. Unmount clears the interval (advancing timers draws nothing new).

**ACCEPTANCE**
- Visual parity with L480–606 is checked by the reviewer against the source formulas (draw order L540–573).
- The wallpaper draws only while the OS is on.
- The rebuild is debounced.
- BugHunt cleanup is complete.

**Risks**
- Per-frame `drawFrame` must not allocate much. Reuse the hot array by length reset if needed.
- `getBoundingClientRect` on a 3D-transformed canvas gives the projected box (same as the prototype). This is fine at full zoom.

---

### Phase 6: Paint and Visitor Wall (Supabase backend plus mock)

**Goal:** draw, then pin (pending), then Jay moderates, then the wall shows it everywhere. RLS-enforced moderation, abuse limits, and a mock when the env vars are absent.

**Files:** `supabase/migrations/20261018000000_visitor_wall.sql`, `supabase/seed/admin.sql`, `supabase/__tests__/*`, `src/wall/*`, `src/os/apps/VisitorWall.jsx`, `src/os/apps/paint/*`, `.env.example`, `src/test/fakeSupabase.js`.

**SQL migration** (single file; the implementer writes exactly this shape):
```sql
create type public.drawing_status as enum ('pending','approved','rejected','removed','withdrawn');

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now());
alter table public.admins enable row level security;
create policy admins_select_own on public.admins for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;

create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.admins a where a.user_id = (select auth.uid())) $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create table public.drawings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status public.drawing_status not null default 'pending',
  png text not null,                                   -- base64 PNG, no data: prefix
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  constraint png_size  check (length(png) <= 5464),    -- ≤ 4096 bytes decoded
  constraint png_magic check (left(png, 11) = 'iVBORw0KGgo'),
  constraint png_dims  check (substring(decode(png, 'base64') from 17 for 8) = '\x0000001800000018'::bytea));
create unique index drawings_one_pending_per_user on public.drawings (user_id) where status = 'pending';
create index drawings_approved_recent on public.drawings (decided_at desc) where status = 'approved';
create index drawings_user_recent on public.drawings (user_id, created_at desc);
alter table public.drawings enable row level security;

create policy drawings_public_approved on public.drawings for select to anon, authenticated using (status = 'approved');
create policy drawings_own_select     on public.drawings for select to authenticated using (user_id = (select auth.uid()));
create policy drawings_admin_select   on public.drawings for select to authenticated using ((select public.is_admin()));
create policy drawings_own_insert     on public.drawings for insert to authenticated with check (user_id = (select auth.uid()) and status = 'pending');
create policy drawings_admin_update   on public.drawings for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
-- no delete policy: soft states only
revoke all on public.drawings from anon, authenticated;
grant select (id, png, status, created_at, decided_at) on public.drawings to anon, authenticated;
grant insert (png) on public.drawings to authenticated;
grant update (status) on public.drawings to authenticated;
```
- **`drawings_before_insert`** (`security definer`, `search_path=''`, BEFORE INSERT FOR EACH ROW):
  1. `uid := auth.uid()`; if null, raise `'auth_required'`.
  2. Force `user_id=uid`, `status='pending'`, `created_at=now()`, `decided_*=null`.
  3. Count rows for this uid in the last hour; if ≥ 5, raise `'rate_limited'`.
  4. Count all rows in the last minute; if ≥ 30, raise `'rate_limited'`.
  5. Count all pending; if ≥ 200, raise `'queue_full'`.
  6. Update this uid's pending rows to `status='withdrawn'`, `decided_at=now()`, `decided_by=uid`.
- **`drawings_before_update`** (`security definer`):
  1. If `png`, `user_id` or `created_at` change, raise `'immutable'`.
  2. Allow `pending→withdrawn` only when `old.user_id = auth.uid()` (this is the insert trigger's path).
  3. Otherwise require `public.is_admin()`, or raise `'forbidden'`.
  4. Allowed transitions: `pending→approved|rejected`, `approved→removed`; anything else raises `'bad_transition'`.
  5. Stamp `decided_at=now()` and `decided_by=auth.uid()`.
  6. All exceptions use `errcode 'P0001'` with the code as the message.
- `seed/admin.sql`: `insert into public.admins (user_id) select id from auth.users where email = 'REPLACE_WITH_JAY_EMAIL' on conflict do nothing;`

**Client**
- **`errors.js`**: `WallError(code)`. `mapError(e)`:
  - a message containing `rate_limited`, `queue_full`, `auth_required`, `forbidden` or `bad_transition` maps to that code.
  - Postgres code `23514` maps to `bad_png`; `23505` to `busy`; `42501` to `forbidden`.
  - an anonymous sign-in disabled error maps to `unavailable`.
  - anything else maps to `network`.
- **Client interface** (both implementations):
  ```
  mode: 'supabase'|'mock'
  listApproved() -> [{id, dataUrl, decidedAt}]        // newest decided first, limit 60
  getMyPending() -> {id, dataUrl, createdAt} | null   // null if no session or admin
  submit(base64) -> {id, createdAt}                   // throws WallError
  getSession() -> {email, isAnonymous, isAdmin} | null
  onAuthChange(cb) -> unsubscribe
  signInWithEmail(email)   signOut()
  listPending() -> [...]   setStatus(id, 'approved'|'rejected'|'removed')
  ```
- **`supabaseWallClient.js`**: `createSupabaseWallClient({url, key, origin})`.
  - `createClient(url, key, {auth:{persistSession:true, detectSessionInUrl:true, flowType:'pkce'}})`.
  - Approved: `.from('drawings').select('id,png,status,created_at,decided_at').eq('status','approved').order('decided_at',{ascending:false}).limit(60)`.
  - Submit: if there is no session, `auth.signInAnonymously()`; then `.insert({png}).select('id,status,created_at').single()`.
  - Admin check: `rpc('is_admin')`.
  - Magic link: `signInWithOtp({email, options:{shouldCreateUser:false, emailRedirectTo: origin + '/?mod'}})`.
  - `setStatus`: `.update({status}).eq('id', id).select('id,status').single()`; no row maps to `forbidden`.
- **`mockWallClient.js`** (in memory, with a `now` injection):
  - the same replace-pending semantics, a 5-per-hour limit, and validation via `validateDrawingDataUrl`.
  - `getSession` is null until `signInWithEmail(any)`, after which it returns `{email, isAdmin:true}`. The UI labels this "mock".
- **`wallClient.js`**: `createWallClient(env = import.meta.env)`. If both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set, `(await import('./supabaseWallClient.js')).createSupabaseWallClient(...)`; otherwise the mock.
- **`examples.js`**: `EXAMPLES` built from L768–770 with `PAL` and a white background (12×12 data URLs via `png.js`).
- **`wallStore.js`**: `createWallStore({clientFactory, toast})`.
  - State: `{status:'idle'|'loading'|'ready'|'error', mode, approved:[], myPending:null, pending:[], session:null, isAdmin:false, signInSent:false}`.
  - `ensureInit()` is idempotent. It creates the client, loads approved, gets the session, loads `myPending` when the session is not an admin, and loads `pending` when it is. It subscribes to auth changes.
  - `refresh()`.
  - `submit(dataUrl)` returns `{ok}` or `{ok:false, code}`. It validates first (`too_large`/`bad_png`/`bad_size` never hit the network), then sets `myPending` on success.
  - `approve/reject/takeDown(id)` (then refresh).
  - `signIn(email)`, `signOut()`.
  - Selector `corkboardPngs(state) = state.approved.length ? state.approved.slice(0,6).map(d=>d.dataUrl) : EXAMPLES`.
  - Init triggers: the scene becoming `ready`, the Visitor Wall app mounting, or the URL having `?mod`.
- **`VisitorWall.jsx`** (`registry.wall`: `'Visitor Wall'`, `#C8955E`, 660×540):
  - If `mode === 'mock'`, a top-row chip `Offline preview · drawings stay in this tab` (the `span.draft` style).
  - **Visitor view** (when not admin):
    - h2 `Visitor Wall`; p.muted `Drawings from people who stopped by. Draw one in Paint and press "Pin to wall".`
    - if `myPending`, `.notice` with its image and `Your drawing is waiting for Jay to approve it.`
    - loading text `Loading the wall…`; on error `Couldn’t load the wall right now.` plus a `Retry` button.
    - the grid (approved, or examples each labelled `example`); empty: `Nothing on the wall right now.`
    - `Open Paint` button.
  - **Sign-in** (only when `location.search` has `mod`, and not admin):
    - h3 `Moderator sign-in`, email input (`aria-label="Moderator email"`), button `Send magic link` (supabase) or `Sign in (mock)` (mock).
    - once sent: `Check your inbox for a sign-in link.`
    - signed in but not admin: `Signed in as <email>, but this account isn’t a moderator.` plus `Sign out`.
  - **Admin view**:
    - h2 `Visitor Wall · moderation`; p.muted `Nothing goes public until you approve it. Each visitor holds one spot in the queue.`
    - `Signed in as <email>` plus `Sign out`.
    - h3 `Waiting for approval (N)`. Rows: 64 px image (alt `Pending drawing`), `sent <toLocaleString>`, `Approve` (approve, then `toast('Visitor Wall','Approved. It’s on the wall and the corkboard now.','info')`), `Reject`. Empty: `The queue is empty.`
    - h3 `On the wall (N)`, with `Take down` per card.
  - There is **no visitor/moderator toggle anywhere**.
- **Paint** (L986–1004):
  - `paintLogic.js`: `N = 24`, `COLS` from L990; `cellFromPoint(rect, clientX, clientY)` (L994; null when out of range); `exportPng(grid)` uses `gridToPngDataUrl` with palette `COLS` without the null; `isEmpty(grid)`.
  - `Paint.jsx`: canvas 336×336 (`aria-label="Pixel canvas"`), drawing per L993; palette buttons (`aria-label` `Colour #XXXXXX` / `Eraser`, `on` class).
  - Pointer: `pointerdown` sets down, captures and paints; `pointermove` paints while down; `pointerup`, **`pointercancel`** and **`lostpointercapture`** end the stroke (B3).
  - `Clear`.
  - `Save to desktop`: if empty, `toast('Paint','Draw something first!','info')`. Otherwise `n = os.addArt(png)`, `toast('Saved','my-art-'+n+'.png is on the desktop.','info')`, `unlock('paint')`.
  - `Pin to wall` (background `#C8955E`): if empty, the same empty toast. Otherwise `await wall.submit(png)`:
    - ok: `unlock('paint')` and `toast('Pinned!','It’s waiting for Jay’s approval.','info')`.
    - error toasts by code: `rate_limited` → `('Visitor Wall','Slow down a little. Try again later.','info')`; `queue_full` → `('Visitor Wall','The queue is full right now. Try again later.','info')`; `bad_png`/`too_large`/`bad_size` → `('Visitor Wall','That drawing couldn’t be sent.','info')`; anything else → `('Visitor Wall','Couldn’t reach the wall. Try again.','info')`.
    - The button is disabled while sending.

**TEST LIST**
- `supabase/__tests__/visitor_wall.pglite.test.js` (`// @vitest-environment node`).
  - Setup: `new PGlite()`, run `auth-shim.sql`, then the migration. The shim:
    - `create schema auth; create table auth.users(id uuid primary key, email text);`
    - `create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`
    - `create role anon nologin; create role authenticated nologin;` with grants of usage on schemas `public` and `auth`, and execute on `auth.uid`.
  - Users A, B, J are inserted into `auth.users`, and J into `admins`.
  - Helper `as(role, uid, sql, params)`: `set role <role>`, `select set_config('request.jwt.claim.sub', uid ?? '', false)`, the statement, then `reset role`.
  - The valid PNG is the base64 of `gridToPngDataUrl` for a 24×24 grid with one coloured cell.
  1. anon `insert into drawings(png)` fails with a permission error.
  2. A inserts the valid PNG: a row with `status = 'pending'` exists, owned by A (checked as superuser).
  3. A inserts again: A has exactly 1 `pending` and 1 `withdrawn`.
  4. A's 6th insert within an hour raises an error whose message contains `rate_limited`.
  5. B inserts a PNG with a bad magic, a 25×24 PNG, or a string over 5464 chars: each raises a check violation.
  6. As anon, `select` returns only approved rows. Setup inserts approved, pending and rejected rows as superuser with the triggers disabled, via `alter table … disable trigger user`.
  7. A selects: sees approved rows plus A's own pending row, and not B's pending row.
  8. A runs `update drawings set status='approved' where id=<A pending>`: 0 rows affected, or an error. The row stays pending.
  9. J (admin): sees all pending rows. `update … set status='approved'` on A's pending succeeds, with `decided_by = J` and `decided_at` not null (checked as superuser). `approved → removed` succeeds. `approved → pending` raises `bad_transition`. `update … set png=...` is refused (column privilege or `immutable`).
  10. `select public.is_admin()` is true for J, false for A, and false for anon.
  11. A runs `insert into admins values (A)`: refused. A runs `select * from admins`: 0 rows.
  12. 200 pending rows (inserted with triggers disabled, distinct users), then A inserts: raises `queue_full`.
  13. 30 rows created in the last minute, then B inserts: raises `rate_limited`.
  - Fallback rule: if PGlite cannot run `set role`/RLS, the implementer must mark tests 6–11 `it.skip` with a reason, and add `supabase/__tests__/visitor_wall.lint.test.js` (below). The reviewer accepts this only if the skip reason is a documented PGlite limitation.
- `supabase/__tests__/visitor_wall.lint.test.js` (always present). The migration text:
  - enables RLS on both tables.
  - has no policy `using (true)`.
  - has exactly one update policy, and it references `is_admin`.
  - has no delete policy.
  - revokes all from anon/authenticated on both tables.
  - all `security definer` functions set `search_path`.
- `wall/mockWallClient.test.js` (injected `now`):
  - `submit` then `getMyPending` returns that drawing.
  - a second `submit` replaces it (one pending).
  - a 6th submit within an hour throws `rate_limited`; after one hour it is allowed.
  - an invalid data URL throws `bad_png`.
  - after `signInWithEmail('x@y')`, `getSession().isAdmin` is true; `setStatus(id,'approved')` moves the drawing to `listApproved()[0]`; `removed` takes it off.
  - non-admin `setStatus` throws `forbidden`.
- `wall/supabaseWallClient.test.js` (`fakeSupabase.js`: a chainable builder recording `[method, ...args]`, configurable `{data, error}` per terminal call, and fake `auth`/`rpc`; `vi.mock('@supabase/supabase-js')` returns it):
  1. `listApproved` records `from('drawings')`, `select('id,png,status,created_at,decided_at')`, `eq('status','approved')`, `order('decided_at',{ascending:false})`, `limit(60)`, and maps `png` to `data:image/png;base64,…`.
  2. `submit` with no session calls `signInAnonymously` once, then `insert({png})`. With a session, it does not sign in.
  3. An insert error with message `rate_limited` throws `WallError('rate_limited')`; code `23514` maps to `bad_png`.
  4. `signInWithEmail('j@x')` calls `signInWithOtp` with `shouldCreateUser:false` and `emailRedirectTo:'http://localhost:3000/?mod'` (inject `origin`).
  5. `getSession` with `rpc('is_admin')` → true gives `isAdmin:true`.
  6. `setStatus` returning no row throws `forbidden`.
- `wall/wallClient.test.js`:
  - with no env (`vi.stubEnv` set to empty), `mode === 'mock'`.
  - with both env vars and a mocked dynamic import, `mode === 'supabase'`.
  - with only one var set, it uses the mock.
- `wall/wallStore.test.js` (mock client):
  - `ensureInit` twice creates the client once.
  - status goes `loading → ready`.
  - `submit('bad')` returns `{ok:false, code:'bad_png'}` without calling the client.
  - a valid submit sets `myPending`.
  - `corkboardPngs` with 0 approved returns the 3 examples; with 8 approved it returns the 6 newest in order.
  - when the client's list throws, status is `error`, and `refresh` recovers.
- `wall/examples.test.js`: 3 examples, each a 12×12 PNG data URL.
- `os/apps/VisitorWall.test.jsx` (mock client injected):
  1. Visitor view: heading `Visitor Wall`, the intro text, the chip `Offline preview · drawings stay in this tab`, 3 cards labelled `example`, and **no** `Approve` button and no `Jay (moderator)` text.
  2. After `wall.submit(valid)`, the notice `Your drawing is waiting for Jay to approve it.` shows with an image.
  3. Without `?mod`, there is no sign-in form. With `history.replaceState(null,'','/?mod')`, the form `Moderator sign-in` shows; entering an email and clicking `Sign in (mock)` shows the admin view `Visitor Wall · moderation` with `Waiting for approval (1)`.
  4. Approve removes the row, shows `On the wall (1)` with the drawing, and adds the toast `Approved. It’s on the wall and the corkboard now.`
  5. Reject removes the row and leaves the wall unchanged.
  6. `Take down` removes the card, and the examples return when 0 are approved.
  7. `Sign out` returns to the visitor view.
  8. `Open Paint` calls `os.openApp('paint')`.
  9. The error state shows `Couldn’t load the wall right now.`, and `Retry` calls `refresh`.
- `os/apps/paint/paintLogic.test.js`:
  - `cellFromPoint({left:0,top:0,width:336,height:336},0,0)` gives `{x:0,y:0}`; `(335,335)` gives `{23,23}`; `(-1,5)` gives null.
  - `exportPng` of a grid with cell 0 = `#E8452E` passes `validateDrawingDataUrl`, and decoding shows index 0 → palette entry `#E8452E` at pixel (0,0) and transparency elsewhere (inflate via `node:zlib`).
  - `isEmpty`.
- `os/apps/paint/Paint.test.jsx` (canvas `getBoundingClientRect` mocked to 336×336 at 0,0):
  1. 10 palette buttons, with the first having `on`.
  2. Pointerdown at (7,7) then pointermove to (21,7) paints 2 cells (verify via the save output: `exportPng` spy, or 2 `fillRect` calls of 14×14 in the colour after the white background).
  3. **After `pointercancel`, a pointermove does not paint** (B3).
  4. Eraser removes a cell.
  5. `Save to desktop` on an empty grid gives the toast `Draw something first!` and no art. After painting, it calls `os.addArt` (an icon `my-art-0.png` appears on the desktop), adds the toast `Saved`, and calls `unlock('paint')`.
  6. `Pin to wall`: the success toast `Pinned!`, `unlock('paint')`, and the button disabled while pending. With a mocked `rate_limited`, the toast `Slow down a little. Try again later.` appears and `unlock` is not called.
  7. `Clear` empties the grid (save shows the empty toast).

**ACCEPTANCE**
- The migration applies cleanly in PGlite (or the documented fallback).
- No code path lets a non-admin change status. The UI does not expose moderation without `isAdmin` from the server (or the mock sign-in).
- With no env vars, everything works in mock mode.
- The Supabase SDK sits in its own chunk (check `npm run build` output: a chunk containing `supabase` exists and `index-*.js` does not include it).

**Risks**
- PGlite role support: see the fallback rule.
- The Supabase "Allow new users to sign up" setting must stay on, because it also gates anonymous sign-ins. `shouldCreateUser:false` blocks strangers from creating email accounts.
- An anonymous sign-in rate limit hit maps to `network`. Acceptable.
- `decode(...)` in a CHECK raises on invalid base64. That is still a rejection.

---

### Phase 7: 3D scene (three r128 plus CSS3D)

**Goal:** a faithful port of `initScene` (L1057–1274), lazy-loaded, fully disposable, wired to the stores.

**Files:** `src/scene/loadScene.js` (real), `createScene.js`, `sceneMath.js`, `textures.js`, `hotspots.js`, `floppy.js`; `SceneMount` passes the dependencies.

**Design notes**

- **`loadScene({canGL = defaultCanGL, importer = () => import('./createScene.js')})`**: `canGL()` is L1057. It returns null when `!canGL()` or when the import throws.
- **`createScene({mount, stage, holder, park, tipEl, app, reduce})`** returns `{css, frame(t,dt), onOS(s), setWall(pngs), pressKey(k), openLid(), drive(s), disco(s), snow(s), lamp(), dispose()}`.
  - Construction is wrapped in `try`. On throw, it disposes everything created so far and rethrows (B7).
  - Imports: `import * as THREE from 'three'` and `import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js'`.
  - Renderer (L1061–1062):
    - `antialias:true`, `setPixelRatio(min(devicePixelRatio, 1.5))`, `outputEncoding = sRGBEncoding`, PCF shadows.
    - the canvas has class `gl` and is appended to `mount` (`.scene-layer`), with the CSS3D element after it, class `css3d` (L1066).
    - `cssObj = new CSS3DObject(holder)`; scale `2.6/OS_W`.
  - Everything from L1063 to L1205 is ported numerically unchanged. The investigator spec `explore-scene.md` §2.5 is a correct summary, verified.
  - Lights L1075–1077, room L1080–1095, corkboard L1098–1113, tags L1116–1121, desk L1124–1125, laptop L1128–1159, props L1162–1179, tweens L1182–1189, hotspots L1192–1205, input L1208–1220, mirror L1223–1231, frame L1239–1266.
  - Removed: `lidForce`, `prevP`, the `Ctrl.update` call inside `frame` (the ticker already called it), and the scene's own IntersectionObserver and rAF (the ticker owns them).
  - The scene keeps its own `ResizeObserver(stage)` for `renderer.setSize`, `css.setSize` and camera aspect (L1235). Narrow mode is now set by the stage.
  - Polaroid texture: `new THREE.TextureLoader().load('/img/jay-px.png')` with Nearest filters, no mipmaps and sRGB encoding (L1111, without runtime dithering).
  - Font gate: `Promise.all(['20px Silkscreen','600 54px Caveat','15px "JetBrains Mono"','24px VT323','42px Silkscreen'].map(f => document.fonts.load(f))).then(redrawAllCanvasTextures)`, plus `document.fonts.ready.then(...)` (L1232).
  - Store wiring is set up inside `createScene` and returned unsubscribes run in `dispose`:
    - `os.store` state → `onOS`.
    - `wall.store` → `setWall(corkboardPngs(s))`, only when the array changes (shallow).
    - `wallpaper.store` → `onOS(os.state)`.
    - On creation: `setWall` with the current selector, and `wall.ensureInit()`.
  - Mirror: `drawMirror(ctx, w, h, osState, app.wallpaperEngine?.canvas)` (pure, `textures.js`, L1223–1230). If the engine canvas is missing while on, draw the menubar and icons over `#3D98DD`.
  - Per-frame OS widening (L1245):
    - `if(!ctrl.narrow){ g=ss(.86,1,z); k=min(w/900,h/675)*.994; os.setSize(900+(w/k-900)*g, 675+(h/k-675)*g) }`.
    - holder `visibility = lidT > .5 ? '' : 'hidden'`; `willChange = ctrl.tw ? 'transform' : ''` (L1244).
  - Lid boot (L1242–1243) via `sceneMath.lidBoot`.
  - Hotspot actions come from `hotspots.js`.
  - `dispose()`:
    - remove canvas listeners (`pointermove`, `pointerdown`, `pointerup`, `pointerleave`); disconnect the ResizeObserver; unsubscribe the stores.
    - `cssScene.remove(cssObj)` (the r128 `removed` handler detaches the holder), then `park.appendChild(holder)`.
    - traverse the scene and dispose every geometry, material (including array materials) and `material.map`.
    - dispose every texture created by `canvasTex`.
    - `renderer.dispose()`, `renderer.forceContextLoss()`, then remove the canvas and the css element.
    - hide `tipEl`.
- **`sceneMath.js`** (pure, so it can be tested):
  - `lidT(z) = ss(0,.45,z)`.
  - `hingeAngle(lidT) = π/2 + (-10° - π/2) * lidT`.
  - `camE(z) = ss(.2,1,z)`.
  - `lidBoot(lidT, wasClosed, osState)` returns `{wasClosed, boot}` (L1242–1243).
  - `widenSize(z, w, h)` returns `{w, h}` (L1245).
  - `camFov(aspect) = aspect < 1.05 ? 46 : 35`.
  - `camDistance(fov, aspect) = max(1.95/2/tv, 2.6/2/(tv*aspect))`.
  - `widePose(aspect)` returns `{wp, wl}` (L1248).
  - `cameraPose({e, aspect, sp, aPos, aN, d, reduce})` returns `{pos, look}` (L1252–1253; plain `{x,y,z}` vectors).
  - `stepKey(p, dt)` returns `{p, y}` (L1257).
  - `stepSnow(y, v, dt, boost)` (L1258–1259).
  - `ledPower(state, t)` and `ledDrive(busy, state, t)` return hex values (L1260–1262).
  - `screenLightTarget(state, lidT)` (L1263).
  - `tagAngle(tagT, swing, reduce)` (L1256).
  - `stepTween(tw, dt)` uses `easeQuad` (L1254–1255).
- **`hotspots.js`**: `createHotspotActions({app, local})` returns a `Map` from label to function, using the labels and behaviours of L1194–1205. `local = {swingTags, insertFloppy(i), hopMug, toggleLamp, boostSnow}`.
  - Sticky note: `ctrl.enter(); os.openApp('term', {cmd:'help'})` (replaces the `setTimeout` plus `_run`).
- **`floppy.js`**: `createFloppySequencer({tween, onInserted})` with `insert(f)` per L1185–1188, using the injected `tween(obj, to, dur, done)`. Constants: out-pose `(2.3,.09,.9)` for .3 s then home for .45 s; in-pose `(2.35,.09,.9)` with rotation 0 for .45 s, then `(1.2,.09,.9)` for .35 s, then `onInserted(f)`, which sets `driveBusy=1.2`, calls `unlock('floppy')`, `ctrl.enter()` and `openApp(f.app)`.
- **`textures.js`**: draw functions taking `(ctx, w, h, …)`: `drawSky` (L1082–1088), `drawCork(ctx, w, h, imgs)` (L1101–1106), `drawNote`, `drawSticker`, `drawLogo`, `drawFloppyLabel(ctx, w, h, f)`, `drawMirror`.

**TEST LIST**
- `scene/sceneMath.test.js`:
  1. `lidT(0)=0`, `lidT(.45)=1`; `hingeAngle(0)=π/2`; `hingeAngle(1)=-10°` in radians.
  2. `lidBoot(.8, true, 'standby')` gives `{wasClosed:false, boot:true}`; `lidBoot(.8, false, 'standby')` gives `boot:false`; `lidBoot(.05, false, 'on')` gives `wasClosed:true`; `lidBoot(.8, true, 'on')` gives `boot:false` and `wasClosed:false`.
  3. `widenSize(.86, 1600, 900)` gives `{w:900, h:675}`. `widenSize(1, 1600, 900)` uses `k = min(1600/900, 900/675)*.994 = 1.3253`, so it gives `w ≈ 1207.2`, `h ≈ 679.1`. At `z = .9` the result is in between.
  4. `camFov(1.04) = 46`, `camFov(1.06) = 35`; `camDistance(35, 16/9)` equals the formula.
  5. `cameraPose` with `e = 0` and `sp = {x:.5, y:0}`, not reduced, gives `pos.x = 1.4 + .55`. With reduce it gives `pos.x = 1.4`. With `e = 1` it gives `aPos + aN*d`.
  6. `stepKey(1, .1)` gives `{p:.3, y: .19 - .035*.6}`; `stepKey(.05, .1)` gives `p = 0` and `y = .19`.
  7. `ledPower('standby', 0)` is `0xFFAA22`, at t 700 it is `0x221100`, `'on'` is `0x2BE070`, `'off'` is 0. `ledDrive(0, 'on', 0)` is 0; `ledDrive(1, 'on', 0)` is `0x220800`; at t 80 it is `0xFF5533`.
  8. `screenLightTarget('on', 1) = 1.1`, `('boot', .5) = .3`, `('off', 1) = 0`.
  9. `tagAngle(t, .7, true) = 0`.
  10. `stepTween` reaches the target at `t >= dur`, at the half-way point gives `easeQuad(.5) = .5`, and calls `done` once.
  11. `stepSnow`: below 1.75 it wraps to 3.65; boost multiplies the speed by 3.5.
- `scene/hotspots.test.js` (fakes):
  - `Laptop · open me` calls `os.boot` and `ctrl.enter`.
  - `Power button` with os `on` calls `os.shutdown()` with no args; with `off` it calls `boot` and `enter`.
  - `Dog tags` calls `local.swingTags`, `unlock('tags')`, `toast('한번 해병은 영원한 해병','Once a Marine, always a Marine. Opening Service.txt.','info')`, `enter` and `openApp('service')`.
  - `McGill mug` calls `local.hopMug`, `toast('McGill mug','Refilled. Productivity +10%.','info')` and `snd.tone(300,.1,'sine',.06)`.
  - `Desk lamp` calls `local.toggleLamp`.
  - `Visitor wall` calls `enter` and `openApp('wall')`.
  - `Polaroid` opens `about`.
  - `Sticky note` calls `openApp('term', {cmd:'help'})`.
  - `Keyboard` calls `openApp('term')`.
  - `Window` calls `local.boostSnow(8)` and `toast('Montréal','It’s snowing. Obviously.','info')`.
  - `Floppy · PROJECTS` calls `local.insertFloppy(0)`.
  - The labels set equals the 12 labels.
- `scene/floppy.test.js` (a fake tween runner that records calls and `flush()` runs `done` in order):
  - inserting floppy 0 with an empty drive gives 2 tweens (in-pose, then drive pose), then `onInserted(0)`.
  - inserting 1 while 0 is in the drive also tweens 0 to the out-pose and then home.
  - inserting 0 again while it is in the drive gives no tween, just `onInserted`, which opens the app.
  - `app` mapping: PROJECTS → `projects`, GAMES → `bugs`, RESUME → `resume` (L1162).
- `scene/textures.test.js` (fake ctx):
  - `drawCork(ctx,512,350,[])` records `fillText('VISITOR WALL',258,34)` and `fillText('your drawing here?',258,334)`, plus 6 dashed `strokeRect` calls.
  - with 2 images, there are 2 `drawImage` calls and `fillText('2 pinned by visitors',258,334)`.
  - `drawMirror` in `standby` records `JAY-OS` and `waking up …`; in `boot` it records the 3 BIOS lines; in `on`, `drawImage` of the passed canvas is the first call; in `off`, only the black fill.
- `scene/loadScene.test.js`:
  - `canGL` → false gives null and the importer is not called.
  - an importer that throws gives null.
  - success returns the module.
- `stage/SceneMount.wiring.test.jsx` (fake `createScene` capturing `app`, which the real `createScene` would do internally, so here assert through a thin exported `wireScene(api, app)` helper used by `createScene`):
  - after `wireScene`, `os.boot()` calls `api.onOS('boot')`.
  - `wall` approved changes call `api.setWall` with ≤ 6 data URLs (the examples when empty).
  - a wallpaper choice change calls `api.onOS(currentState)`.
  - the unsubscribe function returned stops further calls.
  - `wall.ensureInit` was called.

**Not testable in jsdom** (manual pass): WebGL output, lighting fidelity, CSS3D alignment, hover glow, drag yaw, and real disposal (check Chrome DevTools: no "Too many active WebGL contexts" after 20 StrictMode remounts or HMR; the canvas count stays 1).

**ACCEPTANCE**
- `npm run build` shows a separate chunk containing three (not in the entry chunk).
- `createScene.js` is the only importer of `three` (ESLint passes).
- Numeric constants match L1061–1266. The reviewer diff-reads against the source.
- In dev with StrictMode, exactly one `canvas.gl` exists in the DOM.

**Risks**
- Vite dev pre-bundling could duplicate three between `three` and the jsm file and warn about multiple instances. If it does, add `optimizeDeps.include: ['three', 'three/examples/jsm/renderers/CSS3DRenderer.js']`.
- r128 + Vite 6 builds fine (ESM `build/three.module.js`); verify there are no `exports` deep-import errors.
- The OS widening per frame calls `os.setSize`, which may call `fitWindows` while shrinking on exit; the reference-equality guard prevents re-renders when nothing changes.

---

### Phase 8: Résumé, SEO, prerender, trophies and final cleanup

**Goal:** a plain HTML résumé below the scene in the blueprint style, a compact trophies grid and the footer credit; build-time prerender; meta and JSON-LD; performance pass; README.

**Files:** `src/resume/*`, `src/styles/resume.css`, `index.html`, `scripts/prerender.mjs`, `package.json` build script, `public/robots.txt`, `README.md` (rewrite the existing file), `src/main.jsx` (second root).

**Design notes**

- **`index.html` head**:
  - `<title>Jewoo (Jay) Lee · Full-stack developer</title>`.
  - `<meta name="description" content="Jewoo (Jay) Lee is a full-stack developer from McGill Computer Engineering in Montréal. Step into JAY-OS, a 3D 90s laptop portfolio, or read the résumé.">`.
  - `theme-color #141C2E`; OG `og:title`, `og:description`, `og:type=website`, `og:url` from `PROFILE.site`; `twitter:card=summary`.
  - favicon `/images/favicon.svg`; the font links (L3–5); `<link rel="canonical" href="%SITE_URL%/">`, filled by a Vite plugin from `VITE_SITE_URL` (default `https://jewoo-lee.vercel.app`).
- **Body**:
  ```html
  <a class="skip" href="#resume">Skip to résumé</a>
  <div id="app"></div>
  <div id="resume-root"><!--resume-outlet--></div>
  ```
- **`Resume.jsx`** (semantic markup; blueprint styles from L241–269 reused: `.wrap`, `.block`, `.sec-head`, `.col`, `.ach-grid`, `.ach`, plus new `.r-*` classes in the same tokens):
  ```
  main#resume[aria-labelledby=resume-title]
    header.block: eyebrow "Résumé", h1#resume-title(tabIndex -1) "Jewoo (Jay) Lee", tagline, actions:
       Download CV (PDF) [download], Email (mailto), GitHub, LinkedIn, Instagram (@jwuu_lee), "Open the laptop ↑" (button -> scroll top + ctrl.enter via nav.openLaptop after 50ms)
    section#about    h2 "About"      PROFILE.about + facts + education (McGill · B.Eng. Computer Engineering · Jan 2020 – Dec 2025)
    section#experience h2 "Experience" ol of 7 articles: <time> dates, h3 role, company, summary
    section#projects h2 "Projects"   9 article cards (.col): lazy img (420×263), h3 title, blurb, tags list, links (Live demo / host / Source) — no draft chip
    section#skills   h2 "Skills"     4 groups by CAT order (Language, Framework, Data, Tool) as lists
    section#contact  h2 "Contact"    email link, socials, Download CV
    section#trophies h2 "Trophies" + span.ach-count "n/13"  TrophiesGrid (3/2/1 columns per L246, L268–269), note "Unlock them inside the laptop."
  footer > .wrap: "© 2026 Jewoo Lee · Inspired by <a href="https://edh.dev">edh.dev</a> by Ed Hinrichsen."
  ```
- **`TrophiesGrid`** uses `useSyncExternalStore` with `getServerSnapshot` returning an empty set, so prerendered HTML shows everything locked and hydration matches. On the client it re-renders with the stored set. Cards follow L665–666: class `ach got|lock`, icon, `★ `/`☆ ` prefix, title, description.
- **`entry-server.jsx`**: `renderResumeHtml()` returns `renderToString(<AppProvider app={createServerApp()}><Resume/></AppProvider>)`. `createServerApp()` has empty stores and no-op `nav`. Uses no `window`.
- **`jsonld.js`**: `buildPersonJsonLd(PROFILE)` returns `{"@context":"https://schema.org","@type":"Person", name, email:"mailto:…", url: site, jobTitle:"Full-stack developer", alumniOf:{"@type":"CollegeOrUniversity", name:"McGill University"}, sameAs:[github, linkedin, instagram]}`.
- **`scripts/prerender.mjs`**: reads `dist/index.html`; imports `dist-ssr/entry-server.js`; `injectResume(html, markup, jsonld)` replaces `<!--resume-outlet-->` and inserts `<script type="application/ld+json">` before `</head>`; writes the file; removes `dist-ssr`. Export `injectResume` for tests (pure, in `scripts/prerender-lib.mjs`).
- **`package.json`**: `"build": "vite build && vite build --ssr src/resume/entry-server.jsx --outDir dist-ssr && node scripts/prerender.mjs"`.
- **`main.jsx`**: `const r = document.getElementById('resume-root'); r.querySelector('main') ? hydrateRoot(r, tree) : createRoot(r).render(tree)`, sharing the same `app`.
- **Performance**:
  - images have `width`/`height` and `loading="lazy"` with `decoding="async"`.
  - the three and supabase chunks are lazy (verify in the build output).
  - no render-blocking JS besides the entry.
  - Lighthouse (Chrome DevTools, incognito, production build via `npm run preview`): targets Performance ≥ 85 mobile / ≥ 95 desktop, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95. Record the scores in the PR description.
- **README**: stack, `npm i`, scripts, env vars, mock mode, Supabase setup steps (section 9), asset scripts, Node ≥ 20.19.

**TEST LIST**
- `resume/Resume.test.jsx` (`renderToString` and client render):
  1. A `main#resume` with `h1` `Jewoo (Jay) Lee`.
  2. Sections with ids `about`, `experience`, `projects`, `skills`, `contact`, `trophies`, each with an h2 of the right text.
  3. Experience: 7 `article`s, the first containing `Wholesale Express`, `Full-Stack Developer (Part-time)` and a `time` element.
  4. Projects: 9 `article`s; the `Joblog` article links `https://joblog-nine.vercel.app` and `https://github.com/jewoolee0502/Joblog`; no element has text `draft blurb`; images have `loading="lazy"`, `width` and `height`.
  5. Skills: 4 groups with 16 items total.
  6. Contact:
     - `a[href="mailto:jewoo.lee@mail.mcgill.ca"]`.
     - the GitHub, LinkedIn and Instagram (`https://www.instagram.com/jwuu_lee/`) hrefs.
     - `a[href="/files/JEWOOLEE_CV.pdf"][download]` with text `Download CV (PDF)`.
  7. The footer contains `Inspired by` and `a[href="https://edh.dev"]`.
  8. Trophies: server render shows `0/13` and 13 `.ach.lock`. A client render with `jayos-ach=["boot"]` shows `1/13`, one `.ach.got` and the text `★ Power User`.
  9. Hydration: put the `renderToString` output into a container, `hydrateRoot` with stored achievements, `await` act; `console.error` was not called with a hydration mismatch, and afterwards `1/13` is shown.
  10. `Open the laptop ↑` calls `scrollTo({top:0, …})` and `nav.openLaptop`.
- `resume/jsonld.test.js`: has `@type` `Person`; `sameAs` holds 3 URLs; `email` starts with `mailto:`; `JSON.stringify` round-trips.
- `scripts/prerender.test.mjs` (`injectResume`):
  - replaces the outlet exactly once.
  - inserts the JSON-LD before `</head>`.
  - throws when the outlet is missing.
  - escapes `</script>` sequences in the JSON (`<` becomes `<`).
- `structure.test.js` (extend the phase 3 one):
  - `index.html` contains `<!--resume-outlet-->`, `name="description"` and `class="skip"`.
  - `public/robots.txt` exists.
  - `src/` has no imports of `gsap`, `lenis`, `prop-types` or `tailwind` (`fs` scan).
  - `three` is imported only by `src/scene/createScene.js`, and `@supabase/supabase-js` only by `src/wall/supabaseWallClient.js` (`fs` scan as a belt-and-braces check over ESLint).
- `os/MenuPop.resume.test.jsx`: on a booted OS with a fake ctrl inside, `◆ JAY-OS` then `Résumé` calls `ctrl.goToResume` (through `nav`) once.

**ACCEPTANCE**
- `npm run build` produces `dist/index.html` containing the full résumé text and the JSON-LD (`grep "Wholesale Express" dist/index.html`).
- `npm run preview` hydrates with no console errors.
- The Lighthouse targets are met or the deviations are explained.
- README is updated.
- `design/` stays untracked (the user decides whether to commit it).
- Full `npm test` and `npm run lint` are green.

**Risks**
- SSR build of JSX that imports CSS: keep CSS imports only in `main.jsx`.
- Any `window` access during render breaks the prerender. The tests catch it, because `renderToString` runs without a DOM in `entry-server` (add a node-environment test that imports `entry-server.jsx` with `// @vitest-environment node`).

---

## 6. Things the test suite cannot cover (handled in the manual pass)

- WebGL rendering, r128 lighting and colour, shadows, CSS3D alignment of the OS on the lid, hover glow and tooltip placement, yaw drag, parallax feel, and the open/close timeline feel. Use a side-by-side comparison with `design/revamp-lab.html` (serve `design/` with `npx serve design` and open both).
- Real layout sizes, `dvh`, safe-area insets, the CSS animations (`winIn`, `shake`, `crtOff`, `fsIn`, toast fade), and audio output.
- Real Supabase (RLS through PostgREST, magic-link email, anonymous sign-in), real getform delivery, and Lighthouse.

---

## 7. Manual Chrome checklist (final pass)

Run `npm run build && npm run preview`. Desktop window is 1440×900. Phone uses DevTools device mode iPhone 14 (390×844) **and** a real phone if possible. Keep DevTools Console open (no errors or warnings except expected ones).

**Load and scene**
- [ ] First paint shows the dark room with no text except the HUD and the scroll cue. The cue bounces. The 3D scene appears within about 1 s (Network: the three chunk loads after the entry).
- [ ] Lighting matches the prototype: lamp warm glow, moonlight, snow in the window, Mont-Royal cross glow, power LED blinking amber in standby.
- [ ] Hover shows a yellow tooltip and blue glow on: laptop, power button, 3 floppies, dog tags, mug, lamp, Visitor wall, Polaroid, sticky note, keyboard, window. Dragging empty space turns the desk (±0.4 rad max). Pointer parallax works.

**Open and close (repeat each at least 5 times, fast and slow)**
- [ ] One wheel notch at the top opens the lid, boots the OS (boot log, then splash), dives in, and the desktop widens to fill the window, with no jumps or glitches mid-dive. The page does not scroll while diving.
- [ ] Inside: scrolling inside a window scrolls only that window. Scrolling down on the desktop shows the "You’re inside the laptop" toast once. Scrolling up on the desktop (a firm flick) exits. Esc exits. `⏏ Close laptop` exits. Each exit closes the lid smoothly and scrolls to the track top.
- [ ] Click the laptop during the exit tween: it reverses smoothly. Open/close 10 times quickly: no stuck states, no second WebGL canvas (Elements panel: one `canvas.gl`).
- [ ] Reload while scrolled to the middle of the track: it does not auto-open (B8).
- [ ] `Résumé ↓` HUD button and JAY-OS menu `Résumé`: exits if inside, then smooth-scrolls to the résumé **without re-opening the laptop**. Scrolling back to the top and one notch down re-opens.
- [ ] Skip link: Tab from the address bar shows "Skip to résumé"; Enter jumps to the résumé.

**Every app** (open from the desktop icons, then from the terminal `open`)
- [ ] About (pixel portrait, live MTL/SEL clocks); Projects (9 cards, `Projects  ·  9 items`); each project window (links open new tabs; adStar and HTTP show "draft blurb"; Joblog image and links).
- [ ] Experience (first entry open); Skills (click slots; React lists Joblog); Resume.pdf (CV downloads; "Read the full résumé" works).
- [ ] Mail: send a real test message and confirm it arrives in getform. Also test with the network offline: the failure toast appears.
- [ ] Service (Salute shows 필승, plays a tone if sound is on, unlocks Once a Marine); Trophies (updates live); Recycle Bin opens RecycleWise; About JAY-OS text; Wallpaper picker (4 snapshots; picking changes the desktop and the caption immediately).
- [ ] Windows: drag by the title bar (follows the pointer exactly while zoomed in); it can't go above the menubar or fully off-screen; click to focus; re-opening an open app shakes it; close.
- [ ] Menu: About JAY-OS, Desktop Background…, Trophies, Résumé, Restart (CRT collapse, then boot again), Shut Down… (collapse, then "It's now safe to turn off", then auto exit). The power button on the 3D laptop boots it again.
- [ ] Menubar: Help opens the Terminal and prints help; the clock toast; the Sound toggle mirrors the HUD.

**Games and toys**
- [ ] BugHunt: bugs crawl over the whole desktop; squashing scores; ≥ 10 unlocks Exterminator; closing mid-round removes all bugs.
- [ ] Snake: arrows, WASD, D-pad, swipe (phone); eating shows "Ate: …"; Retry resets the "Ate:" line; 5 skills unlocks.
- [ ] Paint: draw with the mouse and with touch (phone); the page does not scroll while painting; Save to desktop adds a `my-art-0.png` icon that opens; Pin to wall shows a toast.
- [ ] Floppies slide into the side drive (drive LED flickers) and open Projects / BugHunt / Resume; Floppy Handler unlocks.
- [ ] Dog tags swing and open Service.txt; mug hops; lamp toggles the room light (Night Owl); the window click boosts the snow; the sticky note opens the terminal with help; typing anywhere presses the 3D keys.
- [ ] Konami (↑↑↓↓←→←→BA) gives the disco (OS hue cycle plus lamp colour cycle) and Cheat Code.

**Terminal commands** (type each): `help`, `whoami`, `neofetch`, `ls`, `projects`, `open p9`, `open snake.exe`, `open rec`, `cat about`, `skills`, `experience`, `contact`, `snake`, `bugs`, `paint`, `matrix`, `weather`, `lamp` (twice), `wallpaper golden`, `wallpaper`, `wallpaper constructor` (usage, no crash), `salute`, `sudo hire-jay` (confetti, Resume opens), `sudo rm`, `coffee`, `date`, `pwd`, `cd`, `echo hi`, `hello`, `안녕`, `git`, `vim`, `rm`, `cheat`, `history`, `hepl` (did you mean), `clear`, ↑/↓ history, Tab on `nea` and on `h`, `exit`, `shutdown`.

**Wallpaper secrets** (night, golden and day via `wallpaper night|golden|day`)
- [ ] moon → bagel (night); sun → shades (day); cross cycles colours; wheel spins up; boat toots and speeds up; raccoon bolts and returns after about 14 s; buildings toggle lights (night/golden). A toast shows on the first find of each; 3 distinct finds unlock Local Knowledge.
- [ ] Resizing the window while inside does not reshuffle the city (B4). It rebuilds once after you stop resizing.
- [ ] Reload: the wallpaper is back to Auto (correct for Montréal time); trophies persist; sound is off.

**Visitor Wall (mock, no env vars)**
- [ ] The corkboard shows 3 examples and "your drawing here?". The app shows the "Offline preview" chip, examples labelled "example", and no moderator controls.
- [ ] Pin a drawing: the notice "waiting for Jay to approve" appears. Pin again: still one pending.
- [ ] Open `/?mod`, open Visitor Wall: the sign-in form; `Sign in (mock)` gives the moderation view; Approve puts it on the wall and **on the 3D corkboard** (examples disappear, the caption says "1 pinned by visitors"); Take down; Reject; Sign out.
- [ ] **With real Supabase keys** (after section 9): visitor pin creates a pending row (Table editor); a magic-link sign-in at `/?mod` as Jay shows the queue; approve shows it in a second incognito window after reload; a non-admin email gets "isn’t a moderator"; the 6th pin within an hour gets "Slow down a little".

**Recruiter view and résumé**
- [ ] Recruiter view opens with focus on "Back to the fun"; Esc and backdrop close it; it says "9 projects"; the CV and Full résumé links work.
- [ ] Résumé: every section is present; links work; the CV downloads; the trophies grid shows the current count; the blueprint grid background and dark mode (toggle the OS appearance) both look right; "Inspired by edh.dev" credit in the footer.
- [ ] View Source (Ctrl+U) shows the résumé text and JSON-LD in the HTML.

**Phone (390×844 and a real device)**
- [ ] The 3D room renders with the narrow camera (fov 46). One swipe opens. Inside, JAY-OS is **full-screen flat** (compact: windows fill the screen, no drag, SEL clock and caption hidden).
- [ ] Scrolling inside windows works; the page does not scroll behind the flat OS; `⏏ Close laptop` exits; the menu `Résumé` reaches the résumé.
- [ ] Rotate to landscape (> 760 px wide): it behaves like desktop.

**Reduced motion** (DevTools > Rendering > Emulate `prefers-reduced-motion: reduce`, then reload)
- [ ] Open and close are instant with no smooth scroll; the boot is fast; no parallax, no tag swing; the wallpaper is static but still clickable; Konami unlocks with no disco; Snake is slower (160 ms); no CSS animations.

**No WebGL** (`chrome://flags` disable WebGL, or launch with `--disable-webgl --disable-3d-apis`)
- [ ] The notice "3D is unavailable…" appears; JAY-OS shows full-screen flat (standby, then boot at 10% scroll); `⏏ Close laptop` is hidden; scrolling (wheel **and** touch) continues past to the résumé (B10); every app works; the terminal `lamp` prints "no lamp in flat mode."

**Performance and cleanup**
- [ ] Lighthouse (incognito, mobile and desktop) meets the targets.
- [ ] Performance panel: no long tasks > 200 ms after load, except the scene init.
- [ ] Memory: open/close 20 times shows no steady heap growth.
- [ ] Scrolled down to the résumé, the CPU goes idle (the ticker is stopped).

---

## 8. three.js upgrade recipe (future, not part of this build)

To move off r128:
- `THREE.ColorManagement.enabled = false` (or convert every hex with `.convertSRGBToLinear()`).
- `renderer.outputColorSpace = SRGBColorSpace`; every texture's `colorSpace = SRGBColorSpace`.
- Multiply hemisphere, directional and point light intensities by π.
- Patch `ShaderChunk.lights_pars_begin`'s `getDistanceAttenuation` back to the legacy `pow(saturate(-d/cutoff + 1.0), decay)`.
- Import from `three/addons/...`.
- Verify side by side with the prototype.

---

## 9. What the user must do

1. **Create a Supabase project** (free tier is fine; region `ca-central-1`). We cannot create accounts.
2. **Run the SQL:** Dashboard > SQL Editor, paste and run `supabase/migrations/20261018000000_visitor_wall.sql`. Or, with the Supabase CLI, run `supabase link` then `supabase db push`.
3. **Auth settings:**
   - Authentication > Sign In / Providers: keep **Email** enabled (magic link). Enable **Allow anonymous sign-ins**. Keep "Allow new users to sign up" **on**, because anonymous sign-in needs it. Strangers still cannot create email accounts because the app sends `shouldCreateUser:false`.
   - Optional: enable CAPTCHA (Cloudflare Turnstile) and lower the anonymous sign-in rate limit under Authentication > Rate Limits.
4. **URL configuration** (Authentication > URL Configuration): Site URL = `VITE_SITE_URL` (default `https://jewoo-lee.vercel.app`). Redirect URLs: `<site>/?mod`, `http://localhost:5173/?mod`, `http://localhost:4173/?mod`, and the Vercel preview pattern `https://*-<your-team>.vercel.app/**`.
5. **Create Jay's moderator user:** Authentication > Users > Add user > your email (for example `jewoo.lee@mail.mcgill.ca`), confirmed. Then edit `supabase/seed/admin.sql` with that email and run it in the SQL Editor. Check with `select * from public.admins;`.
6. **Environment variables:**
   - Vercel > Project > Settings > Environment Variables (Production and Preview): `VITE_SUPABASE_URL` (Project Settings > API > URL) and `VITE_SUPABASE_ANON_KEY` (the anon or publishable key; **never** the service_role or secret key). Redeploy.
   - Locally: `cp .env.example .env.local` and fill both. Without them the site runs the mock wall.
7. **Moderating:** open `https://<site>/?mod`, open the Visitor Wall, enter your email, click the magic link, and approve or reject. Rejected and taken-down drawings stay in the table for audit, and are never public.
8. **Confirm content questions:**
   - Custom domain: none yet (the CV's domain does not resolve). Set `VITE_SITE_URL` in Vercel if one is attached; the default is `https://jewoo-lee.vercel.app`.
   - The About text still says "student" / "STUDYING", while the CV says the degree ended Dec 2025.
   - The CV's LinkedIn and GitHub handles (`linkedin.com/jewoolee`, `github.com/jewoolee`) differ from the site's (`jewoo-lee`, `jewoolee0502`). The site keeps the prototype's.
   - The adStar and HTTP blurbs are still drafts.
   - Check the Joblog screenshot (or placeholder).
9. **getform:** confirm the endpoint `akknzgea` still delivers to your inbox (the manual test sends one message).
10. Optional later: in Supabase, schedule cleanup of old anonymous users (Auth docs: "anonymous sign-ins > cleanup").
