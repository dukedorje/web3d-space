---
sprint: sprint-002
phase: requirements
created: 2026-04-10
status: complete
---

# Sprint 002 Requirements: Boid Personality System

## Functional Requirements

### FR1: Per-Boid Config Storage Buffer

A new GPU storage buffer stores per-boid configuration alongside the existing boid state buffer. Each boid has a `BoidConfig` struct (48 bytes) containing steering weights, perception parameters, personality metadata, and experience tracking fields. The config buffer is created at initialization, resized when boid count changes, and bound to both compute and render pipelines.

**Acceptance criteria**:
- Config buffer created with `STORAGE | COPY_DST` usage flags
- Config buffer bound at `@binding(3)` in the compute bind group
- Config buffer bound at `@binding(2)` in the render bind group
- Buffer size = `boidCount * 48` bytes
- Buffer recreated when boid count changes (alongside state buffers)

### FR2: Single Uber-Shader Compute Pipeline

Replace the multi-variant shader system (`boid-steering-default.wgsl` + `boid-steering-loner.wgsl` + `dispatchAllVariants()`) with a single WGSL compute shader that reads per-boid steering parameters from the config buffer. The shader implements a unified steering loop where separation/alignment/cohesion weights, perception radius, max speed, and wander strength are all read from `BoidConfig` rather than from uniforms or hardcoded values.

**Acceptance criteria**:
- Single `.wgsl` compute shader file replaces both variant shaders
- Shader reads `configIn[index].separationWeight`, `.alignmentWeight`, etc. per boid
- All 7 personality behaviors emerge from different config values (no `if personalityType == PREDATOR` branches for core steering)
- Special behaviors (predator chase, explorer edge-seek, swirler rotation) use targeted branches on `personalityType`
- Single `createComputePipelineAsync` call replaces `createShaderVariants()`
- Single `dispatchWorkgroups` call per frame replaces `dispatchAllVariants()`

### FR3: Seven Personality Templates in TypeScript

Define 7 personality types as TypeScript objects that map to `BoidConfig` field values:

| Personality | Key Trait | Separation | Alignment | Cohesion | Perception | Wander | Speed |
|-------------|-----------|------------|-----------|----------|------------|--------|-------|
| Flocker     | Standard flocking | 1.5 | 1.0 | 1.0 | 15 | 0.0 | 25 |
| Loner       | Avoids crowds | 3.0 | 0.0 | 0.0 | 20 | 0.8 | 20 |
| Predator    | Chases nearest flock | 0.5 | 0.0 | -1.5 | 30 | 0.2 | 35 |
| Explorer    | Seeks world edges | 1.0 | 0.3 | 0.2 | 25 | 1.0 | 22 |
| Swirler     | Rotational orbit | 1.0 | 0.5 | 0.8 | 12 | 0.0 | 20 |
| Timid       | Flees predators | 2.0 | 1.2 | 1.5 | 18 | 0.1 | 30 |
| Mimic       | Copies nearest type | 1.5 | 1.0 | 1.0 | 15 | 0.0 | 25 |

**Acceptance criteria**:
- `src/lib/gpu/personality-templates.ts` exports a `PERSONALITY_TEMPLATES` array/map
- Each template is a plain object with all `BoidConfig` fields
- Template values are tunable constants, not magic numbers buried in code
- `PersonalityType` enum with 7 members

### FR4: Per-Personality Rendering

Each personality type has a distinct visual appearance in the vertex and fragment shaders:

- **Color**: 7 distinct colors (e.g., cyan=flocker, orange=loner, red=predator, green=explorer, purple=swirler, yellow=timid, white=mimic)
- **Shape scaling**: Vertex shader scales the cone geometry per personality (e.g., predators are larger, timid are smaller, swirlers are round)
- Render shader reads `personalityType` from the config buffer

**Acceptance criteria**:
- 7 visually distinguishable boid appearances on screen simultaneously
- Color assignment via lookup table in WGSL (not 7-way if/else chain)
- Shape variation via per-personality scale factors in vertex shader
- No performance regression from adding color/shape branching

### FR5: Remove Multi-Pipeline Variant System

Remove the multi-variant infrastructure introduced in sprint 001:
- Delete `boid-steering-default.wgsl` and `boid-steering-loner.wgsl`
- Remove `ShaderVariant` interface, `createShaderVariants()`, `dispatchAllVariants()` from `boid-compute.ts`
- Remove `shaderVariants` option from `AnimationLoopConfig`
- Remove `GROUP_COUNT` constant from `boid-buffers.ts`
- Update `+page.svelte` to use single pipeline path

**Acceptance criteria**:
- No references to `ShaderVariant`, `createShaderVariants`, `dispatchAllVariants` in codebase
- No references to `group_id` in WGSL shaders (replaced by `personalityType` in config buffer)
- Old `.wgsl` variant files deleted
- `boid-compute.ts` exports single-pipeline creation and dispatch only

### FR6: Boid Inspector UI

Click on the canvas to select the nearest boid. Display an inspector panel showing the selected boid's personality type, config values, current stress level, and experience timer.

**Acceptance criteria**:
- Click on canvas triggers selection (no pointer lock interference — selection happens before lock, or via separate UI mode)
- Nearest boid determined by GPU readback: copy boid positions to staging buffer, readback, CPU raycast
- Inspector panel appears in the UI showing: personality name, all config values, stress, experience timer
- Clicking empty space deselects
- Selected boid index stored in Svelte `$state`

### FR7: Personality Distribution UI

Control what percentage of boids receive each personality type at initialization. Provide either sliders (one per personality) or preset buttons (e.g., "balanced", "predator chaos", "peaceful flock").

**Acceptance criteria**:
- UI control to set distribution ratios for 7 personality types
- Ratios sum to 100% (normalized if needed)
- Changing distribution reinitializes boid config buffer
- At least 3 preset distributions available
- Distribution state stored in Svelte `$state` and fed to initialization

### FR8: Dynamic Personality Rules

Boids accumulate stress and experience over time. When thresholds are crossed, a boid's personality type switches:

- **Stress accumulation**: Boids gain stress when crowded (many neighbors in separation radius). Stress decays over time when uncrowded.
- **Experience timer**: Tracks how long a boid has held its current personality.
- **Transition rules**: High stress + long experience = personality switch. Specific transitions (e.g., stressed flocker becomes loner, stressed loner becomes explorer).

**Acceptance criteria**:
- `stressLevel` and `experienceTimer` updated in compute shader each frame
- Stress increases when `separationCount > threshold`, decreases otherwise
- Personality switches when stress exceeds threshold AND experience timer exceeds minimum duration
- Config buffer updated with new personality's template values on switch
- Transition is visible (boid changes color/shape)

### FR9: Predator Behavior

Predators use negative cohesion (attracted to flocks via config values) and have higher speed. Additional predator-specific logic in the uber-shader:

- Chase: Steer toward the densest nearby cluster
- Scatter: Nearby non-predator boids receive a stress spike when a predator is within separation radius

**Acceptance criteria**:
- Predators visibly chase flock centers
- Non-predator boids near predators accumulate stress faster
- Predator speed exceeds all other types
- Predators do not flock with each other (low alignment with same type)

### FR10: Explorer Behavior

Explorers are attracted to world boundary regions. Additional explorer-specific logic:

- Edge attraction: Steering bias toward the nearest world edge when far from edges
- Explorers wander more than flockers (higher `wanderStrength`)

**Acceptance criteria**:
- Explorers tend toward world edges over time
- Explorers spread out across the world volume rather than clustering
- Edge attraction implemented as a force term in the uber-shader, gated on `personalityType == EXPLORER`

### FR11: Swirler Behavior

Swirlers have a rotational bias that causes them to orbit rather than fly straight:

- Rotational force: Cross-product of velocity with an up-vector, scaled by a swirl factor
- Swirlers form loose orbits around areas of interest

**Acceptance criteria**:
- Swirlers visibly orbit/spiral rather than flying in straight lines
- Rotational bias implemented as a cross-product force in the uber-shader
- `crowdSpeedBoost` field in BoidConfig controls orbit tightness

### FR12: Timid Behavior

Timid boids flock normally but flee from predators with high urgency:

- Predator detection: Check if any neighbor is a predator (read their `personalityType` from config buffer)
- Flee response: Strong repulsion force from predator positions, overriding normal flocking

**Acceptance criteria**:
- Timid boids scatter visibly when a predator approaches
- Flee force magnitude exceeds normal flocking forces
- Timid boids resume normal flocking when no predators are nearby
- Flee behavior implemented in uber-shader, gated on `personalityType == TIMID`

## Non-Functional Requirements

### NFR1: Performance

- Maintain 60 FPS at 300 boids with all 7 personality types active
- Compute pass budget: 6ms at 300 boids (single dispatch replaces 2 dispatches from sprint 001)
- Config buffer memory: < 50KB at 1000 boids (48 bytes * 1000 = 48KB)

### NFR2: Code Size

- No file exceeds 400 lines
- Uber-shader WGSL file stays under 350 lines
- `personality-templates.ts` stays under 200 lines

### NFR3: Maintainability

- Adding a new personality type requires only: (1) add template object in TypeScript, (2) add color/shape entry in render shader lookup table
- No WGSL file duplication (single compute shader, single render shader)

### NFR4: Buffer Alignment

- `BoidConfig` struct is 48 bytes (12 x f32), aligned to 16-byte boundary
- All f32 fields at 4-byte aligned offsets
- `personalityType` (u32) at a 4-byte aligned offset

## BoidConfig Struct Layout

```
struct BoidConfig {
    separationWeight: f32,   // offset  0
    alignmentWeight: f32,    // offset  4
    cohesionWeight: f32,     // offset  8
    perceptionRadius: f32,   // offset 12
    separationRadius: f32,   // offset 16
    maxSpeed: f32,           // offset 20
    wanderStrength: f32,     // offset 24
    crowdSpeedBoost: f32,    // offset 28
    personalityType: u32,    // offset 32
    experienceTimer: f32,    // offset 36
    stressLevel: f32,        // offset 40
    _padding: f32,           // offset 44
}
// Total: 48 bytes
```

## Open Questions

1. **Mimic behavior complexity**: Should mimics copy the nearest boid's config values each frame (expensive — requires finding nearest boid and copying 12 floats), or just adopt the personality type of the nearest boid at transition time?
2. **Predator-to-predator interaction**: Should predators ignore each other entirely, or have mild separation?
3. **Personality transition cooldown**: After switching personality, should there be a minimum cooldown before switching again? (Prevents rapid oscillation.)
4. **Inspector readback frequency**: Should boid data be read back every frame for the inspector, or only on click? Per-frame readback has GPU sync cost.
