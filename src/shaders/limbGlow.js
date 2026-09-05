import * as THREE from "three";

/**
 * The windowed-Fresnel limb glow, shared by everything in the scene that needs
 * light to gather along a body's edge.
 *
 * A shell slightly larger than the body, shaded so the glow peaks against the
 * body's silhouette and falls away in both directions — inward across the disc,
 * outward into space. That one trick is what separates a planet from a billiard
 * ball, and it costs a few hundred triangles and no lighting work.
 *
 * Three call sites, three jobs:
 *
 *   Atmosphere       Earth's air and Venus's haze, masked by the Sun direction
 *                    so the halo is brightest on the daylit limb.
 *   Sun (corona)     no mask — a self-luminous body glows evenly all round.
 *   BodyInteraction  the hover/selection rim, with the intensity animated.
 *
 * Getting the falloff right took two attempts, and both failures are worth
 * recording because the "obvious" shader is wrong in a way that looks almost
 * right:
 *
 *  1. A bare Fresnel term `pow(1 - facing, p)` is *brightest* where the shell
 *     turns away from the eye — at the shell's own outer silhouette — and
 *     dimmest where it meets the body. That is inside out: it draws a hard-edged
 *     disc floating in space rather than a halo. Multiplying by a window that
 *     vanishes at the silhouette flips the gradient the right way up.
 *
 *  2. Rendering the shell back-facing (the usual instinct, to avoid drawing over
 *     the body) depth-culls its entire inner half behind the body, so the glow
 *     stops dead at the limb and leaves a visible step. Front-facing, the near
 *     hemisphere spans the disc *and* the annulus as one continuous surface, so
 *     the falloff crosses the limb without a seam — bleeding inward over the
 *     terminator the way limb brightening actually does.
 */

const VERTEX_SHADER = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewW;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);

    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewW = normalize(cameraPosition - worldPosition.xyz);

    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uPower;
  uniform float uLimb;
  uniform float uNorm;

  #ifdef SOLAR_MASK
    uniform vec3 uSunDirection;
  #endif

  varying vec3 vNormalW;
  varying vec3 vViewW;

  void main() {
    vec3 normal = normalize(vNormalW);

    // abs() so the term is orientation-agnostic. 1 dead centre of the disc,
    // uLimb where the shell crosses the body's edge, 0 at the shell's own
    // silhouette.
    float facing = abs(dot(normal, normalize(vViewW)));

    // See note 1 above: the smoothstep is the window that turns an inside-out
    // Fresnel term into a halo that hugs the limb.
    float rim = pow(1.0 - facing, uPower) * smoothstep(0.0, uLimb, facing);

    float lit = 1.0;
    #ifdef SOLAR_MASK
      // Never reaches zero — a planet with no limb at all reads as a hole.
      lit = mix(0.12, 1.0, smoothstep(-0.45, 0.35, dot(normal, uSunDirection)));
    #endif

    // uNorm rescales the windowed peak back to 1, so uIntensity means peak
    // brightness no matter how thick the shell or how tight the falloff.
    float strength = rim * uNorm * lit * uIntensity;
    gl_FragColor = vec4(uColor * strength, strength);

    // Compiles to a no-op when the material sets toneMapped: false — three.js
    // drops the TONE_MAPPING define for it, ShaderMaterial included.
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * Peak of `smoothstep(0, limb, f) · pow(1 − f, power)` over f ∈ [0, 1].
 *
 * There is no tidy closed form. The window is still climbing while the Fresnel
 * term is already falling, so the maximum lands somewhere inside the annulus
 * rather than at either end, and how far in depends on both the shell's
 * thickness and its falloff — at scale 1.35 it overshoots the value at the limb
 * by roughly 2.4×, which is why assuming the peak sits *at* the limb produced
 * visibly inconsistent brightness between the corona and the planets. Sampling
 * is exact far below the resolution of any visible gradient and runs once per
 * material, which is cheaper than being clever.
 */
function windowedPeak(limb, power) {
  const STEPS = 256;
  let max = 0;
  for (let i = 0; i <= STEPS; i++) {
    const f = i / STEPS;
    const t = Math.min(f / limb, 1);
    const value = Math.pow(1 - f, power) * t * t * (3 - 2 * t);
    if (value > max) max = value;
  }
  return max;
}

/**
 * Build a limb-glow material.
 *
 * IMPORTANT: `scale` describes the shell the caller is *going* to render — it
 * only feeds the falloff geometry, it does not size anything. The mesh must
 * carry the same `scale`, or the glow will peak somewhere other than the body's
 * edge.
 *
 * @param {object}  options
 * @param {string|THREE.Color} options.color
 * @param {number}  options.scale         shell size in body radii
 * @param {number}  [options.intensity]   peak brightness of the glow
 * @param {number}  [options.power]       Fresnel falloff; higher = a tighter rim
 * @param {{ value: THREE.Vector3 }} [options.sunDirection]  supply to mask the
 *   glow by daylight; omit for a self-luminous body or a UI highlight
 * @param {boolean} [options.toneMapped]  false to let the glow run past 1.0 and
 *   into the bloom pass, or to hold a UI colour exactly as specified
 * @returns {THREE.ShaderMaterial}
 */
export function createLimbGlowMaterial({
  color,
  scale,
  intensity = 1.0,
  power = 3.0,
  sunDirection,
  toneMapped = true,
}) {
  // Where the shell crosses the body's own silhouette, as a value of `facing`:
  // a sight-line grazing the body (radius 1) pierces the shell (radius `scale`)
  // at an angle whose cosine is this. Clamped away from zero so a degenerate
  // scale of 1 cannot hand the shader an empty smoothstep.
  const limb = Math.max(Math.sqrt(Math.max(0, 1 - 1 / (scale * scale))), 1e-3);
  const peak = windowedPeak(limb, power);

  const uniforms = {
    uColor: { value: new THREE.Color(color) },
    uIntensity: { value: intensity },
    uPower: { value: power },
    uLimb: { value: limb },
    uNorm: { value: peak > 0 ? 1 / peak : 1 },
  };

  // Only declared when it is actually used. Leaving a stray uSunDirection on
  // every glow material would work — the shader would not declare it, so it
  // would simply go unbound — but it also makes "does this body have an
  // atmosphere?" unanswerable from the scene graph, which the diagnostics in
  // devBridge rely on.
  if (sunDirection) uniforms.uSunDirection = sunDirection;

  return new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    defines: sunDirection ? { SOLAR_MASK: "" } : {},
    uniforms,
    transparent: true,
    toneMapped,
    // Front-facing on purpose — see note 2 in the module comment.
    side: THREE.FrontSide,
    // Additive and depth-write-free, so the halo layers over the body and the
    // stars behind it instead of punching a hole in either.
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}
