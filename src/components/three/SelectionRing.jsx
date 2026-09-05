import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { usePlanetStore } from "../../hooks/usePlanetStore.js";
import { unitsPerPixel } from "../../utils/screenUtils.js";

/**
 * The ring that marks the selected body.
 *
 * A billboarded quad with an annulus drawn into it. The interesting constraint
 * is that it has to read the same from two wildly different distances: from the
 * overview Mercury is under three pixels across, and from Phase 5's arrival
 * framing Jupiter fills half the screen. A ring built out of `ringGeometry`
 * cannot do both — one uniform mesh scale drives the radius *and* the stroke, so
 * a ring thin enough to look like a hairline up close is sub-pixel and gone at
 * the overview, and vice versa.
 *
 * Drawing it in a shader decouples the two. The radius is world-space (it grows
 * with the body, with a floor in pixels so a distant selection is still
 * findable) while the stroke is specified in pixels and converted to the quad's
 * own coordinates each frame. The result is a constant two-pixel line at every
 * distance.
 */

/** Mirrors --color-solar-400 in globals.css: selection is the warm accent. */
const RING_COLOR = "#fbbf24";

/** Where in the quad the ring sits, as a fraction of its half-extent. */
const RING_R = 0.82;

/** Ring radius in body radii, once the body is big enough on screen to lead. */
const RING_GAP = 1.45;

/** ...and its floor in pixels, for when it is not. */
const RING_MIN_PX = 24;

const STROKE_PX = 2.0;
const FEATHER_PX = 1.1;

/** Seconds⁻¹ of the fade in and out. ~0.3 s to settle. */
const DAMP = 9;

/** Below this the ring is invisible, so skip the draw call entirely. */
const HIDDEN = 0.004;

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uHalf;     // half the stroke, in units of r
  uniform float uFeather;  // antialias band, same units

  varying vec2 vUv;

  void main() {
    // 0 at the quad's centre, 1 at the midpoint of each edge.
    float r = length(vUv * 2.0 - 1.0);
    float d = abs(r - ${RING_R.toFixed(3)});

    float alpha = (1.0 - smoothstep(uHalf, uHalf + uFeather, d)) * uOpacity;
    // The ring occupies a thin annulus; the rest of the quad is empty, and
    // discarding it keeps the blend out of the way of everything behind.
    if (alpha < 0.003) discard;

    gl_FragColor = vec4(uColor, alpha);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const _worldPos = new THREE.Vector3();

/**
 * @param {string} bodyId  read from the store each frame, never subscribed to
 * @param {number} radius  the body's radius, in scene units
 */
function SelectionRing({ bodyId, radius }) {
  const meshRef = useRef(null);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        uniforms: {
          uColor: { value: new THREE.Color(RING_COLOR) },
          uOpacity: { value: 0 },
          uHalf: { value: 0.01 },
          uFeather: { value: 0.005 },
        },
        transparent: true,
        depthWrite: false,
        // A UI mark, not lit geometry: it should be exactly the colour the
        // design tokens say it is, not whatever ACES makes of it.
        toneMapped: false,
      }),
    [],
  );

  useEffect(() => () => material.dispose(), [material]);

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const selected = usePlanetStore.getState().selectedPlanetId === bodyId;
    const uniforms = material.uniforms;

    // A slow breath, on real time rather than simulation time — pausing the
    // system should not freeze the interface.
    const pulse = 0.74 + 0.26 * Math.sin(state.clock.elapsedTime * 1.9);
    const level = THREE.MathUtils.damp(uniforms.uOpacity.value / pulse, selected ? 1 : 0, DAMP, delta);

    uniforms.uOpacity.value = level * pulse;
    mesh.visible = level > HIDDEN;
    if (!mesh.visible) return;

    // Face the camera. Both this mesh's parent and the camera's are untransformed
    // (bodies only ever translate), so the local quaternion is the world one.
    mesh.quaternion.copy(state.camera.quaternion);

    _worldPos.setFromMatrixPosition(mesh.matrixWorld);
    const distance = state.camera.position.distanceTo(_worldPos);
    const upp = unitsPerPixel(state.camera, state.size.height, distance);

    // Hug the body when it is large on screen, hold a minimum size when it is
    // not — so selecting Mercury from the overview still shows something.
    const ringRadius = Math.max(radius * RING_GAP, RING_MIN_PX * upp);
    const scale = ringRadius / RING_R;
    mesh.scale.setScalar(scale);

    // Pixels -> world -> the quad's own r units, which is where the shader wants
    // them. This is the whole reason the ring is a shader and not a ringGeometry.
    uniforms.uHalf.value = (STROKE_PX * 0.5 * upp) / scale;
    uniforms.uFeather.value = (FEATHER_PX * upp) / scale;
  });

  return (
    <mesh name="selection-ring" ref={meshRef} material={material} visible={false} renderOrder={1}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}

export default memo(SelectionRing);
