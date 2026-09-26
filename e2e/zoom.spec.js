import { test, expect } from "@playwright/test";
import { startApp, waitForPhase, waitForFocus } from "./helpers.js";

/** Minimum distances the zoom guarantees, in body radii (useCursorZoom.js). */
const GUARD = { default: 1.25, sun: 1.6 };
/**
 * Three notches per wheel event (1.2³ ≈ 1.73× closer). Headless browsers render
 * WebGL in software, where every wheel round-trip is slow, so fewer, larger
 * steps cover the same zoom range in reasonable time.
 */
const STEP = -300;

async function screenPos(page, id) {
  return page.evaluate((i) => window.__solarRender.project(i), id);
}

/**
 * Wheel toward a body until it is focused (or `max` notches), recording the
 * closest the camera ever gets to its centre, in radii.
 */
async function zoomOnto(page, id, max) {
  const p = await screenPos(page, id);
  await page.mouse.move(p.x, p.y);
  let closest = Infinity;
  let moved = false;
  for (let i = 0; i < max; i++) {
    // Once the body is auto-focused its details panel opens and may cover the
    // cursor (wheel over UI is ignored by design). While following, the zoom
    // ignores the cursor position, so continue over uncovered canvas at the
    // left edge (the panel keeps a 16 px margin).
    if (!moved && (await page.evaluate(() => window.__solar.getSelected())) === id) {
      await page.mouse.move(4, p.y);
      moved = true;
    }
    await page.mouse.wheel(0, STEP);
    await page.waitForTimeout(60);
    const q = await screenPos(page, id);
    closest = Math.min(closest, q.distance / q.radius);
  }
  await page.waitForTimeout(800);
  const q = await screenPos(page, id);
  return Math.min(closest, q.distance / q.radius);
}

test.describe("cursor zoom", () => {
  test("the camera never ends up inside a body (compact)", async ({ page }) => {
    test.slow();
    const errors = await startApp(page, { time: 20 });
    for (const id of ["saturn", "sun"]) {
      const closest = await zoomOnto(page, id, 20);
      expect(closest, `${id}: camera stays outside`).toBeGreaterThanOrEqual((GUARD[id] ?? GUARD.default) * 0.999);
      // …and the zoom really did close in (framing minimum: Saturn 3.5 R, Sun 2 R).
      expect(closest, `${id}: zoom reached the body`).toBeLessThan(6);
      // Back to the overview for the next body.
      await page.evaluate(() => window.__solar.clearSelection());
      await waitForPhase(page, "idle");
    }
    expect(errors).toEqual([]);
  });

  test("true scale: zooming on a planet's marker focuses it without entering it", async ({ page }) => {
    test.slow();
    const errors = await startApp(page, { time: 20 });
    await page.getByRole("button", { name: "Toggle true scale" }).click();
    await waitForPhase(page, "idle");

    // Portrait phones crop the overview's sides (see PRODUCTION_AUDIT.md), so
    // aim at the first inner planet that is actually on screen.
    const { width, height } = page.viewportSize();
    let target = null;
    let p = null;
    for (const id of ["earth", "venus", "mars", "mercury"]) {
      const q = await screenPos(page, id);
      if (!q.behind && q.x > 20 && q.x < width - 20 && q.y > 80 && q.y < height - 80) {
        target = id;
        p = q;
        break;
      }
    }
    expect(target, "an inner planet is visible in the true-scale overview").not.toBeNull();
    await page.mouse.move(p.x, p.y);
    let closest = Infinity;
    for (let i = 0; i < 40; i++) {
      if ((await page.evaluate(() => window.__solar.getSelected())) === target) break;
      await page.mouse.wheel(0, STEP);
      await page.waitForTimeout(50);
      const q = await screenPos(page, target);
      closest = Math.min(closest, q.distance / q.radius);
    }
    await waitForFocus(page, target);
    expect(closest).toBeGreaterThanOrEqual(GUARD.default * 0.999);
    expect(errors).toEqual([]);
  });
});
