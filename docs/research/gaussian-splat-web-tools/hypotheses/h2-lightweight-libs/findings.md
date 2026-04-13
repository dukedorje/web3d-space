# H2: Lightweight Libraries as Embeddable Alternatives

## Summary
**Confirmed.** Multiple lightweight libraries exist, but **none offer true WebGPU device sharing**. All production-grade options (gsplat.js, Spark, GaussianSplats3D) are WebGL-only. Babylon.js is the only engine with native WebGPU splat support but requires full engine adoption.

## Key Libraries

### gsplat.js (huggingface/gsplat.js)
- npm: `gsplat` v1.2.9, MIT, 1,608 stars, ~5k weekly downloads
- **WebGL2 only** — confirmed from source (`canvas.getContext("webgl2")`)
- Zero dependencies, accepts optional existing canvas
- Cannot share a GPUDevice — creates own WebGL2 context
- Formats: .splat, .ply

### Spark (@sparkjsdev/spark)
- MIT, 2,100+ stars, actively maintained (v2.0 preview June 2025)
- **WebGL2 via Three.js** — targets "98%+ WebGL2 support"
- Most feature-rich: animations, dynamic editing, shader graph, skeletal animation, LoD streaming
- Formats: .ply, .spz, .splat, .ksplat, .sog
- Embeds as `SplatMesh` in existing Three.js scene — does NOT take over render loop
- Open question: does it work with Three.js WebGPURenderer?

### mkkellogg/GaussianSplats3D
- ~2.7K stars, accepts external `THREE.WebGLRenderer`
- **Best WebGL embeddability** — you pass your own renderer, camera, scene
- Formats: .ply, .splat, .ksplat
- Does not own the render loop

### Babylon.js Gaussian Splatting
- First-class in Babylon.js v7+ — **both WebGL and WebGPU supported**
- `BABYLON.ImportMeshAsync("file.splat", scene)` → GaussianSplattingMesh
- Formats: .splat, .ply, .spz, .sog
- V9 (March 2026): shadows, SOGs, triangle splatting
- **Requires adopting Babylon.js as full renderer** — not a lightweight embed

### antimatter15/splat
- Original lightweight web splat viewer, WebGL 1.0
- Self-contained viewer, not a library — deprecated in favor of Spark

### WebGPU Research Implementations
- **Scthe/gaussian-splatting-webgpu**: TS + WGSL, 30 stars, reference only
- **jeantimex/splat**: TS + WGSL, 30 stars, created Feb 2026, no npm
- **MarcusAndreasSvensson/gaussian-splatting-webgpu**: 3-8 fps on M1, reference only
- **Lichtso/splatter**: Rust + WGSL, 75 stars, MIT
- None are published npm packages or designed for external device sharing

## Critical Finding: WebGPU Device Sharing Gap
No production-grade library supports injecting an external `GPUDevice`. Three paths exist:
1. **Adopt Babylon.js** as full WebGPU renderer
2. **Fork/adapt** a research WebGPU implementation to accept external GPUDevice
3. **Offscreen canvas blit**: render WebGL splats to offscreen canvas → upload as WebGPU texture each frame

## Sources
- [1-2] gsplat.js GitHub + source, [3] antimatter15/splat, [4] GaussianSplats3D, [5-6] Spark, [7-8] Babylon.js docs, [9] MarcusAndreasSvensson WebGPU impl
