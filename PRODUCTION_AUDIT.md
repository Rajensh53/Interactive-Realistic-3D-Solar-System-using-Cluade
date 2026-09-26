# Production Audit: Interactive Realistic 3D Solar System

**Audit window:** 25–26 Sep 2026 · **Baseline:** `1bcf46a` · **Phases 1–6 committed as:** `ecf8073`, `7bb371e`, `d04e329`, `ee6c79a`, `7daf4ee`, `ce980a7` (Phase 7 changes are uncommitted, ready for your commit)
**Environment:** Windows 11 Home, Node v24.18.0 / npm 11.16.0; browsers Microsoft Edge (Chromium), Playwright Chromium 153, WebKit 26.6 (Firefox 155 installed but blocked on this PC, see L-3).

Every finding below cites a file/line or a command result. Values marked *measured* were measured on the production build (`vite build` + `vite preview`) unless stated otherwise.

---

## 1. Baseline vs final

| Metric | Baseline (`1bcf46a`) | Final |
|---|---|---|
| `npm ci` | 110 packages, 0 vulnerabilities, no peer conflicts | 0 vulnerabilities (prod and dev), no peer conflicts |
| `npm run build` | exit 0, no warnings | exit 0, no warnings |
| JS + CSS (KiB raw / gzip / brotli, level 9 / 11) | 1,516.7 / 425.8 / 344.2 | 1,517.3 / 426.6 / 361.6 ¹ |
| Chunks | three · r3f (React inside) · index · postfx | three · **react** · r3f · index · postfx |
| `dist/` | 8.2 MB, 34 files | 8.3 MB, 37 files (+ robots.txt, og-image.jpg, favicon) |
| Lint | not configured | ESLint 9: **0 errors**, 2 documented warnings |
| `npm run verify:data` | 57/57 | 57/57 |
| Browser tests | none in repo | **54/54** (Chromium + WebKit × 3 viewports); last run 53 passed + 1 flaky (passed on retry) |
| Lighthouse desktop (Perf / A11y / BP / SEO) | 67 / 100 / 100 / 91 | 71 / **100** / **100** / **100** |
| Lighthouse mobile | 46 / 100 / 100 / 91 | 46 / **100** / **100** / **100** |
| axe-core violations (7 UI states) | 2 rule types | **0** |

¹ The brotli increase (+17 KiB) is the cost of the separate React chunk (P4-01). Each chunk compresses on its own, which is less efficient, but React is now cached independently of @react-three updates. gzip is essentially flat (+0.8 KiB).
Lighthouse ran headless (Edge, `vite preview`). Performance scores for a WebGL app are indicative only (see L-1).

---

## 2. Findings

Severity: **Critical / High / Medium / Low / Info**. Status: Fixed · Mitigated · Verified (no issue) · Recommended (needs a decision) · Open · Won't fix.

| ID | Sev | Area | File:line | Problem | Fix applied / recommended | Status |
|---|---|---|---|---|---|---|
| P1-01 | Medium | Robustness | `src/App.jsx` (Canvas `onCreated`) | WebGL context loss left a black canvas with no message (simulated with `WEBGL_lose_context`) | `webglcontextlost` / `restored` listeners and a `ContextLostNotice` overlay (`ErrorFallback.jsx`). Shown on loss, hides itself on restore (verified) | Fixed |
| P1-02 | Low | Logging | `src/hooks/useQualityTier.js:152,160` | `console.info` tier chatter in production | Gated behind `import.meta.env.DEV`. 0 occurrences in `dist` | Fixed |
| P1-03 | Low | Dead export | `src/components/ui/SpeedControls.jsx:31` | `formatSpeed` exported, never imported | Made file-private | Fixed |
| P1-04 | Low | Tooling | `package.json` | No linter | ESLint 9 flat config plus `npm run lint`. `eslint-plugin-react` is needed: core `no-unused-vars` cannot see JSX (60 false positives without it) | Fixed |
| P1-05 | Info | Hooks | `src/components/ui/AboutModal.jsx:15` | exhaustive-deps "unnecessary dependency" | Intentional: re-reads texture failures when the dialog opens | Won't fix |
| P1-06 | Info | DX | `src/components/ui/ErrorFallback.jsx:51` | react-refresh warning (a function exported next to components), dev HMR only | Could move `isWebGLAvailable` to `utils/` | Open (Low) |
| P1-07 | Info | Build | `dist/` | Dev bridge stripped? | `grep -r "__solar" dist/` → 0; no DevProbe/devBridge identifiers | Verified |
| P1-08 | Info | GPU memory | all manually created three.js resources | Leaks? | All disposed on unmount. The `BodyMarker` dot texture is an intentional app-lifetime singleton | Verified |
| P1-09 | Info | Audio | `useAudioEngine.js:37,193,227,253` | Autoplay policy | AudioContext is created inside the click handler, suspended when the tab is hidden, closed on unmount | Verified |
| P1-10 | Low | Battery | `useAudioEngine.js` | Muted audio keeps the AudioContext running at about 0 gain | Recommend `ctx.suspend()` when muted | Recommended |
| P1-11 | Info | State | store + `useFrame` users | Per-frame re-renders? | None: setState only on threshold changes; no object-returning selectors | Verified |
| P1-12 | Info | Fallbacks | `ErrorFallback.jsx`, `textureUtils.js` | No-WebGL and missing-texture paths | No-WebGL screen shown. With every texture blocked the scene still loads and About lists all 14 failed files | Verified |
| P1-13 | Info | Library | `@react-three/fiber` | `THREE.Clock` deprecation warning | Comes from fiber internals, not app code | Open (upstream) |
| P2-01 | Low | Dead file | `src/components/three/SolarFlares.jsx` (7,972 B) | Unused since `134a189` | Deleted (user-approved) | Fixed |
| P2-02 | Low | Dead file | `src/components/three/SelectionRing.jsx` (5,456 B) | Unmounted in `33632da` | Deleted (user-approved) | Fixed |
| P2-03 | Low | Dead file | `src/utils/screenUtils.js` (1,423 B) | Only used by SelectionRing | Deleted (user-approved) | Fixed |
| P2-04 | Low | Dead code | `src/utils/planetUtils.js` `getBody`, `getBodyWorldPosition` | Zero callers | Removed (user-approved) | Fixed |
| P2-05 | Info | Exports | 9 exports (knip) | Exported but only used in their own file | Harmless | Won't fix |
| P2-06 | Info | Deps | `useCameraControls.js:37`, `useCursorZoom.js:64`, `useIdleDrift.js:17` | knip "unlisted three-stdlib" | False positive (JSDoc type import) | Verified |
| P2-07 | Info | Assets | `public/textures/**` | Unused textures? | All 14 referenced (6.5 MB) | Verified |
| P2-08 | Info | Junk | repo | OS/log/backup/duplicate files | None found | Verified |
| P2-09 | Info | Build | `dist/` | `Plans/` or `scripts/` shipped? | Neither | Verified |
| P2-10 | Medium | Git | `.gitignore` | No `.env*` patterns | Added `.env`, `.env.*`, `!.env.example`, test-output dirs, `.claude/` | Fixed |
| P2-11 | Info | Tooling | `.claude/launch.json` | Local tool config tracked in git | Untracked (kept on disk, user-approved) | Fixed |
| P3-01 | Info | Security | `npm audit` | Vulnerabilities | 0 (prod), 0 (all) | Verified |
| P3-02 | Info | Secrets | tree + 17 commits | Keys/tokens | None. All regex hits were false positives; no `.env` ever committed | Verified |
| P3-03 | Info | Deps | `package.json` | dependencies vs devDependencies placement | All correct | Verified |
| P3-04 | Medium | Compat | react 19.2.8, three 0.185.1 | Both sit at the edge of their allowed range | Exact pins. three 0.186 needs postprocessing ≥6.39.5 (now installed). React 19.3 needs fiber ≥9.8.1 (see P3-07) | Mitigated |
| P3-06 | Low | Upgrades | `package.json` | Outdated patch/minor versions | @react-three/postprocessing 3.1.2, postprocessing 6.39.5, motion 13.4.3, vite 8.3.1 (visual diff within the noise floor) | Fixed |
| P3-07 | High (avoided) | Regression | `@react-three/fiber` 9.8.1 | 15× React "synchronously unmount a root while rendering" errors (drei `<Html>` label roots). Bisected: present on 9.8.1, absent on 9.7.0 | Kept 9.7.0. React 19.3 blocked until fiber/drei fix it | Mitigated |
| P3-08 | Info | Upgrades | eslint 10, react-hooks 7, etc. | Dev-tooling majors | Deferred (react-hooks 7 adds React-Compiler rules) | Open |
| P4-01 | Low | Bundle | `vite.config.js:34` | `react` chunk group never produced a chunk: Rolldown `includeDependenciesRecursively` (default true) let `r3f` take React | `priority: 10` on the react group (includes scheduler). Totals unchanged, so no duplication | Fixed |
| P4-02 | High | Payload | `public/textures/**` | 6.54 MB of textures, all preloaded; about 140 MB GPU memory | WebP q85 → 2.75 MB (−58%, measured). 1K WebP for mobile / low tier → 0.75 MB. KTX2 to cut GPU memory | Recommended |
| P4-03 | Medium | Main thread | first frames | 789 ms long task (shader compile + texture upload); bootup 2.8 s desktop / 7.4 s mobile | `renderer.compileAsync`, KTX2, staggered uploads | Recommended |
| P4-04 | Low | Fonts | `src/main.jsx` | Only 5 WOFF2 files requested. Inter 600 never loaded. Orbitron 600/800 requested but not bundled (renders as 700) | Design decision | Recommended |
| P4-05 | Low | JS | three / r3f / index | 170 KiB "unused JS" (library-level) | None practical | Won't fix |
| P4-06 | Low | LCP | `WelcomeOverlay` | Mobile LCP is the welcome paragraph, rendered only after JS (4.6 s throttled) | Static welcome markup in `index.html` | Recommended |
| P4-07 | Low | Low tier | `PostProcessingEffects.jsx` | Bloom/vignette always on, even on the low tier | Skip post-processing on low tier (visual change) | Recommended |
| P5-01 | Info (env) | Tests | Firefox | Windows Smart App Control blocks Playwright's unsigned Firefox (CodeIntegrity event 3077 on `mozglue.dll`) | Firefox opt-in on Windows (`E2E_FIREFOX=1`), always on elsewhere. Do not disable Smart App Control | Mitigated |
| P5-02 | Medium | UX | `animationUtils.js` framing + details panel | 640–~1100 px widths: the selected body is centred behind the 420 px panel (x=384 at 768 px) | `camera.setViewOffset` / framing shift | Recommended |
| P5-03 | Medium | UX | `planetUtils.js` `OVERVIEW_CAMERA` | Overview not aspect-aware: portrait phones crop the sides (True Scale at 390 px: Earth off-screen) | Widen the overview distance/FOV for aspect < 1 | Recommended |
| P5-04..06 | Info | Tests | `e2e/`, `playwright.config.js` | Test-infra issues (overlay race, phase-only wait race, SwiftShader 300 ms frames near GSAP's 500 ms lag-smoothing limit) | State-based waits; GPU (ANGLE d3d11) on Windows (17 ms/frame) | Fixed |
| P6-01 | Medium | A11y | `src/App.jsx` | No `<h1>` after the welcome screen | Visually hidden `<h1>` | Fixed |
| P6-02 | Low | A11y | `PlanetDetails.jsx` | `<aside role="dialog">` not allowed | `<div role="dialog">` | Fixed |
| P6-03 | Medium | A11y | `src/App.jsx` | Motion's JS animations ignored reduced-motion | `<MotionConfig reducedMotion="user">`. Slide 28.3 px → 0 (measured) | Fixed |
| P6-04 | Info | A11y | focus | Tab order and focus rings | Logical order; rings visible (measured) | Verified |
| P6-05 | Info | A11y | contrast | axe color-contrast | No violations | Verified |
| P6-06 | Low | A11y | scene | Scene keeps moving under reduced motion (core content; Space pauses) | Optionally start paused | Recommended |
| P6-07 | Medium | SEO | `index.html` | No OG/Twitter tags, no noscript | Added. Absolute URLs marked **DEPLOY TODO** | Fixed (URL pending) |
| P6-08 | Medium | SEO | `public/robots.txt` | `/robots.txt` returned HTML | Allow-all robots.txt. SEO 91 → 100 | Fixed |
| P6-09 | Low | SEO | `public/og-image.jpg` | No social image | 1200×630 capture of the real scene (94 KB) | Fixed |
| P6-10 | Info | Tests | `playwright.config.js` | Rare parallel-load flakes, not reproducible in isolation; app verified directly | `retries: 1`, flaky tests reported as such | Mitigated |
| P7-01 | High | Legal | repo root | **No LICENSE** | Owner must choose | **Open** |
| P7-02 | Info | Legal | `AboutModal.jsx:71-80`, `README.md:210` | CC BY 4.0 attribution | Present in both | Verified |
| P7-03 | Medium | Deploy | `package.json`, `.nvmrc` | No Node pin | `engines: ">=20.19 <21 \|\| >=22.12"`, `.nvmrc = 22` | Fixed |
| P7-04 | High | Deploy | `moons.js:18`, `planets.js:64`, `textures.js:16-17` | Hard-coded `/textures/…` → 404s on sub-path hosting | `src/utils/assetUrl.js` (`BASE_URL`). Verified with `--base=/solar/` (14/14 textures) and at root (URLs unchanged) | Fixed |
| P7-05 | Info | Security | deploy headers | Recommended CSP compatible? | 0 CSP violations (Chromium, WebKit) with headers injected over the production build | Verified |

---

## 3. Files deleted and dependency changes

**Deleted** (each approved by the owner, with evidence in P2-01…P2-04):
- `src/components/three/SolarFlares.jsx`
- `src/components/three/SelectionRing.jsx`
- `src/utils/screenUtils.js`
- functions `getBody`, `getBodyWorldPosition` in `src/utils/planetUtils.js`
- `.claude/launch.json` removed from git tracking only (file kept on disk)

**Dependencies removed:** none.
**Added (dev only, exact pins):** eslint 9.39.5, @eslint/js 9.39.5, globals 16.5.0, eslint-plugin-react 7.37.5, eslint-plugin-react-hooks 5.2.0, eslint-plugin-react-refresh 0.4.26, @playwright/test 1.63.0.
**Upgraded:** @react-three/postprocessing 3.1.1→3.1.2, postprocessing 6.39.4→6.39.5, motion 13.1.1→13.4.3, vite 8.2.2→8.3.1.
**Deliberately not upgraded:** @react-three/fiber 9.8.1 (P3-07), React 19.3 / three 0.186 (see P3-04 and P3-07).

---

## 4. Deploy checklist (manual deployment)

1. **Choose and add a licence** (P7-01): create `LICENSE` in the repo root.
2. **Use the pinned Node** (22 LTS):
   ```bash
   nvm use            # reads .nvmrc → 22
   node -v            # must satisfy >=20.19 <21 || >=22.12
   ```
3. **Clean install and checks:**
   ```bash
   npm ci
   npm run verify:data
   npm run lint
   npm run build
   npm run test:e2e   # optional before release; about 4 min locally
   ```
4. **Know your URL.** In `index.html`, resolve the `DEPLOY TODO` comment:
   - add `<link rel="canonical" href="https://YOUR-DOMAIN/" />` and `<meta property="og:url" content="https://YOUR-DOMAIN/" />`;
   - make `og:image` and `twitter:image` absolute: `https://YOUR-DOMAIN/og-image.jpg`.

   Optionally add `Sitemap: https://YOUR-DOMAIN/sitemap.xml` to `public/robots.txt` (only if you publish a sitemap).
5. **Serving from a sub-path** (e.g. `https://user.github.io/repo/`)? Build with the base path; texture URLs follow automatically (P7-04):
   ```bash
   npx vite build --base=/repo/
   ```
   *(Git Bash on Windows rewrites arguments starting with `/`. Run `MSYS_NO_PATHCONV=1 npx vite build --base=/repo/` there.)*
6. **Upload the contents of `dist/`** to the web root (or the sub-path). No SPA fallback is needed: the app has a single route.
7. **Configure HTTP headers** on your host, if it allows custom headers:

   | Path | Cache-Control |
   |---|---|
   | `/assets/*` (content-hashed JS/CSS/fonts) | `public, max-age=31536000, immutable` |
   | `/textures/*` (**not** hashed) | `public, max-age=2592000` (30 days; rename files if you ever change a texture) |
   | `/og-image.jpg`, `/favicon.svg`, `/robots.txt` | `public, max-age=86400` |
   | `/index.html` and `/` | `no-cache` |

   Security headers (all paths). These are **verified with this build: 0 CSP violations** (P7-05):
   ```
   Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; media-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
   X-Content-Type-Options: nosniff
   Referrer-Policy: strict-origin-when-cross-origin
   Permissions-Policy: camera=(), microphone=(), geolocation=()
   ```
   `'unsafe-inline'` for styles is needed for React/Motion inline style attributes and the `<noscript>` message. Add `Strict-Transport-Security: max-age=31536000` once the site is HTTPS-only.
   *Hosts without custom headers (e.g. GitHub Pages):* the CSP can go in a `<meta http-equiv="Content-Security-Policy">` tag (`frame-ancestors` is ignored in meta); caching then follows the host's defaults.
8. **Smoke-test the live site:** it loads to the welcome screen; Start; select a planet; toggle True Scale; About shows **no** "Degraded Asset Notice"; the browser console has no errors (the `THREE.Clock` warning is known and harmless, P1-13).
9. **Share-test the URL** with a link-preview debugger (e.g. the Facebook Sharing Debugger or LinkedIn Post Inspector) to confirm the OG image appears.

---

## 5. Known limitations / not fixed (with reasons)

- **L-1 · Performance 71 desktop / 46 mobile.** Dominated by 6.5 MB of textures and GPU start-up work (P4-02, P4-03). The fixes (WebP/KTX2, async shader compilation) change assets or the rendering path, so they were left as recommendations. Headless Lighthouse also under-represents real-GPU WebGL.
- **L-2 · Layout on tablets and portrait phones** (P5-02, P5-03). Changing camera framing is a visual/behaviour change requiring the owner's decision.
- **L-3 · Firefox e2e cannot run on this Windows PC** (P5-01) because of Smart App Control. It runs on Linux/CI or with `E2E_FIREFOX=1` on machines without that policy.
- **L-4 · React 19.3 / fiber 9.8.1 upgrade blocked** (P3-07) until @react-three/fiber or drei fixes the `<Html>` root-unmount regression.
- **L-5 · `THREE.Clock` deprecation warning** (P1-13) is emitted by @react-three/fiber, not app code.
- **L-6 · No CI** (owner's decision). The e2e suite exists but must be run manually.
- **L-7 · Rare e2e flakiness under parallel load** (P6-10). It is surfaced by the reporter as "flaky" rather than hidden; the app behaviour was verified directly each time.
- **L-8 · Moon orbital periods are compressed and non-proportional** (a design choice documented in Plan 03), and live distances reflect the simulated configuration, not real ephemerides.
- **L-9 · Muted audio keeps running** (P1-10). A small battery cost on mobile; suspension is recommended.
