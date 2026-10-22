# R2 explore: camera, laptop UX and desk props

Read-only investigation. Numbers marked "computed" come from the code's formulas (no browser run). Line numbers refer to the files as of HEAD `c90ecff`.

Key files: `src/scene/createScene.js` (CS), `src/scene/sceneMath.js` (SM), `src/scene/textures.js` (TX), `src/scene/hotspots.js` (HS), `src/scene/floppy.js` (FL), `src/stage/controller.js` (CT), `src/stage/useStageBindings.js` (UB), `src/stage/SceneMount.jsx`, `src/stage/Stage.jsx`, `src/stage/Hud.jsx`, `src/styles/stage.css` (SC), `src/styles/os.css` (OC), `src/os/osHost.js` (OH), `src/os/JayOS.jsx` (JO), `src/core/constants.js`, `design/revamp-lab.html` (PR).

---

## 1. Camera path

### 1a. Timeline and what drives it
- Scroll never scrubs the camera. A scroll (or a click on the screen/laptop) starts one eased tween `ctrl.z` 0→1 (CT:97-105, `enter()`), duration `max(0.5, 1.9*(1-z))` s (CT:102), easeIO (CT:63). Exit is `max(0.5, 1.5*z)` s (CT:139). Wheel-out is handled in `wheel.js` (`WHEEL_EXIT` 240, `WHEEL_GAP_MS` 400; `constants.js:6-7`).
- Auto-enter: while `mode==='desk'`, armed, and page progress `ctrl.p > 0.02`, `enter()` fires (CT:59). `p` is track scroll progress (CT:40). Track is `220vh` (SC:4), stage is sticky `100dvh` (SC:5).
- `camE(z) = ss(0.2, 1, z)` (SM:17): the camera dolly starts only after z=0.2.
- Lid: `lidT(z) = ss(0, .45, z)` (SM:11); hinge angle `π/2 → -10°` (SM:14; CS:663). Lid is closed at π/2 (hinge.rotation.x set at CS:422).
- Screen DOM visibility: `holder.style.visibility = le > 0.5 ? '' : 'hidden'` (CS:667), i.e. the DOM screen appears at lid ≈40° open, roughly z≈0.22.
- `interactive` (pointer/OS live) only turns on after the tween completes (CT:70-76).

### 1b. Camera poses (SM:46-66, CS:673-690)
| | aspect ≥ 1.05 (desktop) | aspect < 1.05 (portrait/narrow) |
|---|---|---|
| Wide start `wp` (camera) | (1.4, 3.6, 10.2) | (0.5, 4.4, 13.8) |
| Wide look `wl` | (0.2, 1.0, 0) | (0.1, 1.3, 0) |
| FOV (SM:37) | 35° | 46° |
| End pose | `anchor + aN * d`, anchor = screen centre on the lid (CS:407-409), `aN` = lid normal | same |

- Pose lerp: `pos = wide + (end - wide)*e`, `look = wl + (lidAnchor - wl)*e` (SM:63-64). Position and look are linear in `e`, so the apparent zoom is not linear. Computed: at e=0.5 the screen is about 43% of viewport height at 1440x700, and text is about 7px. It only becomes comfortably readable in the last ~10-15% of the dive.
- End distance `d = max(H/2 / tan(fov/2), W/2 / (tan(fov/2)*aspect))` with H=1.95, W=2.6 (SM:40-43). The screen is height-fit for aspect ≥ 1.33 and width-fit below that. Computed: 1440x700, 1280x800 and 1920x1080 all give d≈3.09 (height-fit). 390x844 gives d≈6.6 (width-fit), and 768x1024 gives d≈4.1.
- Wide shot distance to the lid is about 11.2 units (computed). At 1440x700 the closed laptop is about 28% of viewport height (≈195px), so the OS is about 4-5px text in the wide shot. Expected for a room shot.

### 1c. Viewport adaptation (summary)
- **Desktop 16:9, 16:10, 1440x700**: fov 35, d≈3.09. Full-height screen at the end, then the OS widens to fill the sides (see 1e).
- **Portrait phone 390x844 (aspect 0.46)**: fov 46, narrow pose, d≈6.6. Computed visible width in the wide shot is about 5.8 units. The desk is 7 units wide, so its edges are cropped. The mug (x≈-2.3) and plant (x≈-2.4) sit at or just beyond the left edge (computed). The lamp (x=3) is near the right edge.
- **Ultrawide**: no void up to about aspect 4.8. The back wall is 40 units wide at z=-3 (CS:245) and the wide view's half-width at the wall is about 4.16×aspect. Beyond about 4.8:1 (32:9 and wider) the wall edge shows the scene background (`0x141c2e`, CS:175). This is low priority.
- **Phone, interactive**: `NARROW_PX=760` (constants.js:4, UB:60) is a *width* test, separate from the camera's aspect test (`CAM_NARROW_ASPECT` 1.05, constants.js:5). When narrow and interactive, `setFlat(true)` moves the OS into the flat host (CT:83-90, OH:22-42, `flat-host` z 15 at SC:10). So on phones the 3D dive is visible, but the OS then cuts to a flat fullscreen view with a 0.18 s fade (SC:12, `fsIn`).
- **Tablet 768x1024**: aspect 0.75 uses the narrow camera. Width 768 is not narrow (≥760), so the OS stays in 3D and widens on the last 14%.

### 1d. Mouse parallax and orbit
- Pointer is tracked on the **canvas only** (CS:572-575, normalised to −0.5..0.5). Damped at 0.08/frame (`stepParallax`, SM:130; CS:679-680).
- Parallax offsets the wide camera by `sp.x*1.1` and `sp.y*0.7`, multiplied by `(1-e)` (SM:56-57), so it fades out during the dive. Reduced motion zeroes it (SM:55).
- Drag-to-yaw on the desk: `yawT = clamp(yaw0 + dx*0.005, ±0.4)` (SM:127), only while `z < 0.5` (CS:579). The rig rotates by `yaw*(1-e)` (CS:682), so the laptop rotates too and the end camera follows the lid anchor.
- Hover glow and tooltip only while `z < 0.9` (CS:582, CS:588); click picks use `z < 0.9` (CS:602).

### 1e. Idle and continuous animation
- Dog tags swing: `sin(t*3.1)*(swing+0.03)` (SM:102; CS:697), swing kicks on hover-click (HS "Dog tags").
- Snow: 280 flakes falling in front of the window (CS:254-266, CS:707-713), boost ×3.5 for 8 s on the Window hotspot (HS:66-69).
- Keyboard: `pressKey` on real key presses, 7/s decay (CS:738-740; keys.js:16; SM:69).
- LEDs: power LED (SM:84-88, standby blinks at 600 ms), drive LED busy/boot (SM:91-94). Drive busy 1.2 s after floppy insert (CS:484).
- Screen light `screenL` eases toward `screenLightTarget(state, lidT)` (CS:719; SM:99).
- Lamp: toggles intensity and hemi light (CS:494-502); disco mode on the Konami code (CS:720-724; keys.js:20-25).
- Mirror: WebGL canvas texture redraws when wallpaper canvas changes (CS:718).
- Hotspot "Laptop · open me" on the lid bezel; power button; floppies (3 `FLOPPIES`, FL:3-7); dog tags; mug; lamp; corkboard; polaroid; sticky note; keyboard; window (HS:16-65; CS:525-535).

### 1f. Scene render order and the CSS3D layer
- `.scene-layer` (Stage.jsx:38) holds `canvas.gl` (prepended, CS:173) and `div.css3d` (appended after the canvas, CS:181). Both are `position:absolute; inset:0` (SC:6-7, SC:49).
- Because the CSS3D layer is a later sibling, **it is always painted above the WebGL canvas, with no depth test and no hole.** Any WebGL object that sits between the camera and the screen is painted *under* the OS DOM. Nothing occludes the OS. Current props are not in front of the screen (see §3), but any prop placed in front of the lid will be wrong at some angles.
- The CSS3D layer and its child `div` are `pointer-events:none` (SC:7-8). The holder `.os` sets `pointer-events:auto` (OC:3), so the DOM screen takes clicks while the canvas gets everything else.
- Consequence A (click target): the `#glass` button (`.glass`, OC:9, `z-index 9500`, rendered at JO:30) covers the screen in desk mode. Clicking the screen calls `openLaptop()` (JO:25-28). Hover glow and tooltip for the screen do not fire, because the DOM intercepts the pointer.
- Consequence B (parallax reset, see §2a): when the pointer crosses onto the DOM screen, the canvas gets `pointerleave`, which sets `pointer.x = pointer.y = 0` (CS:610-616). Parallax snaps back to centre while the cursor is over the screen.

### 1g. CSS3D sizing, backface and the mirror plane
- CSS3DObject scale is `2.6/900` (CS:728), so the 900×675 holder maps to 2.6×1.95 world units. This matches the lid screen (CS:406: 2.6×1.95 mirror plane) and the black bezel (CS:393: 2.74×2.08).
- The WebGL mirror plane (CS:402-406) is a drawn canvas stand-in for the OS. It is only visible while the holder is hidden, i.e. before lid ≈40° (`le<=0.5`). It shows the drawn `drawMirror` view (TX:150-198), which is a simplified desktop with fake icons and a window. **When the lid passes 0.5 the mirror is hard-swapped for the real DOM (CS:667). That cut is a visible pop from a crude canvas to the real OS.**
- No backface culling: CSS3D planes have no `backface-visibility` setting. The lid never opens past π/2→−10° (SM:14), and the screen faces the camera for all displayed states (`le>0.5`), so this is not visible in practice.
- Z ordering of DOM vs WebGL bezel: bezel at lid z 0.002 (CS:393), mirror at 0.004 (CS:406), anchor at 0.006 (CS:408). These matter only for the mirror, and only while the DOM is hidden.
- **Holder grows past the lid during the last 14% of the dive.** `widenSize` (SM:31-35) runs for `z > 0.86` (CS:669-672) and grows the holder (OH setSize). On 1440x700 that is about 1398×680 px, so the DOM plane overhangs the 2.6×1.95 bezel until the end. The overhang is only visible as the DOM panel floating past the black bezel mid-dive. It disappears when the screen fills the viewport.

### 1h. Vignette and live toggle
- `.os::after` is a radial vignette (OC:7), shown in desk mode, hidden on `.live` and `.flat` (OC:8). `live` turns on at the end of the dive (CT:70-76). The vignette therefore pops off at the moment the dive completes. It is low contrast but visible.

### 1i. Resize
- `resize()` (CS:632-640) uses `stage.clientWidth/Height`, sets renderer size, CSS3D size, camera aspect. `UB:60` sets the narrow flag by stage width.
- The camera fov is set per frame from aspect (CS:673-677) and `camDistance` likewise (CS:678). Resizes are therefore picked up on the next frame.

---

## 2. UI gaps at different camera angles (ranked by how likely the owner sees them)

1. **Mirror-to-DOM hard cut on lid open** (CS:667, CS:402-406, TX:150-198). The fake desk-blue mirror drawing is replaced by the real OS in one frame. This is probably the most visible "gap" during the open animation. Fix options: fade the holder's opacity in over `le` 0.4→0.5 or draw the mirror from a snapshot of the real OS.
2. **Parallax snaps to centre when the cursor crosses the screen** (CS:572-616). `pointerleave` on the canvas fires as soon as the pointer enters the DOM screen. Fix: move parallax tracking to `window` pointermove (or the stage) and keep the canvas pointer only for picks. This is low risk and affects the desk view the owner sees most.
3. **No hover feedback over the screen in desk mode** (OC:9, JO:30). The `#glass` button covers it. Expected, but it makes the screen feel dead until the zoom. Possible fix: a faint screen-edge glow or a "click to enter" cue on hover (CSS only, over `.glass`).
4. **Phone cuts from 3D to flat at dive end** (CT:83-90, OH:22-42, SC:10-12). The dive is shown, then the OS jumps to a flat fullscreen with a 0.18 s fade. It is coherent, but the 3D dive does not continue into the OS on phones. Options: fade to flat earlier, or keep 3D on tablets.
5. **Phone wide shot crops the left side of the desk** (computed: visible width ≈5.8 units, desk 7 units, mug/plant near the left edge). Options: pull the phone wide camera back (`widePose`, SM:46-50) or use an end-of-track narrow pose for the mug. Low risk, easy to test with `widePose` unit tests (`sceneMath.test.js:91`).
6. **Overhang during the last 14%** (SM:31-35, CS:669-672). The DOM panel runs past the lid bezel before full screen. Brief, but visible. Option: clip the holder to the screen rectangle until `z ≈ 0.95`.
7. **Vignette pop when the OS goes live** (OC:7-8, CT:70-76). Low contrast. Option: fade the `::after` with a transition on `.live`.
8. **Floppy insertion disappears inside the chassis** (FL:11, CS:425-434). `DRIVE` is at y=0.09, inside the base (0..0.16, CS:350), so the floppy vanishes into the body rather than reaching a visible slot. Option: give the slot a dark rectangle on the base's right side (CS:380, the existing 0x1a222c strip is at x 1.506).
9. **Dive is not scrubbable** (CT:1-8, CT:97-105). A user cannot stop at a mid-zoom angle to read. By design per the controller's header comment; changing it means replacing the tween with a scroll-scrubbed pose (bigger change, see §4).
10. **Ultrawide void above ~4.8:1** (CS:245, SM:46-50). Low priority.
11. **Canvas-only pointer means no touch parallax** (CS:572). Intentional for the pointer; touch has no equivalent. Low priority.

No CSS3D depth clash exists today because nothing sits in front of the screen. The mug location in §3 is chosen to keep it out of the screen rectangle at all camera angles.

---

## 3. Desk props inventory

All props are built in `createScene.js` (`build()`), with `mk()` (CS:196-202; `castShadow`/`receiveShadow` on) and `canvasTex()` (CS:204-220, `THREE.CanvasTexture` with `anisotropy 4`, `sRGBEncoding`, registered in `textures` for disposal). Canvas text is drawn by the `draw*` functions in `textures.js`. Hotspots are registered with `addHot(obj, label)` (CS:521-535), which sets `userData.hot`, and `hotspots.js` maps labels to actions.

| Prop | Build location | Geometry / texture | Interaction (hotspots.js label) |
|---|---|---|---|
| Wall: visitor corkboard (`cork`) | group (1.55, 3.05, -2.97), CS:270-278; `drawCork` TX:55-90 | box 2.12×1.47 frame + 2.0×1.36 canvas plane | "Visitor wall" → opens `wall` |
| Polaroid (`pol`) | child of cork, (-0.55, 0, 0.05), CS:279-305 | white box + photo plane, dithered portrait loaded via `TextureLoader` (`img/jay-px.png`, fallback `img/jay.jpg`, CS:290-304) | "Polaroid" → opens `about` |
| Dog tags (`tags`) | (-1.6, 3.05, -2.92), CS:329-337 | cylinders, boxes; swings | "Dog tags" → `service` |
| Window (`skyM`) | (-3.5, 2.7, -2.99), CS:247-253; `drawSky` TX:5-45 | 2.4×2.0 canvas plane + frame strips; snow Points CS:254-267 | "Window" → snow boost + toast |
| Desk | slab 7×0.22×3.2 at y −0.11, legs, CS:341-342 | box | none |
| Laptop (base `base`, lid `hinge`) | base (0, 0, 0.35), CS:347-391 (body 3.0×0.16×2.1, keys, trackpad, power button, drive, sticky note, sticker); lid group at hinge (0, 0.235, −1.05), CS:388-422 (lid 3.0×2.25×0.1, bezel 2.74×2.08, mirror 2.6×1.95, logo, screen light) | box and plane meshes; canvas for note (TX:93), sticker (TX:105), logo (TX:117) | "Laptop · open me", "Power button", "Keyboard" (`kbHot` group), "Sticky note" (`noteM`) |
| Floppies ×3 | `FLOPPIES` home poses (FL:3-7): `(2.15,0.016,0.75)`, `(2.32,0.048,1.08)`, `(2.08,0.08,1.4)`. Box 0.5×0.03×0.52 with label texture, CS:425-434 | box + canvas label (TX:126-140) | "Floppy · PROJECTS / GAMES / RESUME" → inserts and opens app |
| **McGill mug (`mug`) — already exists** | group at (-2.3, 0, 0.85), CS:436-441: body `CylinderGeometry(0.19, 0.17, 0.44, 28)`, red `0xed1b2f`, handle torus, coffee disc `0x3b2314` at y 0.4 | plain colour, no texture, no wordmark | "McGill mug" (HS:43-47) → hop animation, toast "Refilled. Productivity +10%.", tone |
| Desk lamp (`lamp`) | (3.0, 0, -1.3), CS:442-462 (base cylinder, arm, shade cone, bulb, PointLight `0xffc27a` 1.5 range 9) | cylinders, cone | "Desk lamp" → toggles light (CS:494-502) |
| Plant (`plant`) | (-2.4, 0, -1.2), CS:464-470 | pot cylinder + four spheres | none (not a hotspot) |
| Sticky note (`noteM`) | on palm rest, (1.0, 0.17, 0.55) with rotation, CS:382-384 | canvas plane `drawNote` TX:93-102 (Caveat font) | "Sticky note" → opens terminal `help` |
| Power button, LEDs | CS:375-381 | cylinders, boxes | "Power button" |

### 3a. Is there already a mug? Yes.
- The **McGill mug already exists and is clickable** (CS:436-441, CS:529, HS:43-47, tests `hotspots.test.js:13,82-86`). It has the right label and red, but **no wordmark**, and its handle is wrong (see §3b). The prototype had the same mug (`design/revamp-lab.html:1168-1170, 1198`). Ask the owner whether they want to re-skin this mug or add a second one. Re-skinning is the lower-cost option.

### 3b. The current handle is likely wrong
- `TorusGeometry(0.11, 0.03, 10, 20)` is in the XY plane by default. `rotation.y = π/2` (CS:440) turns it into the ZY plane. The result is a full flat O-ring standing off the side of the body at x≈0.21, not a C-handle sticking out in +x. Expected: a half-torus (arc π) with its centre at about x=0.19, rotated so the arc bulges outward in +x. Verify with a screenshot.

### 3c. Where a McGill mug fits (free desk space, outside the screen rectangle)
- Current mug position (-2.3, 0.85) is left-front. The floppies live in the right-front (x 2.08–2.32, z 0.75–1.4, CS:425-434; FL:3-7; and they slide along z≈0.9 from x 2.35 to 1.2, FL:9-11). Keep the mug out of the floppy slide path (x ≈ 1.2–2.6, z 0.6–1.2).
- The lamp (3.0, -1.3) and the plant (-2.4, -1.2) occupy the back corners.
- **Recommended free spot if a second mug is wanted: (2.2, 0, -1.0)**, behind the right side of the base. Computed clearances: 0.85 from the lamp base (radius 0.32) and about 0.5 from the floppy home x range. It is behind the lid plane, so it is not in the screen rectangle at e=0 or e=1 (computed: the sight line from the end camera (0, 1.73, 2.33) to it crosses the lid plane at x≈1.76, outside the screen's ±1.3).
- Check with a screenshot at e=0, 0.5, 1 and at 390x844 before committing.

### 3d. How to build a wordmark mug in this codebase's style
- Pattern to copy: floppies already use a **material array** on a box with a canvas label on one face (CS:428: `new THREE.Mesh(B(...), [side, side, labelMat, side, side, side])`). Do the same with `CylinderGeometry`, which has groups 0=side, 1=top cap, 2=bottom cap.
- Recipe:
  1. `const mugLabel = canvasTex(512, 160, drawMugLabel)` (use the existing helper, CS:204-220), with `drawMugLabel` added to `textures.js` next to `drawNote`/`drawLogo`. Keep it pure (ctx, w, h) per the file's style (TX:1-3).
  2. Build `new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.44, 28), [sideMat(map: mugLabel.t), capMat, capMat])`. Use `mk`-style `castShadow` and `receiveShadow`.
  3. Put the label on the face the camera sees: the side at +z is `u≈0`, so offset the texture (`t.offset.x` / `repeat`) to centre it. Confirm with a screenshot.
  4. Add the new texture to `redrawText` (CS:623) so it redraws after fonts load. Without this the wordmark uses the fallback font. The fonts gate is at CS:619-629.
  5. Fonts: `CANVAS_FONTS` (CS:34) gates the redraw. Silkscreen is in there. `index.html:21` loads Silkscreen, VT323, Caveat, JetBrains Mono and Bricolage Grotesque, but Bricolage is not in `CANVAS_FONTS`. Add a Bricolage entry (e.g. `'700 48px "Bricolage Grotesque"'`) if a non-pixel wordmark is wanted, and add its `fonts.load` to the list.
  6. Trademark: "McGill" as plain text on a personal desk prop is fine, but avoid the university's crest or official logo, and do not present it as an official item. Flag if the owner plans to sell or distribute it.
- Keep the existing hotspot label `'McGill mug'` (HS:43) and its action; the mug is already a hotspot via `addHot(mug, ...)` (CS:529), and `pick()` raycasts through children (CS:550), so the new handle and label are clickable automatically.

---

## 4. Ideas that fit the current architecture (more fun, low risk)

Each is listed with where it hooks in and an estimate. Nothing requires a new dependency.

1. **Fix parallax snap (see §2.2).** Track pointer on `window`. ~10 lines in CS:572-616, one test in `sceneMath`/scene tests.
2. **Steam from the mug.** A small `THREE.Points` plume above the coffee disc (CS:441), animated in `frame()` with a pure `stepSteam` in `sceneMath.js` (copy the snow pattern, CS:254-266, CS:707-713). Cheap and reads well from the wide shot. Could also puff when `hopMug` fires (HS:43-47; CS:513).
3. **Mug hover lift.** Hover currently only glows (CS:553-563). Add a tiny Y lift in the tween (CS:513) on hover, using the existing `tween` helper (CS:475-479).
4. **Lid nudge on hover.** Ease the hinge 2–3° open when the pointer is over the lid bezel (CS:525 `addHot(hinge, ...)`, CS:663). Teaches the lid is openable without clicking.
5. **Lamp warm-up.** `setLamp` (CS:494-502) changes intensity instantly. Ease `lampL.intensity` with the same per-frame lerp as `screenL` (CS:719) for a nicer switch.
6. **Keyboard sound on key press.** `keys.js:17` already plays `app.snd.click()` when the sound is on. Make the 3D key depression and the click one event, and add a `hover` tick on keys (opt-in only; `sound.js` is opt-in).
7. **Screen-edge glow on hover over the screen.** CSS-only on `.glass` (OC:9), e.g. `.glass:hover{box-shadow: inset 0 0 0 2px #4AA6EE}`. Tells the user the screen is clickable without the 3D tooltip.
8. **Snow and window.** The window already boosts snow for 8 s (HS:66-69). Add a short "snow on the glass" fade when boosted.
9. **Fade the mirror into the DOM** (see §2.1). This is the highest-value polish for the open animation.
10. **Clip the holder during `z > 0.86`** (see §2.6). Stops the overhang.
11. **Floppy slot.** Add a dark slot rectangle on the base's right side at x 1.506 (CS:380) so the insertion reads (see §2.8).
12. **Scroll-scrubbed dive (bigger change).** Replace the one-shot tween with a pose driven by scroll progress, keeping the current poses. Gives viewers control and lets them pause at angles. Trade-off: the controller's comment explains the tween exists so wheel notches can't make the camera lurch (CT:1-8), so this would need a damping layer. Ask the owner first.
13. **Phone: fade to flat earlier** (see §2.4). Smoother than the cut at the end of the dive.

---

## 5. Prototype vs build

- Hotspots: the build has the same set as `design/revamp-lab.html` (`addHot` at PR:1190-1200): Laptop, Power, Floppy, Dog tags, McGill mug, Desk lamp, Visitor wall, Polaroid, Sticky note, Keyboard, Window. Nothing is missing.
- Camera: the same poses, FOV and distance formulas as PR:1246-1253. The build splits the old single narrow flag into a camera aspect test (CAM_NARROW_ASPECT 1.05) and a width test for the flat OS (NARROW_PX 760), which is an intentional change.
- The prototype's copy (PR:419) says "GSAP ScrollTrigger and Lenis (both already installed)". Neither is in `package.json` (grep confirmed), and the build uses its own rAF ticker (`src/stage/ticker.js`). This is prototype copy, not a missing feature.
- Prototype's mug was the same generic red mug (PR:1168-1170). No wordmark exists in either.
- Prototype's CRT scanlines are gone (PR:402), and the build has none, so nothing is missing there.

---

## 6. Tests touching this area
- `src/scene/sceneMath.test.js` covers `camFov`, `camDistance`, `widePose`, `cameraPose`, `stepTween`, `stepParallax`, `dragYaw` (lines 79-190). Good place to add `stepSteam` or a new pose.
- `src/scene/hotspots.test.js` covers the McGill mug action (lines 13, 82-86).
- `src/scene/createScene.test.jsx`, `textures.test.js`, `floppy.test.js` cover the build and draw helpers. `textures.test.js` is where a `drawMugLabel` test would go.
- `src/styles/stage.css.test.js` and `os.css.test.js` cover CSS rules; add any new `.glass` or `.os::after` rule there.
- The camera/pose visuals are not covered by tests; verify with screenshots at 1440x700, 1280x800, 1920x1080, 390x844 and an ultrawide.

---

## 7. Open questions for the owner
1. Re-skin the existing red McGill mug (wordmark plus handle fix), or add a second mug? The existing one is already the "McGill mug" hotspot.
2. Should the wordmark be text only ("McGILL") or include any crest or logo? Text only is safer (see §3d.6).
3. Is the phone experience supposed to keep the 3D dive, or is a quicker fade to flat acceptable?
4. Should the scroll be scrubbable (§4.12), or keep the one-shot dive?
