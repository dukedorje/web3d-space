## ADDED Requirements

### Requirement: Browser world renderer home

The browser world renderer SHALL live in this repository
(`web3d-space`). A separate InfiniteGames app MAY consume it later;
it SHALL NOT be the home of the engine while the engine is being
built.

#### Scenario: Stranger finds the renderer

- GIVEN the repo at HEAD
- WHEN they look for the browser world renderer
- THEN they find it under this tree's `src/lib/playcanvas`,
  `src/lib/splat`, `src/lib/gpu`, and `/splat`, not in a sibling
  myscape checkout

### Requirement: Field and splat cache

The continuous representation of appearance SHALL be a neural
radiance field (a radiance value at a point and view). The runtime
representation the browser draws SHALL be a 3D Gaussian splat cache
(SOG, SPZ, or `KHR_gaussian_splatting`) of that field. The browser
page SHALL NOT evaluate a NeRF MLP per pixel.

#### Scenario: Page draws a captured environment

- GIVEN a pre-baked splat cache for a space
- WHEN the viewer loads that environment
- THEN it rasterizes Gaussians, not a per-pixel MLP

### Requirement: PlayCanvas raster host

Opaque mesh and Gaussian splat rasterization SHALL run on PlayCanvas
(`src/lib/playcanvas/create-app.ts`) with WebGPU preferred and
WebGL2 fallback. The viewer SHALL NOT introduce Threlte or
`three/webgpu` as a second raster host.

#### Scenario: Hybrid scene composites in one engine

- GIVEN a mesh room and splat objects (as `/splat/vr-gallery` does today)
- WHEN the frame is drawn
- THEN PlayCanvas owns the graphics device and both the mesh and the
  gsplat components

### Requirement: Mesh then splat depth composite

Opaque mesh SHALL write depth. Splats SHALL depth-test and SHALL NOT
write depth, so Gaussians behind mesh are discarded.

#### Scenario: Pedestal hides the splat behind it

- GIVEN a GLB occluder in front of a splat
- WHEN the camera looks through the occluder
- THEN the hidden Gaussians are not visible

### Requirement: World document

A world SHALL be described as a glTF-family document: imported GLB
meshes (including photogrammetry), optional `KHR_gaussian_splatting`
or sidecar splat caches, cameras, lights, an HDRI environment, and
per-entity LOD distances. Photogrammetry SHALL enter as GLB, not as
an in-browser trainer.

#### Scenario: Fixture names the sky and a mesh

- GIVEN a world document
- WHEN it is valid
- THEN it names an HDRI, at least one GLB, a camera, and LOD cutoffs

### Requirement: Distance LOD

Entities and splat chunks farther than their LOD cutoff SHALL not be
drawn.

#### Scenario: Far content is dropped

- GIVEN an entity whose LOD distance is D
- WHEN the camera is farther than D from that entity
- THEN that entity is not rasterized

### Requirement: GPU compute sidecar

WebGPU compute (today: `src/lib/gpu`, `/boids`) SHALL be a sidecar:
adapter/device init, frame loop, compute dispatch, device-lost
recovery. It SHALL NOT replace PlayCanvas splat rasterization and
SHALL NOT require PlayCanvas to accept an external `GPUDevice`.

#### Scenario: Boids keep their kernel

- GIVEN the boids page
- WHEN the compute sidecar is extracted
- THEN `/boids` still simulates on the sidecar kernel, and `/splat`
  still rasters through PlayCanvas

### Requirement: No hardware ray tracing in v1

The photoreal path SHALL be Gaussian splat rasterization plus mesh
depth composite. The renderer SHALL NOT claim hardware ray tracing
or a per-frame path tracer as v1 behavior.

#### Scenario: Reflections are not a v1 promise

- GIVEN v1 of the browser renderer
- WHEN a visitor inspects the frame
- THEN appearance comes from the splat cache and mesh shading, not
  from a ray-traced bounce
