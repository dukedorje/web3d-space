---
sprint: sprint-001
phase: 2A
created: 2026-04-10
decisions: 6
status: proposed
---

# Architecture Decisions

## D-001: GPU Pipeline Architecture — Double-Buffered Compute + Single Render Pass

**Significance**: CRITICAL

**Context**: FR3 requires boid state to remain GPU-resident between frames with no per-frame CPU readback. FR5 requires a 60 FPS animation loop with delta-time. TC4 mandates a new command encoder per frame and double-buffering for boid state. NFR1 budgets compute at 4ms, render at 4ms, CPU encoding at 2ms. The entire simulation hinges on getting this pipeline structure right — every cluster depends on it.

**Options**:

| Option | Pros | Cons |
|--------|------|------|
| **A: Single command buffer, compute-then-render, ping-pong buffers** — One `GPUCommandEncoder` per frame encodes a compute pass (read buffer A, write buffer B) followed by a render pass (read buffer B for instanced draw). Swap A/B each frame. | Simple mental model. Compute and render are ordered within a single `queue.submit()`. No synchronization complexity. Matches TC4 exactly. | Cannot overlap compute and render on different frames. Slight inefficiency if GPU could pipeline. |
| **B: Separate command buffers for compute and render** — Submit compute and render as separate `queue.submit()` calls per frame, relying on WebGPU's sequential queue ordering. | Could allow future pipelining. Clearer separation of concerns. | No actual benefit — WebGPU single-queue is already ordered. Adds submit overhead. More complex buffer management. |
| **C: Render bundles for static geometry** — Pre-record render commands via `GPURenderBundle` and replay each frame. | Eliminates per-frame CPU render encoding overhead. Research shows ~10x speedup in Babylon.js benchmarks. | Boid transforms change every frame (instanced), so the draw call itself must be re-encoded or use indirect draws. Render bundles help more with static scenes. Premature optimization for MVP. |

**Recommendation**: **Option A** — Single command buffer with ping-pong state buffers.

This is the textbook approach for GPU particle/boid simulations. One encoder, compute pass first, render pass second, swap buffers. It satisfies TC4, keeps GPU state resident (FR3), and is the simplest correct solution. Render bundles (Option C) can be explored post-MVP if CPU encoding exceeds the 2ms budget, but at 300-500 boids with a single instanced draw call, encoding cost is negligible.

**Buffer layout**: Two `GPUBuffer` objects for boid state (position vec3, velocity vec3, padding — 32 bytes per boid). At 500 boids, each buffer is 16KB. Double-buffered total: 32KB. Well within NFR6's 64KB budget. A separate uniform buffer (< 256 bytes) carries simulation parameters (deltaTime, steering weights, boid count) and camera matrices.

**Consequences**:
- All compute shaders must read from buffer[N % 2] and write to buffer[(N + 1) % 2].
- Render pass reads from the write-target buffer (it contains the just-computed positions).
- Buffer creation, bind group creation, and swap logic become foundational code that every other module depends on.
- Adding FR7 (per-boid shaders) means multiple compute dispatches per frame against the same ping-pong buffers — the architecture must support this cleanly.

---

## D-002: Per-Boid Shader Strategy — Shader Variant Groups with Async Compilation

**Significance**: CRITICAL

**Context**: FR7 requires assigning distinct WGSL compute programs to subsets of boids. The PRD's default is per-entity unique shaders, with graceful degradation. TC2 warns that pipeline compilation is 5-50ms per pipeline, and 500 unique shaders could take 5+ seconds. The sprint scope identifies this as the highest technical risk (Cluster D). NFR2 requires first frame in under 3 seconds.

**Options**:

| Option | Pros | Cons |
|--------|------|------|
| **A: Shader variant groups** — Define N distinct WGSL shader variants (MVP: 2-4). Each variant compiles to one `GPUComputePipeline`. Boids are assigned to groups by index ranges. Each frame dispatches N compute passes, one per variant, each operating on its slice of the boid buffer. | Compilation cost scales with variant count (2-4 pipelines = 10-200ms). Graceful degradation is trivial — reduce variants. Visibly different behaviors demonstrated. Aligns with FR7's "at least 2 distinct programs." | Not truly per-boid unique. Requires partitioning boid buffer by group or using an indirection buffer. Multiple dispatches per frame (but N is small). |
| **B: Uber-shader with per-boid parameters** — Single WGSL compute shader with branching based on a per-boid `shaderType` uniform/storage value. All boids processed in one dispatch. | Single pipeline, single dispatch. No compilation scaling concern. Simple buffer layout. | Not "distinct WGSL programs" — it is one program with branches. WGSL has no function pointers. Branch divergence within a workgroup wastes GPU lanes. Does not satisfy the spirit of FR7. |
| **C: True per-boid pipelines** — Compile a unique `GPUComputePipeline` for each boid. | Maximum individuation. Matches PRD FR7 literally ("each boid has its own WGSL compute shader program"). | Compilation at 500 boids: 2.5-25 seconds. Memory: each pipeline object has overhead. Dispatch: 500 dispatches per frame. Completely impractical at MVP scale. TC2 explicitly warns against this. |
| **D: Hybrid — variant groups now, per-boid indirection later** — Start with Option A for MVP. Add a `shader_id` per-boid storage field that indexes into a variant table. Growth tier (FR16) can increase variant count toward true individuation. | Clean upgrade path. MVP is deliverable. Vision-tier individuation is architecturally supported. | Slightly more complex buffer layout than pure Option A (need per-boid group assignment). |

**Recommendation**: **Option D (hybrid)** — Variant groups with per-boid group assignment.

MVP demonstrates 2-3 WGSL shader variants compiled into separate `GPUComputePipeline` objects. Each boid carries a `group_id: u32` in its state buffer. Per-frame, dispatch one compute pass per variant, filtering by group_id (or partition the buffer so boids in group 0 are indices 0..K, group 1 is K..N). Use `createComputePipelineAsync` (NFR2) so compilation is non-blocking. Show a loading indicator until all pipelines are ready.

This satisfies FR7 ("at least 2 distinct programs producing visibly different boid behaviors"), respects TC2 (pipeline compilation cost bounded), and leaves a clean upgrade path to FR16 (Vision-tier per-boid divergence) by increasing variant count over time.

**Consequences**:
- Boid state buffer gains a `group_id` field (32 bytes becomes 48 bytes per boid with alignment, or use a separate group assignment buffer).
- The animation loop must iterate over variant pipelines and dispatch each one.
- Shader authoring must follow a convention: each variant is a `.wgsl` file that reads/writes the same buffer layout but implements different steering logic.
- Pipeline compilation is async — the render loop must handle the "not all pipelines ready" state gracefully.

---

## D-003: Module Organization — Layered GPU Modules with Clear Dependency Direction

**Significance**: HIGH

**Context**: NFR4 requires no file exceeds 400 lines and suggests specific module names. The project is greenfield for GPU code. Two developers need to work on different parts without conflicts. The codebase currently has ~15 files with a clear `src/lib/` convention.

**Options**:

| Option | Pros | Cons |
|--------|------|------|
| **A: Flat module directory** — All GPU modules in `src/lib/gpu/`: `gpu-init.ts`, `boid-compute.ts`, `boid-render.ts`, `camera.ts`, `animation-loop.ts`, `types.ts`, `shaders/`. | Simple. Matches NFR4 suggestion. Easy to navigate for a small project. No deep nesting. | May get crowded if Growth-tier features add many files. No sub-grouping. |
| **B: Feature-grouped directories** — `src/lib/gpu/core/` (init, types), `src/lib/gpu/boids/` (compute, render), `src/lib/gpu/camera/`, `src/lib/gpu/shaders/`. | Better organization at scale. Clear ownership boundaries. | Over-structured for MVP's ~8 GPU files. Two-person team does not need directory-level ownership boundaries. |

**Recommendation**: **Option A** — Flat module directory under `src/lib/gpu/`.

For MVP with ~8-10 GPU-related files, a flat directory is the right level of organization. The dependency direction is clear without sub-directories:

```
src/lib/gpu/
  types.ts           — Shared TypeScript types and interfaces (BoidState, SimParams, etc.)
  gpu-init.ts        — Adapter/device acquisition, error handling (FR1, FR8)
  boid-buffers.ts    — Buffer creation, ping-pong swap, resize (FR3, FR10)
  boid-compute.ts    — Compute pipeline creation, dispatch logic (FR3, FR7)
  boid-render.ts     — Render pipeline, instanced draw, geometry (FR6)
  camera.ts          — Camera math, input handling, projection/view matrices (FR4)
  animation-loop.ts  — rAF loop, frame timing, parameter snapshot (FR5)
  errors.ts          — Error scope helpers, device lost handler, DOM overlay (FR8, NFR3)
  shaders/           — WGSL files (see D-004)
```

Dependency flows downward: `animation-loop` depends on `boid-compute`, `boid-render`, `camera`. Those depend on `boid-buffers` and `gpu-init`. `types.ts` and `errors.ts` are leaf dependencies.

**Consequences**:
- All GPU code lives under `$lib/gpu/` and is importable via SvelteKit's `$lib` alias.
- The Svelte component (page route) imports only `animation-loop.ts` and `gpu-init.ts` — it does not reach into compute/render internals.
- Growth-tier additions (spatial partitioning, shader hot-swap) add files to this directory. If it exceeds ~15 files, refactor into sub-directories then — not prematurely.

---

## D-004: WGSL Management — Raw Files with Vite `?raw` Import

**Significance**: HIGH

**Context**: NFR5 requires WGSL stored as `.wgsl` files with Vite integration and ideally HMR. TC3 constrains WGSL language features. FR7 requires multiple shader variants. Open Question 4 in requirements.md asks about `?raw` vs custom plugin.

**Options**:

| Option | Pros | Cons |
|--------|------|------|
| **A: Vite `?raw` import** — Store `.wgsl` files in `src/lib/gpu/shaders/`, import as `import shaderSrc from './shaders/boid-steering-default.wgsl?raw'`. TypeScript declaration file for `*.wgsl` module. | Zero configuration. Vite supports `?raw` natively. No plugin dependency. Shader source is a string at build time. Simple to understand. | No WGSL-specific preprocessing (no `#include`, no template substitution). HMR replaces the string but does not auto-recompile pipelines — needs manual wiring. |
| **B: Custom Vite plugin** — Write a Vite plugin that handles `.wgsl` files with optional preprocessing (includes, defines). | Could support `#include` for shared WGSL snippets. Could wire HMR to pipeline recompilation automatically. | Custom code to maintain. Complexity not justified for MVP's 2-4 shader files. WGSL has no standard preprocessor syntax. Premature. |
| **C: Inline template literals** — Write WGSL as TypeScript template literal strings. | No import mechanism needed. Can use JS string interpolation for parameterization. | Violates NFR5 (shaders in separate files). No syntax highlighting. Poor DX for shader iteration. |

**Recommendation**: **Option A** — Vite `?raw` import with a TypeScript declaration.

Add a `src/lib/gpu/shaders/wgsl.d.ts` declaration:
```typescript
declare module '*.wgsl?raw' {
  const src: string;
  export default src;
}
```

Shader files live in `src/lib/gpu/shaders/`:
```
shaders/
  boid-steering-default.wgsl   — Default flocking behavior
  boid-steering-loner.wgsl     — Variant: ignores cohesion (FR7 demo)
  boid-render.wgsl             — Vertex + fragment shaders for instanced rendering
  common.wgsl                  — Shared struct definitions (copy-pasted into each file for now)
```

For shared WGSL code (struct definitions), use copy-paste across files for MVP. If duplication becomes painful (3+ files sharing >20 lines), add a simple build-time concatenation in Growth tier. WGSL does not support `#include` natively, and inventing a preprocessor for 2-4 files is not worth it.

For HMR: Vite will trigger HMR when a `.wgsl` file changes. The animation loop module can accept HMR updates and recompile the affected pipeline without resetting boid state — this requires explicit `import.meta.hot.accept()` wiring in `boid-compute.ts` but is straightforward.

**Consequences**:
- `@webgpu/types` must be added as a devDependency (TC7 — not currently in package.json).
- The `wgsl.d.ts` declaration file must exist for TypeScript to accept `?raw` imports.
- Shared WGSL structs (boid state layout) will be duplicated across shader files. This is acceptable for 2-4 files but becomes a maintenance burden at Growth scale.
- Shader HMR requires explicit wiring — it is not automatic.

---

## D-005: Svelte-GPU Integration — Imperative Lifecycle with Reactive Parameter Bridge

**Significance**: HIGH

**Context**: FR5 explicitly states the animation loop runs outside Svelte's reactive system — "not inside `$effect` blocks." FR10 requires reactive UI controls (sliders) that feed parameters into the GPU loop. This creates a fundamental tension: Svelte 5 runes are reactive, the GPU loop is imperative. The bridge between them is an architectural decision.

**Options**:

| Option | Pros | Cons |
|--------|------|------|
| **A: Snapshot bridge** — Svelte component owns `$state` for UI parameters. A single `$effect` copies current values into a plain JS object (the "snapshot") on change. The rAF loop reads from the snapshot object each frame — no reactive subscription in the hot path. | Clean separation. rAF loop is pure imperative code with zero reactive overhead. Svelte reactivity works naturally for UI. Parameter reads are a single object dereference per frame. | Requires discipline: the rAF loop must never import `$state` runes directly. One `$effect` per parameter group to keep the bridge lean. |
| **B: Svelte store bridge** — Use Svelte 5 `$state` in a shared module. The rAF loop reads `.value` directly from the rune. | No explicit bridge code. Fewer moving parts. | Runes track subscribers — reading `$state` inside rAF could trigger unnecessary reactive tracking if not careful. FR5 explicitly says the loop should not be inside `$effect`. Mixing reactive and imperative in the hot path is fragile. |
| **C: Custom event dispatch** — UI dispatches custom DOM events when parameters change. The animation loop listens for events and updates an internal config object. | Complete decoupling. No reactive system in the loop at all. | Over-engineered for same-component communication. Event listener boilerplate. Harder to reason about timing. |

**Recommendation**: **Option A** — Snapshot bridge.

The Svelte component creates reactive state for UI controls:
```typescript
let boidCount = $state(300);
let separation = $state(1.5);
let alignment = $state(1.0);
let cohesion = $state(1.0);
```

A single `$effect` synchronizes these into a plain object:
```typescript
const simParams = { boidCount: 300, separation: 1.5, alignment: 1.0, cohesion: 1.0 };
$effect(() => {
  simParams.boidCount = boidCount;
  simParams.separation = separation;
  simParams.alignment = alignment;
  simParams.cohesion = cohesion;
});
```

The `animation-loop.ts` module receives `simParams` at initialization and reads from it each frame. It never imports Svelte runes. The GPU uniform buffer is updated from `simParams` at the start of each frame.

For lifecycle: `onMount` initializes the GPU (async), starts the animation loop, binds canvas. `onDestroy` (or Svelte 5's `$effect` return cleanup) stops the loop and calls `GPUDevice.destroy()` (FR9). `beforeNavigate` from SvelteKit provides an additional cleanup hook.

**Consequences**:
- `animation-loop.ts` is a pure TypeScript module with no Svelte imports — it is unit-testable in the server Vitest project.
- The Svelte component is the only file that touches runes.
- Parameter changes take effect on the next frame (one-frame latency), which is imperceptible.
- Boid count changes (FR10) trigger buffer recreation — this is a special case handled by the animation loop detecting `simParams.boidCount` has changed since last frame.

---

## D-006: Camera Implementation — Manual Matrix Math with Pointer Lock Input

**Significance**: MEDIUM

**Context**: FR4 specifies a fly-around camera with WASD + mouse pointer lock, 75-degree FOV, scroll-wheel speed control. The camera is a standard FPS-style camera — well-understood math. No external library is needed or desired (the project avoids abstraction libraries).

**Options**:

| Option | Pros | Cons |
|--------|------|------|
| **A: Manual vec3/mat4 math** — Implement camera projection and view matrices using hand-written TypeScript functions. Store position (vec3), yaw, pitch as state. Compute view matrix from euler angles each frame. | No dependency. Full control. Camera math is ~100 lines. Testable with Vitest (pure math). Educational value for the father-son project. | Must implement `mat4.perspective`, `mat4.lookAt` or equivalent from scratch. Easy to get rotation order wrong. |
| **B: gl-matrix library** — Use `gl-matrix` for vec3/mat4 operations. | Battle-tested. Correct. Well-typed. Fast (Float32Array-backed). | Adds a dependency for ~200 lines of math that could be written by hand. `gl-matrix` v4 is ESM and tree-shakeable, so bundle impact is minimal. |
| **C: wgpu-matrix** — Use the `wgpu-matrix` library designed specifically for WebGPU's coordinate system (clip space Z: [0,1], Y-up). | Handles WebGPU's coordinate system differences from OpenGL (Z clip range, texture coordinate origin). Less likely to hit subtle projection bugs. | Less popular than `gl-matrix`. Another dependency. |

**Recommendation**: **Option B** — `gl-matrix` for matrix/vector operations.

Camera math is not the interesting part of this project — boid behavior and shader individuation are. Use `gl-matrix` v4 (ESM, tree-shakeable, typed) to avoid subtle matrix bugs. The key WebGPU-specific concern is the clip space Z range: WebGPU uses [0, 1] while OpenGL uses [-1, 1]. The `mat4.perspectiveZO` function in `gl-matrix` handles this correctly.

Camera module structure:
- **State**: `position: vec3`, `yaw: number`, `pitch: number`, `speed: number`
- **Input**: `pointerlockchange` + `mousemove` for look. `keydown`/`keyup` for WASD/QE/Space/Shift. `wheel` for speed.
- **Per-frame**: compute forward/right/up vectors from yaw/pitch, apply movement delta, build view matrix, combine with projection matrix, write to uniform buffer.
- **Pointer lock**: Requested on canvas click. Released on Escape. Movement events only processed while locked.

**Consequences**:
- `gl-matrix` added as a runtime dependency (`bun add gl-matrix`).
- Camera module exports a `createCamera()` factory returning `{ update(dt), getViewProjectionMatrix(), handleInput() }`.
- The projection matrix uses `perspectiveZO` (zero-to-one Z range) for WebGPU compatibility.
- Camera uniform data (view-projection matrix, 64 bytes) is written to the uniform buffer alongside simulation parameters each frame.
- Camera math is fully unit-testable (pure functions operating on Float32Arrays).

---

## Requirements Conflicts

No direct conflicts found. The following items are **new implicit requirements** surfaced by these decisions that are not yet captured in `requirements.md`:

1. **`@webgpu/types` devDependency** — TC7 mentions it must be added, but there is no FR or task tracking the actual `bun add -d @webgpu/types` step. This should be part of the Cluster A GPU Foundation stories.

2. **`gl-matrix` runtime dependency** — D-006 recommends adding `gl-matrix`. This is a new dependency not mentioned in requirements.md. It should be captured in the Cluster C stories.

3. **WGSL type declaration file** — D-004 requires a `wgsl.d.ts` file for TypeScript to accept `?raw` imports of `.wgsl` files. This is an implementation artifact but should be an acceptance criterion in the GPU Foundation stories.

4. **Per-boid `group_id` field** — D-002 adds a `group_id: u32` to the boid state buffer. This is not in the original FR2/FR3 buffer layout assumptions. It is architecturally necessary for FR7 but should be documented as part of the buffer layout spec in Cluster B stories.

5. **Pipeline-not-ready state** — D-002's async compilation means the animation loop must handle a state where some shader variant pipelines are not yet compiled. FR5 and FR7 do not explicitly describe this intermediate state. Recommend adding an acceptance criterion: "Simulation renders with available pipelines while remaining pipelines compile asynchronously."

6. **WebGPU clip space Z range** — D-006 notes that WebGPU uses [0, 1] clip Z, not [-1, 1]. This is a technical detail that could cause a subtle all-black-screen bug if missed. Not a requirements conflict, but worth flagging in the camera story acceptance criteria.
