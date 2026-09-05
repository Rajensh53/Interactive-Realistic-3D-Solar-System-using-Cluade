import { memo, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import {
  registerBody,
  unregisterBody,
  simulationClock,
} from "../../utils/planetUtils.js";
import { getTexture } from "../../utils/textureUtils.js";

/**
 * A moon orbiting a planet.
 *
 * Rendered as a child of its parent's orbit group, so it inherits the planet's
 * position for free and only needs to solve its own small circular orbit.
 *
 * Moon orbits sit *outside* the parent's axial-tilt group: the Moon's 5.1°
 * inclination is measured against the ecliptic, not Earth's equator, so tying
 * it to Earth's 23.4° tilt would be wrong.
 */
function Moon({ moon }) {
  const orbitRef = useRef(null);
  const spinRef = useRef(null);

  // Only Earth's Moon has a map at this resolution; the rest render from their
  // measured colour, which is why the tint is conditional (spec §28).
  const surfaceMap = getTexture(moon.texture);

  // A group tilted by the moon's orbital inclination; the moon itself moves in
  // the flat plane inside it.
  const inclinationRotation = useMemo(
    () => [moon.inclination, 0, 0],
    [moon.inclination],
  );

  useLayoutEffect(() => {
    registerBody(moon.id, orbitRef.current, moon.radius);
    return () => unregisterBody(moon.id);
  }, [moon.id, moon.radius]);

  useFrame(() => {
    const t = simulationClock.time;
    const angle = moon.initialAngle + (Math.PI * 2 * t) / moon.orbitTimeSeconds;

    const orbit = orbitRef.current;
    if (orbit) {
      // Circular orbit, same counter-clockwise convention as the planets.
      orbit.position.x = moon.orbitRadius * Math.cos(angle);
      orbit.position.z = -moon.orbitRadius * Math.sin(angle);
    }

    // Tidally locked bodies aside, a slow deterministic spin reads well.
    if (spinRef.current) {
      spinRef.current.rotation.y = moon.rotationSpeed * t;
    }
  });

  return (
    <group rotation={inclinationRotation}>
      <group ref={orbitRef}>
        <mesh ref={spinRef} castShadow={false} receiveShadow={false}>
          <sphereGeometry args={[moon.radius, 32, 16]} />
          <meshStandardMaterial
            map={surfaceMap ?? null}
            color={surfaceMap ? "#ffffff" : moon.fallbackColor}
            roughness={moon.roughness ?? 0.9}
            metalness={0}
          />
        </mesh>

        {/* Titan's nitrogen haze — a faint additive shell. */}
        {moon.hazeColor ? (
          <mesh scale={1.08}>
            <sphereGeometry args={[moon.radius, 24, 12]} />
            <meshBasicMaterial
              color={moon.hazeColor}
              transparent
              opacity={0.16}
              side={THREE.BackSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        ) : null}
      </group>
    </group>
  );
}

// Moon data objects come from a module-level array, so their identity is stable
// and this memo never re-renders after mount.
export default memo(Moon);
