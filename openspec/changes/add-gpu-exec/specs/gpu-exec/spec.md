## ADDED Requirements

### Requirement: Compute kernel without boid steering

`$lib/gpu` SHALL expose a WebGPU execution kernel (adapter/device
init, rAF frame loop, compute-pass dispatch, device-lost recovery)
that a page can import without importing boid steering shaders or
boid buffer types.

#### Scenario: Page starts compute without steering

- GIVEN a page that imports the kernel
- WHEN it inits GPU, starts the frame loop, and dispatches a compute
  pass
- THEN it does not import `boid-steering.wgsl` or `BoidBuffers`

### Requirement: Boids remain a plugin

`/boids` SHALL simulate and draw using the same kernel, with boid
buffers, steering compute, and instanced draw as a plugin.

#### Scenario: Boids page still flies

- GIVEN `/boids` after the extract
- WHEN the page loads in a WebGPU browser
- THEN boids still steer and render, and existing
  `src/lib/gpu/*.test.ts` pass

### Requirement: Own device, not PlayCanvas

The kernel SHALL acquire its own `GPUDevice` via `initGPU`. It SHALL
NOT replace PlayCanvas splat rasterization and SHALL NOT require
PlayCanvas to accept an external `GPUDevice`.

#### Scenario: Two devices stay two

- GIVEN `/boids` and `/splat` in the same app
- WHEN both run
- THEN each stack still creates its own graphics device
