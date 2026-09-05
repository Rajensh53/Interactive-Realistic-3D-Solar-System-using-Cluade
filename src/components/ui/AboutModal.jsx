import { memo, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { usePlanetStore } from "../../hooks/usePlanetStore.js";
import { getTextureFailures } from "../../utils/textureUtils.js";

/**
 * About & Credits modal.
 *
 * Mandatory attribution for CC BY 4.0 textures (Solar System Scope)
 * and NASA data sources, plus interaction instructions.
 */
function AboutModal() {
  const aboutOpen = usePlanetStore((s) => s.aboutOpen);
  const setAboutOpen = usePlanetStore((s) => s.setAboutOpen);
  const failures = useMemo(() => getTextureFailures(), [aboutOpen]);

  return (
    <AnimatePresence>
      {aboutOpen ? (
        <motion.div
          key="about-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-950/60 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setAboutOpen(false)}
        >
          <motion.div
            className="glass-panel relative w-full max-w-lg p-6 sm:p-8 rounded-2xl border border-white/10 shadow-2xl text-left"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="About & Credits"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent-400 shadow-[0_0_8px_#38bdf8]" />
                <h2 className="text-lg font-bold font-display uppercase tracking-wider text-ink-100">
                  About & Credits
                </h2>
              </div>
              <button
                onClick={() => setAboutOpen(false)}
                className="p-1.5 rounded-lg text-ink-400 hover:text-ink-100 hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-5 space-y-5 text-xs text-ink-300 font-sans leading-relaxed max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
              {/* Attribution */}
              <div>
                <h3 className="label-caps text-ink-500 mb-2">
                  Asset Attribution
                </h3>
                <p>
                  High-resolution celestial textures are courtesy of{" "}
                  <a
                    href="https://www.solarsystemscope.com/textures/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent-300 hover:underline font-medium"
                  >
                    Solar System Scope
                  </a>
                  , licensed under{" "}
                  <a
                    href="https://creativecommons.org/licenses/by/4.0/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent-300 hover:underline font-medium"
                  >
                    Creative Commons Attribution 4.0 International (CC BY 4.0)
                  </a>
                  .
                </p>
                <p className="mt-2">
                  Planetary physics and orbital characteristics compiled from{" "}
                  <span className="text-ink-100 font-medium">
                    NASA Planetary Fact Sheets & Jet Propulsion Laboratory (JPL)
                  </span>
                  .
                </p>
              </div>

              {/* Degraded Asset Status (if any textures failed) */}
              {failures.length > 0 ? (
                <div className="p-3 rounded-xl bg-solar-500/10 border border-solar-400/20 text-solar-300">
                  <h4 className="label-caps text-solar-400 mb-1 text-[10px]">
                    Degraded Asset Notice
                  </h4>
                  <p className="text-[11px] leading-relaxed text-ink-300">
                    {failures.length} texture asset(s) could not be loaded and have
                    degraded to procedural fallback materials without disrupting the simulation:
                  </p>
                  <ul className="mt-1.5 space-y-0.5 text-[10px] font-mono text-solar-300/80">
                    {failures.map((url, i) => (
                      <li key={i}>• {url}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Controls guide */}
              <div>
                <h3 className="label-caps text-ink-500 mb-2">
                  Navigation & Controls
                </h3>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                    <span className="text-ink-500 font-display block uppercase text-[9px]">Rotate View</span>
                    <span className="text-ink-100 font-medium">Left-Click + Drag</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                    <span className="text-ink-500 font-display block uppercase text-[9px]">Zoom Distance</span>
                    <span className="text-ink-100 font-medium">Mouse Wheel / Pinch</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                    <span className="text-ink-500 font-display block uppercase text-[9px]">Pan Position</span>
                    <span className="text-ink-100 font-medium">Right-Click + Drag</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                    <span className="text-ink-500 font-display block uppercase text-[9px]">Reset View</span>
                    <span className="text-ink-100 font-medium">Escape / Empty Click</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5 col-span-2">
                    <span className="text-ink-500 font-display block uppercase text-[9px]">Cycle Planets</span>
                    <span className="text-ink-100 font-medium">Arrow Left (←) / Arrow Right (→)</span>
                  </div>
                </div>
              </div>

              {/* Architecture info */}
              <div className="pt-2 border-t border-white/5 text-[11px] text-ink-500">
                <span>Production Stack: React 19 · Three.js · React Three Fiber · GSAP · Tailwind CSS v4</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default memo(AboutModal);
