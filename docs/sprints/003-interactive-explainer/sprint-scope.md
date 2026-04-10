---
sprint: sprint-003
phase: scope
created: 2026-04-10
status: complete
---

# Sprint 003 Scope: Interactive Explainer Page

## Scope Decision

28 MVP functional requirements are **IN SCOPE**. 9 Growth FRs and 3 Vision FRs are **DEFERRED**. This is a large greenfield sprint — all new code, no migration — targeting 18-22 stories across 5 epics.

## In Scope — MVP (28 FRs)

| FR | Title | Epic | Complexity |
|----|-------|------|------------|
| FR1 | Route at `/how-it-works` with 10 topic sections | E1 | Medium |
| FR2 | Each section has heading, prose, interactive element | E1-E4 | (per-story) |
| FR3 | Sticky sidebar navigation with section anchors | E1 | Medium |
| FR5 | CPU vs GPU parallelism Canvas 2D demo | E2 | Medium |
| FR6 | WebGPU pipeline data-flow diagram | E2 | Small |
| FR8 | Interactive 2D boid demo with rule toggles | E2 | Large |
| FR9 | Force vector display on highlighted boid | E2 | Medium |
| FR10 | Steering weight sliders | E2 | Small |
| FR11 | BoidState memory layout diagram (interactive) | E2 | Medium |
| FR12 | BoidConfig struct display (all 12 fields) | E2 | Small |
| FR13 | Ping-pong double-buffer step-through animation | E3 | Medium |
| FR14 | Compute shader source display (Shiki + ?raw) | E3 | Medium |
| FR16 | Neighbor query perception radius visualization | E3 | Medium |
| FR17 | Cone rotation / velocity alignment visualization | E3 | Medium |
| FR18 | Instanced rendering diagram | E3 | Small |
| FR20 | View/projection matrix pipeline diagram | E3 | Small |
| FR22 | 7 personality types display with colors and params | E4 | Medium |
| FR23 | Personality comparison widget (2-type diff) | E4 | Medium |
| FR24 | Mini-simulation with personality distribution | E4 | Large |
| FR25 | State-transition diagram (personality transitions) | E4 | Medium |
| FR26 | Stress time-series graph | E4 | Medium |
| FR29 | Snapshot bridge explanation with code + diagram | E2 | Small |
| FR30 | Buffer recreation lifecycle explanation | E2 | Small |
| FR32 | Shiki syntax highlighting (dynamic import) | E3 | Medium |
| FR33 | Shader source via ?raw imports | E3 | Small |
| FR34 | All terms defined on first use | E1-E4 | (per-story) |
| FR35 | No WebGPU dependency — Canvas 2D only | E1-E4 | (constraint) |
| FR40 | IntersectionObserver lazy-init for all demos | E5 | Medium |
| FR41 | Cross-links between /how-it-works and /boids | E5 | Small |

## Deferred — Growth (9 FRs)

| FR | Title | Reason |
|----|-------|--------|
| FR4 | Reading progress indicator in nav | Polish — not needed for educational value |
| FR7 | Live WebGPU browser support check | Nice-to-have, does not affect demos |
| FR15 | Compute shader line-by-line step-through | High complexity, can layer on later |
| FR19 | Render shader source with annotations | Can add after MVP code block infra exists |
| FR21 | Interactive camera FOV widget | Section 9 is thin but functional without it |
| FR27 | Personality transition visual demo (color lerp) | Requires mini-sim extension |
| FR31 | Full frame loop interactive diagram | Complex diagram, can add post-MVP |
| FR36 | Responsive layout at 768px+ | Desktop-first MVP is acceptable |
| FR37 | @tailwindcss/typography plugin for prose | Manual Tailwind classes work for MVP |

## Deferred — Vision (3 FRs)

| FR | Title |
|----|-------|
| FR28 | Zig/WASM teaser section (text only) |
| FR38 | Glossary mode with hover tooltips |
| FR39 | Light/dark mode themes |

## Story Count

20 stories across 5 epics:

- **E1: Page Foundation & Navigation** — 3 stories
- **E2: Core Concept Demos — GPU & Boids** — 5 stories
- **E3: Shader & Rendering Explainers** — 4 stories
- **E4: Personality System Explainer** — 5 stories
- **E5: Polish & Integration** — 3 stories

## Epic Dependencies

```
E1 (Page Foundation & Navigation)
 |
 +--> E2 (Core Concept Demos)
 |     |
 |     +--> E3 (Shader & Rendering Explainers)
 |
 +--> E4 (Personality System Explainer)
 |
 +--> E5 (Polish & Integration) -- depends on E2, E3, E4
```

E1 must complete first (route, layout, nav, shared utilities). E2 and E4 can proceed in parallel after E1. E3 depends on E2 (code highlighting infra from E2's compute shader story feeds E3). E5 is the final polish pass after all content epics.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Interactive boid demo (FR8) exceeds complexity budget | Medium | Medium | Cap at 30 boids, fixed canvas size, simple 2D physics. No grid partitioning. |
| Shiki WGSL grammar unavailable | Low | Low | Fall back to GLSL grammar which is close enough for WGSL keywords |
| Canvas demo memory leaks in dev HMR | Medium | Low | Shared `createCanvasDemo()` utility with proper $effect teardown |
| 20 stories too many for one sprint | Low | Medium | Stories are mostly independent UI components. Parallelizable across epics. |
| Personality mini-sim (FR24) becomes a second simulation | Medium | Medium | Strict 2D-only, 30 boids max, simplified steering (no stress/transitions) |
