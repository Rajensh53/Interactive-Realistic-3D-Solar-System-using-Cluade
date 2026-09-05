import { useEffect, useRef } from "react";
import { usePlanetStore } from "./usePlanetStore.js";

const IDLE_TIMEOUT_MS = 8000;
const AUTO_ROTATE_SPEED = 0.12;

/**
 * Manages subtle cinematic idle camera rotation.
 *
 * Requirements:
 * - Engages after 8s of no user pointer/keyboard activity.
 * - Active ONLY in 'idle' overview mode (never while traveling or focused on a body).
 * - Extremely subtle speed (0.12).
 * - Disengages immediately upon any interaction.
 * - Respects prefers-reduced-motion and settings.idleDrift.
 *
 * @param {React.RefObject<import('three-stdlib').OrbitControls>} controlsRef
 */
export function useIdleDrift(controlsRef) {
  const timerRef = useRef(null);

  useEffect(() => {
    // Check OS reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    function stopDrift() {
      const controls = controlsRef.current;
      if (controls && controls.autoRotate) {
        controls.autoRotate = false;
      }
    }

    function resetTimer() {
      stopDrift();
      if (timerRef.current) clearTimeout(timerRef.current);

      if (prefersReducedMotion) return;

      timerRef.current = setTimeout(() => {
        const store = usePlanetStore.getState();
        const controls = controlsRef.current;
        if (
          store.cameraPhase === "idle" &&
          store.settings.idleDrift &&
          controls
        ) {
          controls.autoRotate = true;
          controls.autoRotateSpeed = AUTO_ROTATE_SPEED;
        }
      }, IDLE_TIMEOUT_MS);
    }

    // Attach interaction listeners
    const events = [
      "pointermove",
      "pointerdown",
      "wheel",
      "keydown",
      "touchstart",
    ];
    events.forEach((ev) =>
      window.addEventListener(ev, resetTimer, { passive: true }),
    );

    // Initial timer kick
    resetTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
      stopDrift();
    };
  }, [controlsRef]);
}
