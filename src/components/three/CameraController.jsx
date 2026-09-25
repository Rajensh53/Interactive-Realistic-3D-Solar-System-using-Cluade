import { forwardRef, useImperativeHandle, useRef } from "react";
import { OrbitControls } from "@react-three/drei";

import { getSceneConfig } from "../../utils/planetUtils.js";
import { usePlanetStore } from "../../hooks/usePlanetStore.js";
import { useCameraAnchors, useCameraControls } from "../../hooks/useCameraControls.js";
import { useCursorZoom } from "../../hooks/useCursorZoom.js";
import { useIdleDrift } from "../../hooks/useIdleDrift.js";

/**
 * Advanced cinematic camera controller.
 *
 * Integrates:
 * - OrbitControls with damping and vertical polar constraints
 * - GSAP-driven spherical flight transitions (useCameraControls)
 * - Moving-target orbit tracking (useCameraControls)
 * - Subtle automatic idle drift after 8s inactivity (useIdleDrift)
 * - Cursor-directed zoom with dynamic focus (useCursorZoom); OrbitControls'
 *   own wheel/pinch dolly is off, it keeps rotate and pan
 *
 * Hook order matters: each registers a useFrame, and they run in call order —
 * flights/follow move the camera, then the zoom, then the sky anchors.
 */
const CameraController = forwardRef(function CameraController(props, outerRef) {
  const innerRef = useRef(null);
  const config = getSceneConfig(usePlanetStore((s) => s.settings.scaleMode));

  useImperativeHandle(outerRef, () => innerRef.current);

  useCameraControls(innerRef);
  useCursorZoom(innerRef);
  useCameraAnchors();
  useIdleDrift(innerRef);

  return (
    <OrbitControls
      ref={innerRef}
      makeDefault
      enableDamping
      dampingFactor={0.05}
      rotateSpeed={0.45}
      enableZoom={false}
      panSpeed={0.6}
      enablePan
      minDistance={config.MIN_CAMERA_DISTANCE}
      maxDistance={config.MAX_CAMERA_DISTANCE}
      minPolarAngle={0.08}
      maxPolarAngle={Math.PI - 0.08}
      {...props}
    />
  );
});

export default CameraController;
