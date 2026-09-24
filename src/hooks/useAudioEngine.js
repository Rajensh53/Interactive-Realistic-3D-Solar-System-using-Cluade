import { useEffect, useRef } from "react";
import { usePlanetStore } from "./usePlanetStore.js";

/**
 * Procedural Space Ambient Audio Engine
 *
 * Spec §19 & §3.8:
 * - Pure procedural Web Audio synthesis (zero audio downloads or licensing issues)
 * - Evolving deep-space pad (open A chord, 110-330 Hz) that small laptop and
 *   phone speakers can actually reproduce
 * - Quiet 55 / 55.4 Hz binaural sub-bass for headphones
 * - LFO-swept pink-noise solar wind swell and a faint high shimmer
 * - Limiter on the output so no volume setting clips
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

      // 1. Master chain: gain -> gentle limiter -> speakers. The limiter keeps
      //    the summed layers from clipping at 100% volume.
      masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.setValueAtTime(-14, ctx.currentTime);
      limiter.knee.setValueAtTime(8, ctx.currentTime);
      limiter.ratio.setValueAtTime(6, ctx.currentTime);
      limiter.attack.setValueAtTime(0.02, ctx.currentTime);
      limiter.release.setValueAtTime(0.4, ctx.currentTime);
      masterGain.connect(limiter);
      limiter.connect(ctx.destination);

      const nodes = [];
      const osc = (type, freq) => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(freq, ctx.currentTime);
        nodes.push(o);
        return o;
      };
      const lfo = (rate, depth, target) => {
        const l = osc("sine", rate);
        const g = ctx.createGain();
        g.gain.setValueAtTime(depth, ctx.currentTime);
        l.connect(g);
        g.connect(target);
        return l;
      };

      // 2. Deep-space pad: an open A chord (A2, E3, A3, E4) where most small
      //    speakers can reproduce it. Each note is a pair of detuned voices,
      //    so it slowly shimmers; a lowpass whose cutoff drifts on a slow LFO
      //    makes the timbre breathe. The original design was a 55/110 Hz drone
      //    alone, which laptop and phone speakers cannot play at all.
      const padFilter = ctx.createBiquadFilter();
      padFilter.type = "lowpass";
      padFilter.frequency.setValueAtTime(900, ctx.currentTime);
      padFilter.Q.setValueAtTime(0.9, ctx.currentTime);
      const padGain = ctx.createGain();
      padGain.gain.setValueAtTime(0.16, ctx.currentTime);
      padFilter.connect(padGain);
      padGain.connect(masterGain);
      lfo(0.045, 450, padFilter.frequency); // ~22 s filter sweep

      const PAD_NOTES = [
        { freq: 110.0, level: 0.9 },
        { freq: 164.81, level: 0.7 },
        { freq: 220.0, level: 0.55 },
        { freq: 329.63, level: 0.3 },
      ];
      PAD_NOTES.forEach(({ freq, level }, i) => {
        const voiceGain = ctx.createGain();
        voiceGain.gain.setValueAtTime(level, ctx.currentTime);
        voiceGain.connect(padFilter);
        // Slow, out-of-phase swells so the chord never sits still.
        lfo(0.03 + i * 0.011, level * 0.35, voiceGain.gain);
        for (const detune of [-4, 4]) {
          const v = osc(i === 0 ? "triangle" : "sine", freq);
          v.detune.setValueAtTime(detune + i, ctx.currentTime);
          v.connect(voiceGain);
        }
      });

      // 3. Sub-bass: the original 55 Hz binaural pair (0.4 Hz beat), kept
      //    quiet. Felt on headphones; harmless where speakers can't play it.
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.12, ctx.currentTime);
      subGain.connect(masterGain);
      osc("sine", 55.0).connect(subGain);
      osc("sine", 55.4).connect(subGain);

      // 4. Solar wind: pink noise (Paul Kellet's filter) in a 4 s loop,
      //    band-passed in the mid range and swept by a slow LFO.
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
      nodes.push(noiseSource);

      const windFilter = ctx.createBiquadFilter();
      windFilter.type = "bandpass";
      windFilter.frequency.setValueAtTime(700, ctx.currentTime);
      windFilter.Q.setValueAtTime(0.8, ctx.currentTime);
      lfo(0.075, 380, windFilter.frequency); // ~13 s gust cycle

      const windGain = ctx.createGain();
      windGain.gain.setValueAtTime(1.1, ctx.currentTime);
      lfo(0.05, 0.45, windGain.gain); // swells in and out

      noiseSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(masterGain);

      // 5. Shimmer: a faint high A (880 Hz) with a slow tremolo, like distant
      //    starlight. Very low so it never becomes a whistle.
      const shimmerGain = ctx.createGain();
      shimmerGain.gain.setValueAtTime(0.012, ctx.currentTime);
      shimmerGain.connect(masterGain);
      const shimmer = osc("sine", 880);
      shimmer.detune.setValueAtTime(3, ctx.currentTime);
      shimmer.connect(shimmerGain);
      lfo(0.11, 0.01, shimmerGain.gain);

      nodes.forEach((n) => n.start());

      isInitialized = true;
      engineRef.current = { ctx, masterGain, nodes };
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
