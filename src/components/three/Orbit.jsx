import { memo, useEffect, useMemo } from "react";
import * as THREE from "three";

import { orbitalPositionAt } from "../../utils/planetUtils.js";

const SEGMENTS = 256;

/**
 * The visible trace of a planet's orbit.
 *
 * The points are generated with `orbitalPositionAt` — the exact function the
 * planet itself uses — so the line cannot drift out of agreement with the body
 * travelling along it. If the orbit maths were ever wrong, it would be
 * visually obvious rather than subtly off.
 *
 * Drawn as a THREE.LineLoop (closes itself, one draw call, 1px) rather than a
 * thick-line implementation: at this scale a hairline reads as more elegant
 * and costs a fraction as much.
 */
function Orbit({ body, opacity = 0.18 }) {
  const line = useMemo(() => {
    const positions = new Float32Array(SEGMENTS * 3);
    const p = { x: 0, y: 0, z: 0 };

    for (let i = 0; i < SEGMENTS; i++) {
      // Sweep a full orbit by sampling one period of scene time.
      orbitalPositionAt(body, (i / SEGMENTS) * body.orbitTimeSeconds, p);
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.LineBasicMaterial({
      color: body.fallbackColor,
      transparent: true,
      opacity,
      depthWrite: false,
      // Keep orbit lines from being blown out by bloom.
      toneMapped: true,
    });

    const line = new THREE.LineLoop(geometry, material);
    // Named so it can be found in the scene graph when debugging.
    line.name = `orbit-${body.id}`;
    return line;
  }, [body, opacity]);

  // R3F disposes objects it creates, but this one is ours, so release it here.
  useEffect(
    () => () => {
      line.geometry.dispose();
      line.material.dispose();
    },
    [line],
  );

  return <primitive object={line} />;
}

export default memo(Orbit);
