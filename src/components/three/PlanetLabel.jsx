import { memo, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

import { usePlanetStore } from "../../hooks/usePlanetStore.js";

/**
 * Floating label for celestial bodies.
 *
 * Clean, minimalist, and non-intrusive:
 * - Hidden by default so the solar system remains pristine and uncluttered.
 * - Fades in with a smooth glowing badge ONLY when hovered or selected.
 * - Zero 3D WebGL occlusion meshes (which caused black rectangular cutouts).
 * - Styled with sleek Orbitron typography, cyan hover glow, and amber selection accent.
 *
 * True scale: bodies are far smaller than a pixel from across the system, so
 * the Sun's and planets' labels stay visible (they double as click targets).
 * A moon's label appears only once the camera is within MOON_LABEL_RANGE of
 * its orbit, otherwise the Galilean moons pile up on top of Jupiter's label.
 *
 * Seen from afar, the inner planets crowd around the Sun, so persistent labels
 * declutter: a label steps aside while it would overlap a label of higher
 * priority (the Sun, then larger bodies; hovered/selected always win). Labels
 * also lift a few pixels so the BodyMarker dot beneath each one stays visible.
 */
const MOON_LABEL_RANGE = 50; // × the moon's orbit radius
const LABEL_LIFT_PX = 14;
/** Two labels closer than this (centre to centre, in px) overlap. */
const OVERLAP_X = 96;
const OVERLAP_Y = 22;
const _labelPos = new THREE.Vector3();

/** id -> { x, y, priority, shown }: last frame's screen slot of each label. */
const labelSlots = new Map();

function overlapsHigherPriority(id, slot) {
  for (const [otherId, other] of labelSlots) {
    if (otherId === id || !other.shown || other.priority <= slot.priority) continue;
    if (Math.abs(other.x - slot.x) < OVERLAP_X && Math.abs(other.y - slot.y) < OVERLAP_Y) {
      return true;
    }
  }
  return false;
}

function PlanetLabel({ body, yOffset, trueScale = false }) {
  const groupRef = useRef(null);
  const showLabels = usePlanetStore((s) => s.settings.labels);
  const isHovered = usePlanetStore((s) => s.hoveredPlanetId === body.id);
  const isSelected = usePlanetStore((s) => s.selectedPlanetId === body.id);

  const isMoon = Boolean(body.parentId);
  const [moonInRange, setMoonInRange] = useState(false);
  const [crowded, setCrowded] = useState(false);

  const persistent = trueScale && (!isMoon || moonInRange);
  const pinned = isHovered || isSelected;

  useEffect(() => () => labelSlots.delete(body.id), [body.id]);

  // True scale only. React state flips only when a threshold is crossed, so
  // none of this re-renders per frame.
  useFrame(({ camera, size }) => {
    if (!trueScale || !groupRef.current) {
      labelSlots.delete(body.id);
      return;
    }
    groupRef.current.getWorldPosition(_labelPos);

    if (isMoon) {
      const inRange =
        camera.position.distanceTo(_labelPos) < body.orbitRadius * MOON_LABEL_RANGE;
      if (inRange !== moonInRange) setMoonInRange(inRange);
    }

    if (!persistent && !pinned) {
      labelSlots.delete(body.id);
      return;
    }
    _labelPos.project(camera);
    const slot = {
      x: (_labelPos.x * 0.5 + 0.5) * size.width,
      y: (-_labelPos.y * 0.5 + 0.5) * size.height,
      priority: pinned ? Infinity : body.id === "sun" ? 1e9 : body.radius,
      shown: false,
    };
    const hidden = _labelPos.z > 1 || (!pinned && overlapsHigherPriority(body.id, slot));
    slot.shown = !hidden;
    labelSlots.set(body.id, slot);
    if (hidden !== crowded) setCrowded(hidden);
  });

  const active = (pinned || (persistent && !crowded)) && showLabels;
  const lift = trueScale ? ` translateY(-${LABEL_LIFT_PX}px)` : "";
  const offset =
    yOffset ??
    (trueScale ? body.radius * 1.6 : Math.max(body.radius * 1.35 + 0.6, 1.4));

  return (
    <group ref={groupRef} position={[0, offset, 0]}>
      <Html
        center
        style={{
          pointerEvents: active ? "auto" : "none",
          transition:
            "opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
          opacity: active ? 1 : 0,
          transform: `translate(-50%, -50%)${lift} scale(${active ? 1 : 0.85})`,
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
