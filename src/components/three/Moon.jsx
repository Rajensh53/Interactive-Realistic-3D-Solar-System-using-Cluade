import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import {
  registerBody,
  unregisterBody,
  simulationClock,
} from "../../utils/planetUtils.js";
import { getTexture } from "../../utils/textureUtils.js";
import { usePlanetStore } from "../../hooks/usePlanetStore.js";
import SelectionRing from "./SelectionRing.jsx";
import PlanetLabel from "./PlanetLabel.jsx";

/**
 * A moon orbiting a planet.
 *
 * Rendered as a child of its parent's orbit group, so it inherits the planet's
 * position for free and solves its own circular orbit.
 *
 * Upgraded in Phase 8 with:
 * - Full interactive hover & click targeting
 * - Invisible hit proxy sphere for easy selection
 * - Hover scale lerp and pointer cursor
 * - Pulsing selection indicator ring
 * - Floating 3D label badge
 */
function Moon({ moon }) {
  const orbitRef = useRef(null);
  const spinRef = useRef(null);
  const currentScaleRef = useRef(1.0);

  // Surface texture or fallback color
  const surfaceMap = getTexture(moon.texture);

  const inclinationRotation = useMemo(
    () => [moon.inclination, 0, 0],
    [moon.inclination],
  );

  useLayoutEffect(() => {
    registerBody(moon.id, orbitRef.current, moon.radius);
    return () => unregisterBody(moon.id);
  }, [moon.id, moon.radius]);

  useEffect(() => {
    return () => {
      if (usePlanetStore.getState().hoveredPlanetId === moon.id) {
        document.body.style.cursor = "auto";
      }
    };
  }, [moon.id]);

  const handlePointerEnter = useCallback(
    (e) => {
      e.stopPropagation();
      usePlanetStore.getState().setHovered(moon.id);
      document.body.style.cursor = "pointer";
    },
    [moon.id],
  );

  const handlePointerLeave = useCallback(
    (e) => {
      e.stopPropagation();
      usePlanetStore.getState().clearHovered(moon.id);
      document.body.style.cursor = "auto";
    },
    [moon.id],
  );

  const handleClick = useCallback(
    (e) => {
      e.stopPropagation();
      usePlanetStore.getState().selectPlanet(moon.id);
    },
    [moon.id],
  );

  useFrame((_, delta) => {
    const t = simulationClock.time;
    const angle = moon.initialAngle + (Math.PI * 2 * t) / moon.orbitTimeSeconds;

    const orbit = orbitRef.current;
    if (orbit) {
      orbit.position.x = moon.orbitRadius * Math.cos(angle);
      orbit.position.z = -moon.orbitRadius * Math.sin(angle);
    }

    // Slow deterministic axial spin
    if (spinRef.current) {
      spinRef.current.rotation.y = moon.rotationSpeed * t;
    }

    // Hover scale animation: smooth lerp between 1.0 and 1.08
    const hovered = usePlanetStore.getState().hoveredPlanetId === moon.id;
    const targetScale = hovered ? 1.08 : 1.0;
    currentScaleRef.current = THREE.MathUtils.damp(
      currentScaleRef.current,
      targetScale,
      10,
      delta,
    );
    if (spinRef.current) {
      spinRef.current.scale.setScalar(currentScaleRef.current);
    }
  });

  const hitRadius = Math.max(moon.radius * 1.8, 0.75);

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

        {/* Titan's nitrogen haze — a faint additive shell */}
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

        {/* Selection indicator ring */}
        <SelectionRing bodyId={moon.id} radius={moon.radius} />

        {/* Floating 3D label badge */}
        <PlanetLabel body={moon} yOffset={moon.radius + 0.65} />

        {/* Invisible hit proxy sphere for easy hover & click */}
        <mesh
          name={`hit-proxy-${moon.id}`}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          onClick={handleClick}
        >
          <sphereGeometry args={[hitRadius, 16, 16]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

export default memo(Moon);
