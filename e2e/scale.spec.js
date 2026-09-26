import { test, expect } from "@playwright/test";
import { startApp, waitForPhase } from "./helpers.js";

test.describe("Compact ↔ True Scale", () => {
  test("toggle keeps every body on its orbit and every moon outside its planet", async ({ page }) => {
    const errors = await startApp(page, { time: 20 });
    const toggle = page.getByRole("button", { name: "Toggle true scale" });

    for (const mode of ["true", "compact"]) {
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", String(mode === "true"));
      await waitForPhase(page, "idle");
      expect(await page.evaluate(() => window.__solar.getSettings().scaleMode)).toBe(mode);

      const report = await page.evaluate(() => ({
        positions: window.__solar.verifyPositions(),
        moons: window.__solar.verifyMoons(),
        radii: Object.fromEntries([...window.__solar.registry].map(([id, e]) => [id, e.radius])),
        nan: window.__solar.findNaN(),
      }));

      expect(report.nan).toEqual([]);
      for (const p of report.positions) {
        expect(p.mounted, `${p.id} mounted`).toBe(true);
        expect(p.drift, `${p.id} sits exactly on its orbit (${mode})`).toBeLessThan(1e-6);
      }
      for (const m of report.moons) {
        expect(m.mounted, `${m.id} mounted`).toBe(true);
        expect(Math.abs(m.distanceFromParent - m.expected), `${m.id} at its orbit radius (${mode})`).toBeLessThan(1e-3);
        expect(m.distanceFromParent, `${m.id} orbits outside ${m.parent} (${mode})`).toBeGreaterThan(report.radii[m.parent]);
      }
    }
    expect(errors).toEqual([]);
  });
});
