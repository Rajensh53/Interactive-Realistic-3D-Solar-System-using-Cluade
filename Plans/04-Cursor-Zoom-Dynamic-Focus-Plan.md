# Plan 04: Cursor-Directed Zoom & Dynamic Focus

> Step 0 after approval: save this plan as `Plans/04-Cursor-Zoom-Dynamic-Focus-Plan.md`, then implement.

## Context

The mouse wheel currently dollies toward OrbitControls' `target`. In the overview that is the Sun at the origin, wherever the cursor is, so users can't zoom into the region or planet they are pointing at.

**Goal:** zoom toward the world point under the cursor and keep that point fixed on screen. When a planet is under the cursor, zoom onto it and move the orbit pivot to it. Zooming in far enough focuses the planet (details panel open, camera following) with no camera jump. Orbiting and panning afterwards must stay smooth.

**Decisions (confirmed with the user):**
- **While a planet is already focused/followed:** the camera stays locked on that planet. The planet stays the pivot and stays centred, and the wheel zooms relative to it.
- **Dynamic focus from the overview:** the zoom anchors on the planet under the cursor, and the pivot moves onto it. Once the planet fills about 20% of the screen height, it is auto-selected in place: the panel opens and the camera follows, with no flight animation.

**Why not the built-in OrbitControls `zoomToCursor`** (three-stdlib, `OrbitControls.js:222-270`):
- it sizes each step from the distance to the old pivot, not to the point under the cursor;
- it can fly through planets, because `minDistance` only guards the pivot;
- it leaves the pivot at an arbitrary depth along the view axis;
- the follow logic in `useCameraControls.js` overwrites `controls.target` every frame, so the two would fight.

## Architecture

### 1. Wheel/pinch ownership: new `src/hooks/useCursorZoom.js`
- In `CameraController.jsx`, pass `enableZoom={false}` so OrbitControls stops handling wheel and pinch zoom (it keeps rotate and pan). Call `useCursorZoom(innerRef)` next to `useCameraControls` / `useIdleDrift`.
- Listen for `wheel` (passive: false, so it can `preventDefault`) and for `pointerdown/move/up` on `gl.domElement`, which lets two-finger pinch keep working on touch.
- **Normalising the input:**
  - line/page `deltaMode` is converted to pixels;
  - trackpad pinch (`ctrlKey` + wheel) is handled as zoom;
  - pinch uses the ratio of the distance between the two fingers, anchored at their midpoint;
  - each step is a log-scale factor `s = exp(delta · k)`, so every notch feels the same in Compact (100 u) and True Scale (30,000 u).
- **Ignored when:** `cameraPhase === "traveling"` or `appState !== "exploring"`, or when the event starts over UI (the canvas only receives events that aren't over panels).

### 2. Screen → world anchor (raycasting)
On every zoom input:
1. Build a `THREE.Raycaster` from the cursor's NDC coordinates and the camera.
2. **Pick bodies cheaply:** raycast only against the real surface meshes, never against stars, orbit lines, the dust or the large invisible hit proxies.
   - Extend `registerBody(id, object3D, radius)` in `src/utils/planetUtils.js` with an optional `pickMesh`.
   - `Planet.jsx`, `Moon.jsx` and `Sun.jsx` pass their `spinRef` surface mesh.
3. **Anchor P**, in priority order:
   - **Surface hit:** P is the hit point, and `anchorBody` is that body.
   - **Tiny bodies (True Scale, sub-pixel planets):** if a body's projected centre is within 12 px of the cursor (the marker dot), P is the body's centre and `anchorBody` is that body.
   - **Empty space:** P is where the cursor ray crosses the plane through the current pivot (`controls.target`), perpendicular to the view direction. Zooming at the screen centre then behaves exactly as it does today, and zooming off-centre heads toward what's under the cursor at the pivot's depth.
4. **Moving bodies:** store P relative to its body (`P − bodyCentre`) and re-add the body's current centre each frame, so the anchor rides along with the orbit during a smoothed zoom.

### 3. Camera motion: homothety about P (the key idea)
For a zoom step with factor `s`:

`camera = P + (camera − P)·s` and `target = P + (target − P)·s`

Camera, pivot and P all scale about the same point, so the camera's orientation doesn't change and P stays **exactly** under the cursor. There is no rotation and no lookAt snap, and OrbitControls' spherical state stays consistent with the pivot.

- **Clamping** (applied to `s` before moving):
  - with an `anchorBody`, the distance from the camera to the body's centre stays at least `radius × 1.25` (Sun: `× 1.6`), so the camera can never enter a body;
  - otherwise, the camera-to-target distance stays within `getSceneConfig(mode).MIN/MAX_CAMERA_DISTANCE`.
- **Smoothing:** wheel input adds to a pending log-scale; each frame applies a damped share of it, using `damp` with λ≈12, about 60 ms per notch, the same feel as today's damping. Reduced-motion users get the full step at once.
- **Frame order:** this runs in a `useFrame` registered *after* `useCameraControls`' follow step (the same technique as the camera-anchor frame), so it never fights the follow delta. It ends with `controls.update()`.

### 4. Dynamic pivot & auto-focus (overview / idle)
- **Pivot onto the planet:** when `anchorBody` is set, after each step the pivot is re-seated on the view axis at the planet's depth:

  `target = camera + forward · dot(centre − camera, forward)`

  Because the target stays on the view axis, the view doesn't change. Rotating afterwards pivots around a point at the planet's depth, and exactly around its centre once it's centred on screen.
- **Auto-focus:** when the projected radius of `anchorBody` reaches ≥ 20% of the viewport height (and it isn't already selected), call `selectPlanet(id, { inPlace: true })`.
  - `usePlanetStore`: `selectPlanet` stores `selectionSource: "flight" | "inPlace"`. Every existing caller keeps "flight".
  - `useCameraControls.js` CASE 2, when `inPlace`:
    - skip the GSAP flight;
    - run a short (≈0.5 s) recentre instead: keep the camera's distance to the planet, and ease the pivot from its current position onto the planet's centre, so the planet glides to the middle of the screen;
    - then enter `"following"`, with min/max limits from `getBodyFraming` and the minimum clamped to the current distance.
  - The details panel opens as usual.

### 5. While following a planet or moon (locked)
- The pivot stays the followed body's centre, which the existing follow code in `useCameraControls.js` already maintains.
- The wheel dollies along the camera→centre line: `camera = C + (camera − C)·s`. This is clamped to the framing min/max (`animationUtils.getBodyFraming`) and to the body-surface guard above, so the planet stays centred and locked.
- The cursor position is ignored in this mode (confirmed: stay locked).
- Returning to the overview is unchanged (`releaseDistanceLimits` + GSAP).

### 6. Smooth orbiting/panning after zoom (no jumps)
- Camera and target are only ever moved together (homothety or re-seating on the view axis), and OrbitControls derives its spherical state from `camera − target` on each `update()`. So the first drag after a zoom continues from the current view.
- Idle drift (`useIdleDrift`) auto-rotates around the new pivot. "Overview" / Esc still flies back to the origin.
- The true-scale near plane (`updateClipPlanes`) already follows the distance to the target, so it adapts as the pivot moves.

### 7. Dev bridge & checks
`devBridge.js`:
- `zoomAt(x, y, notches)` dispatches real `WheelEvent`s at canvas pixel (x, y);
- `project(id)` returns a body's screen position;
- `getPivot()` returns `controls.target`.

`DevProbe` exposes `controls`.

## Critical files
- `src/hooks/useCursorZoom.js` (new): input, raycast anchor, homothety, damping, auto-focus
- `src/components/three/CameraController.jsx`: `enableZoom={false}`, mounts the hook
- `src/hooks/useCameraControls.js`: in-place focus + recentre; following-mode dolly handoff
- `src/hooks/usePlanetStore.js`: `selectPlanet(id, { inPlace })`, `selectionSource`
- `src/utils/planetUtils.js` + `Planet.jsx`, `Moon.jsx`, `Sun.jsx`: `pickMesh` in the registry
- Reused: `getSceneConfig`, `getBodyFraming`, `bodyRegistry`, `releaseDistanceLimits`, and the frame-order pattern of `cameraAnchors`
- `src/utils/devBridge.js`, `src/components/three/DevProbe.jsx`: test hooks

## Verification
1. `node scripts/verify-data.mjs`, a temp-config ESLint run, and `npx vite build`: all clean.
2. Browser tests (Playwright + Edge, dev server; UI-only parts repeated on `vite preview`):
   - **Cursor stays put:** in the Compact overview, zoom 5 notches over Jupiter. Jupiter's screen position moves ≤ 2 px and its size grows. Do the same over empty space off-centre: the world point under the cursor stays within 2 px.
   - **Centre is unchanged:** zooming at the screen centre over empty space matches today's behaviour.
   - **No tunnelling:** 40 notches over Saturn never bring the camera closer than 1.25 radii to its centre.
   - **Auto-focus:** zooming into Mars from the overview selects Mars in place (the panel opens), the camera moves < 5% per frame with no flight jump, and Mars ends up centred and followed.
   - **Locked when following:** following Jupiter, zooming with the cursor off to the side keeps Jupiter centred, and the distance stays within the framing limits.
   - **No jump after zoom:** after zooming, a small drag rotates smoothly (the first-frame camera delta is continuous) and pan works.
   - **True Scale:** from the overview, zooming on Earth's marker reaches Earth's surface in a reasonable number of notches (log steps) and auto-focuses. Also zoom on empty space between Jupiter and Saturn.
   - **Touch:** a two-finger pinch (CDP touch emulation) zooms toward the midpoint.
   - **Ignored when it should be:** wheel input over the details panel, speed panel or toolbar doesn't move the camera, and nothing happens during flights.
   - No console errors, and existing suites (`full.mjs`, `speed.mjs`, `toolbar.mjs`) still pass.
