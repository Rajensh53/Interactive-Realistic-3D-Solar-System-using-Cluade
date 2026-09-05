import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import Moon from "./Moon.jsx";
import MoonOrbit from "./MoonOrbit.jsx";
import Rings from "./Rings.jsx";
import CloudLayer from "./CloudLayer.jsx";
import Atmosphere from "./Atmosphere.jsx";
import PlanetLabel from "./PlanetLabel.jsx";
import { getMoonsFor } from "../../data/moons.js";
import { usePlanetMaterial, useSunDirection } from "../../hooks/usePlanetMaterial.js";
import { usePlanetStore } from "../../hooks/usePlanetStore.js";
import { createLimbGlowMaterial } from "../../shaders/limbGlow.js";
import {
  orbitalPositionAt,
  registerBody,
  unregisterBody,
  simulationClock,
} from "../../utils/planetUtils.js";

// Scratch object reused every frame by every planet — never allocate in the
// render loop.
const _pos = { x: 0, y: 0, z: 0 };

/**
 * A planet: its elliptical orbit, its axial tilt, its spin, its rings, its
 * atmosphere, its moons, its interactive hit testing, and its hover/selection
 * state.
 *
 * Node hierarchy, and why:
 *
 *   <group orbitRef>              position solved from the ellipse each frame
 *     <group spinGroup tilt>      constant axial tilt about Z, scales on hover
 *       <mesh spinRef>            rotates about its own (now tilted) Y axis
 *       <CloudLayer />            spins faster than the surface below it
 *       <Rings />                 rings lie in the equatorial plane, so they
 *                                 belong inside the tilt group
 *     <Atmosphere />              a rim glow is view-dependent, not surface-
 *                                 bound, so tilt and spin are irrelevant to it
 *     <mesh hoverGlow />          windowed Fresnel outline shell, fades on hover
 *     <PlanetLabel />             floating 3D typography
 *     <mesh hitProxy />           enlarged invisible hit sphere for ergonomic clicking
 *     <Moon />…                   moons are inclined to the ecliptic, so they
 *                                 sit outside the tilt group
 */
function Planet({ body }) {
  const orbitRef = useRef(null);
  const spinGroupRef = useRef(null);
  const spinRef = useRef(null);
  const hoverGlowRef = useRef(null);
  const currentScaleRef = useRef(1.0);

  const moons = getMoonsFor(body.id);
  const showOrbits = usePlanetStore((s) => s.settings.orbitLines);

  // Shared by the surface material's night-lights mask and the atmosphere's
  // day/night falloff, so both agree on where the terminator is.
  const sunDirection = useSunDirection();
  const surfaceMaterial = usePlanetMaterial(body, sunDirection);

  // Tilt about Z tips the spin axis toward +X. Constant, so it is set once
  // declaratively rather than touched each frame.
  const tiltRotation = useMemo(() => [0, 0, body.axialTilt], [body.axialTilt]);

  // Venus's haze is thicker and warmer than Earth's air; a shared component
  // covers both, driven by whichever colour the body declares.
  const halo = body.atmosphereColor
    ? { color: body.atmosphereColor, scale: 1.055, intensity: 0.7, power: 3.6 }
    : body.hazeColor
      ? { color: body.hazeColor, scale: 1.09, intensity: 0.8, power: 2.0 }
      : null;

  // Subtle hover outline glow — omnidirectional windowed Fresnel rim
  const hoverGlowMaterial = useMemo(
    () =>
      createLimbGlowMaterial({
        color: body.atmosphereColor || body.fallbackColor || "#38bdf8",
        scale: 1.15,
        intensity: 0.0,
        power: 2.8,
        toneMapped: false,
      }),
    [body],
  );

  useEffect(() => () => hoverGlowMaterial.dispose(), [hoverGlowMaterial]);

  // Ensure cursor is restored if unmounted while hovered
  useEffect(() => {
    return () => {
      if (usePlanetStore.getState().hoveredPlanetId === body.id) {
        document.body.style.cursor = "auto";
      }
    };
  }, [body.id]);

  useLayoutEffect(() => {
    registerBody(body.id, orbitRef.current, body.radius);
    orbitRef.current.userData.sunDirection = sunDirection;
    return () => unregisterBody(body.id);
  }, [body.id, body.radius, sunDirection]);

  // Pointer event handlers with stopPropagation to prevent canvas bubbling
  const handlePointerEnter = useCallback(
    (e) => {
      e.stopPropagation();
      usePlanetStore.getState().setHovered(body.id);
      document.body.style.cursor = "pointer";
    },
    [body.id],
  );

  const handlePointerLeave = useCallback(
    (e) => {
      e.stopPropagation();
      usePlanetStore.getState().clearHovered(body.id);
      document.body.style.cursor = "auto";
    },
    [body.id],
  );

  const handleClick = useCallback(
    (e) => {
      e.stopPropagation();
      usePlanetStore.getState().selectPlanet(body.id);
    },
    [body.id],
  );

  useFrame((_, delta) => {
    const t = simulationClock.time;

    const orbit = orbitRef.current;
    if (orbit) {
      orbitalPositionAt(body, t, _pos);
      orbit.position.set(_pos.x, _pos.y, _pos.z);
      sunDirection.value.set(-_pos.x, -_pos.y, -_pos.z).normalize();
    }

    if (spinRef.current) {
      spinRef.current.rotation.y = body.rotationSpeed * t;
    }

    // Hover animation: smooth scale lerp & outline glow
    const hovered = usePlanetStore.getState().hoveredPlanetId === body.id;

    // 1. Smoothly damp scale (1.0 -> 1.04)
    const targetScale = hovered ? 1.04 : 1.0;
    currentScaleRef.current = THREE.MathUtils.damp(
      currentScaleRef.current,
      targetScale,
      10,
      delta,
    );
    if (spinGroupRef.current) {
      spinGroupRef.current.scale.setScalar(currentScaleRef.current);
    }

    // 2. Smoothly damp hover outline intensity
    const currentIntensity = hoverGlowMaterial.uniforms.uIntensity.value;
    const targetIntensity = hovered ? 0.9 : 0.0;
    const newIntensity = THREE.MathUtils.damp(
      currentIntensity,
      targetIntensity,
      12,
      delta,
    );
    hoverGlowMaterial.uniforms.uIntensity.value = newIntensity;
    if (hoverGlowRef.current) {
      hoverGlowRef.current.visible = newIntensity > 0.005;
    }
  });

  // Small planets (Mercury 0.38, Mars 0.53) span 2-3px at overview distance.
  // Hit proxy floor prevents frustrating pixel-hunting.
  const hitRadius = Math.max(body.radius * 1.25, 1.25);

  return (
    <group ref={orbitRef}>
      {/* Tilt group: first child group in orbitRef (inspected by devBridge) */}
      <group ref={spinGroupRef} rotation={tiltRotation}>
        {/* Surface mesh: first child mesh in tilt group (inspected by devBridge) */}
        <mesh
          ref={spinRef}
          material={surfaceMaterial}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          onClick={handleClick}
        >
          <sphereGeometry args={[body.radius, 64, 32]} />
        </mesh>

        {body.cloudTexture ? <CloudLayer body={body} /> : null}

        {body.ringInner ? (
          <Rings body={body} sunDirection={sunDirection} />
        ) : null}
      </group>

      {halo ? (
        <Atmosphere
          radius={body.radius}
          color={halo.color}
          sunDirection={sunDirection}
          scale={halo.scale}
          intensity={halo.intensity}
          power={halo.power}
        />
      ) : null}

      {/* Hover outline rim glow */}
      <mesh
        ref={hoverGlowRef}
        material={hoverGlowMaterial}
        scale={1.15}
        visible={false}
      >
        <sphereGeometry args={[body.radius, 48, 24]} />
      </mesh>

      {/* Floating billboarded label */}
      <PlanetLabel body={body} />

      {/* Invisible hit proxy sphere for ergonomic click/hover hit testing */}
      <mesh
        name={`hit-proxy-${body.id}`}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
      >
        <sphereGeometry args={[hitRadius, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {showOrbits &&
        moons.map((moon) => (
          <MoonOrbit key={`orbit-${moon.id}`} moon={moon} />
        ))}

      {moons.map((moon) => (
        <Moon key={moon.id} moon={moon} />
      ))}
    </group>
  );
}

// Body objects are module-level constants, so this never re-renders after mount.
export default memo(Planet);

