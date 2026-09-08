import { memo } from "react";
import {
  EffectComposer,
  Bloom,
  Vignette,
} from "@react-three/postprocessing";

import { usePlanetStore } from "../../hooks/usePlanetStore.js";
import { TIER_CONFIG } from "../../hooks/useQualityTier.js";

/**
 * Post-Processing Effects Pipeline
 *
 * Spec §18 & §22:
 * - High-threshold Bloom: Only the Sun's granulation peaks and hot flares bloom,
 *   preserving crisp, unblown planet surfaces.
 * - Viewport Vignette: Subtle lens darkening around the screen edges.
 * - Optimized for rock-solid 60 FPS performance without heavy depth passes.
 */
function PostProcessingEffects() {
  const qualityTier = usePlanetStore((s) => s.qualityTier) || "high";
  const tierConfig = TIER_CONFIG[qualityTier] || TIER_CONFIG.high;

  return (
    <EffectComposer multisampling={0}>
      {/* High-threshold bloom for solar photosphere and active prominences */}
      <Bloom
        intensity={0.95}
        luminanceThreshold={1.0}
        luminanceSmoothing={0.25}
        mipmapBlur={tierConfig.bloomMipmapBlur}
      />

      {/* Cinematic edge vignette */}
      <Vignette offset={0.15} darkness={0.65} eskil={false} />
    </EffectComposer>
  );
}

export default memo(PostProcessingEffects);
