# Implementation plan, round 4: a MacBook Air on the desk

Branch `feat/website-revamp`, worktree `.worktrees/feat-website-revamp`, base HEAD `460ffcc`. Inputs: `design/notes/r4-explore.md`, `design/notes/plan-r3.md` §1–2, and the code. Line numbers are from `460ffcc`; if they have moved, search by symbol.

The build loop and gates are the same as rounds 2 and 3. A test-writer writes the TEST LIST first, an implementer makes it pass, and a reviewer checks ACCEPTANCE. Every phase ends with `npm test`, `npm run lint` and `npm run build` green. The headless-Chrome pass (§6) runs at the end of R4-1 (baseline) and after R4-3 and R4-4.

**What I checked in `node_modules/three@0.128.0`:**
- `examples/jsm/geometries/RoundedBoxGeometry.js` exists. It is non-indexed (`toNonIndexed`), and its radius is clamped to half the smallest side.
- `examples/jsm/environments/RoomEnvironment.js` exists.
- `src/extras/PMREMGenerator.js` has `fromScene(scene, sigma, near, far)` and `dispose()`.
- `examples/jsm/utils/BufferGeometryUtils.js` exports an **object**: `import { BufferGeometryUtils } from '…'`, then `BufferGeometryUtils.mergeBufferGeometries(list)`. It is not a named function export.
- There is no `three/addons`.

**Lint constraint:** ESLint (`eslint.config.js` L52–66) allows `three` and `three/*` imports only in `src/scene/createScene.js`. Any new module that builds meshes must therefore **receive THREE by injection** rather than import it. This keeps three in its lazy chunk.

**Two-view scroll model (plan-r3 §1–2): untouched.** These all stay as they are:
- `lidT`, `camE`, `holderAlpha`, `lidBoot`, `WIDEN_FROM`, `vignetteAlpha`;
- `INSIDE_ON`/`OFF`, the track and plateau;
- the flat swap at z = 1, the phone pull-back, the peek latch, and every hotspot label and action.

The only thing that changes under the scroll model is the OS logical size. The 3D widen and the flat fit both derive from the same `OS_W`/`OS_H` (§3), so the swap stays invisible.

---

## 1. Target design (M-numbers)

### 1.1 Numbers (new pure module `src/scene/laptop.js`, base-local unless marked "rig")

| Part | Value | Today |
|---|---|---|
| `BASE` | rig pos [0, 0, 0.35]; w 3.0, d 2.1, **h 0.095**, lift 0.006 (feet), plan corner r 0.12, edge bevel 0.014. Deck top `DECK_Y` = 0.101 | box 3.0 × 0.16 × 2.1 |
| `LID` | w 3.0, **h 2.09**, **t 0.045**, r 0.12, bevel 0.012; chin 0.166, top bezel 0.065, side bezel 0.07 | box 3.0 × 2.25 × 0.1 |
| `HINGE` | pivot (0, 0.107, −1.04); open −10° (unchanged); barrel r 0.028, length 2.5, at (0, 0.078, −1.035) with its top (0.106) under the pivot | (0, 0.235, −1.05) |
| Closed height / open lid top | 0.152 / ≈ 2.173 | 0.335 / ≈ 2.45 |
| `SCREEN` | **1040 × 676 OS px**; `unit` 0.00275 scene units per px → **2.86 × 1.859**; centre y `cy` = chin + h/2 = 1.0955; mirror canvas **640 × 416**; top corner radius 10 OS px | 900 × 675; 2.6 × 1.95; 512 × 384 |
| `KEYBOARD` | width 2.62 = 14.5 u, u = 0.180690, gap 0.026, cap h 0.009, cap top 0.104, travel 0.005. Well (a hole in the deck) 2.68 × 1.12 centred at z −0.38, floor y 0.095. Rows at z = −0.38 + (r − 2.5)·u | 39 loose keys |
| `TRACKPAD` | 1.2 × 0.72, centre z 0.62, r 0.06 (gap to the well 0.08, front margin 0.07) | 0.84 × 0.52 + 2 buttons |
| `SLOT` (floppy) | **right side face** x +1.5, z −0.45 (rig −0.1), y 0.0535, mouth 0.56 × 0.036 | front face, x 0.95 |
| `PORTS` | left side: MagSafe z −0.78 (with plug), USB-C at z −0.50 and −0.32; right side: headphone jack z −0.90 | none |
| `FEET` | 4 × r 0.07, h 0.006, at (±1.25, ±0.85) | none |

All of the derived relations become tests (§5, R4-1 and R4-2):
- `LID.h = chin + SCREEN.h + top`;
- `SCREEN.w = OS_W·unit`;
- `HINGE.z + LID.h = BASE.d/2` (−1.04 + 2.09 = 1.05; the test allows [BASE.d/2 − 0.02, BASE.d/2]), so the closed lid is flush with the front;
- the barrel top is below `HINGE.y`;
- the cap tops are below `HINGE.y − 0.002`.

### 1.2 Decisions

| # | Decision | Why |
|---|---|---|
| M1 | **All laptop numbers move to a pure `src/scene/laptop.js`** (no three). It holds the §1.1 data plus pure helpers: `keyboardLayout()`, `keyIdOf(key)`, `keycapBuffers(layout)`, `offsetKeyVerts()`, `keyboardUv()`, `extrudeSpec()`, `J_PATH`, `lidOpenTop()`, `SLOT`, `PORTS`, `CABLE`, `ENV`, `MATERIALS`, and `LAPTOP.glow`/`LAPTOP.drawBudget`. `props.js` loses `SLOT`. | The tests check the geometry without three, as `props.js` already does for the mug. One source of truth for the floppy lane, the polaroid clearance, the camera distance and the screen. |
| M2 | **The mesh building moves to a new `src/scene/laptopBuild.js`** with `buildLaptop(T, ctx)`. `T = { THREE, RoundedBoxGeometry, BufferGeometryUtils }` is injected from `createScene.js`. `ctx = { mk, hued, canvasTex, hitBox, env, base }`. It returns `{ base, hinge, anchor, kbHot, pbtn, note, keys, leds, mats, sheen, deckGlow, dispose }`. The laptop block in `createScene.js` (L346–431) shrinks to one call. | Lint forbids `three/*` imports outside `createScene.js`. Injection keeps the lazy chunk and lets `laptopBuild.test.js` pass a plain proxy fake with no `vi.mock`. `createScene.js` is ~970 lines today. |
| M3 | **Footprint kept at 3.0 × 2.1 at rig z 0.35.** Thickness cut to Air proportions (base 0.095, lid 0.045, closed 0.152). | Desk, floppies, mug, phone framing (`DESK_CORNERS` in sceneMath L59–64) and the wide poses do not move. 1 unit ≈ 101 mm, so the closed laptop is about 15 mm thick: slim, and still thick enough for the floppy mouth. |
| M4 | **Body shapes: `ExtrudeGeometry` of a rounded-rect `Shape`** (plan corner r 0.12, `curveSegments` 6), with a small bevel (`bevelSegments` 2) for the softened top and bottom edges. `extrudeSpec(w, d, h, r, bevel)` returns the shape size so that the outer size is exact: shape = (w − 2b) × (d − 2b), radius r − b, depth h − 2b. The base shape has the keyboard well as a **hole** (rounded r 0.03; the hole is (well + 2b) because bevels shrink holes). The base geometry is rotated −π/2 about x; the lid is extruded along z behind the pivot (z −t…0). `RoundedBoxGeometry` is used only for small parts (MagSafe plug). | RoundedBox applies one radius to every edge and clamps it to h/2 = 0.047. That gives a 4 mm plan corner, much sharper than an Air. The extrude gives large plan corners with soft edges, and the hole gives a real recessed well whose inner walls catch light. |
| M5 | **Materials** (`MATERIALS` in laptop.js). Aluminium: `MeshStandardMaterial` metalness 0.9, roughness 0.42, colour ≈ 0xbfc4cb (tune by eye; see the note below). Shade (hinge barrel, thumb scoop, slot lip): 0x8e949c, roughness 0.5. Dark (well floor, mouths, ports, feet, trackpad seam): 0x0b0c0e, roughness 0.7. Trackpad glass: 0xc4c9cf, metalness 0.3, roughness 0.22. Bezel: 0x07080a, roughness 0.12. **No-env fallback:** aluminium metalness 0.35, roughness 0.45. | r128 has no colour management, so hex values are used as linear and come out lighter through sRGB output. Today's palette was tuned that way, so the hex values above are starting points to judge from screenshots. Metal with no env map renders near-black, hence the fallback. |
| M6 | **Env map: a small room-matched env scene through `PMREMGenerator.fromScene(envScene, 0.04)`, set only on the laptop materials** (`material.envMap`, not `scene.environment`). The env scene (data in `ENV`) is a dark navy `BackSide` box (wall colour 0x1f2b45), a warm panel on +x where the lamp is (0xffc27a, ×4), a cool panel on −x and back where the window is (0x8fb0ff, ×2) and a dim ceiling. The scene, its geometries and the PMREM generator are disposed right after; the render target is disposed in `dispose()`. A `try/catch` falls back to `env = null` and the M5 no-env parameters. `envMapIntensity` follows the lamp: `ENV.min 0.55 + 0.45·lampLevel` inside `applyLamp` (createScene L581). | `RoomEnvironment` is a white studio: a bright studio-lit laptop in a dark night room would look pasted in. Scoping the env to the laptop leaves the tuned room untouched. PMREM can fail on weak WebGL1 phones (half-float targets), hence the fallback. |
| M7 | **Tone mapping stays `NoToneMapping`.** Highlights are kept in range by roughness ≥ 0.35 and `envMapIntensity` ≤ 1 (except the J, M14). | ACES applies to every `toneMapped` material. It would darken and desaturate the mug red, the lamp orange and the desk wood tuned in r2/r3. The mirror and sky are `MeshBasic` with `toneMapped:false` and stay matched to the DOM in any case, so the crossfade is unaffected. |
| M8 | **Keyboard: 77 black caps in ONE merged mesh, plus Touch ID as its own mesh (78 keys, ANSI Air).** Rows (in u): fn row esc 1.5 + F1–F12 + Touch ID 1; `` ` ``1–0 `-` `=` + delete 1.5; tab 1.5 + Q…`]` + `\` 1; caps 1.75 + A…`'` + return 1.75; shift 2.25 + Z…`/` + shift 2.25; fn, control, option, command 1.25, space 5, command 1.25, option, then an inverted T: full-height ← and →, half-height ↑ over ↓ in one 1 u slot. Every row is 14.5 u. `keycapBuffers(layout)` (pure) emits a frustum box per key (top inset 8 %, so the sides catch light): 24 vertices and 36 indices per key, with `ranges[i] = [24i, 24i + 24)`. UVs are planar over the keyboard rectangle (`keyboardUv`). The scene wraps these in one `BufferGeometry`. | 1 draw call instead of 42, with per-key legends. A key press moves only that key's 24 vertices (`offsetKeyVerts`, 1,848 vertices in total, cheap to re-upload). This avoids an `InstancedMesh` with per-instance UV shader hacks (`onBeforeCompile`) and mock gymnastics. |
| M9 | **Legends from two canvases.** `drawKeyAtlas(x, w, h, layout)` at 1024 × 424 is the `map`: dark caps 0x1b1c1f with rounded-rect faces and grey legends. `drawKeyGlow` at 512 × 212 is the `emissiveMap`: white legends on black; the half resolution softens them into a glow. Font: a system stack (`600 …px system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif`), so the font gate is not needed. Letters are upper case; modifiers are lower-case words or glyphs (esc, tab, caps lock, shift, control, option, command ⌘, return, delete, F1–F12). | Backlighting becomes a single `emissive` value, and only the legends glow. |
| M10 | **`pressKey` keeps working, and more keys press.** `keyIdOf(k) = SHIFTED[k] ?? String(k).toUpperCase()`. `SHIFTED` maps `!@#$%^&*()_+{}\|:"<>?~` to their base keys. Ids stay today's (`'A'`, `'1'`, `' '`, `'ENTER'`, `'BACKSPACE'`). New ids follow `e.key.toUpperCase()`: `ESCAPE`, `TAB`, `CAPSLOCK`, `SHIFT`, `CONTROL`, `ALT`, `META`, `ARROW*`, `F1`–`F12`. Right-hand duplicates (`SHIFT_R`, `META_R`, `ALT_R`) and `FN` exist but are never typed. Unknown keys are a no-op. `stepKey(p, dt, base = 0.19, travel = 0.035)` gains a backward-compatible `travel` parameter; the scene calls `stepKey(p, dt, 0, KEYBOARD.travel)` and applies the returned y as the offset. | `keys.js` L64 sends the raw `e.key`. Konami arrows now press the inverted T (visible when the lid is open). |
| M11 | **The power button becomes Touch ID (top-right of the fn row, x 1.2197, z −0.8317).** `pbtn` keeps the label `'Power button'` and its action, and gets the `HIT.touchId` proxy {size [0.24, 0.05, 0.22], pos [0, 0.01, 0]}. Touch ID material is black with `hue` 0x9fb2c8, so the hover glow reads, and it has a 64 × 64 `drawTouchId` ring texture. | Real Airs power on with Touch ID. Like today's button (L377–380, under the closed lid), it is reachable mid-dive. |
| M12 | **Red nub, trackpad buttons and the old power LED are deleted** (L374, L376, L381). The trackpad is one large Force Touch glass plane at DECK_Y + 0.0006 over a dark seam plane 0.008 larger. | A MacBook has none of these. |
| M13 | **Lid front:** a black glass bezel (rounded rect, inset 0.02, so a thin silver rim shows), the mirror at SCREEN size, and a **camera dot in the top bezel** (r 0.012 at y = LID.h − top/2). There is **no notch cut into the display.** Rounded top screen corners come from the CSS `.os:not(.flat)` radius (§3) and a matching corner mask in `drawMirror`. | A notch over the DOM would cover JAY-OS's right menubar group (⏏ Close laptop / Sound / clock start around 540 px of 1040). The owner keeps JAY-OS's look. The 2020 Air look is a camera in a slim bezel. If the owner wants a notch later: an `#os-holder::before` 150 × 22 px, `opacity: var(--vig)`, plus `drawMirror` painting it. Not planned. |
| M14 | **Glossy "J" monogram** in the lid centre, on the lid back. `ShapeGeometry` from `J_PATH`, a 0.35-tall hand-built path: top bar, stem and hook. The commands are moveTo, lineTo, absarc on a centre (−0.02, −0.08) with outer r 0.10 and inner r 0.05. Polished material: metalness 1, roughness 0.06, `envMapIntensity` 1.3, colour 0xeef0f3. It has the same rotation (0, π, π) as today's logo (L425), so it reads upright from the desk camera with the lid closed. `drawLogo` and the JAY canvas are deleted. | Real geometry is crisp at any distance, needs no font, and is not in the font gate. Against matte aluminium, the polished J flashes the env's lamp panel as the lid peeks. It faces the desk camera because that is the only place the lid back is ever seen. |
| M15 | **Stickers move to the lid top.** The sticky note goes to the front-right corner (lid-local (0.95, 1.7), rot z 0.2) and keeps its hotspot and action. The JAY-OS sticker goes to the back-left. Both are flat planes at z −t − 0.001 with rotation (0, π, π). The palm rest stays clean. | Today both sit at y ≈ 0.17 under a closed lid (L388–392, the lid spans y 0.235–0.335 over them), so the note hotspot is invisible at the desk. On the lid they are seen where people put stickers, and the note becomes clickable at the desk. |
| M16 | **Hinge and clutch look:** a shade-material barrel along x behind the deck, plus a lid bottom that tucks behind it when open. The lid's bottom edge (local z −t) dips to y 0.099 at z −1.084 when open, behind the back edge, so nothing intersects. | It reads as the Air's clutch hinge from the open and mid-dive views. |
| M17 | **Thumb scoop:** a shade-material crescent (0.36 × 0.024) on the front face, just under the top edge at x 0. | It signals "MacBook" at the desk, where the front face is in view. |
| M18 | **Side ports.** Left: two USB-C mouths (dark rounded rects 0.09 × 0.028), and a **MagSafe plug** (RoundedBox 0.13 × 0.034 × 0.16, aluminium, merged into the base aluminium) with an LED on its top outer end. **A braided cable** (`TubeGeometry` r 0.014 on a `CatmullRomCurve3` through the `CABLE` rig points) runs left and back over the desk between the laptop and the plant, then drops off the back edge. Points: [−1.63, 0.054, −0.43] → [−1.78, 0.03, −0.47] → [−1.95, 0.012, −0.7] → [−2.0, 0.012, −1.15] → [−1.96, 0.012, −1.5] → [−1.94, −0.03, −1.63] → [−1.94, −0.7, −1.66]. Right: headphone jack (dark circle r 0.018) at z −0.90, behind the floppy slot. | Side faces are edge-on from the wide camera (wp x 1.4 < 1.5), so the plug's top LED and the cable carry the realism. The cable stays ≥ 0.2 from the plant pot (x ≤ −2.22) and the mug. |
| M19 | **The MagSafe LED takes the power LED's role** (`ledMagSafe`, §2). It is `MeshBasicMaterial` (`toneMapped:false`), so it stays lit in a dark room. **The drive LED moves to the front face at x 1.2** (visible at the desk) and keeps `ledDrive`. | The owner asked for it. The front LED is the one place a desk viewer sees drive activity during an insert. |
| M20 | **Side floppy slot** on the right face, toward the back (rig z −0.1), behind the floppy pile (its nearest z is ≈ 0.43). Mouth 0.56 × 0.036 in the 0.095 slab, with ≥ 0.029 of aluminium above and below, a shade lip 0.012 larger and a dark mouth. Seated, the floppy sticks out **0.14** (rig centre x 1.39). The lane is re-planned in §4. | The right side is next to the pile, and behind it the lane is clear. 0.14 out (today 0.05) because the face is seen edge-on; the floppy's labelled top is what reads. |
| M21 | **Rubber feet and a contact shadow.** Four dark discs in the dark mesh. A blurred rounded-rect shadow plane (`drawContactShadow`, 256 × 192, `MeshBasic` transparent, `depthWrite:false`, opacity 0.5) sits in the rig at y 0.0015, 3.4 × 2.5, centred on the base. Only the aluminium base and lid cast moon shadows. | It grounds a thin slab cheaply and removes ~55 shadow-pass draws. |
| M22 | **Hover glow.** The laptop hotspot gets its own strength, `LAPTOP.glow` 0.12 (`addHot(hinge, …, LAPTOP.glow)`; silver at 0.2 reads chalky). Frame-owned emissive materials carry `userData.ownEmissive = true`, and `glow()` (createScene L668–680) skips them: keycaps, LEDs. Keyboard hover feedback is the backlight instead (D3). | Glow and backlight would otherwise fight over `emissive` and the cached `e0`. |
| M23 | **Draw budget: ≤ 20 visible laptop meshes** (`LAPTOP.drawBudget`). Planned at rest: base aluminium (body + plug), shade, dark, keycaps, Touch ID, trackpad, MagSafe LED, drive LED; rig cable, contact shadow; lid aluminium, bezel, camera, mirror, J, note, sticker = **17**. The deck glow and sheen show only while active. Static parts are merged with `BufferGeometryUtils.mergeBufferGeometries`. Call `.toNonIndexed()` on indexed parts first, because ExtrudeGeometry and RoundedBox are non-indexed. All parts must carry position, normal and uv. Source geometries are disposed after the merge. | Today the laptop is ~59 meshes, almost all casting shadows. Expected scene total: ~62 meshes, and render calls roughly halved (measured in §6). |

---

## 2. Delight (D-numbers), with reduced motion and phone budget

All the curves are pure functions in `sceneMath.js`, so they can be tested.

| # | Behaviour | Function / data | Reduced motion | Cost |
|---|---|---|---|---|
| D1 | **The lid swings open and settles.** Hinge = `lidOpenAngle(le, reduce)` = `hingeAngle(easeOutBack(le, 0.7))`: a 1.76° overshoot past −10° near le 0.73, back to exactly −10° at le = 1. `lidBoot` and `holderAlpha` keep the raw `le`. The peek is added on top as today (L852). | `lidOpenAngle`, `easeOutBack` | plain `hingeAngle(le)` | 0 |
| D2 | **Power-on fade.** The screen light, deck glow and backlight ease with `approach` (rate 3/s) instead of the per-frame 0.08 factor (L928). They rise on boot and fall on shutdown. | `screenLightTarget` (kept) | instant | 0 |
| D3 | **Keyboard backlight.** `backlightTarget({osState, le, hovered, peeking})`: on 1, boot 0.6, standby/off 0, all × le. Keyboard hovered: at least 0.45 × le. **Peeking at the desk: 0.3**, a glow leaking from under the lifted lid. Applied as `keyM.emissive` = warm white 0xfff4e0 × level. | `backlightTarget` | no easing (light is not motion), peek is off anyway | 0 draw calls |
| D4 | **Screen glow on the deck.** An additive plane 2.8 × 1.0 at (0, DECK_Y + 0.004, −0.55): `drawDeckGlow` gradient, `MeshBasic` additive, `depthWrite:false`, opacity `0.32 × screen level`, visible only above 0.01. Optional R4-4: tint it and `screenL` with the wallpaper's mean colour, sampled once per mirror redraw. | `deckGlowAlpha` | same | 1 draw call while lit |
| D5 | **Sheen sweep on the lid.** A full-lid plane on the lid back with a diagonal band texture (`drawSheen`, 256 × 64, clamp), additive, opacity 0.28; `map.offset.x = sheenOffset(t)`, from −1.2 to 1.2 over 0.9 s with ease in-out. It triggers when the hover becomes the lid at z < 0.02, and once 1.2 s after the scene first shows. It is invisible otherwise. | `sheenOffset`, `SHEEN` | never runs | 1 draw call only during a sweep |
| D6 | **MagSafe LED.** `ledMagSafe(state, t, reduce)`: on/boot green 0x3ddc84; standby amber 0xff9f1c **breathing** (0.35–1 brightness, 4 s period); off dim amber 0x3a2406 (it is "charging"). | `ledMagSafe` (replaces `ledPower`) | steady amber | 0 |
| D7 | **Hover peek** stays at 7° (`PEEK`, `approach` at RATE.peek), plus D3's leak glow and D5's sheen. | existing | none (existing) | 0 |
| D8 | **Keys press when typing:** the caps dip by `KEYBOARD.travel` and spring back (`stepKey`). | `offsetKeyVerts` | presses kept (feedback, ~0.5 mm) | ~1.8k vertices re-uploaded while a key moves |
| D9 | *(Optional R4-4)* Typing at the desk peeks the lid by 3° for 0.6 s, so the backlight leak shows. | `typePeek` | off | 0 |

**Budgets** (checked in §6):
- laptop ≤ 20 meshes (test);
- laptop ≤ 15k triangles: extrudes ≈ 0.8k each, cable ≈ 0.8k, caps 924 tris;
- scene `renderer.info.render.calls` at the desk ≤ 0.6 × the R4-1 baseline;
- PMREM build ≤ 30 ms, once;
- phone (390 × 844 at DPR 1.5 cap, 4 × CPU throttle) ≥ 45 fps mid-dive.

---

## 3. The 20:13 screen, end to end

**M24:** **1040 × 676**, not a strict 16:10 (1040 × 650). The owner gave 1040 × 676, and that is exactly the Air panel (2560 × 1664 = 20:13). **One source of truth:** `OS_W`/`OS_H` stay in `src/core/constants.js` L2–3, where osHost and the CSS tests read them. `laptop.js` derives everything else:

```js
export const SCREEN = { unit: 0.00275, w: OS_W * 0.00275, h: OS_H * 0.00275, cy: LID.chin + (OS_H * 0.00275) / 2, mirror: [640, 416], cornerPx: 10 }
```

| Where | Change |
|---|---|
| `src/core/constants.js` L2–3 | `OS_W = 1040`, `OS_H = 676` |
| `src/scene/sceneMath.js` L8–9 | delete `SCREEN_W`/`SCREEN_H`; `camDistance` (L51–54) uses `SCREEN.w`/`SCREEN.h`. Fix the comment at L50 and the widen comment at L33–34 to say OS_W/OS_H |
| `widenSize` (L35–39) | no code change: it already uses OS_W/OS_H, so z = 1 still equals the flat fit |
| `createScene.js` L938 | `cssObj.scale.setScalar(SCREEN.unit)` (= SCREEN.w / OS_W) |
| `createScene.js` L398–418 | lid, bezel, mirror plane `SCREEN.w × SCREEN.h`, mirror canvas `SCREEN.mirror`, anchor (0, SCREEN.cy, 0.003), `screenL` y = SCREEN.cy (in R4-2 they move into `laptopBuild.js`) |
| `createScene.js` L142–143 | comment "900×675" → OS_W × OS_H (code unchanged) |
| `textures.js drawMirror` (L143–190) | **Standby text:** y = round(((OS_H/2 + dy)/OS_H)·h), with dy −0.5 (logo) and +60.5 (blink). This reproduces 337/398 at 675 and is centre-relative like the flex column in `StandbyLayer`. **Menubar:** height round(34k), font round(13k), text at (round(17k), round(21k)), with k = w/OS_W. **BIOS:** font round(24k), x round(34k), baselines round((52 + 30i)k), matching `.l-boot` (padding 28/34, 24px/1.25). **Every state ends with `maskCorners(x, w, h, round(SCREEN.cornerPx·k))`:** two black top-corner fills (arcTo paths). The mirror now matches the rounded DOM |
| `src/os/osHost.js` L10–11, 21–22, 41, 74, 103 | no code change (it reads OS_W/OS_H) |
| `src/styles/os.css` L3 | `.os{…width:1040px;height:676px…}`. **Add:** `.os:not(.flat){border-radius:calc(var(--vig,1)*10px) calc(var(--vig,1)*10px) 0 0}`. `.os` is already `overflow:hidden`. `--vig` is set on the holder (createScene L871) and inherits; it reaches 0 at z 0.97, so corners are square before the widen and the swap, and the flat OS has none |
| `src/styles/stage.css` L18 | `#os-holder{width:1040px;height:676px}` |
| `src/wallpaper/modes.js` L35 | fallback `(w \|\| OS_W)`, `(h \|\| OS_H)` (the clamp then gives 277 px at 1040 × 676; modes.test passes explicit sizes and still holds) |
| OS layout | Checked, nothing assumes 900 × 675: icons are `auto-fill` rows (still 6 rows at 676), `openRect` and `fitWindows` take the live size, BugHunt at x 520 + 340 = 860 now has more margin, compact rules use `%`/`calc`, and the flat fit is `min(W/OS_W, H/OS_H)` |

**Tests that pin 900 × 675, and their new numbers:**
- **`src/scene/sceneMath.test.js`:**
  - L63–72: `widenSize(1, 1600, 900)` = {1201.8, 676}, with k = 900/676 = 1.33136.
  - L93–96: `camDistance` uses `SCREEN.h`/`SCREEN.w` from `laptop.js`.
  - L281–299: (1, 1440, 900) = {1081.6, 676}; (1, 2560, 1080) = {1602.4, 676}; (1, 1024, 1366) = {1040, 1387.4}; (0.96, …) = {OS_W, OS_H}. Write the literals with `toBeCloseTo(…, 1)` and also as formulas.
- **`src/scene/textures.test.js` L17–55:** canvas 640 × 416.
  - The blink is centred at x 320.
  - BIOS lines at x 21, y 32/50/69, font 15px.
  - The drawImage call is (engine, 0, 0, 640, 416).
  - The menubar text is at (10, 13).
  - 'off' is `[fillRect 0 0 640 416, …corner fills]`.
- **`src/os/osHost.test.js`:**
  - L18–19: holder `1040px`/`676px`.
  - L39–58: the "k = 1" host becomes 1040 × 676.
  - L61–85: the "k = 0.5" host becomes 520 × 676, logical width 1040px.
  - L87–100: restores `1040px`.
  - L158–181: 1440 × 900 gives k = 1.33136 and a width of 1081.6px, so use `toBeCloseTo`. Derive the numbers from OS_W/OS_H in the test.
- **`src/app/createApp.test.js` L35:** `{ w: OS_W, h: OS_H }`.
- **`src/scene/createScene.test.jsx` L465–479:** `['', OS_W + 'px']`, `['', OS_H + 'px']`.
- **New drift tests:**
  - `src/styles/os.css.test.js`: the `.os` width/height equal OS_W/OS_H, and the `.os:not(.flat)` radius uses `var(--vig` and `SCREEN.cornerPx`.
  - `src/styles/stage.css.test.js`: the `#os-holder` width/height equal OS_W/OS_H.
- **Left alone:** `JayOS.test.jsx` L79–84 (its own mocked rect) and the wallpaper tests (explicit sizes).

---

## 4. Everything that depends on the laptop geometry

| Dependent | Today | Adaptation |
|---|---|---|
| Polaroid clearance (`props.test` L29–33, "≥ 2.45") | lid top ≈ 2.45 | Test `bottom ≥ lidOpenTop() + 0.3`. `lidOpenTop()` = HINGE.y + LID.h·cos10° + LID.t·sin10° ≈ 2.173; the polaroid bottom (2.594) is unchanged. `POLAROID` does not move |
| Hit boxes (`HIT`, props.js L77–80) | tags, floppy | add `touchId`; `Object.keys(HIT)` becomes [floppy, tags, touchId] (props.test L104–106) |
| Hotspots (createScene L626–635) | 12 | Same 12 labels and actions (`hotspots.test.js` unchanged). Changes: `pbtn` = Touch ID group; `noteM` is now under the hinge; `kbHot` = the keycaps mesh group; `hinge` gets `LAPTOP.glow` |
| Peek latch / overLaptop (L717, L849) | raycast against `[base]` | unchanged: the base group still holds everything, including the hinge. The cable is in the rig and not counted, which is fine |
| Glow hues | material colour | aluminium hue 0xc8ccd2 at 0.12; Touch ID hue 0x9fb2c8; keycaps and LEDs `ownEmissive` (M22) |
| Desk framing / wide poses (sceneMath L56–131) | desk corners | Unchanged: the footprint is unchanged and the laptop is lower and thinner. `wl` y 1.0 still frames it |
| Phone pull-back (`narrowFitK`) | desk corners | unchanged. `camDistance` on phones grows about 10 % (the screen is wider), which keeps the end-of-dive fill exact |
| Camera dive end | anchor + `camDistance` | The anchor moves to SCREEN.cy on the new hinge. D1 returns exactly to −10° at le = 1 (z ≥ 0.45), so the z = 1 pose is exact and the flat swap stays seamless |
| `screenL` (L427–429) | (0, 1.1, 1.0) | (0, SCREEN.cy, 1.0), eased (D2) |
| Floppy lane (floppy.js L9–17) | front slot | Re-planned below; constants derived from `laptop.js` |
| `fitHits` (L451–457) | floppy proxies × k | unchanged |
| `redrawText` (L755) | includes `logo` | drop `logo`. The key atlas uses system fonts, so it is not gated |
| Mirror redraw / `mirrorStale` | 512 × 384 | 640 × 416; logic unchanged |
| Keys loop (L903–909) | per-mesh y | per-key vertex offsets on one attribute; `needsUpdate` once per frame when any key moved |
| LEDs (L920–922) | `powerLED` emissive | `magsafeLED.material.color.setHex(ledMagSafe(osState, t, reduced))`; `driveLED` likewise with `ledDrive` |

**Floppy lane (rig coordinates).** The data lives in `floppy.js`, built from `laptop.js` (`BASE.pos`, `SLOT`). The pile reaches x ≤ 2.62 and z ≥ 0.43. The lamp base covers x 2.68–3.32, z −1.62…−0.98.

- `SLOT_Z = BASE.pos[2] + SLOT.z = −0.1`.
- `SLOT_Y = SLOT.y = 0.0535`.
- `SEATED = {x: 1.5 + 0.14 − 0.25 = 1.39, y: 0.0535, z: −0.1}`.
- `APPROACH = {x: 1.5 + 0.25 + 0.03 = 1.78, y: 0.0535, z: −0.1}`.
- `LANE_Y 0.13` and `SLIDE_X 2.9` are kept; `LANE_Z` is deleted.

**Load (insert), legs × FLOPPY_PACE:**
1. `(SLIDE_X, y, z)` 0.2;
2. `(SLIDE_X, LANE_Y, z)`, squaring up (r 0), 0.15;
3. `(SLIDE_X, LANE_Y, SLOT_Z)` 0.25. At x 2.65–3.15 and z ≥ −0.36 this clears the lamp (≤ −0.98);
4. drop to `(SLIDE_X, SLOT_Y, SLOT_Z)` 0.1;
5. `APPROACH` 0.3. The run along −x at z −0.36…0.16 clears the pile (z ≥ 0.43) by 0.27;
6. `SEATED` 0.35.

Total 1.35 × 0.65 = 0.88 s, so the ≤ 0.9 s test holds.

**Eject:**
1. `APPROACH` 0.25;
2. `(SLIDE_X, SLOT_Y, SLOT_Z)` 0.25;
3. up to `LANE_Y` 0.1;
4. `(SLIDE_X, LANE_Y, home z)` 0.2;
5. drop to home y, turning back, 0.15;
6. home 0.2.

Total 1.15, so a swap stays ≤ 1.7 s. The only leg allowed through the base footprint is APPROACH ↔ SEATED along x at SLOT_Z.

---

## 5. Phases (TDD)

### Phase R4-1: the geometry module, 20:13 screen plumbing, and the stats hook

**Tests first:**
1. **New `src/scene/laptop.test.js`:**
   - (a) It imports nothing from three; it reads the source like props.test L49–53.
   - (b) `OS_W 1040`, `OS_H 676`, and `OS_W/OS_H === 2560/1664`.
   - (c) `SCREEN.w ≈ 2.86`, `SCREEN.h ≈ 1.859`, and `SCREEN.w/SCREEN.h === OS_W/OS_H`.
   - (d) `SCREEN.mirror[0]/SCREEN.mirror[1] === OS_W/OS_H`.
   - (e) `LID.h === LID.chin + SCREEN.h + LID.top` (±1e-9); the side bezel `(LID.w − SCREEN.w)/2` is in [0.05, 0.1]; `LID.top ≤ LID.chin`.
   - (f) BASE is 3.0 × 2.1 at [0, 0, 0.35]; h is in [0.09, 0.10]; LID.t is in [0.04, 0.05]; the closed height `HINGE.y + LID.t` is ≤ 0.16.
   - (g) The closed lid front is flush: `HINGE.z + LID.h` is in [BASE.d/2 − 0.02, BASE.d/2].
   - (h) The barrel top is below `HINGE.y`.
   - (i) `lidOpenTop()` matches the formula and is < 2.3.
   - (j) `SCREEN.cy === LID.chin + SCREEN.h/2`.
   - (k) `extrudeSpec(3, 2.1, 0.095, 0.12, 0.014)` gives an outer size of exactly (3, 2.1, 0.095).
2. **`sceneMath.test.js`:** rewrite L63–72, L93–96 and L281–299 (§3 numbers).
3. **`textures.test.js` L17–55:** rewrite at 640 × 416 (§3). Add "every state ends with two corner fills of radius round(10·640/1040) = 6".
4. **`osHost.test.js`, `createApp.test.js`, `createScene.test.jsx` L465:** as in §3.
5. **`os.css.test.js`, `stage.css.test.js`:** the new drift tests.
6. **`props.test.js` L29–33:** the clearance against `lidOpenTop()`.
7. **`createScene.test.jsx`:**
   - the CSS3D object's `scale.setScalar` is called with `SCREEN.unit`;
   - a `PlaneGeometry` with args `[SCREEN.w, SCREEN.h]` exists;
   - an `Object3D` anchor has `position.set(0, SCREEN.cy, …)`;
   - `api.info()` returns `{calls, triangles}` from `renderer.info.render`.

**Steps:**
1. Add `api.info()` to createScene, and in `SceneMount.jsx` (around L51, `app.scene.setApi(api)`) set `globalThis.__jayScene = api` only when `location.search` has `stats`.
2. **Before any visual change**, build, then capture the baseline screenshots and `info()` numbers (§6) into an appendix of plan-r4.md.
3. Create `laptop.js` (§1.1 data, `SCREEN`, `lidOpenTop`, `extrudeSpec`).
4. Change constants; make sceneMath use `SCREEN`.
5. Rework `drawMirror`, with `maskCorners` taking the radius.
6. In createScene, the lid box becomes `LID.w × LID.h × 0.1` on the old body, and the bezel, mirror, anchor, scale and `screenL` come from SCREEN. The old body stays until R4-2.
7. Change the CSS and `modes.js`.

**Review focus:** no remaining `2.6`, `1.95`, `900` or `675` screen literals (grep); z = 1 swap screenshots identical in layout (1440 × 900: the OS is 1081.6 × 676); the corner radius is gone by z 0.97; the flat fallback is unaffected.

### Phase R4-2: the MacBook body, materials, keyboard and lid

**Tests first:**
1. **`laptop.test.js`, keyboard:**
   - `keyboardLayout()` has 77 caps + 1 Touch ID (78) in 6 rows, and each row sums to 14.5 u.
   - Caps never overlap (gap ≥ KEYBOARD.gap − 1e-9), all lie inside the well, and ids are unique.
   - It contains A–Z, 0–9, `' '`, ENTER, BACKSPACE, ESCAPE, TAB, CAPSLOCK, SHIFT, CONTROL, ALT, META, ARROWUP/DOWN/LEFT/RIGHT, F1–F12 and `` ` - = [ ] \ ; ' , . / ``.
   - Touch ID is the top-right cell; space is the widest.
   - The inverted T: ↑ and ↓ share one x slot, each half height; ← and → are full height, either side.
   - The trackpad is centred, sits ≥ 0.06 behind the well, and has ≥ 0.05 front margin.
2. **`laptop.test.js`, `keyIdOf`:** `'a'`→`A`, `'!'`→`1`, `'?'`→`/`, `'{'`→`[`, `' '`→`' '`, `'Enter'`→`ENTER`, `'ArrowUp'`→`ARROWUP`, `'Meta'`→`META`, `'F5'`→`F5`, and `'Dead'` is not a layout id.
3. **`laptop.test.js`, `keycapBuffers`:**
   - 24 vertices and 36 indices per cap; contiguous `ranges`; unit normals.
   - Every top-face UV lies inside its key's atlas cell.
   - Every cap top is at 0.104 and below `HINGE.y − 0.002`; every cap bottom is ≥ the well floor.
4. **`laptop.test.js`, other helpers:**
   - `offsetKeyVerts(pos, baseY, range, dy)` changes only that range's y values, to baseY + dy.
   - `J_PATH` is closed, its bounding-box height is in [0.3, 0.4], it is centred within 0.02, and it fits the lid back with a 0.3 margin.
   - `MATERIALS.alu.noEnv.metalness ≤ 0.5`.
   - The `ENV` panels: warm on +x, cool on −x.
5. **`textures.test.js`:**
   - `drawKeyAtlas` makes one cap fill per layout key and one `fillText` per labelled key;
   - `drawKeyGlow` fills black first, then only text;
   - `drawTouchId` draws a ring (arc + stroke);
   - `textures` has no `drawLogo`.
6. **`sceneMath.test.js`:** `stepKey(1, 0.1, 0, 0.005)` gives an offset of −0.005·0.6; the old default behaviour is unchanged (L125–131 stays); `backlightTarget` (on, boot, standby, off) × le, hover floor 0.45·le, peek 0.3.
7. **New `src/scene/laptopBuild.test.js`.** It uses a shared proxy fake: move the `makeProxy`/`ctor` factory from createScene.test L13–131 into `src/test/threeMock.js` (a plain module; createScene.test can keep its hoisted copy or import it via `await vi.hoisted(async () => …)`).
   - Meshes under `base` that are not proxies number ≤ `LAPTOP.drawBudget`.
   - Exactly one keycap mesh; no `CylinderGeometry` with r 0.035; no trackpad buttons.
   - `castShadow` is true only on the two aluminium meshes.
   - `pbtn` holds the Touch ID mesh and an `HIT.touchId` proxy.
   - The note is a descendant of `hinge`.
   - The keycap material has `userData.ownEmissive`.
   - `mergeBufferGeometries` sources are disposed.
   - With `env = null`, the aluminium material uses the noEnv parameters and has no `envMap`.
8. **`createScene.test.jsx`:**
   - Extend the mock (L99–131) with `ExtrudeGeometry`, `Shape`, `Path`, `ShapeGeometry`, `CircleGeometry`, `TubeGeometry`, `CatmullRomCurve3`, `PMREMGenerator` (`fromScene` returns a proxy with `texture`), `AdditiveBlending`, `ClampToEdgeWrapping`, and the jsm modules `RoundedBoxGeometry.js` and `BufferGeometryUtils.js` (merge returns a `BufferGeometry` proxy with real Float32Array attributes). Extend `RESOURCE_KINDS` (L144–156).
   - The dispose test also expects the PMREM render target disposed, and `PMREMGenerator.dispose` called during the build.
   - `failOn: 'PMREMGenerator'` still builds.
   - `pressKey('a')` then `frame` lowers A's vertex range and sets `needsUpdate`; `pressKey('ArrowUp')` and `pressKey('Escape')` work; `pressKey('Dead')` is a no-op.
   - Hovering 'Keyboard' makes no `glow()` emissive write on the keycap material, and the backlight level rises over frames once the lid is open.
   - The existing peek tests (L728–760) still pass with REST_LID π/2.
   - The laptop hotspot glows at `LAPTOP.glow`.
9. **`props.test.js`:** the HIT keys; the SLOT tests (L104–122) move to laptop.test in R4-3 and are deleted here only when SLOT moves.

**Steps:**
1. Add the `laptop.js` keyboard and J pieces.
2. In `createScene.js`, import `RoundedBoxGeometry` and `{ BufferGeometryUtils }`.
3. Build the env (M6) right after the renderer: `buildEnv(T, renderer)` in laptopBuild.js, wrapped in try/catch.
4. Write `laptopBuild.js`: base extrude with the well hole, well floor, merged shade/dark parts, keycaps from `keycapBuffers` as `BufferGeometry` + `BufferAttribute` (both already mocked), atlas and glow textures, Touch ID, trackpad + seam, hinge group with lid extrude, bezel, camera, mirror, anchor, J (`ShapeGeometry`), note and sticker on the lid, `screenL`.
5. Replace L346–431 with the call and keep the local names that the rest of createScene uses (`base`, `hinge`, `kbHot`, `pbtn`, `noteM`, `mirror`, `anchor`, `screenL`).
6. Rewrite the key loop (L903–909) and `pressKey` (L947–950).
7. Add the `glow()` skip.
8. Tie `applyLamp` to `envMapIntensity`.
9. Delete `drawLogo` and the logo from `redrawText`.
10. Tune colours from screenshots at the desk and mid-dive.

**Review focus:**
- No three import outside createScene;
- every created geometry, material and texture is disposed (including the env render target and sources consumed by merges);
- the draw budget holds;
- the closed lid does not z-fight the caps (cap top 0.104 < lid face 0.107);
- the stickers read the right way up from the desk;
- the PMREM fallback path;
- the peek and hover tests still green;
- `CANVAS_FONTS` is still correct.

### Phase R4-3: side floppy slot, ports and LEDs, cable, contact shadow and delight

**Tests first:**
1. **`floppy.test.js` (rewrite L30–37, L65–131, L200–235):**
   - Import `BASE` and `SLOT` from laptop.js instead of the hard-coded base x ±1.5 / front z 1.4; the footprint is rig x [−1.5, 1.5], z [−0.7, 1.4].
   - The load legs and durations are exactly as in §4; the eject legs likewise.
   - Seated, the floppy sticks out 0.14 past rig x 1.5, its z range lies inside the mouth, and its y range lies inside the mouth height.
   - No path clips the base except the APPROACH ↔ SEATED run.
   - No leg intersects the pile, using the yawed footprint helpers already in the file (L356–378).
   - No leg intersects the lamp base disc (centre (3.0, −1.3), r 0.32).
   - Timing ≤ 0.9 / ≤ 1.7 s (L441–455 kept).
   - The queueing and reopen tests are kept.
2. **`laptop.test.js`:**
   - `SLOT` sits on the right face; the mouth has ≥ 0.02 of aluminium above and below; its length is ≥ 0.56; its z range is clear of the plan corners (r 0.12) and the jack; its rig z max + 0.26 is < 0.43 − 0.2 (behind the pile).
   - `PORTS`: MagSafe and USB-C on the left, the jack on the right, with no overlaps.
   - `CABLE` points: the first is at the plug end; all are outside the base footprint, ≥ 0.2 from the plant pot (−2.4, −1.2, r 0.18) and from the mug, on the desk (|x| ≤ 3.5, z ≥ −1.6) until the drop, and the last is below y −0.5.
   - The drive LED is on the front face; the MagSafe LED is on the plug top.
3. **`props.test.js`:** delete the SLOT block (L104–122) and the `SLOT` import; props.js no longer exports SLOT.
4. **`sceneMath.test.js`:**
   - Replace `ledPower` (L134–139) with `ledMagSafe`: on/boot green; standby breathing within [min, max] and reaching both over one period; reduce gives steady amber; off gives dim amber.
   - `lidOpenAngle`: π/2 at 0; exactly −10° at 1; its minimum is ≥ −10° − 3°; with reduce it equals `hingeAngle`.
   - `easeOutBack(0) = 0` and `(1) = 1`.
   - `sheenOffset`: ≤ −1 at 0, ≥ 1 at the duration, monotone.
   - `deckGlowAlpha` scales with level and le.
5. **`textures.test.js`:** `drawContactShadow` uses `shadowBlur` > 0 and a rounded rect; `drawSheen` uses a transparent-edged linear gradient; `drawDeckGlow` uses a radial or linear gradient.
6. **`createScene.test.jsx`:**
   - The frame writes the MagSafe LED with `ledMagSafe` per OS state, and the drive LED blinks after `api.drive(1)`.
   - The sheen mesh becomes visible after a lid hover at z 0 and is hidden again after 0.9 s; with `reduce: true` it is never visible.
   - The deck glow is hidden at le 0 and visible with the OS on and the lid open.
   - The contact shadow mesh is in the rig and does not cast shadows.
   - A `TubeGeometry` exists.
   - The hinge `rotation.x` follows `lidOpenAngle`, and with reduce it equals `hingeAngle`.
   - `envMapIntensity` drops when the lamp is toggled off with reduced motion.

**Steps:**
1. Move SLOT, PORTS and CABLE into laptop.js.
2. Re-plan the `floppy.js` constants and legs.
3. Build the slot lip and mouth, USB-C, jack, plug + LED, cable, front drive LED, feet, scoop, contact shadow, deck glow and sheen in `laptopBuild.js`.
4. In the frame: `lidOpenAngle`, eased screen light, backlight, deck glow, sheen trigger and step, and the LEDs.
5. Add the sheen trigger in the pointermove hover-change branch (L718–722) and the first-show timer.

**Review focus:**
- Watch inserts at 1440 and 390 for the floppy passing through anything;
- the seated floppy is readable from the desk;
- reduced-motion paths;
- no style or emissive writes on resting frames;
- the sheen and deck glow do not stay visible at rest (draw count).

### Phase R4-4: polish and performance

**Tests first:**
- `createScene.test`: laptop meshes with `castShadow` are exactly the two aluminium meshes.
- `api.info()` is `null`-safe before the first render.
- Optional D9 `typePeek` test (sceneMath) if it is done.
- Optional D4 tint: `meanColor(canvas)` pure helper test.

**Steps:**
1. Run the §6 pass.
2. Tune colour and env intensity against the baseline luminance (target: the laptop region's mean luminance at the desk is ≥ 0.8 × the baseline).
3. Confirm the budgets.
4. Optional D4 tint and D9.
5. Update `design/notes/r4-explore.md` with a note "implemented, see plan-r4", and mark `design/revamp-lab.html`'s laptop numbers as superseded in a header comment.

**Review focus:**
- Draw calls and triangles against the targets;
- phone fps;
- the PMREM time;
- nothing in the r3 scroll model regressed (rerun plan-r3 §6 items 1–10 on 1440 × 900 and 390 × 844).

---

## 6. Headless-Chrome visual and performance checklist

**Setup:**
- `npm run build && npm run preview` on port 4173, opened as `/?stats`.
- Chrome `--headless=new --use-angle=swiftshader --enable-unsafe-swiftshader` over CDP, for screenshots and draw counts.
- **FPS on a real GPU**, in headed Chrome. Swiftshader fps means nothing.
- Viewports: 1440 × 900 and 1280 × 720 at DPR 1; 390 × 844 at DPR 3 with mobile emulation; 844 × 390.
- Set z with `scrollTo(z·diveEnd)` and wait for the idle settle to be held, or use `Input.synthesizeScrollGesture`.

**Screenshots** (each at the R4-1 baseline and after R4-3/R4-4; side by side in the appendix):
1. **Desk, closed, 1440 and 390.** Check:
   - a slim silver slab with soft edges;
   - the J upright and glossy, the note and sticker on the lid, upright;
   - the MagSafe plug with an amber breathing LED, and the cable on the desk;
   - the contact shadow;
   - floppies, mug, plant and polaroid in the same places;
   - the phone frame still contains the desk corners.
2. **Hover the lid** (`dispatchMouseEvent` on the lid centre). Capture at +0.15 s (peek 7°, backlight leak) and +0.45 s (sheen mid-lid).
3. **Mid-dive.**
   - z 0.3: the lid near its overshoot.
   - z 0.5: the lid open; the keyboard backlit with readable legends and the inverted T; Touch ID ring; the big trackpad; the deck glow; the hinge barrel.
   - z 0.8: the thin bezel, camera dot, rounded top screen corners, and the mirror and DOM aligned (no double edge at holder alpha 0.5, `le` ≈ 0.51).
4. **Open (z = 1).**
   - The flat OS is 1081.6 × 676 logical at 1440 × 900, with no rounded corners and no seam at the swap. Compare the last 3D frame with the first flat frame.
   - Open About, Projects, Terminal and BugHunt: none clipped; the icons in 6 rows; the menubar intact.
5. **Floppy insert** (click RESUME at the desk). Frames at 0.15, 0.35, 0.55 and 0.8 s: the floppy rises, runs back along x 2.9, drops behind the pile, slides into the right side, and is seated sticking out 0.14; the front drive LED blinks. Then GAMES to check the eject and swap.
6. **Typing at z 0.5:** keydown `a`, then `ArrowUp` ×2. The A cap and the ↑ cap are depressed in the next frame.
7. **Phone:** 390 × 844 at the desk, mid-dive, and open (compact fade); 844 × 390 at the desk.
8. **Reduced motion** (`Emulation.setEmulatedMedia prefers-reduced-motion: reduce`): no peek, no sheen, no overshoot (sample z 0.3 and compare with `hingeAngle`), a steady amber LED; the backlight is still lit when open.
9. **Lamp off:** the laptop reflections dim; the room matches its pre-R4 look.
10. **Drag yaw +0.4:** the side slot, jack and floppy mouth are visible on the right; ports and plug on the left at −0.4.
11. **No WebGL** (`--disable-webgl`, or `canGL` false): the flat fallback looks exactly as before apart from the 1040 × 676 fit; no console errors.
12. **PMREM fallback** (patch `PMREMGenerator.prototype.fromScene` to throw through CDP `Runtime.evaluate` before load): the laptop is silver, not black.

**Performance** (`__jayScene.info()` after two frames, plus `renderer.info.memory`):

| Measure | Target |
|---|---|
| `render.calls` at the desk, mid-dive z 0.5 and z 0.98 | ≤ 0.6 × baseline (record both numbers) |
| Laptop meshes | ≤ 20 (the test enforces it) |
| Laptop triangles | ≤ 15k: take `render.triangles` with the laptop hidden and visible, and diff |
| Textures | baseline + 5 (atlas, glow, Touch ID, contact, sheen; minus the logo) |
| PMREM build | ≤ 30 ms (`performance.mark` around `buildEnv`) |
| FPS, headed GPU Chrome, 1440 × 900, 10 s at idle desk | ≥ 58 |
| FPS during a scripted dive | ≥ 55 |
| FPS, phone emulation with 4 × CPU throttle, mid-dive | ≥ 45 |

FPS is measured with a rAF counter injected through `Runtime.evaluate`. Log the console; there should be no `THREE.` warnings, including none from `mergeBufferGeometries`.

---

## 7. Risks and how they are handled

- **Metal looks dark or plastic.** Env intensity and colour are tuned by screenshot, with the luminance check in R4-4. The no-env fallback is tested.
- **Shared materials and dispose.** The dispose traverse (L148–155) disposes `map` only. The emissive maps are canvas textures tracked in `textures`, so they are released. The env render target needs an explicit release (R4-2 test).
- **Merge attribute mismatch.** All merged parts must be non-indexed and carry position, normal and uv (R4-2 test on the fake merge input).
- **Sticker orientation on the lid.** The rotation (0, π, π) is the same as today's logo. Verified by screenshot 1.
- **Floppy hidden in the edge-on slot.** The 0.14 protrusion and drag-yaw screenshots cover it. If it still reads poorly, raise it to 0.18; that is a test constant only.

### Critical Files for Implementation
- /Users/jewoo.lee/Desktop/Jewoo/Projects/jewoo-lee/.worktrees/feat-website-revamp/src/scene/createScene.js
- /Users/jewoo.lee/Desktop/Jewoo/Projects/jewoo-lee/.worktrees/feat-website-revamp/src/scene/sceneMath.js
- /Users/jewoo.lee/Desktop/Jewoo/Projects/jewoo-lee/.worktrees/feat-website-revamp/src/scene/floppy.js
- /Users/jewoo.lee/Desktop/Jewoo/Projects/jewoo-lee/.worktrees/feat-website-revamp/src/scene/textures.js
- /Users/jewoo.lee/Desktop/Jewoo/Projects/jewoo-lee/.worktrees/feat-website-revamp/src/core/constants.js

New files: `src/scene/laptop.js`, `src/scene/laptop.test.js`, `src/scene/laptopBuild.js`, `src/scene/laptopBuild.test.js`, `src/test/threeMock.js`. Also touched:
- `src/styles/os.css` and `src/styles/stage.css`, with their `.test.js` files;
- `src/os/osHost.test.js`, `src/app/createApp.test.js`;
- `src/scene/props.js` and `props.test.js`;
- `src/scene/floppy.test.js`, `src/scene/sceneMath.test.js`, `src/scene/textures.test.js`, `src/scene/createScene.test.jsx`;
- `src/stage/SceneMount.jsx` (`?stats` hook);
- `src/wallpaper/modes.js`.

---

## Appendix: Baseline (R4-1 step 2, HEAD `460ffcc`, before any visual change)

Measured on a build of `460ffcc` with a temporary `info()` hook (the same one R4-1 adds), in headless Chrome 155 (`--headless=new --use-angle=swiftshader --enable-unsafe-swiftshader`) against `vite preview`, opened as `/?stats`. Each number is `renderer.info.render` of the last frame, read four rAFs after `scrollTo`, before any idle settle. `calls` include the moon shadow pass. Numbers only; no screenshots were kept.

| Viewport | Desk (z 0) | Mid-dive | Late dive |
|---|---|---|---|
| 1440 × 900, DPR 1 | 114 calls, 3,942 triangles | z 0.51: 107 calls, 3,858 triangles | z 0.996: 22 calls, 240 triangles |
| 390 × 844, DPR 3, mobile | 114 calls, 3,942 triangles | z 0.50: 109 calls, 3,502 triangles | z 0.98: 66 calls, 856 triangles |

The desk count is stable (the same after 0.8 s at rest). The §2 target "scene `render.calls` at the desk ≤ 0.6 × baseline" is therefore **≤ 68 calls** at the desk.

**After R4-1 (measured, not estimated).** The R4-1 working tree was built (`npm run build`) and probed the same way: `vite preview`, the same headless Chrome 155 with swiftshader, `/?stats` (the real `SceneMount` hook, no temporary code), 1440 × 900 at DPR 1, `renderer.info.render` read through `__jayScene.info()` four rAFs after `scrollTo` at the same scroll fractions as the baseline (0, 0.5 and 0.96 of the dive). Result: 114 calls / 3,942 triangles at the desk, 106 / 3,846 mid-dive and 20 / 204 late in the dive. R4-1 adds no meshes, so the desk count is unchanged; the small mid- and late-dive differences are most likely frustum culling, because the camera ends further back from a wider screen (`camDistance`). This was not investigated further. The phone viewport was not re-measured after R4-1.
