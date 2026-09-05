import * as THREE from "three";

/**
 * Camera framing and animation utilities for cinematic transitions.
 */

const _toSun = new THREE.Vector3();
const _approach = new THREE.Vector3();
const _viewDir = new THREE.Vector3();
const _origin = new THREE.Vector3(0, 0, 0);

/**
 * Calculates the ideal camera distance and offset direction for focusing a body.
 *
 * @param {object} body - Body definition from planets.js
 * @param {THREE.Vector3} bodyWorldPos - Current world position of the body
 * @param {THREE.Vector3} currentCamPos - Current world position of the camera
 * @returns {{ arrivalDistance: number, viewOffset: THREE.Vector3, minDistance: number, maxDistance: number }}
 */
export function getBodyFraming(body, bodyWorldPos, currentCamPos) {
  let arrivalDistance;
  let minDistance;
  let maxDistance;

  if (body.id === "sun") {
    arrivalDistance = 18.0;
    minDistance = 10.0;
    maxDistance = 75.0;
  } else if (body.id === "saturn") {
    // Frame Saturn's rings (ringOuter is ~7.8 u)
    arrivalDistance = 16.5;
    minDistance = 10.5;
    maxDistance = 70.0;
  } else {
    arrivalDistance = Math.max(body.radius * 4.2, 2.2);
    minDistance = Math.max(body.radius * 2.2, 1.4);
    maxDistance = Math.max(body.radius * 18.0, 45.0);
  }

  // Calculate arrival angle:
  // Blend current approach direction with a 45-degree angle toward the Sun
  // so the planet is illuminated with a cinematic crescent/gibbous terminator.
  if (body.id === "sun") {
    // For the Sun, maintain current viewing angle, slightly elevated
    _approach.subVectors(currentCamPos, bodyWorldPos);
    if (_approach.lengthSq() < 0.01) _approach.set(0, 1, 2);
    _viewDir.copy(_approach).normalize();
    _viewDir.y = Math.max(_viewDir.y, 0.35);
    _viewDir.normalize();
  } else {
    // Vector toward the Sun from planet
    _toSun.subVectors(_origin, bodyWorldPos).normalize();

    // Direction from planet to current camera
    _approach.subVectors(currentCamPos, bodyWorldPos).normalize();

    // Blend: 60% approach dir + 40% sun direction, tilted slightly above the ecliptic
    _viewDir.copy(_approach).multiplyScalar(0.6).addScaledVector(_toSun, 0.4);
    _viewDir.y = Math.max(_viewDir.y, 0.3); // viewing slightly from above
    _viewDir.normalize();
  }

  const viewOffset = _viewDir.clone().multiplyScalar(arrivalDistance);

  return {
    arrivalDistance,
    viewOffset,
    minDistance,
    maxDistance,
  };
}

/**
 * Calculates GSAP travel duration based on distance.
 * Eased curve ensuring neither too fast (jumpy) nor too slow (boring).
 *
 * @param {number} distance - Distance in scene units
 * @returns {number} Duration in seconds (clamped between 1.2s and 2.8s)
 */
export function getTravelDuration(distance) {
  return Math.min(Math.max(0.9 + distance / 42, 1.2), 2.8);
}
