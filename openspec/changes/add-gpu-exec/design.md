# Design — gpu-exec

Cross-cutting: `animation-loop.ts` currently imports boid modules.
The split has to stay import-safe for `/boids` and for a future
world page.

## Today

```
gpu-init.ts          adapter / device / GPUInitError
animation-loop.ts    rAF → uniforms → compute → render → ping-pong
                     imports boid-buffers, boid-compute, boid-render
boid-*               plugin
shaders/*.wgsl       ?raw
```

Heritage: D-001 one encoder compute-then-render; D-003 flat
`$lib/gpu`; D-004 WGSL `?raw`.

## After

Kernel (no boid types):

- `initGPU` / `GPUContext` / `GPUInitError` (already this)
- frame: start/stop rAF, clamp dt, create encoder, submit
- hook: encode a compute pass (pipeline + bind group + workgroups)
- optional hook: encode a render pass
- `onDeviceLost`

Plugin (boids):

- ping-pong boid buffers, steering dispatch, instanced draw,
  camera, picking, personality templates

`/boids` wires plugin hooks into the kernel. A non-boid page can
`initGPU` + kernel loop + its own compute shader without importing
`boid-steering.wgsl`.

## Device boundary

This kernel's `GPUDevice` stays independent of PlayCanvas
(`create-app.ts`). No external-device injection. Later depth-copy
interop is `add-splat-cache`, not this node.
