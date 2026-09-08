/**
 * Photorealistic Solar Photosphere & Chromosphere Shader
 *
 * Implements an incandescent, photorealistic solar surface:
 * - Multi-stream convective plasma flow with differential solar rotation
 * - High-fidelity NASA Solar Dynamics Observatory (SDO) albedo integration
 * - Physical Eddington solar limb darkening
 * - Chromospheric rim brightening that seamlessly blends into the coronal halo
 * - Dynamic active plage radiance that triggers realistic bloom without blowing out
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

  // Compact 3D noise for gentle plasma turbulence
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
    // 1. Solar differential rotation (equator rotates faster than poles)
    float t = uTime * 0.012;
    float latCos = cos((vUv.y - 0.5) * 3.14159265);
    float differential = 0.025 + 0.015 * latCos;
    // Do NOT use fract() here: hardware RepeatWrapping handles wrapping seamlessly without mipmap derivative seam
    vec2 uvFlow = vec2(vUv.x + t * differential, vUv.y);

    // 2. Sample NASA SDO solar texture with polar anti-pinching blend
    vec3 baseTex = vec3(1.0, 0.72, 0.25);
    if (uHasTexture > 0.5) {
      vec3 rawTex = texture2D(uTexture, uvFlow).rgb;
      
      // Equirectangular textures naturally stretch at poles (|y - 0.5| > 0.44).
      // Smoothly blend polar caps into pure 3D procedural plasma noise.
      float polarDist = abs(vUv.y - 0.5) * 2.0; // 0 at equator, 1 at poles
      float polarEase = smoothstep(0.86, 0.98, polarDist);
      
      vec3 polarNeutral = vec3(0.95, 0.62, 0.18);
      baseTex = mix(rawTex, polarNeutral, polarEase);
    }

    // 3. Multi-frequency 3D noise for organic convective plasma boiling
    // Uses 3D sphere coordinate (vPosition) — completely seam-free and isotropic!
    vec3 p1 = vPosition * 0.55 + vec3(0.0, t * 0.15, 0.0);
    vec3 p2 = vPosition * 1.45 - vec3(t * 0.22, 0.0, 0.0);
    vec3 p3 = vPosition * 3.20 + vec3(0.0, 0.0, t * 0.28);

    float n1 = snoise(p1);
    float n2 = snoise(p2) * 0.5;
    float n3 = snoise(p3) * 0.25;
    float boilingPlasma = clamp((n1 + n2 + n3) * 0.55 + 0.5, 0.0, 1.0);

    // 4. Photosphere Color Dynamics & Convective Cells
    // Deep incandescent amber, vibrant solar gold, white-hot cell cores
    vec3 deepAmber   = vec3(0.88, 0.32, 0.02);
    vec3 radiantGold = vec3(1.0, 0.74, 0.18);
    vec3 whiteHot    = vec3(1.0, 0.98, 0.92);

    // Modulate base texture: preserves dark sunspots while animating granulation
    vec3 plasmaTone = mix(deepAmber, radiantGold, smoothstep(0.25, 0.75, boilingPlasma));
    vec3 color = baseTex * (0.82 + 0.32 * plasmaTone);

    // 5. Physical Eddington Solar Limb Darkening
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    float cosTheta = clamp(dot(normal, viewDir), 0.0, 1.0);
    
    // Physical Eddington law: Disc center is bright, limb drops to ~45% intensity
    float limbDarkening = 0.45 + 0.55 * pow(cosTheta, 0.60);
    color *= limbDarkening;

    // 6. Chromosphere Incandescent Rim Fringe
    // Ultra-thin glowing chromosphere layer right at the silhouette
    float rimFacing = 1.0 - cosTheta;
    float rimGlow = pow(rimFacing, 4.0) * 1.7;
    vec3 rimColor = mix(vec3(1.0, 0.55, 0.06), vec3(1.0, 0.94, 0.72), smoothstep(0.65, 0.98, rimFacing));
    color += rimColor * rimGlow;

    // 7. Active Magnetic Plages / Faculae
    // Only the brightest magnetic active regions bloom
    float luminance = dot(baseTex, vec3(0.299, 0.587, 0.114));
    float plage = smoothstep(0.72, 0.96, luminance);
    color += whiteHot * (plage * 0.42);

    // Final output: natural incandescent star with rich depth and visible sunspots
    gl_FragColor = vec4(color, 1.0);
  }
`;
