import { useEffect, useRef, useState } from "react";
import { useProgress } from "@react-three/drei";
import { AnimatePresence, motion } from "motion/react";

/**
 * The first thing anyone sees.
 *
 * The percentage is real: every texture is loaded through three.js's default
 * loading manager, which is what drei's `useProgress` reports on. No fake timer.
 *
 * Two guards on top of the raw number:
 *  - it is clamped monotonic, because the manager's count can dip when a batch
 *    of items is registered and a progress bar that goes backwards looks broken;
 *  - it only reads 100% once the scene has actually mounted, so the bar filling
 *    and the world appearing are the same moment rather than two.
 */
export default function LoadingScreen({ ready }) {
  const { progress, item } = useProgress();
  const [shown, setShown] = useState(0);
  const [visible, setVisible] = useState(true);
  const peak = useRef(0);

  useEffect(() => {
    // Hold at 99 until the scene reports in; the last point belongs to the
    // first rendered frame, not to the last byte downloaded.
    const target = ready ? 100 : Math.min(progress, 99);
    if (target > peak.current) {
      peak.current = target;
      setShown(target);
    }
  }, [progress, ready]);

  useEffect(() => {
    if (!ready) return undefined;
    // Dismissal is deliberately one beat behind `ready`. Unmounting on the same
    // commit that sets 100% would leave AnimatePresence fading out the tree it
    // captured *before* that state landed — so the counter would visibly stop
    // at 99 and the bar would never finish filling.
    const timer = setTimeout(() => setVisible(false), 450);
    return () => clearTimeout(timer);
  }, [ready]);

  // Kept mounted through the fade so the exit animation has something to run on.
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="loading"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-space-950 px-6"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <h1 className="label-caps text-center text-sm text-ink-100 sm:text-base">
            Solar System
          </h1>

          <p className="mt-3 text-center text-[0.7rem] tracking-[0.28em] text-ink-500 uppercase sm:text-xs">
            Initializing space environment…
          </p>

          <div
            className="mt-10 h-px w-full max-w-sm overflow-hidden bg-white/10"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(shown)}
            aria-label="Loading assets"
          >
            <motion.div
              className="h-full bg-accent-400"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: shown / 100 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              style={{ transformOrigin: "left" }}
            />
          </div>

          <p className="font-display mt-5 text-2xl text-ink-100 tabular-nums">
            {Math.round(shown)}%
          </p>

          {/* The filename is only useful while something is still in flight. */}
          <p className="mt-2 h-4 max-w-full truncate text-[0.65rem] text-ink-500/70">
            {shown < 100 && item ? item.split("/").pop() : ""}
          </p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
