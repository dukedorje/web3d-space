# add-browser-renderer

> **ACTIVE BUILD**

**Rigor:** architecture

Activated 2026-09-08 (`activate` in chat). Steer: decide-for-me on the
six intend forks — recorded in `steer.md` and bead `web3d-space-9zr.1`.

## Why

The `/splat` PlayCanvas viewer and the `/boids` WebGPU loop are two
engines in one SvelteKit tree. Duke wants a browser world renderer:
a continuous radiance field at every point, Gaussian splats as the
runtime compression, an explicit 3D world model, HDRI sky, distance
LOD, and imported meshes. Without an ADR, later nodes will fight over
PlayCanvas vs Threlte, NeRF-in-the-browser vs splat raster, and who
owns the `GPUDevice`.

## What

- Name capability `browser-renderer`.
- Record the six architecture calls (home, raster host, field vs cache,
  ray-tracing stance, world document, GPU sidecar).
- Land `ARCHITECTURE.md` for those calls.
- Do not implement gpu-exec, world-model, splat-cache, or the canvas
  journey in this change.

## Impact

- Capabilities: ADDED `browser-renderer`
- ADRs: will create `ARCHITECTURE.md` (no prior file)

## User journey & surfaces

Duke (and later a visitor), from the existing `/splat` fly-through.

1. **Working** — `/splat/{slug}` already loads a SOG/PLY splat or a
   mesh+splat composite (`vr-gallery`) with WASD + pointer lock.
2. **Empty** — no world document, no HDRI sky, no LOD cutoff, no
   import of an arbitrary GLB into a named world.
3. **Failed** — WebGPU/WebGL2 adapter missing (PlayCanvas
   `createGraphicsDevice` throws; `/boids` throws `GPUInitError`).
4. **Off** — this change writes the contract only. The journey that
   loads a world + HDRI + imported GLB + splat cache is
   `add-browser-canvas` (`web3d-space-9zr.5`).

## Out of scope

- Lifting `$lib/gpu` into a reusable kernel — `add-gpu-exec` (`web3d-space-9zr.2`)
- World document loader — `add-world-model` (`web3d-space-9zr.3`)
- Splat cache + LOD streaming — `add-splat-cache` (`web3d-space-9zr.4`)
- Canvas journey / Playwright — `add-browser-canvas` (`web3d-space-9zr.5`)
- Nanite-style virtualized geometry — parked on the epic
- QtA core — term unresolved; parked
- In-browser NeRF training — parked
- All Systems Go Thor / 6000 / NAS — epic `web3d-space-5ht`
- Rebase onto Threlte / Three.js native `GaussianSplat` — refused this change
