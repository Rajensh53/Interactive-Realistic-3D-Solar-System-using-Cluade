import { Component } from "react";

/**
 * Fallback screens for the failure modes that would otherwise show the user a
 * black void: no WebGL support, a crash inside the 3D scene, and the GPU
 * context being lost mid-session.
 */

/**
 * React Error Boundary specifically guarding the 3D scene and WebGL Canvas.
 */
export class SceneErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(
      "[SceneErrorBoundary] Uncaught exception in 3D scene:",
      error,
      errorInfo,
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return <SceneError onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

/**
 * Feature-detect WebGL without leaking a context.
 * Creates a throwaway canvas, asks for a context, then releases it.
 */
export function isWebGLAvailable() {
  if (typeof window === "undefined") return false;

  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");

    if (!gl) return false;

    // Free the context immediately — browsers cap concurrent WebGL contexts.
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function Shell({ title, children, overlay = false }) {
  return (
    <div
      role="alert"
      className={
        overlay
          ? "fixed inset-0 z-40 flex items-center justify-center bg-space-950/80 p-6 backdrop-blur-sm"
          : "flex h-full w-full items-center justify-center bg-space-950 p-6"
      }
    >
      <div className="glass-panel max-w-md rounded-2xl px-8 py-10 text-center">
        <p className="label-caps mb-3">System notice</p>
        <h1 className="mb-4 text-xl text-ink-100">{title}</h1>
        <div className="space-y-4 text-sm leading-relaxed text-ink-300">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Shown when the browser/GPU cannot render WebGL at all. */
export function WebGLUnavailable() {
  return (
    <Shell title="3D graphics unavailable">
      <p>
        This experience needs WebGL, which your browser or graphics driver
        isn&apos;t providing right now.
      </p>
      <p>
        Try a recent version of Chrome, Edge, Firefox or Safari, and make sure
        hardware acceleration is enabled in your browser settings.
      </p>
    </Shell>
  );
}

/**
 * Shown over the scene while the WebGL context is lost (GPU reset, driver
 * update, too many 3D tabs). three.js rebuilds everything if the browser
 * restores the context, and the notice then disappears on its own; if it never
 * comes back, reloading is the way out.
 */
export function ContextLostNotice() {
  return (
    <Shell title="Graphics were interrupted" overlay>
      <p>
        The graphics driver reset, so the 3D view paused. It usually comes back
        on its own in a moment.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-2 rounded-full border border-white/15 px-5 py-2 font-display text-xs tracking-[0.2em] text-ink-100 uppercase transition-colors hover:border-accent-400/60 hover:text-accent-300"
      >
        Reload
      </button>
    </Shell>
  );
}

/** Shown when the 3D scene throws after a successful start. */
export function SceneError({ onRetry }) {
  return (
    <Shell title="The scene failed to load">
      <p>
        Something went wrong while building the Solar System. Reloading usually
        clears it.
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-full border border-white/15 px-5 py-2 font-display text-xs tracking-[0.2em] text-ink-100 uppercase transition-colors hover:border-accent-400/60 hover:text-accent-300"
        >
          Try again
        </button>
      ) : null}
    </Shell>
  );
}
