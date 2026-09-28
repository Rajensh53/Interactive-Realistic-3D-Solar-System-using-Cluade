import { test, expect } from "@playwright/test";
import { startApp, waitForPhase } from "./helpers.js";

/**
 * Following a moving body must keep it locked on screen every frame.
 *
 * Textures are delayed on purpose: the scene then mounts behind its Suspense
 * fallback, after the camera controller, which is the mount order that once
 * made the camera follow each body's *previous-frame* position. At true scale
 * Earth moves ~2.3 u per frame against a 0.18 u framing distance, so that lag
 * threw the planet across (and off) the screen.
 */
test.describe("Camera follow lock", () => {
  test("focused body stays centred every frame in both scale modes", async ({ page }) => {
    await page.route(/\.(jpe?g|png|webp)(\?.*)?$/i, async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });
    const errors = await startApp(page);

    for (const mode of ["compact", "true"]) {
      await page.evaluate((m) => window.__solar.setScaleMode(m), mode);
      await waitForPhase(page, "idle");

      for (const id of ["earth", "moon"]) {
        // Not selectBody(): its settle check is the very thing under test, and
        // a failure here should report the measured gap, not a timeout.
        await page.evaluate((i) => window.__solar.select(i), id);
        await page.waitForFunction(
          (i) => window.__solar.getCameraPhase() === "following" && window.__solar.getSelected() === i,
          id,
        );

        const worst = await page.evaluate(async (i) => {
          let gap = 0;
          let px = 0;
          for (let k = 0; k < 60; k++) {
            await new Promise((res) => requestAnimationFrame(res));
            const entry = window.__solar.registry.get(i);
            const e = entry.object3D.matrixWorld.elements;
            const t = window.__solarRender.pivot();
            gap = Math.max(gap, Math.hypot(t[0] - e[12], t[1] - e[13], t[2] - e[14]) / entry.radius);
            const p = window.__solarRender.project(i);
            const canvas = document.querySelector("canvas");
            px = Math.max(px, Math.hypot(p.x - canvas.clientWidth / 2, p.y - canvas.clientHeight / 2));
          }
          return { gapInRadii: gap, offCentrePx: px };
        }, id);

        expect(worst.gapInRadii, `${id} pivot stays on the body (${mode})`).toBeLessThan(1e-3);
        expect(worst.offCentrePx, `${id} stays centred on screen (${mode})`).toBeLessThan(1);

        await page.evaluate(() => window.__solar.clearSelection());
        await waitForPhase(page, "idle");
      }
    }
    expect(errors).toEqual([]);
  });
});
