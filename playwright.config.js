import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests. They drive the real app through the dev-only inspection
 * handles (`window.__solar`, `window.__solarRender`), so they run against the
 * Vite dev server — those handles are stripped from production builds.
 *
 * 3 engines × 3 viewports. Headless browsers usually render WebGL in software
 * (SwiftShader / llvmpipe), so waits are driven by app state (camera phase,
 * selection) rather than fixed sleeps.
 */
const PORT = 5173;

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  tablet: { viewport: { width: 768, height: 1024 }, hasTouch: true },
  phone: { viewport: { width: 390, height: 844 }, hasTouch: true },
};

/**
 * Windows Smart App Control blocks Playwright's unsigned Firefox build
 * (Code Integrity event 3077 on mozglue.dll), so Firefox projects are opt-in
 * on Windows: E2E_FIREFOX=1. They always run elsewhere (e.g. Linux CI).
 */
const RUN_FIREFOX = process.platform !== "win32" || process.env.E2E_FIREFOX === "1";

/**
 * Headless Chromium renders WebGL in software (SwiftShader) by default:
 * measured ~300 ms/frame for this scene with 3 parallel browsers, close to
 * GSAP's 500 ms lag-smoothing threshold, beyond which camera flights crawl and
 * tests time out. On Windows use the real GPU through ANGLE/Direct3D 11
 * (measured 17 ms/frame); elsewhere (Linux CI) keep SwiftShader.
 */
const CHROMIUM_GL_ARGS =
  process.platform === "win32" ? ["--use-angle=d3d11"] : ["--enable-unsafe-swiftshader"];

const ENGINES = {
  chromium: {
    ...devices["Desktop Chrome"],
    launchOptions: { args: ["--ignore-gpu-blocklist", ...CHROMIUM_GL_ARGS] },
  },
  ...(RUN_FIREFOX && {
    firefox: {
      ...devices["Desktop Firefox"],
      launchOptions: { firefoxUserPrefs: { "webgl.force-enabled": true } },
    },
  }),
  webkit: { ...devices["Desktop Safari"] },
};

export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: process.env.CI ? 1 : 3,
  // One retry everywhere: WebGL timing under parallel load produces rare
  // one-off failures (≈2 of 54 in one of four full local runs, not
  // reproducible in isolation). Retried tests are reported as "flaky", so they
  // stay visible rather than hidden.
  retries: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: Object.entries(ENGINES).flatMap(([engine, engineUse]) =>
    Object.entries(VIEWPORTS).map(([size, sizeUse]) => ({
      name: `${engine}-${size}`,
      // The device presets carry their own viewport; ours must win.
      use: { ...engineUse, ...sizeUse, deviceScaleFactor: 1 },
    })),
  ),
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
