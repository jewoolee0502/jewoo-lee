# Porting spec: interactive toys (revamp-lab prototype)

Source: `design/revamp-lab.html` (read-only). Line refs are to that file.

| Area | Lines |
|---|---|
| Living pixel Montréal wallpaper (`Wallpaper` IIFE, `autoWp`, `applyWallpaper`) | 480–613 |
| Achievements/unlock list | ~657–662 |
| Global keyboard + Konami | 1038–1041 |
| Visitor Wall mock (`Wall`) | 766–782 |
| Visitor Wall app (`APPS.wall`) | 839–861 |
| Terminal (`NEOFETCH`, `renderTerm`) | 876–930 |
| BugHunt | ~938–970 |
| Snake | ~972–1000 |
| Paint | ~1002–1006 |
| 3D corkboard consumer (`setWall`) | 1097–1113, 1200, 1269 |
| Wallpaper pref boot + 60s refresh | 1277–1278 |

Note on the prototype: `Wall` and `Snd`, `store`, `unlock`, `toast` are module globals. Anything not stated is a verbatim copy from the source.

---

## 1. Modules

### 1.1 Living Montréal wallpaper (lines 480–612)

**Purpose.** A 240-wide (dynamic, see sizing) pixel-art city, drawn to a `<canvas>` and used both as the desktop background and as the texture on the 3D laptop screen (line 1224: `drawImage(Wallpaper.canvas, …)` while OS is on). Clicking "hot" sprites triggers small animations and secrets.

**Constants**

- `H = 180` (canvas height in logical px, always).
- Default `W = 240` (`let W=240`). Sizing formula in `sync()` (see §1.1.5).
- `W` clamp: `Math.max(160, Math.min(420, Math.round(H * osW / osH)))`, with fallback `osW=900`, `osH=675` when clientWidth/Height are 0. Default gives exactly 240.
- Seed for city layout: `seed = 11`, Park–Miller LCG: `rnd = (seed*16807) % 2147483647 / 2147483647`.
- Idle FPS throttle: `now - lastDraw < 70` → skip (about 14 fps idle). Bypassed when `dirty` is truthy.
- Max `dt` clamp: `0.2 s`.
- Flicker period: `flick = 0.5 s`.
- Cloud speed: `v = 1.2 + rnd*1.8` px/s.
- Stars: 55, positions via `rnd`, twinkle `Math.floor(T*1.5 + s.p) % 9 != 0` draws the star.
- Flakes: 60, `v = 6 + rnd*9` (px/s times `mode.snow`), sway `sin(T+d)*0.12`.
- Sparks: 4 per frame (`dt>0`), `Math.random()` positions in y 146–178. Not seeded.
- Golden shimmer: columns at `W*0.52-6` (y from 146, step 3), `Math.random()` (not seeded).
- Wheel: centre `x = max(40, round(W*0.25))`, `y = 112`, `r = 22`. Spin: `wheelV` starts at `0.35` rad/s, `wheelA += wheelV*dt`, decay `wheelV += (0.35 - wheelV) * min(1, dt*0.6)`.
- Boat: `boatX` starts at 30, `boatV` starts at 5 px/s, decay `boatV += (5 - boatV) * min(1, dt*0.4)`, `boatX += boatV*dt`, wraps to `-18` when `boatX > W+16`. Drawn when `boatX > -14`. Smoke puff at `(boatX-5, 155)`.
- Cars: 6 cars, `x` random in `[bridge.x0, W]`, `v = ±(9 + rnd*7)`, colour index `i%3`. Wrap across bridge.
- Raccoon: `rc.x = 40` (init), `dir = 1`, walk speed 5 px/s, run speed 42 px/s, `run` flag, `away` timer. Turns at `x > bridge.x0-14` and `x < 2`. Frame index `floor(T*(run?12:4)) % 2`. Sprite y = 135. If run and `x < -14` or `x > W+4`, `away = 14` s; while `away > 0` nothing is drawn or hot. On return `x = -10`, `dir = 1`, `run = false`.
- Window flicker (night only): every 0.5 s, one random window of one random building toggles `w.v = 1 - w.v`.
- Building beacon: red blink `(T*2|0) % 2`, colour `#ff4a4a` / `#7a1a1a`, on buildings with a `kind`.
- Clouds (non-night only): `c.x += v*dt`, wrap at `W+20`.

**Modes** (`MODES`, exact values):

| Key | name | cap (caption text, static) | sky (3 stops, rows 0..61%, 62..100%) | hill | tree | far | bld | edge | win | dark | water (top,bottom) | quay | bridge | rim | gond | spark | snow | lit |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| night | Montréal by night | `mont-royal · 11:48 pm` | `[11,16,48]`, `[38,48,106]`, `[78,60,124]` | `#1b2142` | `#141a36` | `#262d58` | `#10152c` | `#1f2850` | `#ffd98a` | `#0a0e20` | `[24,30,66]`, `[8,10,26]` | `#2a2f4a` | `#2f5a50` | `#ff7ac0` | `#ffd98a` | `#ffd98a` | 1 | .42 |
| golden | Golden hour | `vieux-port · 7:12 pm` | `[62,42,112]`, `[217,87,122]`, `[255,184,96]` | `#4a2a5c` | `#3a1f4a` | `#6c3c6c` | `#3a1f4a` | `#5a3360` | `#ffcf7a` | `#2a1638` | `[200,84,112]`, `[58,36,86]` | `#2a1638` | `#2d4a40` | `#ffd6a0` | `#ffcf7a` | `#ffe2a0` | .35 | .22 |
| day | Snow day | `parc olympique · 2:05 pm` | `[63,134,224]`, `[140,196,255]`, `[223,240,255]` | `#e8f0fa` | `#4f7a62` | `#c3d1e4` | `#7f92ab` | `#a9b9cd` | `#d9eeff` | `#5d6f88` | `[96,148,206]`, `[52,98,150]` | `#e2eaf4` | `#3f7a5a` | `#5d6f88` | `#e8452e` | `#ffffff` | .55 | .3 |

Sky gradient: rows `j = 0..140`, `t = j/141`; first 62% lerps stop0→stop1 over `t/.62`, rest lerps stop1→stop2 over `(t-.62)/.38`.

Other constants: `CROSS = ['#ffffff','#b07cff','#ff5a6a','#5fe08a','#6ab8ff']`. Cross colour in day mode is `#f2f5fb` while `S.cross===0`. Night cross has a halo `rgba(210,228,255,.35)`. Sun disc (golden only): `disc(round(W*.52), 126, 13, '#ffe08a')` then r9 `#fff2c0`. Golden mode draws a setting sun disc in place of a moon. Night moon and day sun sit at `mx=round(W*.74), my=24`.

**Sprites** (exact):

```
RAC = [
 ["........GG","......GGGG","KGKGGGGKWK",".GGGGGGGGG","..G.G..G.G"],
 ["........GG","......GGGG","KGKGGGGKWK",".GGGGGGGGG","...GG...GG"]]
RPAL = {G:'#8d939c', K:'#2a2a30', W:'#ffffff'}
BOAT = ["......WW......","....WWWWWW....","..RRRRRRRRRR..","KKKKKKKKKKKKKK",".KKKKKKKKKKKK."]
BOAT palette: W = night '#ffd98a' else '#f4f6fa'; R '#e8452e'; K '#26304a'
```

Raccoon is drawn flipped when `dir < 0`. Sprite cell = 1 logical px. `.` is transparent.

**Static layer** (`build()` then `drawStatic()`, cached in `stat` canvas):

- Hill: `hill[i] = round(140 - 60*exp(-((u-.3)/.19)^2) - 12*exp(-((u-.56)/.14)^2))`, `u = i/W`. Peak `peakX = round(W*.3)`, `peakY = hill[peakX]`.
- Trees: `for i < W*.62, step 2 + (rnd*3|0)`, height `2 + (rnd*3|0)`.
- Buildings: start `bx = round(W*.36)`, end `round(W*.7)`. Each: `w = 6 + (rnd*7|0)`, `h = 24 + (rnd*26|0) + round(sin(u*π)*24)`, gap 1. Then three picks: `pick(.5)` becomes `kind:'pvm'` (h 78, w 10), `pick(.75)` `'pyr'` (h 70), `pick(.25)` `'step'` (h 66). Windows: rows every 4 px from `top+3` to 136, cols every 3 px, each with `v = rnd`. Window lit if `v < mode.lit`.
- Wheel, clock (`x = round(max(4, W*.035))`), bridge (`x0 = round(W*.72)`, towers `t1 = round(W*.78)`, `t2 = round(W*.94)`), Olympic stadium ring at `oly = round(W*.86)`.
- Sea/water rows 143..179 lerp water[0]→water[1]. Day mode adds ice streaks `#c4d2e4` at y 142.
- Important: `build()` reseeds, so the layout depends on `W`. A viewport aspect change re-rolls the whole city (trees and buildings consume RNG differently). Accept this or seed per layout.

**Hot regions** (`S.hot`, rebuilt every `draw()`; hit test iterates in reverse so the last-pushed wins):

| k | rect (x, y, w, h) | active in |
|---|---|---|
| moon | (mx-8, my-8, 17, 17) | night |
| sun | (mx-9, my-9, 19, 19) | day |
| cross | (px-6, py-3, 13, 17), px=peakX, py=peakY-13 | all |
| bld | (b.x-1, b.top-2, b.w+2, 140-b.top), index i | night, golden (not day) |
| wheel | (WH.x-r-2, WH.y-r-2, 2r+4, 2r+4) | all |
| boat | (boatX-2, 147, 18, 10) | all |
| raccoon | (rc.x-3, 131, 16, 11) only when not running | all |

Pointer: `cv.style.cursor = 'pointer'` when hot, else `default`. Click: `at(e)` maps client coords to logical coords via `getBoundingClientRect`, then `act(hit)`.

**Draw order in `draw(dt, target)`**: static → stars (night) → moon/sun → clouds → cross → flicker → building windows and beacons → wheel → cars → boat (and splash) → sparks → golden shimmer → raccoon → flakes. Then `S.hot = hot`.

**Interaction (`act(h)`)** always calls `Snd.tone(660, .05, 'square', .04)` (silent unless sound is on), then:

| k | effect |
|---|---|
| moon | `S.bagel = !S.bagel` (moon becomes a bagel with 5 sesame dots) |
| sun | `S.shades = !S.shades` (sunglasses) |
| cross | `S.cross = (S.cross+1) % 5` |
| wheel | `S.wheelV = 4` (spins up, then decays) |
| boat | `S.boatV = 26`, plus `Snd.tone(150, .35, 'sawtooth', .05)` |
| raccoon | `rc.run = true`, `rc.dir = rc.x > W*.3 ? 1 : -1` |
| bld | `S.off[i] = !S.off[i]` (toggles that building's lit windows) |

Then `found(k)` and `dirty = true`.

**Secrets** (`SECRETS`, exact text; the curly quotes are part of the content):

| key | title | text |
|---|---|---|
| moon | That’s a bagel now | Sesame, Montréal-style. St-Viateur or Fairmount? Choose wisely. |
| sun | Deal with it | Even the sun needs shades on a snow day. |
| cross | The Mont-Royal cross | The real one changes colour for special occasions too. |
| wheel | Wheee | La Grande Roue, on turbo. |
| boat | Toot toot | The ferry to Parc Jean-Drapeau, running late as usual. |
| raccoon | Raccoon spotted | Mont-Royal’s raccoons are basically locals. |
| bld | Lights out | Someone in there was pulling an all-nighter. Now they’re asleep. |

`found(k)`: first time per key only. Adds to `S.found` (in memory). Toast `'Secret ' + S.found.size + ' · ' + title`, body text, kind `info`. When `S.found.size >= 3`, `unlock('local')`. 7 secrets total, but moon and sun exist in only one mode each, so 7 is reachable only across modes. Found state is not persisted (only the achievement is).

**Mode switching.** `setMode(k)`: unknown k falls back to `'night'`. If `k !== mode` or no static cache: `mode = k`, `dirty = 'mode'`, `sync()`, `draw(0)`, `dirty = false`.

**`snapshot(k)`** (used by Settings → Desktop Background cards): saves `{mode, W, L, stat, hot, rac}`, sets `W = 240`, builds, draws into a temp canvas with `draw(0, ctx)`, restores all, returns `toDataURL('image/png')`. Note: `build()` on the snapshot path replaces `L` and mutates `S.rac` (restored via copy). Keep the snapshot path side-effect-free in the port (use a local layout object).

**Lifecycle.** `loop(now)` is a self-scheduling rAF that never stops. Each frame it returns early if any of: `!inView`, `document.hidden`, `OS.state !== 'on'` (boot/off), `Ctrl.tw && !dirty` (camera tween in progress), `REDUCE && !dirty`, or `now-lastDraw < 70 && !dirty`. Otherwise `sync()`, `T += dt`, `draw(dt)`, `dirty = false`. `REDUCE` (prefers-reduced-motion) sets dt 0, so it draws once per change and never animates. Listeners that are never removed: IntersectionObserver on `#stage`, canvas `click` and `pointermove`, `setInterval(60000)` that calls `applyWallpaper()` in auto mode.

**`sync()`** rebuilds the static layer (and `build()`) only when computed `W` changes or `dirty === 'mode'`. It sets `cv.width = W; cv.height = H` (this clears the canvas). The canvas CSS size is handled by layout (`image-rendering: pixelated`).

### 1.2 Auto time-of-day and wallpaper preference (lines 607–612)

- `autoWp()` (pure in intent, impure in code): `hour` from `America/Toronto` via `toLocaleString('en-GB', {timeZone, hour:'2-digit', hour12:false})`, parsed then `% 24`. On exception `h = 12`, which yields `'day'`.
  - `h >= 7 && h < 17` → `'day'`
  - `h >= 17 && h < 20` → `'golden'`
  - otherwise → `'night'`
- `wpChoice = store.get('jayos-wp', 'auto')`. If not `'auto'` and not a key of `WP`, reset to `'auto'`.
- `currentWp()` = `wpChoice === 'auto' ? autoWp() : wpChoice`.
- `applyWallpaper()`: `Wallpaper.setMode(k)`, set `#wp-cap` text to `WP[k].cap`, then `Scene.onOS(OS.state)` if Scene.
- `setInterval(60000)`: re-applies in auto mode only.
- Writes: terminal `wallpaper` and the Settings cards write `store.set('jayos-wp', k)`.
- Caption `cap` is a static string per mode, not the real clock time. Keep that in mind when porting (the real time is not shown).

### 1.3 Visitor Wall mock (lines 766–782, app at 839–861)

**Module `Wall`** (in-memory, this tab only):

- `EX`: 3 example drawings (12×12 grid strings, white background, red/blue/yellow). Turned into PNG data URLs at load via `mkPng` (12×12 canvas, fills `#fff` then paints cells with `PAL[ch]`). Objects: `{id:'ex0'|'ex1'|'ex2', png, example:true}`. These are shown on the wall at start, so the wall is not empty on first visit. Note: `PAL` is referenced here and must exist (defined earlier; not checked here).
- `items`: approved drawings, newest first (`approve` unshifts).
- `queue`: pending drawings. At most one entry with `id:'mine'` (the current visitor's pending drawing).
- `view`: `'visitor'` (default) or `'jay'`.
- `listeners`: Set of re-render functions (the app `draw`).
- `emit()`: call each listener in try/catch, then `Scene.setWall(items.map(d => d.png))` if Scene is present.

Methods:

| Method | Behaviour |
|---|---|
| `submit(png)` | Remove existing `id:'mine'` from queue (so the visitor holds one pending slot), `unshift({id:'mine', png, ts: Date.now()})`, emit. Does not touch approved items. |
| `approve(it)` | Remove `it` from queue (by reference), `items.unshift({id:'w'+Date.now(), png})`, emit. Approved item drops `ts` and `id`. Approved items are not linked to the visitor, so the visitor can submit again later. |
| `reject(it)` | Remove from queue, emit. No record kept. |
| `remove(it)` | Remove from `items` (Take down), emit. |
| `setView(v)` | `view = v`, emit. |

**App UI (`APPS.wall`, 660×540, colour `#C8955E`):**

- Top bar: label "UI preview · drawings stay in this tab"; segmented control `Visitor` | `Jay (moderator)`. This is a UI toggle only. There is no auth.
- Visitor view:
  - Copy: "Drawings from people who stopped by. Draw one in Paint and press "Pin to wall"."
  - If `queue` has `id:'mine'`: notice with its PNG and "Your drawing is waiting for Jay to approve it. Switch to "Jay (moderator)" above to see the other side."
  - Shows the approved grid, then "Open Paint" button (`OS.openApp('paint')`).
- Moderator view:
  - Copy: "Nothing goes public until you approve it. Each visitor holds one spot in the queue."
  - Heading "Waiting for approval (N)". Each queue row: 64×64 image, text `(id==='mine' ? 'From you · ' : '') + 'sent ' + time`, buttons `Approve` (`Wall.approve` + toast "Visitor Wall / Approved. It’s on the wall and the corkboard now.") and `Reject` (`Wall.reject`, silent).
  - Empty queue text: "The queue is empty. Pin a drawing from Paint to see it land here."
  - Heading "On the wall (N)". Each approved card has a `Take down` button (`Wall.remove`).
- Grid: `pcard` items; `example` items get an "example" label. Empty: "Nothing on the wall right now."
- Subscription: `Wall.listeners.add(draw)` on render; `win._cleanup` removes it. Each emit re-renders the whole app.

**Corkboard consumer (3D scene, lines 1097–1113):**

- `setWall(pngs)` takes the first 6, loads each as `Image` (onerror → null), filters nulls, and redraws the cork texture.
- Cork texture (512×350, `#C8955E` background, speckles). Title "VISITOR WALL" at (258, 34). Six 76px white-backed slots at `[252,52] [340,52] [428,52] [252,160] [340,160] [428,160]` with random tilt, image drawn 66px. Pins coloured `#E8452E`, `#4AA6EE`, `#FFD15C` by index. Footer: `N pinned by visitors` or `your drawing here?`.
- Corkboard addHot (line 1200): click zooms camera in and opens the Visitor Wall app.
- Bootstrap: `Wall.emit()` at line 1277 so the corkboard shows the 3 examples immediately.

**Flow:** Paint "Pin to wall" → `Wall.submit(png())` → queue. Moderator approves → `items` → corkboard + app. The visitor sees no notification of approval in the mock.

---

## 2. Terminal (lines 876–930)

**Output classes** used by `say(text, cls)`: `'d'` dim, `'c'` cyan/accent, `'b'` blue (success info), `'w'` warning/error, none for default. `pre(text)` for multi-line NEOFETCH.

**Boot line:** `jaysh 0.2 · type "help" to see what this computer can do.` (class `d`).

**Element:** `.term` with `.t-out` (scrolling output) and `label.t-line` containing `.t-ps` "jay@jay-os:~$" and input `.t-in` (spellcheck off, autocomplete off, autocapitalize off, aria-label "Terminal command"). Focus on click and on a 60 ms timeout after render.

**Input handling (`keydown` on input):**

- `Enter`: `run(input.value)`, clear input.
- `ArrowUp`: if `hi > 0`, `hi--`, value = `hist[hi]`. Always preventDefault.
- `ArrowDown`: if `hi < hist.length-1`, `hi++`, value = `hist[hi]`; else `hi = hist.length`, value `''`. Always preventDefault.
- `Tab`: candidates = `Object.keys(C)` starting with `input.value.toLowerCase()`. If exactly one, value = name + space. If several, print them joined by two spaces (class `d`). Note: includes aliases and `hi`, `hello`, `안녕`.

**`run(raw)`:**

1. `line = raw.trim()`. Echo `'jay@jay-os:~$ ' + line` (class `c`).
2. If empty, stop (no history, no achievement).
3. `hist.push(line)`, `hi = hist.length`.
4. Split on `/\s+/`. `cmd = parts[0].toLowerCase()`. Args = `parts.slice(1).join(' ')` (whitespace collapsed).
5. `unlock('term')` (achievement "Hacker Voice": any non-empty command).
6. If `C[cmd]` exists, call it with args. Else:
   - Find the closest key in `Object.keys(C)` by Levenshtein distance to `cmd`.
   - If distance ≤ 2: `jaysh: command not found: <c0>. Did you mean "<best>"?` (class `w`).
   - Else: `jaysh: command not found: <c0>. Try "help".` (class `w`).

**`NAMES` map (used by `open`):**

`about→about, projects→projects, experience→exp, exp→exp, skills→skills, terminal→term, resume→resume, cv→resume, mail→mail, contact→mail, bughunt→bugs, bugs→bugs, snake→snake, paint→paint, service→service, wallpaper→display, display→display, wall→wall, visitorwall→wall, trophies→ach, achievements→ach, bin→bin, recyclebin→bin`.

Note: `about` is in NAMES (so `open about` works) but there is no `about` command in `C`, so typing `about` alone gives "command not found".

**Command table**

Output text is verbatim. Effects are in brackets.

| Command (aliases) | Args | Output (class) | Effect |
|---|---|---|---|
| `help` | none | 15 lines, default class: `whoami        who is Jay` · `neofetch      system info, but make it a flex` · `ls            list the desktop` · `projects      list projects   (open p1 … p8)` · `open <thing>  open an app or project` · `skills        what Jay works with` · `experience    the career log` · `contact       ways to reach Jay` · `snake · bugs · paint     play` · `matrix · weather · lamp  mess with the room` · `wallpaper     pick a Montréal desktop scene` · `salute        Marine Corps salute` · `sudo hire-jay ...you know you want to` · `clear · history · exit · shutdown` | none. Note `p1 … p8` is hard-coded text. |
| `whoami` | | `Jewoo (Jay) Lee: full-stack developer, McGill Computer Engineering, former ROKMC Sergeant. Builds with Vue/Nuxt, React, GraphQL and Firebase.` | none |
| `neofetch` | | `pre(NEOFETCH)` (see constant, String.raw, keep backslashes): OS JAY-OS 2.0 (Montréal ed.), Host McGill University, Major Computer Engineering, Stack Vue/Nuxt · React · GraphQL, DB Firebase · PostgreSQL, Shell jaysh 0.2, Languages Korean, English, Service ROKMC Sergeant '22-'24, Status open to work ● | `unlock('neofetch')` (Show-off) |
| `ls` | | `About.txt  Projects/  Experience.log  Skills.inv  Terminal  Resume.pdf  Mail  BugHunt.exe  Snake.exe  Paint  Wallpaper  Visitor Wall  Service.txt  Trophies  Recycle Bin` (class `b`) | none |
| `projects` | | one line per project, class `b`: `'  p'+(i+1)+'  '+title`. Current titles: p1 RecycleWise, p2 WhenAreYouFree, p3 Duonosaur, p4 MenuLens, p5 Martlet Nest, p6 adStar, p7 HTTP · Health and Toning Targeted Program, p8 Library Management System | none |
| `open <a>` (alias `cat`) | see below | `opening <title> …` (`b`) or `opening <name> …` (`b`) or error | opens app |
| `skills` | | SKILLS names joined by ` · `: Python · Java · JavaScript · TypeScript · CSS · Vue.js · Nuxt · React · Spring Boot · Tailwind · Firebase · PostgreSQL · MongoDB · NumPy · Git · Figma | none |
| `experience` (alias `exp` not in C) | | 7 lines `'  '+d.slice(0,7)+'  '+co`: `2025-08  Wholesale Express`, `2025-05  Wholesale Express`, `2025-03  Container Foam`, `2024-04  CI Guarantee`, `2022-09  Republic of Korea Marine Corps`, `2021-06  Hansan Global (Cairo)`, `2019-06  KOTRA` | none |
| `contact` | | `github.com/jewoolee0502 · linkedin.com/in/jewoo-lee · instagram @jwuu_lee` (default) | opens `mail` app |
| `snake` | | `good luck. it eats skills.` (`b`) | opens `snake` |
| `bugs` | | `grab a newspaper.` (`b`) | opens `bugs` |
| `paint` | | none | opens `paint` |
| `matrix` | | `wake up, recruiter…` (`d`) | `OS.matrix()` (4.5 s green rain overlay) |
| `weather` | | `Montréal: snowing. Look out the window.` (`b`) | `Scene.snow(10)` if 3D scene |
| `lamp` | | `lamp: on` / `lamp: off` (`b`), or `no lamp in flat mode.` (`w`) | `Scene.lamp()` toggles. Turning lamp off unlocks `lamp` (Night Owl). |
| `wallpaper [auto\|night\|golden\|day]` | arg lowercased | valid: `wallpaper: auto (<WP[currentWp()].name>)` if auto, else `wallpaper: <WP[a].name>` (`b`). Invalid or empty: `usage: wallpaper auto \| night \| golden \| day` (`d`) and opens `display` app | sets `wpChoice`, `store.set('jayos-wp', a)`, `applyWallpaper()` |
| `salute` | | `필승! (Pilseung: "certain victory", the ROK Marine Corps salute)` (`c`) | `unlock('tags')` (Once a Marine) |
| `sudo [args]` | | If args match `/hire/`: `[sudo] password for recruiter: ********` (`d`), `Access granted. Excellent decision. 🎉` (`c`). Else `Nice try.` (`w`). | Hire path: `OS.confetti()`, opens `resume`, `unlock('hire')` |
| `coffee` (not in help) | | `brewing… ☕ done. Productivity +10%. (The boot log said coffee was LOW.)` (`c`) | none |
| `date` (not in help) | | `Montréal  <weekday> <HH:MM>` and `Seoul     <weekday> <HH:MM>` (`en-GB` locale, `America/Toronto` and `Asia/Seoul`). Any error prints `?`. | none |
| `pwd` | | `/home/jay` | none |
| `cd [args]` | | `there's nowhere to go. you're already home.` | none |
| `echo [args]` | | args (whitespace-collapsed) or empty line | none |
| `hello` / `hi` / `안녕` | | `안녕하세요! Hello! Bonjour!` (`c`) | none |
| `git` | | `On branch feat/website-revamp. 8 projects, 0 regrets.` | none (hard-coded) |
| `vim` | | `you would never find your way out. try "open about".` (`w`) | none |
| `rm` | | `permission denied: this portfolio is load-bearing.` (`w`) | none |
| `cheat` | | `↑ ↑ ↓ ↓ ← → ← → B A` (`d`) | none (Konami hint) |
| `history` | | one line per entry `'  '+(i+1)+'  '+cmd` (`d`), includes `history` itself | none |
| `clear` | | output cleared (the echo of `clear` is cleared too) | history kept |
| `exit` | | `logging out … stepping back from the desk.` (`d`) | after 400 ms `Ctrl.zoomOut()` |
| `shutdown` | | `shutting down …` (`d`) | after 500 ms `OS.shutdown(() => Ctrl.zoomOut())`. OS.shutdown unlocks `shutdown` (Safe to Turn Off) after about 600 ms. |
| anything else | | `jaysh: command not found: X. ...` (`w`) | none |

**`open` parsing** (`a` = args):

1. `a = a.toLowerCase().replace(/\.(txt|log|inv|exe|pdf)$/, '').replace(/\s+/g, '')`.
2. If `/^p?(\d)$/` matches a single digit and `PROJECTS[n-1]` exists: `openApp('p:' + (n-1))`, `opening <title> …` (`b`).
3. Else if `NAMES[a]`: `openApp(NAMES[a])`, `opening <a> …` (`b`). Note it prints the normalized name.
4. Else if `a` is non-empty and some project title with whitespace removed (lowercased) starts with `a`: `openApp('p:' + idx)`.
5. Else: `open: no such thing: <a or (nothing)>. Try "ls".` (`w`).

Caveat: `p10`+ does not work (single digit only). `p0` falls through to the error.

**Other terminal pieces**

- `win._run = run` is exposed on the window (for outside callers).
- `renderTerm` is a plain function. Its `hist` and `hi` are local to each window instance, so history is lost when the window closes.
- The Konami keydown listener (§4) is global and also fires for keys typed in the terminal.

---

## 3. BugHunt (lines ~938–970)

**UI:** intro text "Bugs are loose on the desktop. Squash as many as you can in **20 seconds**.", `SCORE` (`.bh-s`), `TIME` (`.bh-t`, starts `20`), button `Start hunt` (`.bh-go`).

**Constants and state:** `left` (seconds, starts 20), `score`, `spawnT`, `last`, `raf`, `bugs[]`, `layer` (div `.bug-layer` appended to `#l-desk`).

**Start:** `stop()`, create layer, `score = 0`, `left = 20`, `spawnT = 0`, score text `'0'`, button disabled `Hunting…`, `last = performance.now()`, start rAF.

**Spawn (`spawn()`):**

- Button `.bugx` (aria-label "Squash bug") with `<img alt="">` using `ICON.bug`.
- Edge: `edge = floor(random*4)`: 0 left, 1 right, 2 top, 3 bottom. Offscreen by 20 px.
- Area: `W = OS.size().w`, `H = OS.size().h - 32`.
- Speed `sp = 60 + random*90 + (20 - left)*6` px/s.
- Initial heading toward the centre with jitter: `a = atan2(H/2 - y + (rnd-.5)*H*.6, W/2 - x + (rnd-.5)*W*.6)`.
- Pointerdown: `stopPropagation`, if not dead: `dead = true`, class `splat`, `score++`, score text, `Snd.pop()`, remove after 400 ms.

**Per-frame (`frame(t)`):**

- `dt = min(.05, (t - last)/1000 || .016)`, `last = t`, `left -= dt`, timer text `max(0, ceil(left))`.
- Spawn when `spawnT <= 0`: `spawn()`, `spawnT = max(.25, .8 - (20 - left)*.03)`.
- Each live bug: `turn += (random-.5)*4*dt`, `a += turn*dt`, move by `sp*dt` along `a`. Transform `translate(x,y) rotate(a + π/2 rad)`.
- Removed when `x < -60`, `x > W+60`, `y < -60`, or `y > H+30`.
- Filter dead bugs from `bugs`.
- At `left <= 0`: `stop()`, button `Play again` (enabled), toast `BugHunt` with `You squashed N bugs. ` + (`Exterminator-level work.` if ≥10, else `The bugs win this round.`). `unlock('bugs')` if score ≥ 10.

**Cleanup:** `win._cleanup = stop`. `stop()` cancels rAF, removes layer, clears `bugs`. Note the layer is appended to the desktop (`#l-desk`), not the window, so the window's close must call `_cleanup` or bugs remain on the desktop.

---

## 4. Snake (lines ~972–1000)

**Fixed constants:** `CW = 19`, `CH = 15`, `SZ = 20` (grid cells). Canvas internal size 380×300.

**UI:** `SCORE` (`.sn-s`), `Start` button (`.sn-go`, text switches to `Restart` after start and `Retry` after death). Canvas `.snake-cv` (`tabindex=0`, aria-label "Snake game. Use arrow keys or WASD."), `.sn-ate` text "Arrow keys / WASD, swipe, or the pad below.", then a d-pad: `▲` (data-d `0,-1`), `◀` (`-1,0`), `▼` (`0,1`), `▶` (`1,0`).

**Initial state (`reset()`):** `sn = [{6,7}, {5,7}, {4,7}]` (head first), `dir = nd = {1,0}`, `fi = 0`, `eaten = []`, `place()`, score text `'0'`. Note: `reset()` does NOT clear the `Ate:` line (see gotchas).

**Food (`place()`):** random cell not on the snake, uniformly picked with `Math.random`. Food is a skill tile: the skill is `SKILLS[fi % SKILLS.length]`, so the order is deterministic (Python, Java, JavaScript, TypeScript, CSS, Vue.js, Nuxt, React, ...). Tile colour `CAT[sk[2]][1]` (lang `#2F7FD0`, fw `#E0702E`, data `#1F9A63`, tool `#8A62D6`), label `sk[0].slice(0,2).toUpperCase()` in 9px Silkscreen.

**Step (`step()`), every 120 ms (160 ms when reduced motion):**

1. `dir = nd`. Head = `sn[0] + dir`.
2. Death if head is outside 0..18 × 0..14, or hits any snake cell (including the tail, which is not exempt). Then `alive = false`, `clearInterval`, button `Retry`, `Snd.off()`, redraw overlay.
3. Move: `unshift(head)`. If head is food: `eaten.push(skill name)`, `fi++`, score text `eaten.length`, `ate` text `'Ate: ' + eaten.join(', ')`, `Snd.tone(880, .06, 'square', .04)`, `if eaten.length >= 5 → unlock('snake')` (Ssssskills), `place()`. Else `pop()` the tail.

**Overlay** when not alive: dark 55% rect, text `GAME OVER · N SKILLS` if `eaten.length`, else `PRESS START`.

**Controls:**

- Keyboard (`keydown` on the window element, only when `alive`): ArrowUp/Down/Left/Right and W/A/S/D. preventDefault.
- `turn(dx, dy)`: ignored if it is the exact reverse of `dir` (the last applied direction, not `nd`). Otherwise `nd = {dx, dy}`.
- D-pad buttons call `turn` regardless of `alive`.
- Swipe: pointerdown on canvas records start. pointerup: if `max(|dx|,|dy|) > 20`, turn along the dominant axis by `sign`.

**Start button:** `reset()`, `alive = true`, `clearInterval`, `setInterval(step, REDUCE?160:120)`, text `Restart`, focus canvas, `draw()`.

**Cleanup:** `win._cleanup = () => clearInterval(timer)`. The window-level keydown listener is not removed in cleanup but dies with the window element.

**Achievements:** `unlock('snake')` at 5 skills eaten.

---

## 5. Paint (lines ~1002–1006)

**Constants:** `N = 24` (grid is 24×24), `SZ = 14` (cell px). Canvas 336×336 (the grid is drawn at 14 px per cell and faint grid lines `rgba(18,32,48,.08)`).

**Palette (in order):** `#122030` (default selected), `#FFFFFF`, `#E8452E`, `#FF8A3D`, `#FFD15C`, `#3BB273`, `#4AA6EE`, `#8A62D6`, `#F4A7C0`, `null` = eraser (drawn as a striped swatch, cell becomes empty/transparent).

**Drawing:** pointerdown captures the pointer and paints; pointermove paints while `down`; pointerup ends. Cell = `floor((clientX - rect.left)/rect.width * N)`, out-of-range ignored. Each paint repaints the whole canvas (grid array is 576 entries, `null` for empty).

**Buttons:**

- `Clear` (`.p-clr`): fills grid with null, redraws. No confirmation.
- `Save to desktop` (`.p-save`): if grid is empty, toast `Paint` / `Draw something first!` (info). Else: export a 24×24 PNG data URL (empty cells transparent), push to `ART`, add a desktop icon `my-art-<n>.png` (n = index in `ART`) to `#icons-r`, icon click → `openApp('art:' + n)`. Toast `Saved` / `my-art-<n>.png is on the desktop.`. `unlock('paint')` (Artist in Residence).
- `Pin to wall` (`.p-pin`, background `#C8955E`): empty → same toast. Else `Wall.submit(png())`, `unlock('paint')`, toast `Pinned!` / `It’s waiting for Jay’s approval. Open Visitor Wall and switch to "Jay (moderator)" to approve it.`

The canvas is not cleared after save or pin.

**Image format:** PNG, 24×24 pixels, RGBA. Transparent where empty or erased. Only the 9 palette colours plus transparency. The data URL is passed to `Wall` as-is (base64 in the mock).

---

## 6. Konami code and other easter eggs

**Konami (lines 1038–1041):** `KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a']`.

- Global `window` keydown listener (also used for 3D keyboard press and key click sound).
- Key name: `e.key.length === 1 ? e.key.toLowerCase() : e.key`. Ring buffer `kq`, keep last 10 (`kq.slice(-10)`). Compare `kq.join() === KONAMI.join()`.
- On match: `kq = []`, `unlock('konami')` (Cheat Code), toast `Cheat code` / `Disco mode enabled. You’re welcome.` (info), then `OS.disco()` if OS is on, else `Scene.disco(6)`.
- `OS.disco()`: returns if REDUCE. Adds class `disco` on `os` for 6 s, `Scene.disco(6)`.
- Typed in the terminal or Snake, the same keys also count (window listener).

**Escape:** closes `#rec` if open, otherwise `Ctrl.zoomOut()` if in interactive mode.

**Other easter eggs that unlock achievements (all verified in grep):**

| Trigger | Where | Achievement id |
|---|---|---|
| Boot complete | line 685 | `boot` (Power User) |
| Floppy in drive | line 1188 | `floppy` (Floppy Handler) |
| Terminal any command | run() | `term` (Hacker Voice) |
| `neofetch` | terminal | `neofetch` (Show-off) |
| `sudo ... hire` | terminal | `hire` (sudo make me an offer) |
| BugHunt ≥10 | BugHunt | `bugs` (Exterminator) |
| Snake ≥5 skills | Snake | `snake` (Ssssskills) |
| Paint save or pin | Paint | `paint` (Artist in Residence) |
| Dog tags / Salute button in Service.txt (line 829) and terminal `salute` (line 915) | Service app and terminal | `tags` (Once a Marine) |
| Desk lamp off | line 1189 | `lamp` (Night Owl) |
| Konami | global | `konami` (Cheat Code) |
| Shutdown | OS.shutdown (line 688) | `shutdown` (Safe to Turn Off) |
| 3 wallpaper secrets | Wallpaper.found | `local` (Local Knowledge) |

`unlock(id)` (line ~662): if already in `got` (persisted in `store` key `jayos-ach`), return. Else add, persist, look up `ACH` for the name, toast `★ Achievement unlocked` / name, `Snd.ach()`, `renderAch()`.

Note: `salute` is the only route to `tags` from the terminal, so `Once a Marine` is hidden behind a salute, not dog tags.

Note: the `ACH` list also defines `['floppy', 'Floppy Handler', …]`, `['tags', …]`, `['lamp', …]` etc. The text is in `ACH` (~line 657–661). Port that array verbatim.

---

## 7. Visitor Wall data model (for a real backend)

The prototype comment says the real build uses a Supabase table with a pending/approved flag (line 420). Proposed model:

**Table `visitor_drawings`**

| field | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `status` | enum `pending` \| `approved` \| `rejected` \| `removed` | see transitions |
| `png` | bytea or storage path | PNG, 24×24, see format below |
| `width`, `height` | smallint | constant 24; kept for future sizes |
| `visitor_key` | text | anonymous per-browser key (hashed cookie or localStorage UUID, not PII) |
| `created_at` | timestamptz | mock `ts` |
| `decided_at` | timestamptz null | approve/reject/take-down time |
| `decided_by` | text null | moderator id (single user in practice) |
| `approved_position` | int null | optional, newest first ordering = `decided_at desc` |

**Status transitions (mock vs. recommended):**

- `pending → approved` (Approve). Mock: moves to `items`, new id. Backend: same row, set `approved`, `decided_at`.
- `pending → rejected` (Reject). Mock: deleted from queue, no record. Backend: keep `rejected` (for the moderator's own audit, never shown publicly). Mock does not persist rejection, so the visitor could submit again. Backend: rejection should not block a new submission unless product wants it to.
- `approved → removed` (Take down). Mock: deleted from `items`. Backend: soft delete (`removed`), not shown publicly.
- Examples (`ex0..ex2`) are client constants, not rows.

**Per-visitor limit.** Mock: one pending slot, via `id:'mine'`. Pinning again replaces the pending drawing (new `ts`, moved to top). Approved drawings do not count against the limit.
Backend: partial unique index `(visitor_key) where status = 'pending'`. Submission = upsert that replaces the pending row. There is no limit on approved drawings in the mock; decide whether one-per-visitor-total is wanted (add a check).

**Public read:** only `status = 'approved'`, ordered newest decision first. Corkboard reads the first 6. The Visitor Wall app shows all approved.

**Moderation access:** the mock's "Jay (moderator)" segmented control is a UI toggle with no auth. The real build must gate the moderator view and the approve/reject/remove writes behind auth (RLS: moderators only). Visitors may only insert `pending` rows for their own key and read approved rows.

**Image format:**

- PNG, 24×24, RGBA. Transparent background for empty cells (no white fill).
- Colours limited to the 9 palette hex values plus alpha 0. Reject other colours (anti-abuse, and keeps the corkboard consistent).
- Size: mock PNGs are very small (a few hundred bytes). Suggest a server cap of 4 KB (hard cap 16 KB) after re-encoding. Reject non-PNG and any dimension other than 24×24.
- The corkboard draws 66 px, pixelated (`NearestFilter`/`image-rendering: pixelated`), on a white 76 px card.
- Mock examples are 12×12 with a white background. Do not allow 12×12 submissions; keep examples client-side.

---

## 8. Testable behaviours (GIVEN / WHEN / THEN)

### Pure functions (unit-test first)

**`autoWp(date)`** (port signature: take an injectable `Date`; compute Montréal hour via `Intl.DateTimeFormat('en-GB', {timeZone:'America/Toronto', hour:'2-digit', hour12:false})`, `% 24`; fall back to hour 12 on error)

- GIVEN local hour 06:59 in Montréal, WHEN `autoWp` runs, THEN `'night'`.
- GIVEN 07:00, THEN `'day'`.
- GIVEN 16:59, THEN `'day'`.
- GIVEN 17:00, THEN `'golden'`.
- GIVEN 19:59, THEN `'golden'`.
- GIVEN 20:00, THEN `'night'`.
- GIVEN 00:00 (engines printing "24"), THEN `'night'`.
- GIVEN the timezone lookup throws, THEN `'day'`.

**Wallpaper width `clampWidth(clientW, clientH)`**

- GIVEN 900×675, THEN 240.
- GIVEN 0×0, THEN 240 (fallback).
- GIVEN 100×675, THEN 160.
- GIVEN 2000×675, THEN 420.

**Wallpaper preference `resolvePref(stored)`**

- GIVEN nothing stored, THEN `'auto'`.
- GIVEN `'golden'`, THEN `'golden'`.
- GIVEN `'bogus'`, THEN `'auto'`.
- GIVEN `'constructor'` (see gotchas), THEN `'auto'` (after fix).

**Terminal `parseLine(raw)`**

- GIVEN `'   '`, THEN no command and no history entry.
- GIVEN `'OPEN   Snake.exe'`, THEN cmd `'open'`, args `'Snake.exe'`.
- GIVEN `'echo a   b'`, THEN args `'a b'`.

**Terminal `resolveOpen(args)`** (normalize, then the 5 steps in §2)

- `'p1'` → `p:0`; `'P8'` → `p:7`; `'p9'` → project 9 does not exist → error; `'p10'` → error (current behaviour).
- `'Visitor Wall'` → `wall`; `'recycle bin'` → `bin`; `'Trophies.exe'` → `ach`.
- `'wallpaper'` (no arg) is handled by the command, not `open`: prints usage and opens `display`.
- `'rec'` → project prefix match on `RecycleWise` (the only match starting `rec`).
- `''` → `(nothing)` error.

**Terminal `levenshtein` suggestion**

- GIVEN `'hepl'`, THEN suggests `help`.
- GIVEN `'xyz'`, THEN no suggestion (`Try "help".`).
- GIVEN `'abut'`, THEN no suggestion, because `about` is only in NAMES and not a key of `C` (current behaviour).

**Terminal `wallpaper` arg**

- `auto`, `night`, `golden`, `day` valid. Anything else prints usage and opens `display`.

**Konami matcher `pushKey(buffer, key)`**

- GIVEN buffer holds the 9 keys then `'a'`, THEN match and buffer resets.
- GIVEN extra keys before the sequence, THEN it still matches (last 10 only).
- GIVEN `'B'` (shift), THEN treated as `'b'`.

**Snake**

- `turn(dx,dy)`: GIVEN moving right, `turn(-1,0)` is ignored. `turn(0,1)` is accepted.
- `step()`: GIVEN head on the food, THEN length +1, score +1, next skill is `SKILLS[1]`, and food relocates to an empty cell.
- GIVEN head enters a wall, or the tail cell on a non-eating step, THEN `alive=false`, overlay text `GAME OVER · N SKILLS` (N = eaten count).
- GIVEN 5 eaten, THEN `unlock('snake')` is called once.

**BugHunt**

- `spawnInterval(left) = max(0.25, 0.8 - (20 - left)*0.03)`: GIVEN left 20, THEN 0.8. GIVEN left 0, THEN 0.25 (clamped; 0.8 - 0.6 = 0.2 < 0.25).
- `speed(left) = 60 + r*90 + (20-left)*6` for r in [0,1): range check.
- GIVEN a bug is squashed, THEN score+1 once (second pointerdown ignored).
- GIVEN left reaches 0, THEN loop stops, score ≥10 unlocks `bugs`.

**Wall (pure reducer)**

- GIVEN empty queue, WHEN `submit(p1)`, THEN queue has one `mine`.
- GIVEN queue has `mine`, WHEN `submit(p2)`, THEN queue has one `mine` with `p2` and the newest `ts`.
- GIVEN queue has `mine`, WHEN `approve(mine)`, THEN queue empty, `items[0].png === p1`, and `items.length` increased by 1.
- GIVEN an approved item, WHEN `submit(p3)`, THEN queue has one `mine` (approved items unaffected).
- GIVEN `reject(mine)`, THEN queue empty and `items` unchanged.
- GIVEN `remove(item)`, THEN `items` loses that item only.
- GIVEN 7 items, THEN corkboard receives the first 6 (newest first).

**Wallpaper secret logic**

- GIVEN `found('moon')` twice, THEN set size 1 and one toast.
- GIVEN 3 distinct secrets, THEN `unlock('local')` once.

**Wallpaper hit test `hit(p, hot)`**

- GIVEN a point inside both the cross box and a building box, THEN the building wins (pushed later). Raccoon beats boat beats wheel beats building beats cross beats moon/sun.

**Paint**

- GIVEN empty grid, WHEN Save or Pin, THEN toast `Draw something first!` and no icon or submission.
- GIVEN one painted cell, WHEN Pin, THEN `submit` receives a 24×24 PNG with that cell opaque and others transparent.
- GIVEN eraser, WHEN drawing, THEN the cell is `null` (transparent in PNG).

### Behavioural (component/E2E)

- GIVEN the terminal, WHEN the user types `help` + Enter, THEN the 15 help lines appear in order, and the input is cleared.
- GIVEN `↑` after two commands, THEN the input shows the most recent command, and `↓` returns to an empty line.
- GIVEN `Tab` with input `nea`, THEN the input becomes `neofetch ` (unique prefix). GIVEN `Tab` with input `h`, THEN the line prints the keys starting with `h` (help, hi, history, hello, in key order), joined by two spaces, class `d`.
- GIVEN `neofetch`, THEN the ASCII block prints and the `Show-off` achievement toast appears once.
- GIVEN `sudo hire-jay`, THEN confetti runs, the Resume window opens, and `Find the command…` achievement unlocks.
- GIVEN `clear`, THEN output is emptied and history still contains `clear`.
- GIVEN `wallpaper golden`, THEN wallpaper switches, caption changes to `vieux-port · 7:12 pm`, and `store jayos-wp = "golden"`.
- GIVEN `wallpaper`, THEN usage line and the Wallpaper settings window opens.
- GIVEN the desktop background canvas, WHEN user clicks the raccoon, THEN it runs right until off-screen, then reappears after 14 s.
- GIVEN the moon is clicked in night mode, THEN it becomes a bagel; clicking again reverts.
- GIVEN the 3rd distinct wallpaper secret, THEN `Local Knowledge` unlocks.
- GIVEN OS is off, THEN the wallpaper loop does not draw (CPU idle).
- GIVEN `prefers-reduced-motion`, THEN the wallpaper does not animate; Snake runs at 160 ms.
- GIVEN Konami sequence, THEN disco runs for 6 s (desk) and `Cheat Code` unlocks once.
- GIVEN BugHunt ends with 10 squashes, THEN toast `Exterminator-level work.` and `Exterminator` unlock.
- GIVEN Paint pin, THEN the Visitor Wall moderator view shows the item in the queue as `From you · sent …`.
- GIVEN Approve, THEN the item appears on the wall app and on the corkboard (up to 6).

---

## 9. Risks and gotchas for the React + Vite port

1. **Global rAF and listeners.** The wallpaper loop, IntersectionObserver, canvas listeners, the 60 s `setInterval`, and the window keydown Konami listener are never removed in the prototype. In React, put each in a `useEffect` with cleanup. Keep the rAF loop out of React state; use refs and direct canvas drawing (no per-frame `setState`).

2. **Mixed-type `dirty`.** `dirty` is `true`, `false`, or `'mode'`. Replace with explicit flags (`needsRebuild`, `needsDraw`).

3. **Re-roll on resize.** `build()` reseeds, but `W` changes the layout, so the city changes shape on any aspect change. Decide: keep layout keyed by `W` (acceptable), or build once at a fixed W and scale with CSS.

4. **Object-key lookup is unsafe.** `C[cmd]` and `WP[a]` use plain objects, so `constructor`, `toString`, `__proto__` resolve to `Object.prototype` members. `constructor` is truthy for `WP[a]`, which saves `'constructor'` as the wallpaper and then crashes in `applyWallpaper` (`WP[k].cap` is undefined). Use `Object.hasOwn` or a `Map`.

5. **`autoWp` caption.** The caption text is a static string per mode (for example `11:48 pm`), not the actual time. Either render the real time or drop the time from the caption.

6. **Snake "Ate:" line.** `reset()` does not clear `ate`, so the previous run's `Ate:` text persists. Clear it in reset.

7. **Snake keyboard listener.** `win.addEventListener('keydown')` is never removed in cleanup. In React, attach on mount and remove on unmount.

8. **Snake timers after window close.** Cleanup clears the interval only when the window is closed. Confirm OS shutdown calls `_cleanup` for every window.

9. **BugHunt layer on the desktop.** The layer is appended to `#l-desk` (not the window). If the window closes mid-game without `_cleanup`, bugs remain on screen. Also `setTimeout(…, 400)` for splat removal is not cancelled.

10. **Terminal state lives in the window.** `hist`, `hi`, and output are local to `renderTerm`. Closing the window loses history. Decide whether that is desired.

11. **Terminal `about`.** `about` is in NAMES (works through `open`), but not a command. `help` does not list it. Add `about` to the command table or document it as open-only.

12. **Terminal `help` text is hard-coded** (`p1 … p8`). It must match `PROJECTS.length`. `git` output is hard-coded too. Keep these in the content file or the output will drift.

13. **`p10+` unsupported in `open`** because the regex is `\d` (single digit).

14. **Paint on touch.** `pointerdown` and `pointermove` need `touch-action: none` on the canvas, or the page scrolls while painting. `setPointerCapture` is used, but `pointercancel` is not handled.

15. **Paint canvas state.** Save and Pin do not clear the grid. Decide whether that is intended.

16. **Visitor Wall rendering.** Each emit re-renders the whole app (`innerHTML` reset), so scroll and focus are lost on every approve. In React, use a subscription (`useSyncExternalStore`) and keyed rows.

17. **Wall as module singleton.** `Wall`, `Snd`, `store`, and `unlock` are module globals. Port to a small store (context or Zustand-like) so the corkboard, Paint, and the Wall app all share one source.

18. **`innerHTML` / `el()` templates.** The prototype builds some UI from HTML strings (`el('<div>...')`). Keep dynamic values out of those strings. The Wall approve text uses `textContent`, which is correct.

19. **`Math.random` vs seeded RNG.** Sparks, golden shimmer, and BugHunt use `Math.random`. The city layout uses the seeded LCG. Tests need an injectable RNG.

20. **Secrets reset on reload.** `S.found` and wallpaper toggles (bagel, shades, cross colour, building lights) are in memory. Only achievements persist (`jayos-ach`). Decide whether to persist secrets.

21. **Sound.** `Snd.tone` is a no-op until sound is on. The `AudioContext` is created lazily on the first user gesture (`setSound` calls `Snd.ctx()`).

22. **Reduced motion.** `REDUCE` is evaluated once at load. Listen for changes with `matchMedia` in React.

23. **`snapshot()` mutates module state** (temporarily replaces `L`, `W`, `stat`, `S.rac`). Port it as a pure render function that takes its own layout object.

24. **Terminal `run` exposed.** `win._run = run` is read elsewhere; grep before removing.

25. **Visitor Wall copy vs behaviour.** The Visitor view says "Nothing goes public until you approve it", but the mock shows the example drawings on the wall immediately. Keep examples visually distinct (they are labelled "example" in the app, not on the corkboard).

26. **Image size mismatch.** Mock examples are 12×12 with white backgrounds; submissions are 24×24 transparent. Normalise on the server (see §7).

27. **Performance.** The `display` app calls `Wallpaper.snapshot` for all 4 cards on each render (each builds a 240 px scene). Cache the data URLs per mode (and per time-of-day for auto).

---

## 5-line summary

1. Toys are four imperative modules (wallpaper canvas, Visitor Wall mock, terminal, and the BugHunt, Snake and Paint apps) plus the global Konami listener; all state is in memory except `jayos-wp` and `jayos-ach` in localStorage.
2. The wallpaper is a 240-wide canvas drawn at about 14 fps idle (rAF loop, throttled), with 7 secrets; three distinct secrets unlock "Local Knowledge".
3. The terminal has about 30 commands plus `open` and Levenshtein suggestions; `open` and wallpaper arguments are the parsing-heavy parts and are pure functions worth unit-testing.
4. Visitor Wall is a pending/approved queue with one pending slot per visitor, 24x24 PNG drawings, and approved items feeding the 3D corkboard (max 6); moderation has no auth in the mock.
5. Top porting risks: unremoved listeners and rAF, unsafe object-key lookups (`constructor`), resize re-rolling the city, the Snake "Ate:" leftover, and in-memory moderation with no backend auth.
