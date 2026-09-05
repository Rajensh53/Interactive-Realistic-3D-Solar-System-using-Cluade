import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { bodyRegistry } from "../../utils/planetUtils.js";

/**
 * Dev-only probe mounted inside the Canvas.
 *
 * R3F v9 keeps its store private, so this is how the outside world gets at the
 * renderer: it counts frames from *inside* the render loop, which makes frame
 * timing observable even when `requestAnimationFrame` is throttled (a hidden
 * tab, a headless probe) and rAF-based measurement reads zero.
 *
 * Not rendered in production — see the `import.meta.env.DEV` guard in App.jsx.
 */
export default function DevProbe() {
  const { gl, scene, camera, controls, invalidate } = useThree();

  useEffect(() => {
    // Written by useFrame below, read by stats(). Kept in one place so the
    // writer and reader can't drift apart.
    const stats = { frames: 0, deltas: [] };

    window.__solarRender = {
      _stats: stats,

      /** Frames drawn since mount, plus recent frame times in ms. */
      stats: () => {
        const d = [...stats.deltas].sort((a, b) => a - b);
        return {
          frames: stats.frames,
          samples: d.length,
          medianFrameMs: d.length ? +d[Math.floor(d.length / 2)].toFixed(2) : null,
          p95FrameMs: d.length ? +d[Math.floor(d.length * 0.95)].toFixed(2) : null,
          worstFrameMs: d.length ? +d[d.length - 1].toFixed(2) : null,
          estimatedFps: d.length
            ? +(1000 / d[Math.floor(d.length / 2)]).toFixed(1)
            : null,
        };
      },

      /** Discard collected timings and start a fresh measurement window. */
      resetStats: () => {
        stats.frames = 0;
        stats.deltas.length = 0;
      },

      /** GPU-side cost of the last drawn frame. */
      renderInfo: () => ({
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        points: gl.info.render.points,
        lines: gl.info.render.lines,
        programs: gl.info.programs?.length ?? null,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        pixelRatio: gl.getPixelRatio(),
        drawingBuffer: `${gl.domElement.width}x${gl.domElement.height}`,
      }),

      /** Scene-graph census — counts what actually made it into the tree. */
      sceneCensus: () => {
        let meshes = 0;
        let points = 0;
        let lines = 0;
        let lights = 0;
        let totalPoints = 0;
        scene.traverse((o) => {
          if (o.isMesh) meshes++;
          if (o.isPoints) {
            points++;
            totalPoints += o.geometry?.attributes?.position?.count ?? 0;
          }
          if (o.isLine) lines++;
          if (o.isLight) lights++;
        });
        return { meshes, pointClouds: points, starCount: totalPoints, lines, lights };
      },

      camera: () => ({
        position: camera.position.toArray().map((n) => +n.toFixed(2)),
        fov: camera.fov,
        near: camera.near,
        far: camera.far,
      }),

      /**
       * Measure a rendered orbit line straight off its GPU buffer.
       *
       * This is the real proof the ellipses are drawn Sun-at-focus: the traced
       * radius must swing between a(1−e) and a(1+e), and the geometric centre
       * must sit `a·e` off the origin.
       */
      measureOrbit: (id) => {
        const line = scene.getObjectByName(`orbit-${id}`);
        if (!line) return { error: `orbit-${id} not in scene` };
        const p = line.geometry.attributes.position;
        let min = Infinity;
        let max = -Infinity;
        let sumX = 0;
        let sumZ = 0;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i);
          const z = p.getZ(i);
          const r = Math.hypot(x, z);
          if (r < min) min = r;
          if (r > max) max = r;
          sumX += x;
          sumZ += z;
        }
        return {
          id,
          points: p.count,
          perihelion: +min.toFixed(3),
          aphelion: +max.toFixed(3),
          spread: +(max - min).toFixed(3),
          centreOffsetX: +(sumX / p.count).toFixed(3),
          centreOffsetZ: +(sumZ / p.count).toFixed(3),
          visible: line.visible,
          opacity: line.material.opacity,
        };
      },

      /**
       * Synchronous render benchmark.
       *
       * `requestAnimationFrame` is throttled whenever the window loses focus,
       * which makes frame *rate* unmeasurable from a probe. Frame *cost* is
       * still measurable: render back-to-back N times, then force the GPU to
       * drain with a `readPixels` stall, which blocks until the work has
       * actually finished rather than merely been queued.
       *
       * Covers the base scene pass only — the postprocessing composer sits
       * outside this component's reach — so read the result as a floor on
       * frame cost, not the whole of it.
       */
      benchmark: (n = 120) => {
        const ctx = gl.getContext();
        const px = new Uint8Array(4);

        // Warm up, or shader compilation and buffer uploads would all land on
        // the first sample and skew the mean.
        for (let i = 0; i < 10; i++) gl.render(scene, camera);
        ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px);

        // three.js resets info at the start of every render, so this reads one
        // frame's true cost rather than a running total.
        gl.render(scene, camera);
        const perFrame = {
          drawCalls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
          points: gl.info.render.points,
          lines: gl.info.render.lines,
        };

        const start = performance.now();
        for (let i = 0; i < n; i++) gl.render(scene, camera);
        ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px);
        const total = performance.now() - start;

        return {
          samples: n,
          perFrame,
          msPerFrame: +(total / n).toFixed(3),
          headroomFps: Math.round(1000 / (total / n)),
        };
      },

      /** Force a frame even when the loop is otherwise idle. */
      invalidate,

      /** The live OrbitControls instance — lets a probe relax the distance
          clamps that exist for the user's benefit, not for inspection. */
      controls,

      /**
       * Park the camera beside a body so its shading can actually be looked at.
       *
       * A crude stand-in for the cinematic camera of Phase 5 — it snaps rather
       * than flies — but enough to check a night-side terminator or a ring
       * profile without dragging the mouse by hand.
       *
       * @param {string} id            body id, e.g. "earth"
       * @param {number} distance      offset in body radii
       * @param {[number,number,number]} direction  offset direction, unnormalised
       */
      focus: (id, distance = 4, direction = [0.6, 0.35, 1]) => {
        const entry = bodyRegistry.get(id);
        if (!entry?.object3D) return { error: `${id} not mounted` };

        const target = new THREE.Vector3();
        entry.object3D.getWorldPosition(target);

        const offset = new THREE.Vector3(...direction)
          .normalize()
          .multiplyScalar(entry.radius * distance);

        camera.position.copy(target).add(offset);
        camera.lookAt(target);

        if (controls) {
          controls.target.copy(target);
          controls.update();
        }

        return {
          id,
          target: target.toArray().map((n) => +n.toFixed(2)),
          cameraDistance: +camera.position.distanceTo(target).toFixed(2),
        };
      },
    };

    return () => {
      delete window.__solarRender;
    };
  }, [gl, scene, camera, controls, invalidate]);

  useFrame((_, delta) => {
    const stats = window.__solarRender?._stats;
    if (!stats) return;
    stats.frames++;
    stats.deltas.push(delta * 1000);
    // Keep a rolling ~4 s window at 60 fps.
    if (stats.deltas.length > 240) stats.deltas.shift();
  });

  return null;
}
