# H5: Compositing Gaussian Splats with Existing WebGPU Scene

## Summary
**Confirmed and well-specified.** WebGPU natively supports device sharing. The hard problem is depth: splat renderers disable depth testing and use back-to-front alpha blending, conflicting with the depth-write pipeline of the boid renderer. Four compositing strategies exist.

## How Splat Renderers Work at GPU Level
Three stages per frame:
1. **Pre-processing compute pass** — culling, projection, depth calculation per splat
2. **Sort compute pass** — GPU radix sort (or CPU sort) orders splats by view-space depth
3. **Rasterization render pass** — splats drawn as quads, back-to-front, alpha blending, **depth testing disabled**

The no-depth-write constraint is fundamental to the alpha-compositing math, not an implementation choice.

## WebGPU Device Sharing
Per the WebGPU spec: "Canvas context creation and WebGPU device creation are decoupled, and any GPUCanvasContext may be dynamically used with any GPUDevice." A single GPUDevice supports any number of canvases. The existing `gpu-init.ts` creates one GPUDevice — a splat renderer simply receives the same device reference.

## Compositing Strategies

### Strategy A: Same Pass, Splats First (Recommended for Background-Only)
- Render splats into color attachment with `depthWriteEnabled: false`
- Then render boids with depth testing enabled
- Boids always appear in front (correct for background use case)
- **Lowest overhead**, no extra memory
- Limitation: splats cannot correctly interpenetrate with boid geometry

### Strategy B: Offscreen Texture Composite (Cleanest Architecture)
- Run splat compute + render targeting an offscreen `GPUTexture`
- Draw fullscreen quad sampling that texture as background in main pass
- Cleanest code boundary, well-defined interface
- Extra cost: one viewport-sized RGBA texture + one fullscreen quad draw

### Strategy C: Multi-Canvas with CSS Compositing
- Two stacked `<canvas>` elements with `position: absolute`
- Splat renderer owns one canvas, boids the other (transparent background)
- Least change to existing boid code
- Canvas already uses `alphaMode: 'premultiplied'` (compatible)

### Strategy D: Depth Pre-Pass (Overkill for Background)
- Depth-only pre-pass writes boid geometry into depth buffer
- Render splats with `depthWriteEnabled: false`, `depthCompare: 'less'`
- Render boids again in color pass
- Correct interpenetration but 2x boid draws — unnecessary for background-only

## Performance Comparison
| Strategy | Extra GPU Memory | Extra Draw Calls | Best For |
|---|---|---|---|
| A (same pass) | None | Splat draws | Background-only, simplest |
| B (offscreen texture) | Viewport RGBA | Splats + 1 quad | Clean architecture |
| C (multi-canvas) | None | Splats in separate context | Minimal code change |
| D (depth prepass) | None | 2x boid + splat draws | Full interpenetration |

## Integration Points in This Codebase
- `animation-loop.ts`: AnimationLoopConfig accepts optional renderers; add `splatRenderer?`
- `gpu-init.ts`: Returns GPUContext with device — pass same device to splat renderer
- `+page.svelte:68`: Canvas already `alphaMode: 'premultiplied'`
- `boid-render.ts:218-221`: Existing depth config: `depthWriteEnabled: true, depthCompare: 'less'`

## Key Blocker
No pure-WebGPU splat renderer offers a "render to my texture" or "use my device" API. All open-source WebGPU implementations are standalone viewers. Options: fork one, write a minimal renderer (~500 lines WGSL+TS), or use PlayCanvas engine.

## Sources
- [1] WebSplatter paper, [2] WebGPU spec explainer, [3] WebGPU Fundamentals, [4-6] Tutorial sources, [7] Scthe/gaussian-splatting-webgpu, [8] GaussianSplats3D README, [9-11] Codebase files
