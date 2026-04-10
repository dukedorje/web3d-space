---
title: Interactive Explainer — How the Boids Simulation Works
created: 2026-04-10
status: draft
scope_tier: mvp
route: /how-it-works
---

# PRD: Interactive Explainer — /how-it-works

## Problem Statement

The boids simulation is fun to watch but opaque to anyone who didn't build it. A teenager can see the flock swirl, but has no idea why turning one slider from 1.0 to 3.0 makes the whole thing explode. The simulation touches real CS concepts — GPU parallelism, memory layout, shader pipelines, emergent behavior — but none of that is visible in the UI.

This page makes the internals visible. It teaches ten topics in sequence, from "what is a GPU?" to "how does a boid decide to become a Predator?", using interactive 2D demos instead of static diagrams. The target reader is an intelligent kid who does not know what a compute shader is. The secondary benefit is that the page documents the actual architecture for anyone who wants to extend it later.

The page is part of the same project — same repo, same SvelteKit app, same URL namespace. It is not a separate docs site.

## User Personas

**Son** — primary reader. Smart, curious, not a programmer (yet). He wants to understand why the simulation behaves the way it does, specifically after watching it. He will interact with demos but will not read walls of text. He needs jargon defined the first time it appears. The page succeeds if he reads it voluntarily and asks questions afterward.

**Duke (father)** — secondary reader and the builder. Wants the page to accurately reflect the implementation so it doubles as living architecture documentation. Will notice if a diagram is wrong.

**Future readers** — the page will eventually be public. Developers stumbling in from the web should be able to follow the technical sections without the rest of the app as context.

## User Journeys

**Journey 1: Son Reads Top to Bottom**
After a session playing with the simulation, son navigates to /how-it-works. He scrolls through "What Is a GPU?" and plays with the parallelism slider — watching 1,000 tasks finish instantly versus one at a time. He reaches the boids demo, toggles off cohesion, and watches the boids scatter just like he saw in the real simulation. Something clicks. He keeps reading. He gets to the personality section, recognizes the Predator behavior he noticed earlier, and reads why it moves differently. He closes the tab having learned something real.

**Journey 2: Duke Verifies Architecture**
After adding a new feature to the simulation, Duke opens /how-it-works to check whether the ping-pong buffer section still describes reality. The code snippet in that section is imported directly from the actual shader file via `?raw`, so it matches automatically. The data-flow diagram needs a manual update — he edits the component. Fifteen minutes, done.

**Journey 3: External Developer**
A developer finds the project via a blog post. They land on /boids, see the simulation, click the "How It Works" link, and navigate to /how-it-works. They read through the WebGPU pipeline section, look at the memory layout diagram, and understand how the double-buffer pattern avoids read-write conflicts. They leave with something actionable for their own project.

## Success Metrics

- Son reads at least 5 of 10 sections in a single session without being asked to.
- Son can correctly explain one concept from the page (in his own words) after reading it.
- Every interactive demo works in Chrome and Firefox on a laptop with no WebGPU requirement.
- All 10 topic sections are present and contain working interactive elements in MVP.
- Code snippets in the page match the actual shader source (no drift between docs and code).
- Page load time is under 2 seconds on localhost. Syntax highlighting does not block initial render.

## Functional Requirements

### Topic Sections

**FR1. [MVP]** The system shall provide a SvelteKit route at `/how-it-works` with an educational explainer page covering 10 topic sections in this order:
1. What Is a GPU?
2. The WebGPU Pipeline
3. Boid Rules: Separation, Alignment, Cohesion
4. Memory Layout
5. Double Buffering
6. The Compute Shader
7. Neighbor Queries
8. Rendering: From Shader to Screen
9. The Camera
10. Personalities and Stress

**FR2. [MVP]** Each topic section shall contain: a heading, prose explanation with all technical terms defined on first use, and at least one interactive element (demo, diagram, or visualization).

**FR3. [MVP]** Sections shall be presented in a scrollable sequential layout. The page shall have an in-page navigation element (sticky sidebar on desktop, collapsible on mobile) that links to each section by anchor.

**FR4. [Growth]** The navigation shall display a reading progress indicator showing which sections have been scrolled past.

### Section 1 — What Is a GPU?

**FR5. [MVP]** The section shall include an interactive CPU vs. GPU parallelism visualization built on Canvas 2D. The user shall be able to adjust task count (slider, range 1–1000) and observe the difference between sequential CPU-style execution and parallel GPU-style execution.

### Section 2 — The WebGPU Pipeline

**FR6. [MVP]** The section shall include a labeled data-flow diagram showing the path from JavaScript → command buffers → GPU queue → compute/render passes.

**FR7. [Growth]** The section shall include a live inline check: "Does your browser support WebGPU?" displayed at read time using `navigator.gpu` detection.

### Section 3 — Boid Rules

**FR8. [MVP]** The section shall include an interactive 2D boid demo (Canvas 2D, ~30 boids) where the user can toggle each of the three steering rules (separation, alignment, cohesion) independently on and off via checkboxes or toggle buttons.

**FR9. [MVP]** The demo shall render labeled force vectors on a highlighted boid so the user can see each steering force visually.

**FR10. [MVP]** The demo shall include sliders for separation weight, alignment weight, and cohesion weight matching the `separationWeight`, `alignmentWeight`, and `cohesionWeight` fields in `BoidConfigTemplate`.

### Section 4 — Memory Layout

**FR11. [MVP]** The section shall include an interactive memory layout diagram for the `BoidState` struct showing each field with its byte offset and data type. Fields shall be visually highlighted on hover/tap with a tooltip explaining the field's role.

**FR12. [MVP]** The section shall include a labeled display of the `BoidConfig` struct showing all 12 fields: `separationWeight`, `alignmentWeight`, `cohesionWeight`, `perceptionRadius`, `separationRadius`, `maxSpeed`, `wanderStrength`, `crowdSpeedBoost`, `personalityType`, `experienceTimer`, `stressLevel`, and `_padding`.

### Section 5 — Double Buffering

**FR13. [MVP]** The section shall include an animated step-through of the ping-pong double-buffer pattern, showing read buffer and write buffer swapping roles each frame. The user shall be able to step through frames manually (previous/next buttons) or play automatically.

### Section 6 — The Compute Shader

**FR14. [MVP]** The section shall include syntax-highlighted excerpts from the actual `boid-steering.wgsl` file, imported via `?raw` so the content is always in sync with the source.

**FR15. [Growth]** The section shall include a step-through mode that highlights individual lines of the compute shader and explains what each line does in plain language.

### Section 7 — Neighbor Queries

**FR16. [MVP]** The section shall include an interactive visualization (Canvas 2D) showing a boid's perception radius as a circle. As the user drags the central boid or moves neighboring boids, neighbors within the radius shall be highlighted. The user shall be able to adjust the perception radius via slider.

### Section 8 — Rendering

**FR17. [MVP]** The section shall include a 3D cone rotation visualization (Canvas 2D or CSS 3D) showing how a boid mesh aligns its orientation to its velocity vector.

**FR18. [MVP]** The section shall include an instanced rendering diagram showing one mesh geometry being rendered at N positions with N orientation transforms.

**FR19. [Growth]** The section shall include the `boid-render.wgsl` source with syntax highlighting and inline annotations explaining the vertex transform and fragment color logic.

**FR20. [MVP]** The section shall include a view/projection matrix pipeline diagram: world space → view space → clip space → screen space.

**FR21. [Growth]** The section shall include an interactive camera widget where the user can adjust field-of-view and observe the effect on the projected scene.

### Section 9 — The Camera

**FR20 is shared with Section 8.** No additional interactive elements required for MVP beyond the matrix pipeline diagram.

### Section 10 — Personalities and Stress

**FR22. [MVP]** The section shall display all 7 personality types (Flocker, Loner, Predator, Explorer, Swirler, Timid, Mimic) with their canonical colors from `PERSONALITY_COLORS`, identifying shapes, and a parameter table showing the 8 tunable fields from `BoidConfigTemplate`.

**FR23. [MVP]** The section shall include a personality comparison widget: the user selects two personality types and sees a side-by-side diff of their parameter values with visual indicators (higher/lower/same) for each field.

**FR24. [MVP]** The section shall include an embedded 2D mini-simulation (Canvas 2D) with a personality distribution control — either sliders matching `PersonalityDistribution` or preset buttons matching `DISTRIBUTION_PRESETS` (Balanced, All Flockers, Predator Chaos, Peaceful Flock, Chaos). Boids shall be colored by personality type.

**FR25. [MVP]** The section shall include a state-transition diagram showing the personality transition rules (stress accumulation → personality shift).

**FR26. [MVP]** The section shall include an interactive stress time-series graph showing how a single boid's `stressLevel` evolves over time in the simulation.

**FR27. [Growth]** The section shall include a visual demo of a personality transition effect — a boid visually changing color/shape when its personality type changes.

### Zig / WASM (Deferred)

**FR28. [Vision]** A "Coming Soon" teaser section shall be included at the bottom of the page describing the planned Zig-to-WASM integration for CPU-side simulation logic. The section shall not contain any interactive elements or code examples (no Zig code exists yet).

### Cross-Cutting

**FR29. [MVP]** The section on double buffering shall explain the D-005 snapshot bridge pattern with a code snippet and a data-flow diagram showing how the snapshot bridges JavaScript state to the GPU.

**FR30. [MVP]** The section on memory layout shall explain buffer recreation lifecycle — when and why GPU buffers are destroyed and recreated (e.g., boid count change).

**FR31. [Growth]** A full frame loop interactive diagram shall be available, showing the complete per-frame sequence: JS update → encode commands → submit → GPU compute → GPU render → present.

**FR32. [MVP]** Syntax-highlighted code snippets for TypeScript and WGSL shall use Shiki, loaded via dynamic import (not in the main bundle).

**FR33. [MVP]** Code snippets that reference shader source shall import the `.wgsl` files using `?raw` so the snippet content matches the actual file at build time.

**FR34. [MVP]** All technical terms shall be defined inline in prose on first use. No assumed knowledge beyond "computers run programs."

**FR35. [MVP]** All interactive demos shall work without WebGPU. Canvas 2D is the only rendering API used in the explainer page.

**FR36. [Growth]** The page shall be responsive and readable at viewport widths of 768px and above.

**FR37. [Growth]** The TailwindCSS typography plugin (`@tailwindcss/typography`) shall style the prose sections.

**FR38. [Vision]** A glossary mode shall provide tooltip definitions for all defined technical terms throughout the page.

**FR39. [Vision]** Light and dark mode themes shall be supported, respecting the user's system preference.

**FR40. [MVP]** Each demo component shall use `IntersectionObserver` to lazy-initialize — the Canvas animation loop does not start until the demo scrolls into the viewport.

**FR41. [MVP]** The `/how-it-works` page and the `/boids` simulation page shall cross-link to each other. The boids page shall have a "How It Works" link. The explainer page shall have a "See It Live" link to `/boids`.

## Non-Functional Requirements

**NFR1. Performance** — No more than 3 Canvas 2D animation loops shall run simultaneously. `IntersectionObserver` pauses loops for off-screen demos. The page shall be interactive within 2 seconds on localhost.

**NFR2. Accessibility** — All interactive demos shall be keyboard-navigable. All diagrams shall have descriptive `alt` text or `aria-label` attributes. Sliders shall be standard `<input type="range">` elements with visible labels and current value display.

**NFR3. Bundle size** — Shiki (syntax highlighting) shall be loaded via dynamic import only when a code block is first rendered. It shall not be included in the main page bundle.

**NFR4. Code organization** — Each topic section shall be a separate Svelte component under `src/lib/components/explainer/`. The route component at `src/routes/how-it-works/+page.svelte` shall only compose section components and manage the nav state. No section component shall exceed 400 lines.

**NFR5. No layout jank** — Demo canvases shall have explicit width and height set before the animation loop starts. There shall be no content reflow when a demo initializes.

## Scope Boundaries

### In Scope

- SvelteKit route at `/how-it-works`
- 10 topic sections with prose and interactive Canvas 2D demos
- Sticky in-page navigation
- Personality type display and comparison for all 7 types (Flocker, Loner, Predator, Explorer, Swirler, Timid, Mimic)
- Memory layout diagrams for BoidState and BoidConfig structs
- Syntax-highlighted WGSL and TypeScript snippets via Shiki
- Code snippets sourced from actual shader files via `?raw`
- Ping-pong buffer animation
- Neighbor query visualization
- Stress time-series graph
- Cross-links to `/boids`
- Zig teaser section (text only, no code)
- Responsive layout at 768px+ (Growth)
- Reading progress in nav (Growth)
- Render shader annotations (Growth)
- Interactive camera widget (Growth)
- Personality transition visual demo (Growth)
- Full frame loop diagram (Growth)
- Typography plugin (Growth)
- WebGPU browser check (Growth)

### Out of Scope

- WebGPU demos of any kind — the explainer uses Canvas 2D only
- Editing shader code from the explainer page
- Any server-side logic or data fetching
- Authentication or user accounts
- Persistent state (no localStorage, no database)
- Video or audio
- i18n or translation
- Mobile-first layout (responsive at 768px is sufficient for Growth; below that is not a priority)

## MVP / Growth / Vision Tiers

### MVP

FR1, FR2, FR3, FR5, FR6, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR16, FR17, FR18, FR20, FR22, FR23, FR24, FR25, FR26, FR29, FR30, FR32, FR33, FR34, FR35, FR40, FR41

A complete, navigable explainer page with 10 sections. Every section has prose and at least one working interactive demo. Syntax highlighting loads lazily. All demos are Canvas 2D. The page cross-links to `/boids`. A kid can read it.

### Growth

FR4, FR7, FR15, FR19, FR21, FR27, FR31, FR36, FR37

Reading progress, WebGPU browser check, render shader annotations, camera widget, personality transition demo, full frame loop diagram, responsive polish, typography plugin.

### Vision

FR28 (Zig teaser is MVP-lite text only), FR38, FR39

Glossary mode with hover tooltips. Light/dark theme toggle. These require a cross-cutting infrastructure investment (term registry, theme context) not justified for a two-person project at launch.

## Constraints

- **SvelteKit + Svelte 5 runes** — no class-based components, no legacy `$:` reactive syntax. Use `$state`, `$derived`, `$effect`.
- **TailwindCSS** — all styling via Tailwind utility classes. No separate CSS files per component unless unavoidable for canvas sizing.
- **TypeScript strict mode** — all component props typed. No `any`.
- **Bun** — `bun run dev`, `bun run build`. No npm or yarn commands.
- **Canvas 2D only** — no WebGPU, no Three.js, no WebGL on this page.
- **No mdsvex for interactive sections** — pure Svelte components give full control over interactivity. mdsvex is available for prose-only sections if convenient but is not required.
- **No Zig code yet** — the Zig section is a teaser only. Do not invent code examples for it.
- **Shiki dynamic import** — syntax highlighting must not block initial page render.

## Assumptions & Risks

**Risks**

- **Demo complexity creep** — 10 sections with interactive demos is a lot of Canvas 2D code. Each demo needs its own animation loop, resize handling, and keyboard/pointer events. Risk: individual demos become mini-projects. Mitigation: keep demo canvases small (max 400×300px), limit boid counts to 30–50, share a common Canvas2D utility module.

- **Svelte 5 runes + Canvas lifecycle** — Canvas animation loops need to start/stop on mount/unmount. In Svelte 5, `$effect` replaces `onMount`/`onDestroy`. The pattern is workable but needs to be established once and reused across all demo components. Risk: inconsistent teardown causes memory leaks or phantom animation loops in dev HMR.

- **Shiki bundle** — Shiki with full language support is large (~2MB). Dynamic import mitigates this, but first-render of code blocks will have a visible delay if the user scrolls fast. Mitigation: load Shiki on idle after page paint using `requestIdleCallback`, pre-highlight for the first visible code block.

- **Accuracy drift** — code snippets sourced via `?raw` stay current automatically. Diagrams (drawn in Canvas or SVG) do not. Any architectural change to the GPU pipeline or struct layout requires a manual diagram update. Risk: diagrams become wrong after the next sprint. Mitigation: note in each diagram component which source file it corresponds to.

**Assumptions**

- The BoidState struct layout (position, velocity, etc.) is stable enough for a memory diagram. If it changes, the diagram component needs to be updated manually.

- The 7 personality types and their canonical colors in `PERSONALITY_COLORS` are stable. The explainer hardcodes these values.

- `boid-steering.wgsl` and `boid-render.wgsl` are the canonical shader files. The `?raw` import path in explainer components is `$lib/gpu/shaders/boid-steering.wgsl` and `$lib/gpu/shaders/boid-render.wgsl`.

- Shiki supports WGSL syntax highlighting. If it does not have a built-in WGSL grammar, a TextMate grammar can be loaded manually or GLSL can be used as a close approximation.

- The reader has a mouse or trackpad. Touch/pointer events on demo canvases are nice-to-have, not required for MVP.

## Open Questions

1. **BoidState struct fields** — what are the exact field names, types, and byte offsets in the current `BoidState` GPU struct? The memory layout diagram depends on this. Read `boid-buffers.ts` before building FR11.

2. **Personality transition rules** — what triggers a personality shift? Is stress threshold deterministic or probabilistic? The state-transition diagram (FR25) needs the actual rule logic from `boid-compute.ts` or `boid-steering.wgsl`.

3. **D-005 snapshot bridge** — where exactly is the snapshot bridge pattern implemented? Which file, which function? The FR29 explanation needs to reference the real code location.

4. **Shiki + WGSL** — does Shiki's bundled language list include WGSL? If not, is there a community grammar we can load?

5. **Section ordering** — is "The Camera" (section 9) the right place for the matrix pipeline diagram, or does it fit better in "Rendering" (section 8)? Both sections are adjacent; the current draft puts the matrix diagram in Section 8 (FR20) and points Section 9 at the same FR.

6. **Nav behavior on mobile** — should the sidebar collapse to a top sticky bar or a hamburger drawer on viewports below 1024px? This affects the nav component API.

## Existing System Context

The web3d-space project is a SvelteKit 2.x application on Svelte 5, Vite 7, TailwindCSS 4, and Bun. The boids simulation is fully implemented at `/boids`. The GPU layer lives in `src/lib/gpu/` and includes:

- `types.ts` — `GPUContext`, `GPUInitError`, `GPUInitErrorCode`
- `personality-templates.ts` — 7 personality types with `PERSONALITY_TYPES`, `PERSONALITY_COLORS`, `PERSONALITY_NAMES`, `BoidConfigTemplate`, `PERSONALITY_TEMPLATES`, `DEFAULT_DISTRIBUTION`, `DISTRIBUTION_PRESETS`
- `boid-buffers.ts` — GPU buffer allocation and `BoidConfig` packing (48 bytes / 12 floats per boid)
- `boid-compute.ts` — compute pipeline setup and dispatch
- `boid-render.ts` — render pipeline and instanced draw
- `animation-loop.ts` — `requestAnimationFrame` loop, decoupled from Svelte reactivity
- `camera.ts` — fly-around camera (position, orientation, view/projection matrices)
- `shaders/boid-steering.wgsl` — compute shader for boid steering
- `shaders/boid-render.wgsl` — vertex + fragment shader for instanced boid rendering

The explainer page adds a new route `src/routes/how-it-works/+page.svelte` and a new component tree under `src/lib/components/explainer/`. It imports from `src/lib/gpu/` for type references and from the `.wgsl` files via `?raw` for code snippets. It does not execute any GPU code.

No `/how-it-works` route exists yet. No `explainer/` component directory exists yet. The page is greenfield.
