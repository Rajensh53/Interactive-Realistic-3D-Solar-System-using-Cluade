# Interactive Realistic 3D Solar System

A cinematic, scientifically grounded 3D model of the Solar System that runs in the browser. Explore the Sun, all eight planets and their major moons, switch between a composed view and **true astronomical scale**, control time, and zoom straight toward whatever is under your cursor.

Built with React 19, Three.js and React Three Fiber.

---

## Highlights

- **Real astronomical data.** Every body carries values from NASA Planetary Fact Sheets and JPL:
  - mass, density, gravity, escape velocity, temperature, axial tilt, orbital elements, atmosphere, rings and discovery details;
  - 8 curated facts per planet.

  Moon counts are current as of September 2026 (Jupiter 115, Saturn 293, Uranus 29, Neptune 16).
- **Compact ↔ True Scale.**
  - *Compact* composes the system for the screen.
  - *True Scale* puts every distance and size on one physical scale (1 AU = 1,000 scene units): the Sun is 109 Earths wide, the Moon orbits 60 Earth radii out, and Neptune is 30 AU away.
- **Real spin rates.** Each body rotates according to its real sidereal day: Jupiter 2.4× faster than Earth, Venus 244× slower. The Venus and Uranus retrograde spins come from their axial tilts. Moons are tidally locked.
- **Time controls.** Orbit and rotation speed are independent (0.1× to 100×), with pause/play, presets, a *Link* option and keyboard shortcuts.
- **Cursor-directed zoom with dynamic focus.**
  - The wheel (or pinch) zooms toward the point under the cursor and keeps it fixed on screen.
  - Zooming onto a planet moves the rotation pivot to it; zoom in far enough and it is focused in place.
  - The camera can never pass through a surface.
- **Cinematic camera.** Smooth flights between bodies, orbit following, idle drift, and a live "distance from Earth" readout.
- **Rendering.**
  - A procedural Sun shader with granulation, limb darkening and a corona.
  - Earth's day/night terminator with city lights, a cloud layer, and atmospheric limb glow.
  - Saturn's rings with planetary shadow, selective bloom, a star field and nebula backdrop.
- **Procedural ambient audio.** An evolving pad, solar-wind texture and sub-bass, synthesised live with the Web Audio API. No audio files are downloaded.
- **Adaptive quality.** High, medium and low tiers selected from the device and adjusted at runtime to hold the frame rate.
- **Responsive and accessible.** Works on desktop, tablet and phone. Supports keyboard navigation, ARIA labels and `prefers-reduced-motion`, and falls back gracefully when WebGL is unavailable.

---

## Controls

| Action | Mouse / trackpad | Touch | Keyboard |
|---|---|---|---|
| Rotate the view | Left-drag | One-finger drag | — |
| Pan | Right-drag | Two-finger drag | — |
| Zoom toward the cursor | Wheel / pinch | Pinch | — |
| Select a body | Click it, its label, or the bottom rail | Tap | — |
| Previous / next body | Panel arrows | Panel arrows | `←` / `→` |
| Back to the overview | *Overview* button | *Overview* button | `Esc` |
| Pause / resume time | *Speed* panel | *Speed* panel | `Space` |
| Halve / double orbit speed | *Speed* panel | *Speed* panel | `[` / `]` |

Toolbar: **Speed**, **Compact / True Scale**, **Orbits**, **Labels**, **About & Credits**, and **Sound** (hover for volume).

---

## Getting started

### Requirements
- **Node.js** 20.19+ or 22.12+ (required by Vite 8). `.nvmrc` pins 22 LTS, so `nvm use` picks it, and `package.json` declares the same range in `engines`.
- A modern browser with **WebGL** (Chrome, Edge, Firefox, Safari)

### Install and run

```bash
npm ci        # clean install from the lockfile
npm run dev
```

Open <http://localhost:5173>. The dev server also listens on your local network (`host: true`), so you can open it from a phone on the same Wi-Fi.

### Production build

```bash
npm run build     # outputs to dist/
npm run preview   # serves the production build at http://localhost:4173
```

The build splits the large, rarely changing libraries (`three`, `@react-three/*`, post-processing, React) into separate chunks, so updating the app doesn't invalidate the cached 3D libraries.

**Deploying under a sub-path** (e.g. `https://user.github.io/repo/`): build with `npx vite build --base=/repo/`. Texture URLs follow the base automatically (`src/utils/assetUrl.js`). The full deployment checklist, including cache and security headers, is in [PRODUCTION_AUDIT.md](PRODUCTION_AUDIT.md#4-deploy-checklist-manual-deployment).

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the Vite dev server with hot reload |
| `npm run build` | Create an optimised production build in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint (React hooks and fast-refresh rules) |
| `npm run verify:data` | Validate the astronomical data and scene maths (see [Testing](#testing)) |
| `npm run test:e2e` | Playwright end-to-end tests: Chromium and WebKit (plus Firefox outside Windows) × desktop, tablet and phone |
| `npm run test:e2e:chromium` | The same, Chromium only (faster) |

### Textures

The 2K planet and environment textures are already in `public/textures/`. To restore or re-download them from Solar System Scope, run:

```bash
bash scripts/fetch-textures.sh
```

The script is safe to re-run: files already present are skipped. If a texture ever fails to load, the body falls back to a flat colour, and the About dialog lists the affected files.

---

## Project structure

```text
.
├── index.html
├── vite.config.js
├── public/
│   ├── favicon.svg
│   ├── og-image.jpg           # 1200×630 social preview
│   ├── robots.txt
│   └── textures/
│       ├── planets/           # 2K surface, cloud, night-light and ring maps
│       └── environment/       # Milky Way backdrop
├── scripts/
│   ├── fetch-textures.sh      # Download textures (CC BY 4.0)
│   └── verify-data.mjs        # Data and maths verification suite
├── e2e/                       # Playwright end-to-end tests
├── playwright.config.js       # 3 engines × 3 viewports
├── eslint.config.js
├── PRODUCTION_AUDIT.md        # Audit findings and deploy checklist
├── Plans/                     # Design plans for each major feature
└── src/
    ├── App.jsx                # Canvas, overlays, global keyboard shortcuts
    ├── main.jsx
    ├── data/
    │   ├── planets.js         # Sun + planets: the single source of truth
    │   ├── moons.js           # Moon, Io, Europa, Ganymede, Callisto, Titan
    │   └── textures.js        # Texture manifest
    ├── components/
    │   ├── three/             # Scene: Sun, Planet, Moon, Orbit, Rings, labels,
    │   │                      # markers, star field, environment, camera
    │   └── ui/                # Details panel, planet rail, toolbar, speed panel,
    │                          # welcome, loading, About
    ├── hooks/
    │   ├── usePlanetStore.js  # Zustand store: selection, settings, speed, audio
    │   ├── useCameraControls.js  # Flights, following, in-place focus, clip planes
    │   ├── useCursorZoom.js   # Cursor-directed zoom and dynamic focus
    │   ├── useAudioEngine.js  # Procedural Web Audio ambience
    │   ├── useQualityTier.js  # Adaptive rendering tiers
    │   └── ...
    ├── shaders/               # Sun surface and limb-glow GLSL
    ├── utils/                 # Orbital maths, clocks, textures, dev bridge
    └── styles/globals.css     # Tailwind CSS v4 theme and design tokens
```

---

## How it works

**One source of truth for data.**
- `src/data/planets.js` and `moons.js` hold both the physical values shown in the UI and the scene values used for rendering.
- Anything that must stay consistent is *derived* rather than hand-typed: ellipse semi-minor axes, animation periods, spin rates from real rotation periods, and the entire true-scale layout (radii from `diameterKm`, orbits from `semiMajorAU`).

**Two layouts, one scene.**
- Compact and True Scale share the same body records.
- In True Scale:
  - the camera's near plane follows its distance to the target, to keep depth precision over five orders of magnitude;
  - the sky backdrop travels with the camera;
  - labels and constant-size markers keep sub-pixel planets findable.

**Deterministic time.**
- Positions are pure functions of simulation time, with no frame-to-frame accumulation, so nothing drifts.
- There are two clocks:
  - the orbit clock drives positions and the live distance readout;
  - the spin clock drives axial rotation, clouds and the Sun's surface.
- The Speed controls scale each clock independently.

**Camera state machine.** `idle` → `traveling` → `following`, driven by GSAP:
- In True Scale, long flights interpolate the camera distance logarithmically, so the approach feels even.
- Cursor zoom scales the camera and the pivot about the point under the cursor (a homothety). The view's orientation never changes, so that point stays exactly under the cursor and orbiting afterwards never jumps.

---

## Data accuracy

- **Sources:** NASA Planetary Fact Sheets (NSSDCA), NASA Science, and JPL Solar System Dynamics.
- **Display values are physical; motion is compressed.**
  - Distances, sizes and figures in the details panel are real in both modes.
  - Animation speeds are compressed so motion is watchable: one Earth year takes 45 s and one Earth day 20 s at 1×.
  - The *relative* orbital and spin speeds are preserved.
- **Moon counts** change as new discoveries are confirmed. The values here are a September 2026 snapshot, and the date is noted in the data file.
- **Simplifications:**
  - Bodies move at a constant rate around true ellipses; they don't speed up at perihelion.
  - The live distance readout reflects the simulated configuration, not real-time ephemerides.

---

## Testing

```bash
npm run verify:data
```

The verification suite checks:
- data integrity and the absence of placeholder values;
- perihelion and aphelion against the orbital elements, and prograde orbits;
- that the true-scale layout matches the physical data (every moon orbits outside its planet, Mercury stays clear of the Sun);
- the rotation periods and their ordering;
- that the orbit and spin clocks run independently and stop when paused.

End-to-end tests drive the real app in a browser:

```bash
npx playwright install chromium webkit   # once (add firefox on Linux/macOS)
npm run test:e2e
```

They cover loading with no console errors, every body and moon showing clean data, the Compact ↔ True Scale toggle (orbits exact, moons outside their planets), pause/speed and all keyboard shortcuts, and the zoom never entering a body. On Windows, Firefox is opt-in (`E2E_FIREFOX=1`) because Smart App Control can block Playwright's unsigned Firefox build.

In development builds, `window.__solar` and `window.__solarRender` expose inspection helpers for automated browser testing, including body positions, orbit and moon verification, scale mode, speed controls, camera and pivot state, and screen projection. They are stripped from production builds.

---

## Tech stack

| Area | Libraries |
|---|---|
| UI | React 19, Tailwind CSS v4, Motion |
| 3D | Three.js (r185), @react-three/fiber, @react-three/drei, @react-three/postprocessing |
| Animation / state | GSAP, Zustand |
| Tooling | Vite 8 (Rolldown) |
| Fonts | Orbitron, Inter (via Fontsource) |

---

## Credits

- **Textures:** [Solar System Scope](https://www.solarsystemscope.com/textures/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The in-app About dialog also shows this attribution, as the licence requires.
- **Scientific data:** NASA Planetary Fact Sheets, NASA Science, and NASA/JPL Solar System Dynamics.

## License

This repository does not yet include a licence file, so all rights are reserved by the author by default. Add a `LICENSE` file before distributing or accepting contributions. Third-party textures remain under CC BY 4.0 whatever licence you choose for the code.
