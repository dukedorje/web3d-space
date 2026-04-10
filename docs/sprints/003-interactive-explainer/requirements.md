---
sprint: sprint-003
phase: requirements
created: 2026-04-10
status: complete
---

# Sprint 003 Requirements: Interactive Explainer Page

## Functional Requirements — MVP Scope (28 FRs)

### Group A: Page Structure & Navigation

**FR1. Route & Section Layout**
The system shall provide a SvelteKit route at `/how-it-works` with an educational explainer page covering 10 topic sections in order: (1) What Is a GPU?, (2) The WebGPU Pipeline, (3) Boid Rules, (4) Memory Layout, (5) Double Buffering, (6) The Compute Shader, (7) Neighbor Queries, (8) Rendering, (9) The Camera, (10) Personalities and Stress.

**FR2. Section Content Standard**
Each topic section shall contain: a heading, prose explanation with all technical terms defined on first use, and at least one interactive element (demo, diagram, or visualization).

**FR3. In-Page Navigation**
Sections shall be presented in a scrollable sequential layout with a sticky sidebar (desktop) / collapsible nav (mobile) linking to each section by anchor.

**FR41. Cross-Links**
The `/how-it-works` page and `/boids` simulation page shall cross-link to each other. The boids page shall have a "How It Works" link. The explainer page shall have a "See It Live" link to `/boids`.

### Group B: Section 1 — What Is a GPU?

**FR5. CPU vs GPU Parallelism Demo**
An interactive Canvas 2D visualization where the user adjusts task count (slider, 1-1000) and observes the difference between sequential CPU-style execution and parallel GPU-style execution.

### Group C: Section 2 — The WebGPU Pipeline

**FR6. Pipeline Data-Flow Diagram**
A labeled data-flow diagram showing: JavaScript -> command buffers -> GPU queue -> compute/render passes.

### Group D: Section 3 — Boid Rules

**FR8. Interactive 2D Boid Demo**
A Canvas 2D boid demo (~30 boids) where the user can toggle each steering rule (separation, alignment, cohesion) independently via checkboxes or toggle buttons.

**FR9. Force Vector Display**
The demo shall render labeled force vectors on a highlighted boid so the user can see each steering force visually.

**FR10. Steering Weight Sliders**
Sliders for separation weight, alignment weight, and cohesion weight matching the `separationWeight`, `alignmentWeight`, and `cohesionWeight` fields in `BoidConfigTemplate`.

### Group E: Section 4 — Memory Layout

**FR11. BoidState Memory Diagram**
An interactive memory layout diagram for the `BoidState` struct showing each field with its byte offset and data type. Fields highlighted on hover/tap with a tooltip explaining the field's role.

**FR12. BoidConfig Struct Display**
A labeled display of the `BoidConfig` struct showing all 12 fields: `separationWeight`, `alignmentWeight`, `cohesionWeight`, `perceptionRadius`, `separationRadius`, `maxSpeed`, `wanderStrength`, `crowdSpeedBoost`, `personalityType`, `experienceTimer`, `stressLevel`, and `_padding`.

**FR30. Buffer Recreation Lifecycle**
The section shall explain buffer recreation lifecycle — when and why GPU buffers are destroyed and recreated (e.g., boid count change).

### Group F: Section 5 — Double Buffering

**FR13. Ping-Pong Step-Through**
An animated step-through of the ping-pong double-buffer pattern, showing read/write buffer swapping each frame. User can step manually (prev/next) or play automatically.

**FR29. Snapshot Bridge Explanation**
The section shall explain the D-005 snapshot bridge pattern with a code snippet and data-flow diagram showing how the snapshot bridges JavaScript state to the GPU.

### Group G: Section 6 — The Compute Shader

**FR14. Shader Source Display**
Syntax-highlighted excerpts from the actual `boid-steering.wgsl` file, imported via `?raw` so the content is always in sync with the source.

### Group H: Section 7 — Neighbor Queries

**FR16. Perception Radius Visualization**
An interactive Canvas 2D visualization showing a boid's perception radius as a circle. The user drags the central boid or neighboring boids; neighbors within the radius are highlighted. Adjustable radius via slider.

### Group I: Section 8 — Rendering

**FR17. Cone Rotation Visualization**
A visualization (Canvas 2D or CSS 3D) showing how a boid mesh aligns its orientation to its velocity vector.

**FR18. Instanced Rendering Diagram**
A diagram showing one mesh geometry rendered at N positions with N orientation transforms.

**FR20. View/Projection Pipeline Diagram**
A matrix pipeline diagram: world space -> view space -> clip space -> screen space.

### Group J: Section 10 — Personalities and Stress

**FR22. Personality Type Display**
Display all 7 personality types (Flocker, Loner, Predator, Explorer, Swirler, Timid, Mimic) with their canonical colors from `PERSONALITY_COLORS`, identifying shapes, and a parameter table showing the 8 tunable fields from `BoidConfigTemplate`.

**FR23. Personality Comparison Widget**
The user selects two personality types and sees a side-by-side diff of their parameter values with visual indicators (higher/lower/same) for each field.

**FR24. Mini-Simulation with Personality Distribution**
An embedded Canvas 2D mini-simulation with a personality distribution control — either sliders matching `PersonalityDistribution` or preset buttons matching `DISTRIBUTION_PRESETS` (Balanced, All Flockers, Predator Chaos, Peaceful Flock, Chaos). Boids colored by personality type.

**FR25. State-Transition Diagram**
A state-transition diagram showing personality transition rules (stress accumulation -> personality shift).

**FR26. Stress Time-Series Graph**
An interactive stress time-series graph showing how a single boid's `stressLevel` evolves over time in the mini-simulation.

### Group K: Cross-Cutting

**FR32. Shiki Syntax Highlighting**
Syntax-highlighted code snippets for TypeScript and WGSL shall use Shiki, loaded via dynamic import (not in the main bundle).

**FR33. Live Shader Source**
Code snippets that reference shader source shall import the `.wgsl` files using `?raw` so the snippet content matches the actual file at build time.

**FR34. Terms Defined on First Use**
All technical terms shall be defined inline in prose on first use. No assumed knowledge beyond "computers run programs."

**FR35. No WebGPU Dependency**
All interactive demos shall work without WebGPU. Canvas 2D is the only rendering API used in the explainer page.

**FR40. Lazy Initialization**
Each demo component shall use `IntersectionObserver` to lazy-initialize — the Canvas animation loop does not start until the demo scrolls into the viewport.

## Non-Functional Requirements

**NFR1. Performance**
No more than 3 Canvas 2D animation loops shall run simultaneously. `IntersectionObserver` pauses loops for off-screen demos. The page shall be interactive within 2 seconds on localhost.

**NFR2. Accessibility**
All interactive demos shall be keyboard-navigable. All diagrams shall have descriptive `alt` text or `aria-label` attributes. Sliders shall be standard `<input type="range">` elements with visible labels and current value display.

**NFR3. Bundle Size**
Shiki shall be loaded via dynamic import only when a code block is first rendered. It shall not be in the main page bundle.

**NFR4. Code Organization**
Each topic section shall be a separate Svelte component under `src/lib/components/explainer/`. The route page only composes sections and manages nav state. No component exceeds 400 lines.

**NFR5. No Layout Jank**
Demo canvases shall have explicit width and height set before the animation loop starts. No content reflow when a demo initializes.

## Open Questions

1. **Shiki + WGSL**: Does Shiki's bundled language list include WGSL? If not, GLSL can serve as a close-enough fallback grammar. Verify at implementation time.

2. **Section 9 (Camera) scope**: FR20 (matrix pipeline diagram) is shared with Section 8. Section 9 may be thin for MVP. Consider merging content or adding the camera explanation as prose-only with a simple diagram.

3. **Personality transition rules for FR25**: The exact transition table (which type transitions to which under what stress/experience conditions) must be read from `boid-steering.wgsl` at implementation time. The diagram must match the actual shader logic.

4. **Canvas demo sizing**: Should demos be fixed-size (e.g., 400x300) or responsive within a max-width container? Fixed size avoids resize complexity; responsive looks better on wide screens.
