import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Deep-space star field.
 *
 * One THREE.Points object, one draw call, ten thousand stars. Building these
 * as individual meshes or React components would cost thousands of draw calls
 * and matrix updates per frame for something the user reads as texture.
 *
 * Twinkling happens entirely on the GPU: each star carries a random phase
 * attribute, and the vertex shader modulates its brightness against a single
 * time uniform. No per-star CPU work ever runs.
 */

const VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;

  uniform float uTime;
  uniform float uPixelRatio;

  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    vColor = aColor;

    // Subtle: never dips below 70% brightness. Stars should shimmer, not blink.
    vTwinkle = 0.7 + 0.3 * sin(uTime * 1.5 + aPhase);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    // Perspective size attenuation — distant stars shrink, giving real depth.
    gl_PointSize = aSize * uPixelRatio * (320.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    // Round the square point sprite into a soft disc.
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;

    float alpha = smoothstep(0.5, 0.05, d) * vTwinkle;
    gl_FragColor = vec4(vColor, alpha);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Deterministic PRNG (mulberry32) so the sky is identical on every reload. */
function makeRandom(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Real stellar colours: mostly white, a scattering of blue-white O/B types and
// warm K/M types. Nothing saturated — coloured confetti reads as fantasy.
const STAR_COLORS = [
  [1.0, 1.0, 1.0],
  [1.0, 1.0, 1.0],
  [0.81, 0.89, 1.0],
  [0.7, 0.82, 1.0],
  [1.0, 0.88, 0.72],
  [1.0, 0.76, 0.62],
];

function StarField({ count = 10000, innerRadius = 320, outerRadius = 620 }) {
  const materialRef = useRef(null);
  const groupRef = useRef(null);
  const { gl } = useThree();

  const geometry = useMemo(() => {
    const random = makeRandom(20260902);

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Uniform distribution over a spherical shell. Sampling cos(phi) rather
      // than phi avoids the classic clustering at the poles.
      const r = innerRadius + random() * (outerRadius - innerRadius);
      const theta = random() * Math.PI * 2;
      const cosPhi = random() * 2 - 1;
      const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);

      positions[i * 3] = r * sinPhi * Math.cos(theta);
      positions[i * 3 + 1] = r * cosPhi;
      positions[i * 3 + 2] = r * sinPhi * Math.sin(theta);

      const c = STAR_COLORS[(random() * STAR_COLORS.length) | 0];
      colors[i * 3] = c[0];
      colors[i * 3 + 1] = c[1];
      colors[i * 3 + 2] = c[2];

      // Cubed distribution: mostly pinpricks, a rare few bright enough to notice.
      sizes[i] = 0.55 + random() ** 3 * 2.6;
      phases[i] = random() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    // The shell is centred on the origin and never moves, so skip the
    // per-frame bounding-sphere work and frustum tests.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), outerRadius);

    return geo;
  }, [count, innerRadius, outerRadius]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: gl.getPixelRatio() },
    }),
    [gl],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state, delta) => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!prefersReducedMotion) {
      uniforms.uTime.value = state.clock.elapsedTime;
      // A drift slow enough to feel rather than see: one revolution ~3.5 hours.
      if (groupRef.current) groupRef.current.rotation.y += delta * 0.0005;
    } else {
      uniforms.uTime.value = 0;
    }
  });

  return (
    <group ref={groupRef}>
      <points geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          ref={materialRef}
          uniforms={uniforms}
          vertexShader={VERTEX_SHADER}
          fragmentShader={FRAGMENT_SHADER}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

export default memo(StarField);
