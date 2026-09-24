import { create } from "zustand";

/**
 * Application state.
 *
 * Deliberately small, and deliberately *discrete*. Nothing continuous lives
 * here — orbital positions, hover glow, label opacity and camera motion are all
 * driven by refs, shader uniforms and module singletons, because a store write
 * is a React render and a React render 144 times a second is a dropped frame.
 * What does live here are the facts that change only when the user does
 * something: which body the pointer is over, and which one they have chosen.
 *
 * There are two ways to read it, and the choice matters:
 *
 *   usePlanetStore((s) => s.selectedPlanetId)     subscribes, re-renders on
 *                                                change. For DOM UI — the
 *                                                details panel, the nav rail.
 *
 *   usePlanetStore.getState().selectedPlanetId    a plain read, no subscription.
 *                                                For `useFrame`, which runs
 *                                                every frame and must never
 *                                                cause a render.
 *
 * The 3D layer uses the second form exclusively (see `BodyInteraction` and
 * `BodyLabels`), so hovering a planet animates its glow, its scale, its cursor
 * and its label with React doing no work at all.
 *
 * Grows in Phase 5 (camera phase) and Phase 6 (app state, settings, audio) —
 * §3.7 of the build plan has the full intended shape.
 */
/** Range of the Orbit / Rotation speed sliders (multipliers on real time). */
export const SPEED_MIN = 0.1;
export const SPEED_MAX = 100;

const DEFAULT_SIMULATION = Object.freeze({
  orbitSpeed: 1,
  rotationSpeed: 1,
  paused: false,
  linked: false,
});

const clampSpeed = (v) =>
  Number.isFinite(v) ? Math.min(Math.max(v, SPEED_MIN), SPEED_MAX) : 1;

export const usePlanetStore = create((set) => ({
  /** Body the pointer is currently over, or null. */
  hoveredPlanetId: null,

  /** Body the user has selected, or null. Drives the camera and the panel. */
  selectedPlanetId: null,

  /** Camera animation state machine: 'idle' (overview) | 'traveling' | 'following'. */
  cameraPhase: "idle",

  setCameraPhase: (phase) => set({ cameraPhase: phase }),

  setHovered: (id) => set({ hoveredPlanetId: id }),

  /**
   * Clearing hover has to name the body that is leaving.
   *
   * Sliding the pointer straight from Mars onto Jupiter fires Mars's leave event
   * as well as Jupiter's enter, and an unguarded clear would wipe out the enter
   * that had already landed — leaving nothing hovered while the pointer sits on
   * Jupiter. Returning the current state unchanged is a no-op in zustand, so the
   * guard costs no notification either.
   */
  clearHovered: (id) =>
    set((state) => (state.hoveredPlanetId === id ? { hoveredPlanetId: null } : state)),

  selectPlanet: (id) => set({ selectedPlanetId: id }),

  clearSelection: () => set({ selectedPlanetId: null }),

  /** Display and animation toggles. */
  settings: {
    orbitLines: true,
    labels: true,
    idleDrift: true,
    /** "compact" (composed for the screen) | "true" (real distances and sizes). */
    scaleMode: "compact",
  },

  toggleSetting: (key) =>
    set((state) => ({
      settings: {
        ...state.settings,
        [key]: !state.settings[key],
      },
    })),

  setSetting: (key, value) =>
    set((state) => ({
      settings: {
        ...state.settings,
        [key]: value,
      },
    })),

  /**
   * User speed controls. Multipliers on the orbit and spin clocks
   * (SPEED_MIN-SPEED_MAX); `linked` makes either slider move both. Copied onto
   * `simulationClock` once per frame by <SimulationClock>.
   */
  simulation: { ...DEFAULT_SIMULATION },

  setOrbitSpeed: (speed) =>
    set((state) => {
      const v = clampSpeed(speed);
      const sim = state.simulation;
      return { simulation: { ...sim, orbitSpeed: v, ...(sim.linked ? { rotationSpeed: v } : null) } };
    }),

  setRotationSpeed: (speed) =>
    set((state) => {
      const v = clampSpeed(speed);
      const sim = state.simulation;
      return { simulation: { ...sim, rotationSpeed: v, ...(sim.linked ? { orbitSpeed: v } : null) } };
    }),

  togglePaused: () =>
    set((state) => ({ simulation: { ...state.simulation, paused: !state.simulation.paused } })),

  setPaused: (paused) =>
    set((state) => ({ simulation: { ...state.simulation, paused } })),

  /** Linking snaps rotation to the current orbit speed so they move as one. */
  setLinked: (linked) =>
    set((state) => ({
      simulation: {
        ...state.simulation,
        linked,
        ...(linked ? { rotationSpeed: state.simulation.orbitSpeed } : null),
      },
    })),

  resetSpeeds: () =>
    set((state) => ({ simulation: { ...DEFAULT_SIMULATION, linked: state.simulation.linked } })),

  /** Application experience flow: 'loading' | 'intro' | 'exploring'. */
  appState: "loading",

  setAppState: (appState) => set({ appState }),

  /** Ambient space audio settings (Phase 9 pre-wired). */
  audio: {
    enabled: false,
    volume: 0.5,
    started: false,
  },

  toggleAudio: () =>
    set((state) => ({
      audio: { ...state.audio, enabled: !state.audio.enabled },
    })),

  setVolume: (volume) =>
    set((state) => ({
      audio: { ...state.audio, volume },
    })),

  startAudio: () =>
    set((state) => ({
      audio: { ...state.audio, started: true, enabled: true },
    })),

  /** About / Credits modal state. */
  aboutOpen: false,

  setAboutOpen: (aboutOpen) => set({ aboutOpen }),

  /** Quality tier for performance adaptation: 'high' | 'medium' | 'low'. */
  qualityTier: "high",

  setQualityTier: (qualityTier) => set({ qualityTier }),
}));

