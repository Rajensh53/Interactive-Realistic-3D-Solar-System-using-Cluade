import { memo, useEffect, useMemo } from "react";

import { createLimbGlowMaterial } from "../../shaders/limbGlow.js";

/**
 * The soft halo of light around a body's limb.
 *
 * A thin wrapper over the shared limb-glow material — see `shaders/limbGlow.js`
 * for how the falloff works and why it is shaped the way it is.
 *
 * With a `sunDirection` the glow is modulated by it, so a planet's halo is
 * strongest on the daylit limb and fades — but never quite vanishes — around the
 * night side, keeping the silhouette readable against the stars. Without one the
 * shell glows evenly in every direction, which is what a self-luminous body like
 * the Sun's corona wants.
 *
 * @param {number} radius     the body's radius; the shell is scaled off it
 * @param {string} color
 * @param {{ value: THREE.Vector3 }} [sunDirection]  shared with the surface
 *   material. Omit for a self-luminous body, which glows evenly all round.
 * @param {number} scale      shell size in body radii
 * @param {number} intensity  peak brightness of the glow
 * @param {number} power      Fresnel falloff; higher = a tighter rim
 * @param {boolean} toneMapped  false to let the glow run past 1.0 into bloom
 */
function Atmosphere({
  radius,
  color,
  sunDirection,
  scale = 1.06,
  intensity = 1.0,
  power = 3.0,
  toneMapped = true,
}) {
  const material = useMemo(
    () => createLimbGlowMaterial({ color, scale, intensity, power, sunDirection, toneMapped }),
    [color, scale, intensity, power, sunDirection, toneMapped],
  );

  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh name="atmosphere" material={material} scale={scale}>
      <sphereGeometry args={[radius, 48, 24]} />
    </mesh>
  );
}

export default memo(Atmosphere);
