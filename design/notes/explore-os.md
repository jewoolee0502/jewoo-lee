# JAY-OS porting spec

Source: `design/revamp-lab.html` (read-only). Line refs are to that file.
Scope: OS shell, window manager, menubar, achievements, sound, clock, persistence, and the app registry (`APPS`, `dynApp`). The internals of `renderTerm`, `renderBugs`, `renderSnake`, `renderPaint` (lines ~888-1000) are summarised here but not fully specified. The 3D scene (`Scene`, `Ctrl`) is only covered where it drives the OS.

---

## 0. Coordinate system and DOM

- Fixed logical desktop: **900 x 675 px** (`OS_W=900`, `.os{width:900px;height:675px}`). All window coordinates are absolute px inside this box. The 3D scene scales the whole box with CSS3D.
- Structure (HTML ~311-337):
  - `#os-holder` (900x675) > `.os#os[data-state]` (`standby|boot|on|off`)
    - `.layer.l-standby` : logo "JAY-OS" (64px) + blinking "waking up …"
    - `.layer.l-boot#l-boot` : `pre#boot-log` + `.splash` (logo 72px, progress bar `#boot-bar`)
    - `.layer.l-desk#l-desk` : `canvas#wallpaper` (240x180 pixel art, scaled up) > `.menubar` > `#menu-pop` > `#icons-l` > `#icons-r` > `.wallmark` (`#wp-cap` caption) > `#wins`
    - `.layer.l-off` : "It's now safe to turn off your computer." + "press the power button to boot again"
    - `button.glass#glass` : full-size transparent overlay (z 9500) that zooms the camera in when clicked
    - `::after` vignette (z 9000), hidden when `.live` or `.flat`
  - Outside the OS, in `.stage`: `.flat-host#flat-host` (fixed full-screen overlay used for flat mode), `.hud` (`#hud-exit`, `#hud-rec`, `#hud-ach` "★ 0/13", `#hud-snd`), `.toasts#toasts`, `.tip3d`.
- Layers are shown by `.os[data-state=...]` selectors (CSS 90): standby->`.l-standby`, boot->`.l-boot`, on->`.l-desk`, off->`.l-off`. `.os.collapsing .l-desk` keeps the desktop visible during shutdown.
- Icon columns: `.icons.l` (left:10px), `.icons.r` (right:10px, `direction:rtl`, children reset to ltr). Grid 100px cols/rows, auto-flow column, top 46px, bottom 14px.

Port note: keep the 900x675 logical box and the absolute px geometry. The whole OS is one scalable surface, not a responsive layout.

---

## 1. OS states and transitions

| State | Shown | Entered from | Leaves to |
|---|---|---|---|
| `standby` | `l-standby` (blinking "waking up …") | initial load (`OS` starts as `standby`) | `boot` |
| `boot` | `l-boot` (typed BIOS log, then splash) | `OS.boot()` | `on` (after timer) |
| `on` | `l-desk` (desktop, windows, menubar) | end of boot | `off` (shutdown) |
| `off` | `l-off` ("safe to turn off") | end of shutdown | `boot` |
| `collapsing` (class on `.os`, state still `on`) | desktop CRT-collapse animation | start of shutdown | `off` |

### 1.1 What triggers boot (`OS.boot()` runs only if state is not `boot`/`on`)
- `Ctrl.update`: if there is no 3D scene and scroll progress `p > 0.1` while `standby` (line 1014).
- `Scene` lid opens (`lidT > .75` with `lidWasClosed`) while `standby`/`off` (line 1243).
- `#glass` click: `Scene.openLid()`, `Ctrl.zoomIn()`, then boot if `standby`/`off` (line 1024-ish, `$('#glass')`).
- Hinge hotspot "Laptop · open me" (line 1194); power-button hotspot when not `on` (line 1195).
- `Ctrl.enter()` (`zoomIn`) calls `OS.boot()` directly.
- Menubar Restart: `shutdown(() => boot())`.

### 1.2 Boot sequence (`boot()`, lines 680-686)
Log lines, each typed every **150 ms** (**30 ms** if reduced motion), in order:
1. `JAY-BIOS (C) 2001-2026 · Montréal Edition`
2. `CPU: Full-Stack Engineer @ McGill ........ OK` (green)
3. `Memory test: 640K ........ OK`
4. `Detecting drives:  A: 3½" floppy   C: projects (8)`
5. `Loading languages: 한국어, English ....... OK`
6. `Mounting /experience (7 roles) ........ OK`
7. `Checking coffee level ........ LOW` (orange; rendered as "LOW (refill advised)")
8. `Starting JAY-OS 2.0 …`

Each line calls `Scene.drive(.2)` if the 3D scene exists (drives the floppy-drive activity light).
After the 8 lines: `.splashing` is added (splash logo + bar shown), bar width goes to 100% over **0.8 s** with `steps(12)`. After **1000 ms** (150 ms if reduced motion), if still `boot`: `setState('on')`, `Snd.chime()`, `unlock('boot')`, `clock()`, then flush `queue` (any `openApp` calls made during boot).

Total normal-motion time: about 1.2 s log + 1.0 s splash = **about 2.2 s**.

### 1.3 Shutdown (`shutdown(then)`, lines 687-689)
- Only from `on`. Closes all windows (`closeApp` each, so `_cleanup` runs), hides the menu, stops fx, adds `.collapsing`, plays `Snd.off()` (sawtooth 220 Hz then 110 Hz).
- After **600 ms** (50 ms reduced): remove `.collapsing`, `setState('off')`, `unlock('shutdown')`, then `then()` after another **900 ms** (only if a callback was given).
- The CSS collapse (`crtOff`, 0.6 s): squash to a line (`scale(1,.006)`) with brightness 4 at 55%, then `scale(0,.006)` brightness 6.
- Callers: Menu "Shut Down…" -> `then = Ctrl.zoomOut`; Menu "Restart" -> `then = boot`; Terminal `shutdown` command (after 500 ms) -> `then = Ctrl.zoomOut`; power-button hotspot when `on`.

### 1.4 Clock behaviour (see section 5 too)
- `clock()` runs at boot and every **15 s**. It sets text for `.mb-mtl` ("MTL HH:MM"), `.mb-sel` (" · SEL HH:MM"), `.clk-mtl` and `.clk-sel` (About app clock tiles). Zones: `America/Toronto` (Montréal) and `Asia/Seoul`, format `en-GB` 24h `HH:MM`.

---

## 2. Window manager

### 2.1 Opening (`openApp(id)`, lines 698-710)
1. If `state !== 'on'`: push a closure onto `queue`; if state is `off` or `standby`, call `boot()`. Return null.
2. If `api.wins[id]` exists: `focusWin`, remove and re-add class `shake` (300 ms animation), return existing. **Only one window per id.**
3. Look up `APPS[id] || dynApp(id)`. Unknown id -> null.
4. Size: `w = min(def.w || 520, OS.w - 20)`, `h = min(def.h || 400, OS.h - 50)`, where `OS.w/h` = `os.clientWidth/clientHeight` (900/675 normally).
5. Position: if `def.x != null` then `clamp(def.x, 8, W-w-8)`, else `clamp(130 + cascade*30, 8, W-w-8)`. Y: if `def.y != null` use it, else `clamp(46 + cascade*26, 40, H-h-8)`. `cascade = (cascade+1) % 6` (a module-level counter that is advanced on each open).
6. Create `section.win.opening` with `data-app=id`, `--wc` = `def.color` (default `#4AA6EE`). Header `.tb` (title span + `✕` close button), body `.wb`.
7. Append to `#wins`, register in `api.wins`, focus it, wire pointerdown->focus, close button, drag on header, call `def.render(body, win)`.
8. `Snd.tone(520, .05, 'square', .03)` click; remove `.opening` after 220 ms (scale .9->1 and fade in, 0.2 s).

### 2.2 Closing (`closeApp(id)`)
Calls `win._cleanup()` if set (BugHunt `stop`, Visitor Wall listener removal, Snake `clearInterval`), removes the element and deletes `api.wins[id]`. Closing never affects other windows' state.

### 2.3 Focus and z-order
- `z` starts at 20. `focusWin(w)` sets `zIndex = ++z` and toggles `.focused` on all `.win`.
- Focus happens on: window open, pointerdown anywhere in the window (`win.addEventListener('pointerdown')`), header drag start, and re-open of an existing id.
- Unfocused window header uses grey `#D5DDE5`; focused uses its `--wc` colour.
- No minimise. No maximise. No resize.

### 2.4 Dragging (`dragify`, lines 690-697)
- Header only (`.tb`). Ignored if the pointer target is a `button` (so the ✕ works) or if `.os.compact` is set (no drag on phones).
- Pointerdown records `{x, y, l: offsetLeft, t: offsetTop, s: scale()}` and calls `setPointerCapture`, cursor `grabbing`.
- Pointermove sets:
  - `left = clamp(l + (clientX - x) / s, -win.offsetWidth + 90, W - 90)`
  - `top  = clamp(t + (clientY - y) / s, 34, H - 34)`
  - so at least 90 px of the window stays on-screen horizontally, and the header stays below the menubar (34 px).
- **CSS3D scale compensation:** `scale() = os.getBoundingClientRect().width / os.offsetWidth` (or 1). Pointer deltas are divided by it so that dragging tracks the pointer while the desktop is transformed. The same formula works in flat mode, where `fitFlat` applies a CSS `scale(k)`.
- pointerup/pointercancel clears state.

### 2.5 Resizing the desktop and clamping
- `setSize(w, h)` (called every frame from the 3D scene while zooming in, `OS.setSize(900 + (w/k-900)*g, ...)`) updates `#os-holder` and `.os` width/height. When the desktop **shrinks**, `fitWindows()` runs: each window's width/height is clamped to `min(w, W-20)` and `min(h, H-50)`, and `left/top` are clamped to `[8, W-ww-8]` and `[40, H-hh-8]`. On growth, windows are not repositioned.
- `fitWindows` is never called on growth and not on initial open (clamping happens at open via the formulas in 2.1).

### 2.6 Compact and flat modes (phones / narrow)
Two independent flags, set by `OS.setFlat(v, compact)`:
- **`flat`** (`.os.flat`): the `.os` element is moved from `#os-holder` into `#flat-host` (fixed overlay, z 5 per init, `display:none` until `.on`). `.os.flat` is `width/height:100%`. The desktop is scaled by `fitFlat`:
  - Normal: `k = min(W/900, H/675)`, `transform: scale(k)`, `transform-origin: 0 0`, desktop size becomes `W/k x H/k` (so it fills the window, the extra desktop grows sideways/downward).
  - **compact:** `fitFlat` clears width/height/transform, so the OS is native size (no scale).
- **`compact`** (`.os.compact`): class is set whenever `setFlat` is called with `compact=true`, and `compact` is `Ctrl.narrow`, i.e. `stage.clientWidth < 760` (`resize()` in the 3D scene). It is **not** tied to flat mode (see gotcha G4).
  - Windows: `left:6px; top:38px; width:calc(100% - 12px); height:calc(100% - 44px); box-shadow:none` (all `!important`, so they fill the OS).
  - Desktop icons: 84 px columns, 92 px rows; icon images 44 px.
  - `.mb-sel` (SEL clock), `.wallmark`, and `#mb-snd` are hidden (`#mb-snd` only in flat).
  - About and Skills.inv go single column; `.pol` max-width 180 px; Experience.log summary becomes one column and details lose the 160 px left margin.
  - Dragging disabled (see 2.4).
- Flat is used when `(interactive && narrow) || !Scene`. So the **no-3D fallback is always flat**. On a narrow screen, flat is used only when the user has zoomed in (`interactive`); on a wide screen the 3D desktop stays in place and only widens.
- `setFlat(false)` moves the `.os` back into `#os-holder`, removes `.flat`, resets `curW/curH` and calls `setSize(900,675)`.

### 2.7 Live mode
`setLive(v)` toggles `.os.live` (hides vignette) and resets `scrollTop` of `.wb` and `.t-out` when leaving. Live = camera fully inside the laptop (`Ctrl.interactive`). Input (keyboard, scroll wheel) reaches the OS only when live.

---

## 3. Menubar, menus, and HUD

### 3.1 Menubar (`.menubar`, height 32 px, z 7000), left to right
- `#mb-logo` "◆ JAY-OS": toggles `#menu-pop` (`hidden` toggled, `.on` class). Click on OS outside the menu or the logo hides it.
- `#mb-help` "Help": `openApp('term')` then `w._run('help')`. **This runs the terminal `run()` and so unlocks `term` (Hacker Voice).**
- spacer
- `#mb-exit` "⏏ Close laptop" (title "Step back from the laptop (Esc)"): `Ctrl.zoomOut()`.
- `#mb-snd` "Sound: off|on" (hidden in flat): `setSound(!Snd.on)`.
- `#mb-clock` (button): text `MTL HH:MM · SEL HH:MM`; click shows toast "Two time zones / Montréal, where Jay studies, and Seoul, where Jay's from." (kind `info`).

### 3.2 Menu popup (`#menu-pop`, top 32, left 8, min-width 220, z 7100). Buttons, `data-act`:
| Label | `data-act` | Behaviour |
|---|---|---|
| About JAY-OS | `aboutos` | `openApp('aboutos')` |
| Desktop Background… | `display` | `openApp('display')` |
| Trophies | `ach` | `openApp('ach')` |
| Design notes (prototype) | `notes` | `Ctrl.exit()` (zoom out), then after 1600 ms (50 ms reduced) smooth-scroll to `#try` (prototype-only, drop in port) |
| (hr) | | |
| Restart | `restart` | `shutdown(() => boot())` |
| Shut Down… | `shutdown` | `shutdown(() => Ctrl.zoomOut())` |

Any other `data-act` falls through to `openApp(act)`. Menu closes after any click.

### 3.3 HUD (outside the OS, `.hud`)
- `#hud-exit` "⤴ Step back": `Ctrl.zoomOut()`.
- `#hud-rec` "Recruiter view": opens the `#rec` overlay (not part of OS, out of scope).
- `#hud-ach` "★ N/13": `Scene.openLid()`, `Ctrl.zoomIn()`, `openApp('ach')`. Its text is updated by `renderAch()`.
- `#hud-snd` "Sound: off": `setSound(!Snd.on)`.

### 3.4 Sound toggle sync
- `setSound(v)` sets `Snd.on = v`, creates the `AudioContext` if turning on (`Snd.ctx()`), sets **both** `#hud-snd` and `#mb-snd` text to `Sound: on|off` and `aria-pressed`, and plays a 660 Hz blip if on.
- Both buttons call `setSound(!Snd.on)`, so they are always in sync.
- `Snd.tone/noise` return early unless `Snd.on`. So all sound is opt-in. `Snd.on` is **not persisted** (defaults to off on every load).
- Sound events: window open click (520 Hz 0.05 s), boot chime (523/659/784/1047 Hz triangle, staggered 0.11 s), achievement (`ach()`: 988 Hz then 1319 Hz), shutdown (`off()`), BugHunt pop, Snake eat (880 Hz), skill click (740 Hz), Salute (392 + 523 Hz), wallpaper click (660 Hz, `act()` in the 3D wallpaper), keyboard clicks in 3D.

### 3.5 Toasts
`toast(title, body, kind)`: appends `.toast` (+ `.info` for blue border) to `#toasts` (top-center, width `min(400px, 100%-32px)`, `pointer-events:none`). Removed after **3200 ms**, with a 400 ms opacity fade. Titles used: "★ Achievement unlocked", "Two time zones", "Mail", "Paint", "Pinned!", "Saved", "Visitor Wall", "BugHunt", "Cheat code", "Secret N · name", "Floppy", etc.

---

## 4. Icons, apps, and content

### 4.1 Desktop icons (`addIcon`, `.ic` button: 52 px pixel icon + label; click = `openApp(id)`)
Left column (`#icons-l`, in this order):
1. `about` "About.txt" (icon `doc`)
2. `projects` "Projects" (`folder`)
3. `exp` "Experience.log" (`log`)
4. `skills` "Skills.inv" (`chest`)
5. `term` "Terminal" (`term`)
6. `resume` "Resume.pdf" (`pdf`)
7. `mail` "Mail" (`mail`)
8. `display` "Wallpaper" (`display`)

Right column (`#icons-r`):
1. `bugs` "BugHunt.exe" (`bug`)
2. `snake` "Snake.exe" (`snake`)
3. `paint` "Paint" (`paint`)
4. `wall` "Visitor Wall" (`wall`)
5. `service` "Service.txt" (`tag`)
6. `ach` "Trophies" (`trophy`)
7. `bin` "Recycle Bin" (`bin`)

Saved paint drawings are appended to `#icons-r` as `my-art-N.png` icons (`art:N`, in-memory only).

Icon hover: lift and rotate; pressed: scale .92; label is white text on a dark pill.

### 4.2 App registry (`APPS`, lines 785-872) and `dynApp`

Colour is the window header (`--wc`). Default size if omitted is 520x400.

| id | Title | Colour | W x H | Position | Content and behaviour |
|---|---|---|---|---|---|
| `about` | About.txt | #4AA6EE | 640x470 | cascade | Two-column grid (170px / 1fr). Left: `figure.pol` (rotated -3 deg polaroid) with the dithered portrait (see 4.3) and caption "hi, it's me" (Caveat). Right: h2 "Hi, I'm Jewoo. Call me Jay.", bio paragraph (Computer Engineering at McGill, full-stack, AI, ROKMC Sergeant), `dl.facts` (NOW Montréal, QC · STUDYING B.Eng. Computer Engineering, McGill · SPEAKS Korean, English · STATUS green dot "Available for work"), two clock tiles MONTRÉAL and SEOUL (live via `clock()`), muted hint "Psst: open the Terminal and type neofetch." |
| `projects` | Projects · 8 items | #FFD15C | 640x500 | cascade | Muted "Click a project to open it." then a `.pgrid` of 8 `.pcard` (16:10 image + title). Click -> `openApp('p:' + i)`. |
| `p:0`..`p:7` (dynApp) | project title | #FFD15C | 600x540 | cascade | Screenshot `img/<img>.jpg` (max-height 250, object-position top), h2 title (+ `span.draft` "draft blurb" if `draft`), blurb, tag chips, link buttons: `live` ("Live demo ↗"), `url` ("Open on <host> ↗"), `repo` ("Source on GitHub ↗"); only present links render; all `target=_blank rel=noopener`. |
| `exp` | Experience.log | #7FE0A8 | 680x500 | cascade | Muted `$ tail -n 7 ~/experience.log`, then a `.log` list of 7 `details` (first one open). Summary: date (blue, mono) / company (bold) + role (italic). Body: description. Click toggles (native details). |
| `skills` | Skills.inv · inventory | #FF8A3D | 660x450 | cascade | Two-column inventory: 4-column grid of 16 `.slot` buttons (2-letter badge in category colour + name). Right panel "Pick an item" (default text "16 skills, colour-coded by type. Each one lists where Jay has actually used it."). Clicking a slot selects it (`.on`), shows the skill name, the category label in its colour ("LANGUAGE · Language", etc.), a "Used in:" list (the projects/roles in `SKILLS[i][3]`) or the fallback "Listed on the current site. A project that shows it off would help!". Plays 740 Hz blip. |
| `term` | Terminal · jaysh | #7CFFA0 | 640x420 | cascade | Terminal emulator (`renderTerm`, see 4.4). Body padding 0 (`[data-app=term] .wb`). |
| `resume` | Resume.pdf | #E8452E | 600x500 | cascade | h2 "Jewoo (Jay) Lee", muted "Full-stack developer · B.Eng. Computer Engineering, McGill University", tag chips (Vue / Nuxt, React, GraphQL, Firebase, PostgreSQL, Spring Boot, Python, Java), list of first 5 roles ("<company>: <role> (<dates>)"), and a muted note that the real site embeds `/files/JEWOOLEE_CV.pdf` with a download button (prototype does not embed). |
| `mail` | Mail · say hi | #C9A7FF | 500x470 | cascade | "I read everything. Pick a channel:" then 3 `.btn` links GitHub (github.com/jewoolee0502), LinkedIn (linkedin.com/in/jewoo-lee/), Instagram (instagram.com/jwuu_lee/). Then form: labelled `YOUR NAME` input and `MESSAGE` textarea (both `required`), "Send ✉" submit. Submit prevents default, resets, shows toast "Prototype only: nothing was sent. On the real site this form delivers to Jay's inbox." |
| `bugs` | BugHunt.exe | #E8452E | 340x250 | **x 520, y 50** | BugHunt mini-game (4.4). |
| `snake` | Snake.exe · eat the skills | #3BB273 | 440x530 | cascade | Snake (4.4). |
| `paint` | Paint | #FFD15C | 440x530 | cascade | Pixel paint (4.4). |
| `service` | Service.txt | #B9C3CD | 580x430 | cascade | h2 "Sergeant, ROK Marine Corps", muted "Sept 2022 – Mar 2024 · Communication & Intelligence", two paragraphs (PFC to Sergeant; interpreting in Freedom Shield '23, Freedom Shield '24 and Ssang Yong '23; "nothing is impossible when you work together as a team"). A **Salute** button: sets output "필승! (Pilseung: “certain victory”)" (28px VT323), plays 392 Hz then 523 Hz, `unlock('tags')`. |
| `ach` | Trophies | #FFD15C | 500x500 | cascade | `fillAch(body)` (see section 5, achievements). |
| `display` | Desktop Background | #5FCDE4 | 620x470 | cascade | Muted explanation, then `.pgrid` of 4 choices: "Auto · follows Montréal time" plus Montréal by night / Golden hour / Snow day. Each card shows a 240px snapshot of that mode (`Wallpaper.snapshot`). Click sets `wpChoice`, saves `store.set('jayos-wp', k)`, calls `applyWallpaper()`, and moves `.on` to the clicked card. |
| `wall` | Visitor Wall | #C8955E | 660x540 | cascade | Top row: note "UI preview · drawings stay in this tab" + segmented control **Visitor / Jay (moderator)**. Visitor view: intro "Drawings from people who stopped by. Draw one in Paint and press "Pin to wall"." and, if the visitor has a pending drawing, a dashed "notice" with its thumbnail ("waiting for Jay to approve"). Moderator view: "Waiting for approval (N)" queue with thumbnail, "From you ·" prefix if mine, "sent <time>", **Approve** (adds to wall, toast) and **Reject**. Both views: "On the wall (N)" grid of visitor drawings (`example` items get an "example" label); moderator view adds **Take down** per item. Empty states present. Footer button "Open Paint". Re-renders on `Wall.listeners`. |
| `bin` | Recycle Bin | #3BB273 | 420x290 | cascade | "1 item", one card "RecycleWise · open" (image) that opens `p:0`, note "Nothing in here is trash. It's RecycleWise." |
| `aboutos` | About JAY-OS | #4AA6EE | 420x280 | cascade | h2 "JAY-OS 2.0", description (Three.js + plain JS prototype; real one would use React Three Fiber), muted "Inspired by ED-Linux on edh.dev. Runs on a 90s laptop in Montréal, with snow." |
| `art:N` (dynApp) | my-art-N.png | #FFD15C | 320x390 | cascade | Image of the saved drawing (pixelated, 2px border), muted "Drawn by you. Jay would love to see it." |

Unknown ids: `dynApp` returns null, so `openApp` returns null.

### 4.3 Portrait (JAY_PX, lines 476-478)
- Loads `img/jay.jpg`, draws it into a 56x72 canvas (cropped to aspect), then runs `retro(c, PXPAL, 28)`: ordered Bayer 4x4 dither (`BAYER`) with strength 28 onto the 16-colour `PXPAL` palette, nearest colour by weighted RGB distance (.3/.59/.11). Output `dataURL`.
- Used by `About.txt` (`img.jay-px`, initial `src` is the raw jpg and is swapped when ready; on failure the raw jpg remains).
- Port: either precompute this as a static PNG asset (recommended) or keep as a runtime canvas.

### 4.4 Sub-apps (summary; full source is at lines ~888-1000)
- **Terminal `renderTerm`** (jaysh 0.2): input line `jay@jay-os:~$`, output log. Banner "type "help" to see what this computer can do." Every submitted line calls `unlock('term')` before dispatch (Hacker Voice). Unknown command -> "command not found", with a "Did you mean" suggestion when Levenshtein distance <= 2. Up/Down = history, Tab = autocomplete (unique prefix, or list of matches). Commands: `help`, `whoami`, `neofetch` (unlocks `neofetch`), `ls`, `projects` (lists p1..p8), `open <thing>` (p1..p8, app names, project title prefixes), `cat` (= open), `skills`, `experience`, `contact` (opens Mail), `snake`, `bugs`, `paint`, `matrix` (OS.matrix rain), `weather` (snow), `lamp` (toggles 3D lamp; "no lamp in flat mode" when no Scene), `wallpaper auto|night|golden|day` (saves `jayos-wp`), `salute` (unlocks `tags`), `sudo <...hire...>` (unlocks `hire`, confetti, opens Resume), `coffee`, `date`, `pwd`, `cd`, `echo`, `hello`/`hi`/`안녕`, `git`, `vim`, `rm`, `cheat`, `history`, `clear`, `exit` (zoom out), `shutdown` (OS.shutdown then zoom out). `NAMES` maps app aliases to ids.
- **BugHunt `renderBugs`**: text "Squash as many as you can in 20 seconds", SCORE and TIME (20 -> 0) readouts, "Start hunt" button. A `.bug-layer` (inset top 32px, over `#l-desk`) receives `.bugx` buttons (44px bug icon) spawned on random screen edges; they move inward at 60 + rand*90 + (20-left)*6 px/s. Spawn interval `max(.25, .8 - (20-left)*.03)` s. Click -> splat, score++, pop sound. Round end: `score >= 10` -> `unlock('bugs')` and toast ("Exterminator-level work" or "The bugs win this round"). Button becomes "Play again". `_cleanup` = stop.
- **Snake `renderSnake`**: grid 19x15 cells of 20px (380x300 canvas). Start = 3-cell snake at (6,7) moving right. Food cell shows the next skill abbreviation and cycles through the 16 `SKILLS` in order (`fi % 16`); eating appends the skill name to "Ate: …". Tick **120 ms** (160 ms reduced). Keys: arrow keys and WASD (only while `alive`), plus a D-pad (`.dpad`). 180-degree reversal is ignored. Wall or self collision -> game over ("GAME OVER · N SKILLS" overlay), button "Retry". `unlock('snake')` on the 5th skill eaten in one run. `_cleanup` = clearInterval.
- **Paint `renderPaint`**: 24x24 pixel grid, 14 px per cell (336x336 canvas). Palette of 10 swatches (`#122030`, `#FFFFFF`, `#E8452E`, `#FF8A3D`, `#FFD15C`, `#3BB273`, `#4AA6EE`, `#8A62D6`, `#F4A7C0`, eraser). Pointer drag paints. Buttons: **Save to desktop** (`p-save`: needs at least one pixel, else toast "Draw something first!"; pushes a PNG into `ART`, adds `my-art-N.png` icon to `#icons-r`, toast "Saved", `unlock('paint')`); **Pin to wall** (`p-pin`: `Wall.submit(png)`, `unlock('paint')`, toast "Pinned!" with moderation hint); **Clear** (`p-clr`). PNGs are 24x24 px data URLs.

---

## 5. Achievements

### 5.1 Storage and UI
- `ACH` is an ordered list of 13 entries `[id, title, description, icon]` (icon = key into `ICON`).
- Unlocked set: `got = new Set(store.get('jayos-ach', []))`, persisted as an array in `localStorage['jayos-ach']` on every unlock.
- `unlock(id)`: no-op if already got; else add, save, find entry, toast "★ Achievement unlocked" + title, `Snd.ach()`, `renderAch()`.
- `renderAch()`: updates `#hud-ach` ("★ n/13"), `#ach-count` (in the "Things to try" section), the `#ach-grid` cards (3 columns, 2 at <=900px, 1 at <=600px; "★ " or "☆ " prefix; locked = dashed grey), and refreshes an open Trophies window via `fillAch`. Called once on page load (line ~1281), so a returning visitor sees their count immediately.
- `fillAch(body)`: "N of 13 unlocked. Progress stays in this browser." then the `.achl` list (locked items have class `lock`).
- Trophies window and Things-to-try grid show the same data.

### 5.2 The 13 achievements

| # | id | Title | Description (as shown) | Icon | Exact trigger | Where |
|---|---|---|---|---|---|---|
| 1 | `boot` | Power User | Boot JAY-OS | `term` | Boot sequence reaches `on` (after splash, ~2.2 s from boot start) | `boot()` ~line 685 |
| 2 | `floppy` | Floppy Handler | Slide a floppy disk into the drive | `folder` | A floppy (PROJECTS / GAMES / RESUME) is inserted into the 3D drive and the insert tween finishes; also opens the matching app | 3D scene, line 1188 |
| 3 | `term` | Hacker Voice | Run any command in the terminal | `term` | Any non-empty command passed to terminal `run()`. Includes the menubar **Help** item and the 3D sticky note, which both call `_run('help')` | `renderTerm` run(), line 929 |
| 4 | `neofetch` | Show-off | Run neofetch | `doc` | Terminal `neofetch` command | line 898 |
| 5 | `hire` | sudo make me an offer | Find the command that hires Jay | `pdf` | Terminal `sudo ...` whose args match `/hire/` (also opens Resume + confetti) | line 916 |
| 6 | `bugs` | Exterminator | Squash 10 bugs in one round of BugHunt | `bug` | BugHunt round ends with `score >= 10` | line 955 |
| 7 | `snake` | Ssssskills | Eat 5 skills in Snake | `snake` | 5th food eaten in one Snake run (`eaten.length >= 5`) | line 975 |
| 8 | `paint` | Artist in Residence | Save a drawing to the desktop or pin it to the Visitor Wall | `paint` | Successful Save to desktop, or Pin to wall (requires at least one pixel) | lines 999, 1003 |
| 9 | `tags` | Once a Marine | Find Jay's dog tags | `tag` | Any of: 3D "Dog tags" hotspot (line 1197, also swings tags and opens Service.txt); Salute button in Service.txt (line 829); terminal `salute` (line 915) | lines 829, 915, 1197 |
| 10 | `lamp` | Night Owl | Turn off the desk lamp | `trophy` | `setLamp(false)`: from the 3D desk-lamp hotspot (line 1199) or terminal `lamp` when it switches off | line 1189 |
| 11 | `konami` | Cheat Code | An old cheat code works here. Try it with arrow keys. | `trophy` | Last 10 keydown names equal `ArrowUp ArrowUp ArrowDown ArrowDown ArrowLeft ArrowRight ArrowLeft ArrowRight b a` (letters lowercased). Also enables disco mode for 6 s | global keydown, line 1041 |
| 12 | `shutdown` | Safe to Turn Off | Shut the computer down properly | `term` | Shutdown finishes (state becomes `off`). Triggered by Shut Down…, Restart, terminal `shutdown`, and power-button hotspot | `shutdown()` ~line 688 |
| 13 | `local` | Local Knowledge | Find 3 secrets hidden in the Montréal wallpaper | `display` | 3 distinct secret types found (`S.found.size >= 3`). Types: moon, sun, cross, wheel, boat, raccoon, bld (each counted once per page session) | `found()` line 583 |

Note: the Things-to-try section header in the HTML says "0/12" and the HUD says "★ 0/13" as static defaults. Both are overwritten by `renderAch()` at load. Use `ACH.length` in the port.

---

## 6. Wallpaper (desktop background) interaction with the OS

- Modes: `night` (Montréal by night), `golden` (Golden hour), `day` (Snow day), plus `auto`.
- `auto` = Toronto (Montréal) hour: `07:00–16:59` -> day, `17:00–19:59` -> golden, else night. Re-evaluated every **60 s** (`setInterval`).
- Caption `#wp-cap` updates each time (e.g. "mont-royal · 11:48 pm").
- The wallpaper canvas draws only while `OS.state === 'on'` and the section is in view.
- Clickable hotspots on the canvas (7 types): moon (bagel toggle), sun (shades toggle), cross (cycles 5 colours), wheel (spins), boat (speeds up with a horn), raccoon (runs off then returns), buildings (toggle lights). Each click plays a 660 Hz blip, and the first time each type is found shows a toast "Secret N · <name>". Finding 3 unlocks `local`.

---

## 7. Persistence

| Key / store | What | Written by | Read at |
|---|---|---|---|
| `localStorage['jayos-ach']` | JSON array of unlocked achievement ids | `unlock()` | script load (`got`) |
| `localStorage['jayos-wp']` | `"auto"` or `"night"`, `"golden"`, `"day"` | Display app card click; terminal `wallpaper <x>` | script load (`wpChoice`) |

Everything is wrapped in `store.get/set` (try/catch, JSON). Private-mode / blocked storage falls back to defaults silently.

**Not persisted (resets on reload):**
- Sound on/off (always off at load; the browser also needs a user gesture to create the AudioContext).
- Open windows, positions, focus, z-order, cascade counter.
- Desktop state: OS always starts at `standby` on load, boots only through the user's action (or scroll/lid).
- Visitor Wall: queue, approved wall items, the visitor's own pending drawing (the wall is in memory; the 3 examples are re-created each load).
- Saved paint drawings (`ART` array; desktop `my-art-N` icons are lost on reload).
- BugHunt scores, Snake runs, terminal history, Skills.inv selection, Service.txt salute text.
- Secret-found set for `local` (per page session, so `local` can be re-earned only by finding 3 secrets in the current session; the `got` check still prevents a duplicate unlock).

**Requirement conflict to resolve:** the user decided "start fresh each visit", but the achievements are in `localStorage['jayos-ach']` and the Trophies copy says "Progress stays in this browser." Either:
- (a) keep it (decide intentionally), then the "start fresh" wording in any copy must change; or
- (b) drop the `jayos-ach` read/write and keep achievements per page session.
The wallpaper choice is also persisted. Decide whether that counts as "fresh".

---

## 8. Testable behaviours (GIVEN / WHEN / THEN)

Boot and state
- GIVEN the page is loaded and the OS is `standby` / WHEN the user scrolls past 10% of the 3D track (or clicks the glass) / THEN the boot log starts typing, one line every 150 ms.
- GIVEN boot is running / WHEN a user clicks an app icon / THEN the app is queued and opens automatically once state becomes `on`.
- GIVEN boot has completed / THEN `boot` achievement is unlocked and the chime plays once.
- GIVEN state `on` / WHEN Shut Down… is chosen / THEN all windows close, the desktop collapses over 0.6 s, state becomes `off` and `shutdown` achievement unlocks.
- GIVEN state `off` / WHEN the power hotspot or the glass is clicked / THEN boot starts.
- GIVEN state `on` / WHEN Restart is chosen / THEN the shutdown animation runs, then the boot log runs again.

Windows
- GIVEN an app is already open / WHEN its icon is clicked again / THEN the existing window is focused and shakes; no second window appears.
- GIVEN two windows / WHEN the user clicks the back one / THEN it comes to the front and its header turns colour, the other turns grey.
- GIVEN a window header / WHEN dragged far off-screen / THEN it stops with at least 90 px horizontally visible and never above y=34.
- GIVEN the window header is dragged while the OS is scaled (3D zoom or flat fit) / THEN the window follows the pointer 1:1.
- GIVEN the desktop shrinks (e.g. resize) / THEN windows are clamped so they stay on the desktop.
- GIVEN the viewport is under 760 px wide and the user has zoomed in / THEN the OS is flat, windows fill the screen (6 px margins), drag is disabled, and the SEL clock and wallpaper caption are hidden.

Menu and HUD
- GIVEN the menu is open / WHEN the user clicks anywhere on the OS outside the menu / THEN it closes.
- GIVEN the sound toggle / WHEN turned on in the HUD / THEN the menubar button also reads "Sound: on" and vice versa.
- GIVEN sound is off / WHEN any UI sound would play / THEN nothing plays.
- GIVEN the clock / WHEN 15 s pass / THEN MTL and SEL text refresh.
- GIVEN the menubar clock / WHEN clicked / THEN a "Two time zones" toast appears.
- GIVEN the Help menubar item / WHEN clicked / THEN the Terminal opens, prints help, and Hacker Voice unlocks.

Apps
- GIVEN Projects / WHEN a card is clicked / THEN that project's detail window opens (one per project) with its links, tags, and blurb.
- GIVEN Experience.log / THEN the first role is open by default; clicking another expands it.
- GIVEN Skills.inv / WHEN a slot is clicked / THEN the detail panel shows the category, the "Used in" list, and falls back to the default line when none.
- GIVEN Mail / WHEN the form is submitted / THEN it is reset and the toast says nothing was sent (prototype).
- GIVEN Service.txt / WHEN Salute is pressed / THEN the Pilseung text appears and Once a Marine unlocks.
- GIVEN the Desktop Background / WHEN a mode is chosen / THEN the wallpaper changes immediately and the choice survives a reload.
- GIVEN the Visitor Wall as visitor / WHEN a drawing is pinned in Paint / THEN it appears in the moderator queue and not on the wall until approved.
- GIVEN the Visitor Wall as moderator / WHEN a pending drawing is approved / THEN it appears at the top of the wall grid.
- GIVEN Recycle Bin / WHEN the card is clicked / THEN the RecycleWise project window opens.

Achievements
- GIVEN an achievement is already unlocked / WHEN its trigger happens again / THEN no toast and no sound.
- GIVEN 10 BugHunt squashes in one round / THEN Exterminator unlocks; with 9 it does not.
- GIVEN 4 skills eaten in Snake / THEN Ssssskills has not unlocked; on the 5th it does.
- GIVEN the Konami sequence / THEN Cheat Code unlocks and disco plays for 6 s.
- GIVEN Trophies is open / WHEN a new achievement unlocks / THEN the list updates in place.
- GIVEN a returning browser with stored achievements / THEN the HUD shows the stored count on load.

---

## 9. Risks and gotchas for the React port

- **G1 Shared mutable state.** Achievements, the wallpaper choice, the Visitor Wall, the sound flag, and the 3D lamp are read by OS apps, the terminal, the 3D scene and the HUD. Use one store (context + reducer or zustand) with actions `unlock`, `setSound`, `setWallpaper`, `wall.*`, and avoid passing these through props down deep trees.
- **G2 Open-window registry.** The prototype keys windows by id and prevents duplicates; `project:N` and `art:N` ids are dynamic. Keep a `Record<id, WinState>` with `{id, title, color, x, y, w, h, z, focused}` and a single `openApp` that handles the queue during boot.
- **G3 CSS3D scale.** Drag and any pointer maths must divide by the scale (`rect.width / offsetWidth`). Reproduce exactly, or windows will drift when the 3D desktop is zoomed or flat-fit.
- **G4 `compact` is tied to narrow width only.** In the prototype `compact` is set even if the OS is not flat (`setFlat(v, narrow)`), so narrow screens get compact CSS while still in 3D. Decide intentionally; the cleaner rule is "compact iff flat AND narrow".
- **G5 Imperative DOM elsewhere.** `renderAch` and the Trophies/Visitor Wall windows re-render by writing innerHTML. In React, use subscriptions and let the window component re-render; do not hand off DOM nodes.
- **G6 Timers and rAF.** Boot ticks, shutdown timeouts, `setInterval(clock, 15000)`, the wallpaper `setInterval(60000)`, BugHunt/Snake loops, matrix and confetti rAF, the disco class timer. All must be cleared on unmount (Snake and BugHunt have `_cleanup`). The prototype's `shutdown` and `boot` timeouts are not cancelled, so a second action started during them can overlap; guard with a state check in the port.
- **G7 Pixel assets.** `ICON` bitmaps are generated at runtime from 12x12 char grids (`BMP`/`PAL`), shown at 52/44/34/30 px with `image-rendering: pixelated`. Port as static PNG/SVG at 12x12 or keep the generator in a utility; the `Wall` example thumbnails use the same grids.
- **G8 Portrait dither** (`JAY_PX`) is a runtime canvas; precompute as an asset for SSR-safe rendering.
- **G9 `#hud-ach` / "0/12" and "0/13" literals** in the HTML are stale; derive counts from `ACH.length`.
- **G10 Help runs the terminal's run()** and therefore unlocks Hacker Voice. The sticky note in 3D does the same. Keep this if desired; it is easy to forget.
- **G11 Restart unlocks "Safe to Turn Off"** (it goes through `shutdown`). Probably fine; confirm.
- **G12 Mail and Visitor Wall moderation are prototype-only.** Real site needs a backend for mail delivery; the moderation toggle ("Jay (moderator)") is visible to everyone and must be gated or removed.
- **G13 Storage access** must be try/catch wrapped (the prototype does this). Reads happen at module load, so in React put them in the initial state factory, not at import time, to stay SSR-safe.
- **G14 `prefers-reduced-motion`** shortens boot timers (30 ms per line, 150 ms splash) and disables disco and wallpaper motion. Keep a `REDUCE` check.
- **G15 Pointer events.** Desktop clicks go through `.glass` to zoom in; the OS uses pointerdown for focus, and the menu closes on any pointerdown outside. In React, set `pointer-events` the same way, or the glass will swallow clicks.
- **G16 Keyboard.** Global `keydown` handles Konami, 3D key clicks and Escape to zoom out. Terminal and Snake listen on their own elements. Make sure the Konami listener does not fire while typing in the terminal input (the prototype does not guard this; it also records letters typed in the terminal).
- **G17 Snake focus.** `cv.focus()` is called on start; confirm the canvas is focusable (tabindex) in the port, or key input silently fails.
- **G18 Clock timezone.** The prototype uses the IANA name `America/Toronto` (Montréal shares its tzdata zone). Keep the same string or use `America/Montreal`; both are valid.
- **G19 Window cascade counter** is global (module-level); in React keep it in the window store, otherwise multiple OS instances would share it.
- **G20 Shake and open animations** rely on class toggling plus `void w.offsetWidth` to restart CSS animations. In React, change a `key` or toggle a class via state with a timeout.
