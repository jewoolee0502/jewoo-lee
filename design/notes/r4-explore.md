# Round 4 exploration: a MacBook Air laptop

Owner's request (2026-10-20): revamp the 3D laptop to look like a MacBook Air / Pro, more realistic and
more fun to look at.

Owner decisions:
- Model: **MacBook Air** (flat, thin, no speaker grilles on the deck). Colour: **Silver**.
- Lid: the owner's own glossy **"J" monogram** where the Apple logo sits (no Apple logo: trademark).
- Floppies stay as the retro twist, sliding into a **slim slot on the side** of the MacBook.
- **Laptop body only**: JAY-OS keeps its 90s look. The screen becomes **16:10** (OS about 1040×676).

## MacBook Air facts (web research, sourced)

| Model | W × D × H (closed) | Display | Source |
|---|---|---|---|
| Air 13" (M5) | 304.1 × 215 × 11.3 mm | 13.6", 2560×1664 (≈1.54:1), 224 ppi, rounded top corners, no notch on older Air (M2+ has a camera notch) | apple.com/macbook-air/specs |
| Air 15" (M5) | 340.4 × 237.6 × 11.5 mm | 15.3", 2880×1864 | same |
| Pro 14" | 312.6 × 221.2 × 15.5 mm | 14.2", 3024×1964, notch | apple.com/macbook-pro/specs |

- Flat-sided "box" design since 2022 (the wedge is gone). Rounded corners; radius not published.
- Finishes (Air): Sky Blue, Silver, Starlight, Midnight. No official hex values.
- Anodised aluminium: fine bead-blasted matte with a soft metallic sheen (iFixit via 9to5Mac on the finish).
- Backlit Magic Keyboard: 78 keys (ANSI), full-height 12-key function row, Touch ID top right,
  inverted-T arrows, black keys in a recessed well. Large Force Touch trackpad centred below.
- Ports (Air): two USB-C (Thunderbolt) on the left with MagSafe 3; headphone jack on the right.
  MagSafe LED: amber charging, green charged (support.apple.com).
- Clutch hinge; the lid opens to about 130° (user report, unverified). A thumb scoop in the front edge.
- Bezel ≈ 3.5 mm (2021 Pro figure); the M2+ Air has a camera notch in the top bezel.
- Not sourced (to be chosen by eye): lid/base thickness split, corner radii, key pitch (≈18–19 mm),
  trackpad size, colours (silver ≈ #c8ccd2–#d6d9dd), screen-off look (glossy near-black).

## Rendering research (three.js r128)

- r128 is the global-script era for examples; the repo imports `three` 0.128.0 from npm, so use the
  `three/examples/jsm/...` modules that ship in that package (check: RoundedBoxGeometry,
  RoomEnvironment, BufferGeometryUtils), not `three/addons`.
- Output: `renderer.outputEncoding = sRGBEncoding` (already set); ACESFilmicToneMapping exists in r128.
- Aluminium: MeshStandardMaterial metalness ≈ 1, roughness ≈ 0.35–0.45, colour ≈ #c8ccd2, lit by an
  environment map (RoomEnvironment through PMREMGenerator.fromScene, or a procedural canvas gradient).
  A tiny noise canvas as roughnessMap gives the bead-blast look. No anisotropy in r128.
- Shapes: RoundedBoxGeometry (segments 3–4) or an ExtrudeGeometry of a rounded-rect Shape with bevels.
- Keys: one InstancedMesh (~80 instances, setMatrixAt per key for presses, instanceColor if needed);
  key legends from one canvas atlas.
- Cheap screen glow on the keyboard: a tinted PointLight (exists today) or an additive gradient plane;
  avoid RectAreaLight and real-time shadows on phones; a blurred contact-shadow plane under the laptop.
- Delight: lid open eased, screen power-on fade, a sheen sweep across the lid, MagSafe LED, keyboard
  backlight glow.
- Mobile: merge static parts (BufferGeometryUtils.mergeBufferGeometries), keep triangles low, pixel
  ratio already capped at 1.5.

## Current laptop code (map)

- All laptop geometry is inline in `src/scene/createScene.js` (~L346–L431): base Box 3.0 × 0.16 × 2.1
  (CASE 0xcdd3da), deck plate, 39 keys + space/enter/backspace as separate Box meshes (each its own draw
  call, `keys` Map for `pressKey`), red nub, trackpad + 2 buttons, power button hotspot (`pbtn`), power LED,
  front floppy drive (SLOT in props.js:66, drive LED), sticky note, JAY-OS sticker, lid Box 3.0 × 2.25 × 0.1
  on a hinge at rig (0, 0.235, −0.70), bezel 2.74 × 2.08, mirror plane 2.6 × 1.95 (canvas 512×384),
  CSS3D anchor at (0, 1.12, 0.006), back-of-lid JAY logo, screen PointLight.
- Lid: `hinge.rotation.x = hingeAngle(lidT(z)) − peek`; hingeAngle π/2 (closed) → −10° (open).
- Screen ↔ OS: CSS3D object 900×675 px scaled 2.6/900; duplicated literals: sceneMath SCREEN_W/H
  (2.6/1.95), createScene L938 (2.6/OS_W), L415 mirror, L399 bezel, L398 lid, L417 anchor; OS_W/OS_H in
  constants.js (used by osHost, widenSize, drawMirror standby layout, flat fit). camDistance uses SCREEN_W/H.
- Depends on the laptop: POLAROID clears the open lid top (≈2.45; props.test), floppy lane/seat
  (floppy.js: LANE_Y 0.13, LANE_Z 1.75, SLIDE_X 2.9, APPROACH, SEATED z 1.19; floppy.test hard-codes base
  x ±1.5, front z 1.4), SLOT tests, HIT sizes, desk corners for the phone framing.
- Renderer: pixel ratio ≤ 1.5, sRGB output, no tone mapping, PCF shadows (moon light casts), no env map.
  Lights: hemisphere, moon directional, lamp point, screen point. ~95–100 meshes (laptop ~57).
- Interactions to keep: 12 hotspots (laptop, power button, 3 floppies, tags, mug, lamp, polaroid, sticky
  note, keyboard, window), hover glow (GLOW_K 0.2), lid peek 7°, pressKey from real typing, Konami disco,
  floppy insert → open app, LEDs (power, drive).
- Tests pinning the laptop: props.test.js, createScene.test.jsx (mocks three; checks constructor args),
  sceneMath.test.js, floppy.test.js, textures.test.js, hotspots.test.js, src/os/osHost.test.js (900×675).
- design/revamp-lab.html is the original prototype (the same laptop numbers); its build notes about
  R3F/GLB/GSAP are stale.
