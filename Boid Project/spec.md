# Boids Mini-Lab — Interactive Web Demo (Neon Rave Theme)

## Goal
Create an interactive, insight-friendly Boids simulation webpage that allows users to explore emergent flocking behavior through real-time controls, presets, and live instrumentation.

The final product should feel like a **neon rave / cyberpunk visualization lab** — dark background, glowing UI, vibrant motion, and smooth interactions.

---

## Tech Stack
- HTML5
- CSS3
- JavaScript (vanilla or modular)
- `<canvas>` for rendering boids
- No external frameworks required (optional: dat.GUI–style custom UI, but build manually)

---

## Visual Theme: Neon Rave
**Overall Look**
- Dark background (#05010A or near-black)
- Neon accent colors (cyan, magenta, lime, violet)
- Glowing edges, soft bloom, and subtle motion trails

**UI Styling**
- Sliders and buttons glow on hover
- Rounded corners, translucent panels
- Use CSS `box-shadow` and `text-shadow` for neon glow
- Smooth transitions (200–300ms ease)

**Canvas Styling**
- Boids rendered as glowing triangles or points
- Optional additive blending or motion blur effect
- Boundary lines glow faintly

---

## Page Layout
### Top Bar
- Title: **“Boids Mini-Lab”**
- Subtitle: *Emergent behavior in motion*

### Main Area
- Center: Boids simulation canvas
- Right or bottom panel: Controls + readouts

---

## Core Simulation Requirements
Implement standard Boids rules:
- Separation
- Alignment
- Cohesion

Each boid must:
- Track velocity and position
- Query neighbors within a configurable radius
- Obey boundary behavior (wrap or bounce)

---

## Controls (UI)
Provide **sliders or numeric inputs** for the following parameters:

1. **Separation Weight**
   - Tooltip: “How strongly boids avoid crowding nearby neighbors.”

2. **Alignment Weight**
   - Tooltip: “How much boids try to match the direction of nearby boids.”

3. **Cohesion Weight**
   - Tooltip: “How strongly boids move toward the center of nearby neighbors.”

4. **Neighbor Radius**
   - Tooltip: “How far a boid can ‘see’ other boids.”

5. **Max Speed** (or Max Steering Force)
   - Tooltip: “Maximum movement speed of each boid.”

All controls update the simulation **live**.

---

## Presets
Add **three preset buttons** that instantly snap parameters to predefined values:

### 1. Schooling
- High alignment
- Medium cohesion
- Low separation
- Medium neighbor radius
- Result: Smooth, coordinated movement

### 2. Chaotic Swarm
- Low alignment
- Low cohesion
- Small neighbor radius
- Moderate separation
- Result: Erratic, noisy motion

### 3. Tight Cluster
- High cohesion
- Moderate separation
- Medium alignment
- Larger neighbor radius
- Result: Dense flocking behavior

Preset buttons should visually glow when activated.

---

## Instrumentation (Live Readouts)
Display the following **on-screen metrics**, updated every frame or second:

- **FPS** — Frames per second
- **Boid Count**
- **Average Speed**
- **Average Neighbor Count per Boid**

These should be clearly labeled and readable over the dark background.

---

## Simulation Controls
Add the following buttons:

- **Pause / Resume**
  - Freezes and unfreezes simulation

- **Reset**
  - Reinitializes boids with random positions and velocities

---

## Boundary Rules
Implement **two boundary behaviors**:

1. **Wrap**
   - Boids exiting one side re-enter from the opposite side

2. **Bounce**
   - Boids reflect off canvas edges

### Requirements
- Boundary behavior must be **visible**
- Add a toggle switch:
  - Label: “Boundary Mode”
  - Options: Wrap / Bounce
- Canvas edges should glow faintly to show boundaries

---

## UX & Accessibility
- All sliders and buttons must have **clear labels**
- Tooltips use plain English (no jargon)
- High contrast text
- Sliders should show numeric values
- Cursor changes on hover for interactive elements

---

## Performance Expectations
- Smooth animation at 60 FPS with ~100–300 boids
- Avoid unnecessary object creation in animation loop
- Use requestAnimationFrame

---

## Stretch Enhancements (Optional)
- Color boids based on speed or neighbor count
- Motion trails using alpha fade
- Toggle boid count
- Screenshot or GIF export

---

## Deliverables
- `index.html`
- `style.css`
- `script.js`
- This `spec.md`

The final result should feel like a **playable science toy** — visually striking, intuitive, and educational.
