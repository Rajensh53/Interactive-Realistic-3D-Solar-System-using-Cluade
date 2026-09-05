#!/usr/bin/env bash
# Fetch the planet/environment texture set from Solar System Scope (CC BY 4.0).
#
# Attribution is a licence obligation, not a nicety — it is rendered in the
# About modal and the footer credits.
#
# Idempotent: files already present at a plausible size are skipped, so this is
# safe to re-run after a partial or interrupted download.
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE="https://www.solarsystemscope.com/textures/download"
PLANETS="$ROOT/public/textures/planets"
ENVIRONMENT="$ROOT/public/textures/environment"

mkdir -p "$PLANETS" "$ENVIRONMENT"

PLANET_FILES=(
  2k_sun.jpg
  2k_mercury.jpg
  2k_venus_atmosphere.jpg
  2k_earth_daymap.jpg
  2k_earth_nightmap.jpg
  2k_earth_clouds.jpg
  2k_mars.jpg
  2k_jupiter.jpg
  2k_saturn.jpg
  2k_saturn_ring_alpha.png
  2k_uranus.jpg
  2k_neptune.jpg
  2k_moon.jpg
)
ENV_FILES=(2k_stars_milky_way.jpg)

fetch() {
  # Assigned on separate lines: bash expands every argument to `local` before
  # the builtin runs, so a "$dir/$name" on this line would read $dir unset.
  local dir="$1"
  local name="$2"
  local dest="$dir/$name"

  # 8 kB floor: anything smaller is an error page wearing a .jpg extension.
  if [ -f "$dest" ] && [ "$(wc -c <"$dest")" -gt 8192 ]; then
    printf '  skip  %-28s (already present)\n' "$name"
    return 0
  fi

  if ! curl -fsSL --retry 3 --retry-delay 2 --max-time 180 -o "$dest" "$BASE/$name"; then
    printf '  FAIL  %-28s (download error)\n' "$name"
    rm -f "$dest"
    return 1
  fi

  # Verify by magic bytes rather than extension: a 200 response carrying an
  # HTML error body would otherwise sail through and fail much later, inside
  # the texture loader, as an unexplained black planet.
  local sig
  sig="$(od -An -N4 -tx1 <"$dest" | tr -d ' \n')"
  case "$sig" in
    ffd8ff*) ;;                 # JPEG
    89504e47) ;;                # PNG
    *)
      printf '  FAIL  %-28s (not an image: %s)\n' "$name" "$sig"
      rm -f "$dest"
      return 1
      ;;
  esac

  printf '  ok    %-28s %s\n' "$name" "$(du -h "$dest" | cut -f1)"
}

echo "Fetching textures from Solar System Scope (CC BY 4.0)..."
failed=0
for f in "${PLANET_FILES[@]}"; do fetch "$PLANETS" "$f" || failed=$((failed + 1)); done
for f in "${ENV_FILES[@]}"; do fetch "$ENVIRONMENT" "$f" || failed=$((failed + 1)); done

echo
if [ "$failed" -gt 0 ]; then
  echo "$failed file(s) failed. Re-run to retry only those."
  exit 1
fi
echo "All $(( ${#PLANET_FILES[@]} + ${#ENV_FILES[@]} )) textures present."
