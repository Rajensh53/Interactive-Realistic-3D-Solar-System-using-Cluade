import { memo, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

import Moon from "./Moon.jsx";
import Rings from "./Rings.jsx";
import CloudLayer from "./CloudLayer.jsx";
import Atmosphere from "./Atmosphere.jsx";
import { getMoonsFor } from "../../data/moons.js";
import { usePlanetMaterial, useSunDirection } from "../../hooks/usePlanetMaterial.js";
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
 * atmosphere and its moons.
 *
 * Node hierarchy, and why:
 *
 *   <group orbitRef>              position solved from the ellipse each frame
 *     <group tilt>                constant axial tilt about Z
 *       <mesh spinRef>            rotates about its own (now tilted) Y axis
 *       <CloudLayer />            spins faster than the surface below it
 *       <Rings />                 rings lie in the equatorial plane, so they
 *                                 belong inside the tilt group
 *     <Atmosphere />              a rim glow is view-dependent, not surface-
 *                                 bound, so tilt and spin are irrelevant to it
 *     <Moon />…                   moons are inclined to the ecliptic, so they
 *                                 sit outside the tilt group
 *
 * Retrograde rotation is encoded entirely by tilt: Venus (177.4°) and Uranus
 * (97.8°) are tipped past vertical, so a positive spin reads as backwards.
 */
function Planet({ body }) {
  const orbitRef = useRef(null);
  const spinRef = useRef(null);

  const moons = getMoonsFor(body.id);

  // Shared by the surface material's night-lights mask and the atmosphere's
  // day/night falloff, so both agree on where the terminator is.
  const sunDirection = useSunDirection();
  const surfaceMaterial = usePlanetMaterial(body, sunDirection);

  // Tilt about Z tips the spin axis toward +X. Constant, so it is set once
  // declaratively rather than touched each frame.
  const tiltRotation = useMemo(() => [0, 0, body.axialTilt], [body.axialTilt]);

  // Venus's haze is thicker and warmer than Earth's air; a shared component
  // covers both, driven by whichever colour the body declares. The powers are
  // what separate them: a high exponent keeps a thin air glow pinned to the
  // limb, a low one lets the haze bleed well onto the disc.
  const halo = body.atmosphereColor
    ? { color: body.atmosphereColor, scale: 1.055, intensity: 0.7, power: 3.6 }
    : body.hazeColor
      ? { color: body.hazeColor, scale: 1.09, intensity: 0.8, power: 2.0 }
      : null;

  useLayoutEffect(() => {
    registerBody(body.id, orbitRef.current, body.radius);
    // Parked on the node so anything holding a reference to the body — the
    // camera controller, diagnostics — can read the terminator without
    // re-deriving it.
    orbitRef.current.userData.sunDirection = sunDirection;
    return () => unregisterBody(body.id);
  }, [body.id, body.radius, sunDirection]);

  useFrame(() => {
    const t = simulationClock.time;

    const orbit = orbitRef.current;
    if (orbit) {
      orbitalPositionAt(body, t, _pos);
      orbit.position.set(_pos.x, _pos.y, _pos.z);

      // The Sun sits at the origin, so the direction to it is simply the
      // negated orbital position. Written straight into the shared uniform —
      // one normalise per planet per frame, and no React involvement.
      sunDirection.value.set(-_pos.x, -_pos.y, -_pos.z).normalize();
    }

    // Spin is derived from absolute time rather than accumulated per frame.
    // Same delta-time independence, but with no drift and exact resumability.
    if (spinRef.current) {
      spinRef.current.rotation.y = body.rotationSpeed * t;
    }
  });

  return (
    <group ref={orbitRef}>
      <group rotation={tiltRotation}>
        <mesh ref={spinRef} material={surfaceMaterial}>
          <sphereGeometry args={[body.radius, 64, 32]} />
        </mesh>

        {body.cloudTexture ? <CloudLayer body={body} /> : null}

        {body.ringInner ? <Rings body={body} /> : null}
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

      {moons.map((moon) => (
        <Moon key={moon.id} moon={moon} />
      ))}
    </group>
  );
}

// Body objects are module-level constants, so this never re-renders after mount.
export default memo(Planet);
