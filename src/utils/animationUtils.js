import * as THREE from "three";

import { TRUE_SCALE } from "./planetUtils.js";

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
 * Distances are proportional to the body's radius, so the same rules frame a
 * body in either scale mode. In compact mode they reproduce the original
 * hand-tuned values (Sun 18 / 10 / 75, Saturn 16.5 / 10.5 / 70). The absolute
 * floors only make sense in compact units, so true scale drops them and lets
 * the user zoom all the way back out while following.
 *
 * @param {object} body - Body laid out for the active scale mode (getScaledBody)
 * @param {THREE.Vector3} bodyWorldPos - Current world position of the body
 * @param {THREE.Vector3} currentCamPos - Current world position of the camera
 * @param {boolean} [trueScale]
 * @returns {{ arrivalDistance: number, viewOffset: THREE.Vector3, minDistance: number, maxDistance: number }}
 */
export function getBodyFraming(body, bodyWorldPos, currentCamPos, trueScale = false) {
  let arrivalDistance;
  let minDistance;
  let maxDistance;

  if (body.id === "sun") {
    arrivalDistance = body.radius * 3.6;
    minDistance = body.radius * 2.0;
    maxDistance = body.radius * 15.0;
  } else if (body.ringOuter) {
    // Frame the whole ring system, not just the globe.
    const ringExtent = body.radius * body.ringOuter;
    arrivalDistance = ringExtent * 2.34;
    minDistance = ringExtent * 1.49;
    maxDistance = ringExtent * 9.93;
  } else {
    arrivalDistance = body.radius * 4.2;
    minDistance = body.radius * 2.2;
    maxDistance = body.radius * 18.0;
  }

  if (trueScale) {
    maxDistance = TRUE_SCALE.MAX_CAMERA_DISTANCE;
  } else if (body.id !== "sun" && !body.ringOuter) {
    arrivalDistance = Math.max(arrivalDistance, 2.2);
    minDistance = Math.max(minDistance, 1.4);
    maxDistance = Math.max(maxDistance, 45.0);
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
 * @param {boolean} [trueScale] - true-scale flights span 0.1 u to 30,000 u, so
 *   duration grows with log distance instead (clamped 1.2s to 3.5s)
 * @returns {number} Duration in seconds (clamped between 1.2s and 2.8s)
 */
export function getTravelDuration(distance, trueScale = false) {
  if (trueScale) {
    return Math.min(Math.max(1.2 + 0.24 * Math.log1p(distance), 1.2), 3.5);
  }
  return Math.min(Math.max(0.9 + distance / 42, 1.2), 2.8);
}
