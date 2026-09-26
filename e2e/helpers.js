import { expect } from "@playwright/test";

export const BODIES = ["sun", "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"];
export const MOONS = ["moon", "io", "europa", "ganymede", "callisto", "titan"];

/**
 * Console messages that are not app errors: the THREE.Clock deprecation is a
 * warning emitted inside @react-three/fiber (see PRODUCTION_AUDIT.md).
 */
const IGNORED = [/THREE\.Clock/];

/**
 * Load the app, pass the welcome screen and wait until the scene is live.
 * Returns an array that collects every console error / page error.
 * @param {import('@playwright/test').Page} page
 */
export async function startApp(page, { pause = false, time } = {}) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !IGNORED.some((re) => re.test(m.text()))) errors.push(m.text());
  });

  await page.goto("/");
  await page.waitForFunction(() => window.__solar && window.__solarRender, null, { timeout: 90_000 });
  const start = page.getByRole("button", { name: /start exploring/i });
  await expect(start).toBeVisible({ timeout: 90_000 });
  await start.click();
  await expect(page.getByRole("navigation", { name: "Planet navigation rail" })).toBeVisible();
  await waitForPhase(page, "idle");
  // The welcome overlay fades out; until it is gone it sits over the canvas and
  // swallows pointer/wheel input (slow software-WebGL engines make this visible).
  await expect(start).toBeHidden();
  await page.waitForFunction(() => {
    const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    return el?.tagName === "CANVAS";
  });

  if (pause || time !== undefined) {
    await page.evaluate((t) => {
      window.__solar.pause();
      if (t !== undefined) window.__solar.setTime(t);
    }, time);
  }
  return errors;
}

/** Camera state for timeout diagnostics. */
const cameraState = (page) =>
  page
    .evaluate(() => ({
      phase: window.__solar.getCameraPhase(),
      selected: window.__solar.getSelected(),
      pivot: window.__solarRender.pivot(),
    }))
    .catch((e) => ({ unavailable: e.message }));

/** Wait until the camera state machine reaches `phase`. */
export async function waitForPhase(page, phase, timeout = 30_000) {
  try {
    await page.waitForFunction((p) => window.__solar.getCameraPhase() === p, phase, { timeout });
  } catch (e) {
    throw new Error(`camera never reached "${phase}": ${JSON.stringify(await cameraState(page))}`, { cause: e });
  }
}

/**
 * Wait until the camera is following *this* body: phase "following", the body
 * selected, and the orbit pivot on its centre. Checking the phase alone is a
 * race — right after a new selection the camera can still be "following" the
 * previous body for a frame before the new flight starts.
 */
export async function waitForFocus(page, id, timeout = 30_000) {
  try {
    await page.waitForFunction(
      (i) => {
        if (window.__solar.getCameraPhase() !== "following" || window.__solar.getSelected() !== i) return false;
        const entry = window.__solar.registry.get(i);
        const e = entry?.object3D?.matrixWorld.elements;
        const t = window.__solarRender.pivot();
        if (!e || !t) return false;
        return Math.hypot(t[0] - e[12], t[1] - e[13], t[2] - e[14]) <= Math.max(entry.radius, 1e-3) * 1e-3;
      },
      id,
      { timeout },
    );
  } catch (e) {
    throw new Error(`camera never settled on "${id}": ${JSON.stringify(await cameraState(page))}`, { cause: e });
  }
}

/** Select a body through the app store and wait for the camera to settle on it. */
export async function selectBody(page, id) {
  await page.evaluate((i) => window.__solar.select(i), id);
  await waitForFocus(page, id);
}

export const detailsPanel = (page) => page.locator("aside[role=dialog]");

/** Text shown in the details panel must not contain broken values. */
export async function expectCleanPanel(page, name) {
  const panel = detailsPanel(page);
  await expect(panel.locator("h2")).toHaveText(new RegExp(`^${name}$`, "i"));
  const text = await panel.innerText();
  expect(text, "panel shows no broken values").not.toMatch(/\b(undefined|NaN|null|\[object Object\])\b/);
  // Real data is present: diameter in km and at least one quick fact.
  expect(text).toMatch(/Diameter[\s\S]*\d[\d,]* km/i);
  expect(text).toMatch(/Quick Facts/i);
}

/** Camera distance to a body's centre, in body radii (exact, unrounded). */
export async function distanceInRadii(page, id) {
  const p = await page.evaluate((i) => window.__solarRender.project(i), id);
  return p.distance / p.radius;
}
