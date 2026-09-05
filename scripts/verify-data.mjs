import {
  PLANETS,
  SUN,
  BODIES,
  EARTH,
  getAdjacentPlanetId,
  getBodyById,
} from "../src/data/planets.js";
import { MOONS, getMoonsFor } from "../src/data/moons.js";
import {
  orbitalPositionAt,
  distanceBetweenKm,
  formatDistanceKm,
  orbitTimeFromPeriod,
  AU_KM,
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
  "semiMajorAU", "orbitalPeriodYears", "facts",
];
const missing = PLANETS.flatMap((p) =>
  REQUIRED.filter((f) => p[f] === undefined).map((f) => `${p.id}.${f}`),
);
check("no missing required fields", missing.length === 0, missing.join(", "));

console.log("\n=== Content quality (no placeholders) ===");
check("every planet has 4 facts", PLANETS.every((p) => p.facts.length === 4));
check(
  "no empty/placeholder strings",
  PLANETS.every(
    (p) =>
      p.description.length > 60 &&
      !/lorem|TODO|placeholder/i.test(p.description) &&
      p.facts.every((f) => f.length > 40 && !/lorem|TODO/i.test(f)),
  ),
);
check("Sun has 4 facts + description", SUN.facts.length === 4 && SUN.description.length > 60);

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

console.log("\n=== Speed ordering (inner planets must outpace outer) ===");
const times = PLANETS.map((p) => p.orbitTimeSeconds);
check("orbit periods strictly increase outward", times.every((t, i) => i === 0 || t > times[i - 1]));
check("Earth year is exactly 45 s", Math.abs(orbitTimeFromPeriod(1) - 45) < 1e-9);

console.log("\n=== Physical distance readout ===");
for (const id of ["mercury", "mars", "jupiter", "neptune"]) {
  const p = getBodyById(id);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < 2000; i++) {
    const d = distanceBetweenKm(p, EARTH, i * 3.7);
    min = Math.min(min, d);
    max = Math.max(max, d);
  }
  // Sanity: distance can never exceed the sum of the two orbital radii.
  const ceiling = (p.semiMajorAU + EARTH.semiMajorAU) * 1.1 * AU_KM;
  const ok = Number.isFinite(min) && min > 0 && max < ceiling;
  check(
    `${p.name.padEnd(8)} distance from Earth`,
    ok,
    `${formatDistanceKm(min)} - ${formatDistanceKm(max)}`,
  );
}

console.log("\n=== Navigation ===");
check("next wraps Neptune -> Mercury", getAdjacentPlanetId("neptune", 1) === "mercury");
check("prev wraps Mercury -> Neptune", getAdjacentPlanetId("mercury", -1) === "neptune");
check("Jupiter has 4 moons", getMoonsFor("jupiter").length === 4);
check("moonless planets share one array identity", getMoonsFor("venus") === getMoonsFor("mercury"));

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}\n`);
process.exit(failures === 0 ? 0 : 1);
