import { DEG2RAD } from "../utils/planetUtils.js";

/**
 * Moons.
 *
 * Only Earth's Moon ships with a texture (Solar System Scope has no maps for
 * the Galilean moons or Titan at this resolution), so the rest are rendered
 * from measured colour: Io's sulfur yellows, Europa's ice, Ganymede and
 * Callisto's darker rock, Titan's orange haze.
 *
 * SCALE NOTE
 * Moon radii and orbits are exaggerated relative to their parents. At true
 * scale Io would be 3% of Jupiter's radius and sit almost on its cloud tops —
 * invisible, and impossible to distinguish from the planet when focused.
 * Orbit periods keep the real *ordering* (Io fastest, Callisto slowest) so the
 * Galilean dance still reads correctly.
 *
 * Moon orbits are circular and coplanar with their parent's equator; the real
 * inclinations are a fraction of a degree and would not be visible.
 */

const TEX = "/textures/planets";

const MOON_SOURCE = [
  {
    id: "moon",
    name: "Moon",
    parentId: "earth",
    radius: 0.27,
    orbitRadius: 2.3,
    orbitTimeSeconds: 45,
    rotationSpeed: 0.08,
    inclinationDeg: 5.14,
    initialAngleDeg: 45,
    texture: `${TEX}/2k_moon.jpg`,
    fallbackColor: "#b8b2ac",
    roughness: 0.98,
  },
  {
    id: "io",
    name: "Io",
    parentId: "jupiter",
    radius: 0.29,
    orbitRadius: 4.9,
    orbitTimeSeconds: 20,
    rotationSpeed: 0.1,
    inclinationDeg: 0.04,
    initialAngleDeg: 0,
    fallbackColor: "#d9b25f",
    roughness: 0.9,
  },
  {
    id: "europa",
    name: "Europa",
    parentId: "jupiter",
    radius: 0.25,
    orbitRadius: 5.5,
    orbitTimeSeconds: 28,
    rotationSpeed: 0.1,
    inclinationDeg: 0.47,
    initialAngleDeg: 110,
    fallbackColor: "#c8c2c0",
    roughness: 0.45, // icy — noticeably shinier than its siblings
  },
  {
    id: "ganymede",
    name: "Ganymede",
    parentId: "jupiter",
    radius: 0.41,
    orbitRadius: 6.5,
    orbitTimeSeconds: 40,
    rotationSpeed: 0.09,
    inclinationDeg: 0.2,
    initialAngleDeg: 220,
    fallbackColor: "#8a7a6a",
    roughness: 0.85,
  },
  {
    id: "callisto",
    name: "Callisto",
    parentId: "jupiter",
    radius: 0.38,
    orbitRadius: 7.8,
    orbitTimeSeconds: 60,
    rotationSpeed: 0.08,
    inclinationDeg: 0.19,
    initialAngleDeg: 300,
    fallbackColor: "#6b625c",
    roughness: 0.95,
  },
  {
    id: "titan",
    name: "Titan",
    parentId: "saturn",
    radius: 0.4,
    orbitRadius: 5.1,
    orbitTimeSeconds: 55,
    rotationSpeed: 0.08,
    inclinationDeg: 0.33,
    initialAngleDeg: 160,
    fallbackColor: "#d8a05a",
    roughness: 0.7,
    // Titan's nitrogen haze — rendered as a faint emissive shell.
    hazeColor: "#e8b877",
  },
];

export const MOONS = MOON_SOURCE.map((m) => ({
  ...m,
  initialAngle: m.initialAngleDeg * DEG2RAD,
  inclination: m.inclinationDeg * DEG2RAD,
}));

/** parentId -> moons, so <Planet> can render its own satellites. */
const MOONS_BY_PARENT = MOONS.reduce((map, moon) => {
  const list = map.get(moon.parentId) ?? [];
  list.push(moon);
  map.set(moon.parentId, list);
  return map;
}, new Map());

const NO_MOONS = Object.freeze([]);

/**
 * Moons orbiting a given planet.
 * Returns a shared frozen empty array for moonless planets so callers can use
 * the result directly in a dependency array without churning identities.
 */
export function getMoonsFor(planetId) {
  return MOONS_BY_PARENT.get(planetId) ?? NO_MOONS;
}
