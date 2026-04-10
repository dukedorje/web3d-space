---
sprint: sprint-002
phase: scope
created: 2026-04-10
status: complete
---

# Sprint 002 Scope: Boid Personality System

## Scope Decision

All 12 functional requirements are **IN SCOPE** for this sprint. The feature set is cohesive — the uber-shader migration (FR1-FR2, FR5) is prerequisite for personalities (FR3-FR4), which enable the behavioral variety (FR9-FR12), which motivate the inspector and dynamic switching (FR6-FR8).

## In Scope

| FR | Title | Epic | Complexity |
|----|-------|------|------------|
| FR1 | Per-boid config storage buffer | E1 | Medium |
| FR2 | Single uber-shader compute pipeline | E1 | Large |
| FR3 | 7 personality templates in TypeScript | E2 | Small |
| FR4 | Per-personality rendering (color + shape) | E2 | Medium |
| FR5 | Remove multi-pipeline variant system | E1 | Small |
| FR6 | Boid inspector UI (click to select) | E3 | Large |
| FR7 | Personality distribution UI | E2 | Medium |
| FR8 | Dynamic personality rules | E4 | Large |
| FR9 | Predator behavior | E1/E4 | Medium |
| FR10 | Explorer behavior | E1/E4 | Small |
| FR11 | Swirler behavior | E1/E4 | Small |
| FR12 | Timid behavior | E1/E4 | Small |

## Story Count

14 stories across 4 epics:
- **E1: Uber-Shader Migration** — 4 stories
- **E2: Personality Templates & Rendering** — 4 stories
- **E3: Boid Inspector** — 3 stories
- **E4: Dynamic Personality** — 3 stories

## Epic Dependencies

```
E1 (Uber-Shader Migration)
 |
 +--> E2 (Personality Templates & Rendering)
 |     |
 |     +--> E3 (Boid Inspector)
 |
 +--> E4 (Dynamic Personality)
```

E1 must complete first. E2 and E4 can proceed in parallel after E1. E3 depends on E2 (needs personality type data for the inspector display).

## Not In Scope

- Spatial partitioning / grid acceleration (performance optimization — deferred to sprint 003 if needed)
- Shader hot-reload / HMR pipeline recompilation
- Boid count above 2000 (current O(n^2) neighbor scan limits practical count)
- Sound effects or audio feedback
- Boid trails or motion blur
- Save/load simulation state
- Per-boid unique shader programs (sprint 001's D-002 vision tier — superseded by config-driven approach)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Uber-shader too long (>400 lines) | Medium | Low | Extract utility functions to top of file; special behaviors are short branches |
| Branch divergence kills perf at 7 types | Low | Medium | Profile early in E1; neighbor loop dominates regardless |
| Config buffer binding breaks existing render pipeline | Low | High | E1 S1.1 updates both compute and render bind groups together |
| Dynamic personality causes chaotic oscillation | Medium | Low | Add cooldown timer; tune in E4 |
