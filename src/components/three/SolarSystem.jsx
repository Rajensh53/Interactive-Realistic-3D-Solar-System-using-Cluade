import { memo, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";

import Sun from "./Sun.jsx";
import Planet from "./Planet.jsx";
import Orbit from "./Orbit.jsx";
import StarField from "./StarField.jsx";
import SkyDome from "./SkyDome.jsx";
import SpaceEnvironment from "./SpaceEnvironment.jsx";
import { getScaledPlanets } from "../../data/planets.js";
import { advanceClock, cameraAnchors } from "../../utils/planetUtils.js";
import { useTexturesReady } from "../../utils/textureUtils.js";
import { usePlanetStore } from "../../hooks/usePlanetStore.js";
import { TIER_CONFIG } from "../../hooks/useQualityTier.js";

/**
 * Advances the simulation clock once per frame, ahead of everything that reads
 * it.
 *
 * The priority of -1 matters. R3F registers useFrame callbacks in layout-effect
 * order, which runs children before parents — so without an explicit priority
 * every body would read the *previous* frame's time. A negative priority sorts
 * this callback first while leaving R3F's automatic rendering intact (only
 * priorities above zero hand rendering over to the caller).
 */
function SimulationClock() {
  useFrame((_, delta) => {
    // Clamp the delta so a backgrounded tab returning after 30 seconds doesn't
    // teleport every planet through a third of its orbit.
    advanceClock(Math.min(delta, 0.1));
  }, -1);

  return null;
}

/**
 * Holds the backdrop (stars, sky dome, nebulae) on the camera in true-scale
 * mode. Those shells are 320-860 u across, which at true scale would sit
 * inside Uranus's orbit; anchored to the camera they read as infinitely far
 * away wherever the camera goes. Compact mode leaves them at the origin, as
 * before.
 */
function CameraAnchor({ enabled, children }) {
  const groupRef = useRef(null);

  useEffect(() => {
    const group = groupRef.current;
    if (!enabled || !group) return;
    cameraAnchors.add(group);
    return () => {
      cameraAnchors.delete(group);
      group.position.set(0, 0, 0);
    };
  }, [enabled]);

  return <group ref={groupRef}>{children}</group>;
}

/**
 * The scene graph: the Sun, the eight planets with their moons and orbit
 * traces, and the star field and Milky Way around it all.
 *
 * This is the scene's single Suspense point. Every texture is requested as one
 * batch before React mounts, and `useTexturesReady` holds the whole tree back
 * until they have all settled — loaded or failed. Below here, texture lookups
 * are synchronous and no component suspends on its own, so there is no chance
 * of a load waterfall or of planets popping in one at a time.
 */
function SolarSystem({ showOrbits, starCount, onReady }) {
  useTexturesReady();
  const orbitsEnabled = usePlanetStore((s) => s.settings.orbitLines);
  const qualityTier = usePlanetStore((s) => s.qualityTier) || "high";
  const tierConfig = TIER_CONFIG[qualityTier] || TIER_CONFIG.high;
  const renderOrbits = showOrbits ?? orbitsEnabled;
  const scaleMode = usePlanetStore((s) => s.settings.scaleMode);
  const trueScale = scaleMode === "true";
  // Same ids in both layouts, so switching modes updates bodies in place.
  const planets = getScaledPlanets(scaleMode);

  const hasFiredReadyRef = useRef(false);
  useEffect(() => {
    if (!hasFiredReadyRef.current) {
      hasFiredReadyRef.current = true;
      onReady?.();
    }
  }, [onReady]);

  return (
    <>
      <SimulationClock />

      {/* Just enough fill light that night sides read as dark rather than as
          holes cut out of the screen. */}
      <ambientLight intensity={0.08} />

      <Sun trueScale={trueScale} />

      {planets.map((body) => (
        <Planet key={body.id} body={body} trueScale={trueScale} />
      ))}

      {renderOrbits
        ? planets.map((body) => <Orbit key={`orbit-${body.id}`} body={body} />)
        : null}

      <CameraAnchor enabled={trueScale}>
        <StarField count={starCount ?? tierConfig.starCount} />
        <SkyDome />
        <SpaceEnvironment
          dustCount={tierConfig.dustCount}
          nebulaShells={tierConfig.nebulaShells}
          // The dust disc is sized for the compact layout; at true scale it
          // would be a cloud around the camera, so let space be empty.
          showDust={!trueScale}
        />
      </CameraAnchor>
    </>
  );
}

export default memo(SolarSystem);
