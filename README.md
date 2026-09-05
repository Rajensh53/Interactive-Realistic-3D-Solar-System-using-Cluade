# Interactive Realistic 3D Solar System

A cinematic, interactive 3D solar system built with React, Vite, and Three.js. This project renders the Sun, the eight planets, orbital paths, a star field, and atmospheric glow effects in a browser-based experience designed to feel immersive and educational.

## Features

- Real-time 3D solar system visualization using React Three Fiber
- Animated orbit motion and planet rotation
- Sun with bloom and glow styling
- Planet data model with scientific metadata
- Star field and sky dome backdrop
- Responsive loading screen and WebGL fallback handling
- Modular architecture for planets, moons, textures, and scene logic

## Tech Stack

- React 19
- Vite
- Three.js
- @react-three/fiber
- @react-three/drei
- @react-three/postprocessing
- Zustand
- Tailwind CSS

## Project Structure

```text
.
├── index.html
├── package.json
├── vite.config.js
├── public/
│   └── textures/
│       ├── environment/
│       └── planets/
├── scripts/
│   ├── fetch-textures.sh
│   └── verify-data.mjs
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── components/
│   │   ├── three/
│   │   └── ui/
│   ├── data/
│   │   ├── moons.js
│   │   ├── planets.js
│   │   └── textures.js
│   ├── hooks/
│   ├── shaders/
│   ├── styles/
│   ├── utils/
│   └── ...
├── Plans/
│   └── 01-Solar-System-Build-Plan.md
├── Interactive Realistic 3D Solar System.md
└── README.md
```

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Start the development server

```bash
npm run dev
```

This starts the Vite app, usually at:

```text
http://localhost:5173
```

### 3. Build for production

```bash
npm run build
```

### 4. Preview the production build

```bash
npm run preview
```

## Available Scripts

```bash
npm run dev       # run local dev server
npm run build     # create production build
npm run preview   # preview the production bundle
npm run verify:data  # validate data integrity for the solar system config
```

## Notes on Data and Textures

The app loads texture assets from the public folder under `public/textures`. These assets are used for planet surfaces, atmospheres, and environment effects. If data or textures are missing, the project includes validation and asset-fetch utilities to help restore or confirm them.

## Development Notes

- The 3D scene is centered around `src/components/three/SolarSystem.jsx`.
- Planet definitions and scientific metadata live in `src/data/planets.js`.
- Scene utilities for orbital math and animation live in `src/utils/planetUtils.js`.
- The app uses a progressive loading pattern so the UI waits for assets before revealing the full solar system.

## License

This project is intended for educational and visual demonstration purposes. Update or remove this section if you plan to publish it under a specific license.

## Future Enhancements

Potential additions include:

- planet selection and focus controls
- camera fly-through animations
- extra moons and atmospheric detail
- improved UI panels with richer scientific data
- sound and cinematic transitions

## Acknowledgements

This project uses publicly available planetary textures and the open-source ecosystem around React and Three.js to create a polished interactive space experience.
