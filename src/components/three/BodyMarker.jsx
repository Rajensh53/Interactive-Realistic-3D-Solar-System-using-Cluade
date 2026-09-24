import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Screen size of the marker dot, in CSS pixels. */
const MARKER_PX = 6;
/** Fully faded once the real sphere is this many pixels in radius. */
const FADE_OUT_PX = 6;
/** Fully visible while the real sphere is smaller than this. */
const FADE_IN_PX = 2;

const _worldPos = new THREE.Vector3();

/** One shared soft round sprite; PointsMaterial would otherwise draw squares. */
let dotTexture = null;
function getDotTexture() {
  if (dotTexture) return dotTexture;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.55, "rgba(255,255,255,0.9)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  dotTexture = new THREE.CanvasTexture(canvas);
  dotTexture.colorSpace = THREE.SRGBColorSpace;
  return dotTexture;
}

/**
 * A constant-pixel-size dot at a body's centre, used in true-scale mode where
 * a planet seen from across the system is far smaller than a pixel.
 *
 * It fades out as the real sphere grows past a few pixels on screen, so the
 * marker never sits on top of the rendered planet close up.
 *
 * @param {string} color  the body's fallback colour
 * @param {number} radius the body's radius in scene units
 */
function BodyMarker({ color, radius }) {
  const pointsRef = useRef(null);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0], 3));
    return geo;
  }, []);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: MARKER_PX,
        sizeAttenuation: false,
        map: getDotTexture(),
        color,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [color],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(({ camera, size }) => {
    const points = pointsRef.current;
    if (!points) return;
    points.getWorldPosition(_worldPos);
    const distance = camera.position.distanceTo(_worldPos);
    // Projected radius in pixels for a perspective camera.
    const pixelRadius =
      (radius / (distance * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))) *
      (size.height / 2);
    const opacity = 1 - THREE.MathUtils.smoothstep(pixelRadius, FADE_IN_PX, FADE_OUT_PX);
    material.opacity = opacity;
    points.visible = opacity > 0.01;
  });

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      raycast={() => null}
    />
  );
}

export default memo(BodyMarker);
