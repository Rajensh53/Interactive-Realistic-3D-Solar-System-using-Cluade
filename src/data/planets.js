import {
  DEG2RAD,
  TRUE_SCALE,
  orbitTimeFromPeriod,
  semiMinorFromEccentricity,
} from "../utils/planetUtils.js";
import { getMoonById, getMoonsFor, getScaledMoon } from "./moons.js";

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
 * PROFILE FIELDS (physical, shown in the "Physical & Orbital Profile" list)
 *  mass, density, escapeVelocity, atmosphere, rings, discovery  display strings
 *  perihelionKm / aphelionKm      closest / farthest distance from the Sun
 *  orbitalInclinationDeg          tilt of the orbit to the ecliptic
 * Sources: NASA Planetary Fact Sheets (NSSDCA), NASA Science, JPL SSD.
 *
 * SCALE NOTE
 * Two layouts share these records:
 *  - Compact (the scene fields below): sizes and distances use two independent
 *    scales. At true scale the Sun is 109 Earths wide and Neptune 30× further
 *    out than Earth, so radii are eased toward the middle and orbits are spaced
 *    for legibility.
 *  - True scale (PLANETS_TRUE / SUN_TRUE, derived at the bottom of this file):
 *    radius and orbit are recomputed from `diameterKm` and `semiMajorAU` on
 *    the single TRUE_SCALE factor (1 AU = 1,000 units).
 * Everything shown as a *number* comes from the physical fields, which are
 * untouched by either layout.
 *
 * ROTATION / RETROGRADE NOTE
 * Every body spins with a positive `rotationSpeed`. Retrograde rotation is
 * encoded by axial tilt alone — Venus (177.4°) and Uranus (97.8°) are tilted
 * past vertical, so a positive spin about their own axis reads as backwards
 * from the ecliptic north. Negating the speed *as well* would cancel the tilt
 * and wrongly render them prograde.
 *
 * MOON COUNTS
 * IAU / Minor Planet Center recognised totals as listed by NASA, September
 * 2026 (Jupiter reached 115 after the March + April 2026 announcements; Saturn
 * 293). The outer planets' counts climb steadily as surveys find more small
 * irregular moons; treat them as a snapshot.
 */

const TEX = "/textures/planets";

/** IAU nominal solar radius. */
const SUN_RADIUS_KM = 695_700;

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
  axialTiltDeg: 7.25, // solar equator vs. the ecliptic
  axialTilt: 7.25 * DEG2RAD,

  // Material
  texture: `${TEX}/2k_sun.jpg`,
  fallbackColor: "#ffcf6b",

  // Physical
  diameterKm: SUN_RADIUS_KM * 2,
  distanceFromSunKm: 0,
  distanceToEarthKm: 149_600_000,
  distanceToGalacticCenter: "~26,000 light-years",
  gravity: "274.0 m/s² (27.9 g)",
  temperature: "5,500 °C surface (5,772 K) · ~15 million °C core",
  dayLength: "~25 Earth days (equator) to ~35 days (poles)",
  yearLength: "~230 million years around the galaxy",
  orbitalSpeed: "~230 km/s (galactic orbit)",
  moonCount: null,
  mass: "1.989 × 10³⁰ kg (333,000 Earths)",
  density: "1.41 g/cm³",
  escapeVelocity: "617.7 km/s",
  luminosity: "3.828 × 10²⁶ W",
  age: "~4.6 billion years",
  atmosphere: "~73% hydrogen, ~25% helium (by mass), ~2% heavier elements",

  facts: [
    "Average distance to Earth is 149.6 million km (1.00 AU / 8.3 light-minutes), varying between 147.1M km at perihelion and 152.1M km at aphelion.",
    "It accounts for 99.86% of all the mass in the Solar System — everything else, planets included, makes up just 0.14%.",
    "The core undergoes continuous thermonuclear fusion, converting roughly 600 million tonnes of hydrogen into helium every second.",
    "Energy generated in the core takes tens of thousands to over 100,000 years to reach the surface, but then travels to Earth in just 8 minutes and 20 seconds.",
      "About 1.3 million Earths could fit inside the Sun's volume, and its diameter is 109 times Earth's.",
      "The Sun is about 4.6 billion years old—roughly halfway through its ~10-billion-year life as a main-sequence star.",
      "Its outer atmosphere, the corona, reaches 1–3 million °C—hundreds of times hotter than the visible surface beneath it.",
      "Solar activity rises and falls in a roughly 11-year cycle; Solar Cycle 25 reached its maximum around late 2024.",
      "The solar wind streams outward at around 400 km/s, inflating the heliosphere—a bubble Voyager 1 crossed out of in 2012.",
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
    mass: "3.301 × 10²³ kg (0.055 Earths)",
    density: "5.43 g/cm³",
    escapeVelocity: "4.3 km/s",
    perihelionKm: 46_000_000,
    aphelionKm: 69_800_000,
    orbitalInclinationDeg: 7.0,
    atmosphere: "Near-vacuum exosphere of oxygen, sodium, hydrogen, helium, potassium",
    rings: "None",
    discovery: "Known since antiquity",
    moonCount: 0,

    facts: [
      "A single solar day on Mercury (sunrise to sunrise) lasts 176 Earth days—twice as long as its entire 88-day orbital year.",
      "Despite its proximity to the Sun, it is not the hottest planet; lacking an atmosphere, nightside temperatures drop to −180 °C.",
      "Its massive iron-rich core occupies about 85% of the planet's radius, proportionally the largest metallic core of any planet.",
      "Radar observations confirmed that deposits of water ice survive perpetually frozen in deep, permanently shadowed polar craters.",
      "It has the most eccentric orbit of any planet, swinging between 46 and 70 million km from the Sun.",
      "Its orbit slowly precesses 43 arcseconds per century more than Newton predicts—an anomaly explained by Einstein's general relativity in 1915.",
      "As its core cools, Mercury has shrunk by up to ~7 km in radius, wrinkling the crust into long cliffs called lobate scarps.",
      "Only Mariner 10 (1974–75) and MESSENGER (2011–15) have explored it closely; ESA–JAXA's BepiColombo is due to enter orbit in late 2026.",
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
    dayLength: "243 Earth days (retrograde; 117d solar day)",
    yearLength: "224.7 Earth days",
    orbitalSpeed: "35.0 km/s",
    mass: "4.867 × 10²⁴ kg (0.815 Earths)",
    density: "5.24 g/cm³",
    escapeVelocity: "10.4 km/s",
    perihelionKm: 107_500_000,
    aphelionKm: 108_900_000,
    orbitalInclinationDeg: 3.39,
    atmosphere: "96.5% CO₂, 3.5% N₂ · 92 bar surface pressure",
    rings: "None",
    discovery: "Known since antiquity",
    moonCount: 0,

    facts: [
      "Venus rotates backwards (retrograde), meaning the Sun rises in the west and sets in the east, with one day lasting longer than its year.",
      "Surface pressure reaches an immense 92 bars (9.3 MPa), the crushing equivalent of being 900 meters (3,000 feet) underwater on Earth.",
      "Its runaway greenhouse effect traps heat beneath thick carbon dioxide and sulfuric acid clouds, creating a blistering 465 °C surface.",
      "High-altitude cloud decks circle the planet every 4 Earth days (super-rotation), traveling 60 times faster than the planetary surface.",
      "After the Moon, Venus is the brightest natural object in the night sky, reaching magnitude −4.6.",
      "Its sulfuric-acid clouds reflect about 75% of incoming sunlight, making it the most reflective planet.",
      "The Soviet Venera 7 made the first soft landing on another planet in 1970; Venera 13 survived 127 minutes on the surface in 1982.",
      "Radar has mapped more than 1,600 major volcanoes, and Magellan images suggest some, such as Maat Mons, are still active.",
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
    mass: "5.972 × 10²⁴ kg",
    density: "5.51 g/cm³ (densest planet)",
    escapeVelocity: "11.2 km/s",
    perihelionKm: 147_100_000,
    aphelionKm: 152_100_000,
    orbitalInclinationDeg: 0.0,
    atmosphere: "78% N₂, 21% O₂, 0.9% Ar · 1.013 bar",
    rings: "None",
    discovery: "Our home planet",
    moonCount: 1,

    facts: [
      "Earth is the only known astronomical body in the universe confirmed to support life and sustain liquid surface water.",
      "Oceans cover roughly 70.8% of the global surface, holding over 1.3 billion cubic kilometers of liquid water.",
      "The churning liquid iron outer core generates a robust magnetic shield that protects the biosphere from dangerous solar radiation.",
      "Its day is gradually lengthening by ~1.7 milliseconds per century, mostly due to tidal friction exerted by the Moon's gravitational pull.",
      "Earth is the densest planet in the Solar System, at 5.51 g/cm³.",
      "It formed about 4.54 billion years ago, an age measured from meteorites and the oldest mineral grains.",
      "Earth is closest to the Sun in early January—seasons are caused by its 23.4° axial tilt, not by changing distance.",
      "Its atmosphere is 78% nitrogen and 21% oxygen, the oxygen produced almost entirely by photosynthetic life.",
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
    temperature: "−153 °C to 20 °C (−65 °C avg)",
    dayLength: "24.62 hours (24.66h solar day, 1 sol)",
    yearLength: "687 Earth days (1.88 Earth years)",
    orbitalSpeed: "24.1 km/s",
    mass: "6.417 × 10²³ kg (0.107 Earths)",
    density: "3.93 g/cm³",
    escapeVelocity: "5.0 km/s",
    perihelionKm: 206_600_000,
    aphelionKm: 249_200_000,
    orbitalInclinationDeg: 1.85,
    atmosphere: "95% CO₂, 2.8% N₂, 2% Ar · ~0.006 bar",
    rings: "None",
    discovery: "Known since antiquity",
    moonCount: 2,

    facts: [
      "Hosts Olympus Mons, a shield volcano towering about 22 km (13.6 miles) above its surroundings—roughly 2.5 times the height of Mount Everest.",
      "The Valles Marineris canyon system cuts across 4,000 km of the Martian equator, reaching depths of 7 km (4x deeper than the Grand Canyon).",
      "Its reddish hue is caused by widespread iron oxide (rust) pervasive throughout the soil and planetary dust storms.",
      "Mars has two small irregular moons, Phobos and Deimos; tidal forces are drawing Phobos closer until it breaks apart or crashes in ~30–50 million years.",
      "Its thin carbon-dioxide atmosphere has a surface pressure less than 1% of Earth's (about 6 millibars).",
      "The polar caps hold water ice under seasonal dry ice; melted, the south polar cap alone would cover Mars in about 11 m of water.",
      "Planet-wide dust storms can blanket Mars for months—one in 2018 ended the Opportunity rover's 15-year mission.",
      "NASA's Ingenuity helicopter made the first powered, controlled flight on another planet in April 2021 and flew 72 times.",
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
    temperature: "−110 °C (1-bar level)",
    dayLength: "9.93 hours (fastest spin)",
    yearLength: "11.86 Earth years (4,331 days)",
    orbitalSpeed: "13.1 km/s",
    mass: "1.898 × 10²⁷ kg (317.8 Earths)",
    density: "1.33 g/cm³",
    escapeVelocity: "59.5 km/s",
    perihelionKm: 740_600_000,
    aphelionKm: 816_400_000,
    orbitalInclinationDeg: 1.30,
    atmosphere: "~90% H₂, ~10% He, traces of CH₄, NH₃, H₂O",
    rings: "4 faint dust rings (halo, main, two gossamer)",
    discovery: "Known since antiquity",
    moonCount: 115,

    facts: [
      "Jupiter has 115 officially recognized moons (2026), headlined by the four giant Galilean satellites: Io, Europa, Ganymede, and Callisto.",
      "It is 2.5 times more massive than all the other planets in the Solar System combined (318 times Earth's mass).",
      "The iconic Great Red Spot is an anticyclonic storm wider than Earth that has been observed continuously since 1831—and is slowly shrinking.",
      "Its supersonic 9.9-hour rotation produces a massive equatorial bulge, visibly flattening the polar diameter by over 9,000 km.",
      "Its magnetosphere is the largest planetary structure in the Solar System—if it were visible, it would look bigger than the full Moon in our sky.",
      "Jupiter has faint rings of dust, discovered by Voyager 1 in 1979.",
      "NASA's Juno spacecraft, orbiting since July 2016, found that Jupiter's core is not compact but large and 'fuzzy', partly dissolved.",
      "Galileo's 1610 discovery of four moons orbiting Jupiter was key evidence that not everything in the sky circles Earth.",
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
    temperature: "−140 °C (1-bar level)",
    dayLength: "10.56 hours (10h 34m)",
    yearLength: "29.45 Earth years (10,759 days)",
    orbitalSpeed: "9.7 km/s",
    mass: "5.683 × 10²⁶ kg (95.2 Earths)",
    density: "0.687 g/cm³ (least dense planet)",
    escapeVelocity: "35.5 km/s",
    perihelionKm: 1_357_600_000,
    aphelionKm: 1_506_500_000,
    orbitalInclinationDeg: 2.49,
    atmosphere: "~96% H₂, ~3% He, traces of CH₄, NH₃",
    rings: "7 main rings (D, C, B, A, F, G, E) of water ice",
    discovery: "Known since antiquity",
    moonCount: 293,

    facts: [
      "Saturn leads the Solar System with 293 officially recognized moons (2026)—more than all other planets combined—including Titan, with its seas of liquid methane.",
      "Its main rings span about 280,000 km across, yet are paper-thin—typically only about 10 meters thick, and rarely more than 1 km.",
      "It is the least dense planet in the Solar System (0.687 g/cm³)—lighter than water, meaning it would float in a sufficiently large ocean.",
      "A persistent six-sided jet stream known as the Hexagon spins over its north pole, spanning about 29,000 km across—each side longer than Earth's diameter.",
      "Its rings are made of countless water-ice particles, from tiny grains to chunks as large as a house.",
      "Winds in its upper atmosphere reach about 1,800 km/h near the equator.",
      "Cassini orbited Saturn from 2004 to 2017, ending its mission by plunging into the planet on 15 September 2017.",
      "Saturn was the most distant planet known until 1781, and is the farthest planet easily seen with the naked eye.",
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
    temperature: "−195 °C (1-bar level), down to −224 °C",
    dayLength: "17.24 hours (retrograde)",
    yearLength: "84 Earth years",
    orbitalSpeed: "6.8 km/s",
    mass: "8.681 × 10²⁵ kg (14.5 Earths)",
    density: "1.27 g/cm³",
    escapeVelocity: "21.3 km/s",
    perihelionKm: 2_732_700_000,
    aphelionKm: 3_001_400_000,
    orbitalInclinationDeg: 0.77,
    atmosphere: "83% H₂, 15% He, 2.3% CH₄",
    rings: "13 known narrow, dark rings",
    discovery: "William Herschel, 13 March 1781",
    moonCount: 29,

    facts: [
      "Uranus rolls on its side with an extreme axial tilt of 97.8°, causing each pole to spend 42 continuous Earth years in sunlight followed by 42 years of darkness.",
      "It holds the record for the coldest atmospheric temperature measured in the solar system, plunging as low as −224 °C (−371 °F).",
      "It was the first planet discovered with a telescope in modern history, identified by astronomer William Herschel in 1781.",
      "Its pale cyan-aquamarine appearance is caused by atmospheric methane absorbing red light wavelengths and reflecting blue-green back into space.",
      "Its 13 faint rings were discovered in 1977, when they briefly blocked the light of a background star.",
      "Voyager 2 is the only spacecraft to have visited Uranus, flying past on 24 January 1986.",
      "Its magnetic field is tilted about 59° from its spin axis and offset from the planet's centre.",
      "Its moons are named after characters from Shakespeare and Alexander Pope—such as Titania, Oberon, Miranda and Ariel.",
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
    eccentricity: 0.0086,
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
    distanceFromSunKm: 4_498_000_000,
    gravity: "11.15 m/s² (1.14 g)",
    temperature: "−201 °C (1-bar level), down to −218 °C",
    dayLength: "16.11 hours",
    yearLength: "164.8 Earth years",
    orbitalSpeed: "5.4 km/s",
    mass: "1.024 × 10²⁶ kg (17.1 Earths)",
    density: "1.64 g/cm³ (densest giant planet)",
    escapeVelocity: "23.5 km/s",
    perihelionKm: 4_471_100_000,
    aphelionKm: 4_558_900_000,
    orbitalInclinationDeg: 1.77,
    atmosphere: "80% H₂, 19% He, 1.5% CH₄",
    rings: "5 main faint rings (Galle, Le Verrier, Lassell, Arago, Adams)",
    discovery: "Johann Galle, 23 Sept 1846 (predicted by Le Verrier)",
    moonCount: 16,

    facts: [
      "Neptune experiences the most violent supersonic winds in the Solar System, clocking speeds exceeding 2,100 km/h (1,300 mph).",
      "It was the first planet found by mathematical prediction: Urbain Le Verrier calculated its position and Johann Galle spotted it by telescope in 1846.",
      "Its largest moon Triton orbits backwards (retrograde)—likely a captured Kuiper Belt object—and Voyager 2 saw geyser plumes rising 8 km high.",
      "Despite being 4.5 billion km from the Sun, Neptune radiates 2.6 times more internal heat than it receives from sunlight.",
      "Voyager 2 is the only spacecraft to have visited Neptune, flying past on 25 August 1989.",
      "Voyager 2 imaged the Great Dark Spot, a storm about as wide as Earth; it had vanished by the time Hubble looked in 1994.",
      "Neptune completed its first full orbit since its discovery in July 2011.",
      "Its five main rings are named after astronomers linked to its discovery: Galle, Le Verrier, Lassell, Arago and Adams.",
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

/**
 * True-scale variants: the same records with scene geometry recomputed from
 * the physical fields on one scale (see TRUE_SCALE). Nothing here is
 * hand-typed, so the layout cannot drift from the real data.
 */
const KM = TRUE_SCALE.KM_TO_UNITS;

export const SUN_TRUE = { ...SUN, radius: SUN_RADIUS_KM * KM };

export const PLANETS_TRUE = PLANETS.map((p) => {
  const semiMajor = p.semiMajorAU * TRUE_SCALE.UNITS_PER_AU;
  return {
    ...p,
    radius: (p.diameterKm / 2) * KM,
    semiMajor,
    semiMinor: semiMinorFromEccentricity(semiMajor, p.eccentricity),
  };
});

const SCALED_BY_ID = {
  compact: new Map([SUN, ...PLANETS].map((b) => [b.id, b])),
  true: new Map([SUN_TRUE, ...PLANETS_TRUE].map((b) => [b.id, b])),
};

/** The Sun and planets laid out for a scale mode. */
export function getScaledPlanets(mode) {
  return mode === "true" ? PLANETS_TRUE : PLANETS;
}

export function getScaledSun(mode) {
  return mode === "true" ? SUN_TRUE : SUN;
}

/**
 * Any body (Sun, planet or moon) with the scene geometry of a scale mode.
 * Use this for anything spatial; `getBodyById` returns the canonical record.
 */
export function getScaledBody(id, mode = "compact") {
  return (SCALED_BY_ID[mode] ?? SCALED_BY_ID.compact).get(id) ?? getScaledMoon(id, mode);
}

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
