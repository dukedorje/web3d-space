# add-gpu-exec

> **PENDING**

**Rigor:** change

Bead `web3d-space-9zr.2`. Depends on `add-browser-renderer` (ADR: `$lib/gpu` is a compute sidecar, not the splat rasterizer).

## Why

`src/lib/gpu/animation-loop.ts` is a boids frame: it imports
`boid-buffers`, `boid-compute`, and `boid-render`. A world page that
wants device init, rAF, compute dispatch, and device-lost recovery
cannot do that without pulling steering. The ADR forbids teaching
PlayCanvas to take this `GPUDevice`; the kernel must stand alone.

## What

- Name capability `gpu-exec`.
- Split a reusable kernel (init, frame loop, compute dispatch,
  device-lost) from the boids plugin (buffers, steering WGSL,
  instanced draw, camera, picking).
- Keep `/boids` on the same kernel.
- Do not share the PlayCanvas graphics device.

## Impact

- Capabilities: ADDED `gpu-exec`
- ADRs: none (follows `ARCHITECTURE.md` call 6)

## User journey & surfaces

Duke, from `/boids`.

1. **Working** — `/boids` already inits WebGPU, runs compute then
   instanced draw, recovers via `GPUInitError`.
2. **Empty** — no caller can start a compute pass without importing
   `boid-steering.wgsl`.
3. **Failed** — no adapter (`GPUInitErrorCode.NO_ADAPTER` /
   `NO_WEBGPU_API`).
4. **Off** — PlayCanvas `/splat` is a different device; this change
   does not composite with it.

## Out of scope

- World document / HDRI / LOD — `add-world-model`
- Splat cache — `add-splat-cache`
- Canvas journey — `add-browser-canvas`
- Sharing a `GPUDevice` with PlayCanvas — refused in ARCHITECTURE.md
- Fold of `add-browser-renderer` — deferred until SHALLs are true
