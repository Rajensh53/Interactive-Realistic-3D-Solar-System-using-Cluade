# Plan 02: True-Scale Distances (Compact ↔ True Scale toggle)

> Step 0 of implementation: copy this plan to `Plans/02-True-Scale-Distances-Plan.md` (the user asked for it to live in the Plans folder, next to `01-Solar-System-Build-Plan.md`).

## Context

Today the scene is deliberately "compact". Orbits are spaced for legibility: Earth sits at 25 u and Neptune at 92 u, when true proportions would put Neptune at 752 u. Radii are eased toward the middle, and moon orbits are hand-tuned (for example, the Moon orbits 2.3 u from Earth). See the SCALE NOTE in `src/data/planets.js` and `SCENE` in `src/utils/planetUtils.js`. The user wants to see the **real** distances between the Sun, planets and moons.

Decision (confirmed with the user): keep the current view as **Compact** and add a **True Scale** mode behind a toggle. In True Scale, *every* body uses one scale for both distance and size, so it is physically honest. Planets become tiny from far away, so screen-space labels, markers and the selection ring make them findable, and clicking a planet flies the camera to it.

## Scale choice

`1 AU = 1,000 scene units` → `KM_TO_UNITS = 1000 / AU_KM`.

| Body | True-scale value |
|---|---|
| Sun radius | 695,700 km → **4.65 u** (current compact Sun is 5.0, so it barely changes) |
| Mercury orbit / Earth orbit / Neptune orbit | 387 u / 1,000 u / 30,070 u |
| Earth radius | 0.0426 u; Jupiter radius 0.478 u |
| Moon orbit | 384,400 km → 2.57 u from Earth (60 Earth radii) |
| Io / Callisto orbits | 2.82 u / 12.6 u from Jupiter |
| Titan orbit | 8.17 u from Saturn |

three.js builds `modelViewMatrix` in float64 on the CPU, so coordinates of about 30,000 u cause no visible jitter near a body.

## Implementation

### 1. Scale constants and layouts: `src/utils/planetUtils.js`
- Add `TRUE_SCALE = { UNITS_PER_AU: 1000, KM_TO_UNITS, OVERVIEW_CAMERA, MIN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE (~120,000), NEAR, FAR }`, alongside the existing `SCENE` (compact).
- Add a `getSceneConfig(mode)` helper that returns `SCENE` or `TRUE_SCALE`, so the camera code reads limits from one place.
- `orbitalPositionAt` stays unchanged. It already reads `body.semiMajor` and `body.semiMinor`, so it works as-is on a scaled body object.

### 2. True-scale body variants: `src/data/planets.js`, `src/data/moons.js`
- Derive a second array from the existing data, overriding only the scene-geometry fields. Nothing is hand-typed, so the values can't drift from the physical data:
  - Planet: `radius = diameterKm/2 · KM_TO_UNITS`, `semiMajor = semiMajorAU · 1000`, `semiMinor` via `semiMinorFromEccentricity`.
  - Sun: `radius = 695,700 · KM_TO_UNITS`.
  - Moon: `radius = diameterKm/2 · KM_TO_UNITS`, `orbitRadius = distanceFromParentKm · KM_TO_UNITS`.
- Export `PLANETS_TRUE`, `SUN_TRUE`, and `getMoonsFor(planetId, mode)`, plus a `getScaledBody(id, mode)` lookup. `getBodyById` keeps returning the canonical record, which the UI panel uses.
- Ring ratios (`ringInner`/`ringOuter`) multiply `radius`, so they scale automatically.
- Update the SCALE NOTE doc comment to describe both modes.

### 3. Mode state and toggle
- `src/hooks/usePlanetStore.js`: add `settings.scaleMode: "compact" | "true"` (default `"compact"`), using the existing `setSetting`.
- `src/components/ui/Controls.jsx`: add a "Compact / True Scale" toggle button next to the orbit and label toggles, following the same button pattern.
- Add a small hint when True Scale is active: "Distances and sizes to scale. Use the planet rail or labels to jump."

### 4. Scene uses the active layout
- `src/components/three/SolarSystem.jsx`: pick `PLANETS` or `PLANETS_TRUE` from `scaleMode` and pass it to `<Planet>` and `<Orbit>`. The keys stay the same `id`, so components update in place.
- `src/components/three/Sun.jsx`: read the Sun from the active mode instead of the `SUN` constant. The corona sprite and flares already derive from the radius.
- `src/components/three/Planet.jsx`: call `getMoonsFor(body.id, mode)`. `registerBody` already re-registers when the `radius` dependency changes.
- `Moon.jsx`, `MoonOrbit.jsx`, `Orbit.jsx`, `Rings.jsx`, `Atmosphere.jsx`, `CloudLayer.jsx`: no logic change needed, because they read `radius`, `orbitRadius` and `semiMajor` from the prop. Verify:
  - Moon hit proxy: `Math.max(moon.radius*1.8, 0.75)` would be far larger than the Moon's orbit in True Scale. Make the floor mode-dependent (e.g. `radius * 3` in True Scale).
  - Planet hit proxy: same check.

### 5. Finding tiny bodies
- `src/components/three/PlanetLabel.jsx`:
  - In True Scale, show planet labels persistently when the Labels setting is on, not just on hover. Labels are DOM, so they stay clickable and select the body. Moon labels appear only when the camera is within about 50× the moon's orbit radius of the parent, which avoids a pile-up over Jupiter from far away.
  - The offset `radius*1.35 + 0.6` has a fixed 0.6 u term, which is huge at true scale. Use a radius-relative offset in True Scale.
- `SelectionRing.jsx` already enforces a minimum pixel radius (`RING_MIN_PX`), so it works for sub-pixel bodies unchanged.
- Add a constant-pixel-size marker dot for each planet and moon in True Scale: a single-vertex `<points>` with `sizeAttenuation: false`, in the body's `fallbackColor`. It fades out once the real sphere is larger than about 6 px.

### 6. Camera: `useCameraControls.js`, `animationUtils.js`, `CameraController.jsx`, `App.jsx`
- **Framing** (`getBodyFraming`): replace the hard-coded Sun and Saturn distances with radius-based values:
  - Sun: `radius·3.6`.
  - Saturn: `radius·ringOuter·2.1`.
  - Others: keep the existing `radius·4.2` / `2.2` / `18`.

  In Compact mode these give the same numbers as today (Sun 18; Saturn ≈ 16.5).
- **Overview / limits**: use `getSceneConfig(mode)` everywhere `SCENE.*CAMERA*` is used today. The True Scale overview frames the inner system out to Mars (about camera `(0, 1200, 3200)`). Users zoom out, up to `MAX_CAMERA_DISTANCE`, to see the outer planets.
- **Long flights**: in True Scale, interpolate the spherical *radius* logarithmically (`exp(lerp(ln r0, ln r1, p))`) instead of linearly. Otherwise a 30,000 u → 0.2 u flight would spend the whole tween far away and then snap in. Also scale `getTravelDuration` on log distance, still clamped at 1.2–2.8 s (up to ~3.5 s in True Scale).
- **Depth precision**: enable `reverseDepthBuffer: true` in the Canvas `gl` props (three r185 supports it). It works with the existing custom `ShaderMaterial`s without shader edits.
  - Set the camera's `near`/`far` dynamically per mode: Compact keeps `0.1`/`1400`; True Scale uses about `near = clamp(distToTarget·0.001, 1e-4, 1)` and `far = 200,000`. Call `camera.updateProjectionMatrix()` whenever these change.
  - Fallback if `EXT_clip_control` is unavailable: `logarithmicDepthBuffer` plus the `logdepthbuf` shader chunks in the custom shaders (limbGlow, sunShader, SunCoronaSprite, Rings, StarField, SpaceEnvironment, SkyDome).
- **Mode switch**: when `scaleMode` changes, re-run the camera flow. With a selection, re-frame the selected body at its new-scale position; without one, tween to the new mode's overview.

### 7. Background environment
- `StarField` (320–620 u shell), `SkyDome` (800 u) and `SpaceEnvironment` nebula shells (740/860 u) represent "infinity". In True Scale, wrap them in a group that copies `camera.position` every frame, so the sky surrounds the camera wherever it is. Compact mode stays unchanged, with the group left at the origin.
- `CosmicDust` (a 16–176 u disc) is a composition effect sized for Compact. Hide it in True Scale so the real emptiness of space shows.

### 8. Orbit speeds (unchanged)
Periods stay compressed via `orbitTimeFromPeriod`, so both modes animate identically. Moon `orbitTimeSeconds` stays as-is. Distances are what change.

### 9. Dev bridge and data checks
- `src/utils/devBridge.js`: make `verifyPositions`/`verifyMoons` compare against the *active-mode* body (`getScaledBody(id, mode)`).
- `scripts/verify-data.mjs`: add a "True scale" section that checks:
  - `semiMajor / semiMajorAU === 1000` for every planet.
  - True radius equals `diameterKm/2·KM_TO_UNITS`.
  - Every moon's orbit radius is greater than its parent's true radius (Moon ≈ 60R, Io ≈ 5.9R, Titan ≈ 20R).
  - Mercury's perihelion (≈ 307 u) is clear of the Sun's radius (4.65 u).
  - True-scale orbits stay prograde and follow the same perihelion/aphelion maths as the existing checks, reusing their loop.

## Critical files
- `src/utils/planetUtils.js`: scale constants, `getSceneConfig`
- `src/data/planets.js`, `src/data/moons.js`: true-scale derived variants
- `src/hooks/usePlanetStore.js`, `src/components/ui/Controls.jsx`: mode toggle
- `src/components/three/SolarSystem.jsx`, `Sun.jsx`, `Planet.jsx`, `Moon.jsx`, `PlanetLabel.jsx`: active layout, labels, markers
- `src/hooks/useCameraControls.js`, `src/utils/animationUtils.js`, `src/components/three/CameraController.jsx`, `src/App.jsx`: camera limits, framing, log-radius flights, depth
- `src/components/three/StarField.jsx` / `SkyDome.jsx` / `SpaceEnvironment.jsx`: camera-anchored background
- `src/utils/devBridge.js`, `scripts/verify-data.mjs`: verification

## Verification
1. Run `node scripts/verify-data.mjs`: all checks pass, including the new True Scale section.
2. Run `npx vite build`: the build succeeds.
3. Drive the app in a browser (using the Playwright-core + Edge script from the previous session, with `window.__solar.select(id)` and a new `window.__solar.setScaleMode(mode)`):
   - Compact mode looks identical to today. Check with screenshots before and after the change.
   - True Scale overview: Sun and inner planets visible, with labels and markers for each planet.
   - Selecting Earth flies in smoothly (the log-radius interpolation). The Moon's orbit ring sits about 60 Earth radii out, and the Moon is visible.
   - Select Jupiter and then Neptune: flights complete, with no depth flicker between the planet, atmosphere and clouds, and Saturn's rings are correct.
   - Zoom out to max: Neptune's orbit is fully framed, and stars and nebula still surround the camera.
   - `__solar.verifyPositions()` / `verifyMoons()` report zero drift in both modes.
   - Toggling modes with and without a selection re-frames correctly, with no page errors in the console.
4. Check that the details panel's live distances are unchanged. They already use `semiMajorAU`, so they don't depend on the mode.
