import { memo, useEffect, useMemo } from "react";
import * as THREE from "three";

import { getTexture } from "../../utils/textureUtils.js";

/**
 * Saturn's rings.
 *
 * THE UV PROBLEM
 * `THREE.RingGeometry` maps UVs onto the annulus's square bounding box, which
 * is useless here: the ring texture is a 2048x125 *radial strip*, one pixel
 * column per orbital distance, encoding the C ring through the Cassini division
 * to the outer A ring. Sampled through the stock UVs it would smear that strip
 * across the disc like a stretched photograph.
 *
 * So the UVs are rewritten: `u` becomes the fragment's normalised distance from
 * the planet, `v` is pinned to the middle of the strip. Each ringlet then lands
 * at its true radius, and the Cassini division shows up as the dark gap it
 * actually is.
 *
 * Unlit on purpose. The rings lie in the planet's equatorial plane with the Sun
 * almost edge-on to them, so a physically shaded annulus would be very nearly
 * black — correct, and unwatchable. Real lighting and the planet's shadow band
 * across the rings are Phase 7 work.
 */
function Rings({ body, segments = 160 }) {
  const geometry = useMemo(() => {
    const inner = body.radius * body.ringInner;
    const outer = body.radius * body.ringOuter;

    const geo = new THREE.RingGeometry(inner, outer, segments, 1);

    const position = geo.attributes.position;
    const uv = geo.attributes.uv;
    const span = outer - inner;

    // RingGeometry is built in the XY plane, so the vertex's distance from the
    // origin is exactly its ring radius.
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const radius = Math.hypot(x, y);
      uv.setXY(i, THREE.MathUtils.clamp((radius - inner) / span, 0, 1), 0.5);
    }
    uv.needsUpdate = true;

    return geo;
  }, [body.radius, body.ringInner, body.ringOuter, segments]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const ringMap = getTexture(body.ringTexture);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <meshBasicMaterial
        map={ringMap ?? null}
        color={ringMap ? "#ffffff" : body.fallbackColor}
        side={THREE.DoubleSide}
        transparent
        // The texture's own alpha channel carries the gaps; without a map the
        // fallback is a plain translucent disc.
        opacity={ringMap ? 1 : 0.55}
        depthWrite={false}
        alphaTest={0.02}
      />
    </mesh>
  );
}

export default memo(Rings);
