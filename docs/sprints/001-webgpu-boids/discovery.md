---
project: web3d-space
sprint: sprint-001
created: 2026-04-10
new_repo: false
input_quality: existing-prd
has_ux_artifacts: false
has_frontend: true
previous_sprint: null
---

## Project Overview

web3d-space is a GPU-first creative coding environment for the browser. The first deliverable is a 3D boids simulation running entirely on WebGPU compute shaders, with a fly-around camera, per-boid WGSL shader programs, and a SvelteKit host. The project is a father-son creative coding experiment — fun is the invariant.

## Input Analysis

**Source**: `docs/prd-web3d-boids.md` (status: validated, scope_tier: mvp)

The PRD is well-formed with 19 numbered functional requirements (FR1-FR19), 4 NFRs, 6 success metrics, and explicit MVP/Growth/Vision tiers. Input quality: `existing-prd`. Phase 1 can proceed with light-touch processing (focus on expansion and story decomposition, not re-validation).

8 MVP FRs: WebGPU rendering (FR1), boid simulation (FR2), GPU compute steering (FR3), fly-around camera (FR4), 60 FPS animation loop (FR5), boid rendering (FR6), per-boid shaders (FR7), WebGPU detection (FR8).

## New Repo Detection

`new_repo: false` — The project has ~15 source files, a `package.json` with dependencies, `src/` directory with routes and lib modules. However, it is greenfield for GPU work — no WebGPU, WASM, Zig, or boids code exists.

## Existing Codebase Inventory

### Tech Stack

- **Frontend**: SvelteKit 2.47.1, Svelte 5.41.0, Vite 7.1.10, TailwindCSS 4.1.14
- **Database**: Drizzle ORM 0.44.6, better-sqlite3 12.4.1
- **Auth**: @node-rs/argon2 2.0.2 (Lucia-based session management)
- **Testing**: Vitest 4.0.5, Playwright 1.56.1, Storybook 10.3.5
- **Language**: TypeScript 5.9.3 (strict mode)
- **Package Manager**: Bun (bun.lock present)
- **Markdown**: Mdsvex 0.12.6

### Project Structure

```
src/
├── routes/           — SvelteKit pages (welcome, demo/lucia auth flows)
├── lib/
│   ├── server/
│   │   ├── auth.ts   — Session validation, cookies (81 lines)
│   │   └── db/       — Drizzle + SQLite schema (user, session tables)
│   └── index.ts      — Empty library entry point
├── hooks.server.ts   — Auth middleware
├── app.html          — SvelteKit template
└── app.d.ts          — Locals types (user/session)

docs/
├── vision.md         — Product vision
├── prd-web3d-boids.md — Validated PRD
└── research/webgpu-vs-webgl/ — WebGPU vs WebGL research (synthesis + 3 hypothesis findings)
```

### Existing Patterns

- **Frontend**: SvelteKit with file-based routing, Svelte 5 runes
- **Backend**: SvelteKit server routes, Drizzle ORM
- **Auth**: Lucia-based sessions (not relevant to this sprint)
- **API style**: SvelteKit form actions and server load functions
- **Testing**: Vitest for unit, Playwright for E2E
- **Build**: Vite 7 with `@sveltejs/adapter-auto`

### Module Boundaries

- **auth** — Session management, user schema (irrelevant to sprint)
- **db** — Drizzle ORM + SQLite (may be vestigial for this sprint)
- **GPU** — Does not exist yet. This sprint creates it.

## Available Artifacts

- `docs/vision.md` — Product vision (created 2026-04-10)
- `docs/prd-web3d-boids.md` — Validated PRD with 19 FRs (created 2026-04-10)
- `docs/research/webgpu-vs-webgl/synthesis.md` — WebGPU vs WebGL research synthesis
- `docs/research/webgpu-vs-webgl/summary.json` — Machine-readable research summary
- `docs/research/webgpu-vs-webgl/hypotheses/h1-draw-call-perf/findings.md` — Draw call performance
- `docs/research/webgpu-vs-webgl/hypotheses/h2-compute-shaders/findings.md` — Compute shader capabilities
- `docs/research/webgpu-vs-webgl/hypotheses/h5-api-design/findings.md` — API design comparison

## UX Status

No UX artifacts found. `has_frontend: true` (SvelteKit + Svelte components). `has_ux_artifacts: false`.

This is a GPU simulation project — the primary "UI" is a WebGPU canvas with camera controls and a boid count slider. Formal UX specs are not needed for MVP. Phase 1.5 UX Design should be skipped.

## Recommendations

- Input quality is `existing-prd` — Phase 1 should do light-touch expansion (the PRD already has validated FRs).
- Skip Phase 1.5 UX Design — the UI is a GPU canvas with minimal controls, not a form-based interface.
- The auth scaffold and database are not relevant to this sprint's MVP FRs. They can be ignored.
- The WebGPU vs WebGL research strongly supports WebGPU-first architecture. Key findings: 10-35x draw call throughput, first-class compute shaders, WGSL shader language.
- `adapter-auto` in SvelteKit may need to change to `adapter-node` or `adapter-bun` if Growth-tier WebSocket API is pursued later. Not a concern for MVP.
- Per-boid unique pipelines (FR7) is the highest technical risk. Recommend a spike early in execution.
