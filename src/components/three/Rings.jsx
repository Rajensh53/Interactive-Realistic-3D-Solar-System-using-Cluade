import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { getTexture } from "../../utils/textureUtils.js";

/**
 * Saturn's Rings with Photorealistic Planetary Shadow
 *
 * Rewritten UVs preserve the radial strip mapping and Cassini division.
 * Phase 7 adds the dark shadow wedge cast by Saturn's globe across the
 * rings on the night side (away from the Sun).
 */

const RING_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const RING_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uHasMap;
  uniform vec3 uColor;
  uniform vec3 uSunDirection;
  uniform vec3 uSaturnCenter;
  uniform float uSaturnRadius;

  varying vec2 vUv;
  varying vec3 vWorldPos;

  void main() {
    vec4 texColor = vec4(1.0);
    if (uHasMap > 0.5) {
      texColor = texture2D(uMap, vUv);
    } else {
      texColor = vec4(uColor, 0.55);
    }

    if (texColor.a < 0.02) discard;

    // Saturn's shadow cast on the rings:
    // Fragment offset from planet center in world space
    vec3 offset = vWorldPos - uSaturnCenter;
    float alongSun = dot(offset, uSunDirection);

    float shadow = 1.0;
    if (alongSun < 0.0) {
      // Night side: distance of ray from Saturn's center
      float d2 = dot(offset, offset) - alongSun * alongSun;
      float d = sqrt(max(0.0, d2));
      // Soft penumbra edge
      shadow = smoothstep(uSaturnRadius * 0.97, uSaturnRadius * 1.03, d);
    }

    // Residual scattered ring glow in deep umbra is ~12%
    float lighting = 0.12 + 0.88 * shadow;

    gl_FragColor = vec4(texColor.rgb * uColor * lighting, texColor.a);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const _saturnCenter = new THREE.Vector3();

function Rings({ body, sunDirection, segments = 160 }) {
  const meshRef = useRef(null);
  const ringMap = getTexture(body.ringTexture);

  const geometry = useMemo(() => {
    const inner = body.radius * body.ringInner;
    const outer = body.radius * body.ringOuter;

    const geo = new THREE.RingGeometry(inner, outer, segments, 1);

    const position = geo.attributes.position;
    const uv = geo.attributes.uv;
    const span = outer - inner;

    // Rewrite UVs radially so Cassini division lands at true radius
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const radius = Math.hypot(x, y);
      uv.setXY(i, THREE.MathUtils.clamp((radius - inner) / span, 0, 1), 0.5);
    }
    uv.needsUpdate = true;

    return geo;
  }, [body.radius, body.ringInner, body.ringOuter, segments]);

  const uniforms = useMemo(
    () => ({
      uMap: { value: ringMap ?? null },
      uHasMap: { value: ringMap ? 1.0 : 0.0 },
      uColor: {
        value: ringMap ? new THREE.Color("#ffffff") : new THREE.Color(body.fallbackColor),
      },
      uSunDirection: { value: new THREE.Vector3(1, 0, 0) },
      uSaturnCenter: { value: new THREE.Vector3(0, 0, 0) },
      uSaturnRadius: { value: body.radius },
    }),
    [body.radius, body.fallbackColor, ringMap],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    if (sunDirection?.value) {
      uniforms.uSunDirection.value.copy(sunDirection.value);
    }
    if (meshRef.current?.parent) {
      meshRef.current.parent.getWorldPosition(_saturnCenter);
      uniforms.uSaturnCenter.value.copy(_saturnCenter);
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={RING_VERTEX_SHADER}
        fragmentShader={RING_FRAGMENT_SHADER}
        side={THREE.DoubleSide}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

export default memo(Rings);
