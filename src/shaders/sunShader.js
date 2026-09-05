/**
 * Photospheric Sun Shader
 *
 * Implements an animated solar photosphere with:
 * - Boiling convective granulation via 3D Simplex noise
 * - UV swirl and magnetic turbulence
 * - Physical solar limb darkening
 * - Active magnetic plage/hotspot boosting for selective celestial bloom
 */

export const SUN_VERTEX_SHADER = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying vec3 vViewPosition;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const SUN_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uTexture;
  uniform float uHasTexture;
  uniform float uTime;
  uniform vec3 uColorCore;
  uniform vec3 uColorMid;
  uniform vec3 uColorEdge;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying vec3 vViewPosition;

  //
  // Simplex 3D noise implementation (Stefan Gustavson / Ian McEwan)
  //
  vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    // First corner
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

    // Permutations
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    // Gradients
    float n_ = 1.0 / 7.0; // N=7
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z); // mod(p, N*N)

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_); // mod(j, N)

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

    // Normalise gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    // Mix contributions
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  void main() {
    // 1. Convective UV perturbation
    vec2 perturbedUv = vUv;
    perturbedUv.x += uTime * 0.003;
    perturbedUv.y += sin(uTime * 0.02 + vUv.x * 6.28) * 0.004;

    // 2. Sample solar albedo texture if present
    vec3 baseTex = vec3(1.0);
    if (uHasTexture > 0.5) {
      baseTex = texture2D(uTexture, perturbedUv).rgb;
    }

    // 3. Multi-frequency 3D noise for convective plasma
    vec3 noiseCoord1 = vPosition * 0.5 + vec3(0.0, uTime * 0.04, 0.0);
    vec3 noiseCoord2 = vPosition * 1.4 - vec3(0.0, uTime * 0.09, 0.0);
    vec3 noiseCoord3 = vPosition * 3.2 + vec3(uTime * 0.12, 0.0, 0.0);

    float n1 = snoise(noiseCoord1);
    float n2 = snoise(noiseCoord2);
    float n3 = snoise(noiseCoord3);

    // Combined boiling granulation
    float granulation = clamp((n1 * 0.5 + n2 * 0.35 + n3 * 0.25) * 0.5 + 0.5, 0.0, 1.0);

    // 4. Color grading from solar plasma palette
    vec3 plasmaColor = mix(uColorEdge, uColorMid, smoothstep(0.2, 0.6, granulation));
    plasmaColor = mix(plasmaColor, uColorCore, smoothstep(0.6, 0.95, granulation));

    // Combine with underlying texture details (sunspots, large-scale features)
    vec3 finalColor = plasmaColor * baseTex;

    // 5. Solar limb darkening (Eddington approximation)
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    float cosTheta = clamp(dot(normal, viewDir), 0.0, 1.0);
    float limbDarkening = 0.45 + 0.55 * pow(cosTheta, 0.6);

    finalColor *= limbDarkening;

    // 6. Active regions / flare plage boost
    // Peaks in the granulation field are boosted beyond 1.0 to trigger blooming
    float activePeak = smoothstep(0.65, 1.0, granulation);
    finalColor += uColorCore * (activePeak * 1.6);

    // Overall energy multiplier so the star is self-luminous and blooms
    gl_FragColor = vec4(finalColor * 2.3, 1.0);
  }
`;
