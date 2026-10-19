# R2 removal inventory: Paint, Visitor Wall, and the "Inspired by edh.dev" credit

Read-only investigation on branch `feat/website-revamp` (worktree `.worktrees/feat-website-revamp`). Line numbers are from the tree at commit `c90ecff`. Actions: **DELETE** the file, **EDIT** it (described), or **KEEP**.

Terms used below: **Paint** = `src/os/apps/paint/*` plus its window. **Wall** = the Visitor Wall app, the `src/wall/*` store and clients, the Supabase backend, and the corkboard that shows approved drawings in the 3D scene. The Wallpaper feature (`src/wallpaper/*`, `Display`, "Desktop Background") is a separate feature and is **not** removed. Many greps for `wall` hit it, so ignore those hits.

---

## 1. Where Paint and the Wall are referenced (user-facing)

| Surface | File:line | Reference | Action |
|---|---|---|---|
| Desktop icon "Paint" | `src/os/DesktopIcons.jsx:20` | `DESK_R` entry `['paint','Paint','paint']` | EDIT: remove entry |
| Desktop icon "Visitor Wall" | `src/os/DesktopIcons.jsx:21` | `['wall','Visitor Wall','wall']` | EDIT: remove entry |
| Saved drawings on desktop (`my-art-N.png`) | `src/os/DesktopIcons.jsx:39, 51-53` | `art` store read and `art:N` icons | EDIT: remove the map and the `art` selector |
| Start menu | `src/os/MenuPop.jsx:4-8` | `APPS` has only `aboutos`, `display`, `ach`. | KEEP (no change). Neither app is in the menu. |
| Window registry | `src/os/registry.js:21-22, 34-35` | imports and `paint` / `wall` entries | EDIT: remove 4 lines |
| Dynamic `art:N` windows | `src/os/registry.js:46-47, 58-62`; `src/os/apps/Art.jsx` (whole file) | opens saved drawings | EDIT (registry: remove `art:` branch and the `art` arg, so `dynApp` only handles `p:N`); DELETE `src/os/apps/Art.jsx` |
| Controller drawing store | `src/os/osController.js:41` (`art: []`), `:103` (`lookupApp(registry, id, get().art)` becomes `lookupApp(registry, id)`), `:170-174` (`addArt`), `:237` (export) | | EDIT: remove all four |
| jaysh `paint` command | `src/os/apps/terminal/commands.js:27` (NAMES), `:148` (`['paint', () => openApp('paint')]`) | | EDIT: delete both |
| jaysh `wall` / `visitorwall` | `commands.js:31-32` | NAMES aliases | EDIT: delete both |
| jaysh `ls` output | `commands.js:40` (`LS` string) | "Paint" and "Visitor Wall" tokens | EDIT: remove `Paint` and `Visitor Wall` from the string |
| jaysh `help` text | `commands.js:51` | `'snake · bugs · paint     play'` | EDIT: change to `'snake · bugs     play'` (line count stays 14, which the test checks) |
| Hotspot "Visitor wall" (3D corkboard click) | `src/scene/hotspots.js:49-52`; `src/scene/createScene.js:531` (`addHot(cork,'Visitor wall')`) | opens `wall` | EDIT: delete both. The `Polaroid` hotspot stays. |
| Trophy "Artist in Residence" | `src/core/achievements.js:15` | unlocked only by Paint (save or pin) | EDIT: delete the tuple (see section 4) |
| Toasts | `Paint.jsx:120,130,148,150`; `VisitorWall.jsx:114`; `wallStore.js:111,126` | "Draw something first!", "Saved", "Pinned!", "Visitor Wall" | DELETE with their files |
| Buttons "Open Paint" | `VisitorWall.jsx:101, 147` | | DELETE with the file |
| Stage HUD | `src/stage/Hud.jsx` | no Paint/Wall text. Its count uses `ach.list.length` | KEEP (count becomes 12 automatically) |
| Résumé | `src/resume/*` | no Paint/Wall text | KEEP |
| Trophies window copy | `src/os/apps/Trophies.jsx:12` | computed `got.size of ach.list.length` | KEEP (becomes "of 12") |

### Desktop icons and terminal, specifically
- Desktop icons: right column loses **Paint** and **Visitor Wall**. The left column is unchanged. Right column after: BugHunt.exe, Snake.exe, Service.txt, Trophies, Recycle Bin.
- Terminal commands: `paint`, `wall`, `visitorwall` (and the `Paint` / `Visitor Wall` names in `ls`). `parse.js` resolves names through `NAMES` in `commands.js`, so no change is needed in `parse.js`. Its tests are the exception (see section 6).
- The start menu does not list either app. No change.

### Toasts that disappear with these features
`Paint.jsx`: "Paint / Draw something first!", "Saved / my-art-N.png is on the desktop.", "Pinned! / It's waiting for Jay's approval.", the pin error map (`rate_limited`, `queue_full`, `bad_png`, `too_large`, `bad_size`, network). `VisitorWall.jsx`: "Approved. It's on the wall...". `wallStore.js`: couldn't-update and couldn't-send-sign-in toasts. All go away with their files.

### Other app code touched
- `src/app/createApp.js:16` (import `createWallStore`), `:65-66` (`app.wall`), `:113-114, 116, 123` (`startWallTriggers`, `app.wall?.dispose`), `:132-145` (the `startWallTriggers` function and its comment). **EDIT**: delete all of these. `app.start` then only returns the wallpaper stop, and `app.dispose` no longer calls `app.wall.dispose`.
- `src/scene/createScene.js:10` (import `corkboardPngs`, `approvedCount`), `:30` (`drawCork`), `:43-44` (comment), `:47-57` (`wireScene`, which becomes wallpaper-only), `:59-93` (the wall subscription at `:69-81` and `app.wall.ensureInit` at `:92`), `:269-278` (cork group, `drawCork` texture), `:307-325` (`setWall`), `:531` (hotspot), `:623` (`corkTex` redraw), `:737` (`setWall` in the api). **EDIT**: see section 2.

---

## 2. The 3D corkboard (src/scene)

### What it shows today
Built in `createScene.js:269-325`:
- A brown wood-coloured board, `mk(B(2.12,1.47,0.04), M(0x7a4e2c))`, at `cork.position = (1.55, 3.05, -2.97)`.
- A **canvas texture** `corkTex = canvasTex(512, 350, drawCork(...))`, laid flat over the board by `flat(corkTex, 2.0, 1.36, 0, 0, 0.025, cork)`. This is the part that paints the cork look, the "VISITOR WALL" title, up to 6 pinned photos, pin dots and the caption.
- A **polaroid**: group `pol` at local `(-0.55, 0, 0.05)` inside `cork`, rotation z 0.06. It has a white card, a dithered portrait `PlaneGeometry(0.54,0.58)` loaded from `img/jay-px.png` (fallback `img/jay.jpg`), and a red pin sphere. It is a child of `cork`, so it moves with the board.
- Hotspots: `addHot(cork,'Visitor wall')` (`:531`) and `addHot(pol,'Polaroid')` (`:532`), which opens About.

### How `drawCork` paints it (`src/scene/textures.js:47-90`)
Plain Canvas 2D. Wood fill `#C8955E`, 900 small speckle dots, title text "VISITOR WALL" in Silkscreen at (258,34), six slots `CORK_SLOTS` = `[252,52] [340,52] [428,52] [252,160] [340,160] [428,160]`. Each slot is rotated by a fixed small angle. A filled slot shows the drawing on a white 76px square. An empty slot shows a dashed outline. Each slot has a pin dot in `PINS` colours. Bottom caption: `N pinned by visitors` when `approvedCount > 0`, else `your drawing here?`.

### Data feeding it
- `src/wall/wallStore.js:24-29`: `corkboardPngs(state)` = the 6 newest approved drawings, or `EXAMPLES` (three 12×12 sample drawings from `src/wall/examples.js`) when nothing is approved. `approvedCount` is the real count, never the examples.
- `setWall(pngs,count)` (`createScene.js:307-325`) loads the images and calls `corkTex.redraw()`.

### What would be left without the wall
Only the title "VISITOR WALL", the empty dashed slots or the three example sketches, and the caption "your drawing here?". That is a placeholder with no purpose. **The drawing-displaying part of the corkboard should go.**

**Recommendation (minimal, keeps the room layout):**
1. Delete `corkTex`, `drawCork`, `CORK_SLOTS`, `PINS` (`textures.js:47-90`), the `flat(corkTex,...)` call (`createScene.js:277-278`), `setWall` and its state (`wallImgs`, `wallCount`, `wallGen`, `:274-276, 307-325`), `redrawText` entry `corkTex` (`:623`), and `setWall` in the api (`:737`).
2. Keep the brown board (`:273`) and the polaroid (`:279-305`). The polaroid still reads as "Jay's photo pinned to the wall", and the `Polaroid` hotspot still opens About. The board needs no texture; the plain `M(0x7a4e2c)` material is already the colour.
3. Delete hotspot `Visitor wall` (`createScene.js:531`), and rename the comment at `:269`.
4. Optional: if the board should go too, move `pol` to the scene at its world position `(1.55-0.55, 3.05, -2.97+0.05) = (1.00, 3.05, -2.92)` with rotation z 0.06, and delete the board mesh. This changes the room, so it is a design call. Ask the owner.

Option 1 (keep brown board with polaroid) is the default in this report. Option 4 is a judgment call for the owner.

Tests that cover this:
- `src/scene/textures.test.js:10-64`: the five `drawCork` tests. DELETE them. The `drawMirror` tests (`:66-106`) stay.
- `src/scene/createScene.test.jsx:183-189, 223, 329, 335, 353`: the `wall` fake and its subscription checks. EDIT: remove the wall fake and the `subs.wall` assertions (keep `os` and `wallpaper`).
- `src/stage/SceneMount.wiring.test.jsx`: tests 35, 50, 69 (`setWall` tests) and the `fakeWall` helper (`:16-27`) and `EXAMPLES` import (`:11`). EDIT: delete those, keep the `onOS`, wallpaper, unsubscribe and loader tests (`:85-157`), and drop `wall` from the `createApp` calls.
- `src/scene/hotspots.test.js:15` (LABELS entry `'Visitor wall'`), `:96-101` (test), and `:137-140` count 13 becomes 12. The comment "13 with three floppies" in the test name needs the same update.

---

## 3. Shared modules: what becomes unused

| Module | Used by after removal? | Action |
|---|---|---|
| `src/lib/png.js` | Still used by `pixelIcons.js` (`PNG_PREFIX`, `bytesToBase64`, `encodeIndexedPng`, `hexToRgb`) and by `scripts/optimize-images.mjs` (`encodeIndexedPng`, `hexToRgb`). | **EDIT (trim).** Keep: `crc32`/adler/`encodeIndexedPng`, `PNG_PREFIX`, `bytesToBase64`, `hexToRgb`, `readPngInfo` (used in `pixelIcons.test.js:3`). Delete: `validateDrawingDataUrl` (`:173`), `MAX_DRAWING_BYTES` (`:7`), `DRAWING_SIZE` (`:8`, only paintLogic), `gridToPngDataUrl` (`:134`, only Paint/Wall/tests), and `base64ToBytes` (`:117`, only wall tests). Trim `png.test.js:89-127` (the `gridToPngDataUrl`/validator block). Update the header comment at lines 1-3, which says "Visitor Wall drawing validator". |
| `src/lib/pixelIcons.js` | Yes. `ICON` is used by desktop icons, Trophies, TrophiesGrid, BugHunt. | KEEP. Remove `BMP.wall` (used only by the removed desktop icon) and `BMP.paint` (used only by the removed "Artist in Residence" trophy icon, `achievements.js:15`). Update `pixelIcons.test.js:9` from 15 keys to 13. Check `pixelIcons.test.js:9` expects `Object.keys(ICON)` length 15. |
| `src/lib/dither.js` | Yes, used by `scripts/make-pixel-portrait.mjs` for the About portrait (`/img/jay-px.png`). | KEEP. Not related to Paint. |
| `src/wall/examples.js` | Only the wall. | DELETE with `src/wall/`. |
| `src/test/fakeCanvas.js` | Used by `src/test/setup.js:7`, `wallpaper/render.test.js`, `scene/textures.test.js`. | KEEP. |
| `src/test/setup.js:29` (`toDataURL` stub) | Generic. | KEEP. Line 9 comment mentions "the PGlite SQL tests": EDIT the comment only. |
| `src/test/fakeSupabase.js` | Only `src/wall/supabaseWallClient.test.js`. | DELETE. |

---

## 4. Trophies (src/core/achievements.js)

Current list is 13 entries (`achievements.js:7-21`, test `achievements.test.js:9-10`). Trophies that depend on Paint or the Wall:

- **`paint` — "Artist in Residence"** (`achievements.js:15`): "Save a drawing to the desktop or pin it to the Visitor Wall". Unlocked only in `Paint.jsx:131` and `:147`. **Remove** (it cannot be earned after the removal).
- No trophy depends on the Wall alone. No other trophy unlocks from Paint.

After removal the list has **12** entries. Callers:
- `src/resume/TrophiesGrid.jsx` (renders from `ACH`, no hard-coded count).
- `src/resume/Resume.jsx:87-91` (`${got}/${ach.list.length}`). Prints `0/12`.
- `src/stage/Hud.jsx:7-26` (`total = app.ach.list.length`). Prints `★ 0/12`.
- `src/os/apps/Trophies.jsx:12` ("N of 12 unlocked").
- `src/resume/entry-server.jsx:5,16` (uses `ACH`, no count).

Hard-coded "13" that tests and docs need changed to "12":
- `src/core/achievements.test.js:9-10` (`'has 13 achievements...'`, `toHaveLength(13)`) and `:19` (drop `'paint'` from the id list).
- `src/resume/TrophiesGrid.test.jsx:16-21, 54` (13 cards, `ACH` length 13), `:39, 46` (uses `paint`: change to a remaining id, for example `'lamp'`).
- `src/resume/Resume.test.jsx:127-130, 135, 158` (`0/13`, 13 locked, `1/13`). Test 8 and test 9 change to 12.
- `src/resume/entry-server.test.jsx:19` (`'0/13'` becomes `'0/12'`).
- `src/stage/Stage.test.jsx:31-44, 124-132` (`★ 0/13`, `★ 2/13`).
- `src/os/apps/apps.test.jsx:192-203` ("0 of 13", 13 items, "1 of 13").
- `design/notes/plan.md:272, 366, 595` (historical; see section 7).

Stale localStorage: returning visitors may have `"paint"` in `localStorage['jayos-ach']`. `createAchievements` drops unknown ids (`achievements.js:27`), so the count is correct. No migration is needed.

---

## 5. Test files: full list

**DELETE (whole file):**
- `src/os/apps/paint/Paint.jsx`, `Paint.test.jsx`, `paintLogic.js`, `paintLogic.test.js`
- `src/os/apps/VisitorWall.jsx`, `VisitorWall.test.jsx`
- `src/os/apps/Art.jsx`
- `src/wall/errors.js`, `examples.js`, `examples.test.js`, `mockWallClient.js`, `mockWallClient.test.js`, `supabaseWallClient.js`, `supabaseWallClient.test.js`, `wallClient.js`, `wallClient.test.js`, `wallStore.js`, `wallStore.test.js`
- `src/test/fakeSupabase.js`
- `supabase/` (whole directory): `migrations/20261018000000_visitor_wall.sql`, `seed/admin.sql`, `__tests__/auth-shim.sql`, `__tests__/visitor_wall.lint.test.js`, `__tests__/visitor_wall.pglite.test.js`

**EDIT (remove wall/paint cases):**
- `src/os/JayOS.test.jsx:136-137` (remove `'Paint'`, `'Visitor Wall'` from the expected `labels('r')` array).
- `src/os/apps/terminal/commands.test.js:22, 32` (help text and `COMMAND_KEYS`: drop `paint`, and `'snake · bugs · paint     play'` becomes `'snake · bugs     play'`); `:173-180` (test "snake, bugs and paint open their apps": drop the paint part).
- `src/os/apps/terminal/Terminal.test.jsx:20` (help text, same change).
- `src/os/apps/terminal/parse.test.js:21, 25-26, 36, 92` (`paint`, `wall`, `visitorwall` aliases, the command key list, and `resolve('Visitor Wall')`).
- `src/os/apps/apps.test.jsx:228-240` (`describe('Art')`): DELETE. Also the AboutOs test at `:220-224` (see section 6).
- `src/os/osController.test.js:273-281` (the `art:0` test). DELETE.
- `src/os/registry.test.js`: no direct Paint/Wall references. KEEP.
- `src/stage/structure.test.js:80-82` (the test that `@supabase/supabase-js` is imported only by `supabaseWallClient.js`). DELETE. Its `three` test at `:76-78` stays. Also the `supabase` clause in the lint config (section 8).
- `src/lib/png.test.js:89-127`: trim (section 3).
- `src/lib/pixelIcons.test.js:9`: 15 becomes 13.
- `src/scene/textures.test.js`: delete the `drawCork` tests (section 2).
- `src/scene/createScene.test.jsx`, `src/stage/SceneMount.wiring.test.jsx`, `src/scene/hotspots.test.js`: see section 2.
- `src/resume/Resume.test.jsx:118-125` (test 7, the edh.dev footer, see section 6), `:127-160` (count changes).

**KEEP** (unrelated): `src/wallpaper/*` tests, `src/os/apps/Display.test.jsx` (it filters `jayos-ach` from localStorage, which still works), `src/os/apps/Mail.test.jsx`, `src/os/apps/snake/*`, `src/os/apps/bughunt/*`.

---

## 6. "Inspired by edh.dev by Ed Hinrichsen" (every occurrence)

Searched the whole repo for `edh`, `Hinrichsen`, `Inspired`, `ED-Linux`, `credit`. Not in `index.html`, the meta/OG/Twitter tags, JSON-LD (`src/resume/jsonld.js`), `public/`, or `src/content/*`.

| File:line | Text | Action |
|---|---|---|
| `src/resume/Resume.jsx:237-243` (`<footer className="r-foot">`) | `© 2026 Jewoo Lee · Inspired by <a>edh.dev</a> by Ed Hinrichsen.` | EDIT: keep `© 2026 Jewoo Lee`. Remove the `ext` link usage in the footer if nothing else uses it there. `ext` is still used elsewhere in Resume.jsx, so keep the const. |
| `src/resume/Resume.test.jsx:118-125` (test "7. footer credits edh.dev...") | asserts "Inspired by" and the edh link | EDIT: change to assert the footer contains `© 2026 Jewoo Lee` and does **not** contain `Inspired by` or `edh.dev`. |
| `src/os/apps/AboutOs.jsx:7` | `Inspired by ED-Linux on edh.dev. Runs on a 90s laptop...` | EDIT: delete the sentence "Inspired by ED-Linux on edh.dev.". Keep "Runs on a 90s laptop in Montréal, with snow." Same credit, different wording. |
| `src/os/apps/apps.test.jsx:220-224` (AboutOs test) | asserts `Inspired by ED-Linux on edh.dev` | EDIT: drop that assertion and rename the test title ("the inspiration line"). |
| `README.md:104-106` (`## Credits`) | `Inspired by edh.dev by Ed Hinrichsen.` | EDIT: delete the whole `## Credits` section. |
| `design/notes/explore-os.md:214` | notes quote of the About text | KEEP (design notes). Optional: edit if the owner wants no traces. |
| `design/notes/plan.md:887` | spec says AboutOs contains the edh line | KEEP as history, or edit. See section 7. |
| `design/notes/plan.md:1451` | footer spec "Inspired by edh.dev by Ed Hinrichsen" | same as above |
| `design/notes/plan.md:1477` | test spec for the footer credit | same |
| `design/notes/plan.md:1565` | manual checklist: "Inspired by edh.dev credit in the footer" | same |
| `design/revamp-lab.html:359, 366, 369, 388` | "What's borrowed from edh.dev, and what's new" section | DECISION. This is the prototype's rationale page. Not part of the built site (eslint ignores `design/`, and `vite build` does not read it). It is still in the repo and public on GitHub. Options: keep, or edit out. |
| `design/revamp-lab.html:425` (footer) | "Inspired by edh.dev by Ed Hinrichsen." | EDIT: delete the sentence (the prototype footer also uses this credit). |
| `design/revamp-lab.html:866` | `Inspired by ED-Linux on edh.dev.` in the prototype's AboutOs | same as the AboutOs row above, or leave with the rest of the prototype |

Notes:
- `design/notes/explore-codebase.md` and `design/notes/explore-toys.md` mention Tailwind and skills, not the credit. Irrelevant.
- The meta description, OG and Twitter text in `index.html` mention JAY-OS and the résumé only. No change.

---

## 7. Docs that go stale

### README.md
- Line 5: "...BugHunt, Snake, Paint and a moderated Visitor Wall." EDIT: remove "Paint and a moderated Visitor Wall".
- Line 15: "Supabase (Postgres + RLS...) for the Visitor Wall, also lazy." DELETE the bullet.
- Line 17: "Vitest, Testing Library, jsdom and PGlite for tests." EDIT: drop "and PGlite".
- Lines 29-30: "With no environment variables the site runs fully: the Visitor Wall uses an in-tab mock..." EDIT: change to "With no environment variables the site runs fully."
- Line 40: lint note "only `src/wall/supabaseWallClient.js` may import `@supabase/supabase-js`". EDIT: keep only the `three` part.
- Lines 52-55: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` rows, and the "wall uses Supabase only when..." sentence. DELETE.
- Lines 57-75: `## Supabase setup (Visitor Wall)` (steps 1-7). DELETE the section.
- Lines 81-82 (Vercel env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). EDIT: keep `VITE_SITE_URL` only.
- Lines 97-101 (project layout): `os/ ... Paint, Visitor Wall`, `src/wall`, `supabase/`. EDIT: remove those lines.
- Line 106 (credits). DELETE (section 6).

### .env.example
- Lines 1-11 (Visitor Wall block and both `VITE_SUPABASE_*` variables). DELETE. Keep the `VITE_SITE_URL` block (lines 12-15) and its comment.

### design/notes/plan.md
This is a historical build plan. Its phase and decision text describes the old design.
- Section 9 "What the user must do" (`:1599-1625`): items 1-7 and 10 are about Supabase and the wall. EDIT: delete them, keep items 8 (content questions) and 9 (getform), and renumber. Item 8's Custom domain text stays.
- Decisions D8, D9, D10 (part), D16 (`:22-24, 30`): EDIT or mark superseded.
- Phase 6 (`:1073-1298`) and the file tree (`:93-103`, `:112-116`, `:126-138`, `:190-199`): historical. Recommend adding one line at the top: "Paint and the Visitor Wall were removed in R2; see design/notes/r2-explore-removal.md." No need to rewrite.
- Counts "13" (`:272, 366, 595`): historical.

Decision for the owner: whether to edit history or leave it. The report recommends the one-line note.

### Vercel
- No `vercel.json` in the repo. The Supabase variables live only in the Vercel dashboard (README "Deploy on Vercel" step 2). **Action outside the repo**: remove `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Production and Preview, then redeploy.
- `VITE_SITE_URL` stays (canonical, og:url, JSON-LD).

### Supabase (outside the repo)
- The Supabase project still holds visitor PNGs in `drawings` (base64 text) and anonymous users. Pause or delete the project, or drop the table, to stop the backend and remove visitor drawings. This is a user action.
- Remove the redirect URLs `<site>/?mod` and the Auth "Allow anonymous sign-ins" setting if the project stays.

---

## 8. Dependencies, tooling and config

### package.json
- `dependencies`: remove `"@supabase/supabase-js": "2.109.0"`.
- `devDependencies`: remove `"@electric-sql/pglite": "0.5.8"` (used only by `supabase/__tests__/visitor_wall.pglite.test.js` and `supabase/__tests__/auth-shim.sql`).
- Keep: `@vercel/analytics`, `three`, `sharp` (`scripts/optimize-images.mjs`), `jsdom`, `vitest`, everything else.
- Run `npm uninstall @supabase/supabase-js @electric-sql/pglite` so `package-lock.json` updates, rather than hand-editing it.
- `scripts`: no change. `assets:portrait`, `assets:images`, `assets:joblog` stay.

### vite.config.js
- Line 32: `'supabase/**/*.test.js'` in `test.include`. DELETE. `chunkSizeWarningLimit` comment (line 15) mentions three only; no change.

### eslint.config.js
- Line 36: `files: ['vite.config.js', 'eslint.config.js', 'scripts/**', 'supabase/**']`. EDIT: remove `'supabase/**'`.
- Line 60: `{ name: '@supabase/supabase-js', message: LAZY_ONLY }`. DELETE.
- Lines 68-70: override block `files: ['src/scene/createScene.js', 'src/wall/supabaseWallClient.js']`. EDIT: keep only `'src/scene/createScene.js'` (three is still lazy-only and the override stays for it).

### Other config
- `index.html`: no change.
- `.gitignore`: no change.
- `scripts/`: `optimize-images.mjs` and `make-pixel-portrait.mjs` keep working. `prerender*.mjs` do not reference the wall.
- `public/`: nothing Paint- or Wall-specific.

---

## 9. Suggested order of work (for the implementer)

1. Delete the files in section 5 (DELETE list), including `supabase/`, `src/wall/`, `Paint`, `VisitorWall`, `Art`.
2. Remove the Paint/Wall/art wiring: `registry.js`, `DesktopIcons.jsx`, `osController.js`, `commands.js`, `achievements.js`, `pixelIcons.js` (BMP.paint, BMP.wall), `createApp.js`.
3. Scene: `createScene.js` (section 2 option 1), `textures.js` (drop `drawCork`, `CORK_SLOTS`, `PINS`), `hotspots.js`.
4. `png.js` trim (section 3).
5. Credit removal: `Resume.jsx`, `AboutOs.jsx`, `README.md`.
6. Update tests (section 5), 13 → 12 counts (section 4).
7. `package.json` and `npm uninstall`, `vite.config.js`, `eslint.config.js`, `.env.example`, `README.md`, `plan.md` note.
8. Run `npm run lint`, `npm test`, `npm run build`. The build includes the prerender step.
9. Outside the repo: Vercel env vars and the Supabase project (section 7).

---

## Open decisions for the owner
1. Corkboard: keep the brown board with the polaroid (recommended), or also remove the board and move the polaroid onto the wall (`textures`/`createScene` option 4)?
2. Trophy "Artist in Residence": remove (recommended; the count becomes 12), or keep as an unlockable with no trigger (not recommended)?
3. `design/revamp-lab.html`: keep the prototype page with its edh.dev rationale, or remove the credit lines?
4. `design/notes/plan.md`: add a removal note at the top (recommended), or rewrite history?
