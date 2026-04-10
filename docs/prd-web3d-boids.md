---
title: web3d-space Boids Simulation
created: 2026-04-10
status: validated
scope_tier: mvp
---
# PRD: web3d-space Boids Simulation

## Problem Statement

The browser is powerful enough to run real GPU compute workloads, but there is no good scratchpad for interactive 3D visualizations that includes the full stack — GPU shaders, compute pipelines, and a web UI — without a heavy framework getting in the way. This project is a creative coding environment for experimenting with WebGPU compute and render pipelines, starting with a 3D boids simulation. The goal is to make GPU experimentation in the browser fast and fun, with a path toward compiling Zig to WASM for CPU-side logic and running ML inference on the GPU. If it stops being fun, we've lost the plot.

## User Personas

**Duke (father)** — wants to push the GPU hard, experiment with per-entity shader programs, and eventually wire in Zig-compiled WASM and ML inference. Comfortable with low-level graphics concepts. Cares deeply about the feedback loop: change something, see it move.

**Son** — wants to see cool stuff happen on screen. Will interact with camera controls, tweak parameters, and eventually write shader code. The project succeeds if he wants to come back to it.

## User Journeys

**Journey 1: First Flock**
Duke opens the app for the first time. The page loads, detects WebGPU, and immediately starts rendering. A few hundred boids are moving — not just dots, but oriented mesh shapes that bank and turn. He grabs the mouse and flies through the flock. Something about the way they scatter and regroup is satisfying. He bumps the boid count slider up to stress the GPU. Still smooth. He opens the browser devtools, looks at the GPU timeline, and grins.

**Journey 2: Son Takes the Controls**
Duke's son sits down. The boids are already running. He grabs WASD and starts flying. He asks: "why do they all clump together?" Duke says "that's cohesion — want to turn it off?" They find the parameter and crank it to zero. The flock explodes into chaos. Then they turn up separation until the boids avoid each other like they're allergic. They spend twenty minutes just tweaking numbers. Nobody writes any code. That's fine.

**Journey 3: Shader Divergence Experiment**
Duke wants to see what happens when boids have different steering behaviors encoded directly in their shader programs. He writes two WGSL variants — one with stronger alignment, one that ignores the flock entirely and wanders. He assigns each to a subset of boids. The flock splits into two behavioral clusters. He starts thinking about whether the loner boids could eventually "learn" to rejoin. That's the ML path. He makes a note and ships it to Vision tier.

## Success Metrics

- Simulation runs at a stable 60 FPS on a mid-range GPU (M1 Mac or equivalent) with 500+ boids.
- Flock behavior is visually recognizable as flocking — boids group, separate, and align without manual tuning.
- Camera controls are responsive with no perceptible input lag.
- The page loads and starts rendering without any setup steps beyond opening a URL.
- Per-boid shader assignment is demonstrated working with at least 2 distinct WGSL programs.
- Both Duke and his son voluntarily open the app more than once.

## Functional Requirements

**FR1. [MVP]** The system shall render a 3D scene using WebGPU APIs (raw, without Three.js or Babylon.js abstractions) in a SvelteKit page.

**FR2. [MVP]** The system shall simulate a flock of boids in 3D space applying separation, alignment, and cohesion steering rules.

**FR3. [MVP]** The system shall execute boid steering logic as WebGPU compute shaders operating on GPU storage buffers, with boid state remaining GPU-resident between frames.

**FR4. [MVP]** The system shall provide a fly-around camera defined by position and orientation, controllable via keyboard and mouse input.

**FR5. [MVP]** The system shall maintain a real-time animation loop using `requestAnimationFrame` targeting 60 FPS, running outside Svelte's reactive system so that reactive state changes do not trigger GPU resubmission.

**FR6. [MVP]** The system shall render each boid as a visible 3D entity (mesh or instanced geometry) with orientation aligned to its velocity vector.

**FR7. [MVP]** The system shall assign each boid its own WGSL compute shader program as the default configuration. Shader programs may be shared when memory or performance requires it (see FR9), but the default is per-entity.

**FR8. [MVP]** The system shall detect WebGPU availability at page load and display a user-visible error message in the page DOM when WebGPU is unavailable.

**FR9. [Growth]** The system shall allow boid shader programs to be shared or deduplicated automatically when a configurable memory or pipeline-count threshold is exceeded.

**FR10. [Growth]** The system shall compile Zig source files to WASM modules and serve them via SvelteKit as part of the Vite build pipeline.

**FR11. [Growth]** The system shall execute CPU-side simulation logic (e.g., spatial data structures, parameter updates) in Zig-compiled WASM modules rather than JavaScript.

**FR12. [Growth]** The system shall expose a WebSocket endpoint implemented with Elysia or Bun's native WebSocket API.

**FR13. [Growth]** The system shall support hot-swapping a boid's assigned shader at runtime without stopping or restarting the simulation.

**FR14. [Growth]** The system shall implement GPU-side spatial partitioning (e.g., uniform grid) for sub-linear neighbor queries during the steering compute pass.

**FR15. [Growth]** The system shall fall back to a WebGL render path when WebGPU is unavailable in the host browser.

**FR16. [Vision]** The system shall support per-boid shader programs that produce divergent, individualized behavior over the course of the simulation.

**FR17. [Vision]** The system shall support GPU-based ML inference via WebGPU compute shaders, allowing boid behavior to be influenced by learned model weights.

**FR18. [Vision]** The system shall provide a mechanism to package and share a visualization as a standalone URL or bundle.

**FR19. [Growth]** The system shall render a configurable number of boids exposed via a UI control, enabling scale stress-testing without code changes.

## Non-Functional Requirements

**NFR1. Performance** — The simulation shall sustain 60 FPS at 500 boids on an Apple M1 or equivalent discrete GPU. Frame time budget for the combined compute + render pass is 16 ms. GPU profiling markers shall be emitted so frame time is measurable in browser devtools.

**NFR2. Developer Iteration Speed** — Shader source changes shall be reflected without a full page reload where HMR or hot-swap mechanisms are available. Cold page load to first rendered frame shall complete in under 3 seconds on localhost.

**NFR3. Failure Transparency** — GPU errors, WGSL compilation failures, and adapter initialization failures shall surface as visible on-screen messages, not silent console logs. The simulation shall never hang silently on a failed GPU operation.

**NFR4. Code Legibility** — GPU pipeline setup, compute dispatch, and render pass code shall be organized in modules that can be read and modified independently (e.g., separate files for pipeline setup, boid logic, camera math). No single file exceeds 400 lines.

## Scope Boundaries

### In Scope

- WebGPU compute shader implementation of boid steering (separation, alignment, cohesion)
- Raw WebGPU render pipeline for instanced boid geometry
- Fly-around camera with keyboard and mouse input
- Per-boid WGSL shader assignment
- SvelteKit page as host for the GPU canvas
- WebGPU availability detection and error display
- Boid count UI control
- requestAnimationFrame loop decoupled from Svelte reactivity
- Zig-to-WASM build integration (Growth)
- Elysia/Bun WebSocket endpoint (Growth)
- GPU spatial partitioning (Growth)
- WebGL fallback (Growth)
- Per-boid shader hot-swap (Growth)
- GPU ML inference (Vision)
- Visualization sharing/bundling (Vision)

### Out of Scope

- Authentication, user accounts, or any multi-user features
- Production deployment infrastructure
- Three.js, Babylon.js, or any WebGPU abstraction library
- React, Vue, or any non-Svelte frontend framework
- Any mobile or touch input support
- Persistent storage of simulation state
- Multiplayer or networked simulation sync

## MVP / Growth / Vision Tiers

### MVP
FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8

A 3D boids simulation running entirely on GPU compute, rendered with raw WebGPU, inside a SvelteKit page. Fly-around camera. Each boid has its own shader. The page tells you clearly if WebGPU isn't available.

### Growth
FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR19

Zig-to-WASM pipeline, Elysia/Bun WebSocket API, shader hot-swap, GPU spatial partitioning, WebGL fallback, shader deduplication, and a boid count slider.

### Vision
FR16, FR17, FR18

Per-boid behavioral divergence over time, GPU ML inference influencing boid behavior, and shareable visualization bundles.

## Constraints

- **WebGPU only for MVP** — no abstraction library. WGSL is the shader language.
- **SvelteKit 2.x + Svelte 5** — the existing scaffold is not negotiable for MVP. Vite 7 is the build tool.
- **Bun as package manager and runtime** — npm/yarn are not used.
- **TypeScript strict mode** — all new source files conform to the existing tsconfig.
- **No existing GPU code** — the WebGPU pipeline, compute shaders, and boid simulation are built from scratch.
- **No existing Zig toolchain** — Zig-to-WASM integration (FR10, FR11) requires a custom Vite plugin or build script. This is deferred to Growth.
- **Two-person team** — complexity that requires synchronization overhead is a bug.

## Assumptions & Risks

**Risks**

- **Per-boid unique pipelines at scale** — WebGPU imposes limits on the number of distinct pipeline objects. Compiling hundreds of unique WGSL programs at startup may cause visible stalls and may hit adapter limits. This is the highest technical risk in MVP. Mitigation: implement shader sharing (FR9) early if pipeline count exceeds 64 during development.

- **No Zig-to-Vite plugin exists** — Zig compilation to WASM requires either a custom Vite plugin or a pre-build step. This work is non-trivial and is the primary reason FR10/FR11 are deferred to Growth.

- **GPU debugging is immature** — there is no WGSL step-through debugger. All GPU debugging happens via printf-equivalent buffer readbacks, validation layers, and browser devtools GPU timeline. Plan for extra iteration time on compute shader logic.

- **SvelteKit + Bun/Elysia adapter compatibility** — the SvelteKit adapter for Bun/Elysia has not been validated in this scaffold. This needs a spike before committing to FR12.

**Assumptions**

- "Intelligent" shaders means parameterized WGSL programs (uniform values, variant source strings) for MVP/Growth, not runtime code generation or evolved programs. Runtime code generation is Vision-tier (FR16).

- "Per-entity shader" in FR7 means distinct WGSL source compiled into distinct pipeline objects, not per-instance data pushed through a shared pipeline. If pipeline count limits make this impractical, FR9 deduplication activates.

- The WebSocket API (FR12) has no defined consumer in MVP. It is scaffolded in Growth as a future hook for tooling, external control, or multiplayer.

- Zig-WASM integration assumes the Zig toolchain is installable on the development machine and that Vite can be extended to invoke it as a pre-transform step.

## Open Questions

1. **Pipeline limit**: What is the practical per-adapter limit on unique `GPURenderPipeline` objects in the target browser? At what boid count does pipeline compilation become a visible stall?

2. **"Intelligent" shader definition**: For FR16, does behavioral divergence mean (a) each boid has distinct uniform parameter values, (b) each boid has distinct WGSL source with structural differences, or (c) shader programs are modified at runtime by some learning mechanism?

3. **Boid parameters**: What are the initial values for steering radii, max speed, max force, and world boundary dimensions? Are boundaries hard walls, soft repulsion, or toroidal wrapping?

4. **Camera spec**: Which keys map to which camera axes? What are the default sensitivity and field-of-view values?

5. **Performance baseline**: What is the minimum acceptable boid count at 60 FPS? Is 500 on M1 the floor, or should it be higher?

6. **WebSocket consumer**: Is FR12 purely infrastructure scaffolding, or is there an intended first consumer (e.g., external shader editor, parameter control panel)?

7. **Zig build integration**: Will the Zig build run as a Vite plugin, a pre-build npm script, or a separate Makefile target? This decision affects dev workflow.

## Existing System Context

The project is a greenfield SvelteKit 2.47.1 application running on Svelte 5.41.0, Vite 7.1.10, and TailwindCSS 4. Data persistence uses Drizzle ORM with SQLite. TypeScript strict mode is enabled throughout. Bun is used as the package manager and runtime. An authentication scaffold based on Lucia exists in the codebase but is not relevant to this PRD.

The project is at v0.0.1 with approximately 15 source files. No WebGPU, WASM, Zig, Elysia, or boids code exists yet. The existing scaffold provides routing, layout, and auth plumbing — the GPU work starts from a blank SvelteKit page component.
