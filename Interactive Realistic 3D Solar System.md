# Advanced Prompt: Interactive Realistic 3D Solar System

Build a complete, production-quality **interactive 3D Solar System web application** using modern React and Three.js technologies.

The project should be visually stunning, scientifically inspired, highly interactive, and extremely smooth. The experience should feel like a premium cinematic space exploration website rather than a simple educational animation.

---

## 1. TECH STACK

Use the following technologies:

### Core
- React
- Vite
- JavaScript or TypeScript
- Three.js
- React Three Fiber
- React Three Drei

### Animation
- GSAP for cinematic camera animations
- Framer Motion for UI transitions

### Styling
- Tailwind CSS

### State Management
- Zustand or React Context for managing:
  - Selected planet
  - Camera focus
  - UI state
  - Animation state
  - Audio state

---

# 2. PROJECT ARCHITECTURE

Create a clean and scalable folder structure.

Example:

src/

components/
- SolarSystem.jsx
- Sun.jsx
- Planet.jsx
- Moon.jsx
- Orbit.jsx
- StarField.jsx
- SpaceEnvironment.jsx
- PlanetLabel.jsx
- CameraController.jsx
- PlanetDetails.jsx
- PlanetNavigation.jsx
- LoadingScreen.jsx
- Controls.jsx

data/
- planets.js

hooks/
- usePlanetStore.js
- useCameraControls.js

utils/
- planetUtils.js
- animationUtils.js

styles/
- globals.css

App.jsx
main.jsx

Keep the code modular, reusable, and well organized.

---

# 3. SOLAR SYSTEM

Create a realistic 3D Solar System containing:

1. Sun
2. Mercury
3. Venus
4. Earth
5. Mars
6. Jupiter
7. Saturn
8. Uranus
9. Neptune

Also include:

- Earth's Moon
- Optional major moons for Jupiter and Saturn

Each planet must have its own:

- Name
- Size
- Texture
- Rotation speed
- Orbital speed
- Orbital distance
- Axial tilt
- Planet information

Use realistic proportions where possible, but slightly adjust distances and sizes when necessary to maintain a visually appealing experience.

---

# 4. SUN

The Sun should be visually impressive and act as the main light source.

Features:

- High-quality animated solar texture
- Realistic glowing atmosphere
- Dynamic emissive material
- Solar flares
- Animated fire-like surface movement
- Bloom effect
- Volumetric glow
- Point light affecting nearby planets

The Sun should feel alive.

Use post-processing effects carefully to create:

- Glow
- Bloom
- Soft light
- Cinematic contrast

Avoid excessive effects that reduce performance.

---

# 5. PLANET REALISM

Each planet should use realistic PBR materials and high-quality textures.

### Mercury
- Rocky
- Dark
- Cratered surface

### Venus
- Dense cloudy atmosphere
- Yellow/orange appearance

### Earth
- Blue oceans
- Continents
- Clouds
- Atmospheric glow
- Night-side effect if possible

### Mars
- Red rocky terrain
- Subtle surface details

### Jupiter
- Large gas giant
- Atmospheric bands
- Great Red Spot

### Saturn
- Detailed atmosphere
- Realistic transparent rings
- Ring shadows

### Uranus
- Pale blue atmospheric appearance
- Axial tilt

### Neptune
- Deep blue atmosphere
- Subtle cloud patterns

---

# 6. ORBITAL ANIMATION SYSTEM

Implement realistic orbital motion.

Each planet should:

- Orbit the Sun continuously
- Rotate around its own axis
- Have different orbital speeds
- Move smoothly at all frame rates

Use delta time to ensure animations remain consistent.

Example concept:

planetRotation += rotationSpeed * delta

orbitAngle += orbitSpeed * delta

Calculate the planet's position using mathematical orbital paths.

Use elliptical orbits rather than simple circular paths when possible.

Example:

x = semiMajorAxis * cos(angle)

z = semiMinorAxis * sin(angle)

Create visible orbit paths that are:

- Subtle
- Semi-transparent
- Elegant
- Optional through settings

---

# 7. INTERACTIVE PLANETS

Every planet should be interactive.

### Hover Interaction

When hovering over a planet:

- Slightly increase its glow
- Add a subtle outline
- Slightly scale it
- Display its name clearly
- Change the cursor to pointer

The animation should be smooth.

---

# 8. PLANET LABEL SYSTEM

Display floating labels for each planet.

Labels should:

- Show the planet name
- Use elegant futuristic typography
- Float naturally in 3D space
- Always face the camera
- Avoid overlapping important objects
- Fade based on distance
- Hide when the planet is behind another object

Use Drei's HTML component or an optimized alternative.

---

# 9. CLICK INTERACTION

When the user clicks a planet:

### Step 1
Disable conflicting camera interactions temporarily.

### Step 2
Smoothly animate the camera toward the selected planet.

### Step 3
Calculate a suitable camera position based on:

- Planet size
- Planet position
- Current camera direction

### Step 4
Use cinematic easing.

The camera must:

- Never instantly jump
- Never pass through the planet
- Smoothly decelerate

Use GSAP for camera movement.

Example concept:

gsap.to(camera.position, {
  x: targetX,
  y: targetY,
  z: targetZ,
  duration: 2,
  ease: "power3.inOut"
})

Also smoothly update the OrbitControls target.

---

# 10. PLANET DETAILS EXPERIENCE

When a planet is selected, open a premium information interface.

The transition should feel cinematic.

The sequence:

1. User clicks planet
2. Planet becomes visually highlighted
3. Camera smoothly travels toward the planet
4. Background UI subtly fades
5. Information panel smoothly appears

Use Framer Motion for UI animations.

---

# 11. PLANET DETAILS PANEL

Create a futuristic glassmorphism information panel.

The panel should contain:

## Header

- Planet name
- Planet category
- Large planet preview or icon

## Description

Short but informative description.

## Scientific Information

Display:

- Diameter
- Distance from the Sun
- Distance from Earth
- Number of moons
- Gravity
- Surface temperature
- Length of day
- Length of year
- Orbital speed

## Fun Facts

Display 3 to 5 interesting facts.

---

# 12. UI DESIGN

The UI should feel like a futuristic space exploration interface.

Design inspiration:

- NASA
- SpaceX interfaces
- Modern sci-fi dashboards
- Apple Vision Pro
- Premium technology websites

Use:

- Dark backgrounds
- Glassmorphism
- Soft transparency
- Blur effects
- Thin borders
- Subtle glows
- Smooth gradients

Avoid:

- Excessive buttons
- Clutter
- Heavy UI elements
- Cheap-looking neon effects

Everything should look premium and minimal.

---

# 13. NAVIGATION SYSTEM

Create a floating navigation interface.

Include:

### Planet Selector

Allow users to quickly select:

- Mercury
- Venus
- Earth
- Mars
- Jupiter
- Saturn
- Uranus
- Neptune

Clicking a planet name should smoothly move the camera to that planet.

---

### Previous / Next Navigation

Inside the planet details view:

Previous Planet

Next Planet

Switching planets should:

- Smoothly transition the camera
- Update the information panel
- Animate the content

---

### Reset View

Create a button that:

- Returns the camera to the full Solar System
- Resets the selected planet
- Closes the information panel

Use smooth animation.

---

# 14. CAMERA SYSTEM

Create an advanced camera controller.

Default camera:

- Positioned far enough to see the Solar System
- Slightly angled for cinematic composition

Controls:

- Rotate
- Zoom
- Pan

Use damping.

Example:

enableDamping = true

dampingFactor = 0.05

Set reasonable:

- Minimum zoom distance
- Maximum zoom distance

Prevent users from getting lost in space.

---

# 15. CINEMATIC CAMERA BEHAVIOR

Add subtle automatic camera movement when the user is inactive.

The camera can slowly drift or rotate around the Solar System.

When the user interacts:

- Stop automatic movement

After several seconds of inactivity:

- Gradually resume subtle cinematic movement

The motion should be extremely subtle.

---

# 16. STAR FIELD

Create a high-quality deep-space environment.

Include:

- Thousands of stars
- Different star sizes
- Subtle twinkling
- Randomized distribution
- Depth perception

Use optimized techniques.

Do NOT create thousands of individual React components.

Use:

- Points
- BufferGeometry
- Instancing

for better performance.

---

# 17. SPACE ENVIRONMENT

Create a realistic cosmic atmosphere.

Include subtle:

- Nebula effects
- Distant galaxies
- Cosmic dust
- Deep-space gradients

Keep the environment elegant and realistic.

Avoid making it visually noisy.

---

# 18. POST PROCESSING

Use @react-three/postprocessing.

Implement:

- Bloom
- Vignette
- Tone mapping

Optional:

- Depth of field during cinematic camera transitions

Ensure the effects automatically scale down on lower-performance devices.

---

# 19. AUDIO

Add optional immersive audio.

Include:

- Ambient space atmosphere
- Subtle cinematic background sound

Important:

Audio should NOT automatically play without user interaction.

Include:

- Sound toggle
- Volume control

---

# 20. LOADING SCREEN

Create a cinematic loading screen.

Display:

SOLAR SYSTEM

INITIALIZING SPACE ENVIRONMENT...

Load assets progressively.

Include:

- Progress bar
- Percentage
- Smooth fade-out transition

Do not show the 3D scene until essential assets are ready.

---

# 21. RESPONSIVE DESIGN

The application must work perfectly on:

- Desktop
- Laptop
- Tablet
- Mobile

On mobile:

- Simplify controls
- Reduce particle counts
- Reduce post-processing
- Optimize texture resolution
- Use touch-friendly interactions

---

# 22. PERFORMANCE OPTIMIZATION

Performance is extremely important.

Implement:

- Texture compression where possible
- Lazy loading
- Asset preloading
- Instanced rendering
- Adaptive pixel ratio
- Reduced effects on mobile
- Avoid unnecessary React re-renders

Use:

useMemo

useFrame

React.memo

where appropriate.

Avoid placing expensive calculations inside the render loop unnecessarily.

The application should target smooth 60 FPS on modern devices.

---

# 23. ACCESSIBILITY

Include:

- Keyboard navigation
- Accessible buttons
- Proper ARIA labels
- Visible focus states
- Alternative text for UI elements

---

# 24. DATA STRUCTURE

Store planet information in a centralized data file.

Example:

const planets = [
  {
    id: "earth",
    name: "Earth",
    description: "...",
    radius: 1,
    distance: 15,
    rotationSpeed: 1,
    orbitSpeed: 0.2,
    moons: 1,
    diameter: "...",
    gravity: "...",
    temperature: "...",
    dayLength: "...",
    yearLength: "...",
    facts: []
  }
]

Do not hardcode planet information directly throughout multiple components.

---

# 25. ANIMATION PRINCIPLES

Every animation must follow these principles:

- Smooth
- Natural
- Cinematic
- Responsive
- Physically believable

Use appropriate easing.

Preferred easing:

- power3.inOut
- power2.out
- cubic-bezier curves for UI

Avoid:

- Sudden transitions
- Excessive bouncing
- Robotic animations
- Abrupt camera jumps

---

# 26. USER EXPERIENCE FLOW

The default experience should work like this:

### Opening

User sees:

A cinematic view of the entire Solar System.

The Sun glows at the center.

Planets slowly orbit.

Stars move subtly in the background.

A welcome interface appears.

Text:

EXPLORE THE SOLAR SYSTEM

Button:

START EXPLORING

---

### Exploration

User can:

- Rotate the Solar System
- Zoom
- Click planets
- Select planets from navigation

---

### Planet Selection

When clicking Earth:

1. Earth highlights
2. Camera smoothly travels toward Earth
3. Other UI subtly fades
4. Earth information appears
5. Planet rotates naturally
6. Moon continues orbiting
7. Background remains animated

---

### Returning

User clicks:

BACK TO SOLAR SYSTEM

The camera smoothly zooms back.

The planet panel disappears.

The entire Solar System becomes visible again.

---

# 27. CODE QUALITY

Generate:

- Clean code
- Reusable components
- Clear naming
- Comments for complex logic
- No unnecessary dependencies
- No placeholder functionality

Do not create a single large component containing the entire application.

Separate:

- 3D rendering
- Planet data
- Camera logic
- UI
- Animations
- State management

---

# 28. ERROR HANDLING

Handle:

- Missing textures
- Loading errors
- WebGL compatibility issues

Show a friendly fallback message if WebGL is unavailable.

---

# 29. FINAL VISUAL GOAL

The final application should feel like:

"A cinematic journey through a living Solar System."

It should immediately impress users visually.

The experience should combine:

REALISTIC 3D GRAPHICS
+
CINEMATIC ANIMATIONS
+
SMOOTH CAMERA TRANSITIONS
+
INTERACTIVE PLANET EXPLORATION
+
PREMIUM FUTURISTIC UI

Do not build a basic educational Solar System.

Build a visually impressive, portfolio-quality, production-level interactive 3D experience.

Prioritize smoothness, realism, performance, and user experience.

Generate the complete working application with all required components and functionality.