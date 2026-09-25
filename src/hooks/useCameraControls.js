import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";

import { usePlanetStore } from "./usePlanetStore.js";
import { getScaledBody } from "../data/planets.js";
import { bodyRegistry, cameraAnchors, getSceneConfig } from "../utils/planetUtils.js";
import { getBodyFraming, getTravelDuration } from "../utils/animationUtils.js";

const _overviewCam = new THREE.Vector3();
const _origin = new THREE.Vector3(0, 0, 0);

const _currentBodyPos = new THREE.Vector3();
const _camOffset = new THREE.Vector3();
const _delta = new THREE.Vector3();

/**
 * Orchestrates cinematic camera travel, orbit following, and return to overview.
 *
 * State Machine:
 *  - 'idle': Overview camera with full system bounds (0, 0, 0).
 *  - 'traveling': GSAP spherical arc tween toward the moving target (controls disabled).
 *  - 'following': Camera and OrbitControls target continuously follow the planet's orbit.
 *
 * Scale modes: switching between compact and true scale re-runs the same
 * flow — back to that mode's overview, or a fresh flight to the selected body
 * at its new position. At true scale a flight can span 30,000 u down to
 * 0.2 u, so the camera radius is interpolated logarithmically; a linear lerp
 * would hang far away for the whole tween and then snap in.
 *
 * In-place focus: a selection made by cursor-zoom auto-focus
 * (`selectionSource === "inPlace"`) skips the flight. The camera stays where
 * the user zoomed it; only the pivot eases onto the body's centre (~0.5 s), so
 * the body glides to the middle of the screen, then following begins.
 *
 * @param {React.RefObject<import('three-stdlib').OrbitControls>} controlsRef
 */
export function useCameraControls(controlsRef) {
  const { camera } = useThree();

  const selectedPlanetId = usePlanetStore((s) => s.selectedPlanetId);
  const scaleMode = usePlanetStore((s) => s.settings.scaleMode);
  const setCameraPhase = usePlanetStore((s) => s.setCameraPhase);
  const trueScale = scaleMode === "true";

  // Active tween handle
  const activeTweenRef = useRef(null);

  // Travel animation state
  const travelStateRef = useRef({
    active: false,
    proxy: { p: 0 },
    sphericalStart: new THREE.Spherical(),
    sphericalEnd: new THREE.Spherical(),
    targetBody: null,
    framing: null,
    // For return to overview
    isReturning: false,
    startCamPos: new THREE.Vector3(),
    startTargetPos: new THREE.Vector3(),
    // In-place focus
    recentre: false,
    lastBodyPos: new THREE.Vector3(),
  });
  const prevSelectedRef = useRef(null);
  const prevScaleModeRef = useRef(scaleMode);

  // Track selected planet changes
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    // Cancel any in-flight tween
    if (activeTweenRef.current) {
      activeTweenRef.current.kill();
      activeTweenRef.current = null;
    }

    const state = travelStateRef.current;
    const config = getSceneConfig(scaleMode);
    state.recentre = false;

    // In place only for a fresh selection made by cursor zoom. A scale-mode
    // switch moves the body far away, so that always flies.
    const freshSelection = prevSelectedRef.current !== selectedPlanetId;
    const scaleChanged = prevScaleModeRef.current !== scaleMode;
    prevSelectedRef.current = selectedPlanetId;
    prevScaleModeRef.current = scaleMode;
    const inPlace =
      freshSelection &&
      !scaleChanged &&
      usePlanetStore.getState().selectionSource === "inPlace";

    // CASE 1: Deselection -> Return to Overview
    if (!selectedPlanetId) {
      setCameraPhase("traveling");
      controls.enabled = false;
      releaseDistanceLimits(controls);

      state.active = true;
      state.isReturning = true;
      state.targetBody = null;
      state.proxy.p = 0;
      state.startCamPos.copy(camera.position);
      state.startTargetPos.copy(controls.target);
      _overviewCam.set(
        config.OVERVIEW_CAMERA.x,
        config.OVERVIEW_CAMERA.y,
        config.OVERVIEW_CAMERA.z,
      );
      const overviewCam = _overviewCam.clone();

      const distance = camera.position.distanceTo(overviewCam);
      const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const duration = prefersReducedMotion
        ? 0.02
        : trueScale
          ? getTravelDuration(distance, true)
          : Math.min(Math.max(1.0 + distance / 45, 1.2), 2.4);

      activeTweenRef.current = gsap.to(state.proxy, {
        p: 1,
        duration,
        ease: "power3.inOut",
        onUpdate: () => {
          const p = state.proxy.p;
          camera.position.lerpVectors(state.startCamPos, overviewCam, p);
          controls.target.lerpVectors(state.startTargetPos, _origin, p);
          controls.update();
        },
        onComplete: () => {
          state.active = false;
          state.isReturning = false;
          controls.minDistance = config.MIN_CAMERA_DISTANCE;
          controls.maxDistance = config.MAX_CAMERA_DISTANCE;
          controls.enabled = true;
          controls.update();
          setCameraPhase("idle");
        },
      });
      return;
    }

    // CASE 2: Body selected -> Spherical travel to moving target
    const body = getScaledBody(selectedPlanetId, scaleMode);
    const entry = bodyRegistry.get(selectedPlanetId);
    if (!body || !entry?.object3D) return;

    setCameraPhase("traveling");
    controls.enabled = false;
    releaseDistanceLimits(controls);

    entry.object3D.getWorldPosition(_currentBodyPos);
    const framing = getBodyFraming(body, _currentBodyPos, camera.position, trueScale);

    if (inPlace) {
      state.active = true;
      state.isReturning = false;
      state.recentre = true;
      state.targetBody = body;
      state.proxy.p = 0;
      state.startTargetPos.copy(controls.target);
      state.lastBodyPos.copy(_currentBodyPos);

      const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      activeTweenRef.current = gsap.to(state.proxy, {
        p: 1,
        duration: prefersReducedMotion ? 0.02 : 0.5,
        ease: "power2.out",
        onComplete: () => {
          state.active = false;
          state.recentre = false;
          // Keep the distance the user zoomed to inside the limits.
          entry.object3D.getWorldPosition(_currentBodyPos);
          const d = camera.position.distanceTo(_currentBodyPos);
          controls.minDistance = Math.min(framing.minDistance, d);
          controls.maxDistance = Math.max(framing.maxDistance, d);
          controls.enabled = true;
          controls.update();
          setCameraPhase("following");
        },
      });
      return () => {
        if (activeTweenRef.current) activeTweenRef.current.kill();
      };
    }

    // Initial offsets relative to the body
    const startOffset = new THREE.Vector3().subVectors(
      camera.position,
      _currentBodyPos,
    );
    state.sphericalStart.setFromVector3(startOffset);
    state.sphericalEnd.setFromVector3(framing.viewOffset);

    state.active = true;
    state.isReturning = false;
    state.logRadius = trueScale;
    state.targetBody = body;
    state.framing = framing;
    state.proxy.p = 0;

    const travelDist = startOffset.length();
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = prefersReducedMotion
      ? 0.02
      : getTravelDuration(travelDist, trueScale);

    activeTweenRef.current = gsap.to(state.proxy, {
      p: 1,
      duration,
      ease: "power3.inOut",
      onComplete: () => {
        state.active = false;
        controls.minDistance = framing.minDistance;
        controls.maxDistance = framing.maxDistance;
        controls.enabled = true;
        controls.update();
        setCameraPhase("following");
      },
    });

    return () => {
      if (activeTweenRef.current) {
        activeTweenRef.current.kill();
      }
    };
  }, [selectedPlanetId, scaleMode, trueScale, camera, controlsRef, setCameraPhase]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    updateClipPlanes(camera, controls, scaleMode);

    const phase = usePlanetStore.getState().cameraPhase;
    const state = travelStateRef.current;

    // 0. IN-PLACE FOCUS: camera rides with the body; the pivot eases onto it.
    if (phase === "traveling" && state.active && state.recentre) {
      const entry = bodyRegistry.get(selectedPlanetId);
      if (!entry?.object3D) return;
      entry.object3D.getWorldPosition(_currentBodyPos);
      _delta.subVectors(_currentBodyPos, state.lastBodyPos);
      state.lastBodyPos.copy(_currentBodyPos);
      camera.position.add(_delta);
      state.startTargetPos.add(_delta);
      controls.target.lerpVectors(state.startTargetPos, _currentBodyPos, state.proxy.p);
      controls.update();
      return;
    }

    // 1. TRAVELING TO BODY
    if (phase === "traveling" && state.active && !state.isReturning) {
      const entry = bodyRegistry.get(selectedPlanetId);
      if (!entry?.object3D) return;

      // Sample current position of the orbiting body
      entry.object3D.getWorldPosition(_currentBodyPos);

      const p = state.proxy.p;
      const r = state.logRadius
        ? Math.exp(
            THREE.MathUtils.lerp(
              Math.log(Math.max(state.sphericalStart.radius, 1e-6)),
              Math.log(Math.max(state.sphericalEnd.radius, 1e-6)),
              p,
            ),
          )
        : THREE.MathUtils.lerp(
            state.sphericalStart.radius,
            state.sphericalEnd.radius,
            p,
          );
      const phi = THREE.MathUtils.lerp(
        state.sphericalStart.phi,
        state.sphericalEnd.phi,
        p,
      );

      // Shortest circular arc for azimuth (theta)
      let deltaTheta =
        (state.sphericalEnd.theta - state.sphericalStart.theta) % (Math.PI * 2);
      if (deltaTheta > Math.PI) deltaTheta -= Math.PI * 2;
      if (deltaTheta < -Math.PI) deltaTheta += Math.PI * 2;
      const theta = state.sphericalStart.theta + deltaTheta * p;

      _camOffset.setFromSphericalCoords(r, phi, theta);
      camera.position.copy(_currentBodyPos).add(_camOffset);
      controls.target.copy(_currentBodyPos);
      controls.update();
      return;
    }

    // 2. FOLLOWING BODY IN ORBIT
    if (phase === "following" && selectedPlanetId) {
      const entry = bodyRegistry.get(selectedPlanetId);
      if (!entry?.object3D) return;

      entry.object3D.getWorldPosition(_currentBodyPos);

      // Shift camera by the body's delta movement since last frame
      _delta.subVectors(_currentBodyPos, controls.target);
      controls.target.copy(_currentBodyPos);
      camera.position.add(_delta);
      controls.update();
    }
  });
}

/**
 * Keeps the backdrop (stars, sky dome, nebulae) on the camera in true-scale
 * mode. Call it after every hook that moves the camera (flights, follow,
 * cursor zoom) so its frame runs last and the sky never lags a frame behind.
 */
export function useCameraAnchors() {
  const { camera } = useThree();
  useFrame(() => {
    for (const anchor of cameraAnchors) anchor.position.copy(camera.position);
  });
}

/**
 * Keep the depth range matched to what the camera is looking at.
 *
 * Compact mode uses fixed planes. At true scale the camera may sit 0.1 u from
 * the Moon and still need to draw Neptune's orbit 30,000 u away, so the near
 * plane follows the distance to the orbit target (the far plane stays fixed),
 * which keeps close-up surfaces from z-fighting.
 *
 * A reversed depth buffer was tried for this and rejected: it dimmed the Sun's
 * additive corona in both modes.
 */
function updateClipPlanes(camera, controls, scaleMode) {
  const config = getSceneConfig(scaleMode);
  let near = config.NEAR;
  if (scaleMode === "true") {
    const d = camera.position.distanceTo(controls.target);
    near = THREE.MathUtils.clamp(d * 0.002, config.NEAR, 1);
  }
  const far = config.FAR;
  // Only rebuild the projection when a plane moves meaningfully.
  if (Math.abs(camera.near - near) > near * 0.1 || camera.far !== far) {
    camera.near = near;
    camera.far = far;
    camera.updateProjectionMatrix();
  }
}

/**
 * Lift the zoom limits for the duration of a flight.
 *
 * The tweens call `controls.update()` every frame, and OrbitControls clamps
 * the camera to [minDistance, maxDistance] even while disabled. Left in place,
 * the previous body's limits cut every flight short: returning from Mars
 * stopped at its 45 u max instead of the 110 u overview. Each flight sets the
 * limits for its destination when it lands.
 */
function releaseDistanceLimits(controls) {
  controls.minDistance = 0;
  controls.maxDistance = Infinity;
}
