import { DEG2RAD } from "../utils/planetUtils.js";

/**
 * Moons Data Layer
 *
 * Authentic NASA/JPL planetary satellites:
 * - Earth: Moon
 * - Jupiter: Galilean Moons (Io, Europa, Ganymede, Callisto)
 * - Saturn: Titan
 *
 * Real physical characteristics, authentic descriptions, and curated NASA facts.
 */

const TEX = "/textures/planets";

const MOON_SOURCE = [
  {
    id: "moon",
    name: "Moon",
    category: "Terrestrial Satellite",
    parentId: "earth",
    parentName: "Earth",
    description:
      "Earth's constant celestial companion, a desolate world of grey pulverized regolith, ancient basaltic lava plains (maria), and rugged impact highlands that has witnessed four billion years of cosmic bombardment.",

    radius: 0.27,
    orbitRadius: 2.3,
    orbitTimeSeconds: 45,
    rotationSpeed: 0.08,
    inclinationDeg: 5.14,
    initialAngleDeg: 45,

    texture: `${TEX}/2k_moon.jpg`,
    fallbackColor: "#b8b2ac",
    roughness: 0.98,

    diameterKm: 3474,
    distanceFromParentKm: 384400,
    orbitalPeriod: "27.3 days (Synchronous)",
    gravity: "1.62 m/s² (0.166 g)",
    temperature: "−130 °C to 120 °C",
    orbitalSpeed: "1.02 km/s",

    facts: [
      "The Moon is in synchronous rotation with Earth, always presenting the exact same face toward our home planet.",
      "Its gravitational pull produces oceanic tides on Earth, which gradually slows Earth's rotation by ~1.7 ms per century.",
      "Formed approximately 4.5 billion years ago, likely from debris left by a giant collision between proto-Earth and Theia.",
      "It is the fifth-largest moon in the solar system and remains the only celestial body beyond Earth ever visited by humans.",
    ],
  },
  {
    id: "io",
    name: "Io",
    category: "Galilean Moon",
    parentId: "jupiter",
    parentName: "Jupiter",
    description:
      "The most volcanically violent body in the Solar System, an infernal sulfurous world of hundreds of erupting calderas, glowing silicate lava lakes, and towering sulfur plumes driven by relentless tidal friction.",

    radius: 0.29,
    orbitRadius: 4.9,
    orbitTimeSeconds: 20,
    rotationSpeed: 0.1,
    inclinationDeg: 0.04,
    initialAngleDeg: 0,

    fallbackColor: "#d9b25f",
    roughness: 0.9,

    diameterKm: 3643,
    distanceFromParentKm: 421700,
    orbitalPeriod: "1.77 days (42.5 hours)",
    gravity: "1.796 m/s² (0.183 g)",
    temperature: "−143 °C avg (lava to 1,300 °C)",
    orbitalSpeed: "17.3 km/s",

    facts: [
      "Io hosts over 400 active volcanoes and is the most geologically active and dynamic object known in our solar system.",
      "Extreme tidal heating from gravitational tug-of-wars between Jupiter, Europa, and Ganymede continuously melts its mantle.",
      "Spectacular sulfurous volcanic plumes erupt at supersonic speeds over 500 km (300 miles) high into space.",
      "Its surface is painted in striking hues of yellow, orange, and black, perpetually repaved by fresh volcanic fallout.",
    ],
  },
  {
    id: "europa",
    name: "Europa",
    category: "Galilean Moon",
    parentId: "jupiter",
    parentName: "Jupiter",
    description:
      "A pristine, brilliant billiard ball of fractured water ice hiding a vast, global warm saltwater ocean underneath — universally regarded by astrobiologists as humanity's best chance of discovering extraterrestrial life.",

    radius: 0.25,
    orbitRadius: 5.5,
    orbitTimeSeconds: 28,
    rotationSpeed: 0.1,
    inclinationDeg: 0.47,
    initialAngleDeg: 110,

    fallbackColor: "#c8c2c0",
    roughness: 0.45,

    diameterKm: 3122,
    distanceFromParentKm: 670900,
    orbitalPeriod: "3.55 days (85.2 hours)",
    gravity: "1.315 m/s² (0.134 g)",
    temperature: "−160 °C to −220 °C",
    orbitalSpeed: "13.7 km/s",

    facts: [
      "Europa's subsurface liquid ocean contains an estimated two to three times more water than all of Earth's oceans combined.",
      "Its brilliant icy crust is crisscrossed by reddish mineral fractures (lineae) caused by severe gravitational flexing from Jupiter.",
      "Cryovolcanic geysers of water vapor have been detected by Hubble and ground observatories venting through icy fissures.",
      "NASA's flagship Europa Clipper mission is on its way to investigate its subsurface habitability and chemistry.",
    ],
  },
  {
    id: "ganymede",
    name: "Ganymede",
    category: "Galilean Moon",
    parentId: "jupiter",
    parentName: "Jupiter",
    description:
      "The undisputed king of natural satellites, a colossal world larger than the planet Mercury with an internally generated dynamo magnetosphere and complex terrain of dark cratered regions cut by pale grooved tectonic bands.",

    radius: 0.41,
    orbitRadius: 6.5,
    orbitTimeSeconds: 40,
    rotationSpeed: 0.09,
    inclinationDeg: 0.2,
    initialAngleDeg: 220,

    fallbackColor: "#8a7a6a",
    roughness: 0.85,

    diameterKm: 5268,
    distanceFromParentKm: 1070400,
    orbitalPeriod: "7.15 days (171.7 hours)",
    gravity: "1.428 m/s² (0.146 g)",
    temperature: "−113 °C to −183 °C",
    orbitalSpeed: "10.9 km/s",

    facts: [
      "Ganymede is the largest moon in the Solar System, boasting an equatorial diameter greater than Mercury and Pluto.",
      "It is the only moon in the solar system known to possess its own internally generated dipole magnetic field and auroral belts.",
      "Beneath its thick silicate and icy mantle lies a deep, multi-layered sandwich of high-pressure ice and liquid saltwater.",
      "Its auroral wobbles detected by the Hubble Space Telescope provided definitive proof of an electrically conductive ocean.",
    ],
  },
  {
    id: "callisto",
    name: "Callisto",
    category: "Galilean Moon",
    parentId: "jupiter",
    parentName: "Jupiter",
    description:
      "An ancient, dark, heavily battered ice-rock world whose crater-saturated face is virtually unchanged since the solar system's turbulent birth over four billion years ago, undisturbed by tectonic or volcanic upheaval.",

    radius: 0.38,
    orbitRadius: 7.8,
    orbitTimeSeconds: 60,
    rotationSpeed: 0.08,
    inclinationDeg: 0.19,
    initialAngleDeg: 300,

    fallbackColor: "#6b625c",
    roughness: 0.95,

    diameterKm: 4821,
    distanceFromParentKm: 1882700,
    orbitalPeriod: "16.7 days (400.5 hours)",
    gravity: "1.236 m/s² (0.126 g)",
    temperature: "−108 °C to −193 °C",
    orbitalSpeed: "8.2 km/s",

    facts: [
      "Callisto is the most heavily cratered celestial body in the solar system, with no internal geologic activity erasing its scars.",
      "It orbits outside Jupiter's lethal radiation belts, making it the premier staging ground for future crewed exploration of Jupiter.",
      "Huge multi-ring concentric impact scars like Valhalla Basin span across 4,000 kilometers of its icy-rock crust.",
      "Because its interior never completely stratified into a dense core, Callisto is a primordial blend of equal parts rock and ice.",
    ],
  },
  {
    id: "titan",
    name: "Titan",
    category: "Hazy Nitrogen Moon",
    parentId: "saturn",
    parentName: "Saturn",
    description:
      "Saturn's crowning gem, an extraordinary cryogenic Earth-analogue veiled under a thick, golden nitrogen-methane atmosphere, with dark hydrocarbon dune fields, river deltas, and expansive seas of liquid methane.",

    radius: 0.4,
    orbitRadius: 5.1,
    orbitTimeSeconds: 55,
    rotationSpeed: 0.08,
    inclinationDeg: 0.33,
    initialAngleDeg: 160,

    fallbackColor: "#d8a05a",
    roughness: 0.7,
    hazeColor: "#e8b877",

    diameterKm: 5150,
    distanceFromParentKm: 1221870,
    orbitalPeriod: "15.9 days (382.7 hours)",
    gravity: "1.352 m/s² (0.138 g)",
    temperature: "−179 °C (−290 °F)",
    orbitalSpeed: "5.57 km/s",

    facts: [
      "Titan is the only moon in the solar system with a substantial atmosphere, with surface pressure 50% higher than Earth's.",
      "It is the only celestial body besides Earth with a confirmed active liquid hydrologic cycle — with methane clouds, rain, and seas.",
      "A golden photochemically produced smog of complex pre-biotic organic hydrocarbons (tholins) wraps the entire world.",
      "In 2005, the Cassini-Huygens probe landed on Titan's icy floodplain, beaming back images of smooth rounded water-ice pebbles.",
    ],
  },
];

export const MOONS = MOON_SOURCE.map((m) => ({
  ...m,
  initialAngle: m.initialAngleDeg * DEG2RAD,
  inclination: m.inclinationDeg * DEG2RAD,
}));

export const MOON_BY_ID = new Map(MOONS.map((m) => [m.id, m]));

export function getMoonById(id) {
  return MOON_BY_ID.get(id);
}

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
