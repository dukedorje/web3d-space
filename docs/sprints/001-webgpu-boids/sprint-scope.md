---
sprint: sprint-001
sprint_size: standard
created: 2026-04-10
total_frs: 10
in_scope_frs: 10
deferred_frs: 0
estimated_stories: 14
estimated_epics: 5
---

# Sprint Scope

## Sprint Size
**standard** — First sprint, greenfield GPU work, all 10 MVP FRs included. No velocity data to calibrate against. 14 estimated stories across 5 clusters is within standard range (8-18).

## In-Scope Clusters

### Cluster A: GPU Foundation
- **FRs**: FR1 (WebGPU rendering), FR8 (detection/errors), FR9 (resource cleanup)
- **Estimated stories**: 3
- **Complexity**: medium
- **Rationale**: Everything depends on GPU initialization. Must come first.

### Cluster B: Boid Simulation Core
- **FRs**: FR2 (flocking rules), FR3 (GPU compute steering), FR5 (animation loop)
- **Estimated stories**: 4
- **Complexity**: high
- **Rationale**: The core deliverable — compute shaders executing steering logic on GPU.
- **Depends on**: Cluster A

### Cluster C: 3D Rendering & Camera
- **FRs**: FR6 (instanced boid geometry), FR4 (fly-around camera)
- **Estimated stories**: 3
- **Complexity**: medium
- **Rationale**: Without rendering and camera, nothing is visible or interactive.
- **Depends on**: Cluster A

### Cluster D: Shader Individuation
- **FRs**: FR7 (per-boid shader programs)
- **Estimated stories**: 2
- **Complexity**: high
- **Rationale**: Core architectural differentiator. Highest technical risk — needs spike first. Degrade gracefully if pipeline limits hit.

### Cluster E: Interactive Controls
- **FRs**: FR10 (boid count slider + steering parameter controls)
- **Estimated stories**: 2
- **Complexity**: low
- **Rationale**: Primary interactive feedback loop referenced in both user journeys.

## Stretch Goals

None — all clusters are IN scope.

## Deferred to Future Sprints

None — all MVP FRs included in this sprint.

Growth/Vision FRs from PRD (FR11-FR19) remain deferred per PRD tier assignment.

## Scope Risks

- **Per-boid pipeline compilation** (Cluster D) — could stall if >64 unique pipelines. Mitigation: spike pipeline creation early; degrade to shared shader if limits hit.
- **O(n²) neighbor queries** (Cluster B) — limits boid count without spatial partitioning (Growth tier). Mitigation: default 300 boids is manageable at O(n²); add GPU spatial hash in future sprint.
- **WGSL import method** — untested whether Vite `?raw` works for `.wgsl` files. Mitigation: resolve in Cluster A spike.

## FR Disposition Summary

| FR | Cluster | Status | Rationale |
|----|---------|--------|-----------|
| FR1 | A | IN | GPU foundation — everything depends on this |
| FR2 | B | IN | Core boid simulation |
| FR3 | B | IN | GPU compute steering — the main technical deliverable |
| FR4 | C | IN | Fly-around camera — primary interaction model |
| FR5 | B | IN | Animation loop — frame timing and delta-time |
| FR6 | C | IN | Boid rendering — instanced geometry |
| FR7 | D | IN | Shader individuation — core differentiator |
| FR8 | A | IN | WebGPU detection and error handling |
| FR9 | A | IN | GPU resource cleanup on navigation |
| FR10 | E | IN | Boid count and parameter controls |
