import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";

import { usePlanetStore } from "./usePlanetStore.js";
import { setAnisotropy } from "../utils/textureUtils.js";

/**
 * Performance & Adaptive Quality Tier Configurations
 *
 * Spec §22:
 * Gracefully scales rendering load to maintain a rock-solid 60 FPS target
 * across devices ranging from high-end desktop GPUs to mobile phones.
 */
export const TIER_CONFIG = {
  high: {
    name: "High",
    dpr: [1, 2.0],
    starCount: 10000,
    dustCount: 2000,
    nebulaShells: 2,
    enableDoF: true,
    anisotropy: 8,
    bloomMipmapBlur: true,
  },
  medium: {
    name: "Medium",
    dpr: [1, 1.75],
    starCount: 6000,
    dustCount: 1200,
    nebulaShells: 2,
    enableDoF: false,
    anisotropy: 4,
    bloomMipmapBlur: true,
  },
  low: {
    name: "Low",
    dpr: [1, 1.25],
    starCount: 3000,
    dustCount: 500,
    nebulaShells: 1,
    enableDoF: false,
    anisotropy: 2,
    bloomMipmapBlur: false,
  },
};

/**
 * Detects initial capability tier based on hardware concurrency, memory,
 * mobile user agent, or explicit URL parameter override (?quality=low|medium|high).
 */
export function detectInitialTier() {
  if (typeof window === "undefined") return "high";

  // 1. Check URL query override (?quality=high|medium|low)
  const params = new URLSearchParams(window.location.search);
  const qOverride = params.get("quality")?.toLowerCase();
  if (qOverride && TIER_CONFIG[qOverride]) {
    return qOverride;
  }

  // 2. Mobile User Agent & screen width detection
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    ) || window.innerWidth < 768;

  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;

  if (isMobile || cores <= 2 || memory <= 2) {
    return "low";
  }

  if (cores <= 4 || memory <= 4) {
    return "medium";
  }

  return "high";
}

/**
 * QualityMonitor Component
 *
 * Sits inside the Canvas render loop without causing React re-renders.
 * Continuously monitors frame time delta over a rolling 120-frame buffer.
 * If sustained frame duration exceeds 22ms (< 45 FPS), it gracefully steps
 * down the quality tier (High -> Medium -> Low).
 */
export function QualityMonitor() {
  const frameBufferRef = useRef([]);
  const frameCountRef = useRef(0);

  // Initialize initial tier on mount
  useEffect(() => {
    const initialTier = detectInitialTier();
    const currentTier = usePlanetStore.getState().qualityTier;

    if (currentTier !== initialTier) {
      usePlanetStore.getState().setQualityTier(initialTier);
      setAnisotropy(TIER_CONFIG[initialTier].anisotropy);
    }
  }, []);

  useFrame((_, delta) => {
    // Collect delta samples (clamped to realistic range)
    if (delta > 0.001 && delta < 0.2) {
      const buffer = frameBufferRef.current;
      buffer.push(delta * 1000); // in ms
      frameCountRef.current++;

      // Keep sliding window of 120 frames
      if (buffer.length > 120) {
        buffer.shift();
      }

      // Every 120 frames (approx 2 to 3 seconds), evaluate performance
      if (frameCountRef.current >= 120 && buffer.length >= 60) {
        frameCountRef.current = 0;

        const sum = buffer.reduce((acc, v) => acc + v, 0);
        const avgFrameMs = sum / buffer.length;

        const currentTier = usePlanetStore.getState().qualityTier;

        // Threshold: > 22ms per frame corresponds to < 45 FPS
        if (avgFrameMs > 22.0) {
          if (currentTier === "high") {
            console.warn(
              `[QualityMonitor] Avg frame time ${avgFrameMs.toFixed(1)}ms (>22ms) detected. Gracefully stepping down to Medium tier.`,
            );
            usePlanetStore.getState().setQualityTier("medium");
            setAnisotropy(TIER_CONFIG.medium.anisotropy);
            buffer.length = 0; // Reset buffer to let new tier settle
          } else if (currentTier === "medium") {
            console.warn(
              `[QualityMonitor] Avg frame time ${avgFrameMs.toFixed(1)}ms (>22ms) detected. Gracefully stepping down to Low tier.`,
            );
            usePlanetStore.getState().setQualityTier("low");
            setAnisotropy(TIER_CONFIG.low.anisotropy);
            buffer.length = 0;
          }
        }
      }
    }
  });

  return null;
}
