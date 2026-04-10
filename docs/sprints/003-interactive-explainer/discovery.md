---
sprint: sprint-003
phase: discovery
created: 2026-04-10
status: complete
---

# Sprint 003 Discovery: Interactive Explainer Page

## Sprint 001 + 002 Completion Summary

Sprint 001 delivered the core WebGPU boids simulation at `/boids`:

- **GPU Pipeline**: Double-buffered compute + render pass. Ping-pong storage buffers at 48 bytes/boid (`BoidState`: position vec3f + pad + velocity vec3f + pad). Uniform buffer at 96 bytes carrying simulation globals + VP matrix + selection state.
- **Instanced Rendering**: Cone geometry (8-sided) with per-boid orientation from velocity vector. Single draw call via instanced rendering.
- **Fly-Around Camera**: `gl-matrix`-based FPS camera with pointer lock, WASD movement, scroll-wheel speed control.
- **Reactive UI**: Svelte 5 `$state` sliders for boid count and simulation parameters. D-005 snapshot bridge feeds the rAF loop.
- **Animation Loop**: `createAnimationLoop()` drives compute + render per frame with delta-time clamping, buffer recreation on boid count change.

Sprint 002 added the personality system:

- **Uber-Shader (D-007)**: Single `boid-steering.wgsl` compute shader replaced multi-variant system. Per-boid config buffer (48 bytes/boid, D-008) drives all behavior differences.
- **7 Personality Types (D-009)**: Flocker, Loner, Predator, Explorer, Swirler, Timid, Mimic — defined as TypeScript template objects in `personality-templates.ts`. Canonical colors and shapes in render shader.
- **Dynamic Personality (D-011)**: GPU-side stress accumulation and personality transitions. Boids change type based on crowding stress and experience timer.
- **Boid Inspector (D-010)**: Click-to-select via GPU readback + CPU raycast. Inspector panel shows personality details.
- **Distribution UI**: 7 sliders + presets (Balanced, All Flockers, Predator Chaos, Peaceful Flock, Chaos).

All code lives under `src/lib/gpu/` (flat module structure per D-003). Shaders use Vite `?raw` import per D-004. The SvelteKit app uses Svelte 5, TypeScript strict, TailwindCSS 4, Vite 7, and Bun.

## Sprint 003 Goal

Build an interactive educational explainer page at `/how-it-works` that teaches 10 topics — from "What Is a GPU?" to "How does a boid become a Predator?" — using interactive Canvas 2D demos. The target reader is a smart, curious teenager who has never heard of a compute shader. The secondary benefit is living architecture documentation.

The page is greenfield: no `/how-it-works` route exists, no `src/lib/components/explainer/` directory exists.

## Key Technical Observations

1. **Canvas 2D only**: The explainer page uses zero WebGPU. All interactive demos are Canvas 2D. This means the page works in any modern browser, not just those with WebGPU support.

2. **Component structure**: Each of the 10 topic sections becomes a Svelte component under `src/lib/components/explainer/`. The route page (`src/routes/how-it-works/+page.svelte`) composes them and manages navigation state. No component exceeds 400 lines (NFR4).

3. **Shiki for syntax highlighting**: WGSL and TypeScript code blocks use Shiki, loaded via dynamic import to avoid blocking initial render (NFR3). Shiki's WGSL support needs verification — GLSL may be used as a fallback grammar.

4. **Shader source imports**: Code snippets reference actual shader files via `?raw` imports (`$lib/gpu/shaders/boid-steering.wgsl`, `$lib/gpu/shaders/boid-render.wgsl`). This keeps the explainer in sync with the implementation — no drift.

5. **Lazy initialization**: Every Canvas demo uses `IntersectionObserver` to start/stop its animation loop when scrolling into/out of view. No more than 3 Canvas loops run simultaneously (NFR1).

6. **Svelte 5 + Canvas lifecycle**: Canvas animation loops start in `$effect` and clean up on teardown. The pattern needs to be established once as a shared utility and reused across all demo components.

7. **Existing data sources**: `personality-templates.ts` exports `PERSONALITY_TYPES`, `PERSONALITY_COLORS`, `PERSONALITY_NAMES`, `PERSONALITY_TEMPLATES`, `BoidConfigTemplate`, `DISTRIBUTION_PRESETS` — all directly importable for the personality section. `boid-buffers.ts` exports `BoidState` layout constants and `BoidConfig` struct layout.

## Risks

- **Demo complexity creep**: 10 sections with interactive Canvas 2D demos is substantial. Each demo needs its own animation loop, resize handling, and pointer/keyboard events. Mitigation: keep canvases small (max 400x300px), limit boid counts to 30-50, share a common Canvas2D utility module.

- **Svelte 5 runes + Canvas lifecycle**: `$effect` replaces `onMount`/`onDestroy` for starting/stopping animation loops. The pattern is workable but needs to be consistent across all demos to avoid memory leaks in dev HMR. Mitigation: build a `createCanvasDemo()` utility early.

- **Shiki bundle size**: Full Shiki is ~2MB. Dynamic import mitigates first-load impact, but first code block render will have visible delay if the user scrolls fast. Mitigation: load Shiki on idle after initial page paint via `requestIdleCallback`.

- **Accuracy drift for diagrams**: Code snippets sourced via `?raw` stay current automatically. Hand-drawn Canvas diagrams do not. Mitigation: each diagram component includes a comment noting which source file it corresponds to.
