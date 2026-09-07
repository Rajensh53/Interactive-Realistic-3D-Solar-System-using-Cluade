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
    "The incandescent yellow dwarf star (G2V) at the center of our Solar System, located 149.6 million km (1 AU / 8.3 light-minutes) from Earth and orbiting ~26,000 light-years from the Milky Way's galactic core. It contains 99.86% of the system's total mass.",

  // Scene
  radius: 5.0,
  rotationSpeed: 0.004,
  axialTilt: 7.25 * DEG2RAD,

  // Material
  texture: `${TEX}/2k_sun.jpg`,
  fallbackColor: "#ffcf6b",

  // Physical
  diameterKm: 1_392_700,
  distanceFromSunKm: 0,
  distanceToEarthKm: 149_600_000,
  distanceToGalacticCenter: "~26,000 light-years",
  gravity: "274.0 m/s² (27.9 g)",
  temperature: "5,500 °C surface · 15.7 million °C core",
  dayLength: "25 Earth days (equator) to 36 days (poles)",
  yearLength: "230 million years around the galaxy",
  orbitalSpeed: "220 km/s (galactic orbit)",
  moonCount: null,

  facts: [
    "Average distance to Earth is 149.6 million km (1.00 AU / 8.3 light-minutes), varying between 147.1M km at perihelion and 152.1M km at aphelion.",
    "It accounts for 99.86% of all the mass in the Solar System — all eight planets together are just a 0.14% fraction.",
    "The core undergoes continuous thermonuclear fusion, converting roughly 600 million tonnes of hydrogen into helium every second.",
    "Energy generated in the core takes over 100,000 years to diffuse to the surface, but then travels to Earth in just 8 minutes and 20 seconds.",
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
    gravity: "3.7 m/s² (0.38 g)",
    temperature: "−180 °C to 430 °C",
    dayLength: "58.6 Earth days (176d solar day)",
    yearLength: "88 Earth days",
    orbitalSpeed: "47.4 km/s",
    moonCount: 0,

    facts: [
      "A single solar day on Mercury (sunrise to sunrise) lasts 176 Earth days—twice as long as its entire 88-day orbital year.",
      "Despite its proximity to the Sun, it is not the hottest planet; lacking an atmosphere, nightside temperatures drop to −180 °C.",
      "Its massive iron-rich core occupies about 85% of the planet's radius, proportionally the largest metallic core of any planet.",
      "Radar observations confirmed that deposits of water ice survive perpetually frozen in deep, permanently shadowed polar craters.",
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
    gravity: "8.87 m/s² (0.90 g)",
    temperature: "465 °C (870 °F) constant",
    dayLength: "243 Earth days (retrograde)",
    yearLength: "225 Earth days",
    orbitalSpeed: "35.0 km/s",
    moonCount: 0,

    facts: [
      "Venus rotates backwards (retrograde), meaning the Sun rises in the west and sets in the east, with one day lasting longer than its year.",
      "Surface pressure reaches an immense 92 bars (9.3 MPa), the crushing equivalent of being 900 meters (3,000 feet) underwater on Earth.",
      "Its runaway greenhouse effect traps heat beneath thick carbon dioxide and sulfuric acid clouds, creating a blistering 465 °C surface.",
      "High-altitude cloud decks circle the planet every 4 Earth days (super-rotation), traveling 60 times faster than the planetary surface.",
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
    gravity: "9.81 m/s² (1.0 g)",
    temperature: "−89 °C to 57 °C (15 °C avg)",
    dayLength: "23.93 hours (24h solar)",
    yearLength: "365.25 days",
    orbitalSpeed: "29.8 km/s",
    moonCount: 1,

    facts: [
      "Earth is the only known astronomical body in the universe confirmed to support life and sustain liquid surface water.",
      "Oceans cover roughly 70.8% of the global surface, holding over 1.3 billion cubic kilometers of liquid water.",
      "The churning liquid iron outer core generates a robust magnetic shield that protects the biosphere from dangerous solar radiation.",
      "Its rotation is gradually slowing by ~1.7 milliseconds per century due to tidal friction exerted by the Moon's gravitational pull.",
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
    gravity: "3.72 m/s² (0.38 g)",
    temperature: "−140 °C to 20 °C (−63 °C avg)",
    dayLength: "24.62 hours (1 Sol)",
    yearLength: "687 Earth days (1.88 Earth years)",
    orbitalSpeed: "24.1 km/s",
    moonCount: 2,

    facts: [
      "Hosts Olympus Mons, a shield volcano towering 21.9 km (13.6 miles) high—nearly three times the elevation of Mount Everest.",
      "The Valles Marineris canyon system cuts across 4,000 km of the Martian equator, reaching depths of 7 km (4x deeper than the Grand Canyon).",
      "Its reddish hue is caused by widespread iron oxide (rust) pervasive throughout the soil and planetary dust storms.",
      "Mars has two small irregular moons, Phobos and Deimos; tidal forces are drawing Phobos closer until it breaks apart into a ring in ~50 million years.",
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
    diameterKm: 142_984,
    distanceFromSunKm: 778_500_000,
    gravity: "24.79 m/s² (2.53 g)",
    temperature: "−110 °C at cloud tops",
    dayLength: "9.93 hours (fastest spin)",
    yearLength: "11.86 Earth years (4,333 days)",
    orbitalSpeed: "13.1 km/s",
    moonCount: 95,

    facts: [
      "Jupiter has 95 officially recognized moons, headlined by the four giant Galilean satellites: Io, Europa, Ganymede, and Callisto.",
      "It is 2.5 times more massive than all the other planets in the Solar System combined (318 times Earth's mass).",
      "The iconic Great Red Spot is an enormous anticyclonic storm wider than Earth that has raged for at least 190 years.",
      "Its supersonic 9.9-hour rotation produces a massive equatorial bulge, visibly flattening the polar diameter by over 9,000 km.",
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
    diameterKm: 120_536,
    distanceFromSunKm: 1_434_000_000,
    gravity: "10.44 m/s² (1.06 g)",
    temperature: "−140 °C at cloud tops",
    dayLength: "10.7 hours",
    yearLength: "29.45 Earth years (10,759 days)",
    orbitalSpeed: "9.7 km/s",
    moonCount: 146,

    facts: [
      "Saturn leads the solar system with 146 officially recognized moons, including Titan, which possesses lakes of liquid methane.",
      "Its magnificent rings span up to 282,000 km across, yet are paper-thin—averaging only 10 to 30 meters in thickness.",
      "It is the least dense planet in the Solar System (0.687 g/cm³)—lighter than water, meaning it would float in a sufficiently large ocean.",
      "A mysterious, persistent six-sided jet stream known as the Hexagon spins over its north pole, spanning nearly 30,000 km across.",
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
    diameterKm: 51_118,
    distanceFromSunKm: 2_871_000_000,
    gravity: "8.87 m/s² (0.90 g)",
    temperature: "−224 °C to −195 °C (coldest atmosphere)",
    dayLength: "17.2 hours (retrograde)",
    yearLength: "84 Earth years",
    orbitalSpeed: "6.8 km/s",
    moonCount: 28,

    facts: [
      "Uranus rolls on its side with an extreme axial tilt of 97.8°, causing each pole to spend 42 continuous Earth years in sunlight followed by 42 years of darkness.",
      "It holds the record for the coldest atmospheric temperature measured in the solar system, plunging as low as −224 °C (−371 °F).",
      "It was the first planet discovered with a telescope in modern history, identified by astronomer William Herschel in 1781.",
      "Its pale cyan-aquamarine appearance is caused by atmospheric methane absorbing red light wavelengths and reflecting blue-green back into space.",
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
    diameterKm: 49_528,
    distanceFromSunKm: 4_495_000_000,
    gravity: "11.15 m/s² (1.14 g)",
    temperature: "−201 °C to −218 °C",
    dayLength: "16.1 hours",
    yearLength: "164.8 Earth years",
    orbitalSpeed: "5.4 km/s",
    moonCount: 16,

    facts: [
      "Neptune experiences the most violent supersonic winds in the Solar System, clocking speeds exceeding 2,100 km/h (1,300 mph).",
      "It is the only planet located via mathematical prediction rather than empirical telescope discovery, calculated by Le Verrier in 1846.",
      "Its giant moon Triton orbits backwards (retrograde) and features active cryovolcanoes shooting plumes of nitrogen ice 8 km into space.",
      "Despite being 4.5 billion km from the Sun, Neptune radiates 2.6 times more internal heat than it receives from sunlight.",
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
