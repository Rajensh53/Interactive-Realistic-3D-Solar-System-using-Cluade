import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { SUN } from "../../data/planets.js";
import {
  registerBody,
  unregisterBody,
  simulationClock,
} from "../../utils/planetUtils.js";
import { usePlanetStore } from "../../hooks/usePlanetStore.js";
import { getTexture } from "../../utils/textureUtils.js";
import Atmosphere from "./Atmosphere.jsx";
import SelectionRing from "./SelectionRing.jsx";
import PlanetLabel from "./PlanetLabel.jsx";

/**
 * The Sun — the scene's only real light source and a selectable central body.
 *
 * A photospheric granulation map bright enough to trip the bloom threshold, a
 * soft corona shell, interactive hover/selection, and the point light every
 * planet is lit by.
 */
function Sun() {
  const groupRef = useRef(null);
  const spinRef = useRef(null);
  const currentScaleRef = useRef(1.0);
  const surfaceMap = getTexture(SUN.texture);

  const coreColor = useMemo(
    () =>
      surfaceMap
        ? new THREE.Color("#ffffff").multiplyScalar(2.2)
        : new THREE.Color(SUN.fallbackColor).multiplyScalar(2.6),
    [surfaceMap],
  );

  useLayoutEffect(() => {
    if (groupRef.current) {
      registerBody(SUN.id, groupRef.current, SUN.radius);
    }
    return () => unregisterBody(SUN.id);
  }, []);

  useEffect(() => {
    return () => {
      if (usePlanetStore.getState().hoveredPlanetId === SUN.id) {
        document.body.style.cursor = "auto";
      }
    };
  }, []);

  const handlePointerEnter = useCallback((e) => {
    e.stopPropagation();
    usePlanetStore.getState().setHovered(SUN.id);
    document.body.style.cursor = "pointer";
  }, []);

  const handlePointerLeave = useCallback((e) => {
    e.stopPropagation();
    usePlanetStore.getState().clearHovered(SUN.id);
    document.body.style.cursor = "auto";
  }, []);

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    usePlanetStore.getState().selectPlanet(SUN.id);
  }, []);

  useFrame((_, delta) => {
    if (spinRef.current) {
      spinRef.current.rotation.y = SUN.rotationSpeed * simulationClock.time;
    }

    // Hover scale animation
    const hovered = usePlanetStore.getState().hoveredPlanetId === SUN.id;
    const targetScale = hovered ? 1.03 : 1.0;
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

  return (
    <group ref={groupRef}>
      <mesh
        ref={spinRef}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
      >
        <sphereGeometry args={[SUN.radius, 64, 32]} />
        <meshBasicMaterial
          map={surfaceMap ?? null}
          color={coreColor}
          toneMapped={false}
        />
      </mesh>

      {/* Corona */}
      <Atmosphere
        radius={SUN.radius}
        color={SUN.fallbackColor}
        scale={1.35}
        intensity={0.6}
        power={2.2}
        toneMapped={false}
      />

      {/* Pulsing selection indicator ring */}
      <SelectionRing bodyId={SUN.id} radius={SUN.radius} />

      {/* Floating billboarded label */}
      <PlanetLabel body={SUN} yOffset={SUN.radius + 1.2} />

      {/* decay={0} keeps intensity constant across the system */}
      <pointLight intensity={2.2} decay={0} color="#fff2dc" />
    </group>
  );
}

export default memo(Sun);

