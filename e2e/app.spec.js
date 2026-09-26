import { test, expect } from "@playwright/test";
import { BODIES, MOONS, startApp, selectBody, expectCleanPanel, detailsPanel, waitForPhase, waitForFocus } from "./helpers.js";

test.describe("loading & selection", () => {
  test("app loads with no console errors", async ({ page }) => {
    const errors = await startApp(page);
    await expect(page.locator("canvas")).toBeVisible();
    const hasGL = await page.evaluate(() => {
      const c = document.querySelector("canvas");
      return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
    });
    expect(hasGL, "canvas has a WebGL context").toBe(true);
    expect(await page.evaluate(() => window.__solar.findNaN())).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("every body can be selected and shows real data", async ({ page }) => {
    test.slow(); // 15 camera flights in a row
    const errors = await startApp(page);
    for (const id of BODIES) {
      await selectBody(page, id);
      await expectCleanPanel(page, id);
    }
    for (const id of MOONS) {
      await selectBody(page, id);
      await expectCleanPanel(page, id);
    }
    expect(errors).toEqual([]);
  });

  test("the planet rail selects bodies", async ({ page }, testInfo) => {
    const errors = await startApp(page);
    await page.getByRole("button", { name: "Select Mars" }).click();
    await waitForFocus(page, "mars");
    await expectCleanPanel(page, "mars");
    // On phones the panel is full-screen; close it before using the rail again.
    if (testInfo.project.name.endsWith("phone")) {
      await detailsPanel(page).getByRole("button", { name: "Close panel" }).click();
      await waitForPhase(page, "idle");
    }
    await page.getByRole("button", { name: "Select Neptune" }).click();
    await waitForFocus(page, "neptune");
    await expectCleanPanel(page, "neptune");
    expect(errors).toEqual([]);
  });
});
