import { memo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { usePlanetStore } from "../../hooks/usePlanetStore.js";

/**
 * Opening cinematic welcome card.
 *
 * Spec §26:
 * Displays "EXPLORE THE SOLAR SYSTEM" and "START EXPLORING".
 * Clicking starts the experience, unlocks audio context with user gesture,
 * and fades out smoothly into exploration mode.
 */
function WelcomeOverlay() {
  const appState = usePlanetStore((s) => s.appState);
  const setAppState = usePlanetStore((s) => s.setAppState);
  const startAudio = usePlanetStore((s) => s.startAudio);

  const isVisible = appState === "intro";

  function handleStart() {
    startAudio();
    setAppState("exploring");
  }

  return (
    <AnimatePresence>
      {isVisible ? (
        <motion.div
          key="welcome-overlay"
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-space-950/40 backdrop-blur-sm pointer-events-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            className="glass-panel relative w-full max-w-lg p-8 sm:p-10 rounded-2xl text-center border border-white/10 shadow-2xl flex flex-col items-center"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Top decorative badge */}
            <span className="label-caps px-3 py-1 rounded-full bg-accent-500/10 border border-accent-400/30 text-accent-300 text-[10px]">
              Interactive Simulation
            </span>

            {/* Main Title */}
            <h1 className="mt-5 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-wider text-ink-100 uppercase leading-tight font-display">
              Explore the <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-300 via-accent-400 to-solar-400">
                Solar System
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mt-4 text-xs sm:text-sm text-ink-300 max-w-sm leading-relaxed font-sans">
              A cinematic 3D journey through our celestial neighborhood. Orbit, explore, and discover the worlds of our Sun.
            </p>

            {/* Feature tags */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[10px] text-ink-500 uppercase tracking-widest font-display">
              <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/5">
                Real NASA Data
              </span>
              <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/5">
                Elliptical Orbits
              </span>
              <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/5">
                Cinematic Flight
              </span>
            </div>

            {/* Start Button */}
            <motion.button
              onClick={handleStart}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.98 }}
              className="mt-8 group relative inline-flex items-center justify-center gap-3 px-8 py-3.5 rounded-full text-xs sm:text-sm font-semibold tracking-widest uppercase text-space-950 bg-gradient-to-r from-accent-400 to-accent-300 hover:from-accent-300 hover:to-solar-400 transition-all shadow-[0_0_24px_rgba(56,189,248,0.45)] hover:shadow-[0_0_32px_rgba(251,191,36,0.6)] cursor-pointer font-display"
              autoFocus
            >
              <span>Start Exploring</span>
              <svg
                className="w-4 h-4 transition-transform group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </motion.button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default memo(WelcomeOverlay);
