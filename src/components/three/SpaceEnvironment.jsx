import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Procedural Space Environment
 *
 * Spec §16 & §17:
 * - Procedural 3D Simplex noise nebulae (deep violet/magenta & cyan/teal clouds)
 * - Interplanetary cosmic dust field (2,000 motes drifting slowly)
 * - Faint deep-space spiral and elliptical galaxies
 */

//
// 1. NEBULA SHADERS
//
const NEBULA_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const NEBULA_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  uniform float uScale;

  varying vec3 vWorldPosition;

  // Compact 3D noise
  vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 1.0 / 7.0;
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  void main() {
    vec3 p = vWorldPosition * uScale;

    // Fractional Brownian Motion (3 octaves)
    float n1 = snoise(p + vec3(0.0, uTime * 0.005, 0.0));
    float n2 = snoise(p * 2.1 - vec3(uTime * 0.008, 0.0, 0.0)) * 0.5;
    float n3 = snoise(p * 4.2 + vec3(0.0, 0.0, uTime * 0.01)) * 0.25;

    float cloud = (n1 + n2 + n3) / 1.75; // in [-1, 1]
    cloud = cloud * 0.5 + 0.5;           // in [0, 1]

    // Create organic clumps and deep dark cosmic voids
    float density = smoothstep(0.48, 0.82, cloud);
    if (density <= 0.001) discard;

    vec3 color = mix(uColorA, uColorB, smoothstep(0.55, 0.88, cloud));
    gl_FragColor = vec4(color, density * uOpacity);
  }
`;

function ProceduralNebulaShell({ radius, colorA, colorB, opacity, scale, rotationSpeed }) {
  const meshRef = useRef(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
      uOpacity: { value: opacity },
      uScale: { value: scale },
    }),
    [colorA, colorB, opacity, scale],
  );

  useFrame((state, delta) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * rotationSpeed;
      meshRef.current.rotation.x += delta * (rotationSpeed * 0.4);
    }
  });

  return (
    <mesh ref={meshRef} frustumCulled={false} renderOrder={-2}>
      <sphereGeometry args={[radius, 40, 24]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={NEBULA_VERTEX_SHADER}
        fragmentShader={NEBULA_FRAGMENT_SHADER}
        side={THREE.BackSide}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

//
// 2. COSMIC DUST MOTES
//
const DUST_VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  uniform float uPixelRatio;

  varying float vAlpha;

  void main() {
    vAlpha = aAlpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio * (120.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const DUST_FRAGMENT_SHADER = /* glsl */ `
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;

    // Soft Gaussian-like disc falloff
    float glow = smoothstep(0.5, 0.05, d) * vAlpha;
    gl_FragColor = vec4(vec3(0.92, 0.95, 1.0), glow * 0.35);
  }
`;

function CosmicDust({ count = 2000 }) {
  const groupRef = useRef(null);
  const { gl } = useThree();

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Dispersed in a thick zodiacal disc across the system
      const r = 16.0 + Math.sqrt(Math.random()) * 160.0;
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 22.0;

      positions[i * 3] = r * Math.cos(theta);
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = r * Math.sin(theta);

      sizes[i] = 1.0 + Math.random() * 2.2;
      alphas[i] = 0.2 + Math.random() * 0.6;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 220);
    return geo;
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uPixelRatio: { value: gl.getPixelRatio() },
    }),
    [gl],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, delta) => {
    // Very subtle orbital swirl
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.002;
    }
  });

  return (
    <group ref={groupRef}>
      <points geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={DUST_VERTEX_SHADER}
          fragmentShader={DUST_FRAGMENT_SHADER}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

//
// 3. DEEP SPACE GALAXIES
// Procedural galaxy sprite texture generated via Canvas
//
function createGalaxyTexture(isSpiral = true) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  const cx = 64;
  const cy = 64;

  if (isSpiral) {
    // Soft core
    const radGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 54);
    radGlow.addColorStop(0, "rgba(255, 245, 230, 0.95)");
    radGlow.addColorStop(0.25, "rgba(200, 225, 255, 0.5)");
    radGlow.addColorStop(0.65, "rgba(100, 140, 220, 0.15)");
    radGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = radGlow;
    ctx.fillRect(0, 0, 128, 128);

    // Subtle spiral arms
    ctx.strokeStyle = "rgba(180, 210, 255, 0.22)";
    ctx.lineWidth = 4;
    for (let arm = 0; arm < 2; arm++) {
      ctx.beginPath();
      const armOffset = arm * Math.PI;
      for (let theta = 0; theta < Math.PI * 2.2; theta += 0.1) {
        const r = theta * 7.5;
        const x = cx + r * Math.cos(theta + armOffset);
        const y = cy + (r * 0.55) * Math.sin(theta + armOffset);
        if (theta === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else {
    // Elliptical galaxy
    const radGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 48);
    radGlow.addColorStop(0, "rgba(255, 240, 210, 0.9)");
    radGlow.addColorStop(0.35, "rgba(240, 200, 140, 0.45)");
    radGlow.addColorStop(0.7, "rgba(180, 130, 80, 0.12)");
    radGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = radGlow;
    ctx.fillRect(0, 0, 128, 128);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const GALAXIES_DATA = [
  { pos: [-490, 270, -780], size: 85, isSpiral: true, rot: 0.4 },
  { pos: [630, -190, -740], size: 70, isSpiral: true, rot: -0.8 },
  { pos: [-640, -310, 590], size: 75, isSpiral: false, rot: 0.2 },
  { pos: [550, 390, 670], size: 90, isSpiral: true, rot: 1.1 },
];

function DeepSpaceGalaxies() {
  const spiralTex = useMemo(() => createGalaxyTexture(true), []);
  const ellipticalTex = useMemo(() => createGalaxyTexture(false), []);

  useEffect(() => {
    return () => {
      spiralTex.dispose();
      ellipticalTex.dispose();
    };
  }, [spiralTex, ellipticalTex]);

  return (
    <group>
      {GALAXIES_DATA.map((g, i) => (
        <mesh
          key={i}
          position={g.pos}
          rotation={[0, 0, g.rot]}
          renderOrder={-1}
        >
          <planeGeometry args={[g.size, g.size]} />
          <meshBasicMaterial
            map={g.isSpiral ? spiralTex : ellipticalTex}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            opacity={0.55}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Main Space Environment Orchestrator
 */
function SpaceEnvironment({ dustCount = 2000, nebulaShells = 2 }) {
  return (
    <group>
      {/* Deep Violet & Magenta Nebula Shell */}
      <ProceduralNebulaShell
        radius={740}
        colorA="#1b0638"
        colorB="#5e1248"
        opacity={0.065}
        scale={0.0032}
        rotationSpeed={0.00012}
      />

      {/* Electric Cyan & Deep Indigo Nebula Shell (High/Medium tiers) */}
      {nebulaShells >= 2 ? (
        <ProceduralNebulaShell
          radius={860}
          colorA="#061833"
          colorB="#064a5c"
          opacity={0.055}
          scale={0.0028}
          rotationSpeed={-0.00009}
        />
      ) : null}

      {/* Interplanetary Cosmic Dust Field */}
      <CosmicDust count={dustCount} />

      {/* Deep Space Galaxies */}
      <DeepSpaceGalaxies />
    </group>
  );
}

export default memo(SpaceEnvironment);
