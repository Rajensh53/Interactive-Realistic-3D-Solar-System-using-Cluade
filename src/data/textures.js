/**
 * Every texture the scene loads, in one place.
 *
 * Two jobs:
 *  1. Give the loader a complete list up front, so the loading screen's
 *     percentage is honest from the first frame instead of climbing to 100%
 *     and resetting each time another asset is discovered.
 *  2. Record each file's colour space. Getting this wrong is subtle and ugly —
 *     an albedo map read as linear looks washed out and pale, while a mask read
 *     as sRGB gets a gamma curve applied to data that was never a colour.
 *
 * Source: Solar System Scope (CC BY 4.0). Attribution is a licence obligation
 * and is rendered in the credits — see `scripts/fetch-textures.sh`.
 */

const PLANETS = "/textures/planets";
const ENVIRONMENT_DIR = "/textures/environment";

export const ENVIRONMENT = {
  milkyWay: `${ENVIRONMENT_DIR}/2k_stars_milky_way.jpg`,
};

/**
 * Textures sampled as data rather than as colour.
 *
 * The cloud map is used as an `alphaMap` — three.js reads its green channel as
 * an opacity mask, so an sRGB transfer curve would visibly thin the cloud
 * edges. Everything else here is an albedo or emissive map and stays sRGB.
 */
export const NON_COLOR_TEXTURES = new Set([`${PLANETS}/2k_earth_clouds.jpg`]);

/**
 * Loaded as one batch before the scene mounts. Listing them explicitly (rather
 * than walking the body data) keeps the manifest greppable and means an unused
 * file shows up as an obvious extra line rather than hiding in a derived array.
 */
export const TEXTURE_MANIFEST = [
  `${PLANETS}/2k_sun.jpg`,
  `${PLANETS}/2k_mercury.jpg`,
  `${PLANETS}/2k_venus_atmosphere.jpg`,
  `${PLANETS}/2k_earth_daymap.jpg`,
  `${PLANETS}/2k_earth_nightmap.jpg`,
  `${PLANETS}/2k_earth_clouds.jpg`,
  `${PLANETS}/2k_mars.jpg`,
  `${PLANETS}/2k_jupiter.jpg`,
  `${PLANETS}/2k_saturn.jpg`,
  `${PLANETS}/2k_saturn_ring_alpha.png`,
  `${PLANETS}/2k_uranus.jpg`,
  `${PLANETS}/2k_neptune.jpg`,
  `${PLANETS}/2k_moon.jpg`,
  ENVIRONMENT.milkyWay,
];
