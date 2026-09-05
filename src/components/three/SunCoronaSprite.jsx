import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Solar Corona Glare Billboard
 *
 * Renders a camera-facing luminous glare disk with dynamic coronal ray streaks
 * and a slow breathing pulse, creating a brilliant halo around the star.
 */

const CORONA_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;

    // Billboard in view space: copy position and cancel object rotation
    vec4 mvPosition = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mvPosition.xy += position.xy;

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const CORONA_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 centerOffset = vUv - vec2(0.5);
    float dist = length(centerOffset);
    if (dist > 0.5) discard;

    // Radial ray streaks that slowly shimmer and rotate
    float angle = atan(centerOffset.y, centerOffset.x);
    float ray1 = sin(angle * 10.0 + uTime * 0.15);
    float ray2 = sin(angle * 18.0 - uTime * 0.25);
    float rays = 0.88 + 0.08 * ray1 + 0.04 * ray2;

    // Exponential luminous falloff
    float falloff = exp(-dist * 7.2) * rays;

    // Breathing pulse: 2.0s cycle with subtle ±6% variance
    float pulse = 0.94 + 0.06 * sin(uTime * 1.6);
    falloff *= pulse;

    // Color gradient: fiery warm amber edge to white-hot golden core
    vec3 edgeColor = vec3(1.0, 0.45, 0.05);
    vec3 coreColor = vec3(1.0, 0.95, 0.75);
    vec3 color = mix(edgeColor, coreColor, smoothstep(0.35, 0.05, dist));

    gl_FragColor = vec4(color * 1.7, falloff * 0.7);
  }
`;

function SunCoronaSprite({ radius = 13.5 }) {
  const materialRef = useRef(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
    }),
    [],
  );

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh frustumCulled={false} renderOrder={1}>
      <planeGeometry args={[radius * 2, radius * 2]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={CORONA_VERTEX_SHADER}
        fragmentShader={CORONA_FRAGMENT_SHADER}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export default memo(SunCoronaSprite);
