---
sprint: sprint-002
phase: 2A
created: 2026-04-10
decisions: 5
status: proposed
supersedes: D-002
---

# Architecture Decisions — Sprint 002

## D-007: Uber-Shader with Per-Boid Config Buffer (Supersedes D-002)

**Significance**: CRITICAL

**Context**: Sprint 001 used shader variant groups (D-002) — separate WGSL files per behavior type, one pipeline per variant, `dispatchAllVariants()` iterating over all pipelines. This worked for 2 groups but does not scale to 7 personality types: 7 shader files with duplicated boilerplate, 7 pipeline compilations, 7 dispatches per frame, 7 branches in the render shader.

**Options**:

| Option | Pros | Cons |
|--------|------|------|
| **A: Single uber-shader reading per-boid config buffer** — One WGSL compute shader reads steering weights, radii, and speeds from a per-boid `BoidConfig` storage buffer. Personality differences emerge from different config values. Special behaviors (predator chase, swirler rotation) use short branches on `personalityType`. | Single pipeline, single dispatch. Zero code duplication. Adding a personality = adding a JS object. Config changes are buffer writes, not recompilations. | Branch divergence within workgroups when boids of different types share a workgroup. Config buffer adds 48 bytes/boid memory. |
| **B: 7 shader variant files (extend D-002)** — One WGSL file per personality type, 7 pipelines, 7 dispatches. | Each shader is self-contained and readable. No branch divergence. | 7 files x ~130 lines = ~910 lines of duplicated WGSL. 7 async pipeline compilations (350-3500ms). 7 dispatches per frame. Adding a type = writing a new shader. Violates NFR3. |
| **C: Uber-shader with no config buffer (uniforms only)** — Single shader with global uniforms, personality type stored in boid state, shader branches on type to select hardcoded constants. | No extra buffer. Single dispatch. | Constants hardcoded in WGSL — adding a personality requires editing the shader. Cannot tune parameters from JS. Does not support dynamic personality switching without shader recompilation. |

**Decision**: **Option A** — Single uber-shader with per-boid config buffer.

The config buffer approach makes personality a data problem, not a code problem. The neighbor scan loop (O(n) per boid) dominates compute time; the cost of reading 12 floats from a storage buffer and a few personality-type branches is negligible. At 300 boids with 64-thread workgroups, there are ~5 workgroups — even worst-case divergence means each workgroup runs all 7 branches sequentially, adding microseconds against milliseconds of neighbor scanning.

**Consequences**:
- D-002's `ShaderVariant`, `createShaderVariants()`, `dispatchAllVariants()` are removed
- `group_id` field in `BoidState` is removed (replaced by `personalityType` in `BoidConfig`)
- Compute bind group gains a fourth binding (`@binding(3)` for config buffer)
- Render bind group gains a third binding (`@binding(2)` for config buffer)
- Uniform buffer no longer carries steering weights (only deltaTime, boidCount, worldSize, VP matrix)

---

## D-008: BoidConfig Struct Layout — 48 Bytes Aligned

**Significance**: HIGH

**Context**: The per-boid config buffer needs a struct layout that is WGSL-compatible (16-byte aligned), contains all personality-varying parameters, and includes metadata for dynamic personality transitions (FR8). The struct must be writable from TypeScript (via `Float32Array` / `Uint32Array`) and readable in both compute and vertex shaders.

**Options**:

| Option | Pros | Cons |
|--------|------|------|
| **A: 48 bytes — 11 f32 fields + 1 u32 + 1 padding** — Matches the existing 48-byte boid state stride. Clean alignment. Room for experience/stress tracking. | Same stride as BoidState — simple mental model. 16-byte aligned. All fields at natural alignment. | 4 bytes wasted on padding. Could fit one more parameter. |
| **B: 64 bytes — add more tuning fields** — Extra fields for future growth: flee radius, chase factor, orbit speed, etc. | Room for future personalities without layout change. | Wastes 16+ bytes per boid now. At 2000 boids: 128KB vs 96KB. Premature. |
| **C: 32 bytes — minimal config** — Only core steering weights + personality type. No experience/stress tracking. | Smaller buffer. Simpler. | Cannot support FR8 (dynamic personality) without a separate buffer. Two buffer additions instead of one. |

**Decision**: **Option A** — 48 bytes with the following layout:

```
struct BoidConfig {          // offset  size
    separationWeight: f32,   //   0      4
    alignmentWeight: f32,    //   4      4
    cohesionWeight: f32,     //   8      4
    perceptionRadius: f32,   //  12      4
    separationRadius: f32,   //  16      4
    maxSpeed: f32,           //  20      4
    wanderStrength: f32,     //  24      4
    crowdSpeedBoost: f32,    //  28      4
    personalityType: u32,    //  32      4
    experienceTimer: f32,    //  36      4
    stressLevel: f32,        //  40      4
    _padding: f32,           //  44      4
}                            // total: 48
```

**Consequences**:
- TypeScript `BYTES_PER_CONFIG = 48` constant mirrors `BYTES_PER_BOID`
- Config data packed via `Float32Array` with `Uint32Array` view for `personalityType`
- `experienceTimer` and `stressLevel` are written by the compute shader each frame (config buffer needs `read_write` in compute)
- `_padding` reserved for future use (e.g., a flags bitfield)

---

## D-009: Personality Templates as TypeScript Objects

**Significance**: MEDIUM

**Context**: FR3 requires 7 personality types with distinct config values. These values need to be (a) used to initialize the config buffer, (b) displayed in the inspector UI, and (c) applied when a boid transitions personality. The question is where these templates live.

**Options**:

| Option | Pros | Cons |
|--------|------|------|
| **A: TypeScript objects in `personality-templates.ts`** — Each template is a typed object with all BoidConfig fields. Exported as an array indexed by personality type enum. | Full TypeScript type safety. Trivially serializable. UI can display template values. Initialization code reads directly from templates. | Templates and WGSL struct must stay in sync manually. |
| **B: JSON config file** — Templates in a `.json` file loaded at runtime. | Editable without recompilation. Could support user-created personalities. | No type safety without schema validation. Extra async load step. Premature for 7 fixed types. |
| **C: WGSL constants** — Personality defaults as constant arrays in the shader. | No JS-to-GPU sync issue. | Cannot be displayed in UI. Cannot be tuned without shader edit. Violates FR3 requirement for TypeScript definitions. |

**Decision**: **Option A** — TypeScript objects.

```typescript
export const PERSONALITY_TEMPLATES: Record<PersonalityType, BoidConfigTemplate> = {
    [PersonalityType.Flocker]: { separationWeight: 1.5, alignmentWeight: 1.0, ... },
    [PersonalityType.Loner]:   { separationWeight: 3.0, alignmentWeight: 0.0, ... },
    // ...
};
```

**Consequences**:
- `personality-templates.ts` is the single source of truth for personality config values
- Initialization: iterate boids, look up template by assigned type, pack into config buffer
- Inspector UI imports templates to show "default" vs "current" values
- Dynamic personality switch (FR8): compute shader sets `personalityType` to new value; CPU-side callback copies new template values into config buffer (or shader does it directly)

---

## D-010: Boid Selection via GPU Readback + CPU Raycast

**Significance**: MEDIUM

**Context**: FR6 requires clicking a boid to select it. Boid positions are GPU-resident. Two approaches: (1) read back all positions and do CPU-side raycast, or (2) GPU-side picking with a color-coded ID render pass.

**Options**:

| Option | Pros | Cons |
|--------|------|------|
| **A: GPU readback + CPU raycast** — On click, copy the current boid state buffer to a staging buffer with `MAP_READ`. Map it, read all positions, find the nearest boid to the click ray. | Simple. No extra render pass. Works with existing buffer infrastructure. One-time cost on click, not per frame. | Async readback has 1-2 frame latency. Reading all boid positions (300 x 48 bytes = 14.4KB) is fast but involves a GPU-CPU sync point. |
| **B: GPU color-coded picking pass** — Render boids to an offscreen texture with boid index encoded as color. Read back the single pixel under the click. | Pixel-perfect selection. Subframe cost (one pixel readback). | Extra render pass and offscreen texture. More complex pipeline setup. Overkill for selecting among 300 point-like objects. |

**Decision**: **Option A** — GPU readback + CPU raycast.

At 300 boids, reading back 14.4KB is trivially fast. The click-to-select interaction is low-frequency (human clicks, not per-frame). The async nature of `mapAsync` means the selection result appears on the next frame — imperceptible to the user.

Implementation:
1. On canvas click (before pointer lock, or via a "select mode" toggle), compute a ray from camera position through the click point
2. `copyBufferToBuffer` from active boid storage to a pre-allocated staging buffer
3. `mapAsync` the staging buffer, read positions, find minimum distance to ray
4. Store selected boid index in Svelte `$state`

**Consequences**:
- A persistent staging buffer (`MAP_READ | COPY_DST`) is created alongside boid buffers
- Click handler must transform screen coordinates to world-space ray using inverse VP matrix
- Selection mode may conflict with pointer lock — need a UI toggle or modifier key (e.g., Shift+click selects without entering pointer lock)

---

## D-011: Experience Accumulation in Compute Shader

**Significance**: MEDIUM

**Context**: FR8 requires boids to accumulate stress from crowding and track time in their current personality. This data drives personality transitions. The question is whether accumulation happens on GPU (in the compute shader) or CPU (after readback).

**Options**:

| Option | Pros | Cons |
|--------|------|------|
| **A: GPU-side accumulation** — The compute shader reads and writes `stressLevel` and `experienceTimer` in the config buffer each frame. When thresholds are crossed, the shader writes a new `personalityType` and resets the timer. | Zero CPU involvement per frame. All state stays GPU-resident. Transitions happen at simulation speed. | Config buffer must be `read_write` in compute. Personality template values (the new config) must be available in WGSL — either as a constant table or a separate "template buffer." |
| **B: CPU-side accumulation** — Read back stress/experience each frame, evaluate transition rules in TypeScript, write back new config values. | Full flexibility in transition rules (can use complex JS logic). Easy to debug and tune. | Per-frame GPU readback of the full config buffer is expensive. GPU-CPU sync every frame. Defeats the purpose of GPU-resident state. |
| **C: Hybrid — GPU accumulates, CPU evaluates** — Shader increments stress/timer. CPU periodically (every N frames) reads back, evaluates transitions, writes new configs. | Best of both: no per-frame sync, full JS rule flexibility on transitions. | Complexity of periodic sync. Transitions have N-frame latency. |

**Decision**: **Option A** — Full GPU-side accumulation and transition.

The transition rules are simple enough to express in WGSL: threshold comparisons and a lookup into a constant array of personality template values. The shader already iterates all neighbors — counting neighbors in separation radius (for stress) is free. Incrementing a timer by deltaTime is one addition. Writing a new personality type is one u32 store.

For the template lookup, embed a constant array in the WGSL uber-shader:
```wgsl
const TEMPLATE_COUNT = 7u;
// Packed as: [sepW, aliW, cohW, percR, sepR, maxSpd, wanderStr, crowdBoost]
const TEMPLATES = array<array<f32, 8>, 7>( ... );
```

When a personality switch occurs, the shader copies template values into the boid's config fields and resets `experienceTimer` and `stressLevel`.

**Consequences**:
- Config buffer bound as `storage, read_write` in compute (not `read` only)
- WGSL shader contains a constant template table (must stay in sync with TypeScript templates)
- Personality transitions are deterministic given the same simulation state (reproducible)
- No CPU readback needed for transitions — transitions are visible immediately via render shader reading updated `personalityType`
- The TypeScript templates in `personality-templates.ts` and the WGSL constant table are two sources of truth — a code comment and acceptance test must verify they match

---

## Superseded Decisions

### D-002 (Sprint 001): Per-Boid Shader Strategy — Shader Variant Groups

**Status**: Superseded by D-007.

D-002 introduced shader variant groups with per-boid `group_id` and multi-pipeline dispatch. This was correct for sprint 001's 2-variant scope but does not scale to 7+ personality types. The uber-shader approach (D-007) replaces variant groups entirely. The `group_id` field in `BoidState` is removed; personality differentiation moves to the `BoidConfig` buffer.

## Requirements Conflicts

No direct conflicts between sprint 002 requirements. The following items need attention:

1. **Template sync**: D-011 requires WGSL constant template values that must match D-009's TypeScript templates. An acceptance test should verify these are in sync (e.g., a build-time assertion or test that packs TS templates and compares with expected WGSL values).

2. **Config buffer access mode**: D-008 defines the config buffer. D-011 requires it to be `read_write` in compute. D-010 may need to read it for inspector display. The buffer usage flags must include `STORAGE | COPY_SRC | COPY_DST` to support all access patterns.

3. **Pointer lock vs selection**: D-010's click-to-select conflicts with the existing pointer lock (click locks the cursor for camera). FR6 needs a UI mode toggle or modifier key to disambiguate. Recommend: Shift+click for selection, plain click for pointer lock.
