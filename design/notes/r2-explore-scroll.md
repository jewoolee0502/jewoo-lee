# R2 scroll exploration: why the laptop zoom and the page fight

Scope: read-only investigation of the stage scroll/zoom pipeline. The only file written is this note.
Owner reports (verbatim intent):
1. Scrolling should match the machine's native scrolling. It does not today.
2. Zooming into the laptop and then scrolling down can leave the laptop half off-screen with the résumé showing underneath. This must never happen. A button to leave the laptop and open the page below would help.

Verification level: all claims come from reading the code and the existing unit tests. Nothing was run in a browser. Items marked **(unverified in browser)** depend on browser behavior I could not observe here.

---

## 0. Summary

- The camera zoom is a discrete, time-based tween (1.9 s) that fires once when scroll progress `p` passes 0.02. It is not tied to scroll position or velocity (`src/stage/controller.js:59`, `:102`).
- While the camera is zoomed ("inside"), the stage's wheel handler calls `preventDefault` on every wheel event over the stage (`src/stage/wheel.js:20-22`, `:32`). The OS then consumes the wheel as its own input, and only an upward gesture exits.
- Nothing ties "zoomed" to "stage fully on screen". The camera framing ignores `p` (`src/scene/createScene.js:655`, which reads only `ctrl.z`). Once the document scrolls past the pinned range (`p > 1`), the stage starts moving up while the camera stays zoomed. That is the half-laptop state.
- Every input that is not the stage's wheel handler can scroll the document while zoomed: keyboard (Space, PageDown, arrows, End), scrollbar drag, touch pan (`stage.css:5` `touch-action: pan-y`, no `touchmove` handling anywhere), find-in-page, focus moves, in-page anchors, and viewport resizes. None of these checks `mode`.
- Leaving the laptop has several paths (Esc, wheel up, ⏏ Close laptop, Résumé ↓), but the Résumé ↓ button is hidden while zoomed (`stage.css:34`), and ⏏ Close laptop lives inside the OS menu bar, which can itself be off-screen in the bad state.
- Design A (lock the page while zoomed and add an exit button) fixes the half state with a smaller diff, but it takes away native scrolling from the zoomed stage. Design B (scroll-linked zoom with the camera tied to `p`) matches native physics and makes the half state impossible by construction, but it is a larger rewrite and needs a decision on how the zoomed "plateau" behaves. Details in sections 9 and 10.

---

## 1. Layout and geometry

Source: `src/stage/Stage.jsx:36-47`, `src/styles/stage.css:4-5`, `src/main.jsx:12-29`, `index.html:28-29`.

```
#app
  section.track#track   height: 220vh   (stage.css:4, position: relative)
    div.stage#stage     position: sticky; top: 0; height: 100vh/100dvh; overflow: hidden;
                        touch-action: pan-y   (stage.css:5)
      scene-layer, flat-host, Hud, Cue, Toasts, RecruiterView
  div.park              left: -99999px (holds the OS holder while the 3D scene owns it)
#resume-root
  main#resume           Resume.jsx:113 (a second React root, main.jsx:18-29)
```

Let `H` be the viewport height and `s` the document scroll offset.

- The track is 220vh tall, so the pinned range is `trackH - innerHeight = 1.2H`. `p` is `clamp(-trackRect.top / (1.2H), 0, 1)` (`controller.js:38-40`).
- For `s <= 1.2H` (`p <= 1`) the stage is pinned at the viewport top and fully visible.
- For `s > 1.2H` the stage's top becomes `1.2H - s`, so it moves up and is partly off-screen.
- The résumé starts at document y = `2.2H`, so it appears at viewport y = `2.2H - s`.
- **Half-laptop window:** `1.2H < s < 2.2H` (`p = 1` to the end of the track). In that window the stage is partly above the viewport and the résumé is visible at the bottom. The camera is still zoomed if `mode === 'inside'`.

The 220vh value is in `stage.css:4`. The prototype says 320vh in its header comment (`design/revamp-lab.html:7`), but its CSS is 220vh (`:43`). The comment is stale.

`#app:empty { height: 220vh }` in `src/styles/resume.css:27` reserves the same space before hydration, so the value is duplicated in two places.

---

## 2. Event ownership map

| Input | Handler | Blocked while zoomed? | Code |
|---|---|---|---|
| Wheel over `#stage` | `createWheelHandler`, passive:false | Yes, always when `mode==='inside'` and scene ready | `wheel.js:17-44`, `useStageBindings.js:63-68` |
| Wheel over the résumé (after stage has moved up) | none | No, native page scroll | none |
| Scrollbar drag | none | No | none |
| Keyboard (Space, PageDown, arrows, End, Home) | `keys.js:14-30`, never calls `preventDefault` | No | `keys.js` |
| Touch pan on `#stage` | none (`touch-action: pan-y`) | No, except `.flat-host.on.trap` (narrow and interactive only) | `stage.css:5`, `:12-13` |
| Touch pan on `.wb` / `.t-out` inside windows | none (`touch-action: pan-y`) | No | `stage.css:15` |
| Esc | `keys.js:26-28`, only when `interactive` | n/a | |
| Focus moves out of stage | `useStageBindings.js:76-82` calls `ctrl.leave()` | Leaves (no scroll) | `controller.js:116-121` |
| Pointer click on the 3D scene | `createScene.js:596-612` (pointerup, if `z < 0.9`) | Hotspots call `ctrl.enter()` (`hotspots.js:12`, `createScene.js:486`, `:490`) | |

Only the wheel and Escape are wired to the zoom state. Every other input path can move the document with no check on `mode`.

---

## 3. How wheel deltas are mapped

Source: `src/stage/wheel.js`, constants `src/core/constants.js:6-7`.

Order of checks in `onWheel` (`wheel.js:17-44`):

1. `sceneStatus() !== 'ready' || mode !== 'inside'` returns without touching the event (`:19`). On the desk, the page scrolls natively.
2. `!interactive` (the enter tween is still running): `preventDefault` and return (`:20-22`). A flick during the 1.9 s entry tween is swallowed.
3. If the target is inside a window body (`.wb` or `.t-out`) that can still scroll in the gesture's direction, return without preventing (`:24-31`). Scrolling windows is native.
4. Otherwise `preventDefault` (`:32`). A target inside `.win` or `.menu-pop` returns after preventing (`:33`).
5. Accumulate: `if (now - last > 400) acc = 0`, then `acc += e.deltaY` (`:34-37`). `WHEEL_GAP_MS = 400`.
6. `acc < -240` (`WHEEL_EXIT = 240`) calls `ctrl.exit()` and resets `acc` (`:38-40`).
7. `acc > 240` shows the hint toast once per handler lifetime (`:41-44`). `acc` is not reset here.

Properties of this mapping:

- **No deltaMode handling.** `deltaY` is used raw. Chrome and Safari send pixels (about 100 px per mouse notch). Firefox on Windows and Linux often sends `deltaMode === 1` (lines, about 3 per notch). One exit then takes about 3 notches in Chrome and about 80 notches in Firefox line mode. `wheel.test.js` never sets `deltaMode`.
- **No speed scaling and no direction smoothing.** Signed deltas are summed. A downward gesture cancels part of an upward accumulation, and `acc` is not reset when direction changes.
- **Gap-based reset.** Accumulation resets only after 400 ms without an event. Trackpad momentum sends events at about 60 Hz, so one flick accumulates across its whole momentum tail and can exit. A slow two-finger drag of about 3 px per event also reaches 240 px after roughly 80 events.
- **Direction.** Exit fires on negative `deltaY`, which is already adjusted by the OS natural-scroll setting. So the direction matches the machine, but the threshold does not.
- **Horizontal wheel** (`deltaX`) is ignored entirely.
- **Trigger, not scrub.** The zoom is not driven by wheel input at all. `enter()` runs once when `p > 0.02` (`controller.js:59`), and the tween duration is `max(0.5, 1.9 * (1 - z))` seconds, independent of how far or how fast the user scrolled (`controller.js:102`). The header comment says this is deliberate (`controller.js:5-7`).

Enter and exit in detail:

- Enter is armed when `p < 0.01` (`controller.js:48-49`) and fires at `p > 0.02` (`:59`). That is about 0.024H of scroll, roughly 22 px on a 900 px tall window.
- Enter sets `mode='inside'`, boots the OS, and starts the tween (`:97-102`). It calls `scrollTo` to align the track top only when the track top is more than 1 px below the viewport top (`:103-104`). Auto-enter always happens with `top < 1`, so that scroll is skipped there. Clicks at `p = 0` do align.
- Exit sets `mode='desk'` and starts a tween of `max(0.5, 1.5 * z)` (`:137-140`). It then smooth-scrolls the track top to the viewport top if `p > 0.005` (`:107-111`). So exit always returns to the stage top, never to the résumé.
- After exit, `armed` becomes true again once `p < 0.01` (`:49`). Scrolling down from the top therefore re-enters at once, unless `suppress` is set (`:118`, `:125`). `suppress` is cleared only when `p > 0.6` (`:50-53`).

---

## 4. Differences from native scrolling

| Aspect | Native (OS / browser) | This implementation | Where |
|---|---|---|---|
| Speed | 1:1 with the device, with acceleration | Page: native 1:1. Stage while zoomed: none. Exit: fixed 240 px threshold ignoring speed. Enter: fixed tween, ignores speed. | `wheel.js:37-40`, `controller.js:102` |
| Momentum | Continues after the fingers lift | Page: native until the stage's zoom starts. Over the stage while zoomed: killed (every wheel is `preventDefault`ed). | `wheel.js:20-22`, `:32` |
| Scroll-linked vs. triggered | Page position is scroll-linked | Page position is scroll-linked, but the zoom is triggered by a fixed tween | `controller.js:37-40`, `:59`, `:102` |
| Mid-gesture stop | Scroll stops where the finger stops | Scroll stops abruptly at about `p = 0.02` when the zoom starts, because wheel is then `preventDefault`ed for 1.9 s | `wheel.js:20-22` |
| Natural-scroll direction | Honored | Honored (uses the signed `deltaY`) | `wheel.js:38` |
| Keyboard scrolling | Space, PageDown and arrows scroll the page | Scrolls the page in every mode. Keys are only forwarded to the scene. No `preventDefault` | `keys.js:14-17` |
| Touch | Pans the page | Pans the page in every mode on desktop-width touch screens. On phones it pans only when the flat OS is not active. Touch on the flat OS is blocked only while interactive | `stage.css:5`, `:12-13` |
| deltaMode | Lines and pages are converted | Ignored | `wheel.js:37` |
| Horizontal wheel | Scrolls horizontally on trackpads | Ignored | `wheel.js:37` |

**Inconsistency worth stating plainly:** a wheel gesture over the zoomed laptop is blocked, while the same gesture as a touch pan scrolls the page. The two inputs give different results for the same visual state.

---

## 5. Every path to "zoomed with the stage partly off-screen"

The bad state needs `mode === 'inside'` (or `z > 0`) and `s > 1.2H`. The paths below are grouped by how the document gets past `p = 1` while zoomed.

### 5a. Paths that scroll the document with no check on `mode` (confirmed by code)

1. **Keyboard.** `keys.js:14-30` never calls `preventDefault`. When focus is on `body` (after clicking the laptop, focus is not in a control), Space, PageDown, End, and the arrow keys scroll the document. One PageDown moves about 0.9H, which takes `p` from 0.02 to about 0.75. A second moves it past 1.
2. **Scrollbar drag or track click.** No scroll-bar handler exists. The drag keeps moving after the zoom starts.
3. **Touch pan.** `stage.css:5` sets `touch-action: pan-y` on `#stage`, and no `touchmove` handler exists. On a touch device at desktop width (`stage` at least 760 px, so the flat OS is not used), a vertical swipe over the zoomed laptop scrolls the page. On phones, the touch trap (`stage.css:12-13`) covers the flat OS only after `interactive` is true, so a swipe during the 1.9 s entry tween still scrolls the page.
4. **Find-in-page (Cmd/Ctrl+F).** The browser scrolls to a match in the résumé, which can land with `1.2H < s < 2.2H` (a match near the top of the résumé puts the stage partly visible). The scroll also fires `update()` and therefore `enter()` (`controller.js:59`) if the page was at the top and not suppressed.
5. **Focus moves (Tab).** Focus can move from the HUD into the résumé. The browser scrolls the target into view. `focusin` only calls `leave()` when `mode === 'inside'` (`useStageBindings.js:77`). If the user is on the desk (`mode === 'desk'`), the jump passes `p = 0.02`, `enter()` fires on the next frame, and the zoom starts with the stage already off-screen.
6. **In-page `#resume` anchor links** that do not go through `goToResume()` behave like (5). The skip link does call `goToResume()` (`main.jsx:33-36`), so it is safe.
7. **Window resize or orientation change.** `p` is recomputed from `innerHeight` every frame (`controller.js:39`). The scroll position `s` is fixed in pixels, but `1.2H` shrinks when the window gets shorter, so `p` can jump past 1 without any scroll. The `ResizeObserver` only tracks narrow (`useStageBindings.js:60-61`), and nothing re-checks the zoom on resize. Mobile browser toolbars change `innerHeight` (and `p`) while the stage is sized with `100dvh` and the track with `220vh`, so the two may disagree (**unverified in browser**).
8. **Momentum that outlives the zoom.** Momentum events that reach the stage after `mode` becomes `inside` are blocked. Momentum that lands on a target outside the stage is not blocked. Likelihood is low and I could not confirm it (**unverified in browser**).

### 5b. Paths that zoom while the stage is already partly off-screen

9. **Scene clicks at `p > 1`.** A click on the visible lower part of the laptop reaches `pointerup` (`createScene.js:596-612`) and calls the hotspot's `ctrl.enter()` (`hotspots.js:12`, `createScene.js:486`, `:490`). `enter()` only scrolls when the track top is below the viewport top (`controller.js:103`), so it does not bring the stage back. The camera zooms with the stage half off-screen. This needs `s > 1.2H` in desk mode, which happens after paths 5 and 6 or after a resize.
10. **Hud buttons.** `hud-ach` calls `openLaptop()` → `enter()` (`Hud.jsx:19-24`, `createApp.js:102`). The HUD sits at the top right of the stage, so it is usually off-screen by then. Path 9 is more likely.
11. **Floppy insertion** calls `ctrl.enter()` (`createScene.js:486`, `:490`). A floppy is only reachable on the scene, so this needs the same visible-stage condition as path 9.

### 5c. Paths guarded by existing code (checked, no bug found)

- Auto-enter after `goToResume()`: suppressed until `p > 0.6` (`controller.js:124-134`, test 15 and K4).
- Auto-enter after `leave()` (Tab onto the résumé while inside): suppressed until `p > 0.6` (`controller.js:116-121`, test K3 and K4).
- Restoring a mid-track scroll position on reload: `armed` starts false, so no auto-enter until the page returns to the top (`controller.js:48`, test 2, B8).
- Wheel over the stage while inside: blocked, so the page cannot be dragged past the stage with the mouse wheel (path not needed).

### 5d. Why paths 1 to 4 reach the bad state even though the wheel is guarded

Once the zoom has started, the wheel handler blocks the page over the stage. The stage covers the whole screen until `p = 1`, so with a mouse wheel the user never reaches the résumé while zoomed. The bad state needs an input that bypasses the wheel handler. The owner's report fits paths 1 to 3 and 4 (keyboard, scrollbar, touch) best.

### 5e. Summary of the invariant that is missing

Nothing checks: `mode === 'inside'` implies `p < 1` (stage fully on screen). `update()` computes `p` every frame (`controller.js:40`) but never reads it for the zoom state. The only `p` checks are the arm and suppress thresholds (`:48-53`, `:59`).

---

## 6. Ways to leave the laptop today

| Action | Where | What it does | Available in the bad state? |
|---|---|---|---|
| Esc | `keys.js:26-28` | `ctrl.exit()` if `interactive` and scene ready | Yes, if `interactive`. Not during the enter tween |
| Wheel up over the desktop | `wheel.js:38-40` | `ctrl.exit()` after 240 px within 400 ms gaps | Only if the pointer is over the visible stage part |
| ⏏ Close laptop | `MenuBar.jsx:27` → `ctrl.exit()` | Same as Esc | Only if the OS menu bar is visible. It sits at the top of the screen, so it is often off-screen in the bad state |
| Shutdown (menu) and terminal `exit`/`shutdown` | `MenuPop.jsx:18`, `commands.js:216`, `:223` | `ctrl.exit()` after the OS powers off | OS-dependent |
| Résumé ↓ button | `Hud.jsx:16` → `goToResume()` | Exit tween, then scroll to `#resume` after 100 ms (`controller.js:124-134`) | **No.** `.stage.zoomed .hud { display: none }` (`stage.css:34`) hides the whole HUD while zoomed |
| Skip link (top of page, focusable) | `main.jsx:33-36` → `goToResume()` | Same as the HUD button | Yes, by keyboard, if the user can reach it |
| Focus leaves the stage | `useStageBindings.js:76-82` → `leave()` | Exit tween, no scroll, suppress auto-enter | Yes, on Tab into the résumé |

`exit()` always scrolls back to the stage top (`controller.js:110`). So Esc or ⏏ Close laptop recovers the layout from the bad state. `goToResume()` does not scroll during the exit tween (`controller.js:128-130`), then scrolls to `#resume` (`scrollToResume.js:5`).

What the owner asked for ("a button to leave the laptop view and open the page below") already exists as `goToResume()`. The real gap is that the button is hidden exactly when it is needed (`stage.css:34`).

---

## 7. Comparison with the prototype (`design/revamp-lab.html`)

Searched for `wheel`, `scroll`, `sticky`, `progress`, `Lenis`, `ScrollTrigger`.

- Track: `design/revamp-lab.html:43` is `.track{height:220vh}`. Same as now. The header comment at `:7` says 320vh, which is stale.
- Controller: `revamp-lab.html:1007-1041` is the same design as `controller.js`. Same `p`, `armed`, tween, and `enter`/`exit`.
- Wheel: `revamp-lab.html:1044-1054` matches `wheel.js` line for line. Same 240 px threshold, same 400 ms gap, same `preventDefault` and `!interactive` branches.
- Keys: `revamp-lab.html:1042` handles Escape only when `Ctrl.interactive`. Same.
- Not in the prototype (added later): `suppress` and `leave()` (K fixes), `goToResume()` and the HUD button (D11), `pinScroll` (Bug J), the `focusin` leave (Bug K), narrow and flat handling via `ResizeObserver`, reduced-motion handling, and the wheel hint toast's `hinted` flag. The prototype's `Ctrl.update` also has no `suppress`.
- Prototype's note at `:419` says "GSAP ScrollTrigger and Lenis (both already installed) drive the camera dolly". The code has no GSAP or Lenis, and `structure.test.js` forbids them. That note is historical.
- Prototype's `setLive` (`:756`) clears `.wb`/`.t-out` scroll offsets on exit, same as `osHost.js:106`.

Conclusion: the core scroll model is inherited from the prototype unchanged. The half-state bug is in the prototype's design (triggered zoom, no page lock, no exit affordance that stays visible), and the later fixes did not address it.

---

## 8. Test coverage

- `src/stage/wheel.test.js` (8 cases): covers gating, the scrollable-body pass-through, the 400 ms gap, the exit threshold, and the hint toast. Nothing for `deltaMode`, touch, or direction changes.
- `src/stage/controller.test.js` (about 30 cases): covers `p` thresholds, arming, tween durations, reduced motion, `leave()`, `goToResume()`, and the narrow flat state. Nothing covers `p > 1` while `mode === 'inside'`, resize, or scroll input that bypasses the wheel.
- `src/stage/keys.test.js`: covers Esc (only when interactive), Konami, and key forwarding. Nothing covers keys reaching the page (no `preventDefault` is asserted either way).
- `src/stage/pinScroll.test.js` (3 cases): covers resetting `scrollTop` and `scrollLeft` on the pinned elements.
- `src/stage/structure.test.js`: static checks (no GSAP, Lenis, Tailwind, or `three` outside `createScene.js`).
- `src/stage/Hud.resume.test.jsx`: checks that the résumé button scrolls to `#resume` and focuses its heading.

Gap: no test asserts the invariant from section 5e, and no test drives a real scroll. jsdom does not run layout, so any fix for the half state needs a browser check (see section 11).

---

## 9. Design A: discrete zoom, page locked while inside, explicit exit

Idea: keep the triggered zoom. While `mode === 'inside'`, the document cannot scroll at all, so `s` cannot pass `1.2H`. Add a visible exit that uses the existing `goToResume()` path.

Changes:

1. **Align before zooming.** In `enter()` (`controller.js:97-105`), always scroll the track top to the viewport top when `|top| > 1`, not only when `top > 1`. This makes the stage fully visible at the moment of zoom.
2. **Lock the document while inside.** Add a `.scroll-locked` class on `<html>` when `mode` becomes `inside` (set in `ctrl.update` or `enter()`), and remove it in `startExit()`. In CSS, use `position: fixed; top: -scrollY; left: 0; right: 0` on `body`, store `scrollY`, and restore it on unlock. This blocks wheel, keyboard, scrollbar, touch, and find-in-page scrolling of the root.
3. **Make the résumé inert while inside.** Set `inert` on `#resume-root` while locked, so Tab and `focusin` cannot reach the page. This makes the `leave()` path unnecessary for focus, but keep it as a fallback.
4. **Visible exit button.** Stop hiding the whole HUD while zoomed. Keep only the "Résumé ↓" button (or a new "Exit to page ↓" button) visible when zoomed, with `position: fixed` so it stays on-screen. Change `stage.css:34` so `.stage.zoomed .hud` hides only the other buttons. The button calls `app.nav.goToResume()`, which already does the exit and the scroll.
5. **Resize guard.** In the `ResizeObserver` (`useStageBindings.js:60`), when `mode === 'inside'`, re-align the track top, or exit.
6. **Touch.** While zoomed, set `touch-action: none` on `#stage` so touch cannot scroll the page. Windows keep `touch-action: pan-y` (`stage.css:15`), so window scrolling still works.
7. **Keep the wheel handler** (`wheel.js`), but normalize `deltaMode` (line mode times about 16 px, page mode times `innerHeight`) and scale the 240 px threshold per device. This fixes the Firefox inconsistency.

Files to change:

- `src/stage/controller.js` (enter, exit, leave, goToResume, update: lock state, align, resize guard)
- `src/stage/wheel.js` (deltaMode normalization; optional)
- `src/stage/useStageBindings.js` (ResizeObserver guard, inert on `#resume-root`, unlock on unmount)
- `src/styles/stage.css` (lock class, `touch-action`, HUD visibility at line 34)
- `src/stage/Hud.jsx` (exit button label and visibility, or a new component)
- `src/main.jsx` (only if `#resume-root` needs an id hook for inert; it already has `id="resume-root"` in `index.html:29`)
- Tests: `src/stage/controller.test.js` (lock and align cases), `src/stage/Stage.test.jsx` (exit button visible when zoomed), `src/styles/stage.css.test.js` (lock class and `touch-action`), `src/stage/wheel.test.js` (deltaMode cases)

Risks:

- **Mobile scroll locking is fragile.** `position: fixed` on `body` needs a scroll restore, and iOS Safari still scrolls some content under overlays. Test on a real iPhone.
- **Layout jump.** Removing the scrollbar when locked shifts the layout by the scrollbar width. Use `scrollbar-gutter: stable` on `html`.
- **Native scrolling is removed for the zoomed stage.** The owner asked that scrolling match the system. Locking gives up native feel on the desk while zoomed. The OS windows still scroll natively, and the desk wheel is still consumed.
- **Accessibility.** Keyboard and screen-reader users need a visible exit (the new button) and Esc. Check focus order after the lock.
- **Suppress logic.** `suppress` and the arm thresholds (`controller.js:48-53`) are tuned to the current scroll behavior. Locking changes when `p` moves, so tests K3, K4, and 15 may need new expected values.
- **Reduced motion and the 1.9 s tween** stay as they are.

---

## 10. Design B: scroll-linked zoom, native physics, zoom reverses before the stage leaves

Idea: drive the camera from `p` (the scroll position) rather than from a triggered tween. Make the zoom reverse before the stage starts to move, so "zoomed and the stage is off-screen" cannot happen by construction.

Mapping (illustrative numbers, to tune):

```
z(p) = easeIO( ss(0.00, 0.20, p) )            // zoom in while the page scrolls 0 to 20%
     * (1 - ss(0.80, 1.00, p))                // zoom back out from 80% to 100%
// z = 1 for 0.20 <= p <= 0.80 ("plateau": the laptop is open and interactive)
// p >= 1 implies z = 0, and the stage only starts to move once p > 1,
// so "zoomed and partly off-screen" is impossible.
```

How the plateau works:

- Native wheel, touch, keyboard, and momentum all move `p`, so the page feels native everywhere.
- On the plateau, a wheel over an OS window scrolls that window natively (windows already have `overscroll-behavior: contain`, `os.css:64`). A wheel over the desktop scrolls the page, which moves `p`, and the camera pulls out as `p` approaches 0.8 to 1.0. This is the "scroll past the laptop" gesture.
- Esc and ⏏ Close laptop call `scrollTo` to `p = 0` (smooth), which is the current `exit()` behavior with a different target.
- The Résumé ↓ button keeps `goToResume()`. It scrolls to `#resume`, so `p` passes through 1 with `z = 0`.
- Snap: add a debounced rest check (`scrollend` where supported, otherwise 150 ms idle). When the rest position is between 0 and 0.2 or between 0.8 and 1, ease to the nearest of {0, 0.2, 0.8, 1}. Use `scroll-snap-type: y proximity` only as a fallback, and never `mandatory`, because it would pull the user back up inside the résumé.

Changes:

1. **Replace the tween.** `ctrl.update` (`controller.js:37-78`) computes `z` from `p` every frame. Remove `ctrl.tw`, `enter()`'s triggered tween, and `startExit()`. `mode` and `interactive` become derived from `z` (for example, `interactive = z > 0.99` with hysteresis).
2. **Remove the wheel capture** for the desk and the plateau. `wheel.js` keeps only the window pass-through and the overscroll containment. Remove the 240 px exit accumulator and the hint toast, or move the hint into a one-time overlay.
3. **Keep the OS boot.** The lid and boot trigger from `p > 0.1` (`controller.js:45`). Make the lid angle a function of `p` too (`createScene.js:655`).
4. **Hotspots.** Scene clicks call `ctrl.enter()`. Change `enter()` to `scrollTo` the plateau start (`p = 0.2`) when the user clicks the laptop, so the zoom completes without a manual scroll.
5. **Touch and phones.** Remove the touch trap (`stage.css:12-13`) and let the flat OS scroll natively with `overscroll-behavior: contain`.
6. **Reduced motion.** Keep the instant mapping (no easing).

Files to change:

- `src/stage/controller.js` (rewrite `update`, `enter`, `exit`, `leave`, `goToResume`; remove `tw`, `armed`, `suppress`)
- `src/stage/wheel.js` (reduce to window pass-through, or delete)
- `src/stage/keys.js` (Esc becomes "scroll to p = 0")
- `src/stage/useStageBindings.js` (remove the stage wheel listener; add the snap logic; keep the focus handling)
- `src/scene/createScene.js` (lines 486, 490, 579, 582, 588, 602, 655, 668: use `z` from the controller as now, but the lid and camera must be driven by `p`-derived `z`)
- `src/scene/hotspots.js` (`enter` becomes a scroll to `p = 0.2`)
- `src/styles/stage.css` (remove `touch-action` traps, make `.track` height `calc(220 * var(--vh))` so the track and `innerHeight` agree on mobile)
- `src/core/constants.js` (remove `WHEEL_EXIT` and `WHEEL_GAP_MS` if unused)
- Tests: rewrite `src/stage/controller.test.js` (the tween cases 4, 7, 8, 11, 15, K1, K2 become mapping cases), `src/stage/wheel.test.js` (remove or repurpose), `src/stage/keys.test.js`, `src/stage/Stage.test.jsx` (test 9 for unmount listeners), `src/scene/createScene.test.jsx` (camera and lid at given `z`)

Risks:

- **Scroll-linked rendering cost.** The scene renders every scroll frame while the stage is visible. The ticker already runs in that case (`ticker.js`), but the scroll-driven camera makes trackpad and touch jank visible. Profile the 3D scene on a low-end phone.
- **Plateau feel.** From 20% to 80% of the runway the laptop is open and the page does not move visually. Users who scroll past the laptop quickly may feel a dead zone. Make the plateau short or add a visual cue.
- **Scroll-driven boot.** The OS boots as the lid opens, which means boot animation plays with the user's scroll. Check that boot sounds and the boot state still complete if the user stops at 15%.
- **Snap and reading.** The snap logic must not pull the user out of the résumé. Only snap when `p < 1`, or use `scrollend` only for the track range.
- **Hotspots and Esc** now call `scrollTo` (asynchronous). Tests and the click-to-enter flow need to accept that the zoom completes after the scroll.
- **Mobile viewport units.** Replace `220vh` and `innerHeight` with one unit so `p` and the stage position agree. Otherwise the invariant in section 5e can break by a few pixels.
- **Largest rewrite.** The K-series fixes (`leave`, `suppress`, `goToResume`) and tests B8, B9 and the 13 controller cases would need new expectations. Plan for a full pass on `controller.test.js`.

---

## 11. Open decisions and checks

Decisions to ask the owner (per the memory note on asking about product choices):

1. Should leaving the laptop be scroll-driven (Design B: scroll past the laptop, and the camera pulls out), or button-driven (Design A: a fixed exit button, page locked while inside)?
2. Should the desk and the laptop keep native scroll behavior on touch devices (Design B), or is locking the page on touch acceptable (Design A)?
3. Is the hint toast still wanted? Both designs remove the 240 px exit accumulator.

Checks to run in a real browser before choosing (none of these were run here):

- Trackpad (macOS, Chrome and Safari) and a Windows mouse wheel in Firefox: confirm `deltaMode` and exit thresholds.
- Keyboard Space and PageDown while zoomed: confirm the page scrolls to the bad state.
- Scrollbar drag through the zoom start: confirm the bad state.
- Touch swipe on a tablet at desktop width, and on a phone, during and after the zoom.
- Cmd+F for a word in the résumé, from the desk: confirm the zoom starts with the stage off-screen.
- Tab from the HUD to the résumé, from the desk: confirm the same.
- Window resize while zoomed (height only): confirm `p` moves past 1.
- Mobile Safari toolbar collapse while zoomed: confirm `innerHeight` vs `220vh` mismatch.

Suggested first step regardless of the choice: add a failing test (or a browser test) for the invariant in section 5e, then fix against it.
