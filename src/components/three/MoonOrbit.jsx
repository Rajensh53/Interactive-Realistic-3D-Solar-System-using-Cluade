import { memo, useEffect, useMemo } from "react";
import * as THREE from "three";

/**
 * Renders a circular orbital path trace for a moon around its parent planet.
 *
 * Placed in the parent planet's coordinate space with the moon's inclination.
 */
function MoonOrbit({ moon, segments = 64 }) {
  const geometry = useMemo(() => {
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      points.push(
        new THREE.Vector3(
          moon.orbitRadius * Math.cos(theta),
          0,
          moon.orbitRadius * Math.sin(theta),
        ),
      );
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [moon.orbitRadius, segments]);

  const inclinationRotation = useMemo(
    () => [moon.inclination, 0, 0],
    [moon.inclination],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group rotation={inclinationRotation}>
      {/* @ts-ignore R3F line element */}
      <line geometry={geometry}>
        <lineBasicMaterial
          color={moon.fallbackColor ?? "#ffffff"}
          transparent
          opacity={0.18}
          depthWrite={false}
        />
      </line>
    </group>
  );
}

export default memo(MoonOrbit);
