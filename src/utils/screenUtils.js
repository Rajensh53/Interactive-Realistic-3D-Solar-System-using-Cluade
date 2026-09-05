import { DEG2RAD } from "./planetUtils.js";

/**
 * Conversions between scene units and screen pixels.
 *
 * Interaction needs both directions. A hit target has to be at least a dozen
 * pixels across to be hoverable, which is a question about pixels answered in
 * world units; a label has to clear the body's disc, which is a question about
 * world units answered in pixels.
 *
 * Both use screen *height*, because that is what a perspective camera's vertical
 * FOV describes, and both are exact only for a point on the view axis — off-axis
 * a perspective projection stretches slightly. At 60° that error is a couple of
 * percent at the screen edge, which is far below the precision either caller
 * needs.
 */

/** Half-angle of the vertical field of view, in radians. */
function halfFov(camera) {
  return (camera.fov * DEG2RAD) / 2;
}

/**
 * Scene units spanned by one pixel of screen height, at `distance` from the
 * camera. Multiply a pixel count by this to get a world size.
 */
export function unitsPerPixel(camera, viewportHeight, distance) {
  return (2 * Math.tan(halfFov(camera)) * distance) / viewportHeight;
}

/**
 * Pixels of screen height spanned by one scene unit, at `distance` from the
 * camera. Multiply a world size by this to get a pixel count.
 */
export function pixelsPerUnit(camera, viewportHeight, distance) {
  return viewportHeight / (2 * Math.tan(halfFov(camera)) * distance);
}
