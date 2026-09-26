/**
 * URLs for files in `public/`, honouring Vite's `base`.
 *
 * Vite rewrites asset URLs in index.html and in imports, but not plain strings
 * in code, so a hard-coded "/textures/..." 404s when the site is served from a
 * sub-path (e.g. https://user.github.io/repo/). BASE_URL is "/" by default, so
 * root deployments get exactly the same URLs as before.
 *
 * `import.meta.env` only exists under Vite; plain Node (scripts/verify-data.mjs
 * imports the data files) falls back to "/".
 */
export const BASE_URL = import.meta.env?.BASE_URL ?? "/";

/** @param {string} path path inside public/, e.g. "textures/planets" */
export function assetUrl(path) {
  return `${BASE_URL}${path.replace(/^\/+/, "")}`;
}
