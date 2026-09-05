import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Prominence Flares & Coronal Plasma Loops
 *
 * Simulates plasma erupting and arching along solar magnetic loops.
 * Computed analytically via GPU vertex shader from base anchors and heights,
 * requiring zero per-frame CPU allocation.
 */

const FLARE_VERTEX_SHADER = /* glsl */ `
  attribute vec3 aBasePos;
  attribute vec3 aArcTangent;
  attribute float aMaxAltitude;
  attribute float aPhase;
  attribute float aDuration;
  attribute float aSize;

  uniform float uTime;
  uniform float uPixelRatio;

  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    // Current loop progression in [0, 1]
    float t = mod(uTime + aPhase, aDuration) / aDuration;

    // Parabolic arc height: 4 * t * (1 - t) peaks at 1.0 when t = 0.5
    float arcFactor = 4.0 * t * (1.0 - t);
    float altitude = aMaxAltitude * arcFactor;

    // Displace outward along surface normal + curve along tangent
    vec3 normal = normalize(aBasePos);
    vec3 pos = aBasePos + normal * altitude + aArcTangent * (sin(t * 3.14159) * 0.4);

    // Alpha rises then dims out at landing
    vAlpha = smoothstep(0.0, 0.25, t) * smoothstep(1.0, 0.65, t) * 0.85;

    // Color shift: hotter/brighter at peak altitude
    vec3 baseColor = vec3(1.0, 0.35, 0.05); // Deep fiery orange
    vec3 peakColor = vec3(1.0, 0.92, 0.65); // White-gold peak
    vColor = mix(baseColor, peakColor, arcFactor * arcFactor);

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * uPixelRatio * (200.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FLARE_FRAGMENT_SHADER = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;

    float glow = smoothstep(0.5, 0.05, d) * vAlpha;
    gl_FragColor = vec4(vColor * 2.2, glow);
  }
`;

function SolarFlares({ count = 160, sunRadius = 5.0 }) {
  const materialRef = useRef(null);
  const { gl } = useThree();

  const geometry = useMemo(() => {
    const basePositions = new Float32Array(count * 3);
    const arcTangents = new Float32Array(count * 3);
    const maxAltitudes = new Float32Array(count);
    const phases = new Float32Array(count);
    const durations = new Float32Array(count);
    const sizes = new Float32Array(count);

    // Seeded distribution concentrated in active solar latitude belts (±15° to ±40°)
    for (let i = 0; i < count; i++) {
      // Pick active latitude
      const latSign = Math.random() > 0.5 ? 1 : -1;
      const lat = latSign * (0.25 + Math.random() * 0.45); // Radians ~14° to 40°
      const lon = Math.random() * Math.PI * 2;

      const cosLat = Math.cos(lat);
      const sinLat = Math.sin(lat);

      const nx = cosLat * Math.cos(lon);
      const ny = sinLat;
      const nz = cosLat * Math.sin(lon);

      basePositions[i * 3] = nx * sunRadius;
      basePositions[i * 3 + 1] = ny * sunRadius;
      basePositions[i * 3 + 2] = nz * sunRadius;

      // Tangent vector perpendicular to normal for magnetic loop curling
      const arbitrary = Math.abs(ny) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      const normalVec = new THREE.Vector3(nx, ny, nz);
      const tangentVec = new THREE.Vector3().crossVectors(normalVec, arbitrary).normalize();

      arcTangents[i * 3] = tangentVec.x;
      arcTangents[i * 3 + 1] = tangentVec.y;
      arcTangents[i * 3 + 2] = tangentVec.z;

      maxAltitudes[i] = 0.4 + Math.random() * 1.8; // Peak altitude above surface
      phases[i] = Math.random() * 10;
      durations[i] = 2.4 + Math.random() * 3.2; // 2.4s to 5.6s per loop
      sizes[i] = 1.6 + Math.random() * 2.6;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(basePositions, 3));
    geo.setAttribute("aBasePos", new THREE.BufferAttribute(basePositions, 3));
    geo.setAttribute("aArcTangent", new THREE.BufferAttribute(arcTangents, 3));
    geo.setAttribute("aMaxAltitude", new THREE.BufferAttribute(maxAltitudes, 1));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geo.setAttribute("aDuration", new THREE.BufferAttribute(durations, 1));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), sunRadius * 2.5);
    return geo;
  }, [count, sunRadius]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: gl.getPixelRatio() },
    }),
    [gl],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={FLARE_VERTEX_SHADER}
        fragmentShader={FLARE_FRAGMENT_SHADER}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default memo(SolarFlares);
