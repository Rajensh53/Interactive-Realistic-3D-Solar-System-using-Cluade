import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { SUN, getScaledSun } from "../../data/planets.js";
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
import PlanetLabel from "./PlanetLabel.jsx";
import SunCoronaSprite from "./SunCoronaSprite.jsx";
import BodyMarker from "./BodyMarker.jsx";

/**
 * The Sun — the central thermonuclear powerhouse of our solar system.
 *
 * Implements a photorealistic astronomical star:
 * - High-contrast NASA SDO photosphere with boiling convection granulation
 * - Physical differential rotation and Eddington limb darkening
 * - Active magnetic plages and fiery chromospheric rim fringe
 * - Grand multi-harmonic coronal halo and magnetic solar wind streamers
 * - Interactive hover/selection and primary system point light
 *
 * `trueScale` swaps in the physical radius (4.65 u vs. 5.0 u compact). The id,
 * texture and spin are shared by both layouts, so they still read `SUN`.
 */
function Sun({ trueScale = false }) {
  const sun = getScaledSun(trueScale ? "true" : "compact");
  const groupRef = useRef(null);
  const spinRef = useRef(null);
  const shaderMatRef = useRef(null);
  const currentScaleRef = useRef(1.0);
  const surfaceMap = getTexture(SUN.texture);

  if (surfaceMap) {
    surfaceMap.wrapS = THREE.RepeatWrapping;
    surfaceMap.wrapT = THREE.ClampToEdgeWrapping;
  }

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
      registerBody(SUN.id, groupRef.current, sun.radius);
    }
    return () => unregisterBody(SUN.id);
  }, [sun.radius]);

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
    uniforms.uTime.value = simulationClock.spinTime;

    if (spinRef.current) {
      spinRef.current.rotation.y = SUN.rotationSpeed * simulationClock.spinTime;
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
        <sphereGeometry args={[sun.radius, 64, 32]} />
        <shaderMaterial
          ref={shaderMatRef}
          uniforms={uniforms}
          vertexShader={SUN_VERTEX_SHADER}
          fragmentShader={SUN_FRAGMENT_SHADER}
          toneMapped={false}
        />
      </mesh>

      {/* Photorealistic radiating coronal glare billboard with multi-harmonic streamers */}
      <SunCoronaSprite radius={sun.radius * 3.8} />

      {/* Floating billboarded label */}
      <PlanetLabel
        body={sun}
        yOffset={trueScale ? sun.radius * 1.3 : sun.radius + 1.2}
        trueScale={trueScale}
      />

      {trueScale ? <BodyMarker color={SUN.fallbackColor} radius={sun.radius} /> : null}

      {/* The system's primary light source */}
      <pointLight intensity={2.4} decay={0} color="#fff6ea" />
    </group>
  );
}

export default memo(Sun);
