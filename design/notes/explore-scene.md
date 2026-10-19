# Porting spec: 3D scene and scroll/camera controller

Source: `design/revamp-lab.html` (read-only). Line numbers refer to that file.
Scope: CSS 42–85, HTML ~273–345 (track/stage/hud/cue/rec, #os-holder, #glass), JS 1007–1283 (Ctrl, stage wheel/keys, initScene, Scene API). Where the scene calls into the OS module (lines ~674–762) or helpers (`ss`, `clamp`, `REDUCE`, `Snd`, `unlock`, `toast`, `Wall`, `Wallpaper`, `JAY_PX`) those are noted but not fully specified here.

---

## 1. Behaviour from the user's perspective

1. The page has a 220vh `.track` containing a 100dvh sticky `.stage` (dark `#141C2E` scene). Initially the user sees a closed laptop on a desk in a room, a visitor corkboard, dog tags, a window with falling snow, a lamp, mug, plant and three floppy disks. A bouncing scroll-cue (`#cue`) says "Scroll down to open the laptop".
2. **Scroll ~2% into the track** (`p > .02`, ≈ 0.024 × innerHeight px) while in desk mode and armed: the controller auto-enters "inside" mode. A single eased timeline `Ctrl.z` 0→1 runs over `max(.5 s, 1.9 s × (1 − z))`.
   - `z` 0→0.45: the lid opens (hinge from 90° to −10°).
   - The OS boots (boot log, splash) once the lid passes 75% open (`lidT > .75`), if the OS is in standby/off.
   - `z` 0.2→1: the camera dollies from the wide room shot to face the screen head-on.
   - `z` 0.86→1: the desktop *widens* (OS CSS size grows from 900×675 to fill the viewport).
   - Page scrolling is blocked by wheel `preventDefault` while the tween runs (`!Ctrl.interactive`).
3. When the tween ends (`interactive = true`): HUD hidden (`.stage.zoomed`), the `.glass` click-catcher hidden, OS switched to "live" (no vignette overlay, real pointer interaction). On desktop the 3D screen stays in place and widens to fill the stage. On narrow stages (`stage.clientWidth < 760`) the OS is moved into a full-screen `.flat-host` instead.
4. Inside: the wheel belongs to the OS (windows scroll their own content). An upward gesture on the desktop itself accumulates; ≥240 px of upward `deltaY` within a 400 ms window exits. The first downward accumulation of 240 px shows a one-time toast ("You're inside the laptop … press Esc or click ⏏ Close laptop"). Esc, the in-OS "⏏ Close laptop" menubar button, and the Shut Down / Restart flows also exit.
5. Exit: `Ctrl.exit()` tweens `z` 1→0 over `max(.5 s, 1.5 s × z)`, smooth-scrolls the page back to the track top if `p > .005`. The lid closes as `z` falls. The OS stays powered on (it is not shut down by exit).
6. Clicking things in the 3D scene (desk-mode only, `z < .9`): laptop lid, power button, three floppies, dog tags, mug, lamp, visitor wall, polaroid, sticky note, keyboard, window. Hovering shows a yellow tooltip and a blue emissive glow on the target. Dragging on the canvas (desk mode, `z < .5`) rotates the rig yaw by up to ±0.4 rad. Pointer movement gives a subtle parallax camera drift that disappears as `z → 1`.
7. Reduced motion: all tweens become ~10 ms, scrolls become instant, parallax and tag swing are disabled, boot delays shorten, disco is a no-op.
8. No WebGL (or initScene throws): no 3D at all. The OS runs full-screen in `.flat-host` from the start, with a notice toast. Scroll shows the cue fade and auto-boots the OS when `p > .1`.

---

## 2. Constants, formulas and code

### 2.1 CSS (lines 42–85, plus .os rules at 87–167 that the controller toggles)

| Selector | Key values |
|---|---|
| `.track` | `position:relative; height:220vh` → scroll range `max = track.height − innerHeight` = 1.2 × innerHeight |
| `.stage` | `position:sticky; top:0; height:100vh; height:100dvh; overflow:hidden; background:var(--scene) (#141C2E); color:var(--scene-ink) (#EAF2FB); touch-action:pan-y` |
| `.stage .gl` | absolute, inset 0, 100%×100%, `display:block` (the WebGL canvas, prepended as first child) |
| `.stage .css3d` | absolute `!important`, inset 0, `pointer-events:none`; children `> div` also `pointer-events:none` |
| `#os-holder` | `width:900px; height:675px` (the CSS3D object; in the page it lives inside `.park`) |
| `.flat-host` | absolute, inset 0, `display:none`, `z-index:15`, `overflow:hidden`, bg `#04070A`; `.on` → `display:block; animation:fsIn .18s ease-out; touch-action:none; overscroll-behavior:contain` |
| `.park` | `position:absolute; left:-99999px; top:0` (off-screen home of #os-holder before CSS3D takes it) |
| `.os` | `width:900px; height:675px; overflow:hidden; pointer-events:auto` (this re-enables pointer events under the `pointer-events:none` CSS3D wrapper) |
| `.os.flat` | `width:100%; height:100%` |
| `.os.live::after, .os.flat::after` | vignette overlay hidden (`::after` is the 0.3-alpha radial vignette otherwise) |
| `.stage.zoomed .glass, .os.flat .glass` | `.glass` (z 9500, full-bleed transparent button inside #os) hidden |
| `.os.compact` | narrow layout rules (lines 160–167): windows at `left:6px; top:38px; width:calc(100% − 12px); height:calc(100% − 44px)`; `.os.flat #mb-snd` hidden |
| `.cue` | absolute, `left:50%`, `bottom:max(22px, safe-area-bottom)`, `translateX(-50%)`, `z-index:10`, `pointer-events:none`, opacity `.8` (set inline by JS) |
| `.hud` | absolute, `top:max(14px, safe-top)`, `right:max(14px, safe-right)`, flex, wrap, `justify-content:flex-end`, `max-width:calc(100% − 28px)`, z 20 |
| `.hud .exit` | `display:none` (always! #hud-exit is never visible) |
| `.stage.zoomed .hud` | `display:none` |
| `.hud button` | `font:12px var(--f-px)`, bg `rgba(10,16,28,.72)`, text `#EAF2FB`, border `1.5px rgba(234,242,251,.35)`, padding `8px 10px`; at `max-width:520px` padding `7px 8px`, font 11px |
| `.tip3d` | absolute, `left:0; top:0`, pointer-events none, bg `#FFD15C`, text `#122030`, font `11px var(--f-px)`, padding `5px 8px`, z 30, `white-space:nowrap`; position is set via `transform: translate(x,y)` |
| `.toasts` | absolute, `top:max(62px, safe-top)`, centred, z 40, width `min(400px, 100% − 32px)`, pointer-events none |
| `.rec` | absolute, inset 0, z 45, bg `rgba(6,10,18,.7)`, grid centred, padding 16 |
| `.rec-card` | `width:min(520px,100%)`, `max-height:100%`, overflow auto |
| `.pcard.on` | `outline:4px solid #FFD15C` (not scene, skip) |
| `@keyframes fsIn` | `from {opacity:0}` |

`.cue` animations: `.wheel` (1.6 s, translateY 0→7 px and fade) and `.chev` (1.6 s, translateY 0→4 px, opacity .4→1).

### 2.2 HTML structure (lines ~273–345)

```
section.track#track (height 220vh)
  div.stage#stage (sticky)
    div.flat-host#flat-host
    div.hud
      button.exit#hud-exit "⤴ Step back"          (CSS-hidden)
      button#hud-rec "Recruiter view"
      button#hud-ach "★ 0/13"
      button#hud-snd "Sound: off"
    div.cue#cue role=img aria-label="Scroll down to open the laptop" (wheel + chevron SVGs)
    div.toasts#toasts aria-live=polite
    div.tip3d#tip3d hidden
    div.rec#rec hidden > div.rec-card role=dialog aria-label="Recruiter view"
         h2, ul, links, button#rec-close "Back to the fun"
    (WebGL canvas and CSS3D layer are prepended/inserted by initScene)
div.park
  div#os-holder (900×675)
    div.os#os data-state=standby
      layers .l-standby, .l-boot (#boot-log, #boot-bar), .l-desk (#wallpaper canvas, .menubar with
         #mb-logo, #mb-help, #mb-exit "⏏ Close laptop", #mb-snd, #mb-clock; #menu-pop; #icons-l/#icons-r; .wallmark; #wins)
      .l-off
      button.glass#glass aria-label="Zoom into the screen"  (z 9500, full-bleed, inside #os)
```

### 2.3 Controller constants (Ctrl, lines 1007–1032)

- `easeIO(t) = t<.5 ? 4t³ : 1 − (−2t+2)³/2` (cubic in-out). Used for the `z` timeline.
- Timeline duration: enter `max(.5, 1.9*(1−z))`; exit `max(.5, 1.5*z)`; REDUCE → `.01`.
- Scroll progress: `p = clamp(−track.rect.top / max(1, track.height − innerHeight), 0, 1)`.
- Armed rules: `p < .01 → armed=true`; `p > .6 → armed=false`.
- Auto-enter trigger: `mode==='desk' && armed && !tw && p > .02`.
- Cue opacity (scene mode): `.8 × (1 − ss(0,.15,z))`. Cue opacity (no-scene mode): `1 − ss(.01,.2,p)`.
- No-scene auto-boot: `p > .1 && OS.state==='standby'` → `OS.boot()`.
- `enter()` only scrolls if `track.rect.top > 1` (page is above the track, e.g. clicked from elsewhere): `scrollTo({top: scrollY + top + 2, behavior: REDUCE?'auto':'smooth'})`. Scroll-triggered enters do NOT move the page.
- `exit()` scrolls to track top only if `p > .005`: `scrollTo({top: track.rect.top + scrollY, behavior: ...})`.
- `narrow` (Ctrl) = `stage.clientWidth < 760`, set in `resize()` via `setNarrow`.
- `applyFlat()` → `OS.setFlat( (interactive && narrow) || !Scene, narrow )`.

`interactive` is recomputed each update: `inter = mode==='inside' && !tw`. When it changes:
`stage.classList.toggle('zoomed', inter)`, `OS.setLive(inter)`, `applyFlat()`.

### 2.4 Stage input (lines 1036–1055)

- Global `keydown` (window): `Scene.pressKey(e.key)`; click sound if `Snd.on` and single char; Konami buffer (last 10 keys, single chars lower-cased, arrows as `ArrowUp` etc.). `KONAMI = [ArrowUp, ArrowUp, ArrowDown, ArrowDown, ArrowLeft, ArrowRight, ArrowLeft, ArrowRight, b, a]`. On match: `kq=[]`, `unlock('konami')`, toast 'Cheat code', then `OS.disco()` if `OS.state==='on'` else `Scene.disco(6)`.
- Escape: if `#rec` visible → hide it; else if `Ctrl.interactive && Scene` → `Ctrl.zoomOut()`.
- Wheel on `#stage` (passive:false):
  - return if `!Scene` or `Ctrl.mode !== 'inside'`.
  - if `!Ctrl.interactive` → `preventDefault` and return (blocks page scroll during dive).
  - find `sc = target.closest('.wb,.t-out')`; if `sc` can still scroll in the wheel direction, return (native scroll of the window content).
  - `preventDefault()`; return if target is in `.win,.menu-pop`.
  - Accumulate: `if now − wheelT > 400 → wheelAcc = 0`; `wheelT = now`; `wheelAcc += deltaY`.
  - `wheelAcc < −240` → reset and `Ctrl.exit()`.
  - `wheelAcc > 240 && !wheelHint` → `wheelHint=true` (once per page life) and toast.
- HUD: `#hud-exit` → zoomOut; `#hud-ach` → `Scene.openLid(); Ctrl.zoomIn(); OS.openApp('ach')`; `#hud-rec` → show `#rec`, focus `#rec-close`; `#rec-close` and backdrop click → hide.
- `#mb-exit` (in OS menubar, lines 720) → `Ctrl.zoomOut()`. `#glass` click → `Scene.openLid(); Ctrl.zoomIn(); if standby/off → boot()`.

### 2.5 Scene constants (initScene, lines 1057–1274)

**Renderer / camera / world**
- `WebGLRenderer({antialias:true})`, `setPixelRatio(min(devicePixelRatio, 1.5))`, `outputEncoding = sRGBEncoding` (r128 API), `shadowMap.enabled=true`, `PCFShadowMap`. Canvas class `gl`, prepended to `#stage`.
- `scene.background = 0x141C2E`, `scene.fog = Fog(0x141C2E, 16, 34)`.
- Camera: `PerspectiveCamera(35, 1, .05, 80)`; fov is switched to **46 when `narrow` (aspect < 1.05)**, else 35.
- CSS3D (optional): `CSS3DRenderer` with `className='css3d'`, inserted after the GL canvas; `CSS3DObject(holderEl)` in its own scene; `cssObj.scale.setScalar(2.6/OS_W)` with `OS_W = 900`.

**Lights**
- Hemisphere: `(0xB8CCFF, 0x2A1E14, .55)`; lamp-off → `.18`.
- Moon directional: `0xA9C1FF`, intensity `.42`, position `(-6, 8, 5)`, castShadow, `shadow.mapSize 1024²`, shadow camera ortho `left/right/top/bottom ±5`, `near 1`, `far 25`, `bias -.0006`.
- Screen light (in hinge): `PointLight(0x7CC4FF, 0, 6, 2)` at `(0, 1.1, 1.0)`; intensity lerps to `sl = (on?1.1 : boot?.6 : standby?.25 : 0) × lidT` at 0.08 per frame.
- Lamp light: `PointLight(0xFFC27A, 1.5, 9, 1.5)` at `(−1.15, 1.2, 0)` inside lamp group. Off → intensity 0.
- Materials: `M(color, opts)` = `MeshStandardMaterial({color, roughness:.7, ...opts})`.

**Room and desk (scene-level unless noted)**
- Back wall: plane 40×20 at `(0,4,−3)`, `0x1F2B45`, roughness .95, castShadow false.
- Floor: plane 40×40 at `y=−2.5`, rotX −π/2, `0x161E30`.
- Desk top (in rig): box 7×.22×3.2 at `(0, −.11, 0)`, `0x6E4A30`. Legs: box .16×2.3×.16 at `(±3.3, −1.37, ±1.45)`, `0x3A2818`.

**Window (scene-level)**
- Sky: canvas 512×420, vertical gradient `#08122A → #2B3D6B`, 60 stars, Mont-Royal silhouette (`quadraticCurveTo`), 10 buildings with `#FFD98A` windows, cross glyph at `(.3w, .24h)` with `shadowBlur 12` (`#BFD8FF`), snow strip at bottom. Plane 2.4×2.0 at `(−3.5, 2.7, −2.99)`, MeshBasic (`toneMapped:false`).
- Frame: 6 bars (depth .08) at z −2.95 around `(−3.5, 2.7)`; sill box 2.9×.1×.3 at `(−3.5, 1.6, −2.86)`.
- Snow: `SN = 280` points, x ∈ [−4.65, −2.35), y ∈ [1.75, 3.65), z −2.93, `PointsMaterial({size:.035, opacity:.9, transparent})`. Fall speed `snowV ∈ [.25, .6]` units/s, × `sb` (3.5 while `snowBoost > 0`, else 1). Reset to `y = 3.65`, random x when `y < 1.75`. Sway `sin(t/900 + i) × .0015` per frame. `snowBoost` decays `dt` per frame.

**Visitor wall corkboard (scene-level group `cork` at `(1.55, 3.05, −2.97)`)**
- Backing box 2.12×1.47×.04, `0x7A4E2C`.
- Cork face: canvas 512×350, base `#C8955E` with 900 speckles; title `VISITOR WALL` at `(258,34)`, font `20px Silkscreen`, `#2A1A0C`. Six slots at canvas coordinates `[252,52],[340,52],[428,52],[252,160],[340,160],[428,160]`; each slot: rotate `((i*37)%7 − 3) × .035` rad, white 76×76 frame, image drawn 66×66 at offset −33, or dashed 68×68 outline if empty; pin dot r 6 at `(0, −36)` colours `['#E8452E','#4AA6EE','#FFD15C'][i%3]`. Caption at `(258, h−16)` font `15px JetBrains Mono`: `N pinned by visitors` or `your drawing here?`. Plane 2.0×1.36 at `(0,0,.025)`.
- `setWall(pngs)`: slice to max 6, load each as `Image` (failed images dropped), set `wallImgs`, call `corkTex._draw()`.
- Polaroid group `pol` at `(−.55, 0, .05)` in cork, `rotation.z = .06`. Frame box .64×.76×.012 `0xF7F7F2`. Photo plane .54×.58 at `(0, .06, .008)`, texture from `JAY_PX` (nearest filter, no mipmaps) or fallback `img/jay.jpg`. Red pin sphere r .035 at `(0, .36, .02)`.

**Dog tags (scene-level group `tags` at `(−1.6, 3.05, −2.92)`)**
- Hook: cylinder r .03 h .06 at `(0,.03,−.02)`, rotX π/2, `0x8A96A3`.
- Chain: cylinder r .006 h .55 at `(0, −.27, 0)`, metal `0xC3CCD5` metalness .85 roughness .28.
- Tags: box .17×.28×.012 at `(0, −.68, 0)` and at `(.04, −.65, −.014)` with rotZ .15.
- Swing: `tags.rotation.z = REDUCE ? 0 : sin(tagT × 3.1) × (tagSwing + .03)`; `tagSwing` starts .05, set to .7 on click, decays `× .6^dt`.

**Laptop (rig group; base at `(0, 0, .35)`)**
- Case: box 3.0×.16×2.1 at `(0, .08, 0)`, `0xCDD3DA`, roughness .55.
- Deck plate: 2.76×.012×.98 at `(0, .162, −.48)`, `0x9AA3AD`.
- Keys: `keyM = 0xF3F5F8` roughness .5. Key box `(w, .05, .16)` at y `.19` (`userData.base = .19`). Rows, with `x = −1.12 + r×.07 + i×.225`, `z = −.86 + r×.19` (r = 0..3 for `1234567890`, `QWERTYUIOP`, `ASDFGHJKL`, `ZXCVBNM`), width .19. Space: w 1.1 at `(0, −.1)`. ENTER: w .4 at `(1.15, −.48)`, `ACC = 0x4AA6EE`. BACKSPACE: w .4 at `(1.15, −.86)`.
- Key press: `pressKey(k)` sets `userData.p = 1` (key name uppercased: letters, digits, `' '`, `ENTER`, `BACKSPACE`). Per frame `p = max(0, p − 7dt)`; `y = base − .035 × min(1, 2p)`.
- Trackpoint nub: cylinder r .035 h .05 at `(.17, .2, −.39)`, `0xE8452E`.
- Trackpad: 0.84×.008×.52 at `(0, .164, .5)`, `0xB6BEC7`. Two buttons 0.4×.014×.12 at `x = ±.21, z = .86`, `y .166`.
- Power button: group `pbtn` at `(1.28, .17, −.97)`, cylinder r .065 h .03, `0xE8572A`.
- Power LED: box .08×.025×.01 at `(−1.1, .08, 1.052)`. Drive LED: box .01×.025×.08 at `(1.507, .08, .1)`. Right-side port: box .012×.05×.58 at `(1.506, .08, .55)`, `0x1A222C`.
- Sticky note: canvas 256², plane .42×.42 at `(1.0, .17, .55)`, rotation `(−π/2, 0, .2)`. Text "type" / "help" :) in Caveat.
- Sticker: canvas 256×64, plane .5×.125 at `(−1.0, .166, .75)`, rotX −π/2.
- Power LED emissive: on/boot `0x2BE070`; standby `blink ? 0xFFAA22 : 0x221100` where `blink = (t/600) % 2 < 1`; off `0x000000`.
- Drive LED: `driveBusy > 0 || boot` → `((t/80)|0) % 2 ? 0xFF5533 : 0x220800`; else black. `driveBusy` decays `dt`; set by `Scene.drive(s)`, which boot calls with `.2` per log line and insert calls with `1.2`.

**Lid (hinge group at base `(0, .235, −1.05)`)**
- `LH = 2.25`. Lid body: box 3.0×LH×.1 at `(0, LH/2, −.05)`, `CASE`.
- Bezel: plane 2.74×2.08 at `(0, 1.12, .002)`, `0x0B0F14`, roughness .3.
- Mirror (WebGL face, MeshBasic, `toneMapped:false`): canvas 512×384, plane 2.6×1.95 at `(0, 1.12, .004)`, drawn by `drawMirror`.
- Anchor: `Object3D` at `(0, 1.12, .006)` in hinge. CSS3D object follows it; `aN = (0,0,1)` rotated by the anchor's world quaternion.
- Logo: canvas 256×128 'JAY' 72px Silkscreen `#4AA6EE`; plane 1.0×.5 at `(0, LH/2, −.102)`, rotation `(0, π, π)`, `MeshStandard({transparent, emissive 0x0b2a44, roughness .4})`.
- Hinge rotation: `hinge.rotation.x = π/2 + (−10° − π/2) × lidT`, so closed = π/2 (90°), fully open = −10°.
- `lidT = ss(0, .45, Ctrl.z)`.

**Floppies (rig; body box .5×.03×.52, `MeshStandard` with side material `f.col` and label canvas on the top face)**
| label | app | col | home `[x, y, z, rotY]` |
|---|---|---|---|
| PROJECTS | projects | `0x2F6FB0` | `[2.15, .016, .75, .3]` |
| GAMES | bugs | `0xE0602A` | `[2.32, .048, 1.08, −.2]` |
| RESUME | resume | `0x2A2F36` | `[2.08, .08, 1.4, .6]` |

**Mug (rig group at `(−2.3, 0, .85)`)**: cylinder r .19 top / .17 bottom h .44 at y .22, `0xED1B2F`; torus R .11 tube .03 at `(.21, .23, 0)` rotY π/2; coffee disc r .165 h .01 at y .4 `0x3B2314`.

**Desk lamp (rig group at `(3.0, 0, −1.3)`)**: base cylinder r .28/.32 h .08 at y .04; arm 1 r .03 h 1.3 at `(−.15, .7, 0)` rotZ .25; arm 2 r .03 h .9 at `(−.62, 1.42, 0)` rotZ 1.05; shade open cone r .3 h .4 at `(−1.02, 1.42, 0)` rotZ .6, DoubleSide; bulb sphere r .09 at `(−1.07, 1.32, 0)` `0xFFE2B0`; all `0xE8572A` except bulb.

**Plant (rig group at `(−2.4, 0, −1.2)`)**: pot cylinder r .18/.14 h .3 at y .15 `0xC66B3D`; leaves sphere r .16 at `(0,.42,0)`, r .12 at `(.1,.5,.05)`, r .12 at `(−.09,.48,−.04)`, r .1 at `(.02,.6,−.02)`; `0x3B8F5A`.

**Rig vs scene**: `rig` (yaw-rotated by drag) contains desk, laptop, floppies, mug, lamp, plant. Wall, window, corkboard, tags are added directly to `scene` and do not yaw.

**Hotspots** (`addHot(obj, label, fn)`, `obj.userData.hot = {label, fn}`):
| object | label | action |
|---|---|---|
| hinge | Laptop · open me | `lidForce=true; OS.boot(); Ctrl.zoomIn()` |
| pbtn | Power button | if `OS.state==='on'` → `OS.shutdown()`; else boot + zoomIn |
| floppy ×3 | Floppy · LABEL | `insert(f)` |
| tags | Dog tags | swing .7; `unlock('tags')`; toast '한번 해병은 영원한 해병'; zoomIn; `OS.openApp('service')` |
| mug | McGill mug | hop: to `y .25` in .15 s, back to `y 0` in .2 s; toast; `Snd.tone(300, .1, 'sine', .06)` |
| lamp | Desk lamp | `setLamp(!lampOn)` |
| cork | Visitor wall | zoomIn; `OS.openApp('wall')` |
| pol | Polaroid | zoomIn; `OS.openApp('about')` |
| noteM | Sticky note | zoomIn; `w = OS.openApp('term')`; if `w._run`, `setTimeout(() => w._run('help'), 100)` |
| kbHot (group of all keys) | Keyboard | zoomIn; `OS.openApp('term')` |
| skyM | Window | `snowBoost = 8`; toast 'Montréal' |

Floppy `insert(f)`:
- `lidForce = true`. If `inDrive === f`: zoomIn and `openApp(f.app)` and return.
- If another floppy is in the drive, it goes out: tween to `(2.3, .09, .9)` in .3 s, then back home in .45 s.
- `inDrive = f`; `Snd.floppy()`.
- Tween in to `(2.35, .09, .9)` with rotation `(0,0,0)` in .45 s, then to `(1.2, .09, .9)` in .35 s. Then `driveBusy = 1.2`, `unlock('floppy')`, `Ctrl.zoomIn()`, `OS.openApp(f.app)`.

`setLamp(v)`: sets `lampOn`, `lampL.intensity` (1.5/0), bulb colour (`0xFFE2B0` / `0x3A3328`), `hemi.intensity` (.55/.18), `unlock('lamp')` when turned off, `Snd.tone(v?1200:800, .04, 'square', .05)`, returns `v`.

**Tween system** (`tw(obj, to, dur, done)`): records from/to position and rotation, `t` accumulates `dt` per frame, `k = min(1, t/dur)` with **quad in-out** `s = k<.5 ? 2k² : 1 − (−2k+2)²/2`. Position is lerped and rotation is set component-wise. On completion it is removed and `done()` is called. `dur = REDUCE ? .01 : dur`.

**Pointer and drag** (on `renderer.domElement` = `cv`):
- `pointermove`: `pointer.x = (clientX − rect.left)/rect.width − .5`, `pointer.y` likewise. If dragging: if `|dx| > 5` → `moved = true`; if `Ctrl.z < .5` → `yawT = clamp(drag.yaw + dx × .005, −.4, .4)`; return. Else, if `Ctrl.z < .9` pick the hover target, update glow (emissive `0x2E4D6B`, original emissive restored on un-hover), set tooltip text to the label, positioned at `(x + 14, y + 14)` px. Cursor: `pointer` if hovering, else `grab` if `z < .5`, else `default`.
- `pointerdown`: `drag = {x, yaw: yawT, moved: false}`.
- `pointerup`: if `drag && !moved && z < .9` → pick and call `fn()`; hide tooltip.
- `pointerleave`: drag = null, clear glow and hover, hide tooltip, `pointer.x = pointer.y = 0`.
- `pick(e)`: `Raycaster.intersectObjects(hot, true)[0]`, then walk parents until `userData.hot`.

**Frame loop** (`frame(t)`, lines 1234–1267), in this order:
1. `dt = min(.05, (t − last)/1000 || .016)`; `Ctrl.update(dt)`.
2. `e = ss(.2, 1, Ctrl.z)` (camera); `w, h` from stage; `aspect = w/h`; `narrow = aspect < 1.05` (camera only).
3. `lidT = ss(0, .45, z)`; `hinge.rotation.x = π/2 + (−10° − π/2) × lidT`.
4. If `lidT < .1` → `lidWasClosed = true`. If `lidT > .75 && lidWasClosed` → `lidWasClosed=false`; if OS standby/off → `OS.boot()`.
5. `holderEl.style.visibility = lidT > .5 ? '' : 'hidden'`; `willChange` `transform` during a tween.
6. If `!Ctrl.narrow`: `g = ss(.86, 1, z)`; `k = min(w/900, h/675) × .994`; `OS.setSize(900 + (w/k − 900)×g, 675 + (h/k − 675)×g)`.
7. `fov = narrow ? 46 : 35`; update projection if changed. `tv = tan(fov/2)`; `d = max(1.95/2/tv, 2.6/2/(tv × aspect))` (distance so that the 2.6×1.95 screen fills the view).
8. Wide pose `wp = narrow ? [.5, 4.4, 13.8] : [1.4, 3.6, 10.2]`; look `wl = narrow ? [.1, 1.3, 0] : [.2, 1.0, 0]`.
9. Parallax: `sp += (pointer − sp) × .08`; `par = REDUCE ? 0 : 1 − e`; `yaw += (yawT − yaw) × .1`; `rig.rotation.y = yaw × (1 − e)`.
10. `rig.updateMatrixWorld(true)`; `aPos = anchor world position`; `aN = (0,0,1) rotated by anchor world quaternion`.
11. Camera: `vA = wp + (sp.x × 1.1 × par, −sp.y × .7 × par, 0)`; `vB = aPos + aN × d`; `camera.position = lerp(vA, vB, e)`. Look target `lerp(wl, aPos, e)`; `camera.lookAt`.
12. Process tweens (described above).
13. `tagT += dt`; tag swing.
14. Key depression update.
15. Snow update.
16. LEDs; `driveBusy` decay; screen-light lerp.
17. Disco: if `discoT > 0` → `discoT −= dt`; `lampL.color.setHSL((t/700) % 1, .85, .6)`; when ≤ 0 reset to `0xFFC27A`.
18. `renderer.render(scene, camera)`; CSS3D: `anchor.matrixWorld.decompose(cssObj.position, cssObj.quaternion, tmpS)`; `cssObj.scale.setScalar(2.6/OS_W)`; `css.render(cssScene, camera)`.
19. Re-queue `requestAnimationFrame(frame)` if `running`.

Loop control: an `IntersectionObserver(threshold 0)` on `#stage` starts or stops the loop (`running`, `raf`).

**Resize**: `ResizeObserver` on `#stage` → `renderer.setSize(w, h, false)`, `css.setSize(w, h)`, camera aspect and projection, `Ctrl.setNarrow(w < 760)`.

**Scene API** (returned object):
```
Scene = {
  css: boolean,                 // CSS3DRenderer available
  onOS(state),                  // mirror redraw; 'off' clears lidForce
  setWall(pngs[]),              // data URLs, max 6
  pressKey(k),                  // key name, uppercased internally
  openLid(),                    // = Ctrl.enter()
  drive(s),                     // driveBusy = max(driveBusy, s)
  disco(s),                     // discoT = s (seconds)
  snow(s),                      // snowBoost = s
  lamp(),                       // toggles, returns new state
}
```

**Mirror** (`drawMirror(x, w, h)`, 512×384): state 'on' → draws `Wallpaper.canvas`, menubar strip, yellow and white icon squares, and a mock window at `(120, 70, 270, 190)`. Otherwise black, and standby shows 'JAY-OS' + 'waking up …' (Silkscreen 42px, VT323 24px); boot shows 3 BIOS lines at y 36/60/84.

**Font gate**: `document.fonts.ready` → redraw mirror, note, sticker, logo, cork, floppy label canvases.

**Boot after scene init**: `Wall.emit()` (calls `Scene.setWall`), `applyWallpaper()` (calls `Scene.onOS`), then if `!Scene` the no-WebGL fallback runs.

### 2.6 Fallback (no WebGL, lines 1277–1283)
- `initScene()` returns null when `typeof THREE==='undefined' || !canGL()`.
- Notice toast: absolute, `left:16px; bottom:16px; z-index:50; max-width:340px`, text "3D is unavailable in this browser, so JAY-OS runs flat. Everything still works."
- `#flat-host.style.zIndex = '5'`, `Ctrl.setNarrow(true)` (note: forced narrow, so compact layout).
- Own rAF loop: `Ctrl.update(min(.05, dt))`.
- Note: in this path `Ctrl.setNarrow(true)` is always called, so compact layout is applied even on desktop widths. Only `applyFlat` runs, with `!Scene` → flat always.

### 2.7 OS-side functions the scene relies on (lines ~674–762)
- `setState(s)`: `api.state = s`; `os.dataset.state = s`; `Scene.onOS(s)`.
- `boot()`: returns if state `boot` or `on`. Sets `boot`; runs BOOT log lines at 150 ms each (30 ms under REDUCE), calling `Scene.drive(.2)` per line. Then splash, 1000 ms (150 under REDUCE), then `on`, `Snd.chime()`, `unlock('boot')`, `clock()`, and flushes queued `openApp` calls.
- `shutdown(then)`: returns if not `on`. Closes all windows, `stopFx`, adds `.collapsing` (CRT-off animation), `Snd.off()`. After 600 ms (50 under REDUCE): state `off`, `unlock('shutdown')`, and `then` after a further 900 ms.
- `openApp(id)`: if not `on`, queues and boots, returns null.
- `setFlat(v, compact)`: toggles `.compact`. If `v` changes: move `#os` into `#flat-host` (`.flat` + `.on`) or back into `#os-holder` (remove `.flat`; reset `transform`; `curW = curH = 0`; `setSize(900, 675)`). If `v`, `fitFlat()`.
- `fitFlat()`: no-op unless `.flat`. If `.compact`, clear width/height/transform. Else `k = min(W/900, H/675)`; `transform-origin 0 0`; `scale(k)`; width `W/k`, height `H/k`.
- `setSize(w, h)`: round; no-op if unchanged; set `holder` and `os` width/height; `fitWindows()` if shrinking.
- `setLive(v)`: toggles `.live`; when turning off, reset `scrollTop` of `.wb,.t-out`.
- `api` also exposes `disco()` (if `!REDUCE`: class `disco` for 6 s and `Scene.disco(6)`), `wins`, `size()`, `clock()`, `matrix`, `confetti`.

---

## 3. Contract between Ctrl, Scene and OS

Calls go in these directions:

- **Ctrl → OS**: `OS.boot()` (enter, no-scene auto-boot), `OS.setLive(inter)` (on interactive change), `OS.setFlat(bool, narrow)` (applyFlat), `OS.setSize(w, h)` (frame, desktop only), `OS.state` read (no-scene boot, frame lid boot).
- **Ctrl → Scene**: `Scene` truthiness gates everything (enter/exit no-op without it). Ctrl reads nothing else from Scene.
- **Scene → Ctrl**: `Ctrl.update` (from frame), `Ctrl.z`, `Ctrl.tw`, `Ctrl.narrow`, `Ctrl.interactive`, `Ctrl.zoomIn/zoomOut` (hotspots, glass, HUD), `Ctrl.exit`.
- **OS → Scene**: `setState → Scene.onOS(state)`; `disco → Scene.disco(6)`; `boot → Scene.drive(.2)`; `shutdown` callbacks → `Ctrl.zoomOut()`; terminal `snow` → `Scene.snow(10)`; terminal `lamp` → `Scene.lamp()`; `Wall.emit → Scene.setWall(pngs)`; `applyWallpaper → Scene.onOS(OS.state)`; `#glass` and `#hud-ach` → `Scene.openLid()`.
- **Global → Scene**: window `keydown` → `Scene.pressKey(e.key)`.
- **Scene → OS** (direct): `OS.boot()`, `OS.openApp(...)`, `OS.shutdown()`, `OS.setSize`, `OS.state`, `OS.disco()`.
- **Scene internal**: `lidForce` is written in many hotspots and cleared in `onOS('off')`, but never read anywhere (see Risks). `Ctrl.ease` is assigned but unused.

Exit paths (all end in `Ctrl.exit()` or `zoomOut`):
1. Wheel-up accumulator (≥240 px within 400 ms gaps, reset on gap).
2. Escape key (only when interactive and rec is closed).
3. `#mb-exit` in the OS menubar ("⏏ Close laptop").
4. `#hud-exit` (CSS-hidden, so effectively unreachable).
5. OS "Shut Down…" → shutdown → `zoomOut` after 900 ms.
6. OS "notes" menu entry → `Ctrl.exit()` then scroll to `#try`.
7. Terminal `shutdown` command → `OS.shutdown(() => Ctrl.zoomOut())`.

---

## 4. Event handlers, edge cases and state rules

**Armed logic**
- `armed` starts true. It is set false by `enter()` and by `p > .6`. It is set true when `p < .01`.
- Auto-enter needs `armed && mode==='desk' && !tw && p > .02`.
- Consequence: after exit, the user must scroll back above 1% before a new scroll-enter is possible. Exit with `p ≤ .005` (no scroll) re-arms immediately on the next update but still waits `!tw`.
- Clicking the laptop from outside (`enter()` with `top > 1`) scrolls the page to the track first.

**Tween in progress**
- `Ctrl.tw` set, so `interactive = false`. Wheel is preventDefault'd (page scroll blocked). Hotspot clicks are still allowed (`z < .9`), but `zoomIn` during an exit reverses the tween (`from` = current z).
- Enter while exiting: `enter()` returns early if `mode==='inside'`. Exit sets `mode='desk'` first, so clicking the laptop during an exit tween starts a new enter from the current z.
- Re-entering a tween replaces `tw` (no queue).
- `interactive` toggles only after the tween completes (`inter = mode==='inside' && !tw`).

**Narrow (< 760 px stage width)**
- `Ctrl.narrow = true`. No `OS.setSize` widening (desktop-only).
- When `interactive`: `OS.setFlat(true, true)` moves the OS into `.flat-host` (full screen, `touch-action:none`, `overscroll-behavior:contain`, `fsIn` fade .18 s) and the OS renders in `.compact` layout.
- Otherwise the OS stays in the CSS3D holder with `.compact`.
- Camera fov 46 and narrow pose apply when `aspect < 1.05` (a separate test, based on aspect ratio).

**Reduced motion** (`REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches`, read once at load)
- Tweens `.01 s`; `scrollTo` behavior `auto`; parallax 0; tag swing 0; boot log 30 ms/line, 150 ms splash; shutdown 50 ms; disco no-op in `OS.disco`.
- Note: `REDUCE` is not re-evaluated on change; the camera and `z` timeline still animate normally.

**No WebGL / no THREE**
- `Scene = null`. `enter`, `exit`, `zoomIn`, `zoomOut` are no-ops (except `Ctrl.zoomOut` exits fine and `zoomIn` does nothing). Cue fades with `p`. OS auto-boots at `p > .1`. The OS is always in `.flat-host` (`setFlat(true, narrow)`). The fallback sets `Ctrl.setNarrow(true)` (compact).
- The `#hud-ach` button still calls `OS.openApp('ach')`, which queues and boots.

**CSS3D missing but WebGL present**
- `Scene.css = false`, `cssObj` is not created, `#os-holder` stays in `.park` (off-screen). The desktop is invisible in 3D, and only the lid mirror canvas (`drawMirror`) shows, which has no interactivity. The `interactive` path still works via `.flat-host`.

**Shutdown / power**
- Power button (`pbtn`): if OS `on` → `OS.shutdown()` (no exit). Else `boot()` and `zoomIn()`.
- Shutdown while interactive: the OS shows the "off" layer and the exit callback runs `Ctrl.zoomOut()` after 900 ms.
- `onOS('off')` sets `lidForce = false` (unused, see Risks).

**Hover and glow**
- Hover only when `Ctrl.z < .9`. Glow is applied to every mesh of the hovered object (`traverse`), storing and restoring each material's original `emissive` in `userData.e0`.

**Konami**
- Works on any page state. Triggers `unlock('konami')`. If OS is `on`, `OS.disco()`, else `Scene.disco(6)`. Disco does not run under REDUCE for OS path but `Scene.disco(6)` is called anyway from the window handler path, which is a minor inconsistency.

**Wheel accumulation details**
- `wheelAcc` resets when `now − wheelT > 400`. Exit fires at `wheelAcc < −240`, which resets the accumulator. Scroll-down toasts once (`wheelHint`). Wheel over `.win` or `.menu-pop` is prevented but does not accumulate.
- Wheel over scrollable `.wb` or `.t-out` content that can scroll in the direction does not prevent default (native window scroll).

**Touch**
- `.stage { touch-action: pan-y }`. Touch-scroll during the dive still scrolls the page (not blocked by the wheel handler). Its effect is only on `p`, which doesn't affect `z` once entered. On desktop, the flat-host and wheel path are not used.
- No dedicated touch handlers. Tap on 3D hotspots works via `pointerup` on the canvas.

---

## 5. Testable behaviours (GIVEN / WHEN / THEN)

Controller
- GIVEN scene is up, desk mode, armed, p = 0 / WHEN page scrolls so p = .03 / THEN `Ctrl.enter()` runs, `mode === 'inside'`, `tw` is set with `to = 1`, and `OS.boot()` is called.
- GIVEN p = .015 / WHEN `update` runs / THEN no enter (threshold is .02).
- GIVEN mode 'inside' and `tw` in progress / WHEN wheel down on stage / THEN `preventDefault` is called and `Ctrl.interactive` stays false.
- GIVEN `tw` finished, mode 'inside' / WHEN `update` / THEN `interactive = true`, `#stage` has class `zoomed`, `OS.setLive(true)` was called.
- GIVEN enter tween from z = 0 / WHEN run to completion / THEN duration is 1.9 s (`easeIO` applied) and z ends at 1.
- GIVEN exit from z = 1 / WHEN run / THEN duration is 1.5 s and z ends at 0, with `mode === 'desk'`.
- GIVEN exit from z = .4 / WHEN run / THEN duration is `max(.5, .6) = .6 s`.
- GIVEN exit with p > .005 / WHEN called / THEN `scrollTo` targets the track top (`rect.top + scrollY`).
- GIVEN p < .01 after a dive / WHEN p returns to .03 / THEN a new auto-enter happens (armed re-armed).
- GIVEN p > .6 / WHEN update / THEN `armed === false` and no enter occurs until p < .01.
- GIVEN `Ctrl.zoomIn()` called twice / WHEN second call / THEN no second tween (already inside).

Wheel
- GIVEN inside and interactive / WHEN wheel deltaY = −100 three times within 400 ms / THEN `Ctrl.exit()` runs (accumulator reaches −300).
- GIVEN the same but gaps of 500 ms between events / THEN no exit (accumulator resets).
- GIVEN inside and interactive / WHEN wheel deltaY = +300 / THEN the wheel hint toast is shown once; a second +300 does not show it again.
- GIVEN wheel over `.win` / WHEN deltaY negative / THEN no exit accumulation.
- GIVEN a `.wb` that can scroll up / WHEN deltaY < 0 / THEN default not prevented, no accumulation.

Keyboard
- GIVEN interactive / WHEN Escape / THEN `Ctrl.zoomOut()` is called.
- GIVEN `#rec` visible and interactive / WHEN Escape / THEN `#rec` hides and the scene does not exit.
- GIVEN any key / WHEN keydown / THEN `Scene.pressKey(e.key)` is called; `pressKey('a')` sets the 'A' key userData.p = 1.
- GIVEN the Konami sequence / WHEN entered / THEN `unlock('konami')` and a toast 'Cheat code' fire, and disco starts.

Scene and OS
- GIVEN lidT crosses .75 for the first time with OS 'standby' / WHEN frame runs / THEN `OS.boot()` runs once; a second cross without lidT dropping below .1 does nothing.
- GIVEN OS state 'on' / WHEN the power button is clicked / THEN `OS.shutdown()` runs.
- GIVEN OS state 'off' / WHEN the power button is clicked / THEN `OS.boot()` and `Ctrl.zoomIn()` run.
- GIVEN frame with Ctrl.z = .9 and desktop (not narrow) / WHEN frame runs / THEN `OS.setSize` gets w,h where `g = ss(.86,1,.9)` ≈ .26 and final values follow the widening formula.
- GIVEN `Ctrl.narrow` = true / WHEN frame runs / THEN `OS.setSize` is not called.
- GIVEN the camera fov flips between narrow and wide / WHEN frame runs / THEN `camera.updateProjectionMatrix` is called only when fov changes.
- GIVEN keys pressed / WHEN `k.userData.p = 1` then frames of dt = .1 / THEN key y = base − .035 at first, back to base after p reaches 0.
- GIVEN hover over a hotspot with z < .9 / WHEN pointermove / THEN tooltip shows its label and is positioned at pointer + 14 px; with z ≥ .9 no tooltip.
- GIVEN pointerdown → pointermove with |dx| > 5 → pointerup / THEN the hotspot does not fire (drag).
- GIVEN drag dx = 200 px at z < .5 / WHEN pointermove / THEN yawT = clamp(200 × .005, −.4, .4) = .4.
- GIVEN floppy PROJECTS clicked while GAMES is in drive / THEN GAMES tweens out to (2.3,.09,.9) then home; PROJECTS tweens in, and `OS.openApp('projects')` runs after the second tween.
- GIVEN floppy already in drive / WHEN clicked again / THEN no tween, just zoomIn and `openApp`.
- GIVEN `Scene.setWall(pngs)` with 8 items / THEN only 6 are used.
- GIVEN `Scene.snow(10)` / WHEN frames run for 1 s / THEN snow fall speed is ×3.5 during the boost; boost decays to 0 after 10 s.
- GIVEN reduced motion / WHEN a tween is started / THEN its duration is .01 s.
- GIVEN reduced motion / WHEN drag tag swing / THEN tags.rotation.z stays 0.

Fallback
- GIVEN no WebGL / WHEN page loads / THEN `Scene === null`, the OS is in `.flat-host` with `.compact`, the notice toast is shown, and `Ctrl.narrow === true`.
- GIVEN no WebGL / WHEN p > .1 and OS standby / THEN OS boots.
- GIVEN no WebGL / WHEN Ctrl.enter() is called / THEN no tween starts.

Lifecycle
- GIVEN stage off-screen / WHEN IntersectionObserver fires not-intersecting / THEN `cancelAnimationFrame` and the loop stops; on re-entry, `last` is reset.
- GIVEN the component unmounts / THEN the rAF loop, IntersectionObserver, ResizeObserver, window `keydown` listener, canvas listeners, and renderer/textures are all released.

---

## 6. Risks and gotchas for the React + Vite port

1. **StrictMode double-mount.** `initScene()` builds a WebGLRenderer, prepends a canvas, creates CSS3D, starts an rAF loop, and adds window and canvas listeners. In StrictMode dev the effect runs twice. The port must make setup idempotent and cleanup complete: `cancelAnimationFrame`, `renderer.dispose()`, `renderer.forceContextLoss()` (optional), remove the GL and CSS3D DOM nodes, `ResizeObserver.disconnect()`, `IntersectionObserver.disconnect()`, `removeEventListener` for `keydown` and every canvas listener, and dispose geometries, materials and CanvasTextures. Otherwise you get two WebGL contexts and stacked canvases.
2. **Imperative DOM ownership.** `CSS3DObject(holderEl)` *moves* `#os-holder` out of its React parent into the CSS3D layer. `OS.setFlat` also `appendChild`s `#os` between `#os-holder` and `#flat-host`. React must not own those nodes. Mount them in a stable ref'd container that React never re-renders (e.g. render the OS tree once, or use a portal into a node React does not reconcile). Do not re-key or remount the OS subtree, or the boot state and open windows are lost.
3. **`initScene` try/catch leak.** `try { initScene() } catch { Scene = null }`. If initScene throws after `stage.prepend(renderer.domElement)`, a stale canvas stays. The port should clean up on any failure path.
4. **Global mutable state.** `Ctrl`, `Scene`, `OS` and `lidForce` are module-level singletons. In React, put them in a ref or a class instance owned by one component, and expose only the methods the OS and HUD need. Avoid two live instances (route changes, remounts).
5. **three.js version.** The prototype pins **three r128** (cdnjs `three.min.js` plus `examples/js/renderers/CSS3DRenderer.js`, `three@0.128.0`). Notes for a modern port:
   - `renderer.outputEncoding` and `sRGBEncoding` are r128-era names. Modern three uses `outputColorSpace` and `SRGBColorSpace`, and texture `colorSpace`.
   - Since r155 (`useLegacyLights` removed), light intensities and decay behave differently. The lamp `PointLight(1.5, 9, 1.5)`, hemi `.55`, moon `.42` and screen light `1.1` will look dimmer or brighter. Re-tune or keep `THREE.Light.useLegacyLights = true` for fidelity, or port to a version that still has it.
   - `CSS3DRenderer` is in `three/examples/jsm/renderers/CSS3DRenderer.js` (import, not a global). Pin the three version explicitly.
   - Shadow and PCF defaults changed slightly in later versions.
6. **Global `THREE` check.** `typeof THREE === 'undefined'` is used as the WebGL gate. With an import, this becomes an explicit feature check, but keep the `canGL()` probe (`getContext('webgl')`) as the fallback gate.
7. **Fonts.** Canvas textures draw Silkscreen, Caveat, JetBrains Mono and VT323. They must be loaded before first draw; the prototype redraws on `document.fonts.ready`. Keep that redraw in the port, or the textures will use fallback fonts.
8. **Frame-rate-dependent lerps.** `sp`, `yaw`, `screenL.intensity` (0.08 per frame), `snow` sway and `key` depression use per-frame factors, not dt. Port to dt-based smoothing if you want identical feel on 120 Hz displays.
9. **Dead code to drop or fix.** `lidForce` is written in ~10 places and never read. `Ctrl.ease` is never read. `.hud .exit` is always `display:none`, so `#hud-exit` is unreachable (the "Step back" affordance is the OS menubar "⏏ Close laptop" button and Esc). The `initScene` return value is used only as a truthiness gate.
10. **Window-level listeners.** The global `keydown` is registered at module load (no removal). In React, register it in a `useEffect` and remove it on cleanup.
11. **Timers.** `setTimeout` calls in the OS (boot, shutdown, Konami delay, `w._run('help')`) are not cleared on unmount. Track and clear them.
12. **Scroll coupling.** The controller reads `track.getBoundingClientRect()` every frame and uses `window.scrollTo`. Keep the `track` element height at 220vh and the sticky stage at 100dvh, or the `p` maths changes. Use `window` as the scroll root (not a container).
13. **Loop pause.** The rAF loop only runs while `#stage` intersects (threshold 0). `Ctrl.update` also runs from this loop, so auto-enter and armed logic pause when the stage is off-screen. This is fine because the user cannot scroll it into range, but note that `Ctrl.update` is not run from a separate loop when Scene exists.
14. **Hit testing layers.** Stacking order in the stage is: GL canvas (bottom), CSS3D layer (`pointer-events: none`, but `.os` has `pointer-events:auto`), then `.hud`, `.cue`, `.toasts`, `.tip3d`, `.rec`. The `.glass` overlay (z 9500) inside `#os` catches clicks in desk mode. The GL canvas still receives pointer events where the OS does not cover it, which is how the laptop and floppies get picked.
15. **Wheel listener `passive:false`.** React's `onWheel` is passive by default in some browsers. Attach with `addEventListener('wheel', fn, {passive:false})` on the stage node.
16. **Canvas texture helper.** `canvasTex(w, h, draw)` attaches `_draw` to the texture. Replace with a plain function that redraws and sets `needsUpdate`. Draw calls happen both at creation and on resize-free events (font load, `setWall`, `onOS`).
17. **Reduced motion is read once** at module load (`matchMedia(...).matches`). Subscribe to changes in the port.
18. **Hard-coded 900×675 OS.** Used in CSS (`.os`, `#os-holder`), in JS (`OS_W`, `setSize(900,675)`, `fitFlat`, `k` maths) and in the CSS3D scale (`2.6/900`). Keep these constants in one shared place.
19. **Sizing rule.** `Ctrl.narrow` (`< 760 px`) and the camera `narrow` (`aspect < 1.05`) are different tests. Keep both, and name them differently in the port.
20. **Cue opacity.** Set inline by JS each frame. In React, store it in a ref and write `style.opacity` directly, or it causes re-render churn.
21. **Tween easing mismatch.** `easeIO` (cubic in-out) drives `z`, and the per-object tweens use quad in-out. Do not unify them without checking feel.

---

## 7. Port checklist (minimum to reproduce)

- [ ] `useScrollScene()` hook: owns `track`/`stage` refs, `Ctrl`-equivalent state (p, z, mode, tw, armed, interactive, narrow), rAF loop gated by IntersectionObserver, and cleanup.
- [ ] Wheel (`passive:false`) and keydown handlers with the accumulator, Konami, Escape.
- [ ] `initScene(stageEl, osEl)` returning `{ onOS, setWall, pressKey, openLid, drive, disco, snow, lamp, css, dispose }`.
- [ ] OS module exposing `boot, shutdown, openApp, setFlat, setSize, setLive, disco, state` with the `.flat-host` move semantics above.
- [ ] Mirror drawing with the four states (standby, boot, on, off) and `Wallpaper.canvas`.
- [ ] Visitor-wall `setWall` with 6-slot compositing.
- [ ] Hotspot table, tween system, drag/parallax, glow and tooltip.
- [ ] Reduced motion (tween dur .01, scroll auto, parallax 0, tag swing 0).
- [ ] No-WebGL fallback (flat OS, cue fade, auto-boot at p > .1, notice toast).
- [ ] Narrow mode (`< 760` flat on interactive, compact class; camera narrow pose `aspect < 1.05`).
- [ ] Cleanup for StrictMode: cancel rAF, disconnect observers, remove listeners, dispose renderer/geometry/materials/textures, and remove canvases and CSS3D nodes.
