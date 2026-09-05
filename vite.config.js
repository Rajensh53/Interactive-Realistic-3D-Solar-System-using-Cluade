import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: "es2022",
    // Three.js + drei produce a large but unavoidable vendor chunk.
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // `codeSplitting` is Rolldown's own splitting API, and since Vite 8.2
        // the name it wants — it warns on the older `advancedChunks` spelling.
        // Rollup's `manualChunks` is a different thing again: the compatibility
        // shim runs without error but silently folds these groups back
        // together, so the split it describes never actually happens — verified
        // by grepping the built chunks for three.js symbols.
        //
        // Splitting the heavy, rarely-changing 3D vendor code away from app
        // code means editing a component doesn't invalidate ~1MB of cache.
        codeSplitting: {
          groups: [
            { name: "three", test: /node_modules[\\/]three[\\/]/ },
            { name: "r3f", test: /node_modules[\\/]@react-three[\\/]/ },
            {
              name: "postfx",
              test: /node_modules[\\/](postprocessing|gsap)[\\/]/,
            },
            { name: "react", test: /node_modules[\\/]react(-dom)?[\\/]/ },
          ],
        },
      },
    },
  },
});
