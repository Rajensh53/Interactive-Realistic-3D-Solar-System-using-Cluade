import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Photorealistic Magnetic Prominence Loops
 *
 * Simulates real solar prominences (coronal loops):
 * - Continuous magnetic plasma ribbons anchored in active solar latitude belts
 * - Arches follow magnetic field trajectories, rising up to 1.35x solar radius
 * - Animated plasma filament flow along the loop
 * - Zero isolated point-sprites or floating balls — pure continuous incandescent plasma
 */

const PROMINENCE_VERTEX_SHADER = /* glsl */ `
  attribute float aProgress; // [0, 1] along the arch
  attribute float aSide;     // -1 or +1 across ribbon width
  attribute float aPhase;
  attribute float aHeight;
  attribute vec3 aAnchorA;
  attribute vec3 aAnchorB;

  uniform float uTime;
  varying vec2 vUv;
  varying float vPhase;

  void main() {
    vUv = uv;
    vPhase = aPhase;

    float p = aProgress;

    // Spherical interpolation between footpoints
    vec3 basePos = normalize(mix(aAnchorA, aAnchorB, p));

    // Magnetic arch curve: sin(p * PI) peaks at midpoint
    float archCurve = sin(p * 3.14159265);
    
    // Dynamic plasma respiration
    float pulse = 1.0 + 0.08 * sin(uTime * 1.6 + aPhase);
    float altitude = aHeight * archCurve * pulse;

    vec3 archPos = basePos * (length(aAnchorA) + altitude);

    // Transform position to view space
    vec4 mvPos = modelViewMatrix * vec4(archPos, 1.0);

    // Determine 2D screen tangent for perfect camera alignment
    vec3 nextBase = normalize(mix(aAnchorA, aAnchorB, min(p + 0.04, 1.0)));
    float nextAlt = aHeight * sin(min(p + 0.04, 1.0) * 3.14159265) * pulse;
    vec4 nextMvPos = modelViewMatrix * vec4(nextBase * (length(aAnchorA) + nextAlt), 1.0);

    vec2 dir2D = normalize(nextMvPos.xy - mvPos.xy + vec2(0.0001));
    vec2 normal2D = vec2(-dir2D.y, dir2D.x);

    // Delicate, authentic ribbon width in view space (fine filament)
    float width = (0.022 + 0.038 * archCurve) * aSide;
    mvPos.xy += normal2D * width;

    gl_Position = projectionMatrix * mvPos;
  }
`;

const PROMINENCE_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying float vPhase;

  void main() {
    float across = abs(vUv.y - 0.5) * 2.0;
    float along = vUv.x;

    // Moving plasma flow along magnetic lines
    float flow = sin(along * 35.0 - uTime * 2.8 + vPhase) * 0.5 + 0.5;
    float filament = 0.7 + 0.3 * flow;

    // Soft Gaussian core across ribbon width
    float edgeFade = exp(-across * across * 3.2);

    // Fade out smoothly at footpoints on the surface
    float footpointFade = sin(along * 3.14159265);
    float alpha = edgeFade * footpointFade * filament * 0.85;

    if (alpha < 0.01) discard;

    // Solar plasma palette:
    vec3 fieryOrange = vec3(1.0, 0.28, 0.03);
    vec3 solarAmber  = vec3(1.0, 0.72, 0.16);
    vec3 whiteGold   = vec3(1.0, 0.96, 0.85);

    vec3 col = mix(fieryOrange, solarAmber, footpointFade * filament);
    col = mix(col, whiteGold, (1.0 - across) * footpointFade * 0.4);

    gl_FragColor = vec4(col * 1.6, alpha);
  }
`;

function SolarFlares({ count = 22, sunRadius = 5.0 }) {
  const materialRef = useRef(null);

  const geometry = useMemo(() => {
    const SEGMENTS_PER_LOOP = 24;
    const VERTS_PER_LOOP = (SEGMENTS_PER_LOOP + 1) * 2;
    const INDICES_PER_LOOP = SEGMENTS_PER_LOOP * 6;

    const totalVerts = count * VERTS_PER_LOOP;
    const totalIndices = count * INDICES_PER_LOOP;

    const positions = new Float32Array(totalVerts * 3);
    const uvs = new Float32Array(totalVerts * 2);
    const aProgress = new Float32Array(totalVerts);
    const aSide = new Float32Array(totalVerts);
    const aPhase = new Float32Array(totalVerts);
    const aHeight = new Float32Array(totalVerts);
    const aAnchorA = new Float32Array(totalVerts * 3);
    const aAnchorB = new Float32Array(totalVerts * 3);

    const indices = new Uint16Array(totalIndices);

    let vOffset = 0;
    let iOffset = 0;

    for (let loop = 0; loop < count; loop++) {
      // Magnetic active latitude belts: ±15° to ±45°
      const latSign = loop % 2 === 0 ? 1 : -1;
      const baseLat = latSign * (0.24 + (loop / count) * 0.5);
      const baseLon = (loop / count) * Math.PI * 2 + (loop * 1.4);

      // Footpoint span: arch covers 10° to 22°
      const spanAngle = 0.18 + Math.sin(loop * 2.3) * 0.1;
      const height = 0.35 + Math.abs(Math.sin(loop * 3.7)) * 0.65; // 0.35 to 1.0 units (realistic heights)
      const phase = loop * 1.73;

      // Calculate Footpoint A
      const latA = baseLat;
      const lonA = baseLon;
      const pAx = Math.cos(latA) * Math.cos(lonA) * sunRadius;
      const pAy = Math.sin(latA) * sunRadius;
      const pAz = Math.cos(latA) * Math.sin(lonA) * sunRadius;

      // Calculate Footpoint B (displaced along latitude & longitude)
      const latB = baseLat + Math.sin(loop * 1.5) * 0.1;
      const lonB = baseLon + spanAngle;
      const pBx = Math.cos(latB) * Math.cos(lonB) * sunRadius;
      const pBy = Math.sin(latB) * sunRadius;
      const pBz = Math.cos(latB) * Math.sin(lonB) * sunRadius;

      const loopStartVert = vOffset;

      for (let s = 0; s <= SEGMENTS_PER_LOOP; s++) {
        const p = s / SEGMENTS_PER_LOOP;

        // Two vertices per segment (-width and +width)
        for (let side = -1; side <= 1; side += 2) {
          const idx = vOffset;

          // Initial dummy position (computed in vertex shader)
          positions[idx * 3] = pAx;
          positions[idx * 3 + 1] = pAy;
          positions[idx * 3 + 2] = pAz;

          uvs[idx * 2] = p;
          uvs[idx * 2 + 1] = side === -1 ? 0.0 : 1.0;

          aProgress[idx] = p;
          aSide[idx] = side;
          aPhase[idx] = phase;
          aHeight[idx] = height;

          aAnchorA[idx * 3] = pAx;
          aAnchorA[idx * 3 + 1] = pAy;
          aAnchorA[idx * 3 + 2] = pAz;

          aAnchorB[idx * 3] = pBx;
          aAnchorB[idx * 3 + 1] = pBy;
          aAnchorB[idx * 3 + 2] = pBz;

          vOffset++;
        }

        // Indices for quad strip
        if (s < SEGMENTS_PER_LOOP) {
          const v0 = loopStartVert + s * 2;
          const v1 = v0 + 1;
          const v2 = v0 + 2;
          const v3 = v0 + 3;

          indices[iOffset++] = v0;
          indices[iOffset++] = v1;
          indices[iOffset++] = v2;

          indices[iOffset++] = v2;
          indices[iOffset++] = v1;
          indices[iOffset++] = v3;
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute("aProgress", new THREE.BufferAttribute(aProgress, 1));
    geo.setAttribute("aSide", new THREE.BufferAttribute(aSide, 1));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(aPhase, 1));
    geo.setAttribute("aHeight", new THREE.BufferAttribute(aHeight, 1));
    geo.setAttribute("aAnchorA", new THREE.BufferAttribute(aAnchorA, 3));
    geo.setAttribute("aAnchorB", new THREE.BufferAttribute(aAnchorB, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));

    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), sunRadius * 2.2);
    return geo;
  }, [count, sunRadius]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
    }),
    [],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh geometry={geometry} frustumCulled={false} renderOrder={2}>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={PROMINENCE_VERTEX_SHADER}
        fragmentShader={PROMINENCE_FRAGMENT_SHADER}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export default memo(SolarFlares);
