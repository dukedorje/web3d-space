# Architecture — browser world renderer

Renderer ADR for this tree. Filmmaking product ground stays in
`docs/all-systems-go/`. Change: `add-browser-renderer`
(`web3d-space-9zr.1`). Steer 2026-09-08 (activate / decide-for-me).
Advise: `openspec/changes/add-browser-renderer/reviews/2026-09-08-advise.md`
(Sol, accept).

This file is why the renderer is shaped this way. Folded requirements
live in `openspec/specs/`. In-flight work is `openspec/changes/`.

## Six calls

1. **Home is this repository.** The engine is built here
   (`src/lib/playcanvas`, `src/lib/splat`, `src/lib/gpu`, `/splat`).
   myscape (InfiniteGames) may consume later. It is not the home
   while the engine is being built.

2. **PlayCanvas is the raster host.** Mesh and Gaussian splat
   rasterization run on PlayCanvas (`src/lib/playcanvas/create-app.ts`)
   with WebGPU preferred and WebGL2 fallback. Do not stand up Threlte
   or `three/webgpu` as a second raster host. Do not fork a custom
   WGSL splat rasterizer.

3. **NeRF-shaped field, 3DGS runtime cache.** The continuous
   representation of appearance is a radiance value at a point and
   view. The browser draws a 3D Gaussian splat cache of that field
   (SOG, SPZ, or `KHR_gaussian_splatting`). The page does not evaluate
   a NeRF MLP per pixel. Baking stays off this path (ASG 6000 /
   `web3d-space-7uq`).

4. **No hardware ray tracing in v1.** Photoreal path is splat raster
   plus mesh depth composite. Not a path tracer, not a hardware-RT
   claim.

5. **World document is glTF-family.** Imported GLB (including
   photogrammetry), optional `KHR_gaussian_splatting` or sidecar splat
   caches, cameras, lights, HDRI environment, per-entity LOD
   distances. Photogrammetry enters as GLB, not as an in-browser
   trainer.

6. **`$lib/gpu` is a compute sidecar.** Adapter/device, frame loop,
   compute dispatch, device-lost recovery. Boids is a plugin of that
   kernel. The sidecar does not replace GSplatComponent and does not
   require PlayCanvas to accept an external `GPUDevice`.

## Two devices

PlayCanvas and `$lib/gpu` each acquire a `GPUDevice`. That is the
accepted cost: more memory, less direct sync, no PlayCanvas fork and
no unproven shared-device API. Later interop (depth copy, offscreen
composite) belongs in `add-gpu-exec` / `add-splat-cache`, not here.

## Depth composite

Opaque mesh writes depth. Splats depth-test and do not write depth.
Already wired: `CameraFrame.sceneDepthMap` in
`src/routes/splat/[slug]/+page.svelte`.

## Distance LOD

Entities and splat chunks farther than their cutoff are not drawn.
Streaming and chunking are `add-splat-cache`.

## /mesh coverage paint

PlayCanvas remains the raster host. `/mesh` paints coverage cells
(covered / thin as magenta ground tiles; unknown unpainted) in a
different encoding from 802.11s link-strength (cyan / gold / grey).
HUD completeness is the fixture grid score. `/mesh` may also load a
world-model document (HDRI + imported GLB) beside that paint; skip with
`?noworld`. Live GPS and DreamBall are other changes.

## Out of this ADR

Nanite-style virtualized geometry, QtA core (term unresolved),
in-browser NeRF training, All Systems Go Thor/6000/NAS
(`web3d-space-5ht`).
