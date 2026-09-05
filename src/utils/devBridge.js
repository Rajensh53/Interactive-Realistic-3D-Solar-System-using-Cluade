import * as THREE from "three";

import {
  simulationClock,
  bodyRegistry,
  orbitalPositionAt,
} from "./planetUtils.js";
import { PLANETS, BODIES } from "../data/planets.js";
import { MOONS } from "../data/moons.js";
import { getTextureFailures, textureStatus, setAnisotropy } from "./textureUtils.js";
import { usePlanetStore } from "../hooks/usePlanetStore.js";
import { TIER_CONFIG } from "../hooks/useQualityTier.js";

/**
 * Dev-only diagnostics handle, exposed as `window.__solar`.
 *
 * Stripped from production builds by the `import.meta.env.DEV` guard at the
 * call site — Rolldown drops the whole branch, and this module with it.
 *
 * Exists so the running scene can be inspected from the outside: does the
 * rendered world position of a body actually agree with the orbital maths, is
 * the frame loop advancing, is anything NaN. Cheaper and far more reliable
 * than reading it off a screenshot.
 */
export function installDevBridge() {
  const scratch = new THREE.Vector3();
  const expected = { x: 0, y: 0, z: 0 };

  window.__solar = {
    clock: simulationClock,
    registry: bodyRegistry,

    /** Jump the simulation to an absolute time (seconds). */
    setTime(t) {
      simulationClock.time = t;
      return simulationClock.time;
    },

    /** Pause/resume without stopping the render loop. */
    setTimeScale(scale) {
      simulationClock.timeScale = scale;
      return simulationClock.timeScale;
    },

    /** What the registry says is mounted right now. */
    mounted() {
      return [...bodyRegistry.keys()];
    },

    /**
     * Compare every planet's *rendered* world position against the position
     * the orbital maths says it should occupy. Any drift means the scene graph
     * and the simulation have diverged.
     */
    verifyPositions() {
      const t = simulationClock.time;
      return PLANETS.map((body) => {
        const entry = bodyRegistry.get(body.id);
        if (!entry?.object3D) return { id: body.id, mounted: false };

        entry.object3D.getWorldPosition(scratch);
        orbitalPositionAt(body, t, expected);

        const drift = Math.hypot(
          scratch.x - expected.x,
          scratch.y - expected.y,
          scratch.z - expected.z,
        );

        return {
          id: body.id,
          mounted: true,
          rendered: [+scratch.x.toFixed(4), +scratch.z.toFixed(4)],
          expected: [+expected.x.toFixed(4), +expected.z.toFixed(4)],
          drift: +drift.toFixed(6),
          radius: +Math.hypot(scratch.x, scratch.z).toFixed(3),
        };
      });
    },

    /** Axial tilt and spin as actually applied in the scene graph, in degrees. */
    verifyOrientation() {
      return PLANETS.map((body) => {
        const entry = bodyRegistry.get(body.id);
        const tiltGroup = entry?.object3D?.children.find((c) => c.isGroup);
        const spinMesh = tiltGroup?.children.find((c) => c.isMesh);
        return {
          id: body.id,
          tiltDeg: tiltGroup ? +THREE.MathUtils.radToDeg(tiltGroup.rotation.z).toFixed(2) : null,
          expectedTiltDeg: body.axialTiltDeg,
          spinDeg: spinMesh
            ? +(THREE.MathUtils.radToDeg(spinMesh.rotation.y) % 360).toFixed(1)
            : null,
        };
      });
    },

    /** Moon world positions relative to their parent planet. */
    verifyMoons() {
      const parent = new THREE.Vector3();
      return MOONS.map((moon) => {
        const m = bodyRegistry.get(moon.id);
        const p = bodyRegistry.get(moon.parentId);
        if (!m?.object3D || !p?.object3D) return { id: moon.id, mounted: false };
        m.object3D.getWorldPosition(scratch);
        p.object3D.getWorldPosition(parent);
        return {
          id: moon.id,
          mounted: true,
          parent: moon.parentId,
          distanceFromParent: +scratch.distanceTo(parent).toFixed(3),
          expected: moon.orbitRadius,
        };
      });
    },

    /** Anything non-finite anywhere in the scene is a bug worth failing on. */
    findNaN() {
      const bad = [];
      for (const [id, entry] of bodyRegistry) {
        const p = entry.object3D?.position;
        if (!p) continue;
        if (![p.x, p.y, p.z].every(Number.isFinite)) bad.push(id);
      }
      return bad;
    },

    /** Load outcome for every file in the manifest. */
    textures: textureStatus,

    /** Files that fell back to a flat colour. Should be empty. */
    textureFailures: getTextureFailures,

    /**
     * What the planets are *actually* wearing.
     *
     * Reads each body's real material off the scene graph rather than trusting
     * the data: a path typo or a colour-space mistake shows up here as a
     * missing map or the wrong transfer function, not as a subtly-off
     * screenshot nobody notices.
     */
    verifyMaterials() {
      const describe = (texture) =>
        texture
          ? {
              size: `${texture.image?.width}x${texture.image?.height}`,
              colorSpace: texture.colorSpace,
              anisotropy: texture.anisotropy,
              file: texture.image?.currentSrc?.split("/").pop() ?? null,
            }
          : null;

      return PLANETS.map((body) => {
        const entry = bodyRegistry.get(body.id);
        const tiltGroup = entry?.object3D?.children.find((c) => c.isGroup);
        const meshes = tiltGroup?.children.filter((c) => c.isMesh) ?? [];
        const surface = meshes[0];
        const material = surface?.material;

        return {
          id: body.id,
          map: describe(material?.map),
          emissiveMap: describe(material?.emissiveMap),
          emissiveIntensity: material?.emissiveIntensity ?? null,
          nightLightPatch: material?.customProgramCacheKey?.() ?? null,
          // Clouds and rings are siblings of the surface inside the tilt group.
          extraLayers: meshes.length - 1,
          atmosphere: (entry?.object3D?.children ?? []).some(
            (c) => c.isMesh && c.material?.uniforms?.uSunDirection,
          ),
        };
      });
    },

    /** Where each planet currently thinks the Sun is, as a unit vector. */
    verifySunDirection() {
      return PLANETS.map((body) => {
        const entry = bodyRegistry.get(body.id);
        const dir = entry?.object3D?.userData?.sunDirection?.value;
        if (!dir || !entry?.object3D) return { id: body.id, mounted: false };

        entry.object3D.getWorldPosition(scratch);
        // The Sun is at the origin, so the direction to it must be the exact
        // opposite of the planet's position, and of unit length.
        const expected = scratch.negate().normalize();
        return {
          id: body.id,
          length: +dir.length().toFixed(6),
          errorFromExpected: +dir.distanceTo(expected).toFixed(6),
        };
      });
    },

    /** Interaction test helpers. */
    select(id) {
      usePlanetStore.getState().selectPlanet(id);
      return usePlanetStore.getState().selectedPlanetId;
    },

    clearSelection() {
      usePlanetStore.getState().clearSelection();
      return usePlanetStore.getState().selectedPlanetId;
    },

    getSelected() {
      return usePlanetStore.getState().selectedPlanetId;
    },

    hover(id) {
      usePlanetStore.getState().setHovered(id);
      return usePlanetStore.getState().hoveredPlanetId;
    },

    clearHover(id) {
      usePlanetStore.getState().clearHovered(id);
      return usePlanetStore.getState().hoveredPlanetId;
    },

    getHovered() {
      return usePlanetStore.getState().hoveredPlanetId;
    },

    toggleSetting(key) {
      usePlanetStore.getState().toggleSetting(key);
      return usePlanetStore.getState().settings;
    },

    getSettings() {
      return usePlanetStore.getState().settings;
    },

    getCameraPhase() {
      return usePlanetStore.getState().cameraPhase;
    },

    resetView() {
      usePlanetStore.getState().clearSelection();
      return "returning to overview";
    },

    setTier(tier) {
      if (!TIER_CONFIG[tier]) return `Unknown tier: ${tier}. Use 'high' | 'medium' | 'low'`;
      usePlanetStore.getState().setQualityTier(tier);
      setAnisotropy(TIER_CONFIG[tier].anisotropy);
      return { tier, config: TIER_CONFIG[tier] };
    },

    getTier() {
      const tier = usePlanetStore.getState().qualityTier;
      return { tier, config: TIER_CONFIG[tier] };
    },

    bodyCount: BODIES.length,
    moonCount: MOONS.length,
  };
}


