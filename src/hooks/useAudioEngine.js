import { useEffect, useRef } from "react";
import { usePlanetStore } from "./usePlanetStore.js";

/**
 * Procedural Space Ambient Audio Engine
 *
 * Spec §19 & §3.8:
 * - Pure procedural Web Audio synthesis (zero audio downloads or licensing issues)
 * - Deep-space binaural drone (55.0 Hz & 55.4 Hz dual detuned sines)
 * - Lowpass filtered warmth + gentle LFO-modulated pink noise solar wind swell
 * - Strictly user-gesture gated (unlocked by "START EXPLORING" or sound button)
 * - Automatic background tab suspension (conserves CPU/battery)
 * - Pop-free exponential volume ramping
 */
export function useAudioEngine() {
  const engineRef = useRef(null);

  useEffect(() => {
    // Only browser environments
    if (typeof window === "undefined") return;

    let ctx = null;
    let masterGain = null;
    let isInitialized = false;

    function initAudio() {
      if (isInitialized) return;

      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      try {
        ctx = new AudioContextClass();
      } catch (err) {
        console.warn("Web Audio not supported or blocked:", err);
        return;
      }

      // 1. Master Output Gain
      masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      masterGain.connect(ctx.destination);

      // 2. Cosmic Sub-Bass Drone (55 Hz & 55.4 Hz detuned sines)
      // Generates an acoustic binaural pulse of 0.4 Hz
      const droneFilter = ctx.createBiquadFilter();
      droneFilter.type = "lowpass";
      droneFilter.frequency.setValueAtTime(320, ctx.currentTime);
      droneFilter.Q.setValueAtTime(1.4, ctx.currentTime);

      const droneGain = ctx.createGain();
      droneGain.gain.setValueAtTime(0.38, ctx.currentTime);
      droneGain.connect(droneFilter);
      droneFilter.connect(masterGain);

      const osc1 = ctx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(55.0, ctx.currentTime);

      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(55.4, ctx.currentTime);

      // Faint sub-harmonic overtone (110 Hz triangle) for body warmth
      const osc3 = ctx.createOscillator();
      osc3.type = "triangle";
      osc3.frequency.setValueAtTime(110.0, ctx.currentTime);
      const osc3Gain = ctx.createGain();
      osc3Gain.gain.setValueAtTime(0.12, ctx.currentTime);
      osc3.connect(osc3Gain);
      osc3Gain.connect(droneGain);

      osc1.connect(droneGain);
      osc2.connect(droneGain);

      osc1.start();
      osc2.start();
      osc3.start();

      // 3. Solar Wind / Cosmic Ether Swell (Pink Noise Generator)
      // Uses Paul Kellet's filtered noise algorithm in a 4-second looping buffer
      const bufferSize = ctx.sampleRate * 4;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      let b0 = 0,
        b1 = 0,
        b2 = 0,
        b3 = 0,
        b4 = 0,
        b5 = 0,
        b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        output[i] =
          (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.075;
        b6 = white * 0.115926;
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      const windFilter = ctx.createBiquadFilter();
      windFilter.type = "bandpass";
      windFilter.frequency.setValueAtTime(360, ctx.currentTime);
      windFilter.Q.setValueAtTime(1.8, ctx.currentTime);

      // Low Frequency Oscillator (LFO at 0.075 Hz ~ 13.3s cycle) modulating wind filter
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(0.075, ctx.currentTime);

      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(190, ctx.currentTime); // Swings filter ±190 Hz
      lfo.connect(lfoGain);
      lfoGain.connect(windFilter.frequency);

      const windGain = ctx.createGain();
      windGain.gain.setValueAtTime(0.24, ctx.currentTime);

      noiseSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(masterGain);

      noiseSource.start();
      lfo.start();

      isInitialized = true;
      engineRef.current = {
        ctx,
        masterGain,
        nodes: [osc1, osc2, osc3, noiseSource, lfo],
      };
    }

    function updateVolume(enabled, volume) {
      if (!ctx || !masterGain) return;

      const now = ctx.currentTime;
      const targetGain = enabled ? Math.max(volume * 0.42, 0.0001) : 0.0001;

      // Pop-free smooth exponential transition
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setTargetAtTime(targetGain, now, 0.18);
    }

    // Subscribe to Zustand store changes
    const unsubscribe = usePlanetStore.subscribe((state, prevState) => {
      const audio = state.audio;
      const prevAudio = prevState?.audio;

      // Initialize on first user gesture start
      if (audio.started && !isInitialized) {
        initAudio();
      }

      if (ctx && ctx.state === "suspended" && audio.started && audio.enabled) {
        ctx.resume();
      }

      if (
        audio.enabled !== prevAudio?.enabled ||
        audio.volume !== prevAudio?.volume ||
        audio.started !== prevAudio?.started
      ) {
        updateVolume(audio.enabled && audio.started, audio.volume);
      }
    });

    // Check current store state if already started
    const initialAudio = usePlanetStore.getState().audio;
    if (initialAudio.started) {
      initAudio();
      if (ctx && ctx.state === "suspended" && initialAudio.enabled) {
        ctx.resume();
      }
      updateVolume(initialAudio.enabled, initialAudio.volume);
    }

    // Tab visibility handling: suspend audio in background, resume when focused
    function handleVisibilityChange() {
      if (!ctx) return;
      const currentAudio = usePlanetStore.getState().audio;

      if (document.hidden) {
        if (ctx.state === "running") {
          ctx.suspend();
        }
      } else {
        if (ctx.state === "suspended" && currentAudio.enabled && currentAudio.started) {
          ctx.resume();
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (engineRef.current) {
        try {
          const { ctx: currentCtx, nodes } = engineRef.current;
          nodes.forEach((n) => {
            try {
              n.stop();
              n.disconnect();
            } catch {
              // Ignore stopped nodes
            }
          });
          currentCtx.close();
        } catch {
          // Ignore
        }
        engineRef.current = null;
      }
    };
  }, []);
}
