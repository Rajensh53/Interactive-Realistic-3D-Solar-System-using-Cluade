import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Photorealistic Solar Corona & Radiance Halo
 *
 * Implements an authentic astronomical coronal glow:
 * - Hollow disc profile: Leaves the 3D photosphere crisp, detailed, and unwashed
 * - Intense chromospheric peak at the solar limb (dist ≈ 0.13)
 * - Multi-harmonic magnetic coronal streamers extending out into space
 * - True blackbody color gradient: white-gold -> solar gold -> amber -> deep crimson -> space
 * - Seamless cubic fadeout to zero at the billboard border (no clipping or hard box)
 */

const CORONA_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    // Billboard in view space: always perfectly faces the camera
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
    if (dist > 0.495) discard;

    // Solar disk boundary in UV space:
    // Billboard width is 38.0, Sun diameter is 10.0 -> disc radius is 5.0 / 38.0 ≈ 0.1316
    const float DISC_RADIUS = 0.1316;

    // Angle around the star
    float angle = atan(centerOffset.y, centerOffset.x);
    float t = uTime * 0.06;

    // Multi-harmonic solar magnetic coronal streamers
    float s1 = sin(angle * 4.0 + t * 0.5);
    float s2 = sin(angle * 8.0 - t * 0.8 + 1.2);
    float s3 = sin(angle * 16.0 + t * 1.2 + 2.5);
    float s4 = cos(angle * 3.0 - t * 0.3); // Equatorial dipole streamer bias
    float streamers = 0.72 + 0.15 * s1 + 0.07 * s2 + 0.04 * s3 + 0.08 * s4;

    // Slow solar breathing pulse
    float pulse = 0.97 + 0.03 * sin(uTime * 1.4);

    float glow = 0.0;

    if (dist < DISC_RADIUS) {
      // Inside solar disk: Keep corona minimal so the 3D surface granulation & spots stay crystal clear
      float innerRatio = dist / DISC_RADIUS;
      glow = pow(innerRatio, 3.0) * 0.18 * pulse;
    } else {
      // Outside solar disk: Authentic astronomical corona falloff
      // Normalized distance from limb to edge: [0.0, 1.0]
      float r = (dist - DISC_RADIUS) / (0.495 - DISC_RADIUS);

      // Dual-component exponential falloff:
      // 1. Intense inner K-corona (close to limb)
      float innerK = exp(-r * 9.0) * 1.35;
      // 2. Extended streamer envelope (F-corona / solar wind)
      float outerF = exp(-r * 3.2) * 0.65 * streamers;
      // 3. Faint diffuse background halo
      float halo = exp(-r * 1.5) * 0.18 * streamers;

      glow = (innerK + outerF + halo) * pulse;

      // Perfectly smooth cubic falloff to zero at the billboard border (NO hard edge!)
      float edgeFade = smoothstep(1.0, 0.60, r);
      glow *= edgeFade;
    }

    if (glow < 0.002) discard;

    // Blackbody temperature palette:
    // Limb white-gold -> Solar amber-gold -> Radiant orange -> Deep space crimson
    vec3 whiteGold  = vec3(1.0, 0.96, 0.88);
    vec3 solarGold  = vec3(1.0, 0.76, 0.22);
    vec3 solarAmber = vec3(1.0, 0.42, 0.05);
    vec3 deepRed    = vec3(0.65, 0.14, 0.02);

    float normDist = clamp((dist - DISC_RADIUS * 0.5) / (0.495 - DISC_RADIUS * 0.5), 0.0, 1.0);
    vec3 col = mix(solarAmber, deepRed, smoothstep(0.30, 0.85, normDist));
    col = mix(solarGold, col, smoothstep(0.08, 0.40, normDist));
    col = mix(whiteGold, col, smoothstep(0.0, 0.12, normDist));

    gl_FragColor = vec4(col * glow * 1.5, glow * 0.90);
  }
`;

function SunCoronaSprite({ radius = 19.0 }) {
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
