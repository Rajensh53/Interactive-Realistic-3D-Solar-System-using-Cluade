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
import { TIER_CONFIG } from "../../hooks/useQualityTier.js";

/**
 * Post-Processing Effects Pipeline
 *
 * Spec §18 & §22:
 * - High-threshold Bloom: Only the Sun's granulation peaks and hot flares bloom,
 *   preserving crisp, unblown planet surfaces.
 * - Viewport Vignette: Subtle lens darkening around the screen edges.
 * - Travel-Only Depth of Field (DoF): Active on High tier during camera flight
 *   for a cinematic warp/travel effect, then returns to 0 on arrival so planets
 *   are inspected in razor-sharp focus.
 * - Scales passes automatically based on qualityTier (High, Medium, Low).
 */
function PostProcessingEffects() {
  const qualityTier = usePlanetStore((s) => s.qualityTier) || "high";
  const tierConfig = TIER_CONFIG[qualityTier] || TIER_CONFIG.high;

  const dofRef = useRef(null);
  const currentBokehRef = useRef(0.0);

  useFrame((_, delta) => {
    if (!tierConfig.enableDoF) return;

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
        mipmapBlur={tierConfig.bloomMipmapBlur}
      />

      {/* Cinematic edge vignette */}
      <Vignette offset={0.15} darkness={0.65} eskil={false} />

      {/* Travel-only cinematic Depth of Field (High Tier only) */}
      {tierConfig.enableDoF ? (
        <DepthOfField
          ref={dofRef}
          focusDistance={0.02}
          focalLength={0.15}
          bokehScale={0}
        />
      ) : null}
    </EffectComposer>
  );
}

export default memo(PostProcessingEffects);
