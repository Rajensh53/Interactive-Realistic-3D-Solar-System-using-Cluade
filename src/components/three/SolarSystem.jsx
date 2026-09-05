import { memo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";

import Sun from "./Sun.jsx";
import Planet from "./Planet.jsx";
import Orbit from "./Orbit.jsx";
import StarField from "./StarField.jsx";
import SkyDome from "./SkyDome.jsx";
import SpaceEnvironment from "./SpaceEnvironment.jsx";
import { PLANETS } from "../../data/planets.js";
import { advanceClock } from "../../utils/planetUtils.js";
import { useTexturesReady } from "../../utils/textureUtils.js";
import { usePlanetStore } from "../../hooks/usePlanetStore.js";

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
 * The scene graph: the Sun, the eight planets with their moons and orbit
 * traces, and the star field and Milky Way around it all.
 *
 * This is the scene's single Suspense point. Every texture is requested as one
 * batch before React mounts, and `useTexturesReady` holds the whole tree back
 * until they have all settled — loaded or failed. Below here, texture lookups
 * are synchronous and no component suspends on its own, so there is no chance
 * of a load waterfall or of planets popping in one at a time.
 */
function SolarSystem({ showOrbits, starCount = 10000, onReady }) {
  useTexturesReady();
  const orbitsEnabled = usePlanetStore((s) => s.settings.orbitLines);
  const renderOrbits = showOrbits ?? orbitsEnabled;

  // Runs only once the boundary above has resolved, which makes it an honest
  // "assets are in, the scene can be shown" signal for the loading screen.
  useEffect(() => {
    onReady?.();
  }, [onReady]);

  return (
    <>
      <SimulationClock />

      {/* Just enough fill light that night sides read as dark rather than as
          holes cut out of the screen. */}
      <ambientLight intensity={0.08} />

      <Sun />

      {PLANETS.map((body) => (
        <Planet key={body.id} body={body} />
      ))}

      {renderOrbits
        ? PLANETS.map((body) => <Orbit key={`orbit-${body.id}`} body={body} />)
        : null}

      <StarField count={starCount} />
      <SkyDome />
      <SpaceEnvironment />
    </>
  );
}

export default memo(SolarSystem);
