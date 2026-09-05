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
import {
  SUN_VERTEX_SHADER,
  SUN_FRAGMENT_SHADER,
} from "../../shaders/sunShader.js";
import Atmosphere from "./Atmosphere.jsx";
import PlanetLabel from "./PlanetLabel.jsx";
import SunCoronaSprite from "./SunCoronaSprite.jsx";
import SolarFlares from "./SolarFlares.jsx";

/**
 * The Sun — the central thermonuclear powerhouse of our solar system.
 *
 * Upgraded in Phase 7 with:
 * - Animated boiling photosphere (3D Simplex noise granulation + convective UV swirl)
 * - Radiating coronal glare sprite with dynamic ray streaks
 * - Plasma prominence flares looping along magnetic field lines
 * - Windowed Fresnel coronal atmosphere shell
 * - Interactive hover/selection and point light illumination
 */
function Sun() {
  const groupRef = useRef(null);
  const spinRef = useRef(null);
  const shaderMatRef = useRef(null);
  const currentScaleRef = useRef(1.0);
  const surfaceMap = getTexture(SUN.texture);

  const uniforms = useMemo(
    () => ({
      uTexture: { value: surfaceMap ?? null },
      uHasTexture: { value: surfaceMap ? 1.0 : 0.0 },
      uTime: { value: 0 },
      uColorCore: { value: new THREE.Color("#fff6e0") },
      uColorMid: { value: new THREE.Color("#ffaa11") },
      uColorEdge: { value: new THREE.Color("#d93800") },
    }),
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
    // Advance solar surface simulation time
    uniforms.uTime.value = simulationClock.time;

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
      {/* Photosphere with animated boiling granulation shader */}
      <mesh
        ref={spinRef}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
      >
        <sphereGeometry args={[SUN.radius, 64, 32]} />
        <shaderMaterial
          ref={shaderMatRef}
          uniforms={uniforms}
          vertexShader={SUN_VERTEX_SHADER}
          fragmentShader={SUN_FRAGMENT_SHADER}
          toneMapped={false}
        />
      </mesh>

      {/* Coronal prominence flares & plasma loops */}
      <SolarFlares count={160} sunRadius={SUN.radius} />

      {/* Coronal glare billboard with dynamic ray streaks */}
      <SunCoronaSprite radius={SUN.radius * 2.8} />

      {/* Outer atmosphere halo */}
      <Atmosphere
        radius={SUN.radius}
        color={SUN.fallbackColor}
        scale={1.35}
        intensity={0.65}
        power={2.2}
        toneMapped={false}
      />

      {/* Floating billboarded label */}
      <PlanetLabel body={SUN} yOffset={SUN.radius + 1.2} />

      {/* The system's primary light source */}
      <pointLight intensity={2.2} decay={0} color="#fff2dc" />
    </group>
  );
}

export default memo(Sun);
