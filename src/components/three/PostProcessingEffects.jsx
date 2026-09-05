import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  EffectComposer,
  Bloom,
  Vignette,
  DepthOfField,
} from "@react-three/postprocessing";
import * as THREE from "three";

import { usePlanetStore } from "../../hooks/usePlanetStore.js";

/**
 * Post-Processing Effects Pipeline
 *
 * Spec §18:
 * - High-threshold Bloom: Only the Sun's granulation peaks and hot flares bloom,
 *   preserving crisp, unblown planet surfaces.
 * - Viewport Vignette: Subtle lens darkening around the screen edges.
 * - Travel-Only Depth of Field (DoF): Seamlessly ramps bokeh during camera flight
 *   for a cinematic warp/travel effect, then returns to 0 on arrival so planets
 *   are inspected in razor-sharp focus. Zero per-frame React re-renders.
 */
function PostProcessingEffects() {
  const dofRef = useRef(null);
  const currentBokehRef = useRef(0.0);

  useFrame((_, delta) => {
    const isTraveling = usePlanetStore.getState().cameraPhase === "traveling";
    const targetBokeh = isTraveling ? 3.2 : 0.0;

    currentBokehRef.current = THREE.MathUtils.damp(
      currentBokehRef.current,
      targetBokeh,
      6,
      delta,
    );

    if (dofRef.current) {
      dofRef.current.bokehScale = currentBokehRef.current;
    }
  });

  return (
    <EffectComposer>
      {/* High-threshold bloom */}
      <Bloom
        intensity={0.95}
        luminanceThreshold={1.0}
        luminanceSmoothing={0.25}
        mipmapBlur
      />

      {/* Cinematic edge vignette */}
      <Vignette offset={0.15} darkness={0.65} eskil={false} />

      {/* Travel-only cinematic Depth of Field */}
      <DepthOfField
        ref={dofRef}
        focusDistance={0.02}
        focalLength={0.15}
        bokehScale={0}
      />
    </EffectComposer>
  );
}

export default memo(PostProcessingEffects);
