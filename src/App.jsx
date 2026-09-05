import { Suspense, useCallback, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

import SolarSystem from "./components/three/SolarSystem.jsx";
import CameraController from "./components/three/CameraController.jsx";
import DevProbe from "./components/three/DevProbe.jsx";
import LoadingScreen from "./components/ui/LoadingScreen.jsx";
import {
  isWebGLAvailable,
  WebGLUnavailable,
} from "./components/ui/ErrorFallback.jsx";
import { SCENE } from "./utils/planetUtils.js";
import { preloadTextures } from "./utils/textureUtils.js";
import { installDevBridge } from "./utils/devBridge.js";

const { OVERVIEW_CAMERA } = SCENE;

// Kick the texture requests off at module scope — before React mounts, before
// the Canvas exists, before the first frame. The network is idle at this point
// and it is the cheapest few hundred milliseconds available.
preloadTextures();

// Dev-only inspection handle. The guard is statically analysable, so the
// bridge is tree-shaken out of production builds entirely.
if (import.meta.env.DEV) {
  installDevBridge();
}

export default function App() {
  const [assetsReady, setAssetsReady] = useState(false);
  const handleReady = useCallback(() => setAssetsReady(true), []);

  // WebGL support cannot change mid-session, so a plain check is enough.
  if (!isWebGLAvailable()) {
    return <WebGLUnavailable />;
  }

  return (
    <main className="relative h-full w-full overflow-hidden bg-space-950">
      <Canvas
        // Cap device pixel ratio at 2 — beyond that the cost is real and the
        // difference is not. Phase 10 makes this adaptive.
        dpr={[1, 2]}
        camera={{
          position: [OVERVIEW_CAMERA.x, OVERVIEW_CAMERA.y, OVERVIEW_CAMERA.z],
          fov: 60,
          near: 0.1,
          far: 1400,
        }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
      >
        <color attach="background" args={["#03040a"]} />

        {/* `fallback={null}` rather than a 3D placeholder: the DOM loading
            screen above already owns the waiting state. */}
        <Suspense fallback={null}>
          <SolarSystem onReady={handleReady} />
        </Suspense>

        <CameraController />

        {import.meta.env.DEV ? <DevProbe /> : null}

        {/* luminanceThreshold of 1 means only the Sun — pushed deliberately
            above 1.0 in Sun.jsx — blooms. Planets stay crisp. */}
        <EffectComposer>
          <Bloom
            intensity={0.9}
            luminanceThreshold={1}
            luminanceSmoothing={0.3}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>

      <LoadingScreen ready={assetsReady} />
    </main>
  );
}
