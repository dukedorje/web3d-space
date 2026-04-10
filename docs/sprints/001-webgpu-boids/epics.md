---
sprint: sprint-001
phase: 2B-3
created: 2026-04-10
epics: 5
stories: 15
status: proposed
---

# Epics & Stories

## Requirements Inventory

### Functional Requirements

| ID | Title | Cluster | Epic |
|----|-------|---------|------|
| FR1 | WebGPU 3D Scene Rendering | A | E1 |
| FR2 | Boid Flocking Simulation | B | E2 |
| FR3 | GPU Compute Steering | B | E2 |
| FR4 | Fly-Around Camera | C | E3 |
| FR5 | Real-Time Animation Loop | B | E2 |
| FR6 | Boid Rendering as 3D Entities | B | E2 |
| FR7 | Per-Boid Shader Program Assignment | D | E4 |
| FR8 | WebGPU Detection and Error Display | A | E1 |
| FR9 | GPU Resource Cleanup | A | E1 |
| FR10 | Boid Count Control | E | E5 |

### Non-Functional Requirements

| ID | Title | Applicable Epics |
|----|-------|-----------------|
| NFR1 | Frame Time Budget (60 FPS @ 500 boids) | E2, E3, E4 |
| NFR2 | Cold Start (<3s first frame) | E1, E4 |
| NFR3 | Error Visibility (DOM overlay) | E1 |
| NFR4 | Module Organization (<400 lines/file) | All |
| NFR5 | Shader Iteration Speed (WGSL ?raw + HMR) | E2, E4 |
| NFR6 | GPU Memory Bounded | E2, E4 |

### Architecture Decisions

| ID | Title | Applicable Epics |
|----|-------|-----------------|
| D-001 | Ping-pong buffers, single command buffer | E1, E2 |
| D-002 | Shader variant groups with async compilation | E4 |
| D-003 | Flat src/lib/gpu/ module layout | All |
| D-004 | WGSL ?raw import with type declaration | E2, E4 |
| D-005 | Snapshot bridge for Svelte-GPU integration | E2, E5 |
| D-006 | gl-matrix for camera math | E3 |

### Implicit Requirements (from architecture decisions)

| Item | Source | Epic |
|------|--------|------|
| Add `@webgpu/types` devDependency | D-004, TC7 | E1 |
| Add `gl-matrix` runtime dependency | D-006 | E3 |
| Create `wgsl.d.ts` type declaration | D-004 | E1 |
| Per-boid `group_id` field in state buffer | D-002 | E4 |
| Pipeline-not-ready intermediate state | D-002 | E4 |
| WebGPU clip space Z [0,1] range | D-006 | E3 |

---

## FR Coverage Map

Every FR maps to exactly one epic. No FR is shared across epics.

| FR | Epic | Stories |
|----|------|---------|
| FR1 | E1 | S1.1, S1.2 |
| FR8 | E1 | S1.1, S1.3 |
| FR9 | E1 | S1.3 |
| FR2 | E2 | S2.2 |
| FR3 | E2 | S2.1, S2.2 |
| FR5 | E2 | S2.3 |
| FR6 | E2 | S2.4 |
| FR4 | E3 | S3.1, S3.2 |
| FR7 | E4 | S4.1, S4.2 |
| FR10 | E5 | S5.1, S5.2 |

---

## Epic Summary

| Epic | Title | FRs | Stories | Complexity | Dependencies |
|------|-------|-----|---------|------------|--------------|
| E1 | See a GPU Canvas Render | FR1, FR8, FR9 | 3 | Medium | None |
| E2 | Watch Boids Flock | FR2, FR3, FR5, FR6 | 4 | High | E1 |
| E3 | Fly Through the Flock | FR4 | 2 | Medium | E1 |
| E4 | See Different Boid Behaviors | FR7 | 2 | High | E2 |
| E5 | Tweak the Simulation | FR10 | 2 | Low | E2 |

---

## E1: See a GPU Canvas Render

**Goal**: A user visiting the page sees a WebGPU-rendered canvas with a clear background color, or a helpful error message if their browser lacks WebGPU support. Navigating away cleans up all GPU resources.

**FRs**: FR1, FR8, FR9
**NFRs**: NFR2 (cold start), NFR3 (error visibility), NFR4 (module organization)
**Architecture**: D-001 (pipeline foundation), D-003 (flat module layout), D-004 (wgsl.d.ts setup)
**Dependencies**: None — this is the foundation epic.

### S1.1: WebGPU Device Initialization

**As a** developer, **I want** a `gpu-init.ts` module that acquires a WebGPU adapter and device, **so that** all downstream GPU code has a reliable device to work with.

- **FRs**: FR1, FR8
- **Architecture**: D-003
- **Complexity**: medium
- **Test tier**: thorough

**Acceptance Criteria**:

```gherkin
Given a browser with WebGPU support
When the GPU init module is called
Then it returns a GPUDevice and GPUAdapter with queried device limits

Given a browser where navigator.gpu is undefined
When the GPU init module is called
Then it throws a typed error that can be caught and displayed

Given a browser where requestAdapter() returns null
When the GPU init module is called
Then it throws a typed error distinguishing "no adapter" from "no API"

Given a successful device acquisition
When device.lost fires during the session
Then the lost promise resolves and the error is propagated to the caller
```

**Scope**:
- DOES: Create `src/lib/gpu/gpu-init.ts`, `src/lib/gpu/types.ts`, add `@webgpu/types` devDependency
- DOES: Handle all four failure modes (no API, null adapter, device request failure, device lost)
- DOES: Query and expose `device.limits` for downstream use
- DOES NOT: Render anything to canvas
- DOES NOT: Create pipelines or buffers

**Technical notes**:
- Add `@webgpu/types` via `bun add -d @webgpu/types` (TC7)
- All async — `requestAdapter()` and `requestDevice()` can fail (TC1)
- Secure context required (TC6) — localhost satisfies this

---

### S1.2: Canvas Configuration and Clear-Color Render

**As a** user, **I want** to see a colored canvas on the page, **so that** I know WebGPU is working before any simulation code runs.

- **FRs**: FR1
- **Architecture**: D-003, D-005
- **Complexity**: medium
- **Test tier**: smoke

**Acceptance Criteria**:

```gherkin
Given a GPUDevice from gpu-init
When the Svelte page component mounts
Then a <canvas> element is configured with a GPUCanvasContext and renders a solid clear color

Given a canvas element on a Retina display
When the component mounts
Then the canvas backing store dimensions equal CSS dimensions * devicePixelRatio

Given the browser window is resized
When a ResizeObserver fires on the canvas
Then the canvas backing store is reconfigured to match the new size without visual artifacts
```

**Scope**:
- DOES: Create the SvelteKit route (`src/routes/boids/+page.svelte`), configure `GPUCanvasContext`, execute a render pass with a clear color
- DOES: Handle DPR scaling and resize via `ResizeObserver` (TC5)
- DOES: Create `wgsl.d.ts` type declaration file (D-004)
- DOES NOT: Run compute shaders or simulation logic
- DOES NOT: Create the animation loop (that is E2)

**Technical notes**:
- Canvas context preferred format: `navigator.gpu.getPreferredCanvasFormat()`
- Single render pass with `loadOp: 'clear'` and a visible clear color (e.g., dark blue)
- Use `onMount` for initialization (D-005 lifecycle pattern)

---

### S1.3: Error Display and Resource Cleanup

**As a** user, **I want** to see a clear error message if WebGPU is unavailable, and **as a** developer, **I want** GPU resources released on navigation, **so that** the app is robust and does not leak memory.

- **FRs**: FR8, FR9
- **Architecture**: D-003, D-005
- **NFRs**: NFR3
- **Complexity**: medium
- **Test tier**: thorough

**Acceptance Criteria**:

```gherkin
Given a browser without WebGPU
When the page loads
Then a DOM overlay displays a user-friendly error message (not just console.log)

Given a GPUDevice that encounters a validation error during pipeline creation
When device.pushErrorScope / popErrorScope catches the error
Then the error message is rendered into a visible DOM overlay

Given a running simulation
When the user navigates to a different SvelteKit route
Then GPUDevice.destroy() is called and all buffer references are released

Given the user navigates away and back to the boids page
When GPU memory is measured across multiple navigate cycles
Then GPU memory does not monotonically increase (no leak)
```

**Scope**:
- DOES: Create `src/lib/gpu/errors.ts` with error scope helpers, device-lost handler, DOM overlay renderer
- DOES: Wire `onDestroy` and `beforeNavigate` to call `GPUDevice.destroy()` (FR9)
- DOES: Surface WGSL compilation errors via `compilationInfo()` (NFR3)
- DOES NOT: Implement WebGL fallback

**Technical notes**:
- Error overlay should be a simple DOM div, not a Svelte component (it must render even if Svelte fails)
- `device.pushErrorScope('validation')` / `popErrorScope()` around pipeline creation
- `device.lost.then()` for mid-session device loss

---

### E1 Health Metrics

| Metric | Target |
|--------|--------|
| All 4 GPU failure modes handled with DOM messages | Yes |
| Canvas renders clear color on M1 Chrome | Yes |
| Navigate away/back: no GPU memory leak | Yes |
| First canvas render < 3s on localhost | Yes (NFR2) |
| All files < 400 lines | Yes (NFR4) |

---

## E2: Watch Boids Flock

**Goal**: A user sees 300 boids flocking in 3D space with separation, alignment, and cohesion behaviors, computed entirely on the GPU, rendered as instanced 3D geometry at 60 FPS.

**FRs**: FR2, FR3, FR5, FR6
**NFRs**: NFR1 (frame budget), NFR4 (module organization), NFR5 (shader iteration), NFR6 (memory bounded)
**Architecture**: D-001 (ping-pong buffers), D-003, D-004 (WGSL ?raw), D-005 (snapshot bridge)
**Dependencies**: E1 (requires GPUDevice, canvas, error handling)

### S2.1: Boid State Buffers and Compute Pipeline

**As a** developer, **I want** ping-pong GPU storage buffers for boid state and a compute pipeline that dispatches over them, **so that** boid data stays GPU-resident and I have the foundation for steering logic.

- **FRs**: FR3
- **Architecture**: D-001, D-003, D-004
- **Complexity**: large
- **Test tier**: smoke

**Acceptance Criteria**:

```gherkin
Given a GPUDevice and boid count of 300
When boid buffers are created
Then two GPUBuffers exist with STORAGE | COPY_SRC usage, each sized for 300 boids at 32 bytes per boid

Given two ping-pong buffers A and B
When a compute shader dispatches on frame N
Then it reads from buffer[N % 2] and writes to buffer[(N + 1) % 2]

Given a minimal pass-through compute shader (copies position, adds velocity * dt)
When dispatched for one frame
Then boid positions update and the result can be verified via buffer readback in a test
```

**Scope**:
- DOES: Create `src/lib/gpu/boid-buffers.ts` (buffer creation, bind group layout, swap logic)
- DOES: Create `src/lib/gpu/boid-compute.ts` (compute pipeline creation, dispatch)
- DOES: Create `src/lib/gpu/shaders/boid-steering-default.wgsl` with a pass-through shader (position += velocity * dt)
- DOES: Initialize boids with random positions and velocities in a bounded 3D volume
- DOES NOT: Implement separation/alignment/cohesion (that is S2.2)
- DOES NOT: Render boids visually (that is S2.4)

**Technical notes**:
- Buffer layout per boid: `position: vec3f` (12B) + padding (4B) + `velocity: vec3f` (12B) + padding (4B) = 32 bytes (D-001)
- Bind groups: group 0 = read buffer + write buffer + uniform buffer
- Uniform buffer: deltaTime (f32), boidCount (u32), steering weights (3x f32), padding = < 256 bytes
- Workgroup size: 64 (typical for compute). Dispatch: ceil(boidCount / 64) workgroups
- Use `createComputePipelineAsync` (NFR2)

---

### S2.2: Separation, Alignment, and Cohesion Steering

**As a** user, **I want** to see boids flock realistically, **so that** the simulation demonstrates emergent behavior from simple rules.

- **FRs**: FR2, FR3
- **Architecture**: D-001, D-004
- **Complexity**: large
- **Test tier**: thorough

**Acceptance Criteria**:

```gherkin
Given the default compute shader with all three steering rules enabled
When the simulation runs for several seconds
Then boids visibly form flocks — they cluster without colliding, align directions, and move cohesively

Given the separation weight is set to zero (via uniform buffer)
When the simulation runs
Then boids clump together into dense clusters (no repulsion)

Given the alignment weight is set to zero
When the simulation runs
Then boids within a group move in scattered directions rather than aligning headings

Given a boid crossing the world boundary
When its position exceeds the world bounds
Then it wraps to the opposite side (toroidal wrapping)
```

**Scope**:
- DOES: Implement the full O(n^2) neighbor-query steering in `boid-steering-default.wgsl`
- DOES: Apply separation, alignment, cohesion with tunable weights from the uniform buffer
- DOES: Implement toroidal world wrapping
- DOES: Clamp velocity magnitude to prevent runaway speeds
- DOES NOT: Implement spatial partitioning (Growth tier optimization)
- DOES NOT: Create shader variants (that is E4)

**Technical notes**:
- Neighbor iteration uses a fixed-bound loop over all boids (TC3 — no dynamic loops in WGSL)
- Steering weights read from uniform buffer each frame (set by snapshot bridge, D-005)
- Perception radius and max speed should be uniform parameters for later tuning
- At 300 boids, O(n^2) = 90K comparisons per frame — well within compute budget at 4ms (NFR1)

---

### S2.3: Animation Loop with Delta-Time

**As a** developer, **I want** a `requestAnimationFrame` loop that drives compute and render passes with frame-rate-independent timing, **so that** the simulation runs smoothly regardless of actual frame rate.

- **FRs**: FR5
- **Architecture**: D-005 (snapshot bridge)
- **Complexity**: medium
- **Test tier**: smoke

**Acceptance Criteria**:

```gherkin
Given the animation loop is started
When frames are rendered
Then each frame creates a new GPUCommandEncoder, encodes compute then render pass, and submits

Given varying frame rates (e.g., 30 FPS vs 60 FPS)
When comparing boid movement over 1 second of wall time
Then boids travel approximately the same distance regardless of frame rate (delta-time based)

Given Svelte reactive state changes (e.g., boidCount)
When the animation loop reads parameters
Then it reads from a plain JS snapshot object, not from $state runes directly

Given the animation loop is running
When the component is destroyed
Then the loop cancels the next rAF via cancelAnimationFrame and stops cleanly
```

**Scope**:
- DOES: Create `src/lib/gpu/animation-loop.ts` with start/stop, delta-time calculation, parameter snapshot read
- DOES: Orchestrate compute dispatch (from S2.1) and render pass (from S2.4) per frame
- DOES: Write simulation parameters to the uniform buffer each frame
- DOES NOT: Own Svelte reactive state (that is the component's job, D-005)
- DOES NOT: Implement camera (that is E3)

**Technical notes**:
- `animation-loop.ts` is a pure TypeScript module — no Svelte imports (D-005)
- Delta-time clamped to max 100ms (prevents physics explosion on tab-refocus)
- Frame counter tracked for ping-pong buffer swap (D-001)
- Loop accepts a `simParams` plain object and reads from it each frame

---

### S2.4: Instanced Boid Rendering

**As a** user, **I want** to see boids as 3D cone shapes pointing in their direction of travel, **so that** the simulation is visually readable and satisfying.

- **FRs**: FR6
- **Architecture**: D-003, D-004
- **Complexity**: large
- **Test tier**: smoke

**Acceptance Criteria**:

```gherkin
Given 300 boids with positions and velocities in GPU buffers
When the render pass executes
Then 300 cone/wedge meshes are drawn in a single instanced draw call

Given a boid with velocity pointing along +X
When it is rendered
Then the cone's forward axis is aligned to +X (orientation matches velocity)

Given the render pipeline and vertex/fragment shaders
When compiled
Then a boid-render.wgsl file provides vertex and fragment stages that read per-instance data from the boid state buffer
```

**Scope**:
- DOES: Create `src/lib/gpu/boid-render.ts` (render pipeline, geometry, instanced draw)
- DOES: Create `src/lib/gpu/shaders/boid-render.wgsl` (vertex + fragment shaders)
- DOES: Generate cone/wedge geometry (6-8 triangles) as a vertex buffer
- DOES: Compute per-instance rotation from velocity vector in the vertex shader
- DOES: Use a simple lighting model (directional or hemisphere) so boids are visually distinguishable from each other
- DOES NOT: Implement camera controls (uses a fixed view-projection matrix for now; E3 replaces it)

**Technical notes**:
- Single `draw(vertexCount, instanceCount)` call — not one draw per boid
- Boid state buffer (position + velocity) bound as vertex buffer with per-instance step mode, or read via storage buffer in the vertex shader
- Forward axis alignment: build a rotation from the default forward direction to the normalized velocity vector
- Depth testing enabled (`depthStencilState` with `depth24plus` format)
- Background clear color should contrast with boid color

---

### E2 Health Metrics

| Metric | Target |
|--------|--------|
| 300 boids flocking visibly at 60 FPS on M1 | Yes (NFR1) |
| Compute pass < 4ms at 300 boids | Yes (NFR1) |
| Render pass < 4ms at 300 boids | Yes (NFR1) |
| Zeroing any steering weight produces visible behavior change | Yes (FR2) |
| Toroidal wrapping works at all 6 boundaries | Yes (FR2) |
| No per-frame CPU readback of boid data | Yes (FR3) |
| All GPU modules < 400 lines | Yes (NFR4) |
| State buffers ~20KB double-buffered at 300 boids | Yes (NFR6) |

---

## E3: Fly Through the Flock

**Goal**: A user clicks the canvas to enter pointer-lock FPS camera mode, flies through the boid flock with WASD + mouse look, and exits with Escape.

**FRs**: FR4
**NFRs**: NFR1 (must not blow frame budget), NFR4 (module organization)
**Architecture**: D-006 (gl-matrix), D-003
**Dependencies**: E1 (requires GPUDevice, canvas). Can be developed in parallel with E2 — just needs the render pass to accept a view-projection matrix.

### S3.1: Camera Math and Keyboard/Mouse Input

**As a** user, **I want** to fly around 3D space with WASD and mouse, **so that** I can explore the boid simulation from any angle.

- **FRs**: FR4
- **Architecture**: D-006
- **Complexity**: medium
- **Test tier**: thorough

**Acceptance Criteria**:

```gherkin
Given the camera module is initialized with default position and 75-degree FOV
When getViewProjectionMatrix() is called
Then it returns a valid 4x4 Float32Array combining perspective and view transforms

Given the user clicks the canvas
When pointerlockchange fires
Then pointer lock is engaged and mouse movement updates yaw and pitch

Given pointer lock is active and the user presses W
When camera.update(dt) is called
Then the camera position moves forward along its look direction by speed * dt

Given the user scrolls the mouse wheel
When the scroll event fires
Then camera movement speed increases or decreases within clamped bounds

Given pointer lock is active and the user presses Escape
When pointerlockchange fires
Then pointer lock is released and mouse movement no longer affects the camera
```

**Scope**:
- DOES: Create `src/lib/gpu/camera.ts` with `createCamera()` factory
- DOES: Add `gl-matrix` dependency via `bun add gl-matrix`
- DOES: Implement FPS camera: position, yaw, pitch, forward/right/up vectors
- DOES: Handle WASD (movement), QE/Space/Shift (up/down), mouse (look), scroll (speed)
- DOES: Use `mat4.perspectiveZO` for WebGPU's [0,1] clip Z range
- DOES: Clamp pitch to avoid gimbal lock at poles
- DOES NOT: Implement orbit camera mode

**Technical notes**:
- Camera state: `position: vec3`, `yaw: number`, `pitch: number`, `speed: number` (D-006)
- `perspectiveZO` not `perspective` — WebGPU Z range is [0,1] not [-1,1]
- Input handlers registered on the canvas element, not document (avoid conflicts)
- Camera math is pure functions — fully unit-testable with Vitest

---

### S3.2: Camera Integration with Render Pipeline

**As a** developer, **I want** the camera's view-projection matrix written to the GPU uniform buffer each frame, **so that** the rendered scene reflects the camera's current position and orientation.

- **FRs**: FR4
- **Architecture**: D-006, D-001
- **Complexity**: small
- **Test tier**: smoke

**Acceptance Criteria**:

```gherkin
Given a camera and the animation loop
When each frame begins
Then the camera's view-projection matrix (64 bytes) is written to the uniform buffer

Given the camera moves to a new position
When the next frame renders
Then the boids appear from the new camera perspective (parallax shift visible)

Given camera input handlers
When the Svelte component is destroyed
Then all event listeners (pointerlockchange, mousemove, keydown, keyup, wheel) are removed
```

**Scope**:
- DOES: Extend the uniform buffer layout to include view-projection matrix
- DOES: Wire `camera.update(dt)` into the animation loop's per-frame update
- DOES: Update the render shader to use the view-projection matrix from the uniform buffer
- DOES: Clean up camera event listeners on component destroy
- DOES NOT: Add any UI for camera state display

**Technical notes**:
- Uniform buffer layout: simulation params (32B) + view-projection matrix (64B) + padding = ~128B
- Camera `update(dt)` called before render pass encoding, after compute dispatch
- The render vertex shader multiplies `viewProjection * worldPosition`

---

### E3 Health Metrics

| Metric | Target |
|--------|--------|
| Camera responds to WASD + mouse with no perceptible lag | Yes |
| 75-degree FOV, perspective correct (no stretching at edges) | Yes |
| Pointer lock engages on click, releases on Escape | Yes |
| Scroll wheel adjusts movement speed | Yes |
| Camera math unit tests pass (pure functions) | Yes |
| Camera overhead < 0.5ms per frame | Yes (within NFR1 budget) |

---

## E4: See Different Boid Behaviors

**Goal**: A user sees two or more visually distinct groups of boids — some flock normally, others behave differently (e.g., loners that ignore cohesion) — demonstrating per-group shader individuation.

**FRs**: FR7
**NFRs**: NFR2 (async compilation, cold start), NFR5 (shader files), NFR6 (memory bounded)
**Architecture**: D-002 (shader variant groups), D-004 (WGSL ?raw)
**Dependencies**: E2 (requires working compute pipeline, buffers, and rendering)

### S4.1: Shader Variant Pipeline Infrastructure

**As a** developer, **I want** to compile multiple WGSL compute shader variants into separate pipelines and dispatch them per-group, **so that** boid subsets can run different steering logic.

- **FRs**: FR7
- **Architecture**: D-002, D-004
- **Complexity**: large
- **Test tier**: thorough

**Acceptance Criteria**:

```gherkin
Given 2 WGSL shader variant files (default + loner)
When the compute module initializes
Then 2 GPUComputePipelines are created via createComputePipelineAsync

Given pipeline compilation takes >100ms
When the page loads
Then a loading indicator is shown and the simulation begins rendering as soon as the first pipeline is ready

Given 300 boids split into 2 groups (e.g., 200 default + 100 loner)
When a frame dispatches compute
Then 2 compute dispatches execute — one per variant — each operating on its slice of the boid buffer

Given the adapter cannot create more than N pipelines
When pipeline creation fails
Then the system degrades gracefully to fewer variants with an informational message
```

**Scope**:
- DOES: Extend `boid-compute.ts` to manage multiple pipeline variants
- DOES: Create `src/lib/gpu/shaders/boid-steering-loner.wgsl` (ignores cohesion, weaker alignment)
- DOES: Add `group_id: u32` to boid state buffer (D-002 consequence — buffer grows to ~48B/boid with alignment)
- DOES: Partition boid buffer by group and dispatch per-variant
- DOES: Use `createComputePipelineAsync` for non-blocking compilation (NFR2)
- DOES NOT: Support runtime shader editing or hot-swap
- DOES NOT: Attempt per-boid unique pipelines

**Technical notes**:
- Boid state grows: `position: vec3f` + `velocity: vec3f` + `group_id: u32` + padding = 48 bytes/boid (aligned to 16)
- At 500 boids: 48KB double-buffered = 96KB total (within NFR6's budget with margin)
- Each variant shader reads the same buffer layout but implements different steering
- Pipeline-not-ready state: render available groups, skip groups whose pipeline is still compiling
- Handle >2s compilation stall per FR7 graceful degradation

---

### S4.2: Visible Behavior Differentiation

**As a** user, **I want** to see that different boid groups actually behave differently, **so that** the shader individuation is not just an invisible technical detail.

- **FRs**: FR7
- **Architecture**: D-002
- **Complexity**: medium
- **Test tier**: smoke

**Acceptance Criteria**:

```gherkin
Given 2 shader variants (default flocking + loner)
When the simulation runs for 10+ seconds
Then the two groups produce visibly different movement patterns (flocking vs scattered)

Given boids are assigned to groups
When rendered
Then each group has a distinct color so the user can visually distinguish them

Given the loner shader variant
When its boids move
Then they demonstrably ignore cohesion — they spread apart rather than clustering
```

**Scope**:
- DOES: Ensure the loner variant produces visibly different behavior (tune parameters)
- DOES: Pass `group_id` to the render shader so groups are colored differently
- DOES: Verify both groups coexist in the same 3D space and interact at world boundaries
- DOES NOT: Add UI for selecting or changing group assignments
- DOES NOT: Add more than 2-3 variants for MVP

**Technical notes**:
- Color by group: fragment shader reads `group_id` and maps to a color palette
- Loner behavior suggestion: zero cohesion weight, halve alignment weight, increase separation radius
- Both groups share the same world bounds and toroidal wrapping

---

### E4 Health Metrics

| Metric | Target |
|--------|--------|
| 2+ distinct shader variants compiled and dispatched | Yes (FR7) |
| Visibly different behavior between groups | Yes (FR7) |
| Async compilation with loading indicator | Yes (NFR2) |
| Graceful degradation if pipeline limit exceeded | Yes (FR7) |
| Pipeline compilation < 2s total for 2-3 variants | Yes |
| Memory: < 100KB total boid buffers at 500 boids | Yes (NFR6) |

---

## E5: Tweak the Simulation

**Goal**: A user adjusts boid count and steering parameters via UI sliders and sees the simulation respond in real time without a page reload.

**FRs**: FR10
**NFRs**: NFR4 (module organization)
**Architecture**: D-005 (snapshot bridge)
**Dependencies**: E2 (requires working simulation and animation loop)

### S5.1: Boid Count Slider with Buffer Recreation

**As a** user, **I want** to drag a slider to change the number of boids from 10 to 2000, **so that** I can see how the simulation scales.

- **FRs**: FR10
- **Architecture**: D-005
- **Complexity**: medium
- **Test tier**: thorough

**Acceptance Criteria**:

```gherkin
Given a UI slider with range 10-2000 and default 300
When the user drags the slider to 500
Then the simulation recreates boid state buffers for 500 boids and continues without page reload

Given the boid count changes from 300 to 100
When new buffers are created
Then old buffers are released (no GPU memory leak)

Given the boid count changes
When the simulation resumes
Then new boids are initialized with random positions and velocities within world bounds

Given a boid count of 2000
When the simulation runs on M1 hardware
Then it maintains a playable frame rate (may drop below 60 FPS — that is acceptable, but no crash or freeze)
```

**Scope**:
- DOES: Add boid count slider UI to the Svelte component
- DOES: Implement buffer recreation logic in `boid-buffers.ts` (destroy old, create new, reinitialize)
- DOES: Wire slider to `$state` and through the snapshot bridge (D-005)
- DOES: Detect `boidCount` change in animation loop and trigger buffer recreation
- DOES NOT: Preserve existing boid positions across count changes (fresh random init is fine)

**Technical notes**:
- Buffer recreation is the hot path for this story — must not leak the old buffers
- The animation loop detects count change by comparing `simParams.boidCount` to current buffer size
- Svelte `$state` for slider value, `$effect` syncs to snapshot (D-005 pattern)
- Slider should show current value label

---

### S5.2: Steering Parameter Sliders

**As a** user, **I want** sliders for separation, alignment, and cohesion weights, **so that** I can experiment with how each rule affects flocking behavior.

- **FRs**: FR10
- **Architecture**: D-005
- **Complexity**: small
- **Test tier**: smoke

**Acceptance Criteria**:

```gherkin
Given sliders for separation, alignment, and cohesion (each 0.0 to 3.0, defaults 1.5/1.0/1.0)
When the user adjusts any slider
Then the change takes effect on the next simulation frame (one-frame latency)

Given the separation slider is dragged to 0
When the simulation runs
Then boids clump together (same behavior as zeroing the weight in E2 acceptance criteria)

Given all three sliders at their default values
When the page loads
Then the simulation matches the default flocking behavior from E2
```

**Scope**:
- DOES: Add three steering weight sliders to the UI
- DOES: Wire sliders through the snapshot bridge to the uniform buffer
- DOES: Style controls to not obstruct the canvas (overlay panel or side panel)
- DOES NOT: Add parameter presets or save/load
- DOES NOT: Add controls for perception radius, max speed, or other advanced parameters

**Technical notes**:
- Steering weights already exist in the uniform buffer (created in S2.1)
- This story is primarily UI wiring — the GPU side already reads these weights
- Controls should use Svelte 5 `$state` with `bind:value` on range inputs
- Panel positioning: absolute/fixed overlay with partial transparency, or collapsible sidebar

---

### E5 Health Metrics

| Metric | Target |
|--------|--------|
| Boid count slider works across full range (10-2000) | Yes |
| Buffer recreation on count change: no memory leak | Yes |
| Steering weight changes visible within 1 frame | Yes |
| Zeroing each weight produces expected behavior change | Yes |
| UI does not obstruct more than 20% of canvas | Yes |

---

## Execution Order

```
E1 (GPU Foundation)
 |
 +---> E2 (Boid Simulation Core)
 |      |
 |      +---> E4 (Shader Individuation)
 |      |
 |      +---> E5 (Interactive Controls)
 |
 +---> E3 (Fly-Around Camera) [parallel with E2]
```

Recommended implementation sequence:
1. **E1** — Foundation, unlocks everything
2. **E2** + **E3** — Can be developed in parallel (E3 only needs the render pass to accept a matrix)
3. **E4** — Requires E2's compute pipeline
4. **E5** — Requires E2's animation loop and uniform buffer
