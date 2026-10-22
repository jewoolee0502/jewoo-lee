# Implementation plan, round 3: two views (laptop / résumé)

Branch `feat/website-revamp`, worktree `.worktrees/feat-website-revamp`, base HEAD `99af09f`. Inputs: `design/notes/r3-explore.md` (owner request and decisions), `design/notes/plan-r2.md` §2 and §7 (current scroll model), and the code. Line numbers are hints from `99af09f`; search by symbol if they have moved.

Build loop and gates are the same as round 2: a test-writer writes the TEST LIST first, an implementer makes it pass, a reviewer checks ACCEPTANCE. Every phase ends with `npm test`, `npm run lint` and `npm run build` green (the build includes the SSR build and `scripts/prerender.mjs`). The headless-Chrome pass (section 6) runs after phase R3-3.

Owner request, verbatim: "I don't want the user to be able to keep scrolling to leave the laptop view. The scroll should only allow the user to open the laptop view and close the laptop view. To enter the resume view, the user must click on the button to enter the resume view. Once the user is in the resume view, the user can scroll again to move the page up and down, but only within the resume view. To enter back the laptop (interactive) view, it should click the laptop view."

Owner decisions:
- A sticky "← Laptop view" button sits in the top corner of the résumé view.
- Returning lands where the visitor left (open laptop, or closed desk).
- The switch is a ~0.3 s fade, instant under reduced motion.
- `#resume` is the résumé view's URL. Browser Back goes from the résumé to the laptop view. A `#resume` link opens the résumé directly.

Standing decisions:
- The dive follows native scroll, with the system's own momentum.
- A rest part-way through the dive settles in the last scroll direction.
- There is never a half-open laptop with the page beneath it.
- Inside the open laptop the OS is flat and WebGL is paused.

---

## 1. Decisions (V-numbers)

Where a decision departs from the suggested direction, the "Why" column explains it.

| # | Decision | Why |
|---|---|---|
| V1 | **Two views as state.** `app.views` (new `src/stage/views.js`) owns `store {view:'laptop'\|'resume', switching}` and writes it to `<html data-view>`. CSS hides `#resume-root` in the laptop view and **all of `#app`** in the résumé view. Without JS there is no `data-view`, so both views show. | Hiding `#app` (not only `.track`) also hides the `#app:empty` reservation, the park and the toasts. A deep link then paints only the résumé, with no reserved dark block above it. |
| V2 | **Laptop runway = dive + a 120 px open plateau, nothing after it.** `--track-h: calc(200vh + 120px)`. `R = trackH − stageH`, `diveEnd = R − min(PLATEAU_PX, floor(R/3))`. The document ends at `R`, and `[diveEnd, R]` is the open laptop (z = 1). There are no out, tail or past segments. **Challenge to "dive only":** keep a short plateau at the end. | (a) The browser's own scroll clamp stops every flick, fast notches, Space, PageDown and End at the open laptop, so no detent or snapping is needed. (b) The plateau absorbs viewport-height changes (iOS toolbar ±50–90 px, small window resizes) without dropping out of "open". With "document end = diveEnd" exactly, any growth leaves z ≈ 0.95 with no scroll event, so no settle runs and the laptop sticks half-open. (c) A small accidental upward nudge (one jitter, a chained window gesture) does not start closing the laptop. (d) The H = 1000 reference numbers stay as they are (`diveEnd 1000`), and `R = 1120` replaces `insideEnd`. |
| V3 | **The programmatic "open" target is the document end `R`, not `diveEnd`.** This covers `enter()`, the forward settle, `unpark('open')` and the resize "open stays open" rule. | Resting at the bottom of the plateau gives it its full absorbing power (V2b). It also means a downward scroll from the open laptop does nothing, which is exactly "can't keep scrolling". |
| V4 | **Delete** the snap rail, `html.runway-snap`/`snap-hold`, `glide`'s `hold`, the wheel detent (`createDetent`, `onWheel`, the non-passive `#stage` listener, the `detent` store field), `arrowStep`/`scrollerFor`, `snapPoints`, `wheelPixels`, `RUNWAY_SNAP`, `SNAP_GRID_PX`, `ARROW_STEP_PX`, the `DETENT_*` constants, `scrollToResume.js` and `ctrl.goToResume`. **Keep** `glide.to/jump/cancel/owns/onScroll`, `scrollIdle` (own/dir/travel), the dive-only settle, the cue, R8 hysteresis, the window `wheel` grace hold and `pinScroll`. | Snapping existed only to stop flicks at the plateau inside a longer document (plan-r2 §7.1). The document end now does that natively. `owns` stays because glide frames and jumps must still never count as user direction (U7). |
| V5 | **Resize rule** (`relayout`, pure): (1) if the page was open (`interactive`) and at rest (`s` unchanged since the last frame, which the controller tracks), and either `s < L1.diveEnd`, or it sat at the old document end (`s ≥ L0.R − 1`) and `|L1.R − L0.R| ≥ 1`, jump to `L1.R`; a page the visitor is moving is never pulled, and the idle settle finishes it by direction; (2) the desk stays the desk; (3) mid-dive, keep the dive fraction only when `|ΔR|/R0 > REMAP_THRESHOLD`; (4) a glide the controller started is re-aimed at its end (`open`/`desk`) in the new layout. | (1) covers growth larger than the plateau, and keeps a laptop resting at the end at the new end after a small change (the mobile toolbar, a small window resize), so one notch up does not close it. Both open rules need a page at rest, so a visitor scrolling through a resize (for example up to the desk while the toolbar shows) is never pulled back open. (4) fixes "a resize during a glide ends mid-dive, and the zero-travel settle then closes it". |
| V6 | **The controller parks.** `ctrl.park(where?)` freezes the laptop and records `returnTo`. `ctrl.unpark(where = returnTo)` re-measures and jumps to the place. While parked, `update`/`settle`/`enter` are no-ops and `exit()` only sets `returnTo = 'desk'`. `store.parked` drives the ticker (WebGL and wallpaper stop). | One authority for "the laptop is not on screen". Timers can still fire while parked: terminal `exit` (400 ms), `shutdown` → `ctrl.exit` (≈1.5 s), a frozen floppy tween on return. This rule makes them safe. |
| V7 | **`returnTo` rule:** a controller glide in flight → its end; else `z ≥ 0.5` (from the measured `s`) → `'open'`, else `'desk'`; no scene (`unavailable`) → `'desk'`. | It is simple, testable, and matches "never half-open" (a mid-dive exit lands on the nearer end). |
| V8 | **History.** Button entry does `pushState({jwView:'resume', from:'laptop'}, '', '#resume')`. "← Laptop view" and "Open the laptop" call `history.back()` when `history.state?.from === 'laptop'`; otherwise they `pushState({jwView:'laptop'}, '', pathname+search)`. `popstate`, `hashchange` and `pageshow` re-sync the view from the hash and never write history. `history.scrollRestoration = 'manual'`. **No laptop entry is inserted under a deep link.** | `back()` avoids stacking duplicate entries. Inserting an entry at load would be skipped by Chrome's history-manipulation intervention (no user activation), so it would not work reliably. Back from a deep-linked résumé leaves the site, as browsers normally do. Manual restoration stops the browser from restoring a stale offset into the wrong view during traversal. Side effect: a reload always starts at the top of its view. |
| V9 | **Fade only for button switches.** Veil fades in for `VIEW_FADE_MS` (150), swap, fades out for 150 ms, ≈ 0.3 s in total. History-driven switches (Back, Forward, typed hash, pageshow) and reduced motion are instant. For the button's own `back()`, the swap happens at the end of its fade; the later `popstate` is then a no-op. | iOS and Android back gestures animate on their own, so a second fade would double the transition. The button path keeps the owner's fade without depending on `popstate` timing. |
| V10 | **The first paint has no flash and the no-JS case stays safe.** A tiny classic inline `<script>` in `<head>` sets `data-view="resume"` only for a résumé hash. `data-view="laptop"` is set by `views.init()` in `main.jsx`. **Challenge:** the inline script does not also set "laptop". | Hiding the résumé before JS proves it runs would leave a blank page if the bundle fails. Until `main.jsx` runs, the résumé sits below the reserved `#app:empty` block (off-screen), so hiding it then is invisible: no CLS, nothing visible changes. |
| V11 | **Résumé section hashes count as the résumé view:** `RESUME_IDS = ['resume','about','experience','projects','skills','contact','trophies']`. A section hash scrolls to that section. | Otherwise `/#projects` would land in the laptop view on a hidden target. A test keeps index.html, `RESUME_IDS` and `Resume.jsx` in sync. |
| V12 | **Focus.** Entering by `#resume` focuses `#resume-title` (`preventScroll`). A section hash scrolls only. Return focuses the opener if it is visible, else `#hud-exit` (open) or `#hud-resume` (desk / fallback). The initial load moves no focus. | Focus must never be left on a hidden element. Safari does not focus buttons on click, so the fallbacks matter there. |
| V13 | **The "← Laptop view" button lives in `Resume.jsx`** (prerendered, right after `h1#resume-title`). It is hidden by CSS unless `html[data-view="resume"]`, and is `position:fixed` in the top-left corner. The skip link is hidden in the résumé view. | The switch focuses the title, so the button is the first Tab stop after it; its hydration matches the prerendered markup, and without JS it never shows. |
| V14 | **Labels drop "↓"**, because the résumé is no longer below. HUD `Résumé`, pill `Read the résumé`, Recruiter `Full résumé`, résumé header `Open the laptop`; ◆ `Résumé` and ResumeApp `Read the full résumé` stay. | They are views now, not scroll destinations. |
| V15 | **Inner scrollers contain chaining on fine pointers only** (`@media (hover:hover) and (pointer:fine)` sets `overscroll-behavior-y: contain` on `.wb`/`.t-out`); touch keeps native chaining. The laptop view's canvas background is `--scene`. | The headless UX pass showed a desktop wheel burst at a short window's edge chaining through the 120 px plateau and closing the laptop, so mouse and trackpad scrolling stays inside the window. On touch, browser latching keeps momentum inside a window and a new gesture at a window edge chains to the page: downward does nothing (document end), upward enters the plateau before anything closes. `contain` there would make scroll-to-close nearly impossible on phones, where compact windows fill the screen. Containment only applies while the window or terminal actually scrolls: one too short to scroll behaves like the desktop behind it, so a wheel over it opens or closes the laptop, which is the intended model. A hybrid device whose primary pointer is fine (a touchscreen laptop) gets containment for touch too; Esc, ⏏ and scrolling outside the windows still close the laptop there. The dark background removes the light-grid flash during root rubber-banding. |
| V16 | **Esc in the résumé view does nothing.** Keys there do not press 3D keys or play key clicks. Konami still unlocks; its toast is in the hidden stage, so it is not seen until the laptop view. The Recruiter view and the ◆ menu are closed when leaving the laptop. | Owner: only a click returns to the laptop. Space paging through the résumé should not click. |
| V17 | **A deep link does not load the 3D scene until the laptop view is first shown.** `SceneMount` waits for the first unparked moment. | Recruiters landing on `#resume` do not pay for the ~137 kB gzip three.js chunk or the GPU init. This also avoids building a renderer on a `display:none` stage. |
| V18 | **Print** shows the résumé from either view. | `display:none` would otherwise print the scene. Cheap. |
| V19 | **No-WebGL fallback = two views as well:** a flat OS with no document scroll (`.track.flat-runway` is `height:auto` and the résumé is hidden), and the résumé view. The buttons are the same. | It is the same model with nothing scroll-linked. |

Superseded in plan-r2: R2, R5, R10's note on the scroll after the stage, §2.1 geometry, the §2.2 rows for the résumé, PageDown/End, Tab and `#resume`, and U1–U5, U8 and U9's tail/out wording. D11 ("résumé below") is replaced by V1.

---

## 2. Final model and invariants

### 2.1 Geometry (laptop view)

```
document y →
0 (track top)                      diveEnd = R − P                R = trackH − stageH = document end
|------------- dive --------------|=== open plateau (P px) ===|
z:  0 ───────────────────────────► 1             1             1
P = min(PLATEAU_PX 120, floor(R/3)); track = calc(200vh + 120px); stage sticky 100dvh, pinned for all s.
```
Reference numbers (H = stageH):

| H | trackH | R | diveEnd |
|---|---|---|---|
| 1000 | 2120 | 1120 | 1000 |
| 720 | 1560 | 840 | 720 |
| 600 | 1320 | 720 | 600 |
| 844 | 1808 | 964 | 844 |

Small and degenerate cases: `trackH 300, stageH 200` gives `R 100, diveEnd 67`. `trackH ≤ stageH` gives `R 1, diveEnd 1`.

### 2.2 Invariants (numbered, testable)

1. **I1:** With JS, `html[data-view]` is always `laptop` or `resume`. `laptop` means `#resume-root` is `display:none`. `resume` means `#app` is `display:none`. Without JS there is no attribute, so both show.
2. **I2:** In the laptop view the document height is the track height. Max scroll equals `R` (±1 px). Every reachable `s` has the stage pinned. No position past the open laptop exists.
3. **I3:** `poseAt(s)` gives `z = s/diveEnd` for `0 < s < diveEnd`, and `z = 1` for every `s ≥ diveEnd`.
4. **I4:** No non-passive wheel or touch listener exists anywhere. No stylesheet declares `scroll-snap-*` or `scroll-behavior`. Keydown never calls `preventDefault` for scroll keys.
5. **I5:** A rest in the dive glides to `0` or `R` by the last user direction (U6 rules). A rest at the top or on the plateau never glides. Programmatic scrolls (glide frames, `jump`, unpark) never set the direction.
6. **I6:** `enter()`, the forward settle, `unpark('open')` and "open stays open" all target `trackTopDoc + R`.
7. **I7:** On a layout change:
   - open with `s < L1.diveEnd` jumps to `L1.R`;
   - `s = 0` stays;
   - mid-dive keeps its fraction only if `|ΔR|/R0 > 0.15`;
   - an active controller glide is re-aimed at its end in the new layout.
8. **I8:** Scrolling never changes the view. Only these do: the entry controls, "← Laptop view", "Open the laptop", history traversal and hash changes, and the initial URL.
9. **I9:** While `ctrl.store.parked`:
   - `update`, `settle` and `enter` do nothing;
   - `exit` sets `returnTo='desk'`;
   - the bindings ignore window scroll and stage resize;
   - the ticker is stopped.
10. **I10:** `park()` records `returnTo` per V7. `unpark()` restores it. `unpark('open')` forces open. In the fallback, unpark is always the desk.
11. **I11:** The view is the hash: résumé exactly when `viewForHash(location.hash) === 'resume'`, for every settled state. Button entry pushes one entry. "← Laptop view" either goes back one entry or pushes one (V8). `popstate`, `hashchange` and `pageshow` never write history.
12. **I12:** Button switches: the veil turns on at t = 0 and the swap happens at `VIEW_FADE_MS`; the veil is off after the swap, with its opacity transition at 150 ms. Requests during a fade-in are ignored. A popstate during a fade-in cancels the pending swap and wins. History-driven switches and reduced motion never turn the veil on.
13. **I13:** Order of operations: `park()` runs before `data-view` becomes `resume`, so it measures a visible track. `data-view` becomes `laptop` before `unpark()`, so it measures a visible track.
14. **I14:** Focus follows V12. The résumé view always starts at scroll 0, or at the hashed section.
15. **I15:** A résumé hash on load gives `data-view="resume"` before first paint. CLS is 0 in both entry paths.
16. **I16:** The no-WebGL laptop view has `scrollHeight === innerHeight` (no document scroll).
17. **I17:** While the first view is the résumé, `loadScene` is not called. It is called once, on the first unpark, and is never disposed by a later park.
18. **I18:** In the résumé view, Esc changes nothing, keys do not call `scene.api.pressKey` or `snd.click`, and Konami still unlocks.

### 2.3 Inputs

| View / input | Behaviour |
|---|---|
| Laptop: wheel, trackpad, touch, keys, scrollbar at the desk or mid-dive | Native; the camera follows. Flicks, fast notches, Space, PageDown and End all stop at the document end (open). |
| Laptop: scroll up from open | 120 px plateau with z = 1 (stays open), then the dive reverses. A rest mid-dive settles by direction (upward → desk). PageUp from open → mid-dive → settles closed. |
| Laptop: over a scrollable window | Native window scroll. On touch, a new gesture at an edge chains to the page; a mouse or trackpad stays inside the window (V15). |
| Laptop: Esc, ⏏, Shut Down…, terminal `exit`/`shutdown` | `ctrl.exit()` → glide to 0 (unchanged call sites). |
| Laptop: laptop, hotspots, floppies, ★, the glass | `ctrl.enter()` → glide to `R`. |
| Laptop: HUD `Résumé`, pill, Recruiter `Full résumé`, ◆ `Résumé`, ResumeApp, skip link | `app.nav.goToResume()` → résumé view. |
| Résumé: all scrolling | Native window scroll of the résumé only. |
| Résumé: `← Laptop view` | `app.nav.backToLaptop()` → back where they left. |
| Résumé: `Open the laptop` | `app.nav.openLaptop()` → laptop view, open. |
| Résumé: Esc | Nothing (V16). |
| Back / Forward | Instant switch, per the hash. |
| Reduced motion | Glides and switches are instant; the dive stays scroll-linked. |

### 2.4 View state machine (views.js)

```
init: v = viewForHash(hash); replaceState({...state, jwView:v}); scrollRestoration='manual';
      if v==='resume' → ctrl.park('desk'); setView(v)
laptop --toResume(btn)--> park(); pushState(resume, from:laptop); [veil 150] swap→resume (beforeLeave, scrollTo 0 | section, focus title) [veil out]
resume --toLaptop(btn)--> [veil 150] (state.from==='laptop' ? back() : pushState(bare)); swap→laptop (setView, unpark(place), focus) [veil out]
any    --popstate/hashchange/pageshow--> v=viewForHash(hash); cancel pending fade; if v≠current: instant swap (park first when →resume)
```

---

## 3. Per-file changes

### New

**`src/stage/views.js`**

```js
export const RESUME_IDS = ['resume', 'about', 'experience', 'projects', 'skills', 'contact', 'trophies']
export function viewForHash(hash) // '#resume' | '#<section>' → 'resume'; anything else (incl. '', '#top', malformed) → 'laptop'
export function createViews({
  doc = globalThis.document, win = globalThis.window,
  laptop,            // { park(where?) → where, unpark(where?) → whereUsed, beforeLeave() }
  reduce = () => false, timers, fadeMs = VIEW_FADE_MS,
  isVisible = (el) => Boolean(el?.isConnected && el.getClientRects().length),
  fallbackFocus = { open: '#hud-exit', desk: '#hud-resume' },
}) → {
  store,                    // createStore({ view: 'laptop', switching: false })
  get(),                    // current view
  init(),                   // reads the hash, sets data-view, replaceState, scrollRestoration, listeners; returns dispose
  toResume({ opener, hash = '#resume' } = {}),
  toLaptop({ place } = {}), // place: 'open' | 'desk' | undefined (returnTo)
  dispose(),
}
```

Behaviour is §2.4 exactly. Details:
- **Veil:** `ensureVeil()` lazily appends `<div class="view-veil" aria-hidden="true">` to `doc.body`. A fade sets `veil.dataset.to = target` and adds `on`. After `fadeMs` it runs the swap and removes `on`. `switching` is true only during the fade-in.
- **Opener:** the default opener is `doc.activeElement` when it is inside `#app`, else `null`.
- **Swap to résumé:** `laptop.beforeLeave()` → `setView('resume')` → `win.scrollTo({top:0, behavior:'instant'})` → for a section hash, `doc.getElementById(id)?.scrollIntoView({block:'start'})`; for `#resume`, `doc.getElementById('resume-title')?.focus({preventScroll:true})`.
- **Swap to laptop:** `setView('laptop')` → `where = laptop.unpark(place)` → focus the opener if `isVisible(opener)`, else the fallback for `where` if it is visible → clear the opener.
- **`toResume` in the résumé view:** no push; scroll to the top or the section and focus as above.
- **`toLaptop` in the laptop view:** a no-op.
- **`setView(v)`:** `doc.documentElement.setAttribute('data-view', v)` and `store.set({view: v})`.
- **Errors:** `history` and `scrollRestoration` calls are wrapped in try/catch, for sandboxed iframes.

**`src/stage/views.test.js`** (see phase R3-2).

**`src/styles/views.css`** (imported in `main.jsx` after `resume.css`):

```css
/* plan-r3 V1: two views. No data-view (no JS) shows both, for crawlers and no-JS readers. */
html[data-view="laptop"] #resume-root{display:none}
html[data-view="laptop"] body{background:var(--scene)}
html[data-view="resume"] #app,html[data-view="resume"] .skip{display:none}
/* V13: the way back, pinned in the top-left corner of the résumé view only. */
.r-back{display:none}
html[data-view="resume"] .r-back{display:inline-flex;align-items:center;gap:6px;position:fixed;z-index:60;top:max(12px,env(safe-area-inset-top,0px));left:max(12px,env(safe-area-inset-left,0px));min-height:40px;font:12px var(--f-px);padding:9px 12px;border:2px solid var(--ink);background:var(--paper);color:var(--ink);cursor:pointer;box-shadow:3px 3px 0 var(--line)}
html[data-view="resume"] .r-back:hover,html[data-view="resume"] .r-back:focus-visible{background:var(--ink);color:var(--paper)}
@media (max-width:600px){html[data-view="resume"] .r-head{padding-top:72px}}
/* V9: the switch veil, in the destination's background. */
.view-veil{position:fixed;inset:0;z-index:1000;opacity:0;pointer-events:none;background:var(--scene);transition:opacity .15s ease}
.view-veil[data-to="resume"]{background:var(--bg)}
.view-veil.on{opacity:1;pointer-events:auto}
/* V18 */
@media print{html[data-view] #app{display:none}html[data-view] #resume-root{display:block}.r-back,.view-veil{display:none!important}}
```

**`src/styles/views.css.test.js`** (phase R3-2).

### Change

- **`src/core/constants.js`:**
  - Replace lines 11–14 with `TRACK_VH = 200` (stage plus a one-stage dive) and `PLATEAU_PX = 120` (V2), with a comment that `tokens.css --track-h` must be `calc(TRACK_VH vh + PLATEAU_PX px)`.
  - Delete `RUNWAY`, `DETENT_GAP_MS`, `DETENT_RELEASE_UP_PX`, `DETENT_BASELINE_DECAY`, `DETENT_LAG_PX`, `PLATEAU_MIN_PX`, `SNAP_GRID_PX`, `ARROW_STEP_PX` and `RUNWAY_SNAP`.
  - Rename `SNAP_OWN_TOL_PX` to `OWN_TOL_PX = 5` ("a scroll within this many px of the glide's last write is its own; covers the browser clamping the final write at the document end").
  - Add `VIEW_FADE_MS = 150`.
  - Reword the `SETTLE_GRACE_MS` comment ("a wheel event", not "on the stage").
- **`src/styles/tokens.css:12-13`:** `--track-h: calc(200vh + 120px);`, with the comment updated.
- **`src/stage/runway.js`:** rewrite.
  - Header: the §2.1 diagram, V2, V3, V5.
  - `runwayLayout({trackH, stageH}) → { R, diveEnd, stageH }`, where `R = max(1, trackH − stageH)`, `P = min(PLATEAU_PX, floor(R/3))`, `diveEnd = max(1, R − P)`.
  - `poseAt(s, L)`: `s ≤ 0` gives `{z:0, seg:'top', u:0}`; `s < diveEnd` gives `{z:u, seg:'dive', u}`; otherwise `{z:1, seg:'inside', u:0}`.
  - `nextInteractive`: unchanged.
  - `settleTarget(s, L, dir, travel = Infinity)`: dive only, with `back = 0` and `fwd = L.R`, and the same U6 rules (`tiny = |travel| < SETTLE_TINY_PX`; `dir>0 → tiny?back:fwd`; `dir<0 → tiny?fwd:back`; `dir 0 → u ≥ .5 ? fwd : back`). It returns `null` outside the dive or when `|target − s| < 1`.
  - `cueOpacity`: `top` → .8, `dive` → `0.8·(1 − ss(0, .15, z))`, otherwise 0.
  - New `relayout(s, L0, L1, wasOpen)`: `wasOpen ? (s < L1.diveEnd ? L1.R : null) : s ≤ 0 || s ≥ L0.diveEnd ? null : |L1.R − L0.R|/L0.R ≤ REMAP_THRESHOLD ? null : Math.round(s / L0.diveEnd · L1.diveEnd)`.
  - Delete `remapScroll`, `snapPoints`, `wheelPixels` and `createDetent`.
- **`src/stage/glide.js`:**
  - Remove the `hold` option, the `writeOnce` hold wrapper and every `hold(…)` call (lines 25, 39–44, 51, 72, 79). `jump(top)` is `stop()` plus one write.
  - `owns` uses `OWN_TOL_PX`.
  - Header: drop U3 and keep U7.
- **`src/stage/controller.js`:** rewrite around the same structure.
  - Deps: drop `scrollTo` and `scrollToResume`. The store is `{ phase, interactive, narrow, parked }`.
  - Delete `snapL`, `snapCleared`, `clearSnap`, `detentHold`, `releaseDetentHold`, `setDetent`, `detent`, `releaseSnap`, `onWheel` and `goToResume`.
  - Add `let returnTo = 'desk'` and `let glideEnd = null`. `glideTo(m, where)` sets `glideEnd` and calls `glide.to(m.trackTopDoc + (where === 'open' ? m.L.R : 0))`.
  - `update()`:
    1. If `parked`, return before measuring.
    2. Layout change (status ≠ unavailable, `prev.R > 1`, `m.L.R > 1`, `R` or `diveEnd` differ): if `glide.active && glideEnd`, call `glideTo(m, glideEnd)`. Otherwise `t = relayout(s, prev, m.L, interactive)`; if `t !== null`, call `glide.jump(m.trackTopDoc + t)` and set `s = t`.
    3. `ctrl.layout = m.L`.
    4. The unavailable branch is unchanged minus `clearSnap`/`setDetent`; the loading branch is unchanged minus `setDetent`; the pose block is unchanged.
  - `applyFlat()`: remove `clearSnap`.
  - `enter()`: returns when parked, when status ≠ ready (the unavailable branch with `scrollTo` is gone; the fallback is already "in") or when interactive; otherwise `glideTo(measure(), 'open')`.
  - `exit()`: when parked, `returnTo = 'desk'` and return; otherwise as now via `glideTo(m, 'desk')`.
  - `settle({dir, travel})`: returns when parked, when not ready or when `glide.active`; for `t !== null` it sets `glideEnd = t === 0 ? 'desk' : 'open'` and calls `glide.to(m.trackTopDoc + t)`.
  - `park(where)`: if already parked, return `returnTo`. Set `returnTo = where ?? (status === 'unavailable' ? 'desk' : glide.active && glideEnd ? glideEnd : poseAt(m.s, m.L).z >= 0.5 ? 'open' : 'desk')`. Then `glide.cancel()`, `glideEnd = null`, `store.set({parked: true})`, and return `returnTo`.
  - `unpark(where = returnTo)`: if not parked, return `null`. Set `store.set({parked: false})`, `m = measure()`, `ctrl.layout = m.L`, `w = status === 'unavailable' ? 'desk' : where`, `glide.jump(m.trackTopDoc + (w === 'open' ? m.L.R : 0))`, call `ctrl.update()`, and return `w`.
  - Add a `get returnTo()` getter.
  - Header: rewrite (R1, V2–V7).
- **`src/stage/useStageBindings.js`:**
  - Drop the `railRef` param and `dom.rail` (lines 35, 43); the `arrowStep`/`scrollerFor` import (16) and the keydown step branch (195–208); `lastScroller` (167, 177); the detent block (132–148) and its cleanup (223–225); and `ctrl.releaseSnap` (229).
  - IO (78–87): `if (en.isIntersecting && !ctrl.store.get().parked) ticker.start(); else ticker.stop()`.
  - New subscription to `ctrl.store`: on `parked` → true, `ticker.stop()` and `ui.store.set({stageVisible:false})`; on → false, `ticker.start()` (do not wait for the IO).
  - RO (90–93): `if (ctrl.store.get().parked) return` first. A `display:none` stage reports 0×0, which would otherwise flip `narrow` and compact the OS. The RO fires again with the real size when the stage is shown, before paint.
  - Scroll listener (160–165): `if (ctrl.store.get().parked) return` first.
  - `onIdle` (103–105): also skip when parked.
  - Header (2–10): rewrite (no snapping, no detent; parked gating).
- **`src/stage/Stage.jsx`:** remove `railRef` (30, 32) and the rail div plus its comment (48–49).
- **`src/stage/SceneMount.jsx` (V17):**
  - `const [live, setLive] = useState(() => !app.ctrl.store?.get?.().parked)`.
  - An effect, while `!live`, subscribes to `app.ctrl.store` and calls `setLive(true)` on the first unparked state.
  - The loading effect returns early unless `live`; its deps gain `live`. Status stays `'loading'` while waiting.
- **`src/app/createApp.js`:**
  - Delete the imports at lines 15–18, `dom.rail`, `snapSupported`, `snapHolds`, `syncHold`, `holdSnap`, `ui.setSnap`, `ui.holdSnap`, the glide `hold` option, `scrollTo`/`scrollToResume` in the controller deps, and `ctrl.releaseSnap` in `dispose`.
  - After `app.ctrl`, add:

    ```js
    app.views = pick('views', () => createViews({
      laptop: {
        park: (w) => app.ctrl.park(w),
        unpark: (w) => app.ctrl.unpark(w),
        beforeLeave: () => { app.ui.store.set({ recOpen: false }); app.os.setMenu?.(false) },
      },
      reduce: () => app.motion.reduce(), timers: app.timers.child(),
    }))
    app.nav = pick('nav', () => ({
      goToResume: (o) => app.views.toResume(o),
      openLaptop: () => (app.views.get() === 'resume' ? app.views.toLaptop({ place: 'open' }) : app.ctrl.enter()),
      backToLaptop: () => app.views.toLaptop(),
    }))
    ```

  - `dispose`: add `app.views?.dispose?.()`.
  - `init()` is **not** called here, so tests stay free of history listeners.
- **`src/main.jsx`:**
  - `import './styles/views.css'`.
  - After `createApp()`: `app.views.init()` (before `createRoot`, so a deep link parks the controller before the Stage mounts).
  - Skip link (31–36): `app.nav.goToResume()`, unchanged; update the comment.
- **`index.html`:**
  - After line 5, add:

    ```html
    <!-- plan-r3 V10: a résumé link shows the résumé view from the first paint. Ids = RESUME_IDS (src/stage/views.js). -->
    <script>/^#(resume|about|experience|projects|skills|contact|trophies)$/.test(location.hash)&&document.documentElement.setAttribute('data-view','resume')</script>
    ```

  - Keep the `<noscript>` (line 24) and the skip link (line 27).
- **`src/styles/stage.css`:**
  - Delete lines 14–20 (the snap block).
  - Line 53 comment: "Read the résumé".
- **`src/styles/os.css:88`:** comment only ("Read the résumé" pill).
- **`src/styles/resume.css:1,26`:** comments ("Résumé view"). `#app:empty{height:var(--track-h)}` stays.
- **`src/resume/Resume.jsx`:**
  - Header comment (1–4): "the résumé view".
  - Right after `h1#resume-title` (not before `<main>`, which Tab from the focused title would skip): `<button type="button" className="r-back" id="r-back" onClick={() => app.nav.backToLaptop?.()}><span aria-hidden="true">←</span> Laptop view</button>`. The accessible name is "Laptop view".
  - Lines 98–102 comment: "switches to the laptop view, open".
  - Line 135: `Open the laptop`. `href="#top"` stays for no-JS.
- **`src/resume/entry-server.jsx:17`:** `nav: { goToResume: noop, openLaptop: noop, backToLaptop: noop }`.
- **`src/stage/Hud.jsx:17-19`:** label `Résumé`; update the header comment.
- **`src/stage/ExitPill.jsx`:** label `Read the résumé`, title `Switch to the résumé (Esc closes the laptop)`; update the header.
- **`src/stage/RecruiterView.jsx:77-85`:** `onClick={() => { close(); app.nav.goToResume({ opener: returnFocusRef?.current ?? null }) }}`, label `Full résumé`.
- **`src/stage/keys.js:58-79`:** `const inResume = app.views?.get?.() === 'resume'`. `pressKey` and the click run only when `!inResume`. The `Escape` block runs only when `!inResume`. Konami tracking and unlock are unchanged.
- **`src/test/setup.js` `afterEach`:** add `document.documentElement.removeAttribute('data-view')`, `document.querySelectorAll('.view-veil').forEach((e) => e.remove())` and `history.replaceState(null, '', '/')`.
- **`README.md:3-9`:** describe the two views (scroll opens and closes the laptop; "Résumé" switches; "← Laptop view" returns; `#resume` deep-links). The architecture line at 72 drops "runway" wording.

### Delete

- `src/stage/snapRail.js` and `snapRail.test.js`, `src/stage/arrowStep.js` and `arrowStep.test.js` (phase R3-1).
- `src/stage/scrollToResume.js` (phase R3-2).

---

## 4. Edge cases (decided)

| Case | Behaviour |
|---|---|
| Resize while in the résumé view | Nothing is measured while parked. `unpark` measures after `data-view=laptop` and sets `ctrl.layout` fresh, so no stale remap. `open` lands on the new `R`. `narrow` and `refit` come from the stage RO, which fires on show before paint. |
| Resize while open | Growth up to the plateau (≤ ~120 px) stays inside. Larger growth while `interactive` and at rest jumps to the new `R`, and so does any change while resting at the document end (V5). A page the visitor is moving is left to the settle. Shrink: the browser clamps to the new max, which is inside. |
| Mobile `dvh` / iOS address bar | `R` is measured (R3), so the document end is `R` with the toolbar shown or hidden. The toolbar showing on an upward gesture from open is absorbed by the plateau. A page at rest at the document end follows the end when the toolbar changes `R` (V5), so it stays at the end. A page still moving in that frame is never pulled (V5), so a visitor who has already scrolled past the plateau is left to the settle; this stays on the manual iPhone check. |
| bfcache / `pageshow` | On `persisted`: `onPop()` re-syncs the view from the hash, the veil is forced off and `switching` is cleared. The ticker resumes with rAF. |
| Hash typed manually | `popstate` and `hashchange` → `viewForHash`. `#resume` or a section → résumé (instant; parks first). `#top`, `#foo` or empty → laptop. Both events firing is idempotent. A typed-hash entry has `state === null`, so "← Laptop view" pushes instead of going back (going back could land on another résumé entry). |
| `#resume` without JS | No `data-view`; `noscript` zeroes `#app:empty`; the résumé is at the top; `.r-back` stays hidden; the skip link and "Open the laptop" (`#top`) are plain fragment links. |
| Bundle fails with JS on | No résumé hash: the page looks as it does today (dark reserved block, then the résumé). Résumé hash: only the résumé shows. |
| Recruiter dialog open when the view changes (only possible through Back/Forward) | `beforeLeave` closes it and the ◆ menu. Focus goes to `#resume-title`; the dialog's focus-return effect sees focus already moved and leaves it. |
| Recruiter "Full résumé" | Closes the dialog, then enters the résumé with `opener = #hud-rec`, so the return focuses the Recruiter view button. |
| Konami in the résumé view | Its arrows scroll the résumé natively. It unlocks, and the résumé's trophy count updates live. The toast and disco happen in the hidden stage (accepted). No settle runs (parked). |
| Esc in the résumé view | Nothing (V16). |
| Terminal `exit`/`shutdown`, ◆ Shut Down… landing while in the résumé view | `exit()` sets `returnTo='desk'`, so the return lands on the closed desk (the OS is off after a shutdown). |
| Floppy insert in flight when leaving | The tween freezes with the ticker and finishes on return, calling `ctrl.enter()` in the laptop view (opens with that app). Accepted. |
| Hotspot clicks or `openLid` while parked | Impossible (the stage is `display:none`). `enter()` is a no-op anyway. |
| Double clicks, a switch during a fade | Ignored while `switching`. Popstate cancels the pending swap and wins. |
| Glide in flight when leaving | `park` uses its end (V7), then cancels it. |
| Leaving mid-dive | `z ≥ .5` → open, otherwise the desk. |
| Deep link, then "← Laptop view" | `pushState('/')`, desk, and the scene starts loading now (V17). Back → résumé. |
| Reload in either view | It starts at the top of that view (`scrollRestoration='manual'`). `history.state.from` survives the reload; Back after a reload may reload the previous entry, which is fine. |
| Find in page from the laptop view | Résumé text is not found (`display:none`). Accepted; `hidden="until-found"` and `beforematch` would be Chrome-only and were rejected. |
| No WebGL | The laptop view is the flat OS with no document scroll. `park` and `unpark` are always the desk. Return focus goes to `#hud-resume`. "Open the laptop" just shows the flat OS. |
| Vercel Analytics | Hash-only `pushState` may or may not count as a page view. Check in the dashboard; not a blocker. |
| Printing | The résumé prints from either view (V18). |

---

## 5. Phases (TDD)

### Phase R3-1: laptop runway = dive + open plateau; remove snapping and the detent

**Goal.** The laptop document ends at the open laptop. Nothing intercepts scrolling. The settle covers the dive only. Resize rules follow V5. This interim build is **not shippable**, because the résumé still follows in flow. Phase R3-2 fixes that.

**TEST LIST (write first)**

1. `src/stage/runway.test.js`: rewrite.
   - **Delete** the `snapPoints`, `wheelPixels` and all three `createDetent` describes, the U8 tests and the out/tail/past `poseAt` tests.
   - **`runwayLayout`:**
     - `{2120,1000}` → `{R:1120, diveEnd:1000, stageH:1000}`
     - `{1560,720}` → `R 840, diveEnd 720`
     - `{1808,844}` → `964/844`
     - `{300,200}` → `R 100, diveEnd 67`
     - `{900,1000}` → `R 1, diveEnd 1`
     - For H in `[390, 600, 720, 844, 900, 1000, 1366]` with `trackH = 2H + 120`: `R − diveEnd === 120` and `diveEnd === H`.
   - **`poseAt` (H 1000):**
     - `0` → top
     - `500` → dive, z .5
     - `999` → dive
     - `1000`, `1060` and `1120` → inside, z 1
     - `1500` → inside (no past segment)
     - Invariant: for every `s` from 0 to R in steps of 10, `seg ∈ {top, dive, inside}`.
   - **`settleTarget` (H 1000):**
     - `(300,+1,300)` → 1120; `(100,+1,100)` → 1120; `(900,−1,100)` → 0; `(10,+1,10)` → 0; `(990,−1,10)` → 1120; `(500,0,0)` → 1120; `(499,0,0)` → 0; `(300,+1)` with travel omitted → 1120; `(999.5,+1,100)` → 1120.
     - Null for `0`, `1000`, `1060` and `1120` with dir ±1 and travel 100.
   - **`cueOpacity`:** top .8; dive z .075 → .4 (3 dp); dive z .5 → 0; inside → 0.
   - **`relayout`** (L0 = 2120/1000, L1 = 1320/600, L2 = 2220/1050, L3 = 2720/1300):
     - `(1120,L0,L2,true)` → null
     - `(1000,L0,L2,true)` → 1170
     - `(1120,L0,L3,true)` → 1420
     - `(720,L0,L1,true)` → null
     - `(0,L0,L1,false)` → null
     - `(500,L0,L1,false)` → 300
     - `(500,L0,L2,false)` → null
     - `(1060,L0,L1,false)` → null
2. `src/stage/glide.test.js`:
   - **Delete** `describe('snap hold (U3)')`.
   - The `jump` test (154) keeps "stops the glide, writes 640 once" without hold assertions.
   - `owns` tests are unchanged in value (5 px) but import `OWN_TOL_PX`.
   - Add: `createGlide` ignores an unknown `hold` option (no call), which guards against a stale caller.
3. `src/stage/controller.test.js`:
   - **Harness:** `trackH 2120`; drop `ui.setSnap`, `scrollTo` and `scrollToResume` from `setup()`.
   - **Keep, with values unchanged:** 1, 2, the HUD test, 3, 4, 6, 11 (loading at 1000 → cue 0; at 0 → .8), 12, 12n and 16.
   - **Rewrite:**
     - 5: `1060` and `1120` are inside with z 1; after `at(1120)` → `at(1060)` it stays inside (plateau).
     - 7: `enter()` from 0 and 500 → `lastTo() === 1120`; no-op inside, loading or interactive.
     - 7b: unavailable → no `glide.to`.
     - 8: `exit()` from inside → `glide.to(0)`.
     - 10: `settle({dir:1,travel:100})` at 100 → `to(1120)`; `{1,10}` at 10 → `to(0)`; `{−1,200}` at 900 → `to(0)`; at 1060 and 1120 → not called; `glide.active` → not called.
     - 13:
       - (a) at 500, then stage 600 / track 1320 → `glide.jump(300)`;
       - (b) at 500 → 1050/2220 → no jump;
       - (c) inside at 1000 → 1050/2220 → `glide.jump(1170)`;
       - (d) inside at 1120 → 1050/2220 → no jump;
       - (e) `enter()` from 0 (fake `glide.active = true` afterwards), then the layout becomes 1050/2220 → `glide.to(1170)` (re-aimed).
     - 14: for H in [600, 844, 1000] with `trackH = 2H + 120`, `at(trackH − H)` (the document end) → phase inside; every `s ∈ [diveEnd, R]` gives z 1.
     - Cue describe: `at(1120)` → 0.
   - **Delete:** 9 (moves to R3-2 as a deletion; keep it in this phase only if `goToResume` is still present), 14b, 15, 15b, 15c, 15d, 15e, 15f, and `describe('snap rail sync')`.
4. `src/stage/Stage.test.jsx`:
   - **Delete** 16, 16b, 16c, 19, "the snap rail is …", "unmount calls ctrl.releaseSnap", `describe('arrow keys step 40 px …')` (all nested) and "scene status ready then unavailable removes runway-snap".
   - **Rewrite 9:** no `#stage` wheel listener is added (`added.some(a => a.target.id === 'stage' && a.type === 'wheel') === false`); the window `wheel` listener is added with `{passive:true}` and removed; the other window types are as before.
   - Add: no listener in the app is added with `passive:false` for `wheel`, `touchstart` or `touchmove` (scan `added` options).
5. `src/styles/stage.css.test.js`:
   - The track test asserts `tokens` matches `--track-h:\s*calc\(200vh \+ 120px\)`, `TRACK_VH === 200` and `PLATEAU_PX === 120`.
   - **Delete** `describe('snap rules (phase 6A)')`.
   - Add: across every file in `src/styles/`, no declaration matches `scroll-snap-` and none matches `scroll-behavior`.
6. `src/stage/structure.test.js`:
   - Replace the "phase 6A structure" describe with "round 3 structure":
     - `constants` has no `RUNWAY`, `SNAP_GRID_PX`, `ARROW_STEP_PX`, `RUNWAY_SNAP`, `SNAP_OWN_TOL_PX`, `PLATEAU_MIN_PX` or `DETENT_*`;
     - it has `{ TRACK_VH: 200, PLATEAU_PX: 120, OWN_TOL_PX: 5, OWN_MS: 300, SETTLE_TINY_PX: 16, DIR_MIN_PX: 8 }`;
     - `src/stage/snapRail.js` and `arrowStep.js` do not exist;
     - no non-test file under `src/` matches `/runway-snap|snap-hold|createDetent|snapPoints|syncSnapRail|arrowStep/`.
   - Keep the `SETTLE_BIAS` test.
7. `src/app/createApp.test.js`:
   - **Delete** `describe('snap rail and snap classes (phase 6A)')`.
   - Add: `app.dom` has no `rail` key; a `to()` on `app.glide` never adds a class to `<html>`.

**Implementation steps**

1. Update `constants.js` and `tokens.css`.
2. Rewrite `runway.js`.
3. Simplify `glide.js`.
4. Update `controller.js` (everything except park/unpark, which is R3-2): new `update`, `enter`, `exit` and `settle`, `glideEnd`, `relayout`; drop the snap and detent code.
5. Bindings cleanup (detent, arrowStep, rail, releaseSnap).
6. `Stage.jsx`: remove the rail.
7. `createApp.js`: remove the snap code and the glide `hold`.
8. `stage.css`: delete lines 14–20.
9. Delete `snapRail.*` and `arrowStep.*`.
10. Update the header comments.

**Review focus**
- No `preventDefault` remains on wheel or keys.
- `glideTo` is the only place that sets `glideEnd`, and `park` (R3-2) and `cancel` paths clear it.
- `relayout` runs before `ctrl.layout = m.L`.
- The open target is `L.R` everywhere, and `diveEnd` is used only as the z = 1 threshold.
- No leftover imports (lint).
- Header comments do not mention snapping.

### Phase R3-2: two views, history, the back button, routing every entry point

**Goal.** Only the buttons change views. Each view scrolls only itself. Back, Forward and deep links follow the hash. The fade, focus and parking follow §2.

**TEST LIST (write first)**

1. **`src/stage/views.test.js` (new).** Use a fake `win` built by a helper in the test file: `location {hash, pathname:'/', search:''}`, `history {state, scrollRestoration, pushState, replaceState, back}` (`vi.fn`s that update `state` and `location.hash`), `scrollTo: vi.fn()`, `addEventListener`/`removeEventListener` into a map, and `fire(type, e)`. The fake `laptop` is `{ park: vi.fn(() => 'desk'), unpark: vi.fn((w) => w ?? 'desk'), beforeLeave: vi.fn() }`. Use real `document` (`#app` with `#hud-resume`/`#hud-exit` buttons, `#resume-root` with `h1#resume-title[tabindex=-1]` and `section#projects`), `createTimers()` with `vi.useFakeTimers()`, and an injected `isVisible`.
   - `viewForHash`: `''`, `'#top'`, `'#x'` and `'#%E0%A4%A'` (malformed) → laptop; `'#resume'` and `'#projects'` → resume.
   - V1: init with `''` → `data-view` laptop; `replaceState({jwView:'laptop'}, '')`; `scrollRestoration === 'manual'`; `park` not called.
   - V2: init with `'#resume'` → `data-view` resume; `park('desk')` once; `get() === 'resume'`.
   - V3: init with `'#resume'` and state `{jwView:'resume', from:'laptop'}` → replaceState keeps `from`.
   - V4: dispose removes the `popstate`, `hashchange` and `pageshow` listeners.
   - V5 (reduced): `toResume()` → in this order, `park` < `pushState({jwView:'resume', from:'laptop'}, '', '#resume')` < `beforeLeave` < `data-view` resume < `scrollTo({top:0, behavior:'instant'})`; `#resume-title` is `document.activeElement`.
   - V6: `toResume()` while in the résumé → no `pushState`; `scrollTo` top; title focused.
   - V7: `toResume({hash:'#projects'})` → pushes `'#projects'`; `#projects.scrollIntoView({block:'start'})`; the title is not focused.
   - V8 (fade): at 0 ms `park` and `pushState` are called, `.view-veil` exists with class `on` and `data-to="resume"`, and `data-view` is still laptop. At 149 ms it is still laptop. At 150 ms it is resume and the veil has no `on`.
   - V9: a second `toResume()` and a `toLaptop()` during the fade-in → `park` and `pushState` are each called once, and the swap happens once.
   - V10 (reduced): the veil never gets `on` (MutationObserver on the veil class, or a spy on `classList.add`).
   - V11 (reduced): after `toResume()`, `toLaptop()` → `history.back` called once, `pushState` called once in total (the entry push only); `data-view` laptop; `unpark(undefined)`; and `data-view === 'laptop'` **at the moment** `unpark` runs (assert inside the fake).
   - V12: init with `'#resume'` (no `from`), then `toLaptop()` → `pushState({jwView:'laptop'}, '', '/')`; `back` not called.
   - V13: `toLaptop({place:'open'})` → `unpark('open')`.
   - V14 (focus):
     - the opener (`#hud-rec`) is visible → focused after the return;
     - the opener is invisible, `unpark` returns `'open'` and `#hud-exit` is visible → `#hud-exit`;
     - the desk → `#hud-resume`;
     - nothing visible → focus unchanged, no throw.
   - V15: `toLaptop()` in the laptop view → nothing is called.
   - V16 (reduce false): in the résumé, `location.hash = ''` and fire `popstate` → instant (the veil never gets `on`); `data-view` laptop; `unpark` once; no `pushState`, `replaceState` or `back`.
   - V17: in the laptop view, `location.hash = '#resume'` and fire `popstate` then `hashchange` → `park` once, `beforeLeave` once, no `pushState`.
   - V18: `toResume()` (fade), then at 50 ms a `popstate` with hash `''` → at 150 ms no swap to the résumé happens, `data-view` is laptop and the veil is off.
   - V19: `pageshow {persisted:true}` with hash `''` while in the résumé → laptop, veil off.
   - V20: after the V11 `back()`, firing `popstate` with hash `''` → `unpark` is still called only once.
2. **`src/stage/controller.test.js`** (park/unpark; add, and delete test 9):
   - P1: `at(1120)`; `park()` → `'open'`; `store.parked` true; `glide.cancel` called. Then `getTrackRect` spied: `update()` does not call it, and `ui.setCue`/`os.setLive` get no new calls.
   - P2: `park()` at 300 → `'desk'`; at 500 → `'open'`.
   - P3: `enter()` from 100 with `glide.active = true` → `park()` → `'open'`.
   - P4: `park()` at 1120, then the stage changes to 600/1320, then `unpark()` → `glide.jump(720)`; returns `'open'`; phase inside; a following `at(720)` makes no further `jump`.
   - P5: `unpark('desk')` → `jump(0)`; phase desk.
   - P6: unavailable → `park()` returns `'desk'`; `unpark('open')` → `jump(0)` and returns `'desk'`.
   - P7: `park('desk')` makes no measure call.
   - P8: parked, then `exit()` → no `glide.to`; `returnTo === 'desk'`; `unpark()` → `jump(0)`.
   - P9: parked → `settle({dir:1, travel:100})` and `enter()` make no `glide.to`.
3. **`src/stage/Stage.test.jsx`:**
   - Labels: test 1 `Résumé`; test 15 pill `Read the résumé` calls `nav.goToResume`; test 3 `Full résumé` calls `nav.goToResume` with `{ opener: #hud-rec }` and closes.
   - **New:**
     - (a) `app.ctrl.park('desk')`, a window `scroll` event, then 200 ms → `ctrl.settle` not called (spy).
     - (b) parked → `triggerResize(stage, {width: 0, height: 0})` → `ctrl.store.narrow` unchanged and `os.refit` not called.
     - (c) with the rAF faked, parking stops further `ctrl.update` frames; `unpark()` starts them again without any `triggerIntersection`.
     - (d) `triggerIntersection(stage, true)` while parked does not start the ticker.
4. **`src/stage/Hud.resume.test.jsx`** (rewrite; reduced motion via `setReducedMotion(true)`):
   - Render Stage and Resume; click `Résumé` → `data-view` resume, `location.hash === '#resume'`, `#resume-title` focused, `scrollIntoView` not called.
   - Then click `Laptop view` (`#r-back`) → `data-view` laptop and `#hud-resume` focused (stub `getClientRects` on `HTMLElement.prototype` to return `[{}]` for elements not under `[hidden]`).
5. **`src/resume/Resume.test.jsx`:**
   - Test 10: `Open the laptop` calls `nav.openLaptop` once and does not call `scrollTo`.
   - Test 12: the link `Open the laptop` has `href="#top"`.
   - New:
     - the server markup has `button#r-back.r-back[type=button]` named "Laptop view" as the first control after `#resume-title`;
     - a click calls `nav.backToLaptop` once;
     - hydration test 9 still has no mismatch.
6. **`src/stage/keys.test.js`:** with `app.views = { get: () => 'resume' }`:
   - Escape with phase inside → `ctrl.exit` not called;
   - with `recOpen` false, no store change;
   - `scene.api.pressKey` not called and no `snd.click` for `'a'` with sound on;
   - the Konami sequence still unlocks `'konami'`.
   - With `get: () => 'laptop'`, existing tests 5b, 3a and 6 are unchanged.
7. **`src/app/createApp.test.js`:**
   - `app.views.get() === 'laptop'` (no `init`);
   - `nav.goToResume({opener})` → `views.toResume` with it (override `views` with a fake);
   - `nav.openLaptop()` → `ctrl.enter` in the laptop view, and `views.toLaptop({place:'open'})` in the résumé view;
   - `nav.backToLaptop()` → `views.toLaptop()`;
   - `dispose()` calls `views.dispose`;
   - the real views' `laptop.beforeLeave` sets `recOpen` false and calls `os.setMenu(false)`.
8. **`src/styles/views.css.test.js` (new):**
   - `html[data-view="laptop"] #resume-root` is `display:none`;
   - `html[data-view="resume"] #app` and `.skip` are `display:none`;
   - `.r-back` defaults to `display:none` and under `html[data-view="resume"]` is `position:fixed` with `top` and `left` using `env(safe-area-inset-*)`;
   - `.view-veil` is `position:fixed`, `opacity:0`, `pointer-events:none` and `transition: opacity .15s`;
   - `.view-veil.on` has `opacity:1`;
   - `[data-to="resume"]` uses `var(--bg)`;
   - the laptop-view `body` background is `var(--scene)`;
   - no rule outside `@media print` shows `#resume-root` unconditionally.
9. **`src/stage/structure.test.js`:**
   - (a) index.html has exactly one inline classic `<script>` (no `src`, no `type`) placed before the first `<link rel="stylesheet">`. Its regex group split by `|` equals `RESUME_IDS`, and it sets only `data-view` to `'resume'` (it does not contain `'laptop'`).
   - (b) `RESUME_IDS` equals `['resume', ...ids of section.block in renderResumeHtml()]`.
   - (c) `src/stage/scrollToResume.js` does not exist and no source references `goToResume()` on `ctrl`.
   - (d) the skip link test is unchanged.
10. **`src/resume/seo.test.js`:** the transformed head (`headDocument`) still has the inline script verbatim (Vite left it alone); the noscript test is unchanged.
11. **`scripts/prerender.test.mjs`:** `injectResume` on the real `index.html` keeps the inline view script before the JSON-LD script and before `</head>`.
12. **`src/resume/entry-server.test.jsx`:** `createServerApp().nav` has `backToLaptop`.

**Implementation steps**

1. `views.js`.
2. Controller `park`/`unpark`/`returnTo`.
3. `createApp` views and nav.
4. Bindings parked gating (IO, RO, scroll, idle, ticker subscription).
5. `views.css`, imported in `main.jsx`, and `views.init()`.
6. The index.html inline script.
7. `Resume.jsx` back button and label.
8. HUD, pill and Recruiter labels; Recruiter passes the opener.
9. `keys.js` gating.
10. `entry-server` nav stub.
11. `setup.js` resets.
12. Delete `scrollToResume.js` and `ctrl.goToResume` (and controller test 9).
13. Comments in `resume.css`, `stage.css` and `os.css`.

**Review focus**
- The I13 ordering: park before hiding the laptop; show before unpark.
- `pushState` happens only in `toResume`/`toLaptop`, never in event handlers.
- `popstate` is idempotent.
- No focus moves on init.
- The veil is always removed on every path (dispose, pageshow, popstate mid-fade).
- `views.init` is called exactly once, only from `main.jsx`.
- The inline script is classic and tiny, survives the Vite transform and the prerender, and has no `</` sequence.
- `Resume.jsx` render still touches no `window`.

### Phase R3-3: deep-link scene deferral, the no-WebGL two views, print, docs; then the browser pass

**Goal.** A deep link never loads three.js until the laptop is shown. The fallback works as two views. Print shows the résumé. The README matches the behaviour.

**TEST LIST (write first)**

1. `src/stage/SceneMount.wiring.test.jsx` (new describe "deferral (V17)"):
   - with `app.ctrl.park('desk')` before render, `loadScene` (`vi.fn`) is not called after the microtasks flush;
   - after `act(() => app.ctrl.unpark())` it is called once;
   - a later `park()` does not call `api.dispose`;
   - in StrictMode it is still called once alive (mirror existing test 6).
2. `src/stage/Stage.test.jsx` fallback (loadScene resolving null, reduced motion):
   - `app.nav.goToResume()` → `data-view` resume;
   - `app.nav.backToLaptop()` → laptop, `glide.jump` to the track top (spy) and focus on `#hud-resume`;
   - `app.nav.openLaptop()` from the résumé lands on the laptop view with `ctrl.store.interactive` false and the OS still `.live`.
3. `src/styles/views.css.test.js`: the `@media print` block shows `#resume-root` and hides `#app`, `.r-back` and `.view-veil`.
4. `src/stage/structure.test.js`: `README.md` does not contain "Keep scrolling" or "Résumé ↓".

**Implementation steps**
1. `SceneMount` gate.
2. Print block (if it was not done in R3-2).
3. README text.
4. Note the superseded sections at the top of `plan-r2.md` §2 (a one-line pointer to plan-r3).
5. Run section 6.

**Review focus**
- `SceneMount` effect deps do not include `parked` itself, only the latch. If they did, a park would dispose the scene.
- The fallback status is reached only after the first unpark on a deep link.
- No regressions in `Stage.test` 5–7.

**ACCEPTANCE (all phases):** TEST LISTs green; `npm test`, `npm run lint` and `npm run build` green. `git grep -nE "runway-snap|snap-hold|createDetent|arrowStep|scrollToResume|SNAP_GRID|ARROW_STEP" src` prints nothing. Section 6 passes.

---

## 6. Headless-Chrome UX checklist (after R3-3)

**Setup.** `npm run build && npm run preview` (port 4173). Chrome `--headless=new` over CDP, as in plan-r2 §7.1.

**Viewports:**
- 1440×900 and 1280×720 at DPR 1;
- 390×844 at DPR 3 with mobile emulation and touch;
- 844×390.

**Inputs:**
- `Input.synthesizeScrollGesture`: mouse, and touch with `preventFling:false`;
- `Input.dispatchMouseEvent` `mouseWheel` with 100 px notches;
- `Input.dispatchKeyEvent`;
- clicks at element centres.

**Instrumentation:** inject a MutationObserver that logs `performance.now()` for `html[data-view]` changes and the `.view-veil` class. Record `PerformanceObserver('layout-shift', {buffered:true})`. Log the console and network.

**Laptop view (each viewport)**
1. Load `/`:
   - `data-view === 'laptop'`, and `#resume-root` has computed `display:none`;
   - `scrollHeight − innerHeight` equals `R = trackRect.height − stage.clientHeight` (±1); at 1440×900 that is 1020 (900 + 120);
   - the body's computed `background-color` is the `--scene` colour.
2. Touch flick with momentum from the top (0.4 H at 6000 px/s) → rests at max scroll (the document end). Then:
   - `.stage.zoomed` is set and `#flat-host.on` exists;
   - `elementFromPoint` at the centre is inside `.os.live`;
   - a second flick down moves `scrollY` by 0.
3. 12 notches 30 ms apart, and 30 notches, from the top → `scrollY` never exceeds max and rests at max; laptop open.
4. Space ×5, PageDown ×5 and End from the top → each ends at max; Home → 0, closed.
5. 100 px notches 0.7 s apart from the top → every notch moves forward and the page settles open. A single ArrowDown (native 40 px) → settles open.
6. 390×844: a 200 px swipe from the top glides open; a 10 px nudge returns to 0.
7. From open, one 100 px notch up → still `.stage.zoomed` (plateau). A second notch → leaves the plateau and, at rest, glides to 0. PageUp from open → settles at 0.
8. Inside, open Experience.log and scroll its body to the bottom; a new wheel gesture down → page `scrollY` unchanged. At the window top, a new 100 px gesture up → page in the plateau, still open.
9. Resize while open: 1440×900 → 1440×960 → still zoomed, at the new max. → 1440×1200 (> plateau) → still zoomed, at the new max. → 1440×700 → still zoomed.
10. Mid-dive at 40 % after a downward scroll, resize to half the height → the fraction is kept and it settles open.

**Switching**
11. At the desk, click HUD `Résumé`:
    - the veil gets `on` within one frame; `data-view=resume` at 150 ± 30 ms; veil opacity 0 by about 350 ms;
    - `scrollY 0`, `location.hash '#resume'`, `activeElement#resume-title`;
    - CLS adds 0.
12. In the résumé:
    - wheel, gestures, PageDown, Space, End and arrows match native scrolling (S4 ≤ 2 px); End reaches the footer;
    - `#stage` is not displayed;
    - `#r-back`'s rect top is ≈ max(12, safe-area) at `scrollY` 0, mid-page and the end;
    - at `scrollY` 0, its rect does not intersect the `.eyebrow` or the `h1` (1440 and 390).
13. Click `← Laptop view` → laptop at `scrollY 0`, not zoomed; `activeElement#hud-resume`; the URL has no hash; `history.length` is unchanged from before step 11.
14. Flick open, scroll Experience.log to 300, click the pill `Read the résumé`, then `← Laptop view` → at max, zoomed, OS live; `.wb` `scrollTop` 300 (±1); focus on `#hud-exit`.
15. `scrollTo(0.55·diveEnd)`, then click HUD `Résumé` within 100 ms (before the settle). Return → open. Repeat at 0.4 → desk.
16. Browser Back from the résumé (`Page.navigateToHistoryEntry` to the previous entry) → laptop view with **no** veil `on`, where they left. Forward → résumé view at the top.
17. In the résumé, click `Open the laptop` → laptop view, open (at max, zoomed), URL without a hash.
18. Reduced motion (`Emulation.setEmulatedMedia` `prefers-reduced-motion: reduce`): steps 11, 13 and 17 swap in the same task (the attribute log shows the change before the next rAF) and the veil never gets `on`.

**Deep links, history, no JS**
19. A fresh tab at `/#resume` with 6× CPU throttling: capture screenshots from `Page.startScreencast` from the first frame; no frame shows the scene colour block. `data-view=resume` before `DOMContentLoaded`. CLS 0. **No `createScene-*.js` request** until `← Laptop view` is clicked; after it, the request happens and the desk renders. Back → résumé.
20. `/#projects` → résumé view with the `#projects` rect top within ±2 px of 0.
21. From the laptop view, `location.hash = 'resume'` → résumé view (instant); then `location.hash = 'top'` → laptop view.
22. JS disabled (`Emulation.setScriptExecutionDisabled`): on `/` and `/#resume`, the résumé text is visible at the top; `#r-back` is not displayed; the skip link moves to `#resume`. The view source contains the résumé text, the JSON-LD and the inline script.
23. bfcache: in the résumé, navigate to `/robots.txt`, then go back. Record `pageshow.persisted`: if true, the view is still the résumé and the veil is off; if headless disables bfcache, record that.
24. Recruiter view: open it, click `Full résumé` → résumé, focus on the title. Back → laptop at the desk, the dialog hidden, focus on `#hud-rec`.
25. Esc in the résumé → view, `scrollY` and `activeElement` unchanged. Konami in the résumé → the `#trophies` count goes up by 1; no console errors.
26. Keyboard only: load `/`, Tab → the skip link, Enter → résumé (focus on `#resume-title`). Tab → `#r-back` is the next focus. Enter → laptop.
27. No WebGL (`--disable-webgl --disable-3d-apis`), at 1440×900 and 390×844:
    - laptop view `scrollHeight === innerHeight`;
    - HUD `Résumé` → résumé; `← Laptop view` → the flat OS with focus on `#hud-resume`;
    - no element overlaps (the 6B checks still hold).
28. Print (`Emulation.setEmulatedMedia {media:'print'}`) in the laptop view: `#resume-root` is displayed and `#app`, `.r-back` and `.view-veil` are hidden.
29. The console has no errors or warnings in any flow. Log the worst native-vs-actual deviation for 5 and 12.

**Manual, owner on real hardware** (record in the PR):
- MacBook trackpad in Chrome, Safari and Firefox:
  - a hard flick stops at the open laptop and cannot go further;
  - rubber-banding shows the dark scene, not the light grid;
  - a slow two-finger scroll up from open closes smoothly;
  - the résumé scrolls natively.
- iPhone Safari:
  - flick open while the toolbar collapses, and the laptop stays open;
  - one small swipe up from open stays open;
  - the edge-swipe back from the résumé lands on the laptop with no double fade;
  - `#r-back` clears the notch (safe area).

---

## 7. Files touched (quick index)

| Phase | Add | Change | Delete |
|---|---|---|---|
| R3-1 | – | `core/constants.js`, `styles/tokens.css`, `stage/runway.js`, `stage/glide.js`, `stage/controller.js`, `stage/useStageBindings.js`, `stage/Stage.jsx`, `app/createApp.js`, `styles/stage.css`, tests (runway, glide, controller, Stage, stage.css, structure, createApp) | `stage/snapRail.js(+test)`, `stage/arrowStep.js(+test)` |
| R3-2 | `stage/views.js(+test)`, `styles/views.css(+test)` | `controller.js` (park/unpark), `useStageBindings.js`, `createApp.js`, `main.jsx`, `index.html`, `resume/Resume.jsx`, `resume/entry-server.jsx`, `stage/Hud.jsx`, `stage/ExitPill.jsx`, `stage/RecruiterView.jsx`, `stage/keys.js`, `test/setup.js`, css comments, tests (controller, Stage, Hud.resume, Resume, keys, createApp, structure, seo, prerender, entry-server) | `stage/scrollToResume.js` |
| R3-3 | – | `stage/SceneMount.jsx`, `styles/views.css` (print), `README.md`, `design/notes/plan-r2.md` (pointer), tests (SceneMount.wiring, Stage fallback, views.css, structure) | – |

### Critical Files for Implementation
- /Users/jewoo.lee/Desktop/Jewoo/Projects/jewoo-lee/.worktrees/feat-website-revamp/src/stage/controller.js
- /Users/jewoo.lee/Desktop/Jewoo/Projects/jewoo-lee/.worktrees/feat-website-revamp/src/stage/runway.js
- /Users/jewoo.lee/Desktop/Jewoo/Projects/jewoo-lee/.worktrees/feat-website-revamp/src/stage/useStageBindings.js
- /Users/jewoo.lee/Desktop/Jewoo/Projects/jewoo-lee/.worktrees/feat-website-revamp/src/app/createApp.js
- /Users/jewoo.lee/Desktop/Jewoo/Projects/jewoo-lee/.worktrees/feat-website-revamp/src/stage/views.js (new), with /Users/jewoo.lee/Desktop/Jewoo/Projects/jewoo-lee/.worktrees/feat-website-revamp/index.html and /Users/jewoo.lee/Desktop/Jewoo/Projects/jewoo-lee/.worktrees/feat-website-revamp/src/resume/Resume.jsx
