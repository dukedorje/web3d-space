---
sprint: sprint-002
phase: discovery
created: 2026-04-10
status: complete
---

# Sprint 002 Discovery: Boid Personality System

## Sprint 001 Completion Summary

Sprint 001 delivered the core WebGPU boids simulation:

- **GPU Pipeline**: Double-buffered compute + single render pass (D-001). Ping-pong storage buffers at 48 bytes/boid (position vec3f + pad + velocity vec3f + group_id u32 + pad vec4f). Uniform buffer at 112 bytes carrying simulation params + VP matrix.
- **Multi-Variant Compute**: Two WGSL shader variants — `boid-steering-default.wgsl` (flocking: separation/alignment/cohesion with crowd-speed-boost) and `boid-steering-loner.wgsl` (gentle crowd avoidance + wander). Dispatched via `dispatchAllVariants()` which runs each variant over the full boid count, with each shader filtering by `group_id`.
- **Instanced Rendering**: Cone geometry (8-sided) with per-group shape scaling and coloring in the vertex shader. Group 0 = cyan cones (flockers), Group 1 = orange flattened deltas (loners).
- **Fly-Around Camera**: `gl-matrix`-based FPS camera with pointer lock, WASD movement, scroll-wheel speed.
- **Reactive UI**: Svelte 5 `$state` sliders for boid count, separation, alignment, cohesion. D-005 snapshot bridge feeds the rAF loop.
- **Animation Loop**: `createAnimationLoop()` drives compute + render per frame with delta-time clamping, buffer recreation on boid count change.

All code lives under `src/lib/gpu/` (flat module structure per D-003). Shaders use Vite `?raw` import per D-004.

## Architecture Shift for Sprint 002

The current system uses **multiple WGSL shader files** with **one compute pipeline per variant** and **group_id-based dispatch**. Each shader is a standalone file that duplicates struct definitions and utility functions (wrapPosition, toroidalOffset, limitVec). Adding a new personality type requires:

1. Writing a new ~130-line WGSL file with duplicated boilerplate
2. Adding a new pipeline compilation call
3. Adding a new group_id check
4. Updating the render shader with new color/shape branches
5. Updating `GROUP_COUNT` and initialization logic

This does not scale to 7 personality types.

**Sprint 002 replaces this with a single uber-shader** that reads per-boid configuration from a GPU storage buffer. Personality types become TypeScript template objects that initialize config values (separation weight, alignment weight, wander strength, etc.). The uber-shader reads these values per-boid instead of using hardcoded constants. This means:

- One WGSL compute shader, one compute pipeline
- Per-boid behavior differentiation via data, not code
- Adding a personality type = adding a TypeScript object, not a new shader
- Dynamic personality switching becomes a buffer write, not a pipeline swap

## Key Technical Observations

1. **Buffer layout change**: Current boid state is 48 bytes (position + velocity + group_id + padding). The new per-boid config buffer adds another 48 bytes/boid for steering parameters, personality metadata, and experience tracking. At 300 boids: 14.4KB config buffer. At 2000 boids: 96KB. Well within GPU memory budgets.

2. **Uniform buffer shift**: Current uniform buffer carries global steering params (separation/alignment/cohesion weights, radii, speeds). With per-boid config, these move into the config buffer. The uniform buffer shrinks to simulation globals only (deltaTime, boidCount, worldSize, VP matrix).

3. **Render shader impact**: Current render shader branches on `group_id` for 2 groups. The uber-render approach will branch on `personalityType` for 7 types. WGSL switch/if-else on a u32 with 7 branches is fine for vertex shader performance.

4. **Shared WGSL code**: The current duplication of `wrapPosition`, `toroidalOffset`, `limitVec` across two shaders was acceptable. With a single uber-shader, this duplication is eliminated naturally.

5. **Boid inspector**: Selecting a boid requires reading back a single boid's position from the GPU. WebGPU supports `copyBufferToBuffer` to a MAP_READ staging buffer. The cost is one async readback per click, not per frame.

## Risks

- **Branch divergence in uber-shader**: Boids with different personalities in the same workgroup will diverge on branches. At 7 types with 64-thread workgroups, divergence is inevitable but the per-boid loop body (O(n) neighbor scan) dominates runtime. Branch overhead is negligible compared to the neighbor loop.
- **Config buffer binding**: Adding a fourth storage buffer to the compute bind group layout changes the bind group descriptor. All existing bind group creation code must be updated.
- **Dynamic personality transitions**: Writing to the config buffer from the compute shader (updating stress/experience) means the config buffer needs `read_write` access in compute, not just `read`.
