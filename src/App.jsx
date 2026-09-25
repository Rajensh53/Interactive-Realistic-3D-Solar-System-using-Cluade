import { Suspense, useCallback, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr } from "@react-three/drei";
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
  SceneErrorBoundary,
  ContextLostNotice,
} from "./components/ui/ErrorFallback.jsx";
import { SCENE } from "./utils/planetUtils.js";
import { preloadTextures } from "./utils/textureUtils.js";
import { installDevBridge } from "./utils/devBridge.js";
import { usePlanetStore } from "./hooks/usePlanetStore.js";
import { useAudioEngine } from "./hooks/useAudioEngine.js";
import { QualityMonitor } from "./hooks/useQualityTier.js";
import { getAdjacentPlanetId } from "./data/planets.js";

const { OVERVIEW_CAMERA } = SCENE;

// Preload textures before React mounts
preloadTextures();

// Dev-only inspection handle
if (import.meta.env.DEV) {
  installDevBridge();
}

export default function App() {
  // Initialize procedural ambient space audio engine
  useAudioEngine();

  const [assetsReady, setAssetsReady] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  // GPU resets (driver update, OS sleep, too many 3D tabs) drop the WebGL
  // context. three.js restores everything if the browser gives it back; until
  // then the canvas is black, so say what happened instead of showing a void.
  const handleCreated = useCallback(({ gl }) => {
    const canvas = gl.domElement;
    canvas.addEventListener("webglcontextlost", () => setContextLost(true));
    canvas.addEventListener("webglcontextrestored", () => setContextLost(false));
  }, []);

  const handleReady = useCallback(() => {
    setAssetsReady(true);
    // Transition to intro screen only if still loading
    const current = usePlanetStore.getState().appState;
    if (current === "loading") {
      usePlanetStore.getState().setAppState("intro");
    }
  }, []);

  // Global keyboard shortcuts: Esc resets/closes, Left/Right cycle planets,
  // Space pauses, [ and ] halve / double the orbit speed.
  useEffect(() => {
    function handleKeyDown(e) {
      const store = usePlanetStore.getState();

      // Leave keys alone while a control has focus: Space presses a focused
      // button, and arrows move a focused slider.
      const tag = e.target?.tagName;
      const inControl =
        tag === "INPUT" || tag === "BUTTON" || tag === "SELECT" || tag === "TEXTAREA" ||
        e.target?.isContentEditable;

      if (e.key === " " && !inControl) {
        if (store.appState !== "exploring") return;
        e.preventDefault();
        store.togglePaused();
        return;
      }
      if ((e.key === "[" || e.key === "]") && !inControl) {
        if (store.appState !== "exploring") return;
        const factor = e.key === "]" ? 2 : 0.5;
        store.setOrbitSpeed(store.simulation.orbitSpeed * factor);
        return;
      }
      // Arrows belong to a focused slider or field; a focused button (e.g. the
      // planet rail after a click) still lets them cycle planets.
      const inField = tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
      if (inField && e.key !== "Escape") return;

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
      <SceneErrorBoundary>
        <Canvas
          onCreated={handleCreated}
          dpr={[1, 2]}
          camera={{
            position: [OVERVIEW_CAMERA.x, OVERVIEW_CAMERA.y, OVERVIEW_CAMERA.z],
            fov: 60,
            near: SCENE.NEAR,
            far: SCENE.FAR,
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

          <AdaptiveDpr pixelated={false} />
          <QualityMonitor />

          <Suspense fallback={null}>
            <SolarSystem onReady={handleReady} />
          </Suspense>

          <CameraController />

          {import.meta.env.DEV ? <DevProbe /> : null}

          <PostProcessingEffects />
        </Canvas>
      </SceneErrorBoundary>

      {contextLost ? <ContextLostNotice /> : null}

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
