import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { usePlanetStore } from "./usePlanetStore.js";
import { getScaledBody } from "../data/planets.js";
import { bodyRegistry, getSceneConfig } from "../utils/planetUtils.js";

/** One mouse-wheel notch, in pixels of deltaY. */
const NOTCH_PX = 100;
/** Zoom per notch: 1.2× closer (or farther). Log-scale, so it feels the same at 100 u and 30,000 u. */
const LOG_PER_PX = Math.log(1.2) / NOTCH_PX;
/** Largest single input step (a fast flick), as a factor. */
const MAX_STEP_LOG = Math.log(2);
/** Trackpad pinch (ctrlKey + wheel) sends small deltas; scale them up. */
const PINCH_WHEEL_GAIN = 4;
/** Smoothing: how quickly pending zoom is applied (per second). */
const DAMP_LAMBDA = 12;
/** Closest the camera may come to a body's centre, in body radii. */
const SURFACE_GUARD = 1.25;
const SUN_GUARD = 1.6;
/** Cursor within this many pixels of a body's disc (or marker) anchors on it. */
const PICK_MARGIN_PX = 12;
/** Auto-focus once the anchored body's disc spans this share of the viewport height. */
const AUTO_FOCUS_FRACTION = 0.2;
/** Beyond this distance from the Sun (× the overview framing) the pivot is pulled back toward it. */
const PIVOT_RANGE = { compact: 110, true: 32_000 };

const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _centre = new THREE.Vector3();
const _proj = new THREE.Vector3();
const _p = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _plane = new THREE.Plane();
const _tmp = new THREE.Vector3();
const _camNext = new THREE.Vector3();

/**
 * Cursor-directed zoom with dynamic focus.
 *
 * Replaces OrbitControls' wheel/pinch dolly (disabled via `enableZoom={false}`),
 * which always zoomed toward the orbit pivot (the Sun in the overview).
 *
 * Overview ("idle"):
 *  - The zoom anchors on the world point P under the cursor: a planet's
 *    surface if the ray hits one, a planet whose disc or marker is within a
 *    few pixels (true-scale planets are sub-pixel), otherwise the point at the
 *    pivot's depth.
 *  - Each step is a homothety about P: camera and pivot both move by
 *    P + (x − P)·s. Orientation never changes, so P stays exactly under the
 *    cursor and OrbitControls' state stays consistent — no jumps afterwards.
 *  - With a planet anchored, the pivot is re-seated on the view axis at the
 *    planet's depth (view unchanged), so rotating afterwards turns around it,
 *    and once its disc fills AUTO_FOCUS_FRACTION of the screen it is selected
 *    in place (panel opens, camera follows, no flight).
 *
 * Following a body: the body stays the pivot and stays centred; the wheel only
 * changes the distance to it (the user chose "stay locked").
 *
 * Runs in a useFrame registered after useCameraControls, so the follow step
 * has already moved the camera this frame.
 *
 * @param {React.RefObject<import('three-stdlib').OrbitControls>} controlsRef
 */
export function useCursorZoom(controlsRef) {
  const { camera, gl, events } = useThree();

  const stateRef = useRef({
    pendingLog: 0,
    anchorBodyId: null,
    anchorOffset: new THREE.Vector3(),
    anchorWorld: new THREE.Vector3(),
    pointers: new Map(),
    pinchDistance: 0,
  });

  useEffect(() => {
    const element = events.connected ?? gl.domElement;
    if (!element) return;
    const state = stateRef.current;

    function canZoom() {
      const store = usePlanetStore.getState();
      return store.appState === "exploring" && store.cameraPhase !== "traveling";
    }

    // Pick the anchor for a zoom centred on client pixel (x, y).
    function setAnchor(clientX, clientY) {
      const store = usePlanetStore.getState();
      const controls = controlsRef.current;
      if (!controls || store.cameraPhase === "following") return;

      const rect = element.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      _ndc.set((px / rect.width) * 2 - 1, -(py / rect.height) * 2 + 1);
      _raycaster.setFromCamera(_ndc, camera);

      const mode = store.settings.scaleMode;
      const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);

      // 1. Surface hit on a real body mesh.
      const meshes = [];
      const idByMesh = new Map();
      for (const entry of bodyRegistry.values()) {
        if (!entry.pickMesh) continue;
        meshes.push(entry.pickMesh);
        idByMesh.set(entry.pickMesh, entry.id);
      }
      const hit = _raycaster.intersectObjects(meshes, false)[0];
      if (hit) {
        const id = idByMesh.get(hit.object);
        bodyRegistry.get(id).object3D.getWorldPosition(_centre);
        state.anchorBodyId = id;
        state.anchorOffset.subVectors(hit.point, _centre);
        return;
      }

      // 2. Near a body's disc (rings included) or its true-scale marker. The
      //    closest disc edge to the cursor wins, so a neighbour (the Moon
      //    beside Earth) can't steal the anchor.
      let best = null;
      let bestGap = Infinity;
      for (const entry of bodyRegistry.values()) {
        if (!entry.object3D) continue;
        entry.object3D.getWorldPosition(_centre);
        _proj.copy(_centre).project(camera);
        if (_proj.z > 1) continue; // behind the camera
        const sx = ((_proj.x + 1) / 2) * rect.width;
        const sy = ((1 - _proj.y) / 2) * rect.height;
        const dist = camera.position.distanceTo(_centre);
        const body = getScaledBody(entry.id, mode);
        const extent = (body?.radius ?? entry.radius) * (body?.ringOuter ?? 1);
        const discPx = (extent / (dist * tanHalf)) * (rect.height / 2);
        const gap = Math.hypot(sx - px, sy - py) - discPx;
        if (gap <= PICK_MARGIN_PX && gap < bestGap) {
          best = entry.id;
          bestGap = gap;
        }
      }
      if (best) {
        // Anchor on the body's centre, not the exact cursor point: at true
        // scale a sub-pixel planet sits ~1 px from the cursor, and zooming
        // 10,000× about the cursor would magnify that gap until the planet
        // slid off-screen. About its centre the planet stays put and grows;
        // once the cursor lies on its disc, the surface hit (1.) takes over.
        state.anchorBodyId = best;
        state.anchorOffset.set(0, 0, 0);
        return;
      }

      // 3. Empty space: the cursor ray at the pivot's depth.
      camera.getWorldDirection(_fwd);
      _plane.setFromNormalAndCoplanarPoint(_fwd, controls.target);
      state.anchorBodyId = null;
      if (!_raycaster.ray.intersectPlane(_plane, state.anchorWorld)) {
        state.anchorWorld.copy(controls.target);
      }
    }

    function addZoom(logStep, clientX, clientY) {
      if (!canZoom()) return;
      setAnchor(clientX, clientY);
      const step = THREE.MathUtils.clamp(logStep, -MAX_STEP_LOG, MAX_STEP_LOG);
      // Reversing direction mid-glide cancels the rest of the old glide.
      if (Math.sign(step) !== Math.sign(state.pendingLog)) state.pendingLog = 0;
      state.pendingLog += step;
    }

    function onWheel(e) {
      e.preventDefault();
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 16; // lines
      else if (e.deltaMode === 2) delta *= element.clientHeight; // pages
      if (e.ctrlKey) delta *= PINCH_WHEEL_GAIN; // trackpad pinch
      addZoom(delta * LOG_PER_PX, e.clientX, e.clientY);
    }

    // Two-finger pinch on touch screens, anchored at the midpoint.
    function onPointerDown(e) {
      if (e.pointerType !== "touch") return;
      state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (state.pointers.size === 2) state.pinchDistance = pinchDistance();
    }
    function onPointerMove(e) {
      if (e.pointerType !== "touch" || !state.pointers.has(e.pointerId)) return;
      state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (state.pointers.size !== 2 || state.pinchDistance <= 0) return;
      const d = pinchDistance();
      const [a, b] = [...state.pointers.values()];
      // Fingers apart -> ratio < 1 -> negative log -> zoom in.
      addZoom(Math.log(state.pinchDistance / d), (a.x + b.x) / 2, (a.y + b.y) / 2);
      state.pinchDistance = d;
    }
    function onPointerUp(e) {
      state.pointers.delete(e.pointerId);
      if (state.pointers.size < 2) state.pinchDistance = 0;
    }
    function pinchDistance() {
      const [a, b] = [...state.pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [camera, gl, events, controlsRef]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const state = stateRef.current;
    const store = usePlanetStore.getState();
    const phase = store.cameraPhase;
    const mode = store.settings.scaleMode;
    const config = getSceneConfig(mode);

    // In the overview this hook owns the distance limits: OrbitControls clamps
    // on every update() and would push back against zooming onto a planet
    // closer than the overview minimum.
    if (phase === "idle") {
      controls.minDistance = 0;
      controls.maxDistance = Infinity;
    }

    if (phase === "traveling") {
      state.pendingLog = 0;
      return;
    }
    if (Math.abs(state.pendingLog) < 1e-5) {
      state.pendingLog = 0;
      return;
    }

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const applyLog = reduced
      ? state.pendingLog
      : state.pendingLog * (1 - Math.exp(-DAMP_LAMBDA * Math.min(delta, 0.1)));
    state.pendingLog -= applyLog;
    let s = Math.exp(applyLog);

    // ---- Following a body: locked dolly along camera -> centre.
    if (phase === "following") {
      const id = store.selectedPlanetId;
      const entry = id && bodyRegistry.get(id);
      if (!entry?.object3D) return;
      entry.object3D.getWorldPosition(_centre);
      const body = getScaledBody(id, mode);
      const guard = (body?.radius ?? entry.radius) * (id === "sun" ? SUN_GUARD : SURFACE_GUARD);
      const r = camera.position.distanceTo(_centre);
      const lo = Math.max(controls.minDistance, guard);
      const hi = controls.maxDistance;
      const next = THREE.MathUtils.clamp(r * s, lo, hi);
      if (next === lo || next === hi) state.pendingLog = 0;
      _tmp.subVectors(camera.position, _centre).multiplyScalar(next / r);
      camera.position.copy(_centre).add(_tmp);
      controls.update();
      return;
    }

    // ---- Overview: homothety about the anchor P.
    const anchorEntry = state.anchorBodyId && bodyRegistry.get(state.anchorBodyId);
    if (anchorEntry?.object3D) {
      anchorEntry.object3D.getWorldPosition(_centre);
      _p.copy(_centre).add(state.anchorOffset); // rides along with the orbit
    } else {
      state.anchorBodyId = null;
      _p.copy(state.anchorWorld);
    }

    const pivotDistance = camera.position.distanceTo(controls.target);
    // Max zoom-out, measured camera -> pivot as before.
    s = Math.min(s, config.MAX_CAMERA_DISTANCE / Math.max(pivotDistance, 1e-9));

    if (anchorEntry) {
      // Never enter the anchored body: bisect for the largest allowed step.
      const body = getScaledBody(state.anchorBodyId, mode);
      const guard =
        (body?.radius ?? anchorEntry.radius) *
        (state.anchorBodyId === "sun" ? SUN_GUARD : SURFACE_GUARD);
      const inside = (k) =>
        _camNext.subVectors(camera.position, _p).multiplyScalar(k).add(_p).distanceTo(_centre) < guard;
      if (s < 1 && inside(s)) {
        let lo = s;
        let hi = 1;
        for (let i = 0; i < 24; i++) {
          const mid = (lo + hi) / 2;
          if (inside(mid)) lo = mid;
          else hi = mid;
        }
        s = hi;
        state.pendingLog = 0;
      }
    } else {
      // Over empty space keep the overview's minimum distance to the pivot.
      s = Math.max(s, config.MIN_CAMERA_DISTANCE / Math.max(pivotDistance, 1e-9));
    }

    // Camera and pivot scale about P together: P stays under the cursor.
    camera.position.sub(_p).multiplyScalar(s).add(_p);
    controls.target.sub(_p).multiplyScalar(s).add(_p);

    camera.getWorldDirection(_fwd);
    if (anchorEntry) {
      // Re-seat the pivot on the view axis at the body's depth: the view does
      // not change, but rotating now turns around (roughly) the body.
      const depth = _tmp.subVectors(_centre, camera.position).dot(_fwd);
      if (depth > 0) controls.target.copy(camera.position).addScaledVector(_fwd, depth);
    } else if (s > 1 && controls.target.length() > PIVOT_RANGE[mode]) {
      // Zooming out over empty space must not strand the pivot far outside
      // the system: slide it along the view axis back to the Sun's depth.
      const depth = _tmp.copy(camera.position).negate().dot(_fwd);
      if (depth > 0) controls.target.copy(camera.position).addScaledVector(_fwd, depth);
    }
    controls.update();

    // Dynamic focus: close enough to the anchored body -> select it in place.
    if (anchorEntry && s < 1 && store.selectedPlanetId !== state.anchorBodyId) {
      const body = getScaledBody(state.anchorBodyId, mode);
      const radius = body?.radius ?? anchorEntry.radius;
      const dist = camera.position.distanceTo(_centre);
      const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      const diameterShare = (2 * radius) / (2 * dist * tanHalf); // of viewport height
      if (diameterShare >= AUTO_FOCUS_FRACTION) {
        const id = state.anchorBodyId;
        state.pendingLog = 0;
        state.anchorBodyId = null;
        store.selectPlanet(id, { inPlace: true });
      }
    }
  });
}
