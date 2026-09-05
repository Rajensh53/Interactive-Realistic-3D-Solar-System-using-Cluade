import { memo } from "react";
import * as THREE from "three";

import { getTexture } from "../../utils/textureUtils.js";
import { ENVIRONMENT } from "../../data/textures.js";

/**
 * The Milky Way, painted on the inside of a very large sphere.
 *
 * Sits outside the star field's 320-620 unit shell but well inside the camera's
 * far plane, so the procedural stars read as foreground against it and neither
 * gets clipped.
 *
 * Deliberately dim: at full brightness a 2K panorama looks like wallpaper and
 * flattens the depth the parallaxing star field is there to create. Kept unlit
 * and out of the tone mapper's way so it stays a backdrop.
 */
function SkyDome({ radius = 800, opacity = 0.5 }) {
  const map = getTexture(ENVIRONMENT.milkyWay);
  if (!map) return null;

  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <sphereGeometry args={[radius, 48, 24]} />
      <meshBasicMaterial
        map={map}
        side={THREE.BackSide}
        transparent
        opacity={opacity}
        // Depth-tested but never depth-writing: the dome is correctly hidden
        // behind every planet, and occludes nothing itself. Disabling the test
        // instead would paint the panorama straight over the Solar System,
        // since transparent geometry is drawn after all the opaque meshes.
        depthWrite={false}
      />
    </mesh>
  );
}

export default memo(SkyDome);
