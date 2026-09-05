/**
 * Simulation math and the live body registry.
 *
 * This module is intentionally dependency-free (it imports nothing from
 * `data/`) so that `data/planets.js` can import the helpers below without
 * creating a circular import.
 *
 * Two ideas drive everything here:
 *
 *  1. **Positions are a pure function of scene time.** A body's location is
 *     `f(body, sceneTime)` — never accumulated frame-to-frame. That means no
 *     floating-point drift, and the camera can ask "where is Mars *right now*"
 *     mid-flight and get an exact answer (see useCameraControls).
 *
 *  2. **Scene scale is not physical scale.** Distances are compressed so the
 *     whole system composes on screen. Real astronomical values are kept
 *     separately (`semiMajorAU`) and used for anything shown as a number.
 */

export const TWO_PI = Math.PI * 2;
export const DEG2RAD = Math.PI / 180;

/** One astronomical unit, in kilometres (IAU definition). */
export const AU_KM = 149_597_870.7;

export const SCENE = {
  /** Real seconds for Earth to complete one orbit in the simulation. */
  EARTH_YEAR_SECONDS: 45,
  /**
   * Orbital periods are compressed by `period ** EXPONENT` rather than used
   * literally. At 1.0 (true Kepler) a Neptune orbit would take over two hours
   * to watch; at 0.7 it takes ~27 minutes while preserving the speed *ordering*
   * that makes the inner planets visibly race the outer ones.
   */
  PERIOD_EXPONENT: 0.7,
  /** Scene units from the Sun to Earth's orbit. */
  EARTH_ORBIT_UNITS: 25,
  /** Camera home position for the full-system overview. */
  OVERVIEW_CAMERA: { x: 0, y: 32, z: 105 },
  /** Closest the user may orbit to the current target. */
  MIN_CAMERA_DISTANCE: 8,
  /** Far enough to frame Neptune's orbit (92 u) with headroom, no further. */
  MAX_CAMERA_DISTANCE: 260,
};

/**
 * Compress a real orbital period (in Earth years) into simulation seconds.
 * @param {number} periodYears
 * @returns {number} seconds for one full orbit
 */
export function orbitTimeFromPeriod(periodYears) {
  return SCENE.EARTH_YEAR_SECONDS * periodYears ** SCENE.PERIOD_EXPONENT;
}

/**
 * Semi-minor axis of an ellipse: b = a·√(1 − e²).
 * @param {number} semiMajor
 * @param {number} eccentricity
 */
export function semiMinorFromEccentricity(semiMajor, eccentricity) {
  return semiMajor * Math.sqrt(1 - eccentricity * eccentricity);
}

/**
 * A body's orbital angle at a given scene time.
 * @param {{initialAngle: number, orbitTimeSeconds: number}} body
 * @param {number} sceneTime seconds since the simulation started
 */
export function orbitAngleAt(body, sceneTime) {
  return body.initialAngle + (TWO_PI * sceneTime) / body.orbitTimeSeconds;
}

/**
 * Write a body's scene-space orbital position into `out`.
 *
 * The ellipse is offset by `a·e` along +X so the Sun sits at a true focus
 * rather than at the centre — at angle 0 the body is at aphelion `a(1+e)`,
 * at angle π it is at perihelion `a(1−e)`.
 *
 * `z` is negated so bodies travel counter-clockwise seen from the north
 * ecliptic pole, matching both the real Solar System and the sign convention
 * of `mesh.rotation.y += speed` used for axial spin.
 *
 * SIMPLIFICATION: the angle advances at a constant rate, so bodies do not
 * speed up at perihelion the way Kepler's second law requires. The orbit's
 * *shape* is a true ellipse with the Sun at a focus; only the timing around it
 * is uniform. Solving Kepler's equation each frame would buy a subtlety no
 * viewer can see, at real cost in the hot path.
 *
 * Mutates and returns `out` — this runs every frame for every body, so it must
 * not allocate.
 *
 * @param {object} body
 * @param {number} sceneTime
 * @param {{x: number, y: number, z: number}} out
 */
export function orbitalPositionAt(body, sceneTime, out) {
  const angle = orbitAngleAt(body, sceneTime);
  out.x = body.semiMajor * (Math.cos(angle) + body.eccentricity);
  out.y = 0;
  out.z = -body.semiMinor * Math.sin(angle);
  return out;
}

/**
 * The same orbit evaluated at true astronomical scale, in AU.
 *
 * Used for the numbers shown in the details panel. The *angles* come from the
 * simulation (so the readout always agrees with what is on screen) but the
 * *radii* are real, so the resulting distances are physically meaningful.
 * This is a simulated configuration, not live ephemeris data.
 */
export function realPositionAt(body, sceneTime, out) {
  const angle = orbitAngleAt(body, sceneTime);
  const b = semiMinorFromEccentricity(body.semiMajorAU, body.eccentricity);
  out.x = body.semiMajorAU * (Math.cos(angle) + body.eccentricity);
  out.y = 0;
  out.z = -b * Math.sin(angle);
  return out;
}

// Scratch vectors, module-scoped so the distance helper never allocates.
const _a = { x: 0, y: 0, z: 0 };
const _b = { x: 0, y: 0, z: 0 };

/**
 * Distance between two bodies at true scale, in kilometres.
 * @returns {number} km
 */
export function distanceBetweenKm(bodyA, bodyB, sceneTime) {
  realPositionAt(bodyA, sceneTime, _a);
  realPositionAt(bodyB, sceneTime, _b);
  const dx = _a.x - _b.x;
  const dz = _a.z - _b.z;
  return Math.sqrt(dx * dx + dz * dz) * AU_KM;
}

/**
 * Human-readable distance: "227.9 million km", "4.50 billion km".
 * @param {number} km
 */
export function formatDistanceKm(km) {
  if (!Number.isFinite(km)) return "—";
  if (km >= 1e9) return `${(km / 1e9).toFixed(2)} billion km`;
  if (km >= 1e6) return `${(km / 1e6).toFixed(1)} million km`;
  if (km >= 1e3) return `${Math.round(km / 1e3).toLocaleString("en-US")} thousand km`;
  return `${Math.round(km).toLocaleString("en-US")} km`;
}

/* ---------------------------------------------------------------------------
   Simulation clock
   ---------------------------------------------------------------------------
   A deliberately mutable module singleton. Every body, the camera controller
   and the details-panel readout need the current scene time each frame; a
   React state value would re-render the whole tree 60 times a second, and
   threading a ref through the component tree would still leave the camera
   controller (which lives outside <SolarSystem>) without access.

   <SolarSystem> is the only writer, advancing it once per frame at
   useFrame priority -1 so every reader sees the current value, not last
   frame's. The maths above stays pure — the clock only holds the value.
   --------------------------------------------------------------------------- */

export const simulationClock = {
  /** Seconds of simulated time since the scene mounted. */
  time: 0,
  /** Multiplier on real time. 0 pauses the system without stopping rendering. */
  timeScale: 1,
};

/**
 * Advance the clock by a real-time delta. Called once per frame.
 * @param {number} delta seconds since the previous frame
 * @returns {number} the new scene time
 */
export function advanceClock(delta) {
  simulationClock.time += delta * simulationClock.timeScale;
  return simulationClock.time;
}

/* ---------------------------------------------------------------------------
   Body registry
   ---------------------------------------------------------------------------
   Live Object3D handles, kept outside React state for the same reason: the
   camera controller and label system need per-frame access to real world
   positions.

   Components register on mount and unregister on unmount.
   --------------------------------------------------------------------------- */

/** @type {Map<string, {id: string, radius: number, object3D: object}>} */
export const bodyRegistry = new Map();

export function registerBody(id, object3D, radius) {
  bodyRegistry.set(id, { id, object3D, radius });
}

export function unregisterBody(id) {
  bodyRegistry.delete(id);
}

export function getBody(id) {
  return bodyRegistry.get(id);
}

/**
 * Write a registered body's world position into a THREE.Vector3-like target.
 * @returns {boolean} false if the body is not currently mounted
 */
export function getBodyWorldPosition(id, target) {
  const entry = bodyRegistry.get(id);
  if (!entry?.object3D) return false;
  entry.object3D.getWorldPosition(target);
  return true;
}
