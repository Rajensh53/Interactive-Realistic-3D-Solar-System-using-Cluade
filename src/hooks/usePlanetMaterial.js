import { useEffect, useMemo } from "react";
import * as THREE from "three";

import { getTexture } from "../utils/textureUtils.js";

/**
 * Builds the surface material for a body.
 *
 * Everything here is data-driven off the body record, so adding a night map or
 * a self-illumination boost is a data edit rather than a new code path:
 *
 *   texture        albedo map; absent or failed -> flat `fallbackColor`
 *   nightTexture   city lights, masked to the unlit hemisphere
 *   emissiveBoost  faint uniform self-illumination for the outer planets
 *
 * NIGHT LIGHTS
 * `emissiveMap` alone would glow through the daylit side too, which reads as a
 * bug. The fix is a two-line patch to the standard shader: compare the
 * world-space surface normal against the direction to the Sun and fade the
 * emissive term out across the terminator. Patching `MeshStandardMaterial`
 * rather than writing a bespoke shader keeps the real PBR lighting, shadows and
 * tone mapping intact — a hand-rolled material would have to reimplement all of
 * it to look right next to its neighbours.
 *
 * The comparison is done in world space so the effect does not depend on the
 * camera; the only per-frame work is one normalised vector, written by
 * `<Planet />`.
 *
 * @param {object} body
 * @param {{ value: THREE.Vector3 }} sunDirection  updated each frame by the caller
 */
export function usePlanetMaterial(body, sunDirection) {
  const material = useMemo(() => {
    const map = getTexture(body.texture);
    const nightMap = getTexture(body.nightTexture);

    const surface = new THREE.MeshStandardMaterial({
      map,
      // With a map present the tint must be white or it double-darkens the
      // albedo; without one the flat colour *is* the planet (spec §28).
      color: map ? "#ffffff" : body.fallbackColor,
      roughness: body.roughness ?? 0.8,
      metalness: body.metalness ?? 0,
    });

    if (nightMap) {
      surface.emissiveMap = nightMap;
      surface.emissive = new THREE.Color("#ffffff");
      surface.emissiveIntensity = body.nightLightIntensity ?? 1.1;

      surface.onBeforeCompile = (shader) => {
        shader.uniforms.uSunDirection = sunDirection;

        shader.vertexShader = `varying vec3 vSolarNormal;\n${shader.vertexShader}`.replace(
          "#include <beginnormal_vertex>",
          `#include <beginnormal_vertex>
           vSolarNormal = normalize( mat3( modelMatrix ) * objectNormal );`,
        );

        shader.fragmentShader = `uniform vec3 uSunDirection;
          varying vec3 vSolarNormal;\n${shader.fragmentShader}`.replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
           // 1 facing the Sun, -1 facing away. The smoothstep band is what
           // makes the lights bleed a little past the terminator instead of
           // switching on along a hard line.
           float solarFacing = dot( normalize( vSolarNormal ), uSunDirection );
           totalEmissiveRadiance *= 1.0 - smoothstep( -0.15, 0.25, solarFacing );`,
        );
      };

      // Without this three.js reuses the unpatched standard program for any
      // other MeshStandardMaterial with the same feature set.
      surface.customProgramCacheKey = () => "planet-night-lights";
    } else if (body.ringInner) {
      surface.onBeforeCompile = (shader) => {
        shader.uniforms.uSunDirection = sunDirection;
        shader.uniforms.uRingInner = { value: body.radius * body.ringInner };
        shader.uniforms.uRingOuter = { value: body.radius * body.ringOuter };

        shader.vertexShader = `uniform vec3 uSunDirection;
          varying vec3 vLocalPos;
          varying vec3 vLocalSun;\n${shader.vertexShader}`.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           vLocalPos = position;
           vLocalSun = normalize(uSunDirection * mat3(modelMatrix));`,
        );

        shader.fragmentShader = `uniform float uRingInner;
          uniform float uRingOuter;
          varying vec3 vLocalPos;
          varying vec3 vLocalSun;\n${shader.fragmentShader}`.replace(
          "#include <dithering_fragment>",
          `#include <dithering_fragment>
           // Ring shadow cast on Saturn's atmosphere:
           vec3 localSun = normalize(vLocalSun);
           if (abs(localSun.y) > 0.001) {
             float tRing = -vLocalPos.y / localSun.y;
             if (tRing > 0.0) {
               vec3 hit = vLocalPos + tRing * localSun;
               float rHit = length(hit.xz);
               float inRing = smoothstep(uRingInner * 0.98, uRingInner * 1.02, rHit) *
                              (1.0 - smoothstep(uRingOuter * 0.98, uRingOuter * 1.02, rHit));
               gl_FragColor.rgb *= 1.0 - inRing * 0.70;
             }
           }`,
        );
      };

      surface.customProgramCacheKey = () => "planet-ring-shadow";
    }

    if (body.emissiveBoost) {
      // The outer planets receive very little light at these distances. A trace
      // of self-illumination keeps them from reading as unlit grey spheres,
      // without flattening the terminator the way raised ambient would.
      surface.emissiveMap = map;
      surface.emissive = new THREE.Color("#ffffff");
      surface.emissiveIntensity = body.emissiveBoost;
    }

    return surface;
  }, [body, sunDirection]);

  useEffect(() => () => material.dispose(), [material]);

  return material;
}

/**
 * A per-body uniform holding the unit vector from the body toward the Sun.
 *
 * Lives in a mutable uniform object rather than React state: it changes every
 * frame, and the rule for this scene is that nothing continuous touches the
 * render tree.
 */
export function useSunDirection() {
  return useMemo(() => ({ value: new THREE.Vector3(1, 0, 0) }), []);
}
