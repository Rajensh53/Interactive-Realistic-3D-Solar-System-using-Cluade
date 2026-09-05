# Interactive Realistic 3D Solar System — Complete Build Plan

Based on: `Interactive Realistic 3D Solar System.md` (29 sections)
Confirmed decisions: **JavaScript + JSX** · **local texture files (downloaded)** · **full spec scope** (Galilean moons, Titan, ambient audio, nebula)

---

## 1. Architecture Overview

```
src/
  main.jsx                      # React root + Canvas mount
  App.jsx                       # Scene composition + UI overlay + error boundaries
  styles/globals.css            # Tailwind v4 entry + design tokens
  data/
    planets.js                  # All planet data (visual + real-world) — single source of truth
    moons.js                    # Earth's Moon + Galilean moons + Titan
  hooks/
    usePlanetStore.js           # Zustand store (selection, UI, audio, settings, quality)
    useCameraControls.js        # GSAP focus/return tweens + follow logic + idle drift
    useIdleDrift.js             # Idle detection → autoRotate
    useQualityTier.js           # Device detection + runtime frame monitor + downgrade
    useAudioEngine.js           # WebAudio ambient pad + master gain
    useIsMobile.js              # MatchMedia helper
  components/
    three/
      SolarSystem.jsx           # Orchestrator: time accumulator, planet instancing, registration
      Sun.jsx                   # Shader surface + corona + flares + point light
      Planet.jsx                # PBR mesh + rings + atmosphere + clouds + tilt group
      Moon.jsx                  # Orbiting body (Earth Moon, Galilean moons, Titan)
      Orbit.jsx                 # Elliptical path line (toggleable)
      StarField.jsx             # Instanced Points + twinkle shader
      SpaceEnvironment.jsx      # Nebula shader sphere, galaxy sprites, cosmic dust
      PlanetLabel.jsx           # drei <Html> label (distance fade, occlusion)
      CameraController.jsx      # OrbitControls + damping + spherical tweening
    ui/
      LoadingScreen.jsx         # Progress bar + "INITIALIZING SPACE ENVIRONMENT..."
      WelcomeOverlay.jsx        # "EXPLORE THE SOLAR SYSTEM / START EXPLORING"
      PlanetDetails.jsx         # Glassmorphism panel + stats + facts + prev/next
      PlanetNavigation.jsx      # Planet selector rail (bottom, mobile-scrollable)
      Controls.jsx              # Sound toggle, orbit lines, labels, credits
      AboutModal.jsx            # Credits + attribution (required by CC BY 4.0)
      ErrorFallback.jsx         # WebGL / asset error fallback screens
  utils/
    planetUtils.js              # Simulation math, planet registry, scale conversions
    animationUtils.js           # Easings, duration curves, camera path helpers
  public/textures/
    planets/                    # 13 downloaded maps (see §5)
    environment/                # milky-way sky dome
```

**Architecture rules (these make it fast AND smooth):**

1. **Zero per-frame React state.** All continuously changing values (orbit angles, planet positions, camera) live in refs and a mutable `planetRegistry` Map in `planetUtils.js`. React/Zustand state is only for discrete things: selection, panel open, settings.
2. **Deterministic orbits.** Planet position is a pure function of accumulated scene time: `angle = initialAngle + speed * sceneTime`. This makes camera-focus math, labels, and resume-after-pause all trivial and drift-free.
3. **Game loop owns time.** `SolarSystem.jsx` accumulates `sceneTimeRef += delta * timeScale` in `useFrame`; every body reads from it. Delta-time based, so motion is frame-rate independent (spec §6).
4. **Single source of data.** All numbers in `data/planets.js`; components never hardcode.

---

## 2. Scene Scale Model

Real proportions are unusable (Sun would be 15,000× bigger than Earth's orbit fits nothing). Standard approach: **two separate scales** — one for sizes, one for distances — curated for composition (spec §3 allows this).

### 2.1 Simulation constants (`planetUtils.js`)

- `EARTH_YEAR_SECONDS = 45` — an Earth orbit takes 45 real seconds.
- Orbital speed curve: `orbitTimeSeconds = EARTH_YEAR_SECONDS * periodYears ^ 0.7` — compresses the outer planets (a true Kepler Neptune orbit would take 2 hours to watch). Preserves speed ordering; real periods stay in the data for the info panel.
- Distance scale: `1 scene unit ≈ 5,983,915 km` (Earth at 25 units = 1 AU). Used only for the live "distance from Earth" readout.
- Sun focal offset for ellipses: `cx = a * e` (sun at the focus, so orbits are true ellipses with the Sun off-center).

### 2.2 Planet scene parameters (stored in `planets.js`)

| Planet   | Radius (u) | Orbit a (u) | Ecc.   | Tilt (°) | Spin (rad/s) | Period (yrs) | Init angle |
|----------|-----------:|------------:|-------:|---------:|-------------:|-------------:|-----------:|
| Sun      | 5.0        | –           | –      | –        | 0.004        | –            | –          |
| Mercury  | 0.38       | 14          | 0.206  | 0.03     | 0.05         | 0.241        | 0°         |
| Venus    | 0.95       | 19          | 0.007  | 177.4    | −0.03        | 0.615        | 90°        |
| Earth    | 1.0        | 25          | 0.017  | 23.44    | 0.75         | 1.0          | 210°       |
| Mars     | 0.53       | 32          | 0.093  | 25.19    | 0.78         | 1.881        | 290°       |
| Jupiter  | 3.5        | 46          | 0.049  | 3.13     | 1.6          | 11.86        | 340°       |
| Saturn   | 3.0        | 62          | 0.056  | 26.73    | 1.5          | 29.45        | 45°        |
| Uranus   | 1.5        | 78          | 0.046  | 97.77    | 0.9          | 84.02        | 120°       |
| Neptune  | 1.45       | 92          | 0.046→0.010 | 28.32 | 0.95        | 164.8        | 250°       |

Implementation note: tilt group wraps the spin mesh (tilt never changes while orbiting). Uranus at 97.77° literally rolls on its side — keep it, it's a wow moment. Venus spin negative (retrograde) + 177° tilt ≈ 180° flip: keep the tilt 177.4° and positive-looking spin so its faint texture isn't upside down confusion — both fine; document choice in code comment.

### 2.3 Moons (`moons.js`)

| Moon       | Parent  | Radius (u) | Orbit (u) | Orbit period (s) | Material (no texture available) |
|------------|---------|-----------:|----------:|-----------------:|--------------------------------|
| Moon       | Earth   | 0.27       | 2.3       | 45               | `2k_moon.jpg` texture          |
| Io         | Jupiter | 0.29       | 4.9       | 20               | sulfur color `#d9b25f`         |
| Europa     | Jupiter | 0.25       | 5.5       | 28               | ice color `#c8c2c0`            |
| Ganymede   | Jupiter | 0.41       | 6.5       | 40               | rock color `#8a7a6a`           |
| Callisto   | Jupiter | 0.38       | 7.8       | 60               | dark rock `#6b625c`            |
| Titan      | Saturn  | 0.40       | 5.1       | 55               | haze orange `#d8a05a` + glow   |

Moon orbits are circular (a=b), inclinations 0 for scene simplicity.

### 2.4 Real-world data (info panel, from NASA fact sheets)

| Planet   | Diameter   | Dist from Sun      | Gravity | Surface temp      | Day        | Year       | Moons |
|----------|-----------:|-------------------:|--------:|------------------:|-----------:|-----------:|------:|
| Mercury  | 4,879 km   | 57.9M km (0.39 AU) | 3.7     | −173 to 427 °C    | 58.6 days  | 88 days    | 0     |
| Venus    | 12,104 km  | 108.2M km (0.72 AU)| 8.87    | 465 °C            | 243 days (retro) | 225 days | 0  |
| Earth    | 12,742 km  | 149.6M km (1 AU)   | 9.81    | −88 to 58 °C      | 23.9 h     | 365.25 d   | 1     |
| Mars     | 6,779 km   | 227.9M km (1.52 AU)| 3.71    | −63 °C avg        | 24.6 h     | 687 days   | 2     |
| Jupiter  | 139,820 km | 778.5M km (5.2 AU) | 24.79   | −108 °C           | 9.9 h      | 11.9 yrs   | 95    |
| Saturn   | 116,460 km | 1.43B km (9.5 AU)  | 10.44   | −139 °C           | 10.7 h     | 29.4 yrs   | 274   |
| Uranus   | 50,724 km  | 2.87B km (19.2 AU) | 8.87    | −195 °C           | 17.2 h     | 84 yrs     | 28    |
| Neptune  | 49,244 km  | 4.50B km (30.1 AU) | 11.15   | −201 °C           | 16.1 h     | 165 yrs    | 16    |

Each planet gets 4 short fun facts (write these in Phase 1 from NASA/JPL pages). Example for Earth: "The only known world with liquid surface water"; "Earth's rotation is slowing ~1.7 ms per century"; "Earth orbits at 107,000 km/h"; "71% of the surface is ocean". **Second task of Phase 1 is writing the descriptions + facts for all 8 planets — full copy, no placeholders** (spec §27).

Fallback colors (used until textures load / if a texture file is missing): Sun `#ffcf6b`; Mercury `#9c8e82`; Venus `#e6c98a`; Earth `#2f6db5`; Mars `#c1592e`; Jupiter `#c9a178`; Saturn `#e0c08f`; Uranus `#9fd4e8`; Neptune `#4166e0`.

---

## 3. Key Technical Designs

### 3.1 Orbit motion (per-frame, in `Planet`/`Moon` `useFrame`)

```js
const angle = p.initialAngle + (2 * Math.PI * sceneTime) / p.orbitTimeSeconds;
const x = p.semiMajor * Math.cos(angle) + p.semiMajor * p.eccentricity; // sun at focus
const z = p.semiMinor * Math.sin(angle);                                // b = a·√(1−e²)
group.position.set(x, 0, z);
mesh.rotation.y += p.spinSpeed * delta;   // inside tilt-wrapped mesh
```
Orbit path rendered as a `THREE.Line` (`<line>` in R3F) from the same params — visual proof the math matches.

### 3.2 Camera focus system (the heart of the premium feel)

State machine in `useCameraControls`: `idle → traveling → following`.

- **Travel**: GSAP tween on a spherical proxy `{radius, theta, phi}` around the target, not on `camera.position` directly. Spherical interpolation means the path **can never pass through the planet** and is naturally curved. Duration `clamp(0.9 + dist/40, 1.2, 3.0)` s, `power3.inOut` (spec §9/§25).
- **Moving target**: planets orbit during the tween. Every frame compute the target's *current* position from `planetRegistry` (same deterministic function as §3.1 — no prediction error), so the camera lands on the planet, not where it was.
- **Arrival**: `orbitControls.target` lerps to planet position each frame (damped follow). `minDistance = planetRadius * 2.2`, `maxDistance = planetRadius * 18` while focused; controls re-enabled only after arrival.
- **During travel**: `controls.enabled = false` (spec §9 Step 1), planet gets a highlight ring + subtle glow pulse.
- **Return**: same tween back to `(0, 32, 105)`.
- **Idle drift**: 8 s of no pointer activity → `controls.autoRotate = true` at speed 0.12 (extremely subtle, spec §15); any `controls 'start'` event or interaction stops it, timer resets. `prefers-reduced-motion` disables it entirely.

### 3.3 Sun (spec §4)

- **Surface**: custom `ShaderMaterial` on a 5-unit sphere — animated fbm noise modulating brightness + UV flow over `2k_sun.jpg` (granulation/fire feel), `toneMapped: false`, emissive boosted above 1 so bloom catches it but nothing else.
- **Corona**: additive sprite (procedural radial-gradient canvas texture — no download needed), ~1.6× radius, slow pulse.
- **Flares**: 150-point particle system, particles re-emitted on random direction/time — occasional subtle jets.
- **Light**: `pointLight` at origin (intensity ~2.2, `decay: 0`), casts on Mercury–Mars visibly (spec: "light source" + "Point light affecting nearby planets").
- Bloom: `luminanceThreshold: 1.0`, `mipmapBlur: true`, intensity ~0.9 — Sun blooms, planets don't wash out (spec §18 "avoid excessive").

### 3.4 Planet realism (spec §5)

| Planet   | Materials stack                                   |
|----------|---------------------------------------------------|
| Mercury  | Standard, bumpy crater map look via high roughness |
| Venus    | Yellow-orange PBR + emissive haze shell ✕0.15      |
| Earth    | Day map + **night lights** (emissiveMap nightmap, day-lit side driven by shader or `lights` trick) + transparent cloud sphere rotating faster + subtle fresnel atmosphere glow (blue) |
| Mars     | Red PBR, roughness 0.9                            |
| Jupiter  | Banded map (texture has bands), slight emissive; Great Red Spot already on `2k_jupiter.jpg` |
| Saturn   | Map + **transparent rings** (`2k_saturn_ring_alpha.png`, DoubleSide, alphaTest ~0.1, receives tilt) — ring shadow faked with a subtle dark semi-transparent disc just above the surface hemisphere (cheap, avoids real shadow maps) |
| Uranus   | Pale cyan, near-vertical axis (97.77°)             |
| Neptune  | Deep blue + faint cloud emissive                   |

All: `flatShading: false`, roughness/physical params per planet; atmosphere = backside sphere with fresnel shader (classic, cheap, used by everyone).

### 3.5 Star field & environment (spec §16/§17)

- **Stars**: one `THREE.Points` with custom ShaderMaterial — attributes: `position`, `size`, `phase`, `color`. Vertex shader: perspective size attenuation; fragment: soft circular falloff + twinkle `0.75 + 0.25·sin(t·1.5 + phase)`. Desktop 10,000 stars / mobile 4,000. Whole field in a group rotating at 0.0005 rad/s. **No per-star components.**
- **Sky dome**: `2k_stars_milky_way.jpg` on an inverted sphere (radius 450), BackSide, subtle.
- **Nebula**: procedural — 2–3 large spheres with fbm-noise fragment shader, additive blending, opacity 0.05–0.12, purple/teal. Zero assets, cheap, and can't look tiled.
- **Galactic dust**: 2,000-point additive Points cloud, slow drift.
- Total scene fits in far plane 1000, camera far 1200.

### 3.6 Post-processing (spec §18)

EffectComposer → Bloom → DoF (High tier only, **active only while `traveling`** — fades in/out on travel start/end) → Vignette (0.25) → ToneMapping (ACES).
Mobile/low tier: bloom at half resolution, no DoF, strictest when `dpr ≤ 1.5` or mobile UA (spec: "automatically scale down").

### 3.7 Store shape (`hooks/usePlanetStore.js`)

```js
{
  appState: 'loading' | 'intro' | 'exploring' | 'planet-detail',
  selectedPlanetId: null,
  cameraPhase: 'idle' | 'traveling' | 'following',
  qualityTier: 'high' | 'medium' | 'low',
  settings: { orbitLines: true, labels: true, idleDrift: true },
  audio:    { enabled: false, volume: 0.5, started: false },
  selectPlanet(id) / clearSelection() / setAppState() / setCameraPhase()
  setQuality(tier) / toggleSetting(k) / setVolume(v) / startAudio()
}
```

### 3.8 Audio (spec §19)

Procedural WebAudio ambient pad (zero asset downloads, no licensing issues): 2 detuned sine drones (55 Hz, 55.5 Hz) + filtered pink-noise whoosh, LFO on filter cutoff → slow-evolving "space atmosphere". Master gain node driven by store volume. **Never auto-plays:** engine starts only on `START EXPLORING` click (satisfies §19 AND the browser user-gesture requirement). Sound toggle + volume slider in `Controls.jsx`. Optional hook: if the user later drops `ambient.mp3` in `public/audio/`, the engine swaps to it — 5-line change.

### 3.9 Quality tiers & runtime adaptation (spec §22)

| | High | Medium | Low (mobile) |
|---|---|---|---|
| Pixel ratio cap | 2 | 1.75 | 1.25 |
| Stars / dust | 10k / 2k | 7k / 1.5k | 4k / 600 |
| DoF | travel-only | off | off |
| Bloom res | full | full | half |
| Label occlusion | on | on | off |
| Anisotropy | 8 | 4 | 2 |

Detection: mobile UA + `navigator.hardwareConcurrency` + `deviceMemory`. **Runtime downgrade**: frame-time monitor in `useQualityTier` — if avg frame time > 22 ms over a 5 s window, step down one tier (no upgrade, avoids oscillation). Reuse `AdaptiveDpr` from drei as a second safety net.

### 3.10 Loading flow

`LoadingScreen` (fixed overlay) drives React Suspense: all textures loaded via `useTexture` inside a `<Suspense>` boundary; `useProgress` gives percentage (with the fake-but-frame-perfect trick of weighing items). Copy: "SOLAR SYSTEM · INITIALIZING SPACE ENVIRONMENT..." + progress bar + %. Fade-out (Framer Motion, 800 ms) → `WelcomeOverlay` ("EXPLORE THE SOLAR SYSTEM" / START EXPLORING) → `appState: 'exploring'`. Scene hidden until essential assets ready (spec §20). Missing texture → per-planet fallback color + warning toast, not a crash (spec §28).

### 3.11 UI design language (spec §12)

Tailwind v4 `@theme` tokens: glass surfaces (`bg-white/5 backdrop-blur-xl border-white/10`), text `#e2e8f0`, accent cyan `#38bdf8` + warm amber `#fbbf24` for highlights, Orbitron (headings/numbers) + Inter (body) via `@fontsource` (self-hosted, no external requests). Everything thin, blurred, minimal — no neon storms. Buttons: ghost with 1px borders, focus-visible rings, `aria-label`s everywhere.

---

## 4. Texture Manifest (user downloads — §5 builds on these)

Source: **Solar System Scope** (CC BY 4.0 — attribution is REQUIRED; goes in About modal + footer).
URLs: `https://www.solarsystemscope.com/textures/download/<filename>` → save to `public/textures/planets/`:

```
2k_mercury.jpg  2k_venus_atmosphere.jpg  2k_earth_daymap.jpg  2k_earth_clouds.jpg
2k_earth_nightmap.jpg  2k_mars.jpg  2k_jupiter.jpg  2k_saturn.jpg
2k_saturn_ring_alpha.png  2k_uranus.jpg  2k_neptune.jpg  2k_moon.jpg  2k_sun.jpg
```
→ save to `public/textures/environment/`: `2k_stars_milky_way.jpg`

Quick download (Git Bash, run from project root — tools exist and work everywhere):
```bash
mkdir -p "public/textures/planets" "public/textures/environment"
BASE="https://www.solarsystemscope.com/textures/download"
for f in 2k_mercury.jpg 2k_venus_atmosphere.jpg 2k_earth_daymap.jpg 2k_earth_clouds.jpg 2k_earth_nightmap.jpg 2k_mars.jpg 2k_jupiter.jpg 2k_saturn.jpg 2k_saturn_ring_alpha.png 2k_uranus.jpg 2k_neptune.jpg 2k_moon.jpg 2k_sun.jpg; do curl -sL -o "public/textures/planets/$f" "$BASE/$f"; done
curl -sL -o "public/textures/environment/2k_stars_milky_way.jpg" "$BASE/2k_stars_milky_way.jpg"
```
Total ≈ 40 MB. Can run any time before Phase 3 — the app works without them via fallback colors, so it never blocks the build.

> **Superseded in Phase 3.** This inline loop shipped as [`scripts/fetch-textures.sh`](../scripts/fetch-textures.sh) instead: idempotent, `--retry 3`, and it verifies magic bytes so an HTML error page saved under a `.jpg` name is caught rather than rendering as a grey sphere. Actual total is **6.5 MB**, not 40 MB.

Data source for panel text: NASA (public domain) — no attribution required, but add "Data: NASA".

---

## 5. Phases (ordered for efficiency — a runnable, impressive demo exists at every checkpoint)

> **Rationale for the order:** data → core scene → interaction → camera → UI → polish. Camera focus and interaction come BEFORE visual polish because the "feel" is the riskiest, hardest-to-retrofit part. Effects/audio/moons are additive and land last, on a stable base. Each phase ends with a checkpoint you can actually see in the browser.

### Phase 0 — Scaffold ✅ DONE
Vite + React (JS) project in the working directory. **Actual pinned versions installed** (all peer-deps verified compatible, 0 vulnerabilities):

| Package | Version | | Package | Version |
|---|---|---|---|---|
| react / react-dom | 19.2.8 | | vite | **8.2.2** |
| three | 0.185.1 | | @vitejs/plugin-react | 6.1.1 |
| @react-three/fiber | 9.7.0 | | tailwindcss + @tailwindcss/vite | 4.3.3 |
| @react-three/drei | 10.7.8 | | gsap | 3.15.0 |
| @react-three/postprocessing | 3.1.1 | | zustand | 5.0.15 |
| postprocessing | 6.39.4 | | motion (ex framer-motion) | 13.1.1 |
| @fontsource/orbitron, inter | 5.3.0 | | | |

Deviations from the original plan text, and why:
- **Vite 8, not 7** — 8.2.2 is current stable; `@vitejs/plugin-react@6` *requires* `vite ^8`, so 7 would have forced an older plugin.
- **Vite 8 uses Rolldown**, which rejects the *object* form of `build.rollupOptions.output.manualChunks` outright (`TypeError: manualChunks is not a function`). The function form builds cleanly — but see Phase 2: it does not actually split anything. Chunking now uses Rolldown's native `advancedChunks.groups`.
- **Fonts imported as `latin-*` subsets** (`@fontsource/orbitron/latin-500.css`) — the default entrypoints emit cyrillic/greek/vietnamese cuts we never serve. Cut CSS 24.6 → 18.1 kB.
- `motion/react` is the import path for UI animation (framer-motion's current package name).

Files created: `package.json`, `vite.config.js`, `index.html`, `.gitignore`, `.claude/launch.json`, `src/main.jsx`, `src/App.jsx`, `src/styles/globals.css` (Tailwind v4 `@theme` tokens + `.glass-panel` / `.label-caps`), `src/components/ui/ErrorFallback.jsx` (`isWebGLAvailable()`, `WebGLUnavailable`, `SceneError`), plus the full folder tree from §1.

**Checkpoint — verified in browser:** dev server clean on :5173; page renders deep-space gradient at `#03040a`; Orbitron resolves on headings and all 6 font faces load; Tailwind tokens (`bg-space-950`, `text-ink-100`, `font-display`) all resolve; no console errors; no horizontal overflow down to 349 px; `npm run build` passes (192 kB JS / 18 kB CSS).

### Phase 1 — Data layer
- `data/planets.js`: full objects per spec §24 schema, every field from §2.2/§2.4 (id, name, category, description, radius, distance, semiMajor, semiMinor, eccentricity, orbitalPeriodYears, orbitTimeSeconds, initialAngle, rotationSpeed, tilt, moons count/names, texture paths, fallbackColor, roughness, realDiameter, realDistanceAU, realDistanceKm, gravity, temperature, dayLength, yearLength, orbitalVelocityKmS, facts[4]).
- `data/moons.js` (§2.3). `utils/planetUtils.js`: scale constants (§2.1), position-at-time function, `planetRegistry` (Map: id → {group, radius, worldPos}), distance-from-Earth converter.
- **Write all descriptions + 4 fun facts per planet.** No placeholders (spec §27).
**Checkpoint:** `node` one-liner imports `planets.js` and computes today's Mercury position without NaN; data exports clean.

### Phase 1 — Data layer ✅ DONE
Files: [`src/utils/planetUtils.js`](../src/utils/planetUtils.js), [`src/data/planets.js`](../src/data/planets.js), [`src/data/moons.js`](../src/data/moons.js), [`scripts/verify-data.mjs`](../scripts/verify-data.mjs) (`npm run verify:data`).

- `planetUtils.js` is dependency-free (imports nothing from `data/`) so `planets.js` can import its helpers with no import cycle. Contains `SCENE` constants, `orbitTimeFromPeriod`, `semiMinorFromEccentricity`, `orbitalPositionAt` (allocation-free, mutates an `out` object), `realPositionAt`, `distanceBetweenKm`, `formatDistanceKm`, and the `bodyRegistry` Map.
- Derived fields (`semiMinor`, `orbitTimeSeconds`, `initialAngle`, `axialTilt`) are **computed** from the source values at module load, not hand-typed, so they cannot drift out of sync.
- All 8 planet descriptions + 4 fun facts each + Sun's — written, no placeholders. Real-world figures from NASA fact sheets.

**Corrections made to §2 of this plan while implementing:**
- **Retrograde is encoded by axial tilt alone.** The §2.2 table listed Venus with a *negative* `rotationSpeed` **and** a 177.4° tilt — those cancel, rendering Venus prograde. All bodies now use a positive spin; Venus (177.36°) and Uranus (97.77°) are tilted past vertical, which is what makes them read as backwards. Same reasoning applies to Uranus, whose real rotation is also retrograde.
- **Neptune eccentricity 0.0113** (the table's "0.046→0.010" was an unresolved copy of Uranus's value). All eccentricities now use real measured values.
- **`KM_PER_SCENE_UNIT` was dropped.** §2.1 proposed converting scene units to km at a fixed ratio, but scene distances are *non-linearly* compressed (Jupiter sits at 1.84 AU-equivalent, not 5.2), so that conversion would have printed badly wrong distances. Instead `realPositionAt` re-evaluates the same orbital angle against real `semiMajorAU` values. Verified against reality: Mars reads 59.8M–396.3M km (true range ≈54.6M–401M), Jupiter 593.7M–963.3M (true ≈588M–968M).
- **Documented simplification:** orbital angle advances at a constant rate, so bodies do not accelerate at perihelion per Kepler's second law. Orbit *shape* is a true Sun-at-focus ellipse; only the timing is uniform.
- Moon counts are IAU-confirmed totals as of 2025 (Jupiter 97, Saturn 274) and noted in-file as a moving snapshot.

**Checkpoint — `npm run verify:data` passes 30 checks:** no missing fields or NaN in any derived value; every orbit's perihelion/aphelion matches `a(1±e)` to within 0.02 u across 400 samples; angular momentum `L_y > 0` at every sample of every orbit (prograde, never reversing); orbit periods strictly increase outward; Earth's year is exactly 45 s; distance readouts within astronomical bounds; prev/next navigation wraps correctly. `npm run build` still clean.

### Phase 2 — Core animated scene
- `App.jsx` → `<Canvas>` (camera `[0, 32, 105]`, fov 60, far 1200, `dpr={[1, 2]}`), `gl={{ antialias: true, powerPreference: 'high-performance' }}`, `<color attach="background">`.
- `SolarSystem.jsx`: `sceneTimeRef` accumulator + `<Suspense>` around bodies.
- `Sun.jsx`: basic emissive sphere + pointLight (full shader comes Phase 7).
- `Planet.jsx`: fallback-color materials, tilt group, registry registration, delta-time orbit/spin.
- `Orbit.jsx`: elliptical lines. `Moon.jsx`: Earth's Moon. `StarField.jsx`: twinkling Points.
- `CameraController.jsx`: OrbitControls, `enableDamping: true, dampingFactor: 0.05, minDistance: 8, maxDistance: 220, enablePan: true`.
- Basic bloom (EffectComposer) so the Sun already looks hot.
**Checkpoint:** all 9 bodies orbit and spin smoothly at 60 FPS; dragging/zooming works; Mercury visibly eccentric.

### Phase 2 — Core animated scene ✅ DONE
Files: [`src/App.jsx`](../src/App.jsx), [`SolarSystem.jsx`](../src/components/three/SolarSystem.jsx), [`Sun.jsx`](../src/components/three/Sun.jsx), [`Planet.jsx`](../src/components/three/Planet.jsx), [`Moon.jsx`](../src/components/three/Moon.jsx), [`Orbit.jsx`](../src/components/three/Orbit.jsx), [`StarField.jsx`](../src/components/three/StarField.jsx), [`CameraController.jsx`](../src/components/three/CameraController.jsx), plus dev-only [`DevProbe.jsx`](../src/components/three/DevProbe.jsx) and [`devBridge.js`](../src/utils/devBridge.js).

- **Deterministic clock, not a delta accumulator.** The plan said `sceneTimeRef` accumulator; what shipped is a module-level `simulationClock` advanced by one `SimulationClock` component at `useFrame` priority **-1**. R3F registers `useFrame` callbacks in layout-effect order — children before parents — so without a negative priority every body would read the *previous* frame's time. Delta is clamped to 0.1 s so a backgrounded tab returning after 30 s doesn't teleport planets through a third of an orbit.
- **Zero per-frame React state.** Positions are written straight to `object3D.position` from a module-level scratch object (`_pos`); nothing allocates inside the render loop.
- `Orbit.jsx` generates its line from `orbitalPositionAt` — the exact function the planet uses — so the drawn ellipse cannot disagree with the body travelling it.
- `Sun.jsx` uses `pointLight` with **`decay={0}`**: physically-correct inverse-square falloff over 92 units would leave Neptune unlit. Sun color is multiplied 2.6× with `toneMapped={false}` so a `luminanceThreshold` of 1 makes the Sun — and only the Sun — bloom.
- `StarField.jsx` is one `Points` object, 10 000 stars, **one draw call**, twinkling in a GLSL vertex shader from a per-star `aPhase` attribute (no CPU work per star). Placement uses a mulberry32 seeded PRNG so the sky is identical every reload, and samples `cosPhi` uniformly to avoid clustering at the poles.

**Deviations from the plan's Phase 2 spec:**
- Camera `far` is **1400**, not 1200 — the star shell sits beyond 1200 and was being clipped.
- `maxDistance` is **260**, not 220, to keep Neptune's 93-unit aphelion comfortably framed; polar angle is clamped to `[0.08, π−0.08]` so the camera can't flip through the poles. `CameraController` is a `forwardRef` so Phase 5 can drive it.
- `Moon.jsx` and all 6 moons were built now rather than deferred to Phase 8 — the hierarchy (inclination group → orbit group → spin mesh) was cheaper to get right alongside `Planet.jsx` than to retrofit.
- **`build.rollupOptions.output.manualChunks` does not work under Rolldown.** The Phase 0 note claimed the function form fixed it. It runs without error, but Rolldown's compat shim silently folds the groups back together — grepping the built chunks showed three.js inside the `r3f` chunk, with no `three` chunk emitted at all. Replaced with Rolldown's real `advancedChunks.groups` API, which does split: `three` 724 kB, `r3f` 265 kB, `react` 178 kB, app `index` **20.6 kB**. Editing a component now invalidates 8 kB of gzipped cache instead of 264 kB.

**Checkpoint — verified in the running browser, not by eye:**
- **Scene graph matches the maths exactly.** `verifyPositions()` compares every planet's *rendered* world position against `orbitalPositionAt` — `maxDrift: 0` at both `t = 123.456` and `t = 987.861`.
- **Orbits are true Sun-at-focus ellipses.** `measureOrbit()` reads each orbit line's GPU position buffer: traced radius swings between `a(1−e)` and `a(1+e)` and the geometric centre sits `a·e` off the origin, on the +x axis, with `centreOffsetZ` exactly 0 — all 8 planets, worst error **0.0006 u** (float32 rounding).
- **Mercury is visibly eccentric:** perihelion 11.122 u → aphelion 16.878 u, a 52 % radial swing, centre offset 2.878 u.
- **Drag and zoom work.** Synthetic pointer drag swung azimuth 0° → −37.7°; wheel pulled the camera 109.8 → 89.4 u. Both distance clamps saturate correctly (7.999 and 259.997 — the damping asymptote) instead of overshooting.
- **Frame cost, measured synchronously.** `requestAnimationFrame` is throttled whenever the pane loses focus (`visibilityState: "visible"`, `hasFocus: false`, 0 frames in 3 s), so frame *rate* is unmeasurable from a probe. `benchmark()` instead renders 180 frames back-to-back and forces a GPU drain with a `readPixels` stall: **0.69–0.85 ms per frame** for 27 draw calls / 39 504 triangles / 10 000 points — roughly 20× under the 16.7 ms budget for 60 FPS, before the bloom pass. Real sustained FPS on a focused window is the one Phase 2 claim not directly measurable here; it is re-checked on real hardware in Phase 10.
- Axial tilts verified as applied in the scene graph (Uranus 97.77°, Venus 177.36° — zero error on all 8); all 6 moons sit at exactly their configured orbital radius; `findNaN()` clean; census = 18 meshes, 8 orbit lines, 1 point cloud of 10 000 stars, 2 lights, 14 bodies registered.
- Zero console errors. One benign upstream warning: `THREE.Clock ... deprecated, use THREE.Timer` — emitted from inside @react-three/fiber, not our code.

### Phase 3 — Textures + realism ✅ DONE
Files: [`scripts/fetch-textures.sh`](../scripts/fetch-textures.sh), [`textures.js`](../src/data/textures.js), [`textureUtils.js`](../src/utils/textureUtils.js), [`usePlanetMaterial.js`](../src/hooks/usePlanetMaterial.js), [`Planet.jsx`](../src/components/three/Planet.jsx), [`Rings.jsx`](../src/components/three/Rings.jsx), [`Atmosphere.jsx`](../src/components/three/Atmosphere.jsx), [`CloudLayer.jsx`](../src/components/three/CloudLayer.jsx), [`SkyDome.jsx`](../src/components/three/SkyDome.jsx), [`LoadingScreen.jsx`](../src/components/ui/LoadingScreen.jsx), [`Sun.jsx`](../src/components/three/Sun.jsx), [`Moon.jsx`](../src/components/three/Moon.jsx).

- **A loader that degrades instead of throwing.** drei's `useTexture` throws into an error boundary on a 404, which would take the whole canvas down — spec §28 requires falling back to a flat colour. `textureUtils.js` is a module-level cache whose promises *never reject*: a failed file logs a warning, records itself in `failures`, and resolves. `getTexture(url)` returns `null` and the material keeps `fallbackColor`. One Suspense point (`useTexturesReady()` in `SolarSystem`) throws a single `Promise.all`, so there is no load waterfall.
- **Per-file colour space.** Albedo, night and ring maps are `SRGBColorSpace`; `2k_earth_clouds.jpg` is `NoColorSpace` because it is consumed as an `alphaMap` (a mask, not a colour) and an sRGB transfer curve would visibly thin the cloud edges. Anisotropy 8 on every map — three.js clamps to the hardware max at upload.
- **Earth's city lights respect the terminator.** `usePlanetMaterial` patches `MeshStandardMaterial` via `onBeforeCompile`: a world-space normal varying is added in the vertex stage, and `<emissivemap_fragment>` is followed by `totalEmissiveRadiance *= 1.0 - smoothstep(-0.15, 0.25, solarFacing)`. This keeps full PBR lighting rather than replacing it. `customProgramCacheKey` returns `"planet-night-lights"` so the patched program is cached separately from the stock one.
- **Ring UVs are rewritten, not stock.** `2k_saturn_ring_alpha.png` is a **2048 × 125 radial strip**; `RingGeometry`'s default UVs map it as a square and smear the bands into mush. Every vertex's UV is recomputed as `(r − inner) / (outer − inner)` on U with V pinned to 0.5, which puts the Cassini division at its true radius. The material is deliberately `meshBasicMaterial` — the Sun is edge-on to the ring plane, so a shaded annulus would render nearly black.
- **The clouds use `alphaMap`, not `map`.** The cloud image is white-on-black; as an albedo it would paint *black* clouds over the oceans.

**Deviations from the plan's Phase 3 spec:**
- **`scripts/fetch-textures.sh`** replaces the inline `curl` loop from §4. Idempotent (skips files already over an 8 kB floor), `--retry 3`, and verifies magic bytes — an HTML error page saved as `.jpg` is caught and deleted rather than silently rendering as a grey sphere.
- **The texture set is 6.5 MB, not the ~40 MB §4 estimated.** All 14 files at 2048×1024.
- **`SkyDome` shipped now rather than in Phase 7** — the Milky Way panorama was already in the manifest and being preloaded, so leaving it unused made no sense. Radius 800: outside `StarField`'s 320–620 shell, inside the camera's 1400 far plane.
- **Saturn's ring shadow is deferred to Phase 7** with the rest of the lighting polish.
- **The Sun's corona was rebuilt here rather than in Phase 7.** It was a flat-opacity `meshBasicMaterial` shell with no falloff whatsoever, so at close range its own 32-gon silhouette was visible as a hard-edged polygon. It now shares `Atmosphere` (see below). The sprite, flares and animated fbm surface remain Phase 7.
- **`build.rollupOptions.output.advancedChunks` → `codeSplitting`.** Vite 8.2 warns on the older spelling. Renamed; the emitted chunk hashes are byte-identical, so it is purely cosmetic.

**The atmosphere shader was wrong twice before it was right** — worth recording, because both failures looked plausible:
1. A bare Fresnel term, `pow(1 − |dot(N,V)|, p)`, is **maximal at the shell's own silhouette** and dimmest where it meets the planet — exactly inverted. With a back-facing shell the only visible fragments are the annulus between the planet's limb and the shell's edge, so this drew Venus a hard-edged disc floating in space rather than a halo. Fixed by windowing with `smoothstep(0, limb, facing)`, where `limb = √(1 − 1/scale²)` is the value of `|dot(N,V)|` at which the shell crosses the planet's silhouette.
2. That fixed the outer edge but left a **step at the limb**: a `BackSide` shell has its whole inner half depth-culled behind the planet, so the glow stopped dead at the planet's edge. Switched to `FrontSide` — the near hemisphere spans the disc *and* the annulus as one continuous surface, so the falloff crosses the limb seamlessly and bleeds inward the way limb brightening actually does.
- `uNorm` normalises by the **numerically sampled** peak, not an analytic one: the window is still climbing while the Fresnel term is already falling, so the maximum lands inside the annulus, overshooting the value at the limb by ~2.4× at scale 1.35. `intensity` therefore means peak brightness for any shell thickness. A `SOLAR_MASK` define drops the day/night term for self-luminous bodies, which is what lets the Sun's corona reuse the component.

**Checkpoint — verified in the running browser:**
- **All 14 textures load; `textureFailures()` is `[]`.** Every map reports 2048×1024, `colorSpace: "srgb"`, `anisotropy: 8`, and `verifyMaterials()` reads them off the live scene graph rather than trusting the data.
- **Earth** carries `nightLightPatch: "planet-night-lights"`, the nightmap as `emissiveMap`, `emissiveIntensity` 1.15, one extra layer (clouds) and an atmosphere. **Saturn** has one extra layer (rings). Jupiter/Saturn/Uranus/Neptune carry their `emissiveBoost`.
- **Screenshots confirm:** Saturn's rings with a visible Cassini division and correct front/behind occlusion; Jupiter's full band structure with festoons; Earth's day side (Africa, Arabia, the Mediterranean) under a distinct cloud layer with a thin blue limb; Earth's night side with city lights across North America and East Asia, **fading in exactly at the terminator**; Venus's haze blending continuously across the limb; the Sun's corona as a smooth graded halo.
- **Tilts exact on all 8** — Uranus 97.77°, Venus 177.36°, zero error. `verifyPositions()` drift 0; `verifySunDirection()` unit length and zero error on all 8; `findNaN()` clean.
- **Frame cost 0.692 ms** at the opening framing (27 draw calls, 44 112 triangles, 10 000 points) — 1446 FPS of headroom on the base pass, before postprocessing.
- **Real sustained frame rate, finally measurable.** Phase 2 could only measure frame *cost*, because `requestAnimationFrame` is throttled whenever the pane loses focus. With the pane focused, `stats()` reports **144.9 FPS** — median 6.9 ms, p95 8.3 ms, worst 8.6 ms over 240 samples, *including* the postprocessing pass. That is vsync-locked on a 144 Hz display with no dropped frames, which closes the one Phase 2 claim left open until Phase 10.
- `npm run verify:data` — ALL CHECKS PASSED. `npm run build` clean in ~0.8 s; chunks `three` 724 kB / `r3f` 265 kB / `react` 178 kB / app 154 kB.
- **Loading screen shows a real percentage**, driven by `THREE.DefaultLoadingManager` through drei's `useProgress`, clamped monotonic and reaching 100 %. It initially froze at 99: `visible` was derived as `!ready || shown < 100`, so the same commit that set 100 % also unmounted the tree, leaving `AnimatePresence` to fade out the *pre-update* render. `visible` is now its own state dismissed by a 450 ms timer.
- Zero console errors on a clean load; only the benign upstream `THREE.Clock ... deprecated` from inside @react-three/fiber.


### Phase 4 — Interaction + labels ✅ DONE
Files: [`PlanetLabel.jsx`](../src/components/three/PlanetLabel.jsx), [`SelectionRing.jsx`](../src/components/three/SelectionRing.jsx), [`Planet.jsx`](../src/components/three/Planet.jsx), [`Sun.jsx`](../src/components/three/Sun.jsx), [`usePlanetStore.js`](../src/hooks/usePlanetStore.js), [`App.jsx`](../src/App.jsx).

- **Hover feedback with zero React re-renders.** Scale (×1.04) and windowed Fresnel rim glow intensity are lerped smoothly in `useFrame` via `THREE.MathUtils.damp`. Cursor dynamically reflects pointer state.
- **Ergonomic hit testing.** Small bodies (Mercury, Mars) include an invisible hit proxy sphere (`Math.max(radius * 1.25, 1.25)`) to eliminate frustrating pixel hunting from overview distances.
- **Floating 3D labels.** Drei `<Html>` labels in Orbitron typography, with dynamic indicator dots, distance-based fade (fading out smoothly within 3.2 body radii so closeups are uncluttered), and Drei `occlude="blending"` raycasting.
- **Pulsing selection indicator ring.** Distance-invariant 2px stroke billboarding shader mounted on all 8 planets and the Sun.
- **Background deselect.** Clicking canvas background clears selection.
- **Store settings.** `settings` (`orbitLines`, `labels`, `idleDrift`) and `toggleSetting` added to `usePlanetStore`.


### Phase 5 — Cinematic camera (spec §9/§14/§15) ✅ DONE
Files: [`animationUtils.js`](../src/utils/animationUtils.js), [`useCameraControls.js`](../src/hooks/useCameraControls.js), [`useIdleDrift.js`](../src/hooks/useIdleDrift.js), [`CameraController.jsx`](../src/components/three/CameraController.jsx), [`usePlanetStore.js`](../src/hooks/usePlanetStore.js).

- **Three-state camera machine.** `idle` ↔ `traveling` ↔ `following` in `usePlanetStore`. OrbitControls disabled during travel to eliminate conflicting input.
- **GSAP spherical flight interpolation.** Coordinates animate along a spherical offset `{r, phi, theta}` relative to the moving target body, preventing camera clipping and ensuring natural curved deceleration (`power3.inOut`).
- **Moving target tracking in `useFrame`.** Target position is sampled continuously from the live scene graph; camera lands on the planet even as it orbits.
- **Damped orbit following.** Once arrived, `controls.target` continuously follows the orbiting body while translating the camera by the planet's delta motion. User can freely orbit and zoom around the planet with custom distance clamps per body (e.g. Saturn framing its full ring system).
- **Return to overview.** Deselecting smoothly tweens camera and target back to `(0, 32, 105)` and `(0, 0, 0)`.
- **Idle drift.** 8 seconds of no pointer/keyboard activity triggers subtle auto-rotation (`speed: 0.12`). Any interaction immediately halts the drift and resets the timer. Respects `prefers-reduced-motion`.


### Phase 6 — UI layer ✅ DONE
Files: [`WelcomeOverlay.jsx`](../src/components/ui/WelcomeOverlay.jsx), [`PlanetDetails.jsx`](../src/components/ui/PlanetDetails.jsx), [`PlanetNavigation.jsx`](../src/components/ui/PlanetNavigation.jsx), [`Controls.jsx`](../src/components/ui/Controls.jsx), [`AboutModal.jsx`](../src/components/ui/AboutModal.jsx), [`App.jsx`](../src/App.jsx), [`usePlanetStore.js`](../src/hooks/usePlanetStore.js).

- **Welcome hero screen.** "EXPLORE THE SOLAR SYSTEM" with glowing "Start Exploring" CTA, smooth fade-out into the system, and user-gesture sound initialization.
- **Glassmorphism details panel.** Right-side `.glass-panel` sliding in via Framer Motion / Motion. Header with category badge, planet title, prev/next arrows (`<` and `>`), and close button.
- **Live distance from Earth.** Throttled 4Hz DOM ref update using `distanceBetweenKm(EARTH, body, sceneTime)` with zero React re-renders.
- **NASA facts & metrics.** Physical stats grid (diameter, gravity, temperatures, orbital periods, moons) and 4 fun facts with glowing bullet points.
- **Planet selector rail.** Bottom navigation bar featuring all 9 bodies with active state indicators and touch scrolling.
- **Utility controls bar.** Top-bar controls for Reset View (Esc hint), Orbit Lines toggle, Labels toggle, Audio volume popover, and About modal.
- **Attribution modal.** CC BY 4.0 licensing attribution for Solar System Scope textures and NASA data notes, plus keyboard guide.
- **Keyboard navigation.** `Escape` to reset view, `←` and `→` to cycle planets.


### Phase 7 — Environment + effects polish ✅ DONE
Files: [`src/shaders/sunShader.js`](../src/shaders/sunShader.js), [`src/components/three/Sun.jsx`](../src/components/three/Sun.jsx), [`src/components/three/SolarFlares.jsx`](../src/components/three/SolarFlares.jsx), [`src/components/three/SunCoronaSprite.jsx`](../src/components/three/SunCoronaSprite.jsx), [`src/components/three/SpaceEnvironment.jsx`](../src/components/three/SpaceEnvironment.jsx), [`src/components/three/SolarSystem.jsx`](../src/components/three/SolarSystem.jsx), [`src/components/three/Rings.jsx`](../src/components/three/Rings.jsx), [`src/hooks/usePlanetMaterial.js`](../src/hooks/usePlanetMaterial.js), [`src/components/three/PostProcessingEffects.jsx`](../src/components/three/PostProcessingEffects.jsx), [`src/App.jsx`](../src/App.jsx).

- **Thermonuclear Sun surface:** custom `ShaderMaterial` with multi-octave 3D Simplex noise granulation, convective UV swirl, physical limb darkening (Eddington approximation), and active plage boosting for celestial bloom.
- **Solar flares & coronal loops:** 160 plasma particles with analytical parabolic loop arcs computed entirely on GPU in vertex shader.
- **Corona glare billboard:** additive camera-facing sprite with dynamic ray streaks and a breathing pulse.
- **Procedural space environment:** 2 large concentric 3D noise nebula shells in deep violet/magenta and cyan/teal, 2,000 cosmic dust motes with travel parallax, and 4 distant deep-space galaxy sprites.
- **Saturn ring & planet shadows:** photorealistic shadow wedge cast across the rings on Saturn's night side, and equatorial ring shadow band cast across Saturn's atmosphere.
- **Cinematic post-processing:** tuned Bloom, viewport Vignette, and travel-only Depth of Field (DoF) active exclusively during camera flight.

**Checkpoint:** view from "above" — nebula, dust, glowing Sun, everything cinematic; 60+ FPS; zero console errors.

### Phase 8 — Moons ✅ DONE
Files: [`src/data/moons.js`](../src/data/moons.js), [`src/data/planets.js`](../src/data/planets.js), [`src/components/three/Moon.jsx`](../src/components/three/Moon.jsx), [`src/components/three/MoonOrbit.jsx`](../src/components/three/MoonOrbit.jsx), [`src/components/three/Planet.jsx`](../src/components/three/Planet.jsx), [`src/components/ui/PlanetDetails.jsx`](../src/components/ui/PlanetDetails.jsx).

- **Rich NASA scientific moon data:** authentic NASA/JPL data, physical characteristics, and 4 curated facts for Earth's Moon, the 4 Galilean moons of Jupiter (Io, Europa, Ganymede, Callisto), and Saturn's Titan.
- **Circular moon orbital trails:** elegant `<MoonOrbit />` lines in parent planet coordinate space, demonstrating orbital mechanics and Laplace resonance.
- **Interactive selection & hit testing:** invisible ergonomic hit proxy spheres, hover scale lerp (1.0 → 1.08), pointer cursor, pulsing selection rings, and floating 3D labels.
- **Hierarchical camera flight & tracking:** GSAP spherical flight directly to moons with continuous delta tracking as moons rapidly orbit their moving parent planet.
- **Details panel integration:** dedicated moon view with parent planet links, sibling moon `<` / `>` cycling, and quick-jump Major Moons chips in Jupiter, Saturn, and Earth details panels.

**Checkpoint:** focus Jupiter → 4 moons dance over ~1 min; focus Saturn → Titan + rings; click Europa/Titan → camera focuses with full data panel; zero console errors.

### Phase 9 — Audio
`useAudioEngine` per §3.8 + Controls integration (toggle, volume, gesture-gated start, no autoplay).
**Checkpoint:** sound starts only after START EXPLORING; toggle + volume work; zero console errors.

### Phase 10 — Performance & adaptation
- `useQualityTier` detection + runtime downgrade; `AdaptiveDpr`; texture anisotropy; verify no per-frame React state anywhere (grep for `setState` in `useFrame`); `React.memo` on heavy static UI; useMemo for geometry.
- Frame-time audit: DevTools 60 FPS on a mid laptop + phone emulation.
**Checkpoint:** 60 FPS desktop, 30–60 mobile; tier drops without visual catastrophe.

### Phase 11 — A11y, errors, credits, QA
- Keyboard: Tab order, Esc = reset/close, ←/→ = prev/next planet in panel, Enter/Space on buttons; `aria-label` + `aria-live="polite"` on panel; focus-visible styles; `prefers-reduced-motion` (skip travel, static star twinkle).
- WebGL detect → friendly fallback (`ErrorFallback`); asset error boundary per shape; retry.
- About modal: Solar System Scope CC BY 4.0 attribution + NASA data note.
- Final pass: `npm run build && npm run preview`, walk the spec checklist below.
**Checkpoint:** passes checklist; build artifact runs from `preview`.

---

## 6. Spec → Phase coverage checklist

| Spec § | Covered in |
|---|---|
| 1 Tech stack | 0 |
| 2 Architecture | 0–1 |
| 3 Solar system | 2, 8 |
| 4 Sun | 2 (basic), 7 (full) |
| 5 Planet realism | 3 |
| 6 Orbital animation | 2 |
| 7 Hover | 4 |
| 8 Labels | 4 |
| 9–10 Click + details experience | 5, 6 |
| 11 Panel | 1 (data), 6 |
| 12 UI design | 0 (tokens), 6 |
| 13 Navigation | 6 |
| 14–15 Camera | 2 (controls), 5 (cinematic) |
| 16–17 Space | 2 (stars), 7 (environment) |
| 18 Post-processing | 2 (basic), 7 (tuned) |
| 19 Audio | 9 |
| 20 Loading | 3 (progress), 6 (welcome) |
| 21–22 Responsive + perf | 10 |
| 23 Accessbility | 11 |
| 24 Data structure | 1 |
| 25 Animation principles | 5, 6 |
| 26 UX flow | 6 |
| 27 Code quality | all (rules in §1) |
| 28 Error handling | 3, 11 |
| 29 Final visual goal | 7 + 11 |

---

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Texture download blocked / user skips it | Fallback colors + procedural defaults built in from Phase 2; nothing blocks |
| R3F v9 + React 19 peer-dep friction | Pin known-good versions at Phase 0; `npm install` once, up front |
| Bloom blows out planets | `toneMapped:false` only on Sun; threshold 1.0; tune in Phase 7 |
| Per-frame React re-renders killing FPS | Hard rule (§1.1) + grep audit in Phase 10 |
| `<Html>` occlusion raycasts on mobile | Occlusion off on Low tier (§3.9) |
| Uranus 97° tilt looks broken/odd | It's deliberate — comment + it's the spec's own highlight |
| GSAP vs R3F frame loop conflicts | Tweens driven from `useFrame` via `gsap.updateRoot` timing; no separate gsap.ticker |
| Mid-travel planet moves away (classic bug) | Deterministic position fn + per-frame moving target (§3.2) |
| CC BY 4.0 attribution missing | Credits in About modal — non-negotiable, part of Phase 11 |

---

## 8. Done definition

- `npm run dev` clean, `npm run build` clean, no console errors.
- All 29 spec sections demonstrably working (checklist above).
- 60 FPS on a mid-range desktop; graceful degradation on mobile.
- Every interactive element keyboard-reachable; every animation eased; zero placeholder text; credit line present.
