import { memo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

import { usePlanetStore } from "../../hooks/usePlanetStore.js";
import {
  getBodyById,
  getAdjacentPlanetId,
  EARTH,
} from "../../data/planets.js";
import {
  distanceBetweenKm,
  formatDistanceKm,
  simulationClock,
} from "../../utils/planetUtils.js";

/**
 * Futuristic glassmorphism planet information panel.
 *
 * Spec §10, §11, §12, §13:
 * - Slides in from right when a planet is selected
 * - Header with category, name, prev/next arrows, and close button
 * - Detailed physical stats & scientific metrics
 * - Live real-time distance from Earth (4Hz throttled ref write, zero re-renders)
 * - Curated fun facts with glowing bullet points
 */
function PlanetDetails() {
  const selectedPlanetId = usePlanetStore((s) => s.selectedPlanetId);
  const selectPlanet = usePlanetStore((s) => s.selectPlanet);
  const clearSelection = usePlanetStore((s) => s.clearSelection);

  const body = selectedPlanetId ? getBodyById(selectedPlanetId) : null;
  const earthDistSpanRef = useRef(null);

  // 4Hz live update for Distance from Earth without triggering React re-renders
  useEffect(() => {
    if (!body || body.id === "earth") return;

    function updateDistance() {
      if (earthDistSpanRef.current) {
        const km = distanceBetweenKm(EARTH, body, simulationClock.time);
        earthDistSpanRef.current.innerText = formatDistanceKm(km);
      }
    }

    updateDistance();
    const interval = setInterval(updateDistance, 250);
    return () => clearInterval(interval);
  }, [body]);

  function handlePrev() {
    if (!body) return;
    const prevId = getAdjacentPlanetId(body.id, -1);
    selectPlanet(prevId);
  }

  function handleNext() {
    if (!body) return;
    const nextId = getAdjacentPlanetId(body.id, 1);
    selectPlanet(nextId);
  }

  return (
    <AnimatePresence>
      {body ? (
        <motion.aside
          key={`panel-${body.id}`}
          className="glass-panel fixed top-4 right-4 bottom-4 w-full sm:w-[410px] max-w-[calc(100vw-2rem)] z-30 rounded-2xl flex flex-col overflow-hidden shadow-2xl border border-white/10"
          initial={{ x: 60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 60, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          role="dialog"
          aria-label={`${body.name} details`}
        >
          {/* Top Bar: Nav & Close */}
          <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/10 shrink-0">
            {/* Prev / Next Planet Cycling */}
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrev}
                className="p-1.5 rounded-lg text-ink-300 hover:text-ink-100 hover:bg-white/10 transition-colors cursor-pointer"
                title="Previous planet (Left Arrow)"
                aria-label="Previous planet"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={handleNext}
                className="p-1.5 rounded-lg text-ink-300 hover:text-ink-100 hover:bg-white/10 transition-colors cursor-pointer"
                title="Next planet (Right Arrow)"
                aria-label="Next planet"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <span className="text-[10px] uppercase font-display tracking-widest text-ink-500 ml-1">
                Cycle
              </span>
            </div>

            {/* Close / Back to Solar System */}
            <button
              onClick={clearSelection}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-ink-300 hover:text-ink-100 hover:bg-white/10 transition-all cursor-pointer"
              title="Return to Overview (Esc)"
              aria-label="Close panel"
            >
              <span className="text-[11px] font-display uppercase tracking-wider">Close</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable Content Container */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 custom-scrollbar">
            {/* Header: Name & Category */}
            <div>
              <span className="label-caps inline-block px-2.5 py-0.5 rounded-full bg-accent-500/10 border border-accent-400/20 text-accent-300 text-[10px]">
                {body.category}
              </span>
              <h2 className="mt-2 text-3xl font-extrabold text-ink-100 font-display tracking-wide uppercase">
                {body.name}
              </h2>
              <p className="mt-3 text-xs text-ink-300 leading-relaxed font-sans">
                {body.description}
              </p>
            </div>

            {/* Scientific Information Grid */}
            <div>
              <h3 className="label-caps text-ink-500 mb-3">
                Key Scientific Data
              </h3>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                {/* Diameter */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <span className="text-[10px] text-ink-500 uppercase tracking-wider block font-display">
                    Diameter
                  </span>
                  <span className="text-ink-100 font-semibold mt-0.5 block font-display">
                    {body.diameterKm.toLocaleString("en-US")} km
                  </span>
                </div>

                {/* Distance from Sun */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <span className="text-[10px] text-ink-500 uppercase tracking-wider block font-display">
                    From Sun
                  </span>
                  <span className="text-ink-100 font-semibold mt-0.5 block font-display">
                    {body.semiMajorAU ? `${body.semiMajorAU} AU` : "Center"}
                  </span>
                </div>

                {/* Live Distance from Earth */}
                <div className="col-span-2 p-3 rounded-xl bg-accent-500/5 border border-accent-400/20">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-accent-300 uppercase tracking-wider block font-display">
                      Live Distance from Earth
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-400 animate-ping" />
                  </div>
                  <span
                    ref={earthDistSpanRef}
                    className="text-ink-100 font-bold text-sm mt-1 block font-display tracking-wide"
                  >
                    {body.id === "earth" ? "0 km (Home Reference)" : "Calculating..."}
                  </span>
                </div>

                {/* Gravity */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <span className="text-[10px] text-ink-500 uppercase tracking-wider block font-display">
                    Gravity
                  </span>
                  <span className="text-ink-100 font-medium mt-0.5 block font-sans">
                    {body.gravity}
                  </span>
                </div>

                {/* Temperature */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <span className="text-[10px] text-ink-500 uppercase tracking-wider block font-display">
                    Surface Temp
                  </span>
                  <span className="text-ink-100 font-medium mt-0.5 block font-sans">
                    {body.temperature}
                  </span>
                </div>

                {/* Day Length */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <span className="text-[10px] text-ink-500 uppercase tracking-wider block font-display">
                    Day Length
                  </span>
                  <span className="text-ink-100 font-medium mt-0.5 block font-sans">
                    {body.dayLength}
                  </span>
                </div>

                {/* Year Length */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <span className="text-[10px] text-ink-500 uppercase tracking-wider block font-display">
                    Orbital Period
                  </span>
                  <span className="text-ink-100 font-medium mt-0.5 block font-sans">
                    {body.yearLength}
                  </span>
                </div>

                {/* Moons */}
                <div className="col-span-2 p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
                  <span className="text-[10px] text-ink-500 uppercase tracking-wider font-display">
                    Known Moons
                  </span>
                  <span className="text-solar-400 font-bold font-display text-sm">
                    {body.moonCount ?? 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Fun Facts Section */}
            {body.facts?.length ? (
              <div>
                <h3 className="label-caps text-ink-500 mb-3">
                  Quick Facts
                </h3>
                <ul className="space-y-2.5">
                  {body.facts.map((fact, i) => (
                    <li
                      key={i}
                      className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-ink-300 leading-relaxed flex items-start gap-2.5"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-solar-400 mt-1.5 shrink-0 shadow-[0_0_6px_#fbbf24]" />
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

export default memo(PlanetDetails);
