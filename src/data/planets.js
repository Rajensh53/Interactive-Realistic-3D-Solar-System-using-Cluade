import {
  DEG2RAD,
  orbitTimeFromPeriod,
  semiMinorFromEccentricity,
} from "../utils/planetUtils.js";
import { getMoonById, getMoonsFor } from "./moons.js";

/**
 * The single source of truth for every body in the scene.
 *
 * FIELD GROUPS
 *  - Scene    : units, seconds, radians. Tuned for composition, not accuracy.
 *  - Physical : real measured values. Displayed in the details panel.
 *  - Material : texture paths and PBR hints consumed by <Planet />.
 *
 * MATERIAL FIELDS
 *  texture / cloudTexture / nightTexture / ringTexture  paths under /textures
 *  fallbackColor        used verbatim when a texture is missing or fails
 *  roughness, metalness standard PBR parameters
 *  nightLightIntensity  brightness of the city lights on the unlit hemisphere
 *  emissiveBoost        faint uniform self-illumination; the outer planets
 *                       receive so little sunlight that without it they read
 *                       as unlit grey spheres
 *  atmosphereColor      drives the Fresnel limb glow
 *  hazeColor            a thicker, broader variant of the same shell (Venus)
 *
 * SCALE NOTE
 * Sizes and distances use two independent scales. At true scale the Sun would
 * be 109 Earths wide and Neptune 30× further out than Earth — nothing would
 * compose on screen. Radii are eased toward the middle and orbits are spaced
 * for legibility. Everything shown as a *number* comes from the physical
 * fields, which are untouched.
 *
 * ROTATION / RETROGRADE NOTE
 * Every body spins with a positive `rotationSpeed`. Retrograde rotation is
 * encoded by axial tilt alone — Venus (177.4°) and Uranus (97.8°) are tilted
 * past vertical, so a positive spin about their own axis reads as backwards
 * from the ecliptic north. Negating the speed *as well* would cancel the tilt
 * and wrongly render them prograde.
 *
 * MOON COUNTS
 * IAU-confirmed totals as of 2025. The outer planets' counts climb steadily as
 * surveys find more small irregular moons; treat them as a snapshot.
 */

const TEX = "/textures/planets";

/** Categories shown under the planet name in the details panel. */
export const CATEGORY = {
  STAR: "G-type Main-sequence Star",
  TERRESTRIAL: "Terrestrial Planet",
  GAS_GIANT: "Gas Giant",
  ICE_GIANT: "Ice Giant",
};

export const SUN = {
  id: "sun",
  name: "Sun",
  category: CATEGORY.STAR,
  description:
    "The star at the heart of it all — a 4.6-billion-year-old sphere of plasma holding 99.86% of the Solar System's mass, and the source of very nearly all its light and heat.",

  // Scene
  radius: 5.0,
  rotationSpeed: 0.004,
  axialTilt: 7.25 * DEG2RAD,

  // Material
  texture: `${TEX}/2k_sun.jpg`,
  fallbackColor: "#ffcf6b",

  // Physical
  diameterKm: 1_391_400,
  gravity: "274 m/s²",
  temperature: "5,500 °C surface · 15 million °C core",
  dayLength: "25 Earth days at the equator",
  yearLength: "230 million years around the galaxy",
  moonCount: null,

  facts: [
    "It holds 99.86% of all the mass in the Solar System — everything else, including Jupiter, is a rounding error.",
    "Energy made in the core takes tens of thousands of years to reach the surface, then just 8 minutes to reach Earth.",
    "It fuses roughly 600 million tonnes of hydrogen every second.",
    "It rotates faster at the equator (25 days) than at the poles (35 days), because it isn't solid.",
  ],
};

/**
 * @typedef {object} PlanetSceneFields
 * @property {number} radius        sphere radius in scene units
 * @property {number} semiMajor     orbital semi-major axis, scene units
 * @property {number} semiMinor     derived: a·√(1−e²)
 * @property {number} eccentricity  real orbital eccentricity
 * @property {number} initialAngle  starting orbital angle, radians
 * @property {number} orbitTimeSeconds  derived from the real period
 * @property {number} rotationSpeed rad/s about its own axis (always positive)
 * @property {number} axialTilt     radians
 */

const PLANET_SOURCE = [
  {
    id: "mercury",
    name: "Mercury",
    category: CATEGORY.TERRESTRIAL,
    description:
      "The smallest planet and the closest to the Sun — an airless, cratered world that swings through a 600-degree temperature range between its day and night sides.",

    radius: 0.38,
    semiMajor: 14,
    eccentricity: 0.2056,
    initialAngleDeg: 0,
    rotationSpeed: 0.05,
    axialTiltDeg: 0.034,

    texture: `${TEX}/2k_mercury.jpg`,
    fallbackColor: "#9c8e82",
    roughness: 0.95,
    metalness: 0.0,

    orbitalPeriodYears: 0.2408,
    semiMajorAU: 0.3871,
    diameterKm: 4879,
    distanceFromSunKm: 57_900_000,
    gravity: "3.7 m/s²",
    temperature: "−173 °C to 427 °C",
    dayLength: "58.6 Earth days",
    yearLength: "88 Earth days",
    orbitalSpeed: "47.4 km/s",
    moonCount: 0,

    facts: [
      "A single solar day — sunrise to sunrise — lasts 176 Earth days, which is two full Mercury years.",
      "It is not the hottest planet despite being nearest the Sun; Venus's atmosphere traps far more heat.",
      "Its iron core fills about 85% of the planet's radius, proportionally the largest of any planet.",
      "Water ice survives in crater floors at its poles that sunlight has never reached.",
    ],
  },
  {
    id: "venus",
    name: "Venus",
    category: CATEGORY.TERRESTRIAL,
    description:
      "Earth's twin in size and nothing like it in temperament. A runaway greenhouse effect beneath permanent sulfuric-acid cloud makes this the hottest surface in the Solar System.",

    radius: 0.95,
    semiMajor: 19,
    eccentricity: 0.0068,
    initialAngleDeg: 90,
    rotationSpeed: 0.03,
    axialTiltDeg: 177.36, // past vertical — this is what makes Venus retrograde

    texture: `${TEX}/2k_venus_atmosphere.jpg`,
    fallbackColor: "#e6c98a",
    roughness: 0.8,
    metalness: 0.0,
    hazeColor: "#f6d9a0",

    orbitalPeriodYears: 0.6152,
    semiMajorAU: 0.7233,
    diameterKm: 12_104,
    distanceFromSunKm: 108_200_000,
    gravity: "8.87 m/s²",
    temperature: "464 °C (near-constant)",
    dayLength: "243 Earth days (retrograde)",
    yearLength: "225 Earth days",
    orbitalSpeed: "35.0 km/s",
    moonCount: 0,

    facts: [
      "It rotates backwards — on Venus the Sun rises in the west and sets in the east.",
      "Surface pressure is about 92 times Earth's, the same crush you would feel 900 m under the ocean.",
      "Its sulfuric-acid clouds circle the planet in just four Earth days, far faster than the surface turns.",
      "At 464 °C the surface is hot enough to melt lead — hotter than Mercury's day side.",
    ],
  },
  {
    id: "earth",
    name: "Earth",
    category: CATEGORY.TERRESTRIAL,
    description:
      "The only world known to harbour life. A thin blue atmosphere, oceans of liquid water and a protective magnetic field make it a rare and narrow place in a hostile system.",

    radius: 1.0,
    semiMajor: 25,
    eccentricity: 0.0167,
    initialAngleDeg: 210,
    rotationSpeed: 0.75,
    axialTiltDeg: 23.44,

    texture: `${TEX}/2k_earth_daymap.jpg`,
    cloudTexture: `${TEX}/2k_earth_clouds.jpg`,
    nightTexture: `${TEX}/2k_earth_nightmap.jpg`,
    // City lights, masked to the unlit hemisphere by the surface material.
    nightLightIntensity: 1.15,
    fallbackColor: "#2f6db5",
    roughness: 0.7,
    metalness: 0.05,
    atmosphereColor: "#5aa9ff",

    orbitalPeriodYears: 1.0,
    semiMajorAU: 1.0,
    diameterKm: 12_742,
    distanceFromSunKm: 149_600_000,
    gravity: "9.81 m/s²",
    temperature: "−89 °C to 58 °C",
    dayLength: "23.9 hours",
    yearLength: "365.25 days",
    orbitalSpeed: "29.8 km/s",
    moonCount: 1,

    facts: [
      "It is the only known world with liquid water on its surface — 71% of it is ocean.",
      "Its rotation is slowing: days lengthen by roughly 1.7 milliseconds per century.",
      "Earth travels around the Sun at about 107,000 km/h — some 30 km every second.",
      "Its magnetic field deflects the solar wind, and funnels what gets through into the auroras.",
    ],
  },
  {
    id: "mars",
    name: "Mars",
    category: CATEGORY.TERRESTRIAL,
    description:
      "A cold desert of rust-red dust, dry river valleys and the tallest volcano in the Solar System — and, by a wide margin, the most explored world beyond our own.",

    radius: 0.53,
    semiMajor: 32,
    eccentricity: 0.0934,
    initialAngleDeg: 290,
    rotationSpeed: 0.78,
    axialTiltDeg: 25.19,

    texture: `${TEX}/2k_mars.jpg`,
    fallbackColor: "#c1592e",
    roughness: 0.92,
    metalness: 0.0,

    orbitalPeriodYears: 1.8808,
    semiMajorAU: 1.5237,
    diameterKm: 6779,
    distanceFromSunKm: 227_900_000,
    gravity: "3.72 m/s²",
    temperature: "−140 °C to 20 °C (−63 °C average)",
    dayLength: "24.6 hours",
    yearLength: "687 Earth days",
    orbitalSpeed: "24.1 km/s",
    moonCount: 2,

    facts: [
      "Olympus Mons rises about 22 km — nearly two and a half times the height of Everest.",
      "Its colour comes from iron oxide: the surface dust is quite literally rust.",
      "Mars has seasons much like Earth's, because its axial tilt of 25.2° is almost identical.",
      "Its moons Phobos and Deimos are probably captured asteroids; Phobos is slowly spiralling inward.",
    ],
  },
  {
    id: "jupiter",
    name: "Jupiter",
    category: CATEGORY.GAS_GIANT,
    description:
      "A colossal ball of hydrogen and helium more massive than every other planet combined, wrapped in banded storm systems that have churned for centuries.",

    radius: 3.5,
    semiMajor: 46,
    eccentricity: 0.0489,
    initialAngleDeg: 340,
    rotationSpeed: 1.6,
    axialTiltDeg: 3.13,

    texture: `${TEX}/2k_jupiter.jpg`,
    fallbackColor: "#c9a178",
    roughness: 0.65,
    metalness: 0.0,
    emissiveBoost: 0.05,

    orbitalPeriodYears: 11.862,
    semiMajorAU: 5.2038,
    diameterKm: 139_820,
    distanceFromSunKm: 778_500_000,
    gravity: "24.79 m/s²",
    temperature: "−108 °C at the cloud tops",
    dayLength: "9.9 hours",
    yearLength: "11.9 Earth years",
    orbitalSpeed: "13.1 km/s",
    moonCount: 97,

    facts: [
      "It is two and a half times more massive than all the other planets put together.",
      "The Great Red Spot is a storm wider than Earth that has been observed for at least 190 years.",
      "A day lasts under 10 hours — the fastest spin of any planet, which visibly flattens its poles.",
      "Its magnetic field is the strongest of any planet, roughly 20,000 times Earth's.",
    ],
  },
  {
    id: "saturn",
    name: "Saturn",
    category: CATEGORY.GAS_GIANT,
    description:
      "The jewel of the Solar System — a gas giant light enough to float on water, encircled by the brightest and most intricate ring system we know of.",

    radius: 3.0,
    semiMajor: 62,
    eccentricity: 0.0565,
    initialAngleDeg: 45,
    rotationSpeed: 1.5,
    axialTiltDeg: 26.73,

    texture: `${TEX}/2k_saturn.jpg`,
    ringTexture: `${TEX}/2k_saturn_ring_alpha.png`,
    // Ring extent in planet radii: inner edge of the C ring to outer edge of A.
    ringInner: 1.28,
    ringOuter: 2.35,
    fallbackColor: "#e0c08f",
    roughness: 0.68,
    metalness: 0.0,
    emissiveBoost: 0.05,

    orbitalPeriodYears: 29.457,
    semiMajorAU: 9.5826,
    diameterKm: 116_460,
    distanceFromSunKm: 1_434_000_000,
    gravity: "10.44 m/s²",
    temperature: "−139 °C at the cloud tops",
    dayLength: "10.7 hours",
    yearLength: "29.4 Earth years",
    orbitalSpeed: "9.7 km/s",
    moonCount: 274,

    facts: [
      "The rings span 280,000 km but are often less than 10 m thick — almost entirely water ice.",
      "Saturn is less dense than water; given a big enough ocean, it would float.",
      "A six-sided jet stream sits over its north pole, each side longer than Earth is wide.",
      "Its moon Titan is the only moon with a thick atmosphere, and has lakes of liquid methane.",
    ],
  },
  {
    id: "uranus",
    name: "Uranus",
    category: CATEGORY.ICE_GIANT,
    description:
      "An ice giant knocked onto its side, rolling around the Sun with poles that face sunward for decades at a time. A methane haze gives it an almost featureless blue-green face.",

    radius: 1.5,
    semiMajor: 78,
    eccentricity: 0.0457,
    initialAngleDeg: 120,
    rotationSpeed: 0.9,
    axialTiltDeg: 97.77, // rolls on its side — the tilt also makes it retrograde

    texture: `${TEX}/2k_uranus.jpg`,
    fallbackColor: "#9fd4e8",
    roughness: 0.55,
    metalness: 0.0,
    emissiveBoost: 0.06,
    atmosphereColor: "#a9e2f0",

    orbitalPeriodYears: 84.017,
    semiMajorAU: 19.1913,
    diameterKm: 50_724,
    distanceFromSunKm: 2_871_000_000,
    gravity: "8.87 m/s²",
    temperature: "−195 °C",
    dayLength: "17.2 hours (retrograde)",
    yearLength: "84 Earth years",
    orbitalSpeed: "6.8 km/s",
    moonCount: 28,

    facts: [
      "It rotates on its side at a 98° tilt, most likely knocked over by an enormous ancient impact.",
      "Each pole spends about 42 years in unbroken sunlight, then 42 years in darkness.",
      "It was the first planet discovered with a telescope, by William Herschel in 1781.",
      "Its blue-green colour comes from methane in the upper atmosphere, which absorbs red light.",
    ],
  },
  {
    id: "neptune",
    name: "Neptune",
    category: CATEGORY.ICE_GIANT,
    description:
      "The outermost planet — a deep blue ice giant with the fiercest winds in the Solar System, found by mathematics before anyone had seen it.",

    radius: 1.45,
    semiMajor: 92,
    eccentricity: 0.0113,
    initialAngleDeg: 250,
    rotationSpeed: 0.95,
    axialTiltDeg: 28.32,

    texture: `${TEX}/2k_neptune.jpg`,
    fallbackColor: "#4166e0",
    roughness: 0.55,
    metalness: 0.0,
    emissiveBoost: 0.08,
    atmosphereColor: "#5b7cf0",

    orbitalPeriodYears: 164.79,
    semiMajorAU: 30.07,
    diameterKm: 49_244,
    distanceFromSunKm: 4_495_000_000,
    gravity: "11.15 m/s²",
    temperature: "−201 °C",
    dayLength: "16.1 hours",
    yearLength: "164.8 Earth years",
    orbitalSpeed: "5.4 km/s",
    moonCount: 16,

    facts: [
      "It was found by mathematics — predicted from wobbles in Uranus's orbit before being observed.",
      "Its winds reach 2,100 km/h, the fastest measured anywhere in the Solar System.",
      "It has completed just one orbit since its discovery in 1846; that anniversary fell in 2011.",
      "Its largest moon, Triton, orbits backwards and is probably a captured Kuiper Belt object.",
    ],
  },
];

/**
 * Derive the fields that must stay consistent with each other, so no hand-typed
 * value can drift out of sync with the maths.
 */
export const PLANETS = PLANET_SOURCE.map((p) => ({
  ...p,
  initialAngle: p.initialAngleDeg * DEG2RAD,
  axialTilt: p.axialTiltDeg * DEG2RAD,
  semiMinor: semiMinorFromEccentricity(p.semiMajor, p.eccentricity),
  orbitTimeSeconds: orbitTimeFromPeriod(p.orbitalPeriodYears),
}));

/** Every selectable body, Sun first — drives the navigation rail. */
export const BODIES = [SUN, ...PLANETS];

/** id -> body, for O(1) lookup from the store and camera controller. */
export const BODY_BY_ID = new Map(BODIES.map((b) => [b.id, b]));

export const PLANET_IDS = PLANETS.map((p) => p.id);

export function getBodyById(id) {
  return BODY_BY_ID.get(id) || getMoonById(id);
}

/** Earth, used as the reference point for the "distance from Earth" readout. */
export const EARTH = BODY_BY_ID.get("earth");

/**
 * Neighbouring body id, wrapping at both ends. Powers the details panel's
 * previous/next controls. If currently inspecting a moon, cycles through sibling
 * moons of the same parent planet.
 * @param {string} id
 * @param {1|-1} step
 */
export function getAdjacentPlanetId(id, step) {
  const moon = getMoonById(id);
  if (moon) {
    const siblings = getMoonsFor(moon.parentId);
    if (siblings && siblings.length > 1) {
      const idx = siblings.findIndex((m) => m.id === id);
      const nextIdx = (idx + step + siblings.length) % siblings.length;
      return siblings[nextIdx].id;
    }
    return moon.parentId; // Jump back to parent planet if sole moon
  }

  const index = PLANET_IDS.indexOf(id);
  if (index === -1) return PLANET_IDS[0];
  const next = (index + step + PLANET_IDS.length) % PLANET_IDS.length;
  return PLANET_IDS[next];
}
