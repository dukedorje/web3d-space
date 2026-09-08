# steer add-browser-renderer

**When.** 2026-09-08
**Depth.** lean (architecture density). Human said `activate` without
menus — remaining forks are decide-for-me on the intend recommendations.

## Decided

- Home: web3d-space (decide-for-me)
  Why: splat viewer, PlayCanvas, and `$lib/gpu` already live here.
  myscape is an empty InfiniteGames SvelteKit scaffold.
- Raster host: PlayCanvas stays the mesh+splat host (decide-for-me)
  Why: `/splat` already composites with `CameraFrame.sceneDepthMap`.
  In-repo research: no splat lib takes an external `GPUDevice`;
  Reflct left Three.js for PlayCanvas. SCENE.md: do not fork a
  500-line WGSL rasterizer.
- Representation: NeRF is the continuous field (authoring / training);
  3DGS is the runtime quantization / compression (decide-for-me)
  Why: browser v1 does not evaluate an MLP per pixel.
- Ray tracing: splat raster + mesh depth composite (decide-for-me)
  Why: "keep it a nice, simple rendering engine." Hardware RT is not a
  v1 claim.
- World document: glTF/GLB + `KHR_gaussian_splatting` + HDRI + LOD
  distances (decide-for-me)
  Why: photogrammetry already enters as GLB in the dual-branch research.
- GPU exec: lift `$lib/gpu` as a compute sidecar beside PlayCanvas
  (decide-for-me)
  Why: the boids loop is a real WebGPU kernel; it is not a splat
  rasterizer.

## Skipped

- QtA core — term unresolved; stays parked on the epic

## Feeds change

The ADR and `browser-renderer` spec describe a PlayCanvas-hosted
hybrid viewer in this repo. Gaussian splats are the runtime cache of
a NeRF-shaped field, not a competing engine. The boids WebGPU modules
become a compute sidecar in a later change. Threlte/Three.js and
in-browser MLP NeRF are refused for v1.
