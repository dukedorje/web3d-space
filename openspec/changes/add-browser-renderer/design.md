# Design — browser renderer

Cross-cutting: two existing GPU stacks, one new capability, later
nodes (`add-gpu-exec`, `add-world-model`, `add-splat-cache`,
`add-browser-canvas`) must not relitigate this.

## Two stacks today

| Stack | Path | Owns |
|---|---|---|
| PlayCanvas raster | `src/lib/playcanvas/create-app.ts`, `/splat` | `GPUDevice` via `pc.createGraphicsDevice` (`webgpu` then `webgl2`). GSplat + mesh. |
| Custom WebGPU | `src/lib/gpu/gpu-init.ts`, `animation-loop.ts`, `/boids` | A second `navigator.gpu.requestAdapter` / `requestDevice`. Compute then instanced draw. |

They do not share a device. In-repo research
(`docs/research/gaussian-splat-web-tools/synthesis.md`) found no
production splat library that accepts an external `GPUDevice`.

## Calls (steer 2026-09-08)

1. **Home is this tree.** myscape may consume later; do not move the
   engine until it exists.
2. **PlayCanvas is the raster host.** Mesh writes depth, splats
   depth-test-only. Already wired in
   `src/routes/splat/[slug]/+page.svelte` (`sceneDepthMap = true`).
3. **NeRF-shaped field, 3DGS cache.** Training / baking stays off the
   critical path (ASG 6000 / `web3d-space-7uq`). The browser loads a
   pre-baked SOG/SPZ/`KHR_gaussian_splatting` cache.
4. **No hardware RT in v1.** Photoreal path is splat raster, not a
   path tracer.
5. **World document is glTF-family.** HDRI is an environment texture
   on the scene, not a second renderer. LOD is a distance cutoff on
   entities / splat chunks.
6. **`$lib/gpu` is a sidecar.** Device + rAF + compute dispatch, with
   boids as a plugin. It does not replace GSplatComponent.

## What later nodes must not do

- Stand up Threlte/`three/webgpu` as a second raster host next to
  PlayCanvas.
- Evaluate a NeRF MLP per pixel on the page.
- Teach PlayCanvas to use the boids `GPUDevice` (the embeddability
  gap). If compute needs the splat depth buffer, copy or share via
  an agreed compositing strategy (research Strategy B: offscreen
  texture) in `add-gpu-exec` / `add-splat-cache`, not by forking
  PlayCanvas.

## ADR landing

`ARCHITECTURE.md` at repo root. All Systems Go vision stays in
`docs/all-systems-go/`. This ADR is the renderer, not the camera
truck.
