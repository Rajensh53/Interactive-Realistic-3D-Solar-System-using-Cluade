import { forwardRef, useImperativeHandle, useRef } from "react";
import { OrbitControls } from "@react-three/drei";

import { SCENE } from "../../utils/planetUtils.js";
import { useCameraControls } from "../../hooks/useCameraControls.js";
import { useIdleDrift } from "../../hooks/useIdleDrift.js";

/**
 * Advanced cinematic camera controller.
 *
 * Integrates:
 * - OrbitControls with damping and vertical polar constraints
 * - GSAP-driven spherical flight transitions (useCameraControls)
 * - Moving-target orbit tracking (useCameraControls)
 * - Subtle automatic idle drift after 8s inactivity (useIdleDrift)
 */
const CameraController = forwardRef(function CameraController(props, outerRef) {
  const innerRef = useRef(null);

  useImperativeHandle(outerRef, () => innerRef.current);

  useCameraControls(innerRef);
  useIdleDrift(innerRef);

  return (
    <OrbitControls
      ref={innerRef}
      makeDefault
      enableDamping
      dampingFactor={0.05}
      rotateSpeed={0.45}
      zoomSpeed={0.8}
      panSpeed={0.6}
      enablePan
      minDistance={SCENE.MIN_CAMERA_DISTANCE}
      maxDistance={SCENE.MAX_CAMERA_DISTANCE}
      minPolarAngle={0.08}
      maxPolarAngle={Math.PI - 0.08}
      {...props}
    />
  );
});

export default CameraController;
