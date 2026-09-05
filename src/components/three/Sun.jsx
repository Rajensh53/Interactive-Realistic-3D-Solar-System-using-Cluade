import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { SUN } from "../../data/planets.js";
import { simulationClock } from "../../utils/planetUtils.js";
import { getTexture } from "../../utils/textureUtils.js";
import Atmosphere from "./Atmosphere.jsx";

/**
 * The Sun — the scene's only real light source.
 *
 * A photospheric granulation map bright enough to trip the bloom threshold, a
 * soft corona shell, and the point light every planet is lit by. The animated
 * fbm surface shader, solar flares and volumetric glow arrive in Phase 7.
 */
function Sun() {
  const spinRef = useRef(null);
  const surfaceMap = getTexture(SUN.texture);

  // Pushed above 1.0 so the bloom pass (luminanceThreshold 1) catches the Sun
  // and nothing else. `toneMapped={false}` keeps ACES from clamping it back.
  //
  // With the map present the tint stays neutral and the texture supplies the
  // colour; without it the flat amber has to carry the whole look, so it is
  // driven a little harder.
  const coreColor = useMemo(
    () =>
      surfaceMap
        ? new THREE.Color("#ffffff").multiplyScalar(2.2)
        : new THREE.Color(SUN.fallbackColor).multiplyScalar(2.6),
    [surfaceMap],
  );

  useFrame(() => {
    if (spinRef.current) {
      spinRef.current.rotation.y = SUN.rotationSpeed * simulationClock.time;
    }
  });

  return (
    <group>
      <mesh ref={spinRef}>
        <sphereGeometry args={[SUN.radius, 64, 32]} />
        <meshBasicMaterial
          map={surfaceMap ?? null}
          color={coreColor}
          toneMapped={false}
        />
      </mesh>

      {/* Corona. Shares the planets' limb-glow shell, minus the solar mask —
          the Sun lights itself, so the halo is even all the way round. It was
          previously a flat-opacity shell, which had no falloff at all and so
          showed its own silhouette as a hard-edged polygon. The sprite, flares
          and animated fbm surface arrive in Phase 7. */}
      <Atmosphere
        radius={SUN.radius}
        color={SUN.fallbackColor}
        scale={1.35}
        intensity={0.6}
        power={2.2}
        toneMapped={false}
      />

      {/* decay={0} keeps intensity constant across the system. Physically
          wrong, but inverse-square falloff over 92 scene units would leave
          Neptune in total darkness. */}
      <pointLight intensity={2.2} decay={0} color="#fff2dc" />
    </group>
  );
}

export default memo(Sun);
