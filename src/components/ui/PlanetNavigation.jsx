import { memo } from "react";
import { motion } from "motion/react";

import { usePlanetStore } from "../../hooks/usePlanetStore.js";
import { BODIES } from "../../data/planets.js";

/**
 * Bottom quick-selector rail for celestial bodies.
 *
 * Spec §13:
 * - Allows quick selection of Sun, Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune
 * - Smooth camera flight on click
 * - Horizontal swipe on mobile
 * - Active glowing state
 */
function PlanetNavigation() {
  const selectedPlanetId = usePlanetStore((s) => s.selectedPlanetId);
  const selectPlanet = usePlanetStore((s) => s.selectPlanet);
  const appState = usePlanetStore((s) => s.appState);

  // Hidden while loading or on the welcome screen
  if (appState !== "exploring") return null;

  return (
    <nav
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 max-w-[95vw] pointer-events-auto"
      aria-label="Planet navigation rail"
    >
      <div className="glass-panel flex items-center gap-1.5 p-1.5 rounded-full border border-white/10 shadow-2xl overflow-x-auto max-w-full no-scrollbar">
        {BODIES.map((body) => {
          const isSelected = selectedPlanetId === body.id;

          return (
            <button
              key={body.id}
              onClick={() => selectPlanet(body.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium tracking-wider transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                isSelected
                  ? "bg-solar-500/25 border border-solar-400 text-solar-300 shadow-[0_0_16px_rgba(251,191,36,0.35)] scale-105"
                  : "text-ink-300 hover:text-ink-100 hover:bg-white/5 border border-transparent"
              }`}
              style={{
                fontFamily: "var(--font-display)",
                letterSpacing: "0.12em",
              }}
              title={`Focus on ${body.name}`}
              aria-label={`Select ${body.name}`}
              aria-pressed={isSelected}
            >
              {/* Colored body dot */}
              <span
                className="w-2 h-2 rounded-full shrink-0 transition-transform"
                style={{
                  backgroundColor: body.fallbackColor,
                  boxShadow: isSelected
                    ? `0 0 8px ${body.fallbackColor}`
                    : "none",
                }}
              />
              <span className="uppercase text-[11px] font-semibold">
                {body.name}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default memo(PlanetNavigation);
