# web3d-space

## Executive Summary

web3d-space is a GPU-first creative coding environment for the browser — a place to push WebGPU compute to its limits, build living 3D simulations, and share the results instantly. It exists because the browser is now a legitimate GPU platform and almost nobody is treating it that way. This project explores what becomes possible when you stop apologizing for the web and start exploiting its actual strengths.

---

## Problem Statement

Making interactive GPU visualizations shareable is still harder than it should be. The dominant path — install toolchain, configure bundler, deal with deployment — adds friction between having an idea and running it with someone else. Meanwhile, browser GPU capability has quietly become serious: WebGPU lands compute shaders, 10-35x draw-call throughput over WebGL, and in-browser ML inference at competitive speeds.

The person who feels this most is the builder who just wants to try something — compile a GPU kernel, watch 10,000 boids negotiate space, see if a novel shader idea holds up. Every minute spent on infrastructure is a minute not spent discovering whether the idea was interesting.

If this stays unsolved, the experimentation either never happens or it happens in a heavier environment (native, Python notebooks) where the feedback loop is slower and sharing requires more ceremony.

---

## Core Insight

The browser is not a compromise environment for GPU work — it is the best environment for *shareable* GPU work. WebGPU gives you compute shaders, storage buffers, and render pipelines with near-native throughput. A URL gives you instant distribution with zero install. Combining these with a tight compile-and-serve pipeline (Zig → WASM, SvelteKit, Bun/Elysia) turns the browser into a GPU lab that runs everywhere and shares with a link.

The non-obvious piece: treating each simulation entity as a first-class program — its own shader, its own logic — rather than a uniform instance in a monolithic pipeline. That's the architecture that makes interesting emergent behavior tractable to build and reason about.

---

## Proposed Solution

A SvelteKit application that serves as both the runtime and the IDE for GPU experiments:

- **WebGPU-first rendering and compute** — render pipelines for 3D, compute pipelines for simulation logic, with WebGL as a fallback for device reach
- **Per-entity shader architecture** — each boid (or agent, or particle) owns its own GPU program; shaders can be shared when performance demands it, but individuation is the default
- **Zig → WASM compile pipeline** — GPU-adjacent logic written in Zig, compiled to WASM, served by SvelteKit; this is the path to near-native performance for CPU-side simulation work
- **Embedded API layer** — Elysia and/or Bun WebSocket for real-time data and inter-process communication, embedded in the same process as the frontend
- **Fly-around camera** — first-person 3D navigation as the default interaction model, not a fixed viewport
- **Boids as the proving ground** — the first complete simulation: 3D flock with intelligent per-boid shaders, steering behaviors as GPU compute, observable emergent structure

Sharing is a feature to solve later. The GPU experimentation pipeline is the core.

---

## Key Differentiators

**Per-entity shader individuation.** Most boid simulations run one shader for all entities. Here each boid starts with its own program. This is expensive if done naively — the architecture accounts for that — but it opens a design space that uniform-instance approaches close off entirely.

**Zig as the systems layer.** WASM compiled from Zig gives you manual memory control, deterministic performance, and access to SIMD — without leaving the browser. This is the path to doing physics and spatial indexing at speeds that JavaScript cannot match.

**WebGPU compute, not just render.** The simulation logic runs on the GPU as compute shaders. Boid positions, velocities, and neighbor queries live in GPU storage buffers. The CPU orchestrates; the GPU does the work. This is only possible with WebGPU — WebGL has no compute pipeline.

**No framework overhead on the hot path.** SvelteKit handles routing and server-side concerns. The GPU loop runs outside the reactive system. Svelte 5's fine-grained reactivity means UI updates don't touch simulation state.

---

## Target Users

**Primary: a father and son who want to build GPU experiments together.**

- They want to load a URL and immediately see something moving in 3D
- They want to modify a shader and watch behavior change in real time
- They want to try ideas that feel slightly too ambitious — and have the infrastructure not be the bottleneck
- Success looks like: an evening where two people are arguing about why the boids are doing something unexpected, and then fixing it

There is no broader audience right now. This is a two-person creative coding project. If it ever becomes something shareable beyond that, the vision document will say so.

---

## What This Is NOT

- **Not a production deployment target.** No SLAs, no uptime requirements, no multi-tenant concerns.
- **Not a general-purpose creative coding platform.** This is not p5.js or Observable. It is a focused GPU experiment environment.
- **Not optimized for mobile.** WebGPU compute on iOS is uncertain. This runs on desktop, where the GPU is known-good.
- **Not a bundling/distribution product.** Shareable URLs are a future concern. The compile-and-run pipeline is the present one.
- **Not a game engine.** Scene graphs, asset pipelines, physics engines — none of that unless a specific experiment requires it. The simulation loop is custom.
- **Not enterprise software.** No auth hardening, no multi-user isolation, no audit logs. The auth scaffold in the repo is not the point.

---

## Anti-Vision: How We Lose the Plot

The project dies when it stops being fun. That's the only real failure mode.

**Signs we've gone wrong:**

- We spend more time configuring infrastructure than writing shaders
- We add a feature because it seems professionally correct, not because we want to see what it does
- The first thing a new experiment requires is reading documentation
- We're debugging a deployment pipeline instead of watching boids
- The codebase becomes something we feel obligated to maintain rather than excited to touch
- We add user-facing polish to something we haven't enjoyed building yet
- We start talking about "the product" instead of "the experiment"

**The test:** Would you rather spend an hour working on this than doing something else? If the answer is no, stop and ask why. The friction is the bug.

**The escape hatch:** Delete the abstraction. Go back to the raw WebGPU calls. Start with a triangle. Recover the feeling of watching something on the GPU do exactly what you told it to do.

---

## Changelog

_Empty on creation. Updated by `/vision update`._
