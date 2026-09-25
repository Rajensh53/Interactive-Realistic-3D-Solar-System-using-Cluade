import { memo, useEffect, useRef, useState } from "react";

import { usePlanetStore, SPEED_MIN, SPEED_MAX } from "../../hooks/usePlanetStore.js";
import { SCENE } from "../../utils/planetUtils.js";

/**
 * Speed popover in the top bar: independent Orbit and Rotation speed sliders,
 * pause/play, presets, reset and a "link" option that moves both together.
 *
 * Sliders are logarithmic (0.1× to 100×) so the useful range around 1× gets
 * most of the travel, and they snap to exactly 1× near the middle. Every value
 * is written to the store; <SimulationClock> copies it onto the clocks each
 * frame, so dragging never re-renders the 3D scene.
 */

const SLIDER_STEPS = 1000;
const LOG_MIN = Math.log10(SPEED_MIN);
const LOG_SPAN = Math.log10(SPEED_MAX) - LOG_MIN;
const PRESETS = [0.5, 1, 5, 25];

function speedToSlider(speed) {
  return Math.round(((Math.log10(speed) - LOG_MIN) / LOG_SPAN) * SLIDER_STEPS);
}

function sliderToSpeed(value) {
  const speed = 10 ** (LOG_MIN + (value / SLIDER_STEPS) * LOG_SPAN);
  // Snap to exactly 1× near the middle so "normal speed" is easy to hit.
  return Math.abs(speed - 1) < 0.06 ? 1 : speed;
}

function formatSpeed(speed) {
  if (speed < 1) return `${speed.toFixed(2)}×`;
  if (speed < 10) return `${speed.toFixed(1)}×`;
  return `${Math.round(speed)}×`;
}

function formatDuration(seconds) {
  if (seconds < 1) return `${seconds.toFixed(2)} s`;
  if (seconds < 90) return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)} s`;
  const minutes = seconds / 60;
  if (minutes < 90) return `${minutes < 10 ? minutes.toFixed(1) : Math.round(minutes)} min`;
  return `${(minutes / 60).toFixed(1)} h`;
}

function SpeedSlider({ id, label, speed, onChange, hint }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-[10px] text-ink-400 uppercase tracking-wider font-display">
          {label}
        </label>
        <span className="text-xs text-ink-100 font-display tabular-nums">{formatSpeed(speed)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={SLIDER_STEPS}
        step={1}
        value={speedToSlider(speed)}
        onChange={(e) => onChange(sliderToSpeed(Number(e.target.value)))}
        aria-valuetext={`${formatSpeed(speed).replace("×", "")} times`}
        className="w-full mt-1.5 accent-accent-400 cursor-pointer"
      />
      <p className="text-[10px] text-ink-500 font-sans mt-0.5">{hint}</p>
    </div>
  );
}

function SpeedControls() {
  const simulation = usePlanetStore((s) => s.simulation);
  const setOrbitSpeed = usePlanetStore((s) => s.setOrbitSpeed);
  const setRotationSpeed = usePlanetStore((s) => s.setRotationSpeed);
  const togglePaused = usePlanetStore((s) => s.togglePaused);
  const setLinked = usePlanetStore((s) => s.setLinked);
  const resetSpeeds = usePlanetStore((s) => s.resetSpeeds);

  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const { orbitSpeed, rotationSpeed, paused, linked } = simulation;

  // Close on an outside click or Esc. Esc is caught in the capture phase and
  // stopped, so closing the popover doesn't also clear the selected planet.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  const buttonLabel = paused ? "Paused" : formatSpeed(orbitSpeed);
  const pill =
    "glass-panel flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium border transition-all cursor-pointer";
  const changed = paused || orbitSpeed !== 1 || rotationSpeed !== 1;

  return (
    <div ref={rootRef} className="relative flex items-center">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`${pill} ${
          changed
            ? "border-solar-400/60 text-solar-300 bg-solar-500/10 shadow-[0_0_12px_rgba(251,191,36,0.3)]"
            : "border-white/10 text-ink-300 hover:text-ink-100 hover:border-white/20"
        }`}
        title="Orbit and rotation speed"
        aria-label={`Speed controls, ${paused ? "paused" : `orbit ${formatSpeed(orbitSpeed)}`}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {paused ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        )}
        <span className="font-display text-[10px] uppercase tracking-wider tabular-nums">
          {buttonLabel}
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Speed controls"
          // Phones: span the screen under the toolbar (anchored to the button
          // it would run off the left edge). From sm up: a dropdown.
          className="glass-panel fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-72 p-4 rounded-xl border border-white/10 shadow-xl z-30 space-y-4"
        >
          <div className="flex items-center justify-between">
            <button
              onClick={togglePaused}
              aria-pressed={paused}
              className={`${pill} ${
                paused
                  ? "border-solar-400/60 text-solar-300 bg-solar-500/10"
                  : "border-accent-400/50 text-accent-300 bg-accent-500/10"
              }`}
              title="Pause / play (Space)"
            >
              {paused ? (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
                </svg>
              )}
              <span className="font-display text-[10px] uppercase tracking-wider">
                {paused ? "Play" : "Pause"}
              </span>
            </button>
            <button
              onClick={resetSpeeds}
              className={`${pill} border-white/10 text-ink-300 hover:text-ink-100 hover:border-white/20`}
              title="Back to 1× and playing"
            >
              <span className="font-display text-[10px] uppercase tracking-wider">Reset</span>
            </button>
          </div>

          <SpeedSlider
            id="speed-orbit"
            label="Orbit"
            speed={orbitSpeed}
            onChange={setOrbitSpeed}
            hint={`1 Earth year ≈ ${formatDuration(SCENE.EARTH_YEAR_SECONDS / orbitSpeed)}`}
          />
          <SpeedSlider
            id="speed-rotation"
            label="Rotation"
            speed={rotationSpeed}
            onChange={setRotationSpeed}
            hint={`1 Earth day ≈ ${formatDuration(SCENE.EARTH_DAY_SECONDS / rotationSpeed)}`}
          />

          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setOrbitSpeed(p)}
                  aria-pressed={orbitSpeed === p}
                  className={`px-2 py-1 rounded-md text-[10px] font-display tabular-nums border transition-colors cursor-pointer ${
                    orbitSpeed === p
                      ? "border-accent-400/60 text-accent-300 bg-accent-500/10"
                      : "border-white/10 text-ink-400 hover:text-ink-100 hover:border-white/20"
                  }`}
                  title={linked ? `Orbit and rotation ${formatSpeed(p)}` : `Orbit ${formatSpeed(p)}`}
                >
                  {p}×
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-[10px] text-ink-300 font-display uppercase tracking-wider cursor-pointer">
              <input
                type="checkbox"
                checked={linked}
                onChange={(e) => setLinked(e.target.checked)}
                className="accent-accent-400 cursor-pointer"
              />
              Link
            </label>
          </div>

          <p className="text-[10px] text-ink-500 font-sans leading-relaxed border-t border-white/10 pt-3">
            Spin rates follow each body's real day length. Moons are tidally
            locked, so they turn with their orbit.
            <span className="block mt-1 text-ink-400">Space: pause · [ ] : orbit speed</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default memo(SpeedControls);
