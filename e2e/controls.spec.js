import { test, expect } from "@playwright/test";
import { startApp, selectBody, waitForPhase, waitForFocus, detailsPanel } from "./helpers.js";

const speeds = (page) => page.evaluate(() => window.__solar.getSpeeds());
const blur = (page) => page.evaluate(() => document.activeElement?.blur());

test.describe("time & keyboard controls", () => {
  test("Space pauses and resumes both clocks", async ({ page }) => {
    const errors = await startApp(page);
    await blur(page);
    await page.keyboard.press("Space");
    expect((await speeds(page)).paused).toBe(true);
    const t0 = (await speeds(page)).clock;
    await page.waitForTimeout(600);
    const t1 = (await speeds(page)).clock;
    expect(t1.time).toBe(t0.time);
    expect(t1.spinTime).toBe(t0.spinTime);

    await page.keyboard.press("Space");
    expect((await speeds(page)).paused).toBe(false);
    await page.waitForTimeout(600);
    expect((await speeds(page)).clock.time).toBeGreaterThan(t1.time);
    expect(errors).toEqual([]);
  });

  test("[ and ] halve / double orbit speed; speed panel presets and reset work", async ({ page }) => {
    const errors = await startApp(page);
    await blur(page);
    await page.keyboard.press("]");
    expect((await speeds(page)).orbitSpeed).toBe(2);
    await page.keyboard.press("[");
    await page.keyboard.press("[");
    expect((await speeds(page)).orbitSpeed).toBe(0.5);
    expect((await speeds(page)).rotationSpeed).toBe(1);

    const speedButton = page.locator('button[aria-haspopup="dialog"]');
    await speedButton.click();
    const panel = page.getByRole("dialog", { name: "Speed controls" });
    await panel.getByRole("button", { name: "5×", exact: true }).click();
    await expect(speedButton).toContainText("5.0×");
    await panel.getByRole("button", { name: "Reset" }).click();
    expect(await speeds(page)).toMatchObject({ orbitSpeed: 1, rotationSpeed: 1, paused: false });
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    expect(errors).toEqual([]);
  });

  test("← / → cycle bodies and Esc returns to the overview", async ({ page }) => {
    const errors = await startApp(page);
    await selectBody(page, "mars");
    await blur(page);

    await page.keyboard.press("ArrowRight");
    await waitForFocus(page, "jupiter");

    await page.keyboard.press("ArrowLeft");
    await waitForFocus(page, "mars");

    await page.keyboard.press("Escape");
    await waitForPhase(page, "idle");
    expect(await page.evaluate(() => window.__solar.getSelected())).toBe(null);
    await expect(detailsPanel(page)).toBeHidden();
    expect(errors).toEqual([]);
  });
});
