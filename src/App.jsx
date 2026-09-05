import { Suspense, useCallback, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import PostProcessingEffects from "./components/three/PostProcessingEffects.jsx";
import * as THREE from "three";

import SolarSystem from "./components/three/SolarSystem.jsx";
import CameraController from "./components/three/CameraController.jsx";
import DevProbe from "./components/three/DevProbe.jsx";
import LoadingScreen from "./components/ui/LoadingScreen.jsx";
import WelcomeOverlay from "./components/ui/WelcomeOverlay.jsx";
import PlanetDetails from "./components/ui/PlanetDetails.jsx";
import PlanetNavigation from "./components/ui/PlanetNavigation.jsx";
import Controls from "./components/ui/Controls.jsx";
import AboutModal from "./components/ui/AboutModal.jsx";
import {
  isWebGLAvailable,
  WebGLUnavailable,
} from "./components/ui/ErrorFallback.jsx";
import { SCENE } from "./utils/planetUtils.js";
import { preloadTextures } from "./utils/textureUtils.js";
import { installDevBridge } from "./utils/devBridge.js";
import { usePlanetStore } from "./hooks/usePlanetStore.js";
import { getAdjacentPlanetId } from "./data/planets.js";

const { OVERVIEW_CAMERA } = SCENE;

// Preload textures before React mounts
preloadTextures();

// Dev-only inspection handle
if (import.meta.env.DEV) {
  installDevBridge();
}

export default function App() {
  const [assetsReady, setAssetsReady] = useState(false);

  const handleReady = useCallback(() => {
    setAssetsReady(true);
    // Transition to intro screen once assets have settled
    usePlanetStore.getState().setAppState("intro");
  }, []);

  // Global keyboard shortcuts (Esc to reset/close, Left/Right arrows to cycle planets)
  useEffect(() => {
    function handleKeyDown(e) {
      const store = usePlanetStore.getState();

      if (e.key === "Escape") {
        if (store.aboutOpen) {
          store.setAboutOpen(false);
        } else if (store.selectedPlanetId) {
          store.clearSelection();
        }
      } else if (e.key === "ArrowLeft") {
        if (store.selectedPlanetId) {
          const prevId = getAdjacentPlanetId(store.selectedPlanetId, -1);
          store.selectPlanet(prevId);
        }
      } else if (e.key === "ArrowRight") {
        if (store.selectedPlanetId) {
          const nextId = getAdjacentPlanetId(store.selectedPlanetId, 1);
          store.selectPlanet(nextId);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // WebGL support fallback check
  if (!isWebGLAvailable()) {
    return <WebGLUnavailable />;
  }

  return (
    <main className="relative h-full w-full overflow-hidden bg-space-950 select-none">
      <Canvas
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
        onPointerMissed={() => {
          usePlanetStore.getState().clearSelection();
        }}
      >
        <color attach="background" args={["#03040a"]} />

        <Suspense fallback={null}>
          <SolarSystem onReady={handleReady} />
        </Suspense>

        <CameraController />

        {import.meta.env.DEV ? <DevProbe /> : null}

        <PostProcessingEffects />
      </Canvas>

      {/* UI Overlay Layer */}
      <LoadingScreen ready={assetsReady} />
      <WelcomeOverlay />
      <Controls />
      <PlanetDetails />
      <PlanetNavigation />
      <AboutModal />
    </main>
  );
}
