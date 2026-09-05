import { forwardRef } from "react";
import { OrbitControls } from "@react-three/drei";

import { SCENE } from "../../utils/planetUtils.js";

/**
 * Orbit / zoom / pan controls for the overview.
 *
 * The ref is forwarded because Phase 5's cinematic camera needs to drive the
 * control target directly and disable input mid-flight.
 *
 * Distance limits keep the user from either clipping into the Sun or drifting
 * so far out that the Solar System becomes a dot they cannot find again.
 */
const CameraController = forwardRef(function CameraController(props, ref) {
  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enableDamping
      dampingFactor={0.05}
      rotateSpeed={0.45}
      zoomSpeed={0.8}
      panSpeed={0.6}
      enablePan
      minDistance={SCENE.MIN_CAMERA_DISTANCE}
      maxDistance={SCENE.MAX_CAMERA_DISTANCE}
      // Stop just short of the poles: passing straight over gimbals the view
      // and reads as a glitch.
      minPolarAngle={0.08}
      maxPolarAngle={Math.PI - 0.08}
      {...props}
    />
  );
});

export default CameraController;
