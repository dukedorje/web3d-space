---
sprint: sprint-002
phase: 2B
created: 2026-04-10
epics: 4
stories: 14
status: proposed
---

# Epics & Stories — Sprint 002: Boid Personality System

---

## Epic 1: Uber-Shader Migration

**Goal**: Replace the multi-variant shader system with a single configurable uber-shader that reads per-boid parameters from a config buffer.

**Dependencies**: None (foundational epic)
**FRs**: FR1, FR2, FR5, FR9 (partial), FR10 (partial), FR11 (partial), FR12 (partial)
**Decisions**: D-007, D-008

---

### S1.1: Create Per-Boid Config Buffer and BoidConfig Struct

**User story**: As a developer, I want a GPU storage buffer holding per-boid configuration values so that the uber-shader can read personality-specific parameters for each boid.

**FRs**: FR1
**Architecture decisions**: D-007, D-008
**Complexity**: Medium
**Test tier**: Thorough

**Acceptance criteria**:

```gherkin
Given the GPU device is initialized and boid count is set to 300
When createBoidBuffers is called
Then a config buffer of size 300 * 48 bytes is created with usage STORAGE | COPY_SRC | COPY_DST
And the config buffer is populated with default flocker template values for all boids

Given a config buffer exists with 300 boids
When the compute bind group is created
Then binding 3 references the config buffer with read_write storage type

Given a config buffer exists with 300 boids
When the render bind group is created
Then binding 2 references the config buffer with read-only storage type

Given the boid count slider changes from 300 to 500
When recreateBoidBuffers is called
Then the config buffer is destroyed and recreated at 500 * 48 bytes
And the new config buffer is populated with personality distribution matching the UI settings
```

**Scope boundaries**:
- DOES: Create config buffer, add to BoidBuffers interface, update bind group layout descriptors, update bind group creation, handle resize
- DOES NOT: Write the uber-shader (S1.2), define personality templates (S2.1), remove old variant system (S1.4)

**Technical notes**:
- Add `config` field to `BoidBuffers` interface
- Add `BYTES_PER_CONFIG = 48` constant
- Update `BOID_BIND_GROUP_LAYOUT_DESCRIPTOR` to include binding 3
- Create a separate render bind group layout descriptor (currently render uses its own layout in `boid-render.ts`)
- Config buffer usage flags: `GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST`
- Pack config data using same `Float32Array` + `Uint32Array` view pattern as `initializeBoidData()`

---

### S1.2: Write Uber-Shader Compute Pipeline

**User story**: As a developer, I want a single WGSL compute shader that reads per-boid config values so that all 7 personality behaviors are driven by data rather than separate shader files.

**FRs**: FR2, FR9 (partial), FR10 (partial), FR11 (partial), FR12 (partial)
**Architecture decisions**: D-007, D-011
**Complexity**: Large
**Test tier**: Thorough

**Acceptance criteria**:

```gherkin
Given a new file src/lib/gpu/shaders/boid-steering-uber.wgsl exists
When the shader is compiled
Then it reads BoidConfig from configIn[index] for each boid's steering parameters
And separation/alignment/cohesion weights come from the config buffer, not uniforms

Given 300 boids with mixed personality types (flockers, loners, predators)
When the compute shader runs one frame
Then flockers exhibit flocking behavior (cluster, align headings)
And loners drift away from crowds with gentle wander
And predators move faster and steer toward flock centers

Given a boid with personalityType == EXPLORER
When the shader evaluates steering forces
Then an edge-attraction force biases the boid toward world boundaries

Given a boid with personalityType == SWIRLER
When the shader evaluates steering forces
Then a rotational cross-product force causes the boid to orbit

Given a boid with personalityType == TIMID and a predator within perception radius
When the shader evaluates steering forces
Then a strong flee force overrides normal flocking
```

**Scope boundaries**:
- DOES: Implement unified steering loop, per-boid config reads, predator/explorer/swirler/timid special branches, wander noise, crowd speed boost
- DOES NOT: Implement stress accumulation or personality transitions (S4.1, S4.2), remove old shaders (S1.4)

**Technical notes**:
- Struct declarations: `BoidState` (unchanged from sprint 001), `BoidConfig` (new, per D-008), `Uniforms` (simplified — remove steering weights, keep deltaTime/boidCount/worldSize/VP)
- Bindings: `@binding(0)` boidsIn, `@binding(1)` boidsOut, `@binding(2)` uniforms, `@binding(3)` configIn (read-only for now — S4.1 changes to read_write)
- Remove `group_id` filter — process ALL boids in single dispatch
- Special behavior branches gated on `configIn[index].personalityType`:
  - `PREDATOR (2)`: Negative cohesion is already handled by config values. Add: chase bias toward densest cluster direction.
  - `EXPLORER (3)`: Add: edge-attraction force = direction to nearest world boundary, scaled by distance-from-center.
  - `SWIRLER (4)`: Add: `cross(velocity, vec3f(0,1,0)) * swirlFactor` rotational force.
  - `TIMID (5)`: Add: scan neighbors for predator type, apply strong flee force.
  - `MIMIC (6)`: Copy nearest neighbor's velocity direction (lightweight mimic).
- Keep utility functions: `wrapPosition`, `toroidalOffset`, `limitVec` (consolidate from both old shaders)
- Target: under 350 lines

---

### S1.3: Update Animation Loop for Single Pipeline Dispatch

**User story**: As a developer, I want the animation loop to dispatch a single compute pipeline so that the frame encoding is simpler and faster than the multi-variant approach.

**FRs**: FR2, FR5 (partial)
**Architecture decisions**: D-007
**Complexity**: Small
**Test tier**: Smoke

**Acceptance criteria**:

```gherkin
Given the uber-shader compute pipeline is compiled
When a frame is rendered
Then exactly one compute pass is encoded (not N per variant)
And the compute pass uses the uber-shader pipeline with the updated bind group (4 bindings)

Given the animation loop config
When AnimationLoopConfig is constructed
Then there is no shaderVariants field
And computePipeline references the single uber-shader pipeline

Given the simulation is running at 300 boids
When FPS is measured over 60 frames
Then average FPS >= 60 on the development machine
```

**Scope boundaries**:
- DOES: Update `AnimationLoopConfig` interface, remove `shaderVariants` option, update `frame()` to use single dispatch, update uniform writing (remove steering weights from uniform buffer)
- DOES NOT: Remove old compute module exports (S1.4), update render pipeline bindings (handled by S1.1)

**Technical notes**:
- Remove `shaderVariants` from `AnimationLoopConfig`
- Remove the `if (shaderVariants)` branch in `frame()` — always use `dispatchBoidCompute()`
- Update `writeUniforms` to skip steering weights (they are now in config buffer)
- Uniform buffer layout shrinks: deltaTime, boidCount, worldSize, _pad, viewProjection = 80 bytes (or keep at 112 with padding for compatibility)
- Update `packUniforms()` to match new layout

---

### S1.4: Remove Old Multi-Variant System

**User story**: As a developer, I want the old multi-variant shader infrastructure removed so that the codebase has a single clear path for boid computation.

**FRs**: FR5
**Architecture decisions**: D-007
**Complexity**: Small
**Test tier**: Smoke

**Acceptance criteria**:

```gherkin
Given the uber-shader system is working
When the old variant files are removed
Then src/lib/gpu/shaders/boid-steering-default.wgsl no longer exists
And src/lib/gpu/shaders/boid-steering-loner.wgsl no longer exists

Given boid-compute.ts is updated
When the file is reviewed
Then ShaderVariant interface is removed
And createShaderVariants function is removed
And dispatchAllVariants function is removed
And only createBoidComputePipeline and dispatchBoidCompute remain

Given boid-buffers.ts is updated
When the file is reviewed
Then GROUP_COUNT constant is removed
And initializeBoidData no longer assigns group_id (field removed from BoidState or zeroed)

Given +page.svelte is updated
When the component initializes
Then it does not import lonerShaderSource or defaultShaderSource
And it imports the uber-shader source instead
And it does not call createShaderVariants
```

**Scope boundaries**:
- DOES: Delete old WGSL files, remove variant-related exports from boid-compute.ts, remove GROUP_COUNT, update +page.svelte imports
- DOES NOT: Modify the uber-shader (S1.2) or config buffer (S1.1)

**Technical notes**:
- `BoidState` in WGSL loses `group_id` field — replaced by `personalityType` in `BoidConfig`
- `BoidState` struct becomes: position(vec3f), _pad0(f32), velocity(vec3f), _pad1(u32), _pad2(vec4f) — OR shrink to 32 bytes if group_id padding is no longer needed. Decision: keep at 48 bytes to avoid buffer layout migration in this story.
- Update the render shader to read `personalityType` from config buffer instead of `group_id` from boid state

---

## Epic 2: Personality Templates & Rendering

**Goal**: Define the 7 personality types as configurable templates and render each with distinct visual identity.

**Dependencies**: E1 (config buffer and uber-shader must exist)
**FRs**: FR3, FR4, FR7
**Decisions**: D-009

---

### S2.1: Define 7 Personality Templates in TypeScript

**User story**: As a developer, I want personality types defined as TypeScript template objects so that config buffer initialization and the inspector UI can reference canonical parameter values.

**FRs**: FR3
**Architecture decisions**: D-009
**Complexity**: Small
**Test tier**: Smoke

**Acceptance criteria**:

```gherkin
Given src/lib/gpu/personality-templates.ts is created
When the module is imported
Then a PersonalityType enum with 7 members is exported (Flocker=0, Loner=1, Predator=2, Explorer=3, Swirler=4, Timid=5, Mimic=6)
And a PERSONALITY_TEMPLATES record mapping each type to a BoidConfigTemplate is exported

Given PERSONALITY_TEMPLATES is accessed for PersonalityType.Predator
When the template values are read
Then separationWeight < 1.0 (predators don't separate much)
And maxSpeed > 30 (predators are fast)
And cohesionWeight is negative (attracted to others' positions inverts to chase)

Given a BoidConfigTemplate object
When its keys are compared to the BoidConfig WGSL struct fields
Then all 8 tunable fields are present (separationWeight, alignmentWeight, cohesionWeight, perceptionRadius, separationRadius, maxSpeed, wanderStrength, crowdSpeedBoost)
```

**Scope boundaries**:
- DOES: Define enum, template interface, 7 template objects with tuned values, helper to pack a template into Float32Array
- DOES NOT: Initialize the config buffer (S1.1 does that), render personalities (S2.3)

**Technical notes**:
- Export `packConfigForBoid(template: BoidConfigTemplate, personalityType: PersonalityType): Float32Array` that returns 48 bytes ready for buffer upload
- Template values from FR3 table are starting points — will be tuned during integration
- Include `PERSONALITY_NAMES: Record<PersonalityType, string>` for UI display
- Include `PERSONALITY_COLORS: Record<PersonalityType, [number, number, number]>` for UI (mirrors WGSL color table)

---

### S2.2: Personality Distribution and Config Buffer Initialization

**User story**: As a user, I want to control the mix of personality types in the simulation so that I can create different emergent scenarios (all predators, balanced ecosystem, peaceful flock).

**FRs**: FR7
**Architecture decisions**: D-009
**Complexity**: Medium
**Test tier**: Smoke

**Acceptance criteria**:

```gherkin
Given a distribution of {Flocker: 40%, Loner: 15%, Predator: 10%, Explorer: 10%, Swirler: 10%, Timid: 10%, Mimic: 5%}
When 300 boids are initialized
Then approximately 120 boids have Flocker config, 45 have Loner config, etc. (rounding to integers)
And each boid's config buffer contains the correct template values for its assigned type

Given the distribution is changed via UI
When "Apply Distribution" is triggered
Then the config buffer is rewritten with new personality assignments
And boid positions and velocities are preserved (only config changes)

Given a preset "Predator Chaos" is selected
When the preset is applied
Then the distribution is set to {Predator: 40%, Timid: 30%, Flocker: 20%, Loner: 10%}
```

**Scope boundaries**:
- DOES: Distribution logic, config buffer population from templates, 3+ preset distributions, integration with boid count changes
- DOES NOT: Build the distribution UI controls (S2.4), implement dynamic personality switching (E4)

**Technical notes**:
- `initializeConfigBuffer(count: number, distribution: PersonalityDistribution): Float32Array` returns packed config data
- `PersonalityDistribution = Record<PersonalityType, number>` where values are ratios (0-1), normalized to sum to 1
- Presets: "Balanced" (even split), "Predator Chaos" (heavy predators + timid), "Peaceful Flock" (80% flockers, 10% explorers, 10% swirlers)
- Shuffle boid indices before assigning types so personalities are spatially mixed at initialization

---

### S2.3: Per-Personality Rendering (Colors and Shapes)

**User story**: As a user, I want each personality type to be visually distinct so that I can see the ecosystem dynamics at a glance.

**FRs**: FR4
**Architecture decisions**: D-007
**Complexity**: Medium
**Test tier**: Smoke

**Acceptance criteria**:

```gherkin
Given 300 boids with all 7 personality types are rendered
When the user views the simulation
Then 7 distinct colors are visible (cyan, orange, red, green, purple, yellow, white)
And each color corresponds to a specific personality type

Given a boid with personalityType == PREDATOR
When the vertex shader processes it
Then the cone geometry is scaled 1.5x larger than a flocker

Given a boid with personalityType == TIMID
When the vertex shader processes it
Then the cone geometry is scaled 0.7x smaller than a flocker

Given the render shader reads personalityType from the config buffer
When 7 boid types are on screen
Then there is no visible frame rate drop compared to the 2-type sprint 001 rendering
```

**Scope boundaries**:
- DOES: Update boid-render.wgsl to read config buffer, add color lookup table (7 entries), add per-type shape scaling, update render bind group to include config buffer
- DOES NOT: Add selection highlighting (S3.3), add transition color lerp (S4.3)

**Technical notes**:
- Color table as WGSL constant array: `const COLORS = array<vec3f, 7>(vec3f(0.2,0.6,1.0), vec3f(1.0,0.45,0.1), ...)`
- Shape scale table: `const SCALES = array<vec3f, 7>(vec3f(1,1,1), vec3f(1.8,0.3,1.5), vec3f(1.3,1.3,1.5), ...)`
- Replace the current `if (group_id == 0) / else` color logic with `COLORS[config.personalityType]`
- Replace shape scaling `if` with `SCALES[config.personalityType]` multiplication
- Config buffer binding in render: `@group(0) @binding(2) var<storage, read> configs: array<BoidConfig>`

---

### S2.4: Personality Distribution UI

**User story**: As a user, I want UI controls to set personality ratios and choose presets so that I can experiment with different ecosystem compositions.

**FRs**: FR7
**Architecture decisions**: None (UI-only)
**Complexity**: Medium
**Test tier**: Yolo

**Acceptance criteria**:

```gherkin
Given the controls panel is visible
When the user looks at the personality section
Then there are 7 labeled sliders (one per personality type) showing percentage
And there are preset buttons ("Balanced", "Predator Chaos", "Peaceful Flock")

Given the user adjusts the Predator slider from 10% to 40%
When the sliders update
Then all other personality percentages rebalance proportionally to sum to 100%
And the displayed percentages are whole numbers

Given the user clicks "Predator Chaos" preset
When the preset is applied
Then all 7 sliders jump to the preset values
And the config buffer is rewritten with the new distribution
And boid behaviors change on the next frame
```

**Scope boundaries**:
- DOES: Add distribution sliders to +page.svelte controls panel, add preset buttons, wire to config buffer reinitialization via snapshot bridge
- DOES NOT: Show individual boid info (S3.2), animate distribution changes

**Technical notes**:
- Add `personalityDistribution` to Svelte `$state` — object with 7 percentage values
- Normalization: when one slider changes, scale others proportionally to maintain 100% total
- "Apply" button (or debounced auto-apply) calls `initializeConfigBuffer()` and writes to GPU
- Preset buttons set all 7 slider values at once
- Color-code slider labels to match boid colors for visual connection

---

## Epic 3: Boid Inspector

**Goal**: Enable click-to-select a boid and display its personality details in an inspector panel.

**Dependencies**: E2 (personality type data must exist in config buffer)
**FRs**: FR6
**Decisions**: D-010

---

### S3.1: GPU Picking — Click to Select Nearest Boid

**User story**: As a user, I want to click on a boid to select it so that I can inspect its personality and behavior parameters.

**FRs**: FR6
**Architecture decisions**: D-010
**Complexity**: Large
**Test tier**: Thorough

**Acceptance criteria**:

```gherkin
Given the simulation is running and pointer lock is NOT active
When the user clicks on the canvas near a visible boid
Then the nearest boid to the click ray is determined via GPU readback
And the selected boid index is stored in component state

Given the user clicks on empty space (no boid within selection threshold)
When the click handler evaluates
Then the selected boid index is set to null (deselected)

Given the user Shift+clicks on the canvas while pointer lock IS active
When the click handler evaluates
Then the click is treated as a selection attempt (not a camera rotation)
And the nearest boid is selected without exiting pointer lock

Given 300 boid positions are read back for selection
When the readback completes
Then the total readback time is under 5ms
And the selection result is available by the next frame
```

**Scope boundaries**:
- DOES: Create staging buffer for readback, implement click-to-ray conversion, implement ray-to-nearest-boid matching, handle pointer lock interaction, store selected index in $state
- DOES NOT: Display inspector panel (S3.2), add visual highlight (S3.3)

**Technical notes**:
- Staging buffer: `device.createBuffer({ size: boidCount * BYTES_PER_BOID, usage: MAP_READ | COPY_DST })`
- On click: `encoder.copyBufferToBuffer(activeStorage, 0, staging, 0, size)` then `staging.mapAsync(GPUMapMode.READ)`
- Ray construction: screen (x,y) -> NDC -> inverse VP matrix -> world-space ray origin + direction
- Distance metric: point-to-ray distance for each boid position, pick minimum under threshold (e.g., 2.0 world units)
- Selection mode: Shift+click bypasses pointer lock request. Regular click still enters pointer lock for camera.
- Recreate staging buffer when boid count changes

---

### S3.2: Inspector Panel UI

**User story**: As a user, I want to see the selected boid's personality details so that I can understand why it behaves the way it does.

**FRs**: FR6
**Architecture decisions**: D-009
**Complexity**: Medium
**Test tier**: Yolo

**Acceptance criteria**:

```gherkin
Given a boid is selected (selectedBoidIndex is not null)
When the inspector panel renders
Then it displays: personality type name, personality color swatch, all 8 config values with labels, current stress level, current experience timer

Given no boid is selected
When the inspector panel renders
Then it shows "Click a boid to inspect" placeholder text

Given a boid is selected and its personality changes dynamically (FR8)
When the config buffer is updated
Then the inspector panel reflects the new personality type and config values on the next readback
```

**Scope boundaries**:
- DOES: Svelte inspector panel component, read config values from staging buffer readback, display personality name/color/values, auto-update on frame (or on-demand refresh button)
- DOES NOT: Allow editing config values from the inspector, implement selection highlighting (S3.3)

**Technical notes**:
- Inspector reads from the same staging buffer used for selection (readback on click, or periodic refresh)
- For real-time stress/experience display: optional per-frame readback of just the selected boid (copy 48 bytes, not full buffer)
- Alternatively: readback only on explicit "refresh" button click to avoid per-frame sync cost
- Panel positioned at top-right of viewport, below or beside existing controls panel
- Import `PERSONALITY_NAMES` and `PERSONALITY_COLORS` from `personality-templates.ts`

---

### S3.3: Visual Selection Indicator

**User story**: As a user, I want to see which boid is selected with a visual highlight so that I can track it in the swarm.

**FRs**: FR6
**Architecture decisions**: None
**Complexity**: Small
**Test tier**: Yolo

**Acceptance criteria**:

```gherkin
Given a boid is selected
When the scene renders
Then the selected boid has a visible highlight (brighter color, ring, or scale pulse)
And the highlight is distinguishable from 5+ units away

Given no boid is selected
When the scene renders
Then no highlight is visible

Given boid index 42 is selected and the simulation is running
When 60 frames pass
Then boid 42 remains highlighted as it moves through the scene
```

**Scope boundaries**:
- DOES: Pass selected boid index to render shader via uniform, apply visual highlight in vertex/fragment shader
- DOES NOT: Draw a separate mesh or particle for the highlight (keep it shader-based)

**Technical notes**:
- Add `selectedBoidIndex: u32` (or `i32` with -1 for none) to the uniform buffer
- In vertex shader: `if (instanceIdx == uniforms.selectedBoidIndex)` scale up by 1.5x
- In fragment shader: selected boid gets emissive boost (add 0.3 to color) and/or pulsing alpha
- Pulsing: use `sin(uniforms.totalTime * 5.0) * 0.15 + 0.85` for a gentle brightness oscillation
- Add `totalTime: f32` to uniform buffer (accumulated time, not delta)

---

## Epic 4: Dynamic Personality

**Goal**: Enable boids to accumulate stress and experience, and transition between personality types based on simulation conditions.

**Dependencies**: E1 (uber-shader with config buffer must exist)
**FRs**: FR8
**Decisions**: D-011

---

### S4.1: Experience Accumulation in Compute Shader

**User story**: As a developer, I want the compute shader to track per-boid stress and experience so that personality transitions can be data-driven.

**FRs**: FR8
**Architecture decisions**: D-011
**Complexity**: Medium
**Test tier**: Thorough

**Acceptance criteria**:

```gherkin
Given a boid has 5+ neighbors within separation radius
When the compute shader updates
Then the boid's stressLevel increases by a rate proportional to neighbor count * deltaTime

Given a boid has 0 neighbors within separation radius
When the compute shader updates
Then the boid's stressLevel decreases (decays toward 0) at a fixed rate * deltaTime

Given a boid has held its current personality for 100+ frames at 60 FPS
When the compute shader updates
Then the boid's experienceTimer has accumulated approximately 1.67 seconds

Given the config buffer was bound as read-only in S1.2
When S4.1 is implemented
Then the config buffer binding changes to read_write in the compute bind group
And the shader writes updated stressLevel and experienceTimer back to configOut
```

**Scope boundaries**:
- DOES: Add stress increment/decrement logic to uber-shader, add experience timer increment, change config buffer to read_write in compute, add configOut binding
- DOES NOT: Implement personality switching logic (S4.2), add visual transition effects (S4.3)

**Technical notes**:
- Config buffer needs ping-pong or in-place write. Simplest: single config buffer with `read_write` (no ping-pong needed — config changes are slow, no race conditions within a single dispatch since each thread writes only its own index)
- Stress formula: `stress += (separationCount > stressThreshold) ? stressRate * dt : -decayRate * dt; stress = clamp(stress, 0.0, 1.0);`
- Experience: `experienceTimer += dt;`
- Stress threshold, stress rate, decay rate as constants in WGSL (tune later)

---

### S4.2: Personality Transition Rules

**User story**: As a user, I want boids to change personality based on their experiences so that the ecosystem evolves over time.

**FRs**: FR8
**Architecture decisions**: D-011
**Complexity**: Large
**Test tier**: Thorough

**Acceptance criteria**:

```gherkin
Given a flocker boid has stressLevel > 0.8 and experienceTimer > 5.0 seconds
When the compute shader evaluates transition rules
Then the boid's personalityType changes to Loner (1)
And its config values are overwritten with the Loner template from the WGSL constant table
And experienceTimer resets to 0.0 and stressLevel resets to 0.0

Given a loner boid has stressLevel < 0.2 and experienceTimer > 8.0 seconds
When the compute shader evaluates transition rules
Then the boid's personalityType changes to Explorer (3)

Given a boid just transitioned personality (experienceTimer < 2.0 seconds)
When the compute shader evaluates transition rules
Then no transition occurs (cooldown period enforced)

Given 300 boids running for 60 seconds
When the personality distribution is observed
Then at least 3 personality transitions have occurred across the population
And no single boid has oscillated between two types more than twice in 60 seconds
```

**Scope boundaries**:
- DOES: Implement transition condition checks in uber-shader, embed WGSL constant template table, copy template values on transition, reset counters, enforce cooldown
- DOES NOT: Add visual transition effects (S4.3), modify UI to show transition history

**Technical notes**:
- Transition table (subset — full table tuned during integration):
  - Flocker + high stress -> Loner
  - Loner + low stress + long experience -> Explorer
  - Explorer + high stress -> Timid
  - Timid + low stress + long experience -> Flocker
  - Any + very high stress + long experience -> Predator (rare)
  - Predator + low stress + very long experience -> Flocker (redemption)
  - Mimic: copies nearest neighbor's type when experience > threshold
- WGSL constant template table: `const TEMPLATES = array<array<f32, 8>, 7>( ... )` matching TypeScript `PERSONALITY_TEMPLATES`
- Cooldown: `if (experienceTimer < MIN_TRANSITION_TIME) { skip transition check; }`
- `MIN_TRANSITION_TIME = 2.0` seconds (prevents rapid oscillation)

---

### S4.3: Visual Transition Effects

**User story**: As a user, I want to see a visual effect when a boid changes personality so that personality transitions are noticeable and satisfying.

**FRs**: FR8
**Architecture decisions**: None
**Complexity**: Small
**Test tier**: Yolo

**Acceptance criteria**:

```gherkin
Given a boid transitions from Flocker (cyan) to Loner (orange)
When the render shader draws the boid
Then the boid's color lerps from cyan to orange over 0.5 seconds
And the boid briefly flashes brighter during the transition

Given a boid's experienceTimer is < 0.5 seconds (just transitioned)
When the vertex shader processes it
Then the boid's scale pulses (grows and shrinks) for 0.5 seconds

Given 10 boids transition simultaneously
When the render shader draws all 10
Then all 10 show smooth color transitions without frame rate drop
```

**Scope boundaries**:
- DOES: Color lerp based on experienceTimer in fragment shader, scale pulse in vertex shader, brightness flash
- DOES NOT: Add particle effects, trails, or additional geometry for transitions

**Technical notes**:
- In fragment shader: `if (config.experienceTimer < TRANSITION_DURATION) { color = mix(oldColor, newColor, config.experienceTimer / TRANSITION_DURATION); }`
- Problem: the shader does not know the previous personality type after transition. Solutions:
  - (a) Add a `previousPersonalityType: u32` field to BoidConfig (uses the _padding slot)
  - (b) Flash white during transition regardless of old type (simpler, still visually clear)
- Recommend option (b) for simplicity: `color = mix(vec3f(1.0), targetColor, smoothstep(0.0, 0.5, experienceTimer))`
- Scale pulse: `scale *= 1.0 + sin(experienceTimer * 12.0) * 0.2 * (1.0 - experienceTimer / 0.5)` for a decaying oscillation
