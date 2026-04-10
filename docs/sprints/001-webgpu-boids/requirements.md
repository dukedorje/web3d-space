---
project: web3d-space
sprint: sprint-001
product: null
created: 2026-04-10
steering_mode: GUIDED
previous_sprint: null
input_quality: existing-prd
source_prd: docs/prd-web3d-boids.md
---

## Product Vision

A GPU-first creative coding environment for the browser — a place to push WebGPU compute to its limits, build living 3D simulations, and share the results with a URL. Starting with a 3D boids simulation where each entity can own its own shader program.

## Functional Requirements

### FR1: WebGPU 3D Scene Rendering
The system shall render a 3D scene using raw WebGPU APIs in a SvelteKit page route. A `<canvas>` element obtains a `GPUDevice`, configures a `GPUCanvasContext`, and executes render passes that write visible pixels. No abstraction libraries (Three.js, Babylon.js).

### FR2: Boid Flocking Simulation
The system shall simulate a flock of boids in 3D space applying separation, alignment, and cohesion steering rules. Each steering rule can be independently zeroed to verify its contribution. Default starting count: 300 boids. World uses toroidal wrapping (boids exiting one side appear on the opposite).

### FR3: GPU Compute Steering
The system shall execute boid steering logic as WebGPU compute shaders operating on GPU storage buffers (`GPUBufferUsage.STORAGE`). Boid position/velocity data remains GPU-resident between frames — no per-frame CPU readback in the hot path. Compute dispatch confirmed via GPU profiling markers where supported.

### FR4: Fly-Around Camera
The system shall provide a fly-around camera with position and orientation controllable via keyboard (WASD for movement, QE or Space/Shift for up/down) and mouse (pointer lock on click for FPS-style look). Default FOV: 75 degrees. Movement speed tunable via scroll wheel.

### FR5: Real-Time Animation Loop
The system shall maintain a `requestAnimationFrame` animation loop targeting 60 FPS. The loop runs outside Svelte's reactive system — not inside `$effect` blocks. Parameter reads (boid count, steering weights) happen once per frame from a non-reactive snapshot. Simulation uses delta-time for frame-rate-independent behavior.

### FR6: Boid Rendering as 3D Entities
The system shall render boids as instanced geometry (cone/wedge mesh) with per-instance transform matrices aligning each boid's forward axis to its velocity vector. Instanced draw call — single draw for all boids sharing geometry.

### FR7: Per-Boid Shader Program Assignment
The system shall support assigning distinct WGSL compute programs to subsets of boids. MVP demonstrates at least 2 distinct programs producing visibly different boid behaviors. The architecture supports per-boid individuation but degrades gracefully if pipeline count exceeds adapter limits or causes >2s compilation stall.

### FR8: WebGPU Detection and Error Display
The system shall detect WebGPU availability at page load and display a user-visible error message in the page DOM when unavailable. Handles both `navigator.gpu` absence and `requestAdapter()` returning null. Also handles `GPUDevice.lost` events mid-session.

### FR9: GPU Resource Cleanup
The system shall release GPU resources (device, buffers, pipelines, canvas context) when the simulation component is destroyed or the page is navigated away. `GPUDevice.destroy()` called on component teardown. Navigating away and back does not monotonically increase GPU memory.

### FR10: Boid Count Control
The system shall expose the boid count as a UI slider (range 10-2000, default 300). Changing the count recreates boid state buffers without full page reload. (Promoted from Growth — referenced in both user journeys.)

## Non-Functional Requirements

### NFR1: Frame Time Budget
60 FPS at 500 boids on Apple M1. 16ms total frame budget: compute ≤4ms, render ≤4ms, CPU encoding ≤2ms, ~6ms headroom. GPU timestamp queries (`GPUQuerySet` with `"timestamp-query"` feature) emitted where adapter supports them.

### NFR2: Cold Start
First rendered frame in under 3 seconds on localhost. Pipeline compilation uses `createComputePipelineAsync` to avoid blocking. Loading indicator shown until first pipeline is ready.

### NFR3: Error Visibility
All GPU errors surface as on-screen DOM messages, not just console.log. Implementation: `device.pushErrorScope('validation')` / `popErrorScope()` around pipeline creation, `device.lost.then()` handler, `compilationInfo()` for WGSL errors, all rendered into a DOM overlay.

### NFR4: Module Organization
No file exceeds 400 lines. Suggested modules: `gpu-init.ts`, `boid-compute.ts`, `boid-render.ts`, `camera.ts`, `shaders/` directory, `animation-loop.ts`.

### NFR5: Shader Iteration Speed
WGSL shaders stored as `.wgsl` files imported via Vite `?raw` or a Vite plugin. Shader changes trigger HMR where possible, recompiling the pipeline without resetting boid state.

### NFR6: GPU Memory Bounded
At 500 boids: ~64KB state buffers (double-buffered), ~10KB geometry, <256B uniforms. Pipeline objects monitored — FR9 deduplication threshold if pipeline memory exceeds 5MB.

## Technical Constraints

### TC1: WebGPU Adapter Acquisition Is Async and Fallible
`requestAdapter()` and `requestDevice()` are async and can return null. Device limits (`maxComputeWorkgroupsPerDimension`, `maxStorageBuffersPerShaderStage`, etc.) vary by browser and hardware. Code must query `device.limits` at runtime.

### TC2: Pipeline Compilation Cost
Pipeline creation is 5-50ms per pipeline. At 500 boids with unique shaders, compilation could take 5 seconds. Use `createComputePipelineAsync`, show loading indicator, begin rendering when first pipeline is ready.

### TC3: WGSL Language Constraints
No recursion, limited dynamic indexing, no function pointers. Workgroup shared memory limited to ~16KB on M1. Atomics limited to i32/u32. Neighbor iteration must use fixed-bound loops.

### TC4: Command Encoder Single-Use
Each frame needs a new `GPUCommandEncoder`. Compute and render passes in same command buffer execute in order. Double-buffering required for boid state (read from buffer A, write to buffer B, swap).

### TC5: Canvas DPR and Resize
Canvas backing store must match `devicePixelRatio * CSS_size` for crisp rendering on Retina displays. `ResizeObserver` on canvas element for resize handling.

### TC6: Secure Context Required
`navigator.gpu` only available in secure contexts (HTTPS or localhost). Dev server on localhost satisfies this.

### TC7: TypeScript WebGPU Types
`@webgpu/types` must be added as a dev dependency. Not currently in package.json.

## Security Requirements

### SEC1: Secure Context
WebGPU requires HTTPS or localhost. Development on localhost is sufficient.

### SEC2: No Cross-Origin Concerns
MVP loads no external resources. WGSL shaders are local imports. CORS not a concern.

### SEC3: GPU Sandbox
WebGPU runs in sandboxed GPU process. Malformed shaders cause validation errors or device loss, not security vulnerabilities. Device loss must be handled gracefully.

## Open Questions

1. **Camera control mode**: Pointer lock (FPS-style) vs click-drag (orbit-style)? Journeys suggest pointer lock. Resolve during implementation.
2. **Boid steering parameter UI**: Journey 2 describes tweaking separation/cohesion/alignment via sliders. Should this be in MVP scope? Recommend yes — it's the primary interactive feedback loop.
3. **Adapter failure modes**: Should FR8 distinguish between no WebGPU API, null adapter, device request failure, and mid-session device loss? Recommend handling all four.
4. **WGSL import method**: Vite `?raw` imports vs custom Vite plugin for `.wgsl` files? Resolve during implementation spike.

## Scope Boundaries

### In Scope
- FR1-FR10 as defined above
- WebGPU compute pipeline for boid steering (separation, alignment, cohesion)
- Instanced rendering of boid geometry (cone/wedge)
- Fly-around camera with pointer lock and keyboard
- Per-boid shader assignment (2+ distinct programs demonstrated)
- WebGPU detection with DOM error messaging and device loss handling
- GPU resource cleanup on SvelteKit navigation
- Boid count slider UI
- Delta-time frame updates
- requestAnimationFrame loop decoupled from Svelte reactivity

### Out of Scope
- FR11-FR18 from PRD (Growth/Vision tier)
- WebGL fallback
- Zig/WASM compile pipeline
- Elysia/Bun WebSocket endpoint
- Shader hot-swap at runtime
- GPU spatial partitioning
- ML inference
- Visualization sharing/bundling
- Auth system (existing scaffold ignored)
- Mobile/touch input
- Persistent state
- Production deployment

## Assumptions

| Assumption | Validation Method | Impact if Wrong |
|---|---|---|
| Chrome 113+ on M1 Mac is primary dev target | Confirm with user | Safari/Firefox may need conditional code paths |
| 2-10 distinct GPUComputePipelines compile in <1s on M1 | Spike: create N pipelines, measure | Per-boid shader architecture needs uber-shader fallback |
| Storage buffers hold 500+ boids without exceeding limits | Check `maxStorageBufferBindingSize` (~128MB typical) | Extremely unlikely at this scale |
| SvelteKit `onDestroy` fires reliably for canvas cleanup | Test navigation lifecycle | May need `beforeNavigate` hook |
| rAF outside Svelte reactivity achieves 60 FPS without interference | Build minimal rAF loop, verify | May need Web Worker or OffscreenCanvas |
| Instanced rendering (single draw call) is correct for MVP | Validate target FPS with instanced draw | Per-boid render pipelines would add major complexity |
| Vite `?raw` import works for `.wgsl` files | Test raw import in dev server | Need custom Vite WGSL plugin |
| `@webgpu/types` provides complete type coverage | Add dependency, verify | May need manual type augmentation |

## Integration Constraints

- **SvelteKit routing**: Boids page must be a SvelteKit route (e.g., `src/routes/+page.svelte` or `src/routes/boids/+page.svelte`)
- **Svelte 5 runes**: All components use `$state`, `$derived`, `$effect`, `$props` — not legacy stores
- **Vite 7 plugins**: WGSL loader must integrate with existing plugin chain in `vite.config.ts`
- **TypeScript strict**: All WebGPU API usage must be properly typed
- **Bun**: All dependency additions via `bun add`
- **Auth middleware**: `hooks.server.ts` runs on every request (harmless but present)
- **Vitest**: Pure math functions (camera, steering vectors) testable in server project; GPU code requires browser project with Chromium

## Existing Codebase Inventory

Greenfield for GPU work. Existing scaffold:
- SvelteKit 2.47.1 + Svelte 5.41.0 + Vite 7.1.10 + TailwindCSS 4
- Drizzle ORM + SQLite (user/session tables — not relevant)
- Auth middleware in hooks.server.ts (passthrough for GPU routes)
- ~15 source files, v0.0.1
- No WebGPU, WASM, or 3D code exists
