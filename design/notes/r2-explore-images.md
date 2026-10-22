# R2 exploration: why project images look low quality in the OS

Read-only investigation. Only this file was written.

## Summary

The project images are shipped at 420 px wide, and that cap is applied in the build step. The full-resolution sources were downscaled in commit `6182961` (on `feat/website-revamp`, not main), and the OS then shows them larger than that. The fix is to regenerate from the high-res originals, and to size the output for the displayed size at 2x.

## Root causes (ranked)

1. **Shipped WebP is 420 px wide. This is the main cause (high confidence).**
   - `scripts/optimize-images.mjs:12` sets `const WIDTH = 420`, and `toWebp` runs `resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: 72 })`.
   - Every file in `public/img/projects/*.webp` is 420 px wide, and the sizes are 1.8–12 KB. Measured with `sips`: adstar 420x242, duonosaur 192x420, http 420x205, joblog 420x262, library 420x246, marletnests 420x237, menulens 420x213, recyclewise 420x225, whenareyoufree 420x206.
   - The inputs in `design/img/*.jpg` are already 420 px (or 192 px for duonosaur). So the shipped images were downscaled once in `6182961`, and the high-res originals were no longer used by the build.
   - Commit `f81ccf2` ("images updated - smaller size") had full-resolution WebPs at `public/images/*.webp`. I parsed the lossy WebP headers with `git cat-file` and the dimensions match the PNG originals (table below). Commit `6182961` then produced the 420 px set. So the detail was lost there, not in the display code.

2. **The OS displays the image much larger than 420 px (high confidence, amplifies #1).**
   - `src/styles/apps.css:19`: `.shot { width:100%; max-height:250px; object-fit:cover }`. In `src/os/apps/ProjectDetail.jsx:14` this is shown in a window that is `w: 600` (`src/os/registry.js:56`). With `.wb` padding of 18 px and a 2 px border, the image is about 560 logical px wide.
   - The OS DOM is 900x675 logical px (`src/core/constants.js:2-3`, `os.css:3`). It is CSS3D-scaled into the scene (`createScene.js:728`: `cssObj.scale.setScalar(2.6 / OS_W)`). `sceneMath.js:7-8` sets the screen to 2.6x1.95 world units, and `camDistance` fits that to the viewport height. So the OS is roughly `stage_height_css / 675` times its layout size (derived from the math, not measured). On a ~900 px tall viewport that is about 1.3x. Estimated on-screen width is about 745 CSS px.
   - Result: a 420 px source shown at about 745 CSS px is about 1.8x upscaled at DPR 1, and about 3.5x at DPR 2 (retina), where the browser needs about 1490 device px.
   - There is no `srcset`, no `sizes`, and the image is not sized for the largest case.

3. **Compression is aggressive on screenshots with text (medium).**
   - `quality: 72` on 420 px WebP, from JPGs that were already lossy. The resulting 2–12 KB files are very small for UI screenshots that contain text. The artifacts show most at small text and UI edges. This makes the upscaling in #2 look worse.

4. **Thumbnails in the Projects grid are cropped and slightly soft (low).**
   - `src/os/apps/Projects.jsx:13`: `<img width={420} height={263}>`. The CSS in `apps.css:17` uses `aspect-ratio:16/10; object-fit:cover`, so the 1.74:1 images are cropped and the width/height attributes do not match the CSS.
   - Cards are about 190 logical px wide (`minmax(150px,1fr)` inside a 640 px window), about 250 CSS px on screen. 420 px is enough at DPR 1 and a little soft at DPR 2.

5. **CSS3D rasterization (low, possible contributor).**
   - `createScene.js:668` sets `holder.style.willChange = 'transform'` while a camera tween is running (`ctrl.tw`). Chrome keeps the raster scale from the start of a `will-change` layer, so the OS can look blurry during the zoom. It is cleared when the tween ends.
   - The WebGL canvas uses `setPixelRatio(Math.min(dpr, 1.5))` (`createScene.js:167`). That cap does not apply to the CSS3D DOM, so the OS text and images are rasterized at the full device pixel ratio when static.
   - This does not explain bitmap images that are stored at too low a resolution. Fixing #1 and #2 matters more.

6. **Ruled out.**
   - No `image-rendering: pixelated`, dithering, or grayscale is applied to project images. `pixelated` only appears on the polaroid (`.pol img`), the Visitor Wall, achievement icons, the wallpaper, and the Paint/Snake canvases. `dither.js` is used only for the portrait (`scripts/make-pixel-portrait.mjs`).
   - Flat/phone mode does not explain it. `osHost.js` `fitFlat()` scales the OS with `transform: scale(k)`, where `k = min(W/900, H/675)`. Compact mode (phone) uses no transform. Both paths only magnify the same 420 px source.
   - The desk textures do not use project images. `src/scene/textures.js` and `createScene.js` load only `img/jay-px.png` (56x72, intentionally pixelated) and `img/jay.jpg` (249x320 fallback). The cork board draws visitor drawings at 66x66. Desk textures are not the cause.

## Dimensions: sources and current shipped files

Historical originals from `git cat-file`. The PNGs were removed from the working tree in `4ad01f3` (main), and the WebPs from `f81ccf2` were removed later.

| Project | Original PNG (last in `4ad01f3^`) | Full-res WebP (`f81ccf2`) | Shipped now (`public/img/projects`) |
|---|---|---|---|
| Duonosaur | 704x1538 (241 KB) | 704x1538 (34 KB) | 192x420 (4.7 KB) |
| HTTP | 3264x1598 (1.6 MB) | 3264x1598 (40 KB) | 420x205 (2.7 KB) |
| Library | 1772x1040 (1.4 MB) | 1772x1040 (19 KB) | 420x246 (1.9 KB) |
| MarletNests | 2736x1544 (5.2 MB) | 2736x1544 (247 KB) | 420x237 (12 KB) |
| MenuLens | 3042x1544 (873 KB) | 3042x1544 (43 KB) | 420x213 (2.2 KB) |
| RecycleWise | 3356x1798 (3.6 MB) | 3356x1798 (106 KB) | 420x225 (6.4 KB) |
| WhenAreYouFree | 1964x964 (273 KB) | 1964x964 (25 KB) | 420x206 (2.9 KB) |
| adStar | 2344x1354 (968 KB) | 2344x1354 (106 KB) | 420x242 (8.3 KB) |
| jewoolee (portrait) | 806x1340 (863 KB) | 806x1340 (43 KB) | not used directly (see note) |
| joblog | none (live capture, `scripts/capture-joblog.sh`) | none | 420x262 (2.2 KB, or the placeholder if capture failed) |

Notes:
- The originals are reachable with `git show 4ad01f3^:public/images/<Name>.png` (or `git cat-file -p 4ad01f3^:public/images/<Name>.png`). The WebPs are at `f81ccf2:public/images/<Name>.webp`.
- The files in `design/img/*.jpg` are 420 px JPG versions of the screenshots (added in `1c3faea` / `6182961`). They are not originals and should not be used as sources.
- The `jewoolee_edited` original (806x1340) is the owner's photo. The current portrait pipeline uses `design/img/jay.jpg` (249x320), which is very small. It is shown pixelated on purpose (56x72), so it is a lower priority.
- Duonosaur is a portrait screenshot (192x420 in design/img). The original is 704x1538, so it needs a portrait-aware crop.

## Concrete fixes (ranked)

1. **Regenerate the project images from the originals at 2x the displayed size.**
   - Source: the PNG originals above (or the `f81ccf2` WebPs, which are the same pixels).
   - Target widths: about 1120 px for `ProjectDetail` (`.shot` at ~560 logical px, 2x for retina) and about 560 px for the Projects grid thumbnails. Allow for the CSS3D scale (the on-screen size is about 1.3x logical), so 1200–1400 px is a safe ceiling. Keep aspect ratios, and do not enlarge beyond the original.
   - Change `scripts/optimize-images.mjs`: `WIDTH` to a list, for example `[560, 1120]`, and write `name-560.webp` and `name-1120.webp`. Use `quality` about 82–85 for screenshots (text needs it), or `nearLossless`/`effort: 6`. Confirm visually at 2x.
   - Keep `assets:images` as the script. Do not add new scripts.
2. **Add `srcSet` and `sizes` in the image components.**
   - `src/os/apps/ProjectDetail.jsx:14`: `srcSet="…-560.webp 560w, …-1120.webp 1120w" sizes="560px"`.
   - `src/os/apps/Projects.jsx:13`: `srcSet` with the 560 px variant, `sizes="200px"`.
   - `src/content/projects.js:96` (`projectImage`) currently returns a single URL. Add a helper that returns the srcset, and keep `projectImage` for the other call sites (`Bin.jsx:17`, `Resume.jsx:54`).
   - Fix the `Projects.jsx` `width`/`height` to match the 16:10 CSS, or drop them.
3. **Improve the `.shot` display.** Remove `max-height: 250px` or raise it, and use `object-fit: contain` so screenshots are not cropped. This is a layout change, so confirm the owner wants it.
4. **Optional: stop the blur during the zoom.** Set `will-change` only during the tween, which is already the case. If the blur persists, test with `will-change` removed on `#os-holder` and check Chrome's raster scale. Do not change the 900x675 layout size. It is the basis of the whole OS.
5. **Check the Chrome result by eye.** Open a project window at DPR 1 and DPR 2 after each change, and compare at the same zoom. Also check the flat/phone path.

## Files referenced

- `scripts/optimize-images.mjs` (WIDTH = 420, quality 72)
- `public/img/projects/*.webp` (shipped, 420 px)
- `design/img/*.jpg` (420 px JPG inputs)
- `src/os/apps/ProjectDetail.jsx`, `src/os/apps/Projects.jsx`, `src/os/apps/Bin.jsx`, `src/resume/Resume.jsx`
- `src/content/projects.js:96`
- `src/styles/apps.css:5,14-19`
- `src/os/registry.js:26,56`
- `src/core/constants.js` (OS_W 900, OS_H 675)
- `src/scene/createScene.js:167,668,728`
- `src/scene/sceneMath.js:7-8,37-42`
- `src/os/osHost.js` (`fitFlat`, `scale`)
- `src/styles/stage.css:9`, `src/styles/os.css:3`
- Commits: `f81ccf2` (full-res WebP, main), `4ad01f3` (PNGs removed, main), `0c66eb0` (PNGs added, main), `6182961` (420 px WebP pipeline, this branch)
