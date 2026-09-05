import { memo } from "react";
import { Html } from "@react-three/drei";

import { usePlanetStore } from "../../hooks/usePlanetStore.js";

/**
 * Floating label for celestial bodies.
 *
 * Clean, minimalist, and non-intrusive:
 * - Hidden by default so the solar system remains pristine and uncluttered.
 * - Fades in with a smooth glowing badge ONLY when hovered or selected.
 * - Zero 3D WebGL occlusion meshes (which caused black rectangular cutouts).
 * - Styled with sleek Orbitron typography, cyan hover glow, and amber selection accent.
 */
function PlanetLabel({ body, yOffset }) {
  const showLabels = usePlanetStore((s) => s.settings.labels);
  const isHovered = usePlanetStore((s) => s.hoveredPlanetId === body.id);
  const isSelected = usePlanetStore((s) => s.selectedPlanetId === body.id);

  const active = (isHovered || isSelected) && showLabels;
  const offset = yOffset ?? Math.max(body.radius * 1.35 + 0.6, 1.4);

  return (
    <group position={[0, offset, 0]}>
      <Html
        center
        style={{
          pointerEvents: active ? "auto" : "none",
          transition:
            "opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
          opacity: active ? 1 : 0,
          transform: `translate(-50%, -50%) scale(${active ? 1 : 0.85})`,
          userSelect: "none",
        }}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            usePlanetStore.getState().selectPlanet(body.id);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium tracking-wider backdrop-blur-md cursor-pointer whitespace-nowrap transition-all duration-200 select-none ${
            isSelected
              ? "bg-solar-950/85 border border-solar-400/90 text-solar-300 shadow-[0_0_14px_rgba(251,191,36,0.5)]"
              : "bg-space-950/85 border border-accent-400/80 text-accent-300 shadow-[0_0_14px_rgba(56,189,248,0.45)]"
          }`}
          style={{
            fontFamily: "var(--font-display)",
            letterSpacing: "0.14em",
          }}
        >
          {/* Subtle glowing indicator dot */}
          <span
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              isSelected
                ? "bg-solar-400 shadow-[0_0_8px_#fbbf24] animate-pulse"
                : "bg-accent-400 shadow-[0_0_8px_#38bdf8]"
            }`}
          />
          <span className="uppercase text-[10px] font-semibold">
            {body.name}
          </span>
        </div>
      </Html>
    </group>
  );
}

export default memo(PlanetLabel);
