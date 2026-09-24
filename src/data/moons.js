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
 * Sources: NASA Science moon pages, JPL SSD satellite physical parameters.
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
    temperature: "−173 °C to 127 °C",
    orbitalSpeed: "1.02 km/s",
    mass: "7.342 × 10²² kg (0.0123 Earths)",
    density: "3.34 g/cm³",
    escapeVelocity: "2.38 km/s",
    orbitalEccentricity: 0.0549,
    rotation: "27.3 days (tidally locked)",
    atmosphere: "Near-vacuum exosphere (helium, argon, neon, sodium)",
    discovery: "Known since prehistory",

    facts: [
      "The Moon is in synchronous rotation with Earth, always presenting the exact same face toward our home planet.",
      "Its gravitational pull raises the ocean tides on Earth, and it is drifting away from us by about 3.8 cm every year.",
      "Formed approximately 4.5 billion years ago, likely from debris left by a giant collision between proto-Earth and Theia.",
      "It is the fifth-largest moon in the solar system and remains the only celestial body beyond Earth ever visited by humans.",
      "Its surface gravity is about one-sixth of Earth's, which is why Apollo astronauts could bound across the surface.",
      "Twelve astronauts walked on the Moon during six Apollo landings between 1969 and 1972.",
      "Water ice survives in permanently shadowed craters near the lunar poles, a key resource for future exploration.",
      "Shallow moonquakes can last up to about 10 minutes, because the dry, rigid interior rings like a bell.",
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
    temperature: "−163 °C avg (lava up to ~1,600 °C)",
    orbitalSpeed: "17.3 km/s",
    mass: "8.932 × 10²² kg",
    density: "3.53 g/cm³ (densest Galilean moon)",
    escapeVelocity: "2.56 km/s",
    orbitalEccentricity: 0.0041,
    rotation: "1.77 days (tidally locked)",
    atmosphere: "Thin, patchy sulfur dioxide (SO₂)",
    discovery: "Galileo Galilei, January 1610",

    facts: [
      "Io hosts over 400 active volcanoes and is the most geologically active and dynamic object known in our solar system.",
      "Extreme tidal heating from gravitational tug-of-wars between Jupiter, Europa, and Ganymede continuously melts its mantle.",
      "Spectacular sulfurous volcanic plumes erupt at supersonic speeds up to 400–500 km (250–300 miles) high into space.",
      "Its surface is painted in striking hues of yellow, orange, and black, perpetually repaved by fresh volcanic fallout.",
      "Io is slightly larger than Earth's Moon and is the densest of Jupiter's four Galilean moons.",
      "It is locked in a 1:2:4 orbital resonance with Europa and Ganymede, which keeps its orbit slightly eccentric and its interior hot.",
      "Voyager 1 discovered its active volcanism in 1979—the first eruptions ever seen beyond Earth.",
      "Gas escaping from Io feeds a doughnut of charged particles around Jupiter called the Io plasma torus.",
    ],
  },
  {
    id: "europa",
    name: "Europa",
    category: "Galilean Moon",
    parentId: "jupiter",
    parentName: "Jupiter",
    description:
      "A pristine, brilliant billiard ball of fractured water ice hiding a vast, global liquid saltwater ocean underneath — universally regarded by astrobiologists as humanity's best chance of discovering extraterrestrial life.",

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
    mass: "4.800 × 10²² kg",
    density: "3.01 g/cm³",
    escapeVelocity: "2.03 km/s",
    orbitalEccentricity: 0.009,
    rotation: "3.55 days (tidally locked)",
    atmosphere: "Extremely thin molecular oxygen (O₂)",
    discovery: "Galileo Galilei, January 1610",

    facts: [
      "Europa's subsurface liquid ocean is estimated to hold about twice as much water as all of Earth's oceans combined.",
      "Its brilliant icy crust is crisscrossed by reddish mineral fractures (lineae) caused by severe gravitational flexing from Jupiter.",
      "Cryovolcanic geysers of water vapor have been detected by Hubble and ground observatories venting through icy fissures.",
      "NASA's Europa Clipper, launched in October 2024, is en route to arrive at Jupiter in 2030 and investigate Europa's habitability.",
      "Europa is slightly smaller than Earth's Moon.",
      "Its ice shell is thought to be about 15–25 km thick, floating on an ocean 60–150 km deep.",
      "With very few impact craters, its surface is among the youngest in the Solar System—likely only tens of millions of years old.",
      "ESA's JUICE mission, launched in 2023, will make two close Europa flybys in the early 2030s.",
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
    temperature: "−203 °C to −121 °C",
    orbitalSpeed: "10.9 km/s",
    mass: "1.482 × 10²³ kg (largest moon)",
    density: "1.94 g/cm³",
    escapeVelocity: "2.74 km/s",
    orbitalEccentricity: 0.0013,
    rotation: "7.15 days (tidally locked)",
    atmosphere: "Extremely thin molecular oxygen (O₂)",
    discovery: "Galileo Galilei, January 1610",

    facts: [
      "Ganymede is the largest moon in the Solar System, wider than both the planet Mercury and the dwarf planet Pluto.",
      "It is the only moon in the solar system known to possess its own internally generated dipole magnetic field and auroral belts.",
      "Beneath its icy crust lies a deep saltwater ocean, possibly layered between sheets of high-pressure ice, above a rocky mantle and iron core.",
      "Hubble observations of its shifting aurorae in 2015 provided strong evidence of a salty subsurface ocean.",
      "Ganymede is about 8% wider than Mercury but has only about 45% of Mercury's mass.",
      "ESA's JUICE spacecraft is due to enter orbit around Ganymede in 2034—the first spacecraft ever to orbit a moon other than our own.",
      "Discovered by Galileo Galilei in January 1610, it is named after the cup-bearer of the Greek gods.",
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
    temperature: "−193 °C to −108 °C",
    orbitalSpeed: "8.2 km/s",
    mass: "1.076 × 10²³ kg",
    density: "1.83 g/cm³",
    escapeVelocity: "2.44 km/s",
    orbitalEccentricity: 0.0074,
    rotation: "16.7 days (tidally locked)",
    atmosphere: "Extremely thin carbon dioxide and oxygen",
    discovery: "Galileo Galilei, January 1610",

    facts: [
      "Callisto is the most heavily cratered celestial body in the solar system, with no internal geologic activity erasing its scars.",
      "It orbits outside Jupiter's lethal radiation belts, making it the premier staging ground for future crewed exploration of Jupiter.",
      "Huge multi-ring concentric impact scars like the Valhalla basin span about 3,800 kilometers across its icy-rock crust.",
      "Because its interior never completely stratified into a dense core, Callisto is a primordial blend of equal parts rock and ice.",
      "Callisto is the third-largest moon in the Solar System, almost exactly the size of Mercury.",
      "Unlike Io, Europa and Ganymede, it is not part of their 1:2:4 orbital resonance, so it receives little tidal heating.",
      "Magnetic measurements by the Galileo spacecraft suggest a salty ocean may lie more than 100 km beneath its surface.",
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
    orbitalPeriod: "15.95 days (382.7 hours)",
    gravity: "1.352 m/s² (0.138 g)",
    temperature: "−179 °C (−290 °F)",
    orbitalSpeed: "5.57 km/s",
    mass: "1.345 × 10²³ kg",
    density: "1.88 g/cm³",
    escapeVelocity: "2.64 km/s",
    orbitalEccentricity: 0.0288,
    rotation: "15.95 days (tidally locked)",
    atmosphere: "~95% N₂, ~5% CH₄ · 1.45 bar surface pressure",
    discovery: "Christiaan Huygens, 25 March 1655",

    facts: [
      "Titan is the only moon in the solar system with a substantial atmosphere, with surface pressure 50% higher than Earth's.",
      "It is the only body besides Earth known to have stable liquid on its surface, with a methane cycle of clouds, rain, rivers, and seas.",
      "A golden photochemically produced smog of complex pre-biotic organic hydrocarbons (tholins) wraps the entire world.",
      "In January 2005, ESA's Huygens probe (carried by Cassini) landed on Titan's icy floodplain, beaming back images of smooth rounded water-ice pebbles.",
      "Titan is the second-largest moon in the Solar System and is larger than the planet Mercury.",
      "Its largest sea, Kraken Mare, covers about 400,000 km²—bigger than the Caspian Sea.",
      "Discovered by Christiaan Huygens on 25 March 1655, it was the first moon found orbiting Saturn.",
      "NASA's Dragonfly rotorcraft lander is scheduled to launch in 2028 and arrive at Titan in 2034.",
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
