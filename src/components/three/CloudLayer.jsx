import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

import { getTexture } from "../../utils/textureUtils.js";
import { simulationClock } from "../../utils/planetUtils.js";

/**
 * A translucent weather layer just above a planet's surface.
 *
 * The cloud map is bound as an `alphaMap`, not as `map`: it is a white-on-black
 * image, so using it as albedo would paint black clouds over the oceans.
 * As an opacity mask, white becomes cloud and black becomes clear sky, and the
 * material's own white colour is what actually gets lit.
 *
 * The layer spins slightly faster than the planet under it, which is what sells
 * the two as separate things rather than one textured sphere.
 */
function CloudLayer({ body, scale = 1.015, speedFactor = 1.2, opacity = 0.85 }) {
  const spinRef = useRef(null);
  const cloudMap = getTexture(body.cloudTexture);

  useFrame(() => {
    if (spinRef.current) {
      spinRef.current.rotation.y =
        body.rotationSpeed * speedFactor * simulationClock.time;
    }
  });

  if (!cloudMap) return null;

  return (
    <mesh ref={spinRef} scale={scale}>
      <sphereGeometry args={[body.radius, 48, 24]} />
      <meshStandardMaterial
        color="#ffffff"
        alphaMap={cloudMap}
        transparent
        opacity={opacity}
        // The planet beneath has already written depth, so the clouds blend
        // over it correctly without needing to write depth themselves.
        depthWrite={false}
        roughness={0.95}
        metalness={0}
      />
    </mesh>
  );
}

export default memo(CloudLayer);
