import * as THREE from "three";

import { NON_COLOR_TEXTURES, TEXTURE_MANIFEST } from "../data/textures.js";

/**
 * Texture loading for the whole scene.
 *
 * WHY NOT drei's `useTexture`
 * `useTexture` rejects into the nearest error boundary when a file is missing,
 * which turns one absent JPEG into a blank page. The spec is explicit that a
 * failed texture must degrade to the body's fallback colour, so loads here
 * *never* reject: a failure resolves to `null` and is recorded for the credits
 * /diagnostics surface.
 *
 * ONE BATCH, ONE SUSPENSE POINT
 * Everything is requested up front by `preloadTextures()`, and a single
 * `useTexturesReady()` call high in the tree does the suspending. Below that
 * point `getTexture()` is a synchronous lookup, so no component waterfalls and
 * no child ever suspends on its own.
 *
 * The loader deliberately uses `THREE.DefaultLoadingManager` — that is what
 * drei's `useProgress` listens to, and it is what gives the loading screen a
 * real percentage rather than a guess.
 */

const loader = new THREE.TextureLoader();

/** url -> { status, texture, error, promise } — settled entries are stable. */
const entries = new Map();

/** Files that failed to load. Surfaced in the credits panel in Phase 11. */
const failures = new Set();

/**
 * Requested filtering quality. three.js clamps this to the hardware maximum
 * when the texture is uploaded, so a value the GPU cannot honour is safe rather
 * than an error. Phase 10 lowers it on weaker devices.
 */
let currentAnisotropy = 8;

/**
 * Updates the anisotropy filtering across all cached and future textures.
 * Used by Phase 10 performance tier adaptation.
 */
export function setAnisotropy(value) {
  currentAnisotropy = value;
  for (const entry of entries.values()) {
    if (entry.texture) {
      entry.texture.anisotropy = value;
      entry.texture.needsUpdate = true;
    }
  }
}

function configure(texture, url) {
  texture.colorSpace = NON_COLOR_TEXTURES.has(url)
    ? THREE.NoColorSpace
    : THREE.SRGBColorSpace;
  texture.anisotropy = currentAnisotropy;
  return texture;
}

function getEntry(url) {
  const existing = entries.get(url);
  if (existing) return existing;

  const entry = { url, status: "pending", texture: null, error: null };

  entry.promise = new Promise((resolve) => {
    loader.load(
      url,
      (texture) => {
        entry.texture = configure(texture, url);
        entry.status = "loaded";
        resolve(entry);
      },
      undefined,
      (error) => {
        // Resolve, never reject: the caller's job is to fall back, not to crash.
        entry.status = "error";
        entry.error = error;
        failures.add(url);
        console.warn(
          `[textures] failed to load ${url} — falling back to flat colour.`,
        );
        resolve(entry);
      },
    );
  });

  entries.set(url, entry);
  return entry;
}

/**
 * Start every load in the manifest. Safe to call more than once; already-known
 * URLs are not re-requested.
 *
 * Called at module scope so the network requests are in flight before React has
 * finished mounting, and before the first frame is drawn.
 */
export function preloadTextures(urls = TEXTURE_MANIFEST) {
  urls.forEach(getEntry);
}

/**
 * Suspend until every requested texture has settled — loaded *or* failed.
 *
 * Throwing a promise is the raw Suspense contract that `use()` and the various
 * loader hooks are built on; it is used directly here because the resolution
 * value is not what matters — `getTexture()` reads the settled cache instead.
 */
export function useTexturesReady(urls = TEXTURE_MANIFEST) {
  const pending = urls.map(getEntry).filter((e) => e.status === "pending");
  if (pending.length > 0) {
    throw Promise.all(pending.map((e) => e.promise));
  }
}

/**
 * The loaded texture for a URL, or `null` if it is absent or failed.
 *
 * Synchronous, and the returned object identity is stable for the life of the
 * page — safe as a `useMemo` dependency.
 *
 * @param {string | undefined} url
 * @returns {THREE.Texture | null}
 */
export function getTexture(url) {
  if (!url) return null;
  return entries.get(url)?.texture ?? null;
}

/** URLs that failed to load. Drives the "degraded assets" notice. */
export function getTextureFailures() {
  return [...failures];
}

/** Loader state, for diagnostics. */
export function textureStatus() {
  return [...entries.values()].map(({ url, status }) => ({ url, status }));
}
