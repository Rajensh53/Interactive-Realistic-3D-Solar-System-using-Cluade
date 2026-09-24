# Plan 03: User-Controlled Orbit & Rotation Speed

> After approval, **only** save this plan as `Plans/03-Orbit-Rotation-Speed-Controls-Plan.md`. Do **not** implement until the user gives the command.

## Context

All motion in the scene runs off one clock. `simulationClock.time` in `src/utils/planetUtils.js` drives:
- planet and moon orbits (`orbitAngleAt`, `Moon.jsx`);
- planet, moon, cloud and Sun spin (`Planet.jsx:142`, `Moon.jsx`, `CloudLayer.jsx:25`, `Sun.jsx:96`);
- the Sun's surface animation (`Sun.jsx:93`).

`simulationClock.timeScale` exists, but only the dev bridge can change it. Users can't change the speed at all, and orbit and rotation can't be tuned separately.

The spin rates themselves (`rotationSpeed` in `src/data/planets.js` / `moons.js`) are hand-picked, not real. For example, Mars (0.78) spins faster than Earth (0.75), although its day is 40 minutes longer. Venus and Mercury are also far too fast relative to Earth.

**Goal (decisions confirmed with the user):**
1. A **Speed** panel with separate **Orbit** and **Rotation** sliders (0.1× to 100×), plus Pause/Play, presets (0.5×, 1×, 5×, 25×), Reset, and a "Link" option that moves both sliders together. Space toggles pause.
2. **Real spin rates:** each body's spin is derived from its real rotation period, so relative spin speeds are true. The Rotation slider scales them all together.

## Design

### 1. Two clocks: `src/utils/planetUtils.js`
- Extend `simulationClock` to `{ time, spinTime, orbitScale, spinScale, paused }`.
  - `time` stays the **orbit** clock, keeping its name, so every existing reader keeps working unchanged: the live-distance readout (`PlanetDetails.jsx:77`), `devBridge.verifyPositions`, `Orbit.jsx`, and camera following.
  - `spinTime` is new and drives axial rotation.
- `advanceClock(delta)`: do nothing while `paused`. Otherwise `time += delta·orbitScale` and `spinTime += delta·spinScale`. The existing 0.1 s delta clamp in `SolarSystem.jsx` stays.
- Add `SCENE.EARTH_DAY_SECONDS = 20`: one Earth rotation takes 20 s at 1×. A true day:year ratio (366 spins per 45 s orbit) would strobe, so spin has its own base, just as orbits already have `EARTH_YEAR_SECONDS`.
- Add `rotationSpeedFromPeriod(hours) = 2π / (hours / 23.934 · EARTH_DAY_SECONDS)`, next to `orbitTimeFromPeriod`.

### 2. Real rotation periods: `src/data/planets.js`, `src/data/moons.js`
- Add a numeric `rotationPeriodHours` (sidereal) per body and derive `rotationSpeed` from it in the existing `PLANETS` map. This replaces the hand-typed values. Sources: NASA fact sheets.

  | Body | Sidereal period (h) | Resulting Earth-relative rate |
  |---|---|---|
  | Sun | 609.12 (25.38 d, Carrington) | |
  | Mercury | 1407.6 | |
  | Venus | 5832.5 | retrograde stays encoded by its 177° tilt |
  | Earth | 23.934 | 1.00 |
  | Mars | 24.623 | 0.97 (now slower than Earth ✓) |
  | Jupiter | 9.925 | 2.41 |
  | Saturn | 10.56 | |
  | Uranus | 17.24 | retrograde via its 98° tilt |
  | Neptune | 16.11 | |

  At 1×, Jupiter spins once every ~8 s, and Venus once every ~81 min, so it looks almost still. That is true to life, and users can speed rotation up with the slider.
- **Moons are tidally locked**, so a moon's spin is tied to its orbit rather than to `rotationPeriodHours`. In `Moon.jsx`, set the spin angle equal to the orbit angle, using the orbit clock, so the same face always points at the planet at any Orbit speed. The Rotation slider therefore doesn't affect moons; the panel shows a note saying so.
- Moon orbit periods (`orbitTimeSeconds`) stay as they are. At a true ratio, Io would lap Jupiter in about 0.2 s. This is out of scope and will be noted in the plan.

### 3. Spin readers switch to `spinTime`
- `Planet.jsx`, `CloudLayer.jsx`, and `Sun.jsx` (spin and the surface shader's `uTime`) use `simulationClock.spinTime`. Pausing then freezes the Sun's surface as well. Moons follow step 2.
- Orbit positions and everything else keep reading `time`.

### 4. State: `src/hooks/usePlanetStore.js`
- Add `simulation: { orbitSpeed: 1, rotationSpeed: 1, paused: false, linked: false }` with the actions `setOrbitSpeed`, `setRotationSpeed`, `togglePaused`, `setLinked` and `resetSpeeds`. When `linked` is on, setting either speed sets both.
- `SimulationClock` in `SolarSystem.jsx` copies the store values onto `simulationClock` each frame using `usePlanetStore.getState()`. This means no React re-renders, following the existing per-frame read pattern (e.g. `Planet.jsx:146`).

### 5. UI: new `src/components/ui/SpeedControls.jsx`
- A "Speed" button in the top bar (`Controls.jsx`), styled like the existing Orbits/Labels pills. It shows the current orbit speed (e.g. "5×"), or "Paused".
- Clicking it opens a glass popover, built like the volume popover in `Controls.jsx:136`, containing:
  - a Pause/Play button and a Reset button;
  - **Orbit** and **Rotation** range sliders on a logarithmic scale (0.1×–100×), snapping to 1× near the middle, with the value read out (e.g. "5.0×");
  - a plain-language rate under each slider, e.g. "1 Earth year ≈ 9 s" and "1 Earth day ≈ 20 s";
  - preset chips: 0.5× / 1× / 5× / 25× (these set both speeds when Link is on, otherwise Orbit only);
  - a "Link" checkbox;
  - a small note: "Moons are tidally locked and turn with their orbit."
- Accessibility: `<input type="range">` elements with `aria-valuetext` (e.g. "5 times"), buttons with `aria-pressed`, and the popover closes on Esc or on an outside click.
- **Keyboard** (`App.jsx`, in the existing keydown handler): Space toggles pause, ignored when focus is on an input or button. `[` / `]` halve or double the orbit speed.

### 6. Dev bridge & checks
- `devBridge.js`:
  - `setTimeScale(s)` sets both scales, so existing callers still work.
  - Add `setSpeeds({ orbit, rotation })`, `pause()`, `resume()` and `getSpeeds()`.
- `scripts/verify-data.mjs`: add a "Rotation" section that checks:
  - `rotationSpeed` equals `rotationSpeedFromPeriod(rotationPeriodHours)` for every planet and the Sun;
  - Earth's 1× day equals `EARTH_DAY_SECONDS`;
  - spin ordering: Jupiter > Saturn > Neptune > Uranus > Earth > Mars > Sun > Mercury > Venus;
  - all spins are still positive, so the tilt still encodes Venus's and Uranus's retrograde spin.
- Clock unit test (in the same script): advancing 1 s at orbit 5× / spin 0.5× gives time +5 and spinTime +0.5, and while paused neither changes.

## Critical files
- `src/utils/planetUtils.js`: clocks, `EARTH_DAY_SECONDS`, `rotationSpeedFromPeriod`
- `src/data/planets.js`, `src/data/moons.js`: `rotationPeriodHours`, derived `rotationSpeed`
- `src/components/three/SolarSystem.jsx`, `Planet.jsx`, `Moon.jsx`, `CloudLayer.jsx`, `Sun.jsx`: clock wiring
- `src/hooks/usePlanetStore.js`: `simulation` state
- `src/components/ui/SpeedControls.jsx` (new), `src/components/ui/Controls.jsx`, `src/App.jsx`: UI and keys
- `src/utils/devBridge.js`, `scripts/verify-data.mjs`: verification

## Verification
1. Run `node scripts/verify-data.mjs`: all checks pass, including Rotation and the clock test.
2. Run `npx vite build`: succeeds.
3. In the browser (Playwright-core + Edge script from before):
   - At the defaults, planet orbits look identical to today (orbit 1×). Spin is now real-relative: Earth completes a turn in about 20 s, Jupiter in about 8 s.
   - Orbit 5×: `__solar.clock.time` advances 5× faster than wall time, and a screenshot sequence shows planets moving 5× further.
   - Rotation 0.1× with Orbit 25×: planets race around while barely spinning. This proves the two sliders are independent.
   - Pause (button and Space): positions and spin freeze, the camera can still orbit, the live distance readout stops changing, and resuming continues smoothly without a jump.
   - The Moon's same face points at Earth at 1× and at 25× orbit.
   - Link on: moving one slider moves both. Reset returns both to 1× and unpauses.
   - Works in both Compact and True Scale modes. Following a planet at 100× stays locked on.
