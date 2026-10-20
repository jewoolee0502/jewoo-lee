# Round 3 exploration: two views (laptop / résumé)

Owner's request (2026-10-19): scrolling may only open and close the laptop. The résumé is entered only
by a button; there, scroll moves only the résumé. A button returns to the laptop view.

Decisions (owner answers):
- Résumé view has a sticky "← Laptop view" button pinned to the top corner.
- Returning lands where the visitor left (open laptop, or closed desk).
- Switch is a quick ~0.3 s fade; instant with reduced motion.
- `#resume` is the résumé view's URL; browser Back returns to the laptop; `#resume` deep-links.

## Scroll machinery today

- `#track` (Stage.jsx:36) is `var(--track-h)` = 290vh (tokens.css:13, must equal TRACK_VH,
  constants.js:14; stage.css.test.js:37-42 asserts TRACK_VH = 100·(1+sum RUNWAY)). RUNWAY
  {dive 1, inside .12, out .6, tail .18} (constants.js:13). The résumé (`#resume-root`, index.html:29) is a
  sibling after the track, reached by scrolling past R.
- runway.js: runwayLayout (:32-42), poseAt (:47-60, segs top/dive/inside/out/tail/past), settleTarget
  (:71-81), cueOpacity (:84-88), snapPoints (:94-100), remapScroll (:103-120), wheelPixels (:123-127),
  createDetent (:143-177).
- controller.js: store {phase, interactive, narrow, detent} (:53); update() (:99-162) does snap sync,
  resize remap (glide.jump), fallback path, setDetent, pose/z/phase/cue/HUD; applyFlat (:167-179);
  enter() (:189-198) glides to trackTopDoc+diveEnd; exit() (:201-204) glides to trackTop; goToResume
  (:207-210) = glide.cancel + scrollToResume; settle (:214-220); releaseSnap (:223-227); onWheel detent
  (:230-251).
- useStageBindings.js: ticker→ctrl.update; IntersectionObserver pauses ticker when the stage is off-screen
  (must still fire when the stage is display:none); ResizeObserver; scroll idle + graceHold; window wheel
  cancels glide; detent listener on #stage (:132-148); window scroll → glide.onScroll/owns + idle; touch/
  pointer holds; Konami hold; keydown (glide.cancel, graceHold, arrowStep while html.runway-snap);
  pinScroll.
- glide.js: to/jump/cancel/onScroll/active; owns + lastWritten (snap re-correction); hold (snap-hold).
- snapRail.js, arrowStep.js: snap-only. createApp.js:77-88,138-151: snapSupported, holdSnap/syncHold,
  setSnap toggle `html.runway-snap` / `snap-hold`. stage.css:14-20 snap rules incl.
  `html.runway-snap #resume-root{scroll-snap-align:start}`.
- keys.js: Esc closes recOpen, then ◆ menu, then ctrl.exit() when ready and phase≠desk. Konami holds settle.

## Navigation

- createApp.js:156-159: `nav.goToResume = () => app.ctrl.goToResume()`, `nav.openLaptop = () =>
  app.ctrl.enter()` (pick('nav') overridable). entry-server.jsx:17 stubs both as no-ops.
- nav callers: Hud.jsx:17 (#hud-resume "Résumé ↓"), Hud.jsx:23 (#hud-ach ★ → openLaptop + openApp('ach')),
  ExitPill.jsx:13 ("Go to résumé ↓", shown only under `.stage.zoomed`), RecruiterView.jsx:81 ("Full résumé ↓"
  closes then goToResume), MenuPop.jsx:16 (◆ → Résumé), ResumeApp.jsx:25 (OS window button),
  Resume.jsx:101 ("Open the laptop ↑", href="#top", preventDefault → openLaptop), JayOS.jsx:20 (#glass →
  openLaptop), main.jsx:35 (skip link → goToResume, preventDefault; hash never written).
- direct ctrl.enter: scene/hotspots.js:12 (many hotspots), createScene.js:571,575 (floppy), :951 (openLid).
  ctrl.exit: keys.js:78 (Esc), MenuBar.jsx:27 (⏏), MenuPop.jsx:18 (Shut Down), osController.js:89-100,
  terminal commands.js:212 (exit), :219 (shutdown).
- No code reads location.hash, history, hashchange or popstate today.

## Résumé, SEO, CSS

- index.html: `<body id="top">`, skip link `<a class="skip" href="#resume">`, `#app`, `#resume-root` with
  `<!--resume-outlet-->` replaced at build (scripts/prerender-lib.mjs, prerender.mjs; build =
  vite build && vite build --ssr src/resume/entry-server.jsx && node scripts/prerender.mjs).
  `<noscript><style>#app:empty{height:0}</style></noscript>`. No vercel.json (no CSP header).
- main.jsx hydrates the résumé only if `#resume-root` already has a `<main>` (direct child).
- Resume.jsx: `<main id="resume" aria-labelledby="resume-title">`, `<h1 id="resume-title" tabIndex={-1}>`,
  sections about/experience/projects/skills/contact/trophies; must not touch window during render.
- SEO: résumé text must stay in the static HTML and readable without JS.
- resume.css:27 `#app:empty{height:var(--track-h)}` reserves the track before mount (CLS).
- tokens.css:39 global reduced-motion rule kills animation/transition; core/motion.js reduce() →
  app.motion.reduce().
- No-WebGL fallback: SceneMount sets status 'unavailable'; controller applyFlat → `#track.flat-runway`
  (height:auto), flat OS + NoWebGLNotice; résumé currently shows below the flat OS.

## Tests likely affected

runway.test.js, controller.test.js (tests 5, 9, 10, cue test), glide.test.js, snapRail.test.js,
arrowStep.test.js, stage.css.test.js (TRACK_VH, snap rules), Stage.test.jsx (listener list 9/9b, 18b,
19 detent, 15 pill, 17c), Hud.resume.test.jsx (scrollIntoView), keys.test.js, structure.test.js
(imports createDetent; skip link), createApp.test.js (snap rail / runway-snap), Resume.test.jsx (10, 12),
seo.test.js (noscript), RecruiterView.test.jsx, MenuPop.resume.test.jsx, JayOS.test.jsx, apps.test.jsx,
hotspots.test.js, commands.test.js.
