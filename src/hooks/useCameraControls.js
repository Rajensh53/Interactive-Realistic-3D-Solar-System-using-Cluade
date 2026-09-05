import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";

import { usePlanetStore } from "./usePlanetStore.js";
import { getBodyById } from "../data/planets.js";
import { bodyRegistry, SCENE } from "../utils/planetUtils.js";
import { getBodyFraming, getTravelDuration } from "../utils/animationUtils.js";

const _overviewCam = new THREE.Vector3(
  SCENE.OVERVIEW_CAMERA.x,
  SCENE.OVERVIEW_CAMERA.y,
  SCENE.OVERVIEW_CAMERA.z,
);
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
 * @param {React.RefObject<import('three-stdlib').OrbitControls>} controlsRef
 */
export function useCameraControls(controlsRef) {
  const { camera } = useThree();

  const selectedPlanetId = usePlanetStore((s) => s.selectedPlanetId);
  const setCameraPhase = usePlanetStore((s) => s.setCameraPhase);

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
  });

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

    // CASE 1: Deselection -> Return to Overview
    if (!selectedPlanetId) {
      setCameraPhase("traveling");
      controls.enabled = false;

      state.active = true;
      state.isReturning = true;
      state.targetBody = null;
      state.proxy.p = 0;
      state.startCamPos.copy(camera.position);
      state.startTargetPos.copy(controls.target);

      const distance = camera.position.distanceTo(_overviewCam);
      const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const duration = prefersReducedMotion
        ? 0.02
        : Math.min(Math.max(1.0 + distance / 45, 1.2), 2.4);

      activeTweenRef.current = gsap.to(state.proxy, {
        p: 1,
        duration,
        ease: "power3.inOut",
        onUpdate: () => {
          const p = state.proxy.p;
          camera.position.lerpVectors(state.startCamPos, _overviewCam, p);
          controls.target.lerpVectors(state.startTargetPos, _origin, p);
          controls.update();
        },
        onComplete: () => {
          state.active = false;
          state.isReturning = false;
          controls.minDistance = SCENE.MIN_CAMERA_DISTANCE;
          controls.maxDistance = SCENE.MAX_CAMERA_DISTANCE;
          controls.enabled = true;
          controls.update();
          setCameraPhase("idle");
        },
      });
      return;
    }

    // CASE 2: Body selected -> Spherical travel to moving target
    const body = getBodyById(selectedPlanetId);
    const entry = bodyRegistry.get(selectedPlanetId);
    if (!body || !entry?.object3D) return;

    setCameraPhase("traveling");
    controls.enabled = false;

    entry.object3D.getWorldPosition(_currentBodyPos);
    const framing = getBodyFraming(body, _currentBodyPos, camera.position);

    // Initial offsets relative to the body
    const startOffset = new THREE.Vector3().subVectors(
      camera.position,
      _currentBodyPos,
    );
    state.sphericalStart.setFromVector3(startOffset);
    state.sphericalEnd.setFromVector3(framing.viewOffset);

    state.active = true;
    state.isReturning = false;
    state.targetBody = body;
    state.framing = framing;
    state.proxy.p = 0;

    const travelDist = startOffset.length();
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = prefersReducedMotion
      ? 0.02
      : getTravelDuration(travelDist);

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
  }, [selectedPlanetId, camera, controlsRef, setCameraPhase]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const phase = usePlanetStore.getState().cameraPhase;
    const state = travelStateRef.current;

    // 1. TRAVELING TO BODY
    if (phase === "traveling" && state.active && !state.isReturning) {
      const entry = bodyRegistry.get(selectedPlanetId);
      if (!entry?.object3D) return;

      // Sample current position of the orbiting body
      entry.object3D.getWorldPosition(_currentBodyPos);

      const p = state.proxy.p;
      const r = THREE.MathUtils.lerp(
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
