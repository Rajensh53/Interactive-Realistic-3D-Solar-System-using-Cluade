import {
  PLANETS,
  PLANETS_TRUE,
  SUN,
  SUN_TRUE,
  BODIES,
  EARTH,
  getAdjacentPlanetId,
  getBodyById,
} from "../src/data/planets.js";
import { MOONS, MOONS_TRUE, getMoonsFor } from "../src/data/moons.js";
import {
  orbitalPositionAt,
  distanceBetweenKm,
  formatDistanceKm,
  orbitTimeFromPeriod,
  AU_KM,
  SCENE,
  advanceClock,
  rotationSpeedFromPeriod,
  simulationClock,
  TRUE_SCALE,
} from "../src/utils/planetUtils.js";

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}${detail ? "  — " + detail : ""}`);
};

console.log("\n=== Structural integrity ===");
check("9 bodies (Sun + 8 planets)", BODIES.length === 9, `got ${BODIES.length}`);
check("6 moons", MOONS.length === 6, `got ${MOONS.length}`);
check("unique planet ids", new Set(PLANETS.map((p) => p.id)).size === 8);
check("every moon has a real parent", MOONS.every((m) => !!getBodyById(m.parentId)));

const REQUIRED = [
  "id", "name", "category", "description", "radius", "semiMajor", "semiMinor",
  "eccentricity", "initialAngle", "orbitTimeSeconds", "rotationSpeed", "axialTilt",
  "texture", "fallbackColor", "diameterKm", "distanceFromSunKm", "gravity",
  "temperature", "dayLength", "yearLength", "orbitalSpeed", "moonCount",
  "semiMajorAU", "orbitalPeriodYears", "facts", "mass", "density",
  "escapeVelocity", "perihelionKm", "aphelionKm", "orbitalInclinationDeg",
  "atmosphere", "rings", "discovery",
];
const missing = PLANETS.flatMap((p) =>
  REQUIRED.filter((f) => p[f] === undefined).map((f) => `${p.id}.${f}`),
);
check("no missing required fields", missing.length === 0, missing.join(", "));

console.log("\n=== Content quality (no placeholders) ===");
check("every planet has 8 facts", PLANETS.every((p) => p.facts.length === 8));
check("every moon has at least 7 facts", MOONS.every((m) => m.facts.length >= 7));
const MOON_REQUIRED = ["mass", "density", "escapeVelocity", "orbitalEccentricity", "rotation", "atmosphere", "discovery"];
const moonMissing = MOONS.flatMap((m) => MOON_REQUIRED.filter((f) => m[f] === undefined).map((f) => `${m.id}.${f}`));
check("no missing moon profile fields", moonMissing.length === 0, moonMissing.join(", "));
// Perihelion / aphelion must agree with a(1-e) and a(1+e) to within 1.5%.
const apsisOff = PLANETS.filter((p) => {
  const a = p.semiMajorAU * AU_KM;
  return Math.abs(p.perihelionKm / (a * (1 - p.eccentricity)) - 1) > 0.015 ||
    Math.abs(p.aphelionKm / (a * (1 + p.eccentricity)) - 1) > 0.015;
});
check("perihelion/aphelion consistent with a and e", apsisOff.length === 0, apsisOff.map((p) => p.id).join(", "));
check(
  "no empty/placeholder strings",
  PLANETS.every(
    (p) =>
      p.description.length > 60 &&
      !/lorem|TODO|placeholder/i.test(p.description) &&
      p.facts.every((f) => f.length > 40 && !/lorem|TODO/i.test(f)),
  ),
);
check("Sun has 9 facts + description", SUN.facts.length === 9 && SUN.description.length > 60);

console.log("\n=== Derived values are finite ===");
const bad = PLANETS.filter(
  (p) => ![p.semiMinor, p.orbitTimeSeconds, p.initialAngle, p.axialTilt].every(Number.isFinite),
);
check("no NaN in derived fields", bad.length === 0, bad.map((p) => p.id).join(", "));

console.log("\n=== Orbital mechanics ===");
const pos = { x: 0, y: 0, z: 0 };
// Sample each orbit at many points: verify the Sun sits at a focus, i.e. the
// distance oscillates between a(1-e) and a(1+e) — not a constant circle.
for (const p of PLANETS) {
  let min = Infinity;
  let max = -Infinity;
  let nan = false;
  for (let i = 0; i < 400; i++) {
    orbitalPositionAt(p, (i / 400) * p.orbitTimeSeconds, pos);
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.z)) nan = true;
    const r = Math.hypot(pos.x, pos.z);
    min = Math.min(min, r);
    max = Math.max(max, r);
  }
  const expMin = p.semiMajor * (1 - p.eccentricity);
  const expMax = p.semiMajor * (1 + p.eccentricity);
  const ok = !nan && Math.abs(min - expMin) < 0.02 && Math.abs(max - expMax) < 0.02;
  check(
    `${p.name.padEnd(8)} perihelion/aphelion`,
    ok,
    `${min.toFixed(2)}-${max.toFixed(2)} u (expected ${expMin.toFixed(2)}-${expMax.toFixed(2)})`,
  );
}

// Direction: check the sign of the vertical angular-momentum component
// L_y = z·vx − x·vz across the whole orbit. It must be positive everywhere —
// positive means counter-clockwise seen from the north ecliptic pole, matching
// the sense of `mesh.rotation.y += speed`. Checking every sample also proves
// the body never reverses direction.
const pA = { x: 0, y: 0, z: 0 };
const pB = { x: 0, y: 0, z: 0 };
let directionOk = true;
for (const p of PLANETS) {
  for (let i = 0; i < 200; i++) {
    const t = (i / 200) * p.orbitTimeSeconds;
    const dt = p.orbitTimeSeconds / 5000;
    orbitalPositionAt(p, t, pA);
    orbitalPositionAt(p, t + dt, pB);
    const vx = (pB.x - pA.x) / dt;
    const vz = (pB.z - pA.z) / dt;
    if (pA.z * vx - pA.x * vz <= 0) directionOk = false;
  }
}
check("all orbits prograde, never reversing (L_y > 0)", directionOk);

console.log("\n=== Retrograde encoding ===");
check("all spins positive (tilt encodes retrograde)", PLANETS.every((p) => p.rotationSpeed > 0));
check("Venus tilted past vertical", getBodyById("venus").axialTiltDeg > 90);
check("Uranus tilted past vertical", getBodyById("uranus").axialTiltDeg > 90);

console.log("\n=== Rotation (real sidereal periods) ===");
check(
  "spin derived from rotationPeriodHours",
  [SUN, ...PLANETS].every(
    (b) => b.rotationPeriodHours > 0 && b.rotationSpeed === rotationSpeedFromPeriod(b.rotationPeriodHours),
  ),
);
const earthBody = getBodyById("earth");
check(
  "Earth turns once per EARTH_DAY_SECONDS at 1x",
  Math.abs((2 * Math.PI) / earthBody.rotationSpeed - SCENE.EARTH_DAY_SECONDS) < 1e-9,
  `${((2 * Math.PI) / earthBody.rotationSpeed).toFixed(3)} s`,
);
const SPIN_ORDER = ["jupiter", "saturn", "neptune", "uranus", "earth", "mars", "sun", "mercury", "venus"];
const spins = SPIN_ORDER.map((id) => getBodyById(id).rotationSpeed);
check(
  "spin ordering Jupiter > Saturn > Neptune > Uranus > Earth > Mars > Sun > Mercury > Venus",
  spins.every((v, i) => i === 0 || v < spins[i - 1]),
);
check("Mars spins slower than Earth", getBodyById("mars").rotationSpeed < earthBody.rotationSpeed);
check("moons carry no spin rate (tidally locked)", MOONS.every((m) => m.rotationSpeed === undefined));

console.log("\n=== Simulation clocks ===");
const saved = { ...simulationClock };
Object.assign(simulationClock, { time: 0, spinTime: 0, orbitScale: 5, spinScale: 0.5, paused: false });
advanceClock(1);
check(
  "orbit 5x / spin 0.5x advance independently",
  simulationClock.time === 5 && simulationClock.spinTime === 0.5,
  `time ${simulationClock.time}, spinTime ${simulationClock.spinTime}`,
);
simulationClock.paused = true;
advanceClock(1);
check("paused clocks do not move", simulationClock.time === 5 && simulationClock.spinTime === 0.5);
Object.assign(simulationClock, saved);

console.log("\n=== Speed ordering (inner planets must outpace outer) ===");
const times = PLANETS.map((p) => p.orbitTimeSeconds);
check("orbit periods strictly increase outward", times.every((t, i) => i === 0 || t > times[i - 1]));
check("Earth year is exactly 45 s", Math.abs(orbitTimeFromPeriod(1) - 45) < 1e-9);

console.log("\n=== Physical distance readout ===");
for (const id of ["sun", "mercury", "mars", "jupiter", "neptune"]) {
  const p = getBodyById(id);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < 2000; i++) {
    const d = distanceBetweenKm(p, EARTH, i * 3.7);
    min = Math.min(min, d);
    max = Math.max(max, d);
  }
  // Sanity: distance can never exceed the sum of the two orbital radii (or Earth AU for Sun).
  const radiusAU = p.semiMajorAU ?? 0;
  const ceiling = (radiusAU + EARTH.semiMajorAU) * 1.1 * AU_KM;
  const ok = Number.isFinite(min) && min > 0 && max <= ceiling;
  check(
    `${p.name.padEnd(8)} distance from Earth`,
    ok,
    `${formatDistanceKm(min)} - ${formatDistanceKm(max)}`,
  );
}

console.log("\n=== True scale layout ===");
const near = (a, b) => Math.abs(a - b) <= Math.abs(b) * 1e-9;
const KM = TRUE_SCALE.KM_TO_UNITS;
check(
  "orbits at 1,000 u per AU",
  PLANETS_TRUE.every((p) => near(p.semiMajor, p.semiMajorAU * 1000)),
);
check(
  "planet radii = diameterKm/2 on the same scale",
  PLANETS_TRUE.every((p) => near(p.radius, (p.diameterKm / 2) * KM)),
);
check("Sun radius 695,700 km (4.65 u)", near(SUN_TRUE.radius, 695_700 * KM), SUN_TRUE.radius.toFixed(3));
check(
  "moon radii and orbits from real km",
  MOONS_TRUE.every(
    (m) => near(m.radius, (m.diameterKm / 2) * KM) && near(m.orbitRadius, m.distanceFromParentKm * KM),
  ),
);
const parentRadius = (m) => PLANETS_TRUE.find((p) => p.id === m.parentId).radius;
check(
  "every moon orbits outside its planet",
  MOONS_TRUE.every((m) => m.orbitRadius > parentRadius(m)),
  MOONS_TRUE.map((m) => `${m.id} ${(m.orbitRadius / parentRadius(m)).toFixed(1)}R`).join(", "),
);
const mercuryTrue = PLANETS_TRUE[0];
const mercuryPeri = mercuryTrue.semiMajor * (1 - mercuryTrue.eccentricity);
check(
  "Mercury perihelion clear of the Sun",
  mercuryPeri > SUN_TRUE.radius * 10,
  `${mercuryPeri.toFixed(0)} u vs Sun ${SUN_TRUE.radius.toFixed(2)} u`,
);
for (const p of PLANETS_TRUE) {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < 400; i++) {
    orbitalPositionAt(p, (i / 400) * p.orbitTimeSeconds, pos);
    const r = Math.hypot(pos.x, pos.z);
    min = Math.min(min, r);
    max = Math.max(max, r);
  }
  const expMin = p.semiMajor * (1 - p.eccentricity);
  const expMax = p.semiMajor * (1 + p.eccentricity);
  check(
    `${p.name.padEnd(8)} true-scale perihelion/aphelion`,
    Math.abs(min / expMin - 1) < 1e-3 && Math.abs(max / expMax - 1) < 1e-3,
    `${min.toFixed(0)}-${max.toFixed(0)} u`,
  );
}
check(
  "compact and true layouts share timing",
  PLANETS_TRUE.every((p, i) => p.orbitTimeSeconds === PLANETS[i].orbitTimeSeconds),
);

console.log("\n=== Navigation ===");
check("next wraps Neptune -> Mercury", getAdjacentPlanetId("neptune", 1) === "mercury");
check("prev wraps Mercury -> Neptune", getAdjacentPlanetId("mercury", -1) === "neptune");
check("Jupiter has 4 moons", getMoonsFor("jupiter").length === 4);
check("moonless planets share one array identity", getMoonsFor("venus") === getMoonsFor("mercury"));

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}\n`);
process.exit(failures === 0 ? 0 : 1);
