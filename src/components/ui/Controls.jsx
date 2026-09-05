import { memo, useState } from "react";
import { usePlanetStore } from "../../hooks/usePlanetStore.js";

/**
 * Top floating utility controls:
 * - Reset View button (when a planet is selected)
 * - Orbit lines toggle
 * - Labels toggle
 * - Audio mute/unmute and volume slider
 * - About / Credits modal trigger
 */
function Controls() {
  const appState = usePlanetStore((s) => s.appState);
  const selectedPlanetId = usePlanetStore((s) => s.selectedPlanetId);
  const clearSelection = usePlanetStore((s) => s.clearSelection);

  const settings = usePlanetStore((s) => s.settings);
  const toggleSetting = usePlanetStore((s) => s.toggleSetting);

  const audio = usePlanetStore((s) => s.audio);
  const toggleAudio = usePlanetStore((s) => s.toggleAudio);
  const startAudio = usePlanetStore((s) => s.startAudio);
  const setVolume = usePlanetStore((s) => s.setVolume);

  const setAboutOpen = usePlanetStore((s) => s.setAboutOpen);
  const [volumeOpen, setVolumeOpen] = useState(false);

  function handleToggleAudio() {
    if (!audio.started) {
      startAudio();
    } else {
      toggleAudio();
    }
  }

  if (appState !== "exploring") return null;

  return (
    <header className="fixed top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
      {/* Top Left: Reset View (when focused) or App Title */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {selectedPlanetId ? (
          <button
            onClick={clearSelection}
            className="glass-panel flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium text-solar-300 hover:text-solar-400 hover:border-solar-400/60 border border-solar-400/40 shadow-[0_0_16px_rgba(251,191,36,0.3)] transition-all cursor-pointer font-display uppercase tracking-wider"
            title="Return to full solar system (Escape)"
            aria-label="Reset View"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Overview</span>
            <span className="hidden sm:inline-block text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-ink-300">
              Esc
            </span>
          </button>
        ) : (
          <div className="glass-panel hidden sm:flex items-center gap-2.5 px-4 py-2 rounded-full border border-white/10 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-accent-400 shadow-[0_0_8px_#38bdf8]" />
            <span className="text-xs font-bold font-display uppercase tracking-widest text-ink-100">
              Solar System
            </span>
          </div>
        )}
      </div>

      {/* Top Right: Utility Toggles */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {/* Toggle Orbit Lines */}
        <button
          onClick={() => toggleSetting("orbitLines")}
          className={`glass-panel flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium border transition-all cursor-pointer ${
            settings.orbitLines
              ? "border-accent-400/50 text-accent-300 bg-accent-500/10 shadow-[0_0_12px_rgba(56,189,248,0.25)]"
              : "border-white/10 text-ink-500 hover:text-ink-300 hover:border-white/20"
          }`}
          title={settings.orbitLines ? "Hide Orbit Lines" : "Show Orbit Lines"}
          aria-label="Toggle orbit lines"
          aria-pressed={settings.orbitLines}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <ellipse cx="12" cy="12" rx="9" ry="5" strokeDasharray={settings.orbitLines ? "none" : "2 2"} />
          </svg>
          <span className="hidden md:inline font-display text-[10px] uppercase tracking-wider">
            Orbits
          </span>
        </button>

        {/* Toggle Labels */}
        <button
          onClick={() => toggleSetting("labels")}
          className={`glass-panel flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium border transition-all cursor-pointer ${
            settings.labels
              ? "border-accent-400/50 text-accent-300 bg-accent-500/10 shadow-[0_0_12px_rgba(56,189,248,0.25)]"
              : "border-white/10 text-ink-500 hover:text-ink-300 hover:border-white/20"
          }`}
          title={settings.labels ? "Hide Labels" : "Show Labels"}
          aria-label="Toggle planet labels"
          aria-pressed={settings.labels}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <span className="hidden md:inline font-display text-[10px] uppercase tracking-wider">
            Labels
          </span>
        </button>

        {/* Audio Toggle & Volume Slider */}
        <div className="relative flex items-center">
          <button
            onClick={handleToggleAudio}
            onMouseEnter={() => setVolumeOpen(true)}
            className={`glass-panel flex items-center justify-center w-9 h-9 rounded-full border transition-all cursor-pointer ${
              audio.enabled
                ? "border-accent-400/50 text-accent-300 bg-accent-500/10 shadow-[0_0_12px_rgba(56,189,248,0.25)]"
                : "border-white/10 text-ink-500 hover:text-ink-300 hover:border-white/20"
            }`}
            title={audio.enabled ? "Mute Ambient Sound" : "Enable Ambient Sound"}
            aria-label="Toggle audio"
            aria-pressed={audio.enabled}
          >
            {audio.enabled ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            )}
          </button>

          {/* Inline Volume Slider Popover */}
          {volumeOpen && audio.enabled ? (
            <div
              onMouseLeave={() => setVolumeOpen(false)}
              className="glass-panel absolute right-0 top-12 p-3 rounded-xl border border-white/10 shadow-xl flex items-center gap-2 z-30"
            >
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={audio.volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-24 accent-accent-400 cursor-pointer"
                aria-label="Audio volume"
              />
              <span className="text-[10px] text-ink-300 font-display tabular-nums w-6">
                {Math.round(audio.volume * 100)}%
              </span>
            </div>
          ) : null}
        </div>

        {/* About / Attribution Modal Trigger */}
        <button
          onClick={() => setAboutOpen(true)}
          className="glass-panel flex items-center justify-center w-9 h-9 rounded-full border border-white/10 text-ink-400 hover:text-ink-100 hover:border-white/20 transition-all cursor-pointer"
          title="About & Attribution"
          aria-label="Open about and credits dialog"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>
    </header>
  );
}

export default memo(Controls);
