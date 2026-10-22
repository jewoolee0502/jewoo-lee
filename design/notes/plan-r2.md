# Implementation plan, round 2: native scroll, removals, camera polish, McGill mug, sharp images

> **Superseded in part by round 3** (`design/notes/plan-r3.md`, two views: laptop / résumé). R2, R5, R10's note on the scroll after the stage, §2.1 geometry, the §2.2 rows for the résumé, PageDown/End, Tab and `#resume`, and U1–U5, U8 and U9's tail/out wording no longer hold; D11 ("résumé below") is replaced by plan-r3 V1. Read plan-r3 §1–§2 for the current scroll model.

Branch `feat/website-revamp`, worktree `.worktrees/feat-website-revamp`. Base: HEAD `c90ecff` plus the image commits on top.
Inputs: owner's manual-test feedback and final decisions (quoted in the task brief), `design/notes/r2-explore-{scroll,removal,images,camera,mcgill}.md`, the round-1 plan `design/notes/plan.md` (vocabulary: D-numbers, B-numbers, phases, TEST LIST).

Build loop per phase (unchanged from round 1): a Haiku test-writer writes the failing tests from the phase TEST LIST, an Opus implementer makes them pass, a Haiku reviewer checks the ACCEPTANCE list against the code. Repeat until the reviewer finds no gaps. After phase 5, a manual pass in real Chrome (section 6).

Every phase ends with all three green: `npm test`, `npm run lint`, `npm run build` (the build includes the SSR build and `scripts/prerender.mjs`).

Line numbers below are from `c90ecff` and are hints. Search by symbol if they moved.

---

## 1. Decisions made in this plan

Owner decisions 1–8 from the brief are final and are not repeated here. These are the technical decisions taken to carry them out.

| # | Decision | Why |
|---|---|---|
| R1 | **The camera pose is a pure function of the document scroll position.** `z = f(s)`, recomputed every frame from `getBoundingClientRect()`. There is no time-based tween, no `armed`, no `suppress`, no `leave()`. | This is "Follow my scroll". Native wheel, trackpad momentum, touch, keyboard, scrollbar, find-in-page and hash jumps all move `s`, so they all move the camera the same way, at the machine's own speed. A one-frame-later camera can never disagree with the page for more than a frame. |
| R2 | **Runway (in stage heights `H`): dive 1.00, inside 0.12, out 0.60, tail 0.18.** Pinned range `R = 1.90 H`, track height `290vh`. `z` rises 0→1 over the dive, is exactly 1 on the inside plateau, falls 1→0 over the out segment, and is exactly 0 on the tail. The stage unpins only after the tail. | The half-laptop state needs `z > 0` while unpinned. Here `z > 0` only for `s < 1.72 H` and the stage stays pinned until `s = 1.90 H`, so it is impossible by construction. The 0.18 H tail (≥ 0.15 H) absorbs the one-frame lag between the compositor's scroll and the main-thread camera update during fast flings. The short 0.12 H plateau absorbs trackpad jitter (≈ one mouse notch) without a long "dead" stretch where scrolling seems to do nothing: the second notch down already starts stepping out. |
| R3 | **Segments are fractions of the measured pinned range** `R = trackRect.height − stage.clientHeight`, not of `innerHeight`. | The stage is `100dvh` and the track `vh`, which disagree on mobile while the toolbar moves. Using the measured `R` keeps `f(s) = 0` for every `s ≥ 0.905 R` whatever the units do. |
| R4 | **Inside = flat, on every viewport.** When `interactive` turns on, the OS element moves into `.flat-host` (already used for phones), scaled with a 2D `scale(k)`, `k = min(W/900, H/675)`, or compact on narrow screens. When it turns off, the OS goes back into the CSS3D holder. WebGL rendering is skipped while inside. | At `z = 1` the 3D projection of the widened holder is exactly the flat layout (same `k`, same centre), so the swap is invisible. Flat DOM is rasterised at its final scale, which fixes the CSS3D upscaling blur (owner's "low quality images" feedback, and text). It also makes window scrolling, text selection, focus and hit testing plain DOM again, and saves GPU and main-thread time while the user reads. |
| R5 | **No wheel interception except a one-burst "detent" on the way in.** Wheel over a scrollable OS window scrolls it natively; at its edge, or over the wallpaper/menubar, the page scrolls natively (we drop `overscroll-behavior: contain` from `.wb` and `.t-out`). The only non-passive listener is on `#stage` and it does one thing: when a wheel burst that started above the plateau would cross into it, it stops the burst at the plateau start (`preventDefault` the rest of that burst, and scroll to the plateau start). The next burst (after a 120 ms gap, a direction change, or a clearly new gesture) scrolls natively. | Matches the machine's nested-scroll behaviour (browsers already latch one gesture to one scroller, so momentum never spills out of a window). The detent stops a single fling from flying through the inside, which is the one case native scrolling handles badly here. Touch momentum cannot be stopped without `touch-action:none`, which would kill native scrolling, so on touch the plateau can be flung through; the idle settle (R6) and tap-to-enter compensate. Upward flings from the résumé are also not detented: those wheel events target the résumé (browsers latch the event target per gesture), and putting a non-passive wheel listener on the whole page would make all scrolling main-thread-bound. |
| R6 | **Idle settle in JS, not CSS scroll-snap.** After the scroll comes to rest (`scrollend` where supported, otherwise 160 ms without scroll events), and no touch or pointer is held, a resting position inside the dive or out segment glides to the nearest end, biased toward the last scroll direction (threshold 0.3 in the direction of travel). Plateau, top, tail and résumé never settle. | CSS `mandatory` snapping on the root would yank readers out of the footer and is quirky with tall snap areas in Safari. `proximity` cannot guarantee "fully open or fully closed". JS settle only runs after the user stopped, and our glide aborts on any user input, so it never fights active scrolling. |
| R7 | **Own glide for programmatic scrolls** (`enter`, `exit`, settle): rAF-driven `scrollTo({behavior:'instant'})` with `easeIO`, duration `clamp(0.35 + 0.55·|Δ|/H, 0.35, 1.4)` s. It cancels on wheel, touchstart, pointerdown, keydown, and on any scroll event that lands more than 2 px away from the value it set (scrollbar drags, Safari without `scrollend`). Reduced motion: one instant `scrollTo`. `goToResume()` keeps the native `scrollIntoView` (long distance, already tested). | Native smooth scroll speed is browser-defined and often too fast for a dive. Owning the glide gives a consistent pace and an exact reduced-motion path, and is unit-testable with a fake rAF. |
| R8 | **`interactive` has hysteresis:** on at `z ≥ 0.999`, off at `z < 0.985`. | Sub-pixel scroll jitter must not swap the OS between flat and 3D. 0.015 of the out segment is about 9 px at `H = 1000`. |
| R9 | **Window scroll positions survive leaving the laptop.** `host.setLive(false)` no longer resets `.wb`/`.t-out` `scrollTop`. | With a scroll-linked plateau the live flag toggles often. `.os:not(.live) .wb{overflow:hidden}` (kept) already stops 3D windows from scrolling mid-dive, and `overflow:hidden` preserves `scrollTop`. |
| R10 | **No-WebGL fallback collapses the runway**: the track gets class `flat-runway` (`height:auto`, stage not sticky). The flat compact OS boots on the first frame and stays live. The scroll cue is hidden. | Nothing is scroll-linked without a scene. A 290vh track over a static OS would be a pointless pinned stretch. |
| R11 | **Perceptual dive**: the camera's position and look lerp use `perceptualE(e, d0, d1)`, which makes the screen's apparent size grow linearly with scroll. | With a linear position lerp, the screen stays small for most of the dive and text is only readable in the last 10–15 % (r2-explore-camera §1b). Scroll-linked, that slow-then-sudden growth would feel like lag. |
| R12 | **Widen late and clipped**: the holder stays 900×675 until `z = 0.97`, widens over `[0.97, 1]`, and is clipped to the bezel rectangle (948×720 OS px) with the clip opening over `[0.985, 1]`. `widenSize` drops the old `0.994` factor so `widenSize(1)` equals the flat layout exactly. | Fixes the DOM overhanging the bezel (r2-explore-camera §2.6) and makes the R4 swap seamless. |
| R13 | **Polaroid alone on the wall** at `(1.6, 3.05, −2.975)`, scale 1.2, `rotation.z −0.06`, with a strip of yellow tape instead of the corkboard and pin. | Mirrors the dog tags at `x −1.6`, clears the lid's projected top edge (wall `y ≈ 2.33` from the wide camera) and the lamp shade. |
| R14 | **Floppy drive slot moves to the front face of the base** (right of centre), and floppies travel home → lane → approach → seated with 0.05 sticking out. | The current slot is on the right side face, which faces away from the default camera (camera `x 1.4 < 1.5`), so an insertion can never be seen. The front face faces the camera in every pose. The lane path above the stack avoids passing through the base and the other floppies. |
| R15 | **Images: originals restored from git into `design/img/originals/`** (byte-identical blobs, so the repo does not grow), WebP at 640/1280/1920 (never enlarged), quality 82, effort 6, a generated manifest `src/content/projectImages.js` with natural sizes and files, `srcset`+`sizes` computed from the OS scale. `design/img/*.jpg` stay (the prototype `design/revamp-lab.html` uses them). | `sizes` is in CSS px and ignores transforms, so with the OS scaled by `k` the `sizes` value must include `k`, or the browser picks a too-small candidate. |
| R16 | **McGill mug label is a full-wrap canvas texture on an open-ended cylinder with `thetaStart = π`,** so the canvas centre faces the mug's local `+z`; the mug group is rotated to face the desktop wide camera. Handle is a half torus (`arc = π`) rotated `−π/2` about z. | `thetaStart = π` puts the wordmark on the front without a seam at the text. The old closed cylinder also hid the coffee under its top cap. |

---

## 2. The scroll model in detail (shared by phases 2–4)

### 2.1 Geometry

```
document y →
0 (track top)                                              R = trackH − stageH          trackH
|---------- dive ----------|-in-|------- out -------|-tail-|---- stage scrolls away ----|résumé…
0                       diveEnd insideEnd        outEnd    R
z:  0 ──────────────────► 1    1   1 ───────────────► 0   0                              0
stage: pinned (sticky top 0) for s ∈ [0, R]; unpins for s > R
```

With `H = stage.clientHeight`, track `290vh` and `R = trackH − H` (≈ 1.9 H), `unit = R / 1.9`:
`diveEnd = round(1.00·unit)`, `insideEnd = round(1.12·unit)`, `outEnd = round(1.72·unit)`, `pinEnd = R`.
`s` is track-relative: `s = −trackRect.top`. Document position of the track top: `trackTopDoc = scrollY + trackRect.top`.

Reference numbers used in tests (`H = 1000`, `trackH = 2900`): `R = 1900`, `diveEnd = 1000`, `insideEnd = 1120`, `outEnd = 1720`.

### 2.2 Input behaviour (what the implementation must produce)

| Input | Behaviour |
|---|---|
| Wheel / trackpad on the desk or mid-dive | Native page scroll; camera follows. One burst that starts above `diveEnd` stops at `diveEnd` (detent, R5). |
| Wheel inside, over a window that can scroll | Native: the window scrolls. Momentum stays in the window (browser latching). |
| Wheel inside, at a window's edge (new gesture) or over wallpaper, menubar, icons | Native page scroll: 0.12 H plateau, then the camera steps out. |
| Wheel up from the résumé | Native; no detent. Passing the stage reverses the dive. |
| Touch | Native everywhere (`touch-action: pan-y` on stage and window bodies; no trap). Flings can pass the plateau (accepted). |
| Space / PageDown / PageUp / arrows / Home / End | Native page scroll. From the top, PageDown lands mid-dive (`s ≈ 875`), then settles open. From inside, PageDown lands on the tail (closed, wide shot). End goes to the résumé end, Home to the closed laptop. Inside a focused input or button, the keys do what that element does. |
| Scrollbar drag / track click | Native. Settle waits for `scrollend`; in browsers without it the glide aborts as soon as the drag moves the page again. |
| Find-in-page | Native. Matches in the résumé put `s > R`, so `z = 0`. Matches inside the 3D OS are handled by the existing `pinScroll` (kept). |
| Tab / Shift+Tab | Native. Focusing a résumé element scrolls the page there, so the laptop closes on its own; `leave()` and the `focusin` handler are deleted. The holder is `visibility:hidden` while the lid is mostly closed, so OS controls are not focusable then. |
| `#resume` (skip link, HUD "Résumé ↓", Recruiter "Full résumé ↓", "Go to résumé ↓" pill) | `app.nav.goToResume()`: cancel any glide, `scrollToResume(behavior)`, focus `#resume-title`. |
| `#top` ("Open the laptop ↑" in the résumé) | `app.nav.openLaptop()` = `ctrl.enter()`: glide to `trackTopDoc + diveEnd` from wherever the page is. |
| Esc | If the scene is ready and phase ≠ `desk`: `ctrl.exit()` (glide to `trackTopDoc`). Recruiter view first, as now. |
| Clicks on the laptop, hotspots, floppies, ★ HUD, the glass | `ctrl.enter()` (unchanged call sites). |
| ⏏ Close laptop, Shut Down…, terminal `exit` / `shutdown` | `ctrl.exit()` (unchanged call sites). |
| Resize mid-dive | Every frame re-measures. If `R` changes by more than 15 %, the controller keeps the segment and fraction (`remapScroll`) with one instant `scrollTo`. Smaller changes (mobile toolbar) are ignored; the invariant still holds. |
| Phone flat mode (`narrow`) | Same runway. At `interactive` the OS goes flat compact (fade 0.18 s, as now). |
| No WebGL | R10. |
| Reduced motion | Parallax off (as now), glides and settle are instant, the detent snaps instantly, hover lifts, wiggle, steam, lid peek and lamp easing are off, the flat-host fade and vignette transition are off. The dive itself stays scroll-linked (direct manipulation, not autonomous animation). |

### 2.3 Phase and flags

`store = { phase: 'desk' | 'dive' | 'inside', interactive, narrow }`. `interactive` follows R8. `phase = interactive ? 'inside' : z > 0 ? 'dive' : 'desk'`. On every change of `interactive`: `ui.setZoomed(interactive)` (stage class `zoomed`), `os.setLive(interactive)`, `ctrl.applyFlat()`.

`applyFlat()`: `os.setFlat(interactive || unavailable, unavailable ? true : narrow)`; in the fallback also `os.setLive(true)`.

---

## 3. Phases

### Phase 1: Remove Paint, the Visitor Wall, Supabase, the corkboard and the edh.dev credit

**Goal.** The repo no longer contains Paint, the Visitor Wall or any Supabase code, config, docs or dependency; the corkboard is gone and the polaroid hangs alone on the wall; the edh.dev credit is gone from the shipped site and the README; trophies are 12.

**Delete**
- `src/os/apps/paint/` (all four files), `src/os/apps/VisitorWall.jsx`, `src/os/apps/VisitorWall.test.jsx`, `src/os/apps/Art.jsx`
- `src/wall/` (whole directory, 14 files), `src/test/fakeSupabase.js`
- `supabase/` (whole directory)

**Change**
- `package.json` / `package-lock.json`: run `npm uninstall @supabase/supabase-js @electric-sql/pglite` (do not hand-edit the lock file).
- `vite.config.js`: drop `'supabase/**/*.test.js'` from `test.include`.
- `eslint.config.js`: drop `'supabase/**'` from the node-globals block, drop the `@supabase/supabase-js` restricted path, and the override block keeps only `'src/scene/createScene.js'`.
- `.env.example`: delete the Visitor Wall block and both `VITE_SUPABASE_*` lines; keep the `VITE_SITE_URL` block.
- `README.md`: line 5 (drop "Paint and a moderated Visitor Wall"), the Supabase bullet (15), "and PGlite" (17), the mock-wall sentence (29–30), the supabase lint note (40), the two env rows and the sentence after them (52–55), the whole `## Supabase setup (Visitor Wall)` section, the Vercel env list (keep only `VITE_SITE_URL`), the layout lines for Paint/Visitor Wall, `src/wall`, `supabase/`, and the whole `## Credits` section.
- `design/notes/plan.md`: add one line under the title: `> Round 2 (design/notes/plan-r2.md) removed Paint, the Visitor Wall, Supabase, the corkboard and the edh.dev credit; text below about them is historical.` Do not edit anything else in `design/`. `design/revamp-lab.html` stays untouched.
- `src/app/createApp.js`: remove the `createWallStore` import, `app.wall`, `startWallTriggers` and its call, and `app.wall?.dispose?.()`. `app.start` returns only the wallpaper stop.
- `src/os/registry.js`: remove the Paint, VisitorWall and Art imports and entries; `dynApp(id)` handles only `p:N`; `lookupApp(reg, id)` loses the `art` argument.
- `src/os/osController.js`: remove `art: []`, `addArt`, its export, and the `art` argument to `lookupApp`.
- `src/os/DesktopIcons.jsx`: remove the `paint` and `wall` entries, the `art` selector and the `art:N` icons. Update its header comment.
- `src/os/apps/terminal/commands.js`: remove `paint`, `wall`, `visitorwall` from `NAMES` and the command map; remove "Paint" and "Visitor Wall" from the `ls` string; the help line becomes `'snake · bugs     play'` (help stays 14 lines).
- `src/core/achievements.js`: remove the `paint` tuple (12 trophies).
- `src/lib/pixelIcons.js`: remove `BMP.paint` and `BMP.wall`.
- `src/lib/png.js`: remove `validateDrawingDataUrl`, `MAX_DRAWING_BYTES`, `DRAWING_SIZE`, `gridToPngDataUrl`, `base64ToBytes`; keep the encoder, `PNG_PREFIX`, `bytesToBase64`, `hexToRgb`, `readPngInfo`; rewrite the header comment (icons and the asset script only).
- `src/scene/textures.js`: remove `drawCork`, `CORK_SLOTS`, `PINS`.
- `src/scene/hotspots.js`: remove the `'Visitor wall'` action.
- **Add** `src/scene/props.js`: pure data, no `three`. In this phase it exports
  `POLAROID = { pos: [1.6, 3.05, -2.975], rotZ: -0.06, scale: 1.2, card: [0.64, 0.76, 0.012], photo: [0.54, 0.58], photoY: 0.06, tape: { size: [0.3, 0.08, 0.004], pos: [0, 0.38, 0.012], rotZ: 0.08, color: 0xffd15c, opacity: 0.85 } }`.
- `src/scene/createScene.js`: remove the wall import, `drawCork`, the cork group, board mesh and `corkTex`, `setWall` and its state, the `corkTex` entry in `redrawText`, `setWall` in the api, `addHot(cork, …)`. `wireScene` keeps only the OS and wallpaper subscriptions and no longer calls `app.wall.ensureInit`. The polaroid group `pol` is added to `scene` at `POLAROID.pos` with `POLAROID.rotZ` and `scale.setScalar(POLAROID.scale)`; card and photo as before; the red pin sphere is replaced by the tape: a `MeshStandardMaterial({ color: tape.color, transparent: true, opacity: tape.opacity, roughness: 0.9 })` box. Keep `addHot(pol, 'Polaroid')`. Update the section comment.
- `src/os/apps/AboutOs.jsx`: the muted line becomes `Runs on a 90s laptop in Montréal, with snow.`
- `src/resume/Resume.jsx`: footer text becomes `© 2026 Jewoo Lee` (no link).
- `src/test/setup.js`: the comment on line 9 no longer mentions PGlite.
- Tests that change (see TEST LIST).

**TEST LIST** (new or rewritten assertions)
1. `src/stage/structure.test.js`
   - `package.json` has neither `@supabase/supabase-js` nor `@electric-sql/pglite` in any dependency field.
   - The directories `supabase`, `src/wall`, `src/os/apps/paint` and the files `src/os/apps/VisitorWall.jsx`, `src/os/apps/Art.jsx`, `src/test/fakeSupabase.js` do not exist.
   - No file under `src/`, `scripts/`, nor `README.md`, `index.html`, `.env.example`, `package.json`, `vite.config.js`, `eslint.config.js` matches (case-insensitive where marked) any of: `/supabase/i`, `/pglite/i`, `/Visitor ?Wall/`, `/wallStore/`, `/corkboard|drawCork/i`, `/edh\.dev/i`, `/Hinrichsen/`, `/ED-Linux/`, `/Artist in Residence/`, `/paintLogic/`, `/my-art-/`. (Exclude this test file itself from the scan.)
   - Delete the old "`@supabase/supabase-js` is imported only by …" test.
2. `src/core/achievements.test.js`: 12 achievements; the id list equals `['boot','floppy','term','neofetch','hire','bugs','snake','tags','lamp','konami','shutdown','local']`; a stored `"paint"` id in `localStorage['jayos-ach']` is dropped (count stays correct).
3. Every hard-coded 13 becomes 12, and every use of the `paint` id in tests becomes `lamp`: `src/resume/TrophiesGrid.test.jsx` (12 cards), `src/resume/Resume.test.jsx` (`0/12`, 12 locked, `1/12`), `src/resume/entry-server.test.jsx` (`0/12`), `src/stage/Stage.test.jsx` (`★ 0/12`, `★ 2/12`), `src/os/apps/apps.test.jsx` ("0 of 12", 12 items, "1 of 12"). Implementer runs `git grep -n "13" -- 'src/**/*.test.*'` and checks each hit.
4. `src/resume/Resume.test.jsx` test 7: the footer text is `© 2026 Jewoo Lee`, and the footer contains no `Inspired by`, no `edh.dev`, and no link.
5. `src/os/apps/apps.test.jsx` AboutOs: renders `Runs on a 90s laptop in Montréal, with snow.` and does not contain `Inspired`. Delete `describe('Art')`.
6. `src/os/JayOS.test.jsx`: right-column labels are exactly `['BugHunt.exe','Snake.exe','Service.txt','Trophies','Recycle Bin']`.
7. `src/os/apps/terminal/commands.test.js` and `Terminal.test.jsx`: help line `snake · bugs     play`; help is 14 lines; `paint`, `wall`, `visitorwall` print the unknown-command message; `ls` output has no `Paint` or `Visitor Wall`. `parse.test.js`: drop the removed aliases from its tables.
8. `src/os/registry.test.js`: `dynApp('art:0')` and `lookupApp(registry, 'paint')`, `lookupApp(registry, 'wall')` return null.
9. `src/os/osController.test.js`: delete the `art:0` test; the store has no `art` key; the controller has no `addArt`.
10. `src/lib/pixelIcons.test.js`: `Object.keys(ICON)` has 13 keys and contains neither `paint` nor `wall`. `src/lib/png.test.js`: delete the `gridToPngDataUrl`/validator block; the module exports none of the removed names.
11. `src/scene/textures.test.js`: delete the `drawCork` tests; the module has no `drawCork` export.
12. `src/scene/hotspots.test.js`: LABELS has 12 entries (`'Visitor wall'` gone); `actions.get('Visitor wall')` is undefined; the count test says 12.
13. `src/scene/props.test.js` (new): the polaroid bottom edge `POLAROID.pos[1] − card[1]/2·scale` is ≥ 2.45 (clears the lid's projected top) and ≤ 3.0; its x range `pos[0] ± card[0]/2·scale` lies within `[0.9, 2.4]` (clear of the dog tags at −1.6 and the window at x ≤ −2.25); `pos[2]` is between −2.99 and −2.95 (in front of the wall at −3).
14. `src/scene/createScene.test.jsx` and `src/stage/SceneMount.wiring.test.jsx`: remove the wall fake, `subs.wall` and the `setWall` tests; `createApp()` is called without `wall`; the remaining dispose/unsubscribe tests still pass; the api has no `setWall` key.

**Implementation notes and pitfalls**
- Order: delete files → registry/controller/icons/commands → scene → png trim → credit → tests → package/config/docs. Run `npm test` after the registry step; many suites import the registry.
- The prerendered résumé (`scripts/prerender.mjs`, `src/resume/entry-server.jsx`) must still build: the entry passes a fake app; remove any `wall` field there if present.
- `createAchievements` already drops unknown stored ids; no migration.
- Keep `src/wallpaper/*` (the Montréal wallpaper). Greps for `wall` hit it: do not touch it.
- Outside the repo (owner, after deploy): remove `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Vercel Production and Preview, then pause or delete the Supabase project (it holds visitor drawings). Put this in the final report, not in the code.

**ACCEPTANCE**
- All TEST LIST items pass; `npm test`, `npm run lint`, `npm run build` green.
- `npm ls @supabase/supabase-js @electric-sql/pglite` reports nothing.
- `git grep -nIi -e supabase -e pglite -e "visitor wall" -e hinrichsen -e "edh.dev" -- . ':!design'` prints nothing.
- Desktop shows 8 left icons and 5 right icons; the room has no corkboard; the polaroid with tape is on the wall and opens About.

---

### Phase 2: Scroll-linked stage, inside = flat, "Go to résumé ↓"

**Goal.** Section 2 is implemented. The old wheel hijack, triggered tween, suppress/armed logic and focus-leave logic are gone. The half-laptop state is impossible.

**Add**
- `src/stage/runway.js` — pure, no DOM:
  - `RUNWAY` lives in `core/constants.js` (below); this module imports it.
  - `runwayLayout({ trackH, stageH })` → `{ R, diveEnd, insideEnd, outEnd, stageH }` (section 2.1; `R = max(1, trackH − stageH)`).
  - `poseAt(s, L)` → `{ z, seg, u }` with `seg ∈ 'top' | 'dive' | 'inside' | 'out' | 'tail' | 'past'`; `u` is the fraction inside `dive` or `out` (else 0).
  - `nextInteractive(prev, z)` → `prev ? z >= INSIDE_OFF : z >= INSIDE_ON`.
  - `settleTarget(s, L, dir)` → track-relative target or `null` (R6). `dive`: open when `dir > 0 ? u >= 0.3 : dir < 0 ? u > 0.7 : u >= 0.5`, target `diveEnd`, else `0`. `out`: leave when `dir > 0 ? u >= 0.3 : dir < 0 ? u > 0.7 : u >= 0.5`, target `outEnd`, else `insideEnd`. Other segments: `null`. Return `null` when `|target − s| < 1`.
  - `remapScroll(s, L0, L1)` → same segment and fraction in `L1`; `past` keeps its offset beyond `R` (`s − L0.R + L1.R`); `top` → `s`.
  - `wheelPixels(deltaY, deltaMode, pageH)` → `deltaMode 0: deltaY; 1: deltaY·16; 2: deltaY·pageH`.
  - `createDetent({ gapMs = DETENT_GAP_MS })` → `{ onWheel({ t, dy, s, diveEnd }) → { block, snapTo } }`. Burst = events less than `gapMs` apart. At the first event of a burst record `start = s`. Not held: if `dy > 0 && start < diveEnd && s + dy > diveEnd` → hold, return `{ block: true, snapTo: diveEnd }`. Held: release (and treat the event as unheld, which never blocks) when `t − last ≥ gapMs`, when `dy < 0`, or when `|dy| > max(8, 1.6·lastAbs)`; otherwise `{ block: true, snapTo: null }`. Always update `last` and `lastAbs`.
- `src/stage/glide.js` — `createGlide({ getY, scrollTo, raf, caf, now, reduce })` → `{ to(top, { duration }?), cancel(), onScroll(y), get active }`. `duration` defaults to `glideDuration(|top − getY()|, pageH)` where `glideDuration(dist, H) = clamp(0.35 + 0.55·dist/H, 0.35, 1.4)` (export it). Each frame `scrollTo({ top: round(y), behavior: 'instant' })` along `easeIO`; the last frame writes exactly `top`. Reduced motion: one `scrollTo({ top, behavior: 'instant' })`, no rAF. `onScroll(y)` cancels when active and `|y − lastWritten| > 2`. `to()` while active replaces the running glide.
- `src/stage/scrollIdle.js` — `createScrollIdle({ timers, idleMs = IDLE_MS, onIdle })` → `{ scroll(y), scrollEnd(), hold(kind, on), dispose() }`. `scroll(y)` records direction (sign of the last non-zero `y − prevY`) and restarts an `idleMs` timer; `scrollEnd()` fires at once. `onIdle(dir)` is never called while any hold (`'touch'`, `'pointer'`) is on; releasing the last hold re-arms the timer. Bindings use `scrollEnd` when `'onscrollend' in window`, the timer otherwise (both may be wired; the first one to fire wins, the other is ignored until the next `scroll`).
- `src/stage/ExitPill.jsx` — `<button id="hud-exit" className="exit-pill" type="button" title="Leave the laptop and read the résumé (Esc closes it)" onClick={() => app.nav.goToResume()}>Go to résumé ↓</button>`. Visibility is CSS-only (`.stage.zoomed .exit-pill`), so no per-frame React state. Rendered by `Stage.jsx` after `<Hud/>`.

**Delete**: `src/stage/wheel.js`, `src/stage/wheel.test.js`.

**Change**
- `src/core/constants.js`: remove `WHEEL_EXIT`, `WHEEL_GAP_MS`. Add `RUNWAY = { dive: 1, inside: 0.12, out: 0.6, tail: 0.18 }`, `TRACK_VH = 290`, `INSIDE_ON = 0.999`, `INSIDE_OFF = 0.985`, `IDLE_MS = 160`, `DETENT_GAP_MS = 120`, `SETTLE_BIAS = 0.3`, `REMAP_THRESHOLD = 0.15`.
- `src/stage/controller.js`: rewrite. `createController({ getTrackRect, getStageHeight, scrollY, scrollTo, glide, reduce, sceneStatus, os, ui, scrollToResume })`. Properties written per frame: `z`, `seg`, `layout`. Methods:
  - `update()`: measure (`r = getTrackRect()`, `L = runwayLayout({ trackH: r.height, stageH: getStageHeight() })`). If a previous layout exists and `|L.R − prev.R| / prev.R > REMAP_THRESHOLD`, call `scrollTo({ top: trackTopDoc + remapScroll(s, prev, L), behavior: 'instant' })` and use the remapped `s` for this frame. Status `unavailable`: `ui.setRunway(true)` once, `applyFlat()`, `os.boot()` if `os.state === 'standby'`, `ui.setCue(0)`, return. Status `loading`: `z = 0`, phase `desk`, `ui.setCue(0.8)`, return. Ready: `pose = poseAt(s, L)`, `z = pose.z`, interactive via `nextInteractive`, phase per section 2.3, `ui.setCue(0.8·(1 − ss(0, 0.15, z)))`; on `interactive` change do the three calls in 2.3.
  - `enter()`: ready and not `interactive` → `glide.to(trackTopDoc + layout.diveEnd)`. Unavailable → `scrollTo({ top: trackTopDoc, behavior })`. Loading → no-op.
  - `exit()`: ready and phase ≠ `desk` → `glide.to(trackTopDoc)`.
  - `goToResume()`: `glide.cancel()`, then `scrollToResume(reduce ? 'auto' : 'smooth')`.
  - `settle(dir)`: ready, `!glide.active`, `t = settleTarget(s, layout, dir)`, `t !== null` → `glide.to(trackTopDoc + t)`.
  - `onWheel({ deltaY, deltaMode, timeStamp })` → boolean "prevent": only when ready and `layout` known; feeds `createDetent`; on `snapTo` calls `scrollTo({ top: trackTopDoc + snapTo, behavior: 'instant' })`.
  - `applyFlat()` (section 2.3), `setNarrow(n)`.
  Remove `tw`, `armed`, `suppress`, `leave`, `startExit`, `p`, the B8/B9 comments; rewrite the header comment around R1–R8.
- `src/app/createApp.js`: create `app.glide = createGlide({ getY: () => globalThis.scrollY, scrollTo: (o) => globalThis.scrollTo(o), raf: (cb) => globalThis.requestAnimationFrame(cb), caf: (id) => globalThis.cancelAnimationFrame(id), now: () => performance.now(), reduce: () => app.motion.reduce() })` (overridable via `pick`). Controller gets `getStageHeight: () => app.dom.stage?.clientHeight || globalThis.innerHeight`, `glide: app.glide`. `ui` gains `setRunway: (flat) => app.dom.track?.classList.toggle('flat-runway', Boolean(flat))` and loses `setTrap`.
- `src/stage/useStageBindings.js`: remove the `createWheelHandler` import and listener and the `focusin` handler. Add:
  - `stage` `wheel` (`{ passive: false }`): `app.glide.cancel()`; if `ctrl.onWheel(e)` → `e.preventDefault()`.
  - `window` `scroll` (passive): `app.glide.onScroll(scrollY)`; `idle.scroll(scrollY)`.
  - `window` `scrollend` (passive, only if `'onscrollend' in window`): `idle.scrollEnd()`.
  - `window` `touchstart` / `touchend` / `touchcancel` (passive): `idle.hold('touch', on)`; touchstart also `app.glide.cancel()`.
  - `window` `pointerdown` / `pointerup` / `pointercancel` (passive): `idle.hold('pointer', on)`; pointerdown also `app.glide.cancel()`.
  - `window` `keydown` (existing handler): add `app.glide.cancel()` for keys other than Shift/Control/Alt/Meta.
  - `idle = createScrollIdle({ timers: app.timers.child(), onIdle: (dir) => ctrl.settle(dir) })`.
  - ResizeObserver: `ctrl.setNarrow(stage.clientWidth < NARROW_PX)` and `app.os.refit()`.
  - Every listener is removed on cleanup; `idle.dispose()` and `app.glide.cancel()` on cleanup. Keep `pinScroll` on stage, flat host and `osEl` (Bug J).
- `src/stage/keys.js`: Esc → if `recOpen` close it; else if scene ready and `app.ctrl.store.get().phase !== 'desk'` → `app.ctrl.exit()`.
- `src/stage/Stage.jsx`: render `<ExitPill />`.
- `src/os/osHost.js`: delete `setTrap`. `setLive(v)` only toggles the class (R9). `fitFlat()` returns the scale it applied (`k`, or `1` for compact or when not flat). `setFlat(v, compact)` also toggles class `fade` on the flat host to `Boolean(compact)`.
- `src/os/osController.js`: store gains `scale: 1`. `setFlat(v, compact)` stores `scale = flat && !compact ? host.fitFlat() : 1`. Add `refit()`: if flat, `scale = host.fitFlat()`, then `fitWindows(wins, host.size())` if any window is now out of bounds; store both.
- `src/scene/createScene.js`: delete the `holder.style.willChange = ctrl.tw ? …` line (keep the `willChange = ''` reset in dispose). In `frame()`, when `ctrl.store.get().interactive` is true: skip `os.setSize`, `renderer.render` and `css.render` (keep the cheap state updates: LEDs, snow positions, tweens). Hotspot and floppy calls to `ctrl.enter()` stay.
- `src/resume/Resume.jsx`: `openLaptop(e)` = `e.preventDefault(); app.nav.openLaptop()` (no manual `scrollTo`, no timer).
- `src/styles/tokens.css`: `:root{ --track-h: 290vh }` (a comment says it must equal `TRACK_VH`).
- `src/styles/stage.css`: `.track{position:relative;height:var(--track-h)}`; add `.track.flat-runway{height:auto}` and `.track.flat-runway .stage{position:relative}`; remove the B10 comment and `.flat-host.on.trap`; `.flat-host.on{display:block}` and `.flat-host.on.fade{animation:fsIn .18s ease-out}`; add
  `.exit-pill{display:none;position:absolute;right:max(16px,env(safe-area-inset-right,0px));bottom:max(16px,env(safe-area-inset-bottom,0px));z-index:20;font:12px var(--f-px);background:rgba(10,16,28,.82);color:#EAF2FB;border:1.5px solid #FFD15C;padding:9px 12px;cursor:pointer;box-shadow:3px 3px 0 rgba(0,0,0,.45)}`,
  `.exit-pill:hover,.exit-pill:focus-visible{background:#FFD15C;color:#122030}`, `.stage.zoomed .exit-pill{display:inline-flex}`;
  `@media (prefers-reduced-motion:reduce){.flat-host.on.fade{animation:none}}`. Keep `.os:not(.live) .wb,.os:not(.live) .t-out{overflow:hidden}` and `.wb,.t-out{touch-action:pan-y}`.
- `src/styles/resume.css`: `#app:empty{height:var(--track-h);background:var(--scene)}`.
- `src/styles/os.css`: `.wb` loses `overscroll-behavior:contain` (R5). `.os.flat #mb-snd` becomes `.os.fallback #mb-snd` (inside is now flat on desktop and the HUD is hidden there, so the menubar must keep its sound button).
- `src/styles/apps.css`: `.t-out` loses `overscroll-behavior:contain`.
- `README.md`: the intro sentence describes the new flow ("Scroll and the laptop opens and you dive into JAY-OS; keep scrolling, press Esc or click Go to résumé ↓ to step out").

**TEST LIST**
1. `src/stage/runway.test.js` (`H = 1000`, `trackH = 2900`):
   - `runwayLayout` → `{ R: 1900, diveEnd: 1000, insideEnd: 1120, outEnd: 1720 }`; with `trackH = 1000` (equal to H) → `R = 1`.
   - `poseAt`: `−50 → {z:0, seg:'top'}`; `0 → z 0`; `500 → z 0.5, seg 'dive', u 0.5`; `1000 → z 1, seg 'inside'`; `1120 → z 1, 'inside'`; `1420 → z 0.5, 'out'`; `1720 → z 0, 'tail'`; `1900 → 'tail'`; `1901 → 'past'`.
   - **Invariant**: for every integer `s` in `[0, 3000]`, `poseAt(s).z > 0` implies `s ≤ R − 0.15·H` (1750). Repeat for `H = 600, trackH = 1740` and `H = 844, trackH = 2448`.
   - `nextInteractive`: `(false, 0.998) → false`, `(false, 0.999) → true`, `(true, 0.99) → true`, `(true, 0.984) → false`.
   - `settleTarget`: `(300, L, +1) → 1000`; `(299, L, +1) → 0`; `(700, L, −1) → 0`; `(701, L, −1) → 1000`; `(500, L, 0) → 1000`; `(499, L, 0) → 0`; `(1300, L, +1) → 1720`; `(1299, L, +1) → 1120`; `(1540, L, −1) → 1120`; `(1541, L, −1) → 1720`; `(0|1000|1120|1060|1720|1800|2500, L, ±1) → null`; `(999.5, L, +1) → null`.
   - `remapScroll`: `L0 = H1000/2900`, `L1 = H600/1740` (`R 1140, diveEnd 600, insideEnd 672, outEnd 1032`): `1000 → 600`, `500 → 300`, `1060 → 636`, `1420 → 852`, `2000 (past, +100) → 1240`, `0 → 0`.
   - `wheelPixels(3, 1, 800) → 48`; `(1, 2, 800) → 800`; `(120, 0, 800) → 120`.
   - Detent (`diveEnd 1000`, 16 ms spacing, the test applies `s += dy` for unblocked events): from `s 800`, deltas `120, 110, 100, 90, 80` → the first is free (920), the second blocks with `snapTo 1000` (set `s = 1000`), the rest block with `snapTo null`; an event 130 ms later with `dy 20` is free; within a held burst `dy −30` is free and releases; within a held burst a rise from `lastAbs 10` to `dy 40` is free and releases; a burst that starts at `s ≥ 1000` never blocks; a burst that started at `s 990` and whose first event is `s 990, dy 40` blocks with `snapTo 1000`; a burst whose start was below 1000 but whose current `s` is already `1060` (smooth-scroll lag) blocks with `snapTo 1000`.
2. `src/stage/glide.test.js` (fake `raf` queue, fake `now`):
   - `glideDuration(1000, 1000) = 0.9`, `(0, 1000) = 0.35`, `(5000, 1000) = 1.4`.
   - `to(1000)` from `getY 0`: every `scrollTo` uses `behavior:'instant'`; values are non-decreasing; the last call is exactly `1000`; after the last frame `active` is false and no rAF is pending.
   - `cancel()` mid-way: no further `scrollTo`, `active` false, the pending rAF is cancelled.
   - `onScroll(lastWritten + 1)` keeps it running; `onScroll(lastWritten + 3)` cancels.
   - Reduced motion: exactly one `scrollTo({ top: 1000, behavior: 'instant' })`, no rAF.
   - A second `to(0)` while active replaces the first (final value 0).
3. `src/stage/scrollIdle.test.js` (fake timers): `scroll(0)`, `scroll(50)`, advance 159 ms → no call, 1 ms more → `onIdle(+1)`; `scroll(50)`, `scroll(20)` → `onIdle(−1)`; `scrollEnd()` fires at once; `hold('touch', true)` then advance 500 ms → no call; `hold('touch', false)` then 160 ms → one call; two holds need both released; `dispose()` cancels the timer.
4. `src/stage/controller.test.js` (rewrite; harness `H = 1000`, `trackH 2900`, `rect.top = −scrollY`, `at(y)` sets scrollY and calls `update()`, fake `glide = { to: vi.fn(), cancel: vi.fn(), active: false }`):
   1. `at(0)`: `z 0`, phase `desk`, cue `0.8`.
   2. `at(500)`: `z 0.5`, phase `dive`, `interactive` false, `os.setLive` never called with `true`, cue `0`.
   3. `at(1000)`: phase `inside`, `ui.setZoomed(true)`, `os.setLive(true)`, last `os.setFlat` call is `(true, false)`.
   4. Hysteresis: after 3, `at(990)` stays inside; `at(984)` → phase `dive`, `ui.setZoomed(false)`, `os.setLive(false)`, last `os.setFlat` `(false, false)`.
   5. `at(1420)` → `z 0.5`, `dive`; `at(1720)` → `z 0`, `desk`; `at(2500)` → `desk`.
   6. `setNarrow(true)` then `at(1000)` → last `os.setFlat` `(true, true)`.
   7. `enter()` at `scrollY 0` → `glide.to(1000)`; at `scrollY 3000` → `glide.to(1000)`; with `env.trackTop = 200, scrollY 50` (track below the top) → `glide.to(1250)`; when inside → not called; status `loading` → not called; status `unavailable` → `scrollTo({ top: trackTopDoc, behavior })` and no glide.
   8. `exit()` inside → `glide.to(0)`; in phase `desk` → not called.
   9. `goToResume()` → `glide.cancel()` then `scrollToResume('smooth')`; with `reduce` true → `scrollToResume('auto')`.
   10. `settle(+1)` at 400 → `glide.to(1000)`; at 200 → `glide.to(0)`; at 1060 / 2000 → not called; with `glide.active = true` at 400 → not called.
   11. `loading`: `at(1000)` → phase `desk`, no `setFlat(true, …)`, cue 0.8; then status `ready` and `at(1000)` → inside.
   12. `unavailable`: `ui.setRunway(true)` called once over three updates; last `os.setFlat` `(true, true)`; `os.setLive(true)`; `os.boot` called once when `os.state` is `standby`, not again after `os.state` becomes `on`; cue `0`.
   13. Resize remap: inside at `scrollY 1000`, then stage height 600 and track 1740 → `update()` calls `scrollTo({ top: 600, behavior: 'instant' })`; with track 2800 (R 1800, 5 % change) → no `scrollTo`.
   14. Invariant through the controller: for `y` from 0 to 3000 step 10, after `at(y)`: `ctrl.z > 0` implies `y ≤ 1750`.
   15. `onWheel` (ready, layout from `at(800)`): `{ deltaY: 300, deltaMode: 0, timeStamp: 0 }` → returns `true` and calls `scrollTo({ top: 1000, behavior: 'instant' })`; the next event 16 ms later → `true`, no extra `scrollTo`; status `loading` → returns `false`.
   16. The controller never calls `os.boot()` when the scene is ready (the lid boots the OS).
5. `src/stage/keys.test.js`: Esc with phase `inside` and status ready → `ctrl.exit` once; phase `dive` → once; phase `desk` → never; status `loading` → never; recruiter open → closes it and does not exit.
6. `src/stage/Stage.test.jsx`:
   - The `#hud-exit` button exists with the name "Go to résumé ↓" and calls `nav.goToResume` on click.
   - Test 9 rewritten: unmount removes every listener it added: `wheel` on `#stage`; `keydown`, `scroll`, `touchstart`, `touchend`, `touchcancel`, `pointerdown`, `pointerup`, `pointercancel` on `window` (and `scrollend` when `onscrollend` is defined; define it in one variant).
   - The `#stage` wheel listener is registered with `passive: false` (check the options argument).
   - Wiring: with a fake `ctrl` whose `onWheel` returns `true`, a cancelable `WheelEvent('wheel', { deltaY: 50, cancelable: true })` on `#stage` has `defaultPrevented` true and `app.glide.cancel` was called; with `onWheel` returning `false`, `defaultPrevented` is false.
   - Idle wiring (fake timers, `window.scrollY` defined writable): two `scroll` events with scrollY 0 then 40, advance 200 ms → `ctrl.settle(+1)`; after `touchstart` the same sequence does not call `settle` until `touchend` + 200 ms.
   - Delete tests 11, 13 and 14 (focusin/leave). Keep test 10 (pinScroll) and 12.
   - Fallback: in the no-WebGL path, after `triggerIntersection(stage, true)` and one animation frame, `#track` has class `flat-runway`.
7. `src/os/osHost.test.js`: `setLive(false)` keeps a `.wb` element's `scrollTop`; there is no `setTrap`; `setFlat(true, true)` adds `fade` to the flat host and `setFlat(true, false)` removes it; `fitFlat()` returns `k` for a non-compact flat host with stubbed `clientWidth 1440`, `clientHeight 900` (`k = 1.3333…`, `osEl.style.width = '1080px'`) and `1` for compact.
8. `src/os/osController.test.js`: `setFlat(true, false)` with a host whose `fitFlat` returns 1.5 → `store.scale === 1.5`; `setFlat(false)` → `1`; `refit()` calls `host.fitFlat` and moves an out-of-bounds window inside `host.size()`.
9. `src/styles/stage.css.test.js` and `os.css.test.js` (CSS text parsing, as the existing tests do):
   - `.track` height is `var(--track-h)`; `tokens.css` sets `--track-h: 290vh`; `290 === TRACK_VH === 100 * (1 + sum(Object.values(RUNWAY)))` (import from constants).
   - `resume.css` `#app:empty` uses `var(--track-h)`.
   - No `.trap` rule in stage.css. `.exit-pill` has `display:none`, and `.stage.zoomed .exit-pill` has `display:inline-flex`.
   - Neither `.wb` (os.css) nor `.t-out` (apps.css) declares `overscroll-behavior`.
   - `#mb-snd` is hidden only under `.os.fallback`.
10. `src/stage/structure.test.js`: `src/stage/wheel.js` does not exist; no file under `src/` imports `./wheel.js` or references `WHEEL_EXIT`, `WHEEL_GAP_MS`, `ctrl.tw`, `armed`, `suppress` or `.leave(`; `createScene.js` contains no `willChange =` assignment other than `willChange = ''`.
11. `src/scene/createScene.test.jsx`: with `app.ctrl.store` set to `{ interactive: true }` and a stage with stubbed `clientWidth`/`clientHeight`, `api.frame(0, 0.016)` records no `render` call on the renderer proxies; with `interactive: false` it records them.
12. `src/resume/Resume.test.jsx`: clicking "Open the laptop ↑" calls `nav.openLaptop` once, synchronously, and does not call `window.scrollTo`.
13. `src/app/createApp.test.js`: `app.glide` exists with `to`/`cancel`/`onScroll`; `app.ui.setRunway(true)` toggles `flat-runway` on `app.dom.track`.

**Implementation notes and pitfalls**
- jsdom has no layout: every controller test injects rects; `Stage.test` uses a fake `ctrl` where it needs specific return values. `window.scrollTo` is already a `vi.fn` from `src/test/setup.js`.
- The ticker only runs while the stage intersects the viewport. The glide must use its own rAF, because `enter()` from the résumé starts with the stage off-screen.
- Moving `osEl` out of the CSS3D holder blurs any focused element inside it. That only happens on the way in (nothing in the OS was focused) or out (leaving), so no focus restore is needed.
- While inside (flat), `frame()` must not call `os.setSize`: it writes `osEl`'s size and would fight `fitFlat`. `host.setFlat(false)` already resets the holder to 900×675; the next frame widens it again for the current `z`.
- The non-compact flat path (`fitFlat` with `scale(k)`) has never run in production (round 1 only used compact). Check window dragging uses `host.scale()` correctly (it divides by the 2D scale), the menubar and windows fit, and the wallpaper canvas sizes itself to the scaled layout.
- `scrollend` fires after both user and programmatic scrolls. Settle after a glide is a no-op because the glide targets are rest points (`settleTarget` returns `null`).
- `behavior: 'instant'` is the right value for per-frame writes; do not rely on CSS `scroll-behavior` (none is set; keep it that way).
- Remove the `Bug K` and `B8/B9/B10` comments that describe deleted behaviour; keep `Bug J` (`pinScroll`).
- Achievements that depend on entering keep working: `boot` comes from the lid passing 75 % (`lidBoot`, unchanged), `floppy` from `onInserted`, the ★ HUD opens Trophies through `openLaptop()` + the OS boot queue.

**ACCEPTANCE**
- TEST LIST green; `npm test`, `npm run lint`, `npm run build` green.
- Only one non-passive listener exists (`wheel` on `#stage`).
- `git grep -n "wheel.js\|WHEEL_EXIT\|suppress\|\.leave(" src` prints nothing.
- In `npm run dev` (smoke check by the implementer): scrolling from the top dives in, stopping mid-way settles, the pill appears inside and takes you to the résumé, Esc goes back to the closed laptop, and at no scroll position is the screen open while the stage is moving.

---

### Phase 3: Camera and laptop UX gaps

**Goal.** The dive reads well at every angle and viewport: no mirror pop, no parallax snap, no overhang, no vignette pop, the phone wide shot shows the whole desk, short landscape screens get the compact OS, and the 3D→flat swap is seamless.

**Change**
- `src/scene/sceneMath.js`
  - `perceptualE(e, d0, d1)`: `if (d0 <= d1) return e`; `inv = 1/d0 + (1/d1 − 1/d0)·e`; return `(d0 − 1/inv) / (d0 − d1)`.
  - `cameraPose({ e, aspect, sp, aPos, aN, d, reduce })`: compute `A` (wide pos with parallax, as now) and `B` (end pos); `d0 = |A − aPos|`; `k = perceptualE(e, d0, d)`; `pos = A + (B − A)·k`, `look = wl + (aPos − wl)·k`. Parallax factor stays `1 − e`.
  - `widePose(aspect)`: desktop unchanged. Narrow (`aspect < CAM_NARROW_ASPECT`): base `wp0 = [0.5, 4.4, 13.8]`, `wl = [0.1, 1.3, 0]`; `dist = |wp0 − wl|`; `halfW = tan(camFov(aspect)/2)·aspect·dist`; `k = max(1, WIDE_HALF_W / halfW)` with `WIDE_HALF_W = 3.6`; `wp = wl + (wp0 − wl)·k`. Also return `k`.
  - `fogFor(k)` → `{ near: 16·k, far: 34·k }`.
  - `widenSize(z, w, h)`: `g = ss(WIDEN_FROM, 1, z)` with `WIDEN_FROM = 0.97`; `k = min(w/OS_W, h/OS_H)` (no 0.994).
  - `screenClip(z, hw, hh)`: `open = ss(0.985, 1, z)`; `ix = max(0, (hw − BEZEL_W)/2)·(1 − open)`, `iy = max(0, (hh − BEZEL_H)/2)·(1 − open)` with `BEZEL_W = 948`, `BEZEL_H = 720`; return `''` when both are 0, else `` `inset(${round(iy)}px ${round(ix)}px)` ``.
  - `holderAlpha(le)` = `ss(0.42, 0.6, le)`.
- `src/scene/createScene.js`
  - Parallax: move pointer tracking for `pointer.x/y` to `stage` (`pointermove` and `pointerleave` on the stage element, both registered in the `listeners` list with their target so dispose removes them). The canvas `pointerleave` keeps clearing hover, drag and the tooltip, but no longer zeroes `pointer`. Normalise against `stage.getBoundingClientRect()`.
  - Holder: `const a = holderAlpha(le)`; `holder.style.opacity = a === 1 ? '' : String(a)`; `holder.style.visibility = a > 0 ? '' : 'hidden'`. When not narrow: `os.setSize(widenSize(z, w, h))` and `holder.style.clipPath = screenClip(z, curW, curH)` (use the size just set). Clear `clipPath` in dispose.
  - Fog: each frame `const f = fogFor(widePose(aspect).k)`; write `scene.fog.near/far` only when they change.
- `src/stage/useStageBindings.js`: `ctrl.setNarrow(stage.clientWidth < NARROW_PX || stage.clientHeight < SHORT_PX)` with `SHORT_PX = 480` added to constants.
- `src/styles/os.css`: `.os::after{…;opacity:1;transition:opacity .35s ease}`, `.os.live::after{opacity:0}`, `.os.flat::after{display:none}`, and `@media (prefers-reduced-motion:reduce){.os::after{transition:none}}`.

**TEST LIST**
1. `src/scene/sceneMath.test.js`
   - `perceptualE(0, 11.2, 3.09) = 0`, `(1, …) = 1`, `(0.5, 11.2, 3.09) ≈ 0.784` (3 dp), strictly increasing over 11 samples; apparent size `d1 / (d0 − (d0 − d1)·perceptualE(e))` equals `d1/d0 + (1 − d1/d0)·e` at `e = 0.25, 0.5, 0.75` (4 dp); `perceptualE(0.3, 3, 3) = 0.3`.
   - `cameraPose` at `e = 0.5` puts the camera at `A + (B − A)·perceptualE(0.5, |A − aPos|, d)` (use the existing test fixture for `aPos`, `aN`, `d`).
   - `widePose(0.462)` (390×844): `k ≈ 1.30` (2 dp) and `wp ≈ [0.62, 5.32, 17.90]` (2 dp; aspect 390/844 = 0.4621); `widePose(0.75)` returns the base pose with `k = 1`; `widePose(1.6)` unchanged from round 1.
   - Phone wide-shot coverage: for `aspect 0.462`, the visible half-width at the look distance `tan(23°)·0.462·|wp − wl|` is ≥ 3.6.
   - `fogFor(1) = {16, 34}`, `fogFor(1.3) = {20.8, 44.2}`.
   - `widenSize(0.96, 1440, 900) = {w:900, h:675}`; `widenSize(1, 1440, 900) = {w:1080, h:675}`; `widenSize(1, 2560, 1080) ≈ {w:1600, h:675}`; `widenSize(1, 1024, 1366) ≈ {w:900, h:1200.6}`; for each of these `widenSize(1, w, h)` equals `(w/k, h/k)` with `k = min(w/900, h/675)` (the flat layout).
   - `screenClip(0.96, 900, 675) = ''`; `screenClip(0.98, 1000, 675) = 'inset(0px 26px)'`; `screenClip(1, 1080, 675) = ''`; `screenClip(0.9925, 1060, 760)` has both insets > 0 and smaller than at `0.985`.
   - `holderAlpha(0.42) = 0`, `holderAlpha(0.6) = 1`, monotonic between.
2. `src/scene/createScene.test.jsx`
   - A `pointermove` and a `pointerleave` listener are added to the `stage` element and removed by `dispose()`.
   - After `dispose()`, `holder.style.opacity`, `visibility` and `clipPath` are `''`.
3. `src/styles/os.css.test.js`: `.os::after` has a `transition` on `opacity`; `.os.live::after` sets `opacity:0` and does not use `display:none`; a reduced-motion block sets `.os::after{transition:none}`.
4. `src/stage/Stage.test.jsx`: a resize to `{ width: 844, height: 390 }` sets `narrow` true; `{ width: 1280, height: 720 }` sets it false.

**Implementation notes and pitfalls**
- `screenClip` takes the holder size in OS px. `clip-path` on the CSS3D element is applied in its local box before the 3D transform, which is what we want.
- `holder.style.opacity < 1` creates a stacking context; the holder has no 3D children, so nothing else changes.
- Removing `will-change` (phase 2) means Chrome re-rasterises the 3D DOM during the dive. That is the price of sharpness; inside, the OS is flat and static.
- The parallax target now keeps tracking while the cursor is over the DOM screen, so moving from the desk onto the screen no longer snaps the camera.
- Keep the hover tooltip and glow gates at `z < 0.9` and the drag-yaw gate at `z < 0.5`.

**ACCEPTANCE**
- TEST LIST green; `npm test`, `npm run lint`, `npm run build` green.
- Visual check by the implementer in `npm run dev` at 1440×900: the screen fades from the drawn mirror into the real OS (no single-frame pop), the DOM never overhangs the bezel, the vignette fades, and the swap to the flat OS at the end of the dive is not visible.

---

### Phase 4: McGill mug, playful props, floppy drive slot

**Goal.** The red mug carries a white "McGill" wordmark in EB Garamond and faces the camera, with a proper C-handle; props react to hover; the lid peeks open on hover; floppies visibly slide into a slot on the front of the laptop. Everything respects reduced motion.

**Change**
- `index.html`: add `family=EB+Garamond:wght@500` to the existing Google Fonts URL (same `<link>`).
- `src/scene/props.js` (extend):
  - `MUG = { pos: [-2.3, 0, 0.85], rTop: 0.19, rBot: 0.17, h: 0.44, segs: 48, inner: { rTop: 0.175, rBot: 0.158, h: 0.43, color: 0xc41526 }, coffeeY: 0.38, color: 0xed1b2f, handle: { R: 0.105, tube: 0.028, arc: Math.PI, center: [0.19, 0.225, 0], rotZ: -Math.PI / 2, scaleY: 1.05 }, lift: 0.06, label: { w: 1024, h: 400 } }`.
  - `mugRadiusAt(y)` = `rBot + (rTop − rBot)·y/h`.
  - `handleEnds(handle)` → the two arc end points in mug-local XY after the rotation: `[center.x, center.y − R·scaleY]` and `[center.x, center.y + R·scaleY]`; `handleBulgeX(handle)` = `center.x + R`.
  - `faceAngle(from, to)` = `atan2(to.x − from.x, to.z − from.z)` (rotation about y that turns local +z toward `to`).
  - `SLOT = { x: 0.95, y: 0.085, z: 1.05, w: 0.56, h: 0.036, frame: [0.62, 0.06, 0.012], eject: [1.32, 0.085], led: [0.6, 0.085] }` (base-local; the base group sits at rig z 0.35).
  - `PEEK = 7 * DEG`.
- `src/scene/floppy.js`: replace `OUT/IN/DRIVE` with `LANE_Y = 0.13`, `LANE_Z = 1.75`, `APPROACH = { x: 0.95, y: 0.085, z: 1.75 }`, `SEATED = { x: 0.95, y: 0.085, z: 1.19 }` (rig coords; front face at rig z 1.4, floppy half depth 0.26, 0.05 left sticking out). Insert: `home → LIFT { x: home.x, y: LANE_Y, z: home.z } (0.15 s) → LANE { x: home.x, y: LANE_Y, z: LANE_Z, r.y 0 } (0.25 s) → APPROACH (0.3 s) → SEATED (0.35 s) → onInserted`. Eject the floppy in the drive first: `SEATED → APPROACH (0.25 s) → LANE at its home x (0.25 s) → LIFT above its home (0.2 s) → home with its home rotation (0.15 s)`. The vertical lift keeps a floppy from sliding sideways through the pile; dropping back onto a spot that another floppy partly covers can clip for ~0.15 s (accepted; the round-1 path clipped too). The reopen rule is unchanged.
- `src/scene/textures.js`: `drawMugLabel(x, w, h)`: fill `#ED1B2F` over the whole canvas; `textAlign 'center'`, `textBaseline 'middle'`, `fillStyle '#FFFFFF'`; start at `size = 150` and shrink by 2 px until `measureText('McGill').width ≤ 0.3·w` (or `size` reaches 60); `font = `500 ${size}px "EB Garamond", Garamond, "Times New Roman", serif``; `fillText('McGill', w/2, h·0.5)`.
- `src/scene/sceneMath.js`: `approach(cur, target, dt, rate)` = `target + (cur − target)·exp(−rate·dt)`; `wiggle(t, amp)` = `amp·sin(t·0.014)` (t in ms); `stepSteam(y, v, dt)` → rises from `STEAM_Y0 = 0.45` to `STEAM_Y1 = 0.85` and wraps to `STEAM_Y0`; `peekTarget({ hovered, z, reduce })` → `!reduce && hovered && z < 0.02 ? PEEK : 0`.
- `src/scene/createScene.js`
  - `export const CANVAS_FONTS` (exported for tests) gains `'500 64px "EB Garamond"'`; `redrawText` includes the mug label.
  - Mug: outer group `mug` at `MUG.pos` (the hop tween moves it), `mug.rotation.y = faceAngle({x:-2.3,z:0.85}, {x: widePose(16/9).wp[0], z: widePose(16/9).wp[2]})` (≈ 0.377 rad); inner group `mugBody` (hover lift) holds: outer wall `CylinderGeometry(rTop, rBot, h, 48, 1, true, Math.PI, Math.PI * 2)` with `MeshStandardMaterial({ map: mugLabel.t, color: 0xffffff, roughness: 0.35 })` at `y = h/2`; inner wall (`side: THREE.BackSide`, `inner.color`); rim `RingGeometry(inner.rTop, rTop, 48)` rotated `−π/2` about x at `y = h`; bottom `CircleGeometry(rBot, 48)` rotated `−π/2` at `y = 0.002`; coffee `CircleGeometry(inner.rTop − 0.003, 32)` at `coffeeY`, colour `0x3b2314`; handle `TorusGeometry(R, tube, 12, 24, arc)` red, `rotation.z = rotZ`, `scale.y = scaleY`, at `center`. Steam: `THREE.Points` of 18 particles (`PointsMaterial({ color: 0xffffff, size: 0.05, transparent: true, opacity: 0, depthWrite: false })`) as a child of `mugBody`, x/z jittered within ±0.06. Keep `addHot(mug, 'McGill mug')`; the hop keeps working on the outer group.
  - Floppies: each floppy becomes a `Group` (tweened, carries `userData.hot`) holding its mesh (wiggled). `FLOPPIES.map` returns `{ ...f, m: group, mesh, lab }`.
  - Drive: delete the side strip `(1.506, 0.08, 0.55)` and the side drive LED. Add on the base front face: frame box `SLOT.frame` colour `0x9aa3ad` at `(SLOT.x, SLOT.y, SLOT.z + 0.001)`; mouth box `[SLOT.w, SLOT.h, 0.008]` colour `0x05070a`, `roughness 1`, at `z = SLOT.z + 0.006`; eject button `B(0.06, 0.02, 0.01)` at `(eject[0], eject[1], SLOT.z + 0.006)`; drive LED `B(0.06, 0.018, 0.008)` at `(led[0], led[1], SLOT.z + 0.006)` (same emissive logic as now).
  - Per frame (all lerps use `approach`, rates: lift 12, steam 4, lamp 6, peek 10; with reduced motion every target is applied at once and lift, wiggle, steam and peek targets are 0):
    - `mugBody.position.y = lift` toward `hover === mug ? MUG.lift : 0`; `steamLevel` toward `1` while hovered or for 2.5 s after a hop, else `0`; steam `opacity = 0.35·steamLevel`; particles advance with `stepSteam` only while `steamLevel > 0.01`.
    - Hovered floppy that is not in the drive and has no running tween: `mesh.rotation.z = wiggle(t, wamp)` with `wamp` toward `0.06`; others ease back to 0.
    - Lamp: `setLamp(v)` sets targets (`lampL 1.5/0`, `hemi 0.55/0.18`, bulb colour `0xffe2b0/0x3a3328` lerped); achievements and sound unchanged (fire on the toggle, not on the ease).
    - Lid peek: `peek` toward `peekTarget({ hovered: hover === hinge, z, reduce })`; `hinge.rotation.x = hingeAngle(le) − peek`. `lidBoot` and `holderAlpha` keep using `le` (unaffected by the peek).
- `src/scene/hotspots.js`: the mug action also calls `local.steam(2.5)`; add `steam` to the documented `local` shape.

**TEST LIST**
1. `src/scene/props.test.js`
   - Handle: both `handleEnds` satisfy `|x − mugRadiusAt(y)| ≤ tube + 0.01` (attached to the wall), the ends are ≥ 0.18 apart vertically and inside `[0.05, h − 0.05]`, and `handleBulgeX ≥ mugRadiusAt(center.y) + 0.08` (sticks out in +x).
   - `faceAngle({x:-2.3,z:0.85}, {x:1.4,z:10.2}) ≈ 0.377` (3 dp); `faceAngle({x:0,z:0}, {x:0,z:1}) = 0`; `faceAngle({x:0,z:0}, {x:1,z:0}) ≈ π/2`.
   - Slot: `SLOT.w ≥ 0.5 + 0.04` (the floppy fits); `SLOT.y − SLOT.h/2 ≥ 0` and `SLOT.y + SLOT.h/2 ≤ 0.16` (inside the base height); `SLOT.x ± SLOT.w/2` within `[−1.5, 1.5]` and clear of the power LED at `x −1.1`.
2. `src/scene/floppy.test.js` (recording `tween`): insert floppy 0 records, in order, poses `{x:2.15, y:0.13, z:0.75}`, `{x:2.15, y:0.13, z:1.75}` (r.y 0), `APPROACH`, `SEATED`, then `onInserted(f)` exactly once; with floppy 1 already in the drive, inserting floppy 0 also records for floppy 1 `APPROACH`, `{x:2.32, y:0.13, z:1.75}`, `{x:2.32, y:0.13, z:1.08}`, then home `{2.32, 0.048, 1.08}` with `r.y −0.2`; inserting the floppy already in the drive calls `onReopen` and records no tween. `SEATED.z + 0.26 − 1.4` is `0.05` (2 dp). Base clearance: for every consecutive pair of recorded poses, sampled at 20 points along the straight segment, the floppy footprint (`x ± 0.25`, `z ± 0.26`) never overlaps the base footprint (`|x| ≤ 1.5`, `z ≤ 1.4`) unless that sample is on the final `APPROACH → SEATED` segment (where `x = 0.95` and `y = SLOT.y`). Every `home ↔ LIFT` segment is vertical (same x and z).
3. `src/scene/textures.test.js` `drawMugLabel` (fake canvas whose `measureText` returns `width = text.length · size · 0.5`): the first recorded fill is `fillRect(0, 0, 1024, 400)` with `fillStyle #ED1B2F`; exactly one `fillText` with `'McGill'` at `(512, 200)`; the font set before it contains `"EB Garamond"` and `500`; the final `measureText('McGill').width ≤ 307.2`; `fillStyle` is `#FFFFFF` at the `fillText`.
4. `src/scene/sceneMath.test.js`: `approach(0, 1, 0, 10) = 0`; `approach(0, 1, 1, 10) ≈ 1` (4 dp); `approach(1, 0, 0.1, 6) ≈ exp(−0.6)`; `wiggle(0, 0.06) = 0`, `|wiggle(t, 0.06)| ≤ 0.06`; `stepSteam(0.84, 1, 0.1)` wraps to `0.45`; `peekTarget({hovered:true, z:0, reduce:false}) = 7°` in rad, `0` when `z ≥ 0.02`, when not hovered, or with `reduce`.
5. `src/scene/createScene.test.jsx`: `CANVAS_FONTS` includes `'500 64px "EB Garamond"'`; `document.fonts.load` is called with it; a `TorusGeometry` is constructed with a 5th argument `Math.PI`; a `CylinderGeometry` is constructed with `openEnded` true and `thetaStart` `Math.PI`; the api still disposes every texture (count includes the mug label).
6. `src/scene/hotspots.test.js`: the McGill mug action calls `local.hopMug`, `local.steam(2.5)`, shows the same toast and plays the tone.
7. `src/stage/structure.test.js`: `index.html`'s font link contains `EB+Garamond`.

**Implementation notes and pitfalls**
- The fake canvas may not implement `measureText`; extend `src/test/fakeCanvas.js` to return `{ width: text.length * fontPx * 0.5 }` parsed from the current `font` (record the call as usual). Keep existing tests green.
- CylinderGeometry UVs: `u = 0` at `thetaStart`. With `thetaStart = π` the canvas centre (`u = 0.5`) lands at `θ = 2π`, which is local +z. Viewed from +z, `u` increases to the right, so the text is not mirrored. Confirm with a screenshot.
- The material colour must be `0xffffff` so the canvas red is exactly `#ED1B2F` (sRGB encoding on the texture, as `canvasTex` already does).
- The old top cap hid the coffee: the open cylinder plus rim fixes that.
- Mug lift goes on `mugBody`, wiggle on the floppy `mesh`: the existing tweens write the outer objects' position and rotation and would otherwise overwrite these effects.
- Keep the mug clear of the floppy lane (`x 0.95–2.6, z 1.4–2.0`) and the screen rectangle; its position does not change.
- Trademark note from r2-explore-mcgill: the owner chose text only, no crest. Do not add any crest or shield.

**ACCEPTANCE**
- TEST LIST green; `npm test`, `npm run lint`, `npm run build` green.
- In `npm run dev`, from the 1440×900 wide shot: "McGill" reads on the front of the mug in a Garamond face after fonts load, the handle is a C on the right side, coffee is visible; hovering the mug lifts it and steams; hovering a floppy wiggles it; the lamp eases; hovering the closed lid peeks it open; inserting a floppy shows it sliding into the slot on the front of the laptop with its edge left sticking out, then the dive starts. With reduced motion on, none of the hover animations run and the lamp switches instantly.

---

### Phase 5: High-resolution project images

**Goal.** Project screenshots are sharp at every OS scale and DPR, the project window shows the whole screenshot, and the résumé uses the same image set.

**Add**
- `design/img/originals/` restored from git (byte-identical, so no repo growth). Run from the worktree root:
  ```
  mkdir -p design/img/originals
  for pair in RecycleWise:recyclewise WhenAreYouFree:whenareyoufree Duonosaur:duonosaur MenuLens:menulens \
              MarletNests:marletnests adStar:adstar HTTP:http Library:library; do
    git show "4ad01f3^:public/images/${pair%%:*}.png" > "design/img/originals/${pair##*:}.png"
  done
  ```
  Check with `sips -g pixelWidth -g pixelHeight` that the sizes match the table in r2-explore-images.md (for example `recyclewise.png` 3356×1798).
- `src/content/imagePlan.js` (pure, browser-safe, no `node:` imports; the script imports it as `../src/content/imagePlan.js`, the same way it already imports `../src/lib/png.js`): `WIDTHS = [640, 1280, 1920]`; `planWidths(naturalW, widths = WIDTHS)` → the widths `≤ naturalW`, or `[naturalW]` when `naturalW < widths[0]`; `srcSetFrom(files)` → `"url 640w, url 1280w"`; `sizesFor(kind, { compact, scale })` → `shot`: compact `'calc(100vw - 52px)'`, else `` `${Math.ceil(560 · scale)}px` ``; `thumb`: compact `'calc(50vw - 30px)'`, else `` `${Math.ceil(200 · scale)}px` ``. Re-export from `src/content/index.js`.
- `src/content/projectImages.js` (generated by the script, committed, with a "generated, do not edit" header): `export const PROJECT_IMAGES = { recyclewise: { w: 3356, h: 1798, files: [[640, '/img/projects/recyclewise-640.webp'], [1280, …], [1920, …]] }, … }`, one entry per `PROJECTS[i].image`.

**Change**
- `scripts/optimize-images.mjs`: the source for each project is `design/img/originals/<name>.png` (fallback `design/img/<name>.jpg` when no original exists: only joblog when its capture failed). For each width in `planWidths(meta.width)`: `sharp(src).resize({ width, withoutEnlargement: true }).webp({ quality: 82, effort: 6, smartSubsample: true })` to `public/img/projects/<name>-<width>.webp`. Delete `public/img/projects/<name>.webp` (the old 420 px files) and any stale `<name>-*.webp` not in the plan. Write `src/content/projectImages.js` with natural `w`/`h` and the files. `--placeholder <name>` writes the placeholder at 1280 wide (nearest-neighbour upscale) through the same plan. `jay.jpg` handling stays as is.
- `scripts/capture-joblog.sh`: capture with `--window-size=1280,800 --force-device-scale-factor=2` to `design/img/originals/joblog.png` (2560×1600) when the capture succeeds, then run `node scripts/optimize-images.mjs`; on failure keep the existing `design/img/joblog.jpg` (best available) and still run the optimizer. Do not overwrite `design/img/joblog.jpg`.
- Run `npm run assets:joblog` (or, if Chrome is not available, `npm run assets:images`), commit the new WebPs and the manifest.
- `src/content/projects.js`: `projectImage(p)` returns the smallest file (used by `Bin.jsx` and as `src` fallbacks); add `projectSrcSet(p, maxW = Infinity)` (files `≤ maxW`), `projectDims(p)` → `{ w, h }`, `projectFull(p)` (largest file). Export through `src/content/index.js`.
- `src/os/apps/ProjectDetail.jsx`: `const { scale, compact } = useStore(app.os.store, (s) => ({ scale: s.scale, compact: s.compact }))` (use two selectors or a shallow-equal selector to avoid re-renders); render
  `<a className="shot-link" href={projectFull(p)} target="_blank" rel="noopener noreferrer" aria-label={'Open the ' + p.title + ' screenshot full size'}><img className="shot" src={projectImage(p)} srcSet={projectSrcSet(p)} sizes={sizesFor('shot', { compact, scale })} width={w} height={h} alt={p.title + ' screenshot'} decoding="async" /></a>`.
- `src/os/apps/Projects.jsx`: thumbnails use `srcSet={projectSrcSet(p, 1280)}`, `sizes={sizesFor('thumb', …)}`, `width`/`height` from `projectDims`.
- `src/resume/Resume.jsx` `ProjectCard`: `srcSet={projectSrcSet(p, 1280)}`, `sizes="(max-width: 600px) calc(100vw - 48px), 560px"`, `width`/`height` from `projectDims` (drop `IMG_W`/`IMG_H` if unused).
- `src/styles/apps.css`: `.shot{display:block;width:100%;height:auto;max-height:440px;object-fit:contain;background:#E9EEF3;border:2px solid #122030;margin-bottom:14px}`; `.shot-link{display:block;cursor:zoom-in}`; `.pcard img` keeps `aspect-ratio:16/10;object-fit:cover;object-position:top`.
- `README.md`: the assets section explains `design/img/originals/`, the widths and the manifest.

**TEST LIST**
1. `src/content/imagePlan.test.js`: `planWidths(3356) = [640, 1280, 1920]`; `planWidths(1772) = [640, 1280]`; `planWidths(704) = [640]`; `planWidths(420) = [420]`; `srcSetFrom([[640,'a'],[1280,'b']]) = 'a 640w, b 1280w'`; `sizesFor('shot', {compact:false, scale:1.3333}) = '747px'`; `sizesFor('shot', {compact:true}) = 'calc(100vw - 52px)'`; `sizesFor('thumb', {compact:false, scale:2.1333}) = '427px'`.
2. `src/content/content.test.js`: every project's `image` has a `PROJECT_IMAGES` entry; every listed file exists under `public/` (node `fs`); widths are strictly ascending and `≤ w`; for every project with an original wider than 1280, the largest file is ≥ 1280 wide; `projectImage(p)` is the first file; `projectFull(p)` the last; `projectSrcSet(p, 1280)` has no `1920w`; no file named `/img/projects/<name>.webp` (old naming) is referenced anywhere in `src/`.
3. `src/os/apps/apps.test.jsx` ProjectDetail: with `os.store.scale = 1.3333` and not compact, the img has `sizes="747px"`, a `srcset` containing `640w` and (for RecycleWise) `1920w`, `width="3356"`, `height="1798"`, and sits inside a link to the largest file with `target="_blank"` and `rel` containing `noopener`; with `compact` true, `sizes="calc(100vw - 52px)"`. Projects grid: each thumbnail `srcset` lacks `1920w` and has `sizes="200px"` at scale 1.
4. `src/resume/Resume.test.jsx`: each project image has `srcset`, `sizes` starting with `(max-width: 600px)`, and numeric `width`/`height`. The prerendered HTML (`scripts/prerender.test.mjs` or `entry-server.test.jsx`) contains `srcset=`.
5. `src/styles/apps.css.test.js`: `.shot` declares `object-fit:contain` and no `object-fit:cover`; `.shot` has no `max-height:250px`.
6. `src/stage/structure.test.js`: `design/img/originals/` contains the 8 PNGs (plus `joblog.png` only if present); `public/img/projects/` contains no file without a `-<width>` suffix.

**Implementation notes and pitfalls**
- `sizes` ignores CSS transforms; that is why it is computed from the OS scale (R15). In 3D mid-dive the scale is 1 and the image is small on screen anyway.
- Phase 2 already removed `will-change` and made the inside flat, which is the other half of the blur fix. Check in the browser at DPR 1 and DPR 2 that the RecycleWise detail is crisp at 1440×900 and at 2560×1080.
- Duonosaur is portrait (704×1538): it gets only the 640 file, and `object-fit: contain` with `max-height: 440px` shows it whole with side bands.
- Do not delete `design/img/*.jpg`: `design/revamp-lab.html` uses them.
- Keep the generated manifest formatted (2-space JSON-like literal) so lint passes; the generator writes it with a trailing newline.

**ACCEPTANCE**
- TEST LIST green; `npm test`, `npm run lint`, `npm run build` green.
- `public/img/projects/` has 640/1280/1920 files as planned; total size reported by the script (expected roughly 1–2.5 MB for all files; each 1920 file under ~300 KB).
- Opening a project window shows the whole screenshot, sharp at 1440×900 (DPR 2) and 2560×1080 (DPR 1).

---

## 4. Files touched per phase (quick index)

| Phase | Add | Delete | Main changes |
|---|---|---|---|
| 1 | `src/scene/props.js`, `props.test.js` | `src/os/apps/paint/*`, `VisitorWall.*`, `Art.jsx`, `src/wall/*`, `src/test/fakeSupabase.js`, `supabase/` | registry, osController, DesktopIcons, commands, achievements, pixelIcons, png, textures, hotspots, createScene, createApp, AboutOs, Resume footer, package.json, vite/eslint config, .env.example, README, plan.md note, tests (13 → 12) |
| 2 | `stage/runway.js`, `glide.js`, `scrollIdle.js`, `ExitPill.jsx` (+ tests) | `stage/wheel.js`, `wheel.test.js` | controller (rewrite), useStageBindings, keys, Stage, createApp, osHost, osController, createScene (no will-change, no render inside), constants, tokens/stage/resume/os/apps CSS, Resume openLaptop, README |
| 3 | — | — | sceneMath (perceptual dive, phone pull-back, fog, widen, clip, alpha), createScene (stage parallax, crossfade, clip, fog), useStageBindings (short screens), os.css vignette |
| 4 | — | — | props (mug, slot, peek), floppy (new path), textures (mug label), sceneMath (approach, wiggle, steam, peek), createScene (mug, steam, hover, lamp ease, slot), hotspots (steam), index.html font, fakeCanvas `measureText` |
| 5 | `design/img/originals/*.png`, `src/content/imagePlan.js`, `src/content/projectImages.js` (+ tests) | `public/img/projects/<name>.webp` (420 px) | optimize-images, capture-joblog, projects.js, ProjectDetail, Projects, Resume, apps.css, README |

---

## 5. Risks and how they are contained

- **Detent heuristics on unusual hardware** (Windows precision touchpads, Magic Mouse). The detent only blocks the remainder of one burst that crossed into the plateau from above; the worst case is one extra gesture to continue. Tested as a pure reducer; checked in the browser pass.
- **Chrome smooth-scroll lag** makes `scrollY` trail the wheel deltas; handled by the burst `start` rule (a burst that began above the plateau and is already past it snaps back).
- **Flat swap mismatch** if `widenSize` and `fitFlat` ever diverge. A unit test pins them equal for four viewports.
- **Safari without `scrollend`**: settle falls back to a 160 ms idle timer, and the glide aborts on any foreign scroll, so a held scrollbar drag cannot be fought for more than one frame.
- **Mobile toolbar** changes `100dvh`; `R` is measured each frame and remaps only on > 15 % changes, so normal toolbar motion never triggers a programmatic scroll.
- **Rendering cost of scroll-linked 3D**: unchanged from round 1 on the desk; cheaper inside (no WebGL render).

---

## 6. Browser UX checklist (final Chrome pass, after phase 5)

Run `npm run build && npm run preview`. For each viewport: **1440×900, 1280×720, 2560×1080, 1024×1366, 390×844** (390×844 with touch emulation and DPR 3; 1440×900 also at DPR 2). Use DevTools device toolbar for the sizes. Record any failure with viewport, input and scroll position.

**A. Invariant (every viewport, every input below)**
- [ ] At no time is the laptop screen open (or the flat OS shown) while the stage is moving or the résumé is visible below it. Specifically scroll slowly through `s ≈ 1.7–2.0 H`: the lid is closed before the stage starts to move.
- [ ] When the stage scrolls away, the scene shows the wide desk shot with the lid closed.

**B. Mouse wheel (notched)**
- [ ] From the top, wheel down: the lid opens and the camera dives smoothly with each notch; nothing jumps.
- [ ] Spin fast from the top: the dive stops inside (detent); the next spin after a pause continues and steps out.
- [ ] Inside, wheel over a long window (Experience.log, a project): the window scrolls; spinning on at its end does not move the page until a pause; a new spin then moves the page and, after about one notch, the camera steps out.
- [ ] Inside, wheel over the wallpaper/menubar: about one notch of no visible change, then the camera steps out.
- [ ] Wheel up from the résumé: the stage comes back closed, then opens and closes again on the way to the top (no detent upward; accepted).

**C. Trackpad (many small deltas with momentum; macOS Chrome and Safari)**
- [ ] Slow two-finger drag: camera follows 1:1, direction matches the system's natural-scroll setting.
- [ ] Flick from the top: momentum stops inside the laptop, not in the résumé.
- [ ] Release mid-dive at ~20 %: settles closed; at ~40 % while scrolling down: settles open; at ~60 % while scrolling up: settles closed. The settle never moves while fingers are on the pad.
- [ ] Momentum inside a window never spills into the page.

**D. Keyboard**
- [ ] Focus on the page body. Space and PageDown from the top: mid-dive, then it settles open. Again: closed wide shot. Again: résumé.
- [ ] Shift+Space / PageUp reverse that. ArrowDown/ArrowUp step the dive finely. Home: closed laptop at the top. End: résumé end, laptop closed.
- [ ] Inside: Esc goes back to the closed laptop at the top. Esc with the recruiter view open only closes the view.
- [ ] Inside, type in the terminal: Space types a space and does not scroll. The 3D keyboard keys still press on the desk view.

**E. Scrollbar**
- [ ] Drag the thumb slowly through the dive: camera follows. Hold still mid-dive without releasing: nothing moves. Release: it settles.
- [ ] Click the scrollbar track below the thumb repeatedly: page jumps; the invariant holds.

**F. Find in page**
- [ ] From the top, Cmd/Ctrl+F a word that is only in the résumé (for example a role title): the page jumps to the résumé with the laptop closed.
- [ ] Inside, find a word in an open window: the window scrolls to it; the stage does not move.

**G. Tab**
- [ ] From the top, Tab through the HUD buttons: the page does not dive. Tab on into the résumé: the page jumps there with the laptop closed.
- [ ] Inside, Tab through the OS and past its last control: focus lands on "Go to résumé ↓", then on the résumé, and the laptop closes as the page moves.
- [ ] Skip link ("Skip to résumé") from the top: goes to the résumé and focuses its heading.
- [ ] "Open the laptop ↑" in the résumé glides up and lands inside.

**H. Buttons and clicks**
- [ ] Click the laptop, a floppy, the polaroid, the sticky note, the dog tags, ★ in the HUD: each glides in and opens the right app after boot.
- [ ] "Go to résumé ↓" appears only inside, sits bottom-right without hiding the menubar or the clock, and lands on the résumé with focus on the heading.
- [ ] ⏏ Close laptop, Shut Down…, terminal `exit` and `shutdown` all end at the closed laptop at the top.

**I. Resize mid-dive**
- [ ] At 1440×900, stop inside, resize to 1280×720 and back: still inside, flat OS refits, windows stay on screen.
- [ ] Mid-dive (before settling), resize the height by half: the dive progress is kept (same fraction), then it settles.
- [ ] Rotate 390×844 to 844×390: the OS is compact (short screen), still fills the screen.

**J. Camera and laptop polish (each viewport)**
- [ ] Wide shot: the whole desk with mug, plant, lamp and floppies is in frame (390×844 and 1024×1366 included). No void at the edges on 2560×1080.
- [ ] Lid opening: the screen fades from the drawn mirror into the real OS; no single-frame pop.
- [ ] Cursor moves from the desk onto the screen: the camera parallax keeps easing, no snap to centre.
- [ ] End of the dive: the OS never hangs past the black bezel; the swap to the flat OS is not visible; the vignette fades rather than popping.
- [ ] Inside at 1440×900 DPR 2 and 2560×1080: OS text and the RecycleWise screenshot are crisp; the project window shows the whole screenshot; the screenshot link opens the full-size file.
- [ ] Phone (390×844): 3D dive, then the compact OS with a short fade; swiping on the wallpaper steps out; windows scroll with touch.

**K. McGill mug and extras**
- [ ] "McGill" reads in a Garamond face on the front of the red mug from the wide shot, in white, after fonts load (reload with cache disabled to see the font swap redraw). Handle is a C on the right. Coffee visible.
- [ ] Hover: mug lifts and steams; floppies wiggle; lamp eases on/off when clicked; the closed lid peeks open a few degrees and closes when the cursor leaves.
- [ ] Insert each floppy: it travels in front of the laptop and slides into the front slot, leaving its edge out; inserting another ejects the first back home without passing through anything.

**L. Reduced motion (DevTools > Rendering > prefers-reduced-motion: reduce)**
- [ ] Parallax, hover lift, steam, wiggle, lid peek: none. Lamp switches instantly. Vignette and flat-host fade: instant.
- [ ] Settle, `enter()`, `exit()`, detent snap: instant jumps, no glide. The dive itself still follows the scroll.

**M. No WebGL (launch Chrome with `--disable-webgl` or DevTools > Rendering > disable WebGL)**
- [ ] The notice shows; the flat compact OS is live and boots on its own; the track is not pinned (the page scrolls straight to the résumé after one screen); windows scroll; wheel over the wallpaper scrolls the page; the HUD sound button works.

**N. Removals**
- [ ] No Paint or Visitor Wall icon, command (`paint`, `wall`), window or toast. Trophies show 12. No corkboard; the polaroid with tape is on the wall and opens About. No "Inspired by" text anywhere (résumé footer, About JAY-OS). No network request to Supabase in the Network panel.

---

## 7. UX-pass fix round

Inputs: the real-browser pass after phase 5 (headless Chrome over CDP; findings F1–F9 and three nits, all reproduced) and the owner's final decisions A (fast flicks always stop at the open laptop, using the browser's native scroll snapping) and B (a mid-dive or mid-out rest glides on in the direction of the last user scroll; only a tiny movement returns; programmatic scrolls never count as user direction). Base: HEAD `fcf9637` (phases 1–5 committed). Line numbers are hints; search by symbol.

Same build loop as phases 1–5 (Haiku test-writer, Opus implementer, Haiku reviewer against ACCEPTANCE). Every phase ends with `npm test`, `npm run lint`, `npm run build` green. Three phases: **6A** scroll snapping, settle direction, plateau minimum, remap direction, cue; **6B** OS and layout fixes; **6C** scene nits.

| Finding | Severity | Fixed in |
|---|---|---|
| F1 trackpad/precision flicks fly through the plateau (latched wheel: only the first event is cancelable) | high | 6A (U1–U5) |
| F2 Projects and Recycle Bin thumbnails thousands of px tall (`aspect-ratio` without `height:auto`) | high | 6B (U14) |
| F3 settle ratchet: slow notches, ArrowDown taps, 200 px swipes pulled back (SETTLE_BIAS 0.3) | medium | 6A (U6, U7) |
| F4 window scroll positions lost when the OS is re-parented (R9 unmet) | medium | 6B (U10) |
| F5 no-WebGL: HUD over the menubar clock and maximized title bars; notice over window content | medium | 6B (U11) |
| F6 Esc with the ◆ menu open closes the laptop | low | 6B (U12) |
| F7 "Go to résumé ↓" pill covers window content on phone/short screens | low | 6B (U13) |
| F8 resize mid-dive settles the wrong way (the remap's own scrollTo counted as direction) | low | 6A (U7) |
| F9 1280×720 plateau (86 px) shorter than one 100 px notch | low | 6A (U8) |
| Nit: hovered mug reads pinker | nit | 6C (U15) |
| Nit: scroll cue reappears in the tail | nit | 6A (U9) |
| Nit: dog-tag and floppy hit targets tiny | nit | 6C (U16) |

### 7.1 Snap experiment (run for this plan, 2026-10-19)

**Setup.** A throwaway page outside the repo reproduced the runway: `290vh` track, sticky `100dvh` stage, `diveEnd = round(R/1.9)`, a 40-paragraph résumé plus footer in `#resume-root`. Chrome 155.0.8059.85, `--headless=new`, 1440×900, DPR 1, so `H 900, R 1710, diveEnd 900, insideEnd 1008, outEnd 1548`, résumé start 2610. Inputs over CDP: `Input.synthesizeScrollGesture` with `gestureSourceType:'mouse'` (phased wheel, **no momentum**: on macOS headless the synthetic touchpad gesture never produces an inertial phase, so it models a long two-finger drag) and with `gestureSourceType:'touch', preventFling:false` (finger flick **with momentum**: Chrome's fling, which goes through the same snap-fling path as trackpad momentum); `Input.dispatchMouseEvent` `mouseWheel` 100 px notches; `Input.dispatchKeyEvent`; programmatic `scrollTo`, `scrollIntoView`, `location.hash`. The result is `scrollY` after 800 ms without change. The prototype, profile and logs were deleted afterwards; no screenshots were taken.

**Configurations** (all on `html`):
- N: no snapping (native reference).
- A: `mandatory`; targets at 0, at `diveEnd` (`scroll-snap-stop:always`) and the résumé start.
- B: `proximity`, same targets.
- C: `mandatory`; `body` as one covering snap area plus the plateau stop.
- D: `mandatory`; the track and `#resume-root` (with `scroll-margin-top:100vh`) as covering areas plus the plateau stop. E: like D with two JS-sized covering areas. G: D with a normal (not `always`) plateau point.
- F: `proximity`; the plateau stop only.
- **J: `mandatory`; a rail of 1 px start-aligned markers every 8 px from 0 to the track bottom, the plateau stop (`always`), `#resume-root` as a covering area.** K: J with a 16 px grid. P: J with a 40 px grid. M: J with `proximity`. L: J without the `#resume-root` area.

**Results** (final `scrollY`; "exact" = equal to N within 2 px):

| Input (native end) | N | A | C | D | F | **J** | M |
|---|---|---|---|---|---|---|---|
| touch flick with momentum from the top (≈1800–1850) | 1845 | 900 | 900 | 900 | 1819 | **900** | 1928 |
| 100 px notches 0.7 s apart from the top (100, 200, …) | 100…1200 | 0 after every notch | 0 every notch | 0 every notch | 100…500, then 900 | **96, 192, …, 1152** | as J |
| touch drag 200 px from 300 (≈500) | 507 | 0 | 0 | 0 | 508 | **504** | 496 |
| rest after an instant scrollTo to 450 / 1208 / 1910 / 3310 | exact | 0 / 900 / 2610 / 3310 | 900 / 1208 / 1910 / 3310 | 900 / 901 / 1710 / 3310 | 450 / 1208 / 1910 / 3310 | **448 / 1208 / 1912 / 3310** | as J |
| one notch down from the plateau (1000) | 1000 | 900 (stuck) | 1000 | 901 (stuck) | 900 (stuck) | **1000** | 1000 |
| ArrowDown ×3 from the top (40, 80, 120) | 40 80 120 | 900 2610 2650 | 900 940 980 | 900 901 1710 | 40 80 120 | **8 16 24** | 8 16 24 |
| JS `scrollBy({top:40, behavior:'smooth'})` ×3 | — | — | — | — | — | **40 80 120** | 40 80 120 |
| PageDown ×4 from the top | 860 1720 2580 3440 | 900 2610 3470 4330 | 900 1760 2620 3480 | 900 1710 2610 3470 | 900 1760 2620 3480 | **856 900 1760 2620** | as J |
| 12 notches 30 ms apart from the top (1200) | 1200 | 900 | 1155 | 901 | 1213 | **1200** | 1200 |
| phased wheel gesture without momentum, 1.6 H / 2.5 H | 1440 / 2250 | 900 (overshoots to 1432, pulled back) / 2610 | 1440 / 2250 | 1710 / 2610 | 1440 / 2250 | **1440 / 2248** | 1440 / 2248 |
| inside the résumé: gestures ±300, notches ±100 | exact | exact | exact | exact | exact | **exact** | exact |
| up from the résumé: −500 then −300 (2310, 2010) | exact | 2610 2610 | exact | 2610 2610 | exact | **2312 2008** | 2312 2008 |
| touch flick down from the plateau | 2727 | | | | | **2822** (free) | |
| scrollIntoView résumé / hash / find-like scrollIntoView / End / Home | exact | exact | exact | exact | exact | **exact** | exact |
| at the plateau, resize to 1280×720 (new diveEnd 720) | 900 | 720 | 720 | 720 | 720 | **720** | 720 |
| at 450, resize to 1280×720 | 450 | 0 | 720 | 720 | 450 | **448** | 448 |
| snapping off, scrollTo 450, snapping on | 450 | 0 | 900 | 900 | 450 | **448** | 448 |

K behaved like J with 8 px deviations (arrows 16 px). P quantised every notch to 80 px. L yanked every résumé position to 2608 (no free scrolling without a covering area).

**What the numbers say.**
1. Only `mandatory` plus `scroll-snap-stop:always` stops a momentum flick at the plateau (A, C, D, J: 900). Proximity lets it through (B 1807, F 1819, M 1928), because Chrome drops a candidate that is outside the proximity range of the fling's natural end.
2. Chrome applies the stop to flings and to keyboard paging (its end-and-direction strategy: PageDown from 856 stops at 900, PageUp from the résumé stops at 900). Notched wheels and non-momentum phased gestures use the end-position strategy and ignore the stop (J: 12 fast notches → 1200; 2.5 H drag → 2248). Trackpad momentum goes through Chrome's snap-fling controller exactly like the touch flick measured here; it cannot be synthesized on macOS headless, so it is a manual check (6A ACCEPTANCE).
3. Covering snap areas do not free the dive in Chrome: whenever the plateau marker is inside the snapport, Chrome prefers it over the covering position (C, D, E: a rest at 450 → 900; every slow notch → 0). That is the "magnetic" failure. Covering only works where no other snap area is visible, which is why the résumé scrolls freely in every config with a résumé area.
4. A dense 8 px rail (J) makes mandatory snapping practically free everywhere: a rest moves ≤ 4 px, a notch goes 96 instead of 100, drags and flicks that do not cross the plateau are untouched, nothing sticks at the plateau, and the stop still wins for flicks (900). The one regression is arrow keys (8 px per press, the next rail point); a JS `scrollBy(±40)` lands exactly (40 80 120).
5. Programmatic scrolls (scrollIntoView, hash, find, End, Home) pass the stop and land exactly. Per-frame instant `scrollTo` under mandatory snapping is itself snapped (A: 450 → 0), so glides must suspend snapping; turning it back on moves ≤ 4 px.
6. On resize the browser keeps a page that is snapped to the stop on the stop (900 → 720 at 1280×720: still inside). Mid-dive it keeps the pixel position (448): the JS remap still keeps the fraction.

**"Sticky", measurably** (used in the re-checks below):
- **S1** A user scroll ends more than 5 px (half the rail step + 1) from where the same input ends without snapping, unless it is a flick or a PageDown/Space/PageUp whose native path crosses `diveEnd` (the intended stop).
- **S2** One notch, one arrow press, one PageDown or a 100 px drag from any rest point moves less than 90 % of its native distance (A, D and F moved 0 % from the plateau).
- **S3** The page moves by itself more than 5 px after the user stopped, other than the settle glide (U6) and following the stop on resize.
- **S4** Inside the résumé any input deviates from native by more than 2 px.

J with JS arrow keys passes S1–S4 in Chrome (worst case 4 px). **Chosen: J.**

**Fallback if snapping feels sticky** (any S1–S4 failure in the real-browser pass in Chrome, Safari or Firefox, or the owner's trackpad check): first try a 4 px rail (`SNAP_GRID_PX = 4`, doubles the node count, halves every deviation). If an engine still fails, turn snapping off for it (`snapSupported()` returns false: the `runway-snap` class is never added, nothing else changes) and enable the **plateau latch** instead: a scroll sequence whose origin was above `diveEnd` and that comes to rest in the out segment or tail glides back to `diveEnd` (in `settleTarget`, before the direction rule). The latch is specified here but not built unless the fallback is triggered.

### 7.2 Decisions

| # | Decision | Why |
|---|---|---|
| U1 | **Mandatory root snapping, on only while the scene is ready.** `html.runway-snap{scroll-snap-type:y mandatory}`. The controller adds the class on the first ready frame (if `snapSupported()`: `RUNWAY_SNAP && CSS.supports('scroll-snap-stop','always')`) and removes it when the scene is unavailable and on unmount. Never in the prerendered HTML, while loading, without JS, or in the no-WebGL fallback (whose runway is collapsed, R10). | Decision A; experiment point 1. Mandatory without the rail would be magnetic everywhere, so it must never apply to a page that has no rail. |
| U2 | **The snap rail.** `.snap-rail` (absolute, in `#track`, `aria-hidden`) holds one stop `<i class="stop">` at `diveEnd` (`scroll-snap-stop:always`) and plain `<i>` points at `insideEnd`, `outEnd` and every 8 px from 0 to the track bottom; `#resume-root` is a covering area (`scroll-snap-align:start`) so the résumé and footer scroll freely. No other element in the app may declare `scroll-snap-align`. | Experiment points 3–4: the only configuration that stops flicks and leaves the dive, plateau, tail and résumé free (S1–S4). The settle targets (0, diveEnd, insideEnd, outEnd) are exact snap positions, so a glide never ends with a re-snap jump. About 330 nodes at 1440×900, 520 at 1440 px tall; built once per layout change, never per frame. |
| U3 | **Programmatic scrolls suspend snapping.** `html.snap-hold{scroll-snap-type:none}` while a glide runs and around every instant programmatic jump (`glide.jump`: resize remap, detent snap). | Experiment point 5: per-frame `scrollTo` under mandatory snapping is snapped, which would stall the glide and trip its 2 px foreign-scroll cancel. Safari is known to snap programmatic writes too. |
| U4 | **Arrow keys step 40 px in JS while snapping is on.** ArrowUp/ArrowDown without modifiers, when `scrollsPage(e)` and the last-clicked OS scroller (`.wb`/`.t-out`) cannot scroll that way: `preventDefault()` and `scrollBy({top: ±40, behavior: reduce ? 'instant' : 'smooth'})`. Space, PageUp/PageDown, Home, End stay native. | Experiment point 4 (native arrows move 8 px under the rail). Chrome sends arrow keys to the last-clicked scroller, so a click inside a window must keep native arrows there. Paging keys respect the stop natively (PageDown from the top: 856, then 900). |
| U5 | **The JS detent stays,** unchanged (still attached only in the dive). Its snap goes through `glide.jump`. | Experiment point 2: Chrome ignores `scroll-snap-stop` for notched wheels (12 fast notches → 1200). Notched wheel events are all cancelable, and the browser pass showed the detent stops them. It is useless for latched trackpad sequences, which the stop now handles in their momentum phase. Removing it would bring back notched-wheel fly-through. |
| U6 | **Settle follows the last user direction (decision B).** `settleTarget(s, L, dir, travel)`: in `dive` or `out`, if `|travel| ≥ SETTLE_TINY_PX` (16 px), go to the forward end when `dir > 0` (dive → `diveEnd`, out → `outEnd`) and the back end when `dir < 0` (dive → 0, out → `insideEnd`). A tiny movement returns: it goes to the end behind the movement. `dir = 0` (no user scroll since load) → nearest end. `SETTLE_BIAS` is deleted. | Fixes the ratchet (F3): a 100 px notch, a 40 px arrow press or a 200 px swipe now finishes the dive. 16 px is above trackpad brush and snap jitter (≤ 4 px) and below the smallest deliberate input (an 8 px rail step × 2, a 40 px arrow). Holds and glide cancels are unchanged, so it never fights active scrolling. |
| U7 | **Direction and travel come from user scrolls only.** `scrollIdle` takes `scroll(y, own)`. `own` scrolls (glide frames, `glide.jump`, the re-snap right after them) move the baseline and the travel origin but never the direction. User direction comes from the last run of same-sign movement that reached `DIR_MIN_PX` (8 px), so a ≤ 4 px snap correction or a reverse twitch at the end of a gesture is ignored. `glide.owns(y)`: `|y − lastWritten| ≤ SNAP_OWN_TOL_PX` (5) and within `OWN_MS` (300 ms) of that write; any external `cancel()` (user input) ends the window. | Decision B ("programmatic scrolls never count") and F8: the remap's instant scroll was read as an upward scroll. The run rule is needed because the browser's own ≤ 4 px snap at the end of a downward drag is an upward scroll event. |
| U8 | **Plateau minimum 120 px, taken from the out segment.** `insideEnd = max(round(1.12·unit), diveEnd + min(PLATEAU_MIN_PX, floor((outEnd − diveEnd)/2)))`; `diveEnd` and `outEnd` unchanged. | F9: at 1280×720 the plateau was 86 px, less than one 100 px notch. `outEnd` does not move, so the R2 invariant (`z > 0 ⇒ s ≤ R − 0.15 H`) is untouched; the cap keeps at least half of the dive-to-outEnd span for stepping out on tiny screens. |
| U9 | **The scroll cue shows only at the top and in the dive:** `cueOpacity(pose)` = 0.8 at `top`, `0.8·(1 − ss(0, 0.15, z))` in `dive`, 0 elsewhere (loading uses the same function with `z = 0`). | Nit: in the tail `z = 0` made the cue come back while the stage scrolls away. |
| U10 | **Window scroll offsets survive re-parenting:** `keepScroll(osEl, fn)` snapshots `scrollTop/Left` of every `.wb`/`.t-out` with a non-zero offset, runs the move, and restores them. `host.setFlat` runs inside it. The re-parent itself stays. | F4. Moving a node resets its descendants' scroll offsets. Avoiding the move would mean giving up either the CSS3D holder (the dive) or the flat host (R4: crisp 2D inside), so save/restore is the small fix. Restoring works while `overflow:hidden` (`.os:not(.live)`), so the order of `setLive` and `setFlat` does not matter. |
| U11 | **No-WebGL layout is a grid:** in `.track.flat-runway .stage`, a top bar holds the notice (left) and the HUD (right, `position:static`), and the flat host fills the row below. On screens ≤ 600 px wide, the HUD row comes first, then the notice, then the OS. The notice becomes `<p class="fallback-note">`, no longer a floating toast. | F5: nothing overlaps because the OS starts below the bar; the host measures its real size, so `fitWindows` and the compact window CSS keep title bars and the clock visible. |
| U12 | **Esc closes the open ◆ menu first.** Order: recruiter view → ◆ menu (`os.setMenu(false)`, focus back to `#mb-logo` if focus was inside `#menu-pop`) → exit the laptop. | F6. Standard menu behaviour; a second Esc still leaves. |
| U13 | **Compact live OS reserves a 60 px strip for the pill.** `.os.compact.live:not(.fallback) .win{height:calc(100% - 104px)!important}` (window bottom 66 px above the screen edge; the pill's top edge is about 51 px above it) and `.icons{bottom:66px}`. The pill itself does not move. | F7. Moving the pill into the compact menubar would overflow at 390 px; hiding it loses the visible way out. `live` without `fallback` is exactly "inside on a compact layout", when the pill shows. |
| U14 | **Thumbnails: `height:auto` wherever `aspect-ratio` meets width/height attributes.** `.pcard img` gains `height:auto;object-position:top`; Bin's inline styles move to `.pcard.bin-item` rules in apps.css. | F2. With the phase-5 `height` attribute and no CSS height, the attribute wins and the image is thousands of px tall. |
| U15 | **Softer hover glow:** `GLOW_K` 0.35 → 0.2, and a per-hotspot strength, `MUG.glow = 0.1` for the mug. | Nit: a strong red emissive on the red, white-lettered label reads pink. |
| U16 | **Invisible hit proxies** for the dog tags and each floppy: a box mesh with `MeshBasicMaterial({ visible: false })`, child of the hotspot group, no shadow, sizes in `props.js` `HIT`. | Nit: the tags are thin plates on a wall far away; floppies are 0.03 thick. The raycaster tests invisible materials; the renderer skips them; `glow()` ignores materials without `emissive`. |

These supersede parts of section 2.2: "Wheel / trackpad on the desk or mid-dive" (flicks now stop by `scroll-snap-stop`, notched bursts still by the detent), "Space / PageDown …" (PageDown from inside the dive stops at the plateau; ArrowUp/Down step 40 px in JS), and R6's direction rule (U6 replaces the 0.3 bias; R6's "JS settle" stays, now next to CSS snapping, which only provides the stop).

---

### Phase 6A: Scroll snapping, settle direction, plateau minimum, remap direction, cue

**Goal.** A momentum flick from the top stops at the open laptop in the browser's own physics; the dive, plateau, tail and résumé scroll as freely as before (S1–S4); a rest part-way glides on in the user's direction; programmatic scrolls never steer the settle; the plateau is at least 120 px; the cue shows only at the top.

**Add**
- `src/stage/snapRail.js`: `syncSnapRail(el, { stop, points })`. Child 0 is `<i class="stop">`, then one `<i>` per point, in order. Writes `style.top = px + 'px'` only when a node's value changed (keep the last value per node in a `WeakMap`), appends missing nodes, removes extra ones from the end. Never moves a node whose value is unchanged (the browser keeps a snapped page on its snap target). `el == null` is a no-op.
- `src/stage/arrowStep.js`: `arrowStep({ key, mods, snapping, scroller })` → `0`, `+ARROW_STEP_PX` or `−ARROW_STEP_PX`. Returns 0 unless `snapping`, the key is `ArrowDown`/`ArrowUp`, and no modifier (`alt`, `ctrl`, `meta`, `shift`) is held. Also 0 when `scroller` (the `.wb`/`.t-out` of the last pointerdown, or null) can still scroll that way: down `scrollTop + clientHeight < scrollHeight − 1`, up `scrollTop > 0`.

**Change**
- `src/core/constants.js`: delete `SETTLE_BIAS`. Add `PLATEAU_MIN_PX = 120`, `SNAP_GRID_PX = 8`, `SNAP_OWN_TOL_PX = 5`, `OWN_MS = 300`, `SETTLE_TINY_PX = 16`, `DIR_MIN_PX = 8`, `ARROW_STEP_PX = 40`, `RUNWAY_SNAP = true` (each with a one-line comment that cites U-numbers).
- `src/stage/runway.js`:
  - `runwayLayout`: `insideEnd` per U8.
  - `settleTarget(s, L, dir, travel = Infinity)` per U6. Exactly: `seg` and `u` from `poseAt`; for `dive` let `back = 0, fwd = L.diveEnd`, for `out` `back = L.insideEnd, fwd = L.outEnd`; other segments → `null`. `tiny = Math.abs(travel) < SETTLE_TINY_PX`. `dir > 0` → `tiny ? back : fwd`; `dir < 0` → `tiny ? fwd : back`; `dir === 0` → `u >= 0.5 ? fwd : back`. Return `null` when `|target − s| < 1`.
  - `cueOpacity({ seg, z })` per U9.
  - `snapPoints(L, grid = SNAP_GRID_PX)` → `{ stop: L.diveEnd, points }`: every `k·grid` with `0 ≤ k·grid ≤ L.R + L.stageH`, plus `L.insideEnd` and `L.outEnd`, minus `L.diveEnd`, sorted ascending, unique.
  - Header comment: add the rail and the direction rule; remove the bias wording.
- `src/stage/glide.js`: new options `hold = () => {}` and `now` (already present). `to()`: non-reduced → `hold(true)` before the first frame, and on the last frame write the exact target, then `hold(false)`. Reduced motion → `hold(true)`, one write, `hold(false)`. `cancel()` while active → `hold(false)`. Add `jump(top)`: `cancel()`, `hold(true)`, write, `hold(false)`. Every write records `lastWritten` and `lastWriteT = now()`. Add `owns(y)` per U7. `cancel()` called from outside (user input) also sets `lastWriteT = −Infinity`; the internal cancel at the start of `to()`/`jump()` is followed by a write, so it does not matter. Update the header comment.
- `src/stage/scrollIdle.js`: `scroll(y, own = false)` and `onIdle({ dir, travel })`. State: `prevY`, `origin` (travel origin: `y` at creation, or the first scroll's `y` when created without one, then `prevY` each time `onIdle` fires), `dir` (persists across rests), `runSign`, `runLen`. User scroll: `d = y − prevY`; same sign as `runSign` → `runLen += |d|`, else `runSign = sign(d)`, `runLen = |d|`; when `runLen ≥ DIR_MIN_PX`, `dir = runSign`. Own scroll: `origin += y − prevY`; direction and run untouched. Both set `prevY = y`, `pending = true` and re-arm. `fire()` reports `{ dir, travel: prevY − origin }`, then `origin = prevY`, `runLen = 0`. Holds unchanged.
- `src/stage/controller.js`:
  - `settle({ dir, travel })` → `settleTarget(m.s, m.L, dir, travel)` (ready, `!glide.active`, as now).
  - `update()`: when status is `ready` and the layout differs from the last synced one (compare `R`, `diveEnd`, `insideEnd`, `outEnd`, `stageH`), call `ui.setSnap(L)` before the remap check. The remap becomes `glide.jump(m.trackTopDoc + s)` (no separate `cancel` + `scrollTo`). Status `unavailable` → `ui.setSnap(null)` once. Loading → never call it. Cue: `ui.setCue(cueOpacity(pose))` when ready, `ui.setCue(cueOpacity({ seg: poseAt(s, L).seg, z: 0 }))` while loading.
  - `onWheel`: the detent snap uses `glide.jump(m.trackTopDoc + r.snapTo)`.
  - Add `releaseSnap()`: `ui.setSnap?.(null)` and forget the last synced layout.
  - Header comment: U1–U9 in one paragraph.
- `src/app/createApp.js`: `app.dom` gains `rail: null`. `createGlide` gets `hold: (on) => document.documentElement.classList.toggle('snap-hold', Boolean(on))`. The controller's `ui` gains `setSnap(L)`: if `!L || !snapSupported()` remove `runway-snap` (and `snap-hold`) from `document.documentElement` and return; else `syncSnapRail(app.dom.rail, snapPoints(L))`, then add `runway-snap`. `snapSupported = () => RUNWAY_SNAP && Boolean(globalThis.CSS?.supports?.('scroll-snap-stop', 'always'))` (overridable through `pick` for tests).
- `src/stage/Stage.jsx`: inside `section.track`, after the stage div: `<div className="snap-rail" id="snap-rail" aria-hidden="true" ref={railRef} />`. Pass `railRef` to the bindings.
- `src/stage/useStageBindings.js`:
  - The layout effect also sets `dom.rail`.
  - Scroll listener: `const y = window.scrollY; const own = Boolean(app.glide.owns?.(y)); app.glide.onScroll(y); idle.scroll(y, own)`.
  - `onIdle: (info) => ctrl.settle(info)`.
  - Track `lastScroller`: in the existing `pointerdown` listener, `lastScroller = e.target?.closest?.('.wb, .t-out') ?? null`.
  - Keydown: after `graceHold('key')`, `const step = scrollsPage(e) ? arrowStep({ key: e.key, mods: { alt: e.altKey, ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey }, snapping: document.documentElement.classList.contains('runway-snap'), scroller: lastScroller }) : 0`; if `step`, `e.preventDefault()` and `window.scrollBy({ top: step, behavior: app.motion.reduce() ? 'instant' : 'smooth' })`. `onKey(e)` still runs (Konami uses arrows).
  - Cleanup: `ctrl.releaseSnap?.()`.
  - Update the header comment (snapping, the detent kept for notched wheels).
- `src/styles/stage.css`, a new block after the runway rules:
  ```
  /* plan-r2 §7 U1–U3: the plateau stop and the 8 px rail that keeps mandatory snapping free. */
  html.runway-snap{scroll-snap-type:y mandatory}
  html.runway-snap.snap-hold{scroll-snap-type:none}
  html.runway-snap #resume-root{scroll-snap-align:start}
  .snap-rail{position:absolute;left:0;top:0;width:1px;height:100%;pointer-events:none}
  .snap-rail>i{position:absolute;left:0;width:1px;height:1px;scroll-snap-align:start}
  .snap-rail>i.stop{scroll-snap-stop:always}
  ```

**TEST LIST**
1. `src/stage/runway.test.js`
   - `runwayLayout({ trackH: 2088, stageH: 720 })` → `{ R: 1368, diveEnd: 720, insideEnd: 840, outEnd: 1238 }`; H 1000 / 2900 unchanged (`insideEnd 1120`); `({ trackH: 580, stageH: 200 })` → `diveEnd 200, outEnd 344, insideEnd 272` (cap binds); for `H` in `[390, 600, 720, 844, 900, 1000, 1366]` with `trackH = 2.9·H`: `insideEnd − diveEnd ≥ min(120, floor((outEnd − diveEnd)/2))` and `outEnd` equals `round(1.72·R/1.9)`.
   - The existing invariant test also runs for `H 720, trackH 2088`.
   - `remapScroll` with `L1 = H600/1740` (now `insideEnd 720`): `1000 → 600`, `500 → 300`, `1060 → 660`, `1420 → 876`, `2000 → 1240`, `0 → 0`. Update the "L1 is …" test to `insideEnd 720`.
   - `settleTarget` (H 1000 layout), replacing the bias tests: `(300, +1, 300) → 1000`; `(100, +1, 100) → 1000`; `(900, −1, 100) → 0`; `(10, +1, 10) → 0`; `(990, −1, 10) → 1000`; `(500, 0, 0) → 1000`; `(499, 0, 0) → 0`; `(1200, +1, 80) → 1720`; `(1130, +1, 10) → 1120`; `(1700, −1, 20) → 1120`; `(1710, −1, 10) → 1720`; `(300, +1)` with travel omitted → 1000; nulls unchanged: `(0|1000|1120|1060|1720|1800|2500, L, ±1, 100) → null`, `(999.5, L, +1, 100) → null`.
   - `cueOpacity`: `{seg:'top', z:0} → 0.8`; `{seg:'dive', z:0.075} → 0.4` (3 dp); `{seg:'dive', z:0.5} → 0`; `inside`, `out` (z 0.5), `tail`, `past` → 0.
   - `snapPoints(L1000)`: `stop 1000`; `points` strictly ascending; contains 0, 8, 1120, 1720 and 2896; contains no 1000 and nothing above 2900; length 362 (the 363 multiples of 8 from 0 to 2896, minus 1000; 1120 and 1720 are already multiples of 8). With `L720` (`insideEnd 840`, `outEnd 1238`): contains 840 and 1238.
2. `src/stage/glide.test.js`
   - `to(1000)` from 0: `hold` called `[true]` before the first `scrollTo` and `[false]` after the last; the last `scrollTo` is exactly 1000.
   - `cancel()` mid-glide → `hold(false)` once; `cancel()` when idle → no `hold` call.
   - Reduced motion: call order `hold(true)`, `scrollTo({top:1000, behavior:'instant'})`, `hold(false)`.
   - `jump(640)` during a glide: the glide stops (no further frame writes), then `hold(true)`, one instant `scrollTo` 640, `hold(false)`; `owns(644)` true, `owns(646)` false.
   - `owns`: after a frame write of 300, `owns(303)` true; after `now` advances 301 ms, false; after an external `cancel()`, false at once.
   - Existing tests keep passing (the onScroll 2 px cancel is unchanged).
3. `src/stage/scrollIdle.test.js`
   - `scroll(0)`, `scroll(50)`, idle → `onIdle({dir:1, travel:50})`.
   - Snap jitter: `scroll(0)`, `scroll(300)`, `scroll(296)` → `{dir:1, travel:296}`.
   - Real reversal: `scroll(0)`, `scroll(300)`, `scroll(280)` → `{dir:−1, travel:280}`.
   - Own moves: from `y 0`, `scroll(500, true)` → `{dir:0, travel:0}`; then `scroll(520)` → `{dir:1, travel:20}`.
   - F8: `scroll(0)`, `scroll(450)` → idle `{dir:1, travel:450}`; then `scroll(270, true)` → idle `{dir:1, travel:0}` (the remap neither flips the direction nor counts as travel).
   - The direction persists across rests: after `{dir:1}`, a lone own scroll keeps `dir 1`.
   - Existing hold, scrollEnd and dispose tests updated to the object argument.
4. `src/stage/controller.test.js` (fake `glide` gains `jump: vi.fn()`, `owns: vi.fn(() => false)`; `ui` gains `setSnap: vi.fn()`)
   - `settle({dir:1, travel:100})` at 100 → `glide.to(1000)`; `settle({dir:1, travel:10})` at 10 → `glide.to(0)`; `settle({dir:−1, travel:200})` at 1300 → `glide.to(1120)`; at 1060 / 2000 → not called; `glide.active` → not called. Replaces test 10.
   - Test 13 (remap): `glide.jump(600)` instead of `scrollTo`; with the 5 % change, no `jump`.
   - Test 15 (`onWheel`): the snap is `glide.jump(1000)`; no `scrollTo` from the controller.
   - `setSnap`: first ready `at(0)` → called once with the layout; ten more frames at other positions → still once; a resize (stage 720, track 2088) → called again with the new layout and before `glide.jump` (check the call order with `mock.invocationCallOrder`); loading → never; unavailable → `setSnap(null)` once over three updates; `releaseSnap()` → `setSnap(null)`.
   - Cue: `at(0)` 0.8; `at(1720)` 0; `at(2500)` 0. Test 11 (loading at 1000): cue 0 (was 0.8); loading at 0 → 0.8.
5. `src/stage/snapRail.test.js` (jsdom): first `syncSnapRail(el, { stop: 100, points: [0, 8, 16] })` → 4 children, child 0 has class `stop` and `style.top` `100px`, the others `0px`, `8px`, `16px`; calling again with the same data writes nothing (spy on each child's `style` `top` setter via `Object.defineProperty` or compare a mutation count from a `MutationObserver` on `attributes`); `{ stop: 120, points: [0, 8, 16, 24] }` → only the stop's top changes and one node is appended; `{ stop: 120, points: [0, 8] }` → two children removed from the end; `syncSnapRail(null, …)` does not throw.
6. `src/stage/arrowStep.test.js`: `ArrowDown`, snapping, no scroller → 40; `ArrowUp` → −40; snapping false → 0; any modifier → 0; `PageDown` → 0; scroller `{scrollTop:0, clientHeight:100, scrollHeight:300}` with `ArrowDown` → 0 and with `ArrowUp` → −40; scroller at its bottom (`scrollTop 200`) with `ArrowDown` → 40.
7. `src/stage/Stage.test.jsx`
   - `#snap-rail` exists inside `#track`, outside `#stage`, with `aria-hidden="true"`, and `app.dom.rail` is it.
   - Test 17 rewritten: two scroll events (0, then 40), 200 ms → `ctrl.settle` called with `{ dir: 1, travel: 40 }`. With `app.glide.owns` returning true for the second event → `settle` called with `{ dir: 0, travel: 0 }`.
   - Arrow keys: with `document.documentElement.classList.add('runway-snap')`, a cancelable `keydown` ArrowDown on `document.body` → `defaultPrevented`, `window.scrollBy` called with `{ top: 40, behavior: 'smooth' }`; with `app.motion.reduce` true → `behavior: 'instant'`; without the class → not prevented, no `scrollBy`; in an `<input>` → not prevented; after a `pointerdown` inside a `.wb` stub that can scroll down → not prevented. (`window.scrollBy` is a `vi.fn` from `src/test/setup.js`; add it there if missing.)
   - Unmount calls `ctrl.releaseSnap` (spy) and removes every listener (existing test 9).
8. `src/styles/stage.css.test.js`: `html.runway-snap` has `scroll-snap-type: y mandatory`; `html.runway-snap.snap-hold` has `scroll-snap-type: none`; `.snap-rail>i` has `scroll-snap-align: start`; `.snap-rail>i.stop` has `scroll-snap-stop: always`; `#resume-root` gets `scroll-snap-align` only under `html.runway-snap`; across all files in `src/styles/`, every rule that declares `scroll-snap-type` has a selector starting with `html.runway-snap`, and the only `scroll-snap-align` rules are the two above; no file declares `scroll-behavior`.
9. `src/app/createApp.test.js`: with `snapSupported` stubbed true and a rail element in `app.dom.rail`, `app.ctrl`'s `ui.setSnap(L)` (reach it through a ready `update()` with stub rects, or export the ui factory) adds `runway-snap` to `documentElement` and creates `snapPoints(L).points.length + 1` children; `setSnap(null)` removes the class; with `snapSupported` false nothing is added. `app.glide`'s `hold(true)` adds `snap-hold`, `hold(false)` removes it. Clean `documentElement` classes in `afterEach`.
10. `src/stage/structure.test.js`: no file under `src/` references `SETTLE_BIAS`; `createDetent` is still exported (U5).

**Implementation notes and pitfalls**
- Never put `scroll-snap-type` on `html` outside the `runway-snap` class: the prerendered page and the no-JS page have no rail, and mandatory snapping without it yanks every position to the résumé area (config L).
- jsdom has no `CSS.supports`; tests stub `snapSupported` (or `globalThis.CSS`). Remove the classes in `afterEach`, since `documentElement` is shared between tests.
- Order inside `update()` on a resize: `ui.setSnap(newL)` (moves the rail) before `glide.jump` (which turns snapping off and on around its write). The other order re-snaps to the old rail.
- `hold(false)` after the final glide write lets the browser re-snap; the targets are snap positions, so it moves 0 px; any ≤ 4 px correction is `own` (within `OWN_MS`).
- The rail is `<i>` elements without content inside an `aria-hidden` container; do not hide them with `display:none` or `visibility` (a box with no layout is not a snap area).
- Do not give any résumé section `scroll-snap-align` (S4); the covering area is `#resume-root` only.
- Chrome's `scrollend` fires after its own snap animation, so the idle fires once per user scroll, as before.
- An upward flick from the résumé also stops at the open laptop (the stop works in both directions). That is consistent with decision A; Home, Esc and ⏏ still go straight to the top.
- Mobile toolbar resizes move `diveEnd` a little; a page snapped to the stop follows it (inside the plateau, harmless). Rail points are multiples of 8, so the rest of the rail does not move.
- Reduced motion: snapping stays (the user started the motion; it stops it). Glides stay instant, as now.

**ACCEPTANCE**
- TEST LIST green; `npm test`, `npm run lint`, `npm run build` green.
- `git grep -n SETTLE_BIAS src` prints nothing. The only non-passive wheel or touch listener is still the dive-only `#stage` wheel detent (keydown was never passive).
- **Browser re-check (headless Chrome over CDP on `npm run build && npm run preview`, the 7.1 method, at 1440×900, 1280×720, 390×844 with touch, 844×390):**
  - Touch flick with momentum from the top (`synthesizeScrollGesture` touch, `preventFling:false`, 0.4 H at 6000 px/s): rests at `diveEnd` exactly; the OS is flat and live.
  - 12 notches 30 ms apart from the top: rests at `diveEnd` (detent).
  - 100 px notches 0.7 s apart from the top: every notch moves forward, the page ends inside after the settle, never back at 0 (F3).
  - ArrowDown once from the top: moves 40 px, then glides open. ArrowUp/ArrowDown inside an Experience window after clicking it: the window scrolls, not the page.
  - 390×844: one 200 px swipe from the top glides open; a 10 px nudge returns to the top.
  - Inside at 1280×720: one notch down stays inside (plateau 120 px, F9); the second steps out and, at rest, glides to the closed wide shot.
  - Résumé: notches, gestures, arrows deviate ≤ 2 px from native (S4); Cmd/Ctrl+F of a résumé word, the skip link, `#resume`, HUD "Résumé ↓" from the top all land exactly; "Open the laptop ↑" glides in and lands on `diveEnd`.
  - Mid-dive at 40 % after a downward scroll, resize to half height: the fraction is kept and it settles open, not closed (F8).
  - The scroll cue is visible at the top and gone everywhere from the plateau to the résumé, including the tail.
  - S1–S3 hold at every viewport (log the worst deviation).
- **Manual (owner, real hardware; record the result in the PR):** MacBook trackpad in Chrome, Safari and Firefox: a flick from the top stops at the open laptop; a slow two-finger scroll through the dive shows no visible snapping; résumé scrolling feels native; a notched mouse wheel spun fast stops at the open laptop. Any failure → the 7.1 fallback.

---

### Phase 6B: OS and layout fixes

**Goal.** Thumbnails are thumbnail-sized; window scroll positions survive stepping out and back in; the no-WebGL page has no overlaps; Esc closes the ◆ menu first; the pill never covers window content on compact layouts.

**Add**
- `src/os/keepScroll.js`: `KEEP_SCROLL = '.wb, .t-out'`; `keepScroll(root, fn, selector = KEEP_SCROLL)` per U10: snapshot `[el, scrollTop, scrollLeft]` for each match with a non-zero offset, `const r = fn()`, then write back only the values that changed; return `r`. `root == null` → just `fn()`.

**Change**
- `src/os/osHost.js`: the whole body of `setFlat(v, compact)` (class toggles, the `appendChild` either way, `fitFlat()`) runs inside `keepScroll(osEl, () => …)`. Update the `setLive` comment: offsets survive both the live flag and the re-parent.
- `src/stage/keys.js`: Escape per U12: `recOpen` → close it; else if `app.os.store.get().menuOpen` → `app.os.setMenu(false)` and, when `document.activeElement?.closest?.('#menu-pop')`, `document.getElementById('mb-logo')?.focus()`; else the existing exit rule.
- `src/stage/NoWebGLNotice.jsx`: `<p className="fallback-note" role="note">3D is unavailable in this browser, so JAY-OS runs flat. Everything still works.</p>` (same text, no inline style, no toast classes).
- `src/stage/Stage.jsx`: drop `FLAT_FALLBACK` (the z-index moves to CSS).
- `src/styles/stage.css` (after the `.track.flat-runway` rules):
  ```
  /* plan-r2 §7 U11: the fallback stacks a top bar (notice + HUD) over the OS, so nothing overlaps. */
  .track.flat-runway .stage{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto minmax(0,1fr);grid-template-areas:"note hud" "os os"}
  .track.flat-runway .hud{position:static;grid-area:hud;align-self:center;max-width:none;padding:8px max(14px,env(safe-area-inset-right,0px)) 8px 8px}
  .track.flat-runway .flat-host{position:relative;inset:auto;grid-area:os;z-index:5}
  .fallback-note{grid-area:note;align-self:center;margin:0;padding:8px 8px 8px max(14px,env(safe-area-inset-left,0px));font:12px/1.4 var(--f-mono);color:var(--scene-ink)}
  @media (max-width:600px){.track.flat-runway .stage{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr);grid-template-areas:"hud" "note" "os"}.track.flat-runway .hud{justify-content:flex-start;padding-left:max(14px,env(safe-area-inset-left,0px))}}
  ```
- `src/styles/os.css` (after the `.os.compact` rules):
  ```
  /* plan-r2 §7 U13: inside on a compact layout, windows and icons end above the "Go to résumé ↓" pill. */
  .os.compact.live:not(.fallback) .win{height:calc(100% - 104px)!important}
  .os.compact.live:not(.fallback) .icons{bottom:66px}
  ```
- `src/styles/apps.css`: `.pcard img{display:block;width:100%;height:auto;aspect-ratio:16/10;object-fit:cover;object-position:top;border-bottom:2px solid #122030}`; add `.pcard.bin-item{display:flex;align-items:center;gap:12px;width:100%}` and `.pcard.bin-item img{flex:none;width:110px;height:auto;border-bottom:0;border-right:2px solid #122030}`.
- `src/os/apps/Bin.jsx`: `className="pcard bin-item"`; no `style` on the button or the image (keep `width`/`height` attributes and `alt=""`).

**TEST LIST**
1. `src/os/keepScroll.test.js`: two elements matching `.wb` with stubbed `scrollTop`/`scrollLeft` (instance `Object.defineProperty` with a stored value and a setter spy), offsets `120/0` and `0/0`; `fn` sets the first to `0`; after `keepScroll`, the first is `120` again, the second's setter was never called, and the return value of `fn` is passed through; `keepScroll(null, fn)` calls `fn` once.
2. `src/os/osHost.test.js`: a `.wb` inside `osEl` with stubbed `scrollTop 200`; spy `flatHost.appendChild` and `holder.appendChild` to reset the stub to 0 after the real call (simulating the browser); after `setFlat(true, false)` the `.wb` reads 200; after `setFlat(false)` it still reads 200. Existing setFlat/fitFlat tests still pass.
3. `src/stage/keys.test.js`: Escape with `os.store` `menuOpen: true` → `os.setMenu(false)` once and `ctrl.exit` not called; with focus on a button inside a `#menu-pop` element → `#mb-logo` is `document.activeElement` afterwards; `recOpen` and `menuOpen` both true → only the recruiter view closes; `menuOpen` false, phase inside → `ctrl.exit` once (unchanged).
4. `src/styles/stage.css.test.js`: `.track.flat-runway .stage` declares `display:grid` and `grid-template-areas` containing `"note hud"` and `"os os"`; `.track.flat-runway .hud` has `position:static`; `.track.flat-runway .flat-host` has `position:relative` and `grid-area:os`; `.fallback-note` declares no `position`; the ≤ 600 px media block stacks `"hud" "note" "os"`.
5. `src/styles/os.css.test.js`: `.os.compact.live:not(.fallback) .win` has `height:calc(100% - 104px)!important`; `.os.compact.live:not(.fallback) .icons` has `bottom:66px`; the `.os.compact .win` rule is unchanged (`calc(100% - 44px)`), so the strip applies only while live.
6. `src/styles/apps.css.test.js`: `.pcard img` has `height:auto`, `aspect-ratio:16/10` and `object-fit:cover`; `.pcard.bin-item img` has `width:110px` and `height:auto`. Guard: in `apps.css` and `resume.css`, every rule that declares `aspect-ratio` on a selector ending in `img` also declares `height:auto`.
7. `src/os/apps/apps.test.jsx` Bin: the button has classes `pcard bin-item`; neither it nor the image has a `style` attribute; the image keeps numeric `width`/`height`. Projects: unchanged assertions still pass.
8. `src/stage/Stage.test.jsx` fallback: the notice is a `p.fallback-note` with `role="note"` and the same text, without a `style` attribute; `#flat-host` has no inline `z-index`.

**Implementation notes and pitfalls**
- `keepScroll` restores right after the move, in the same task, so no frame shows the reset. Restoring forces a layout; it runs only on the `interactive` flip.
- Absolutely positioned stage children (scene layer, cue, toasts, tooltip, recruiter view, exit pill) are not grid items, so the fallback grid does not move them. The scene layer is positioned and earlier in the DOM; the flat host is positioned with `z-index:5`, so it paints above it.
- The fallback flat host is smaller than the stage now; `host.size()` reads `osEl`, so `fitWindows`, `openRect` and the compact window CSS all use the real size. Check the terminal and Mail fit at 390×844.
- `.os.compact.live:not(.fallback)` must beat `.os.compact .win` (it is more specific and both use `!important`).
- Do not touch `.r-project img` (it already has `height:auto`).

**ACCEPTANCE**
- TEST LIST green; `npm test`, `npm run lint`, `npm run build` green.
- **Browser re-check:**
  - 1440×900 inside: the Projects window shows 2-column cards about 125 px tall; the Recycle Bin item image is 110×69 (`getBoundingClientRect`).
  - Open Experience.log and the terminal, scroll both, step out one notch (the OS leaves live), step back in: both offsets are unchanged (`scrollTop` before and after within 1 px). Same after a full exit and re-entry by scroll.
  - No WebGL (launch Chrome with `--disable-webgl --disable-3d-apis`) at 1440×900 and 390×844: the notice and HUD sit in a bar above the OS; the menubar clock, a maximized window's title bar and close button are fully visible and clickable (`elementFromPoint` at their centres returns them); no element overlaps another (compare rects).
  - Inside, open the ◆ menu, press Esc: the menu closes, the laptop stays open, focus is on ◆ JAY-OS; Esc again closes the laptop.
  - 390×844 and 844×390 inside: in Experience.log (last entry scrolled into view), Terminal (input row) and Mail (textarea and send button), `elementFromPoint` at each control's centre returns the control, not the pill.

---

### Phase 6C: Scene nits (glow, hit proxies)

**Goal.** The hovered mug stays red; the dog tags and floppies are easy to hover and click.

**Change**
- `src/scene/props.js`: `MUG.glow = 0.1`; add `HIT = { tags: { size: [0.42, 1.0, 0.1], pos: [0.02, -0.44, 0] }, floppy: { size: [0.58, 0.07, 0.6], pos: [0, 0.015, 0] } }` (tags-group-local and floppy-group-local).
- `src/scene/createScene.js`:
  - `export const GLOW_K = 0.2` (exported for tests). `addHot(obj, label, glow)` stores `glow` in `userData.hot`; `glow(o, on)` uses `o.userData.hot?.glow ?? GLOW_K`. `addHot(mug, 'McGill mug', MUG.glow)`.
  - One shared `const hitM = new THREE.MeshBasicMaterial({ visible: false })`; `hitBox(parent, { size, pos })` adds `new THREE.Mesh(B(...size), hitM)` at `pos` with `castShadow = receiveShadow = false` (do not use `mk`, which turns shadows on). Add one to `tags` (`HIT.tags`) and one to each floppy group `g` (`HIT.floppy`), not to the floppy `mesh` (the wiggle turns the mesh). `hotspotOf` already walks up to the group, so a proxy hit resolves to the right hotspot.
  - Dispose already traverses meshes; disposing the shared material more than once is harmless.

**TEST LIST**
1. `src/scene/props.test.js`
   - Tags proxy (group-local box `pos ± size/2`) contains both plates (`x −0.085…0.125`, `y −0.82…−0.51`), the chain (`y −0.545…0.005`) and the ring top (`y 0.06`), with at least 0.05 margin in x around the plates; its back face is in front of the wall: `tags z (−2.92) − size[2]/2 > −3`.
   - Floppy proxy: `size[0] ≥ 0.5 + 0.06`, `size[2] ≥ 0.52 + 0.06`, `0.06 ≤ size[1] ≤ 0.08` (thicker than the floppy, thin enough not to swallow the whole stack).
   - `MUG.glow < 0.2`; `Math.max(...glowColor(MUG.color, MUG.glow)) ≤ 0.1`.
2. `src/scene/createScene.test.jsx`
   - `GLOW_K` is 0.2.
   - The object whose `userData.hot.label` is `'Dog tags'` has exactly one child mesh with `material.visible === false` and `BoxGeometry` parameters equal to `HIT.tags.size`; each `'Floppy · …'` hotspot group has one such child with `HIT.floppy.size`; none of these meshes casts a shadow.
   - The mug's `userData.hot.glow` is `MUG.glow`.

**Implementation notes and pitfalls**
- three r128 (installed): `Raycaster.intersectObject` checks only `layers`, and `Mesh.raycast` only that a material exists, so a `visible:false` material is still hit; the renderer skips it in the colour and shadow passes. Hide the proxy through the material, not `mesh.visible`, so a later three upgrade that skips invisible objects in raycasts does not silently drop the proxies (a test pins this).
- Proxies of stacked floppies overlap a little; the nearest hit wins, which is the floppy on top from the default camera. Accepted.
- A seated floppy's proxy sticks out about 0.09 past the base front; hovering the slot area shows that floppy's tooltip and clicking it reopens (the existing reopen rule). Accepted.

**ACCEPTANCE**
- TEST LIST green; `npm test`, `npm run lint`, `npm run build` green.
- **Browser re-check** (1440×900 and 390×844 wide shot): hovering within about 10 px outside a dog tag or a floppy's visible edge shows its tooltip and a click acts; the hovered mug's label stays red (screenshot the label area hovered and not hovered: the mean green and blue channels rise by at most 10/255).

### 7.3 Files touched (quick index)

| Phase | Add | Change |
|---|---|---|
| 6A | `stage/snapRail.js`, `stage/arrowStep.js` (+ tests) | constants, runway, glide, scrollIdle, controller, createApp, Stage, useStageBindings, stage.css, tests (runway, glide, scrollIdle, controller, Stage, stage.css, createApp, structure) |
| 6B | `os/keepScroll.js` (+ test) | osHost, keys, NoWebGLNotice, Stage, stage.css, os.css, apps.css, Bin, tests (osHost, keys, stage/os/apps css, apps, Stage) |
| 6C | — | props, createScene, tests (props, createScene) |
