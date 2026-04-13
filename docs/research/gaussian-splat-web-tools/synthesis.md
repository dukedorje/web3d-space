# What are the best tools and libraries for rendering and generating Gaussian splats in web-based 3D scenes?

## Executive Summary

PlayCanvas Engine (v2.17.2, MIT) is the most production-ready option for WebGPU Gaussian splat rendering in a SvelteKit app, offering the only complete ecosystem spanning capture-to-web-display with its SOG format achieving 95% size reduction over raw PLY files [1]. However, integrating any splat renderer into an existing WebGPU render loop (such as the boids simulation in this codebase) faces a significant gap: no off-the-shelf library exposes a "use my GPUDevice / render to my texture" API, requiring either adopting PlayCanvas as the primary engine, forking a research implementation, or using a multi-canvas CSS compositing strategy [5][6]. For splat generation, the fully open-source pipeline of COLMAP + gsplat (Apache 2.0) produces near-INRIA-quality results in 20 minutes on a mid-range GPU [8], while AI-based generation from text/image prompts remains limited to single-object prototyping and is not production-ready for environments [12]. **Overall confidence: Medium-High** -- the rendering and training toolchains are mature, but the WebGPU integration story requires custom engineering work.

## Key Findings

### Web Rendering: PlayCanvas Leads, but a WebGPU Embeddability Gap Persists

PlayCanvas Engine provides the most complete browser-based Gaussian splat stack available today. Its ecosystem spans the full workflow: the `splat-transform` CLI converts PLY to the SOG format (open-sourced September 2025), SuperSplat (v2.24.4) provides a web-based editor for trimming and optimizing splat data, and the runtime GSplatComponent handles rendering with LOD streaming [1]. The engine supports both WebGL2 and WebGPU backends, and its Unified Splat Rendering (beta) enables global depth sorting across multiple splat components [1]. Performance claims are substantiated by the Reflct case study, which reported frame rates nearly doubling and memory usage dropping 80% after migrating from Three.js [1]. A recommended budget of 4 million splats applies for high-end desktop, with fill rate as the primary bottleneck [1].

Multiple lightweight alternatives exist but all production-grade options are WebGL-only. gsplat.js (HuggingFace, MIT, 1,608 stars) is zero-dependency but creates its own WebGL2 context [2]. Spark (2,100+ stars) is the most feature-rich option with animations, LoD streaming, and a shader graph, embedding as a SplatMesh within Three.js [2]. GaussianSplats3D (~2,700 stars) offers the best embeddability in WebGL, accepting an external Three.js renderer, camera, and scene [2]. Babylon.js (v7+) is the only other engine with native WebGPU splat support, including shadows and triangle splatting in v9 (March 2026), but requires full engine adoption [2].

A critical gap exists for WebGPU specifically: no production library supports injecting an external GPUDevice. Several WebGPU research implementations exist (Scthe, jeantimex, MarcusAndreasSvensson, Lichtso) but all are standalone viewers with low star counts, no npm packages, and no external device-sharing APIs [2]. This means integrating splats into an existing WebGPU pipeline requires one of three paths: adopt a full engine (PlayCanvas or Babylon.js), fork and adapt a research implementation, or use an offscreen canvas blit from WebGL [2][5].

### Integration Architecture: Four Compositing Strategies

The WebGPU spec explicitly supports device sharing -- a single GPUDevice can serve multiple canvases, and canvas context creation is decoupled from device creation [5]. The core technical challenge is that splat renderers fundamentally disable depth testing during their back-to-front alpha-blended rasterization pass, which conflicts with the depth-write pipeline used by standard mesh renderers like the boid renderer [5].

Four compositing strategies were identified, ordered by complexity:

**Strategy A (Same Pass, Splats First)** renders splats with `depthWriteEnabled: false` then boids with depth enabled. This is the lowest overhead approach and correct when splats serve as background only, but does not support interpenetration [5].

**Strategy B (Offscreen Texture)** renders splats to a separate GPUTexture and composites as a fullscreen quad background. This provides the cleanest code boundary at the cost of one viewport-sized RGBA texture [5].

**Strategy C (Multi-Canvas CSS)** uses two stacked canvas elements with z-index layering. This requires the least change to existing boid code and is compatible with the codebase's existing `alphaMode: 'premultiplied'` configuration [5].

**Strategy D (Depth Pre-Pass)** supports full interpenetration but requires drawing boids twice -- overkill for a background use case [5].

The existing codebase is well-structured for any of these approaches: AnimationLoopConfig can accept an optional splatRenderer, the same GPUContext can be passed to both renderers, and the canvas already uses premultiplied alpha [5].

### Splat Generation: Mature Open-Source Pipeline with License Nuances

A complete open-source pipeline exists for converting photographs into web-ready Gaussian splats. The workflow is: capture photos, run COLMAP (BSD) for structure-from-motion preprocessing, train with a 3DGS implementation, then convert the output PLY to a web format [8].

The recommended trainer is **gsplat** (nerfstudio-project, Apache 2.0, 4,787 stars), which achieves PSNR 28.1 dB in 20 minutes on an RTX 3060 with only 4 GB VRAM -- the fastest and most memory-efficient option [8]. **Nerfstudio Splatfacto** (Apache 2.0) offers the easiest workflow by wrapping COLMAP automatically, at PSNR 27.9 dB [8]. The original INRIA 3DGS achieves the highest quality (PSNR 28.4 dB) but carries a **non-commercial license** that disqualifies it for production use [8]. **OpenSplat** (AGPLv3) is notable as the only trainer supporting NVIDIA, AMD ROCm, Apple Metal, and CPU backends [8].

Quality differences between all tools are under 1 dB PSNR, which is barely perceptible [8]. The output pipeline is straightforward: all trainers produce .ply files, which are then converted via `splat-transform input.ply output.sog` for PlayCanvas delivery (95% size reduction) or to SPZ format (~10x smaller, on track for glTF standardization) [1][8].

Hardware requirements center on NVIDIA GPUs for the Python-based trainers, with cloud GPU rental costing $0.04-0.12 per scene on services like Vast.ai or RunPod [8]. Commercial alternatives (Luma AI, Polycam, Scaniverse) are worthwhile for users without NVIDIA GPUs, non-technical users, or time-constrained workflows [8].

### AI-Based Generation: Prototyping Only, Not Production-Ready

AI-based Gaussian splat generation from text or image prompts is functional for single-object prototyping but not mature enough for production environments [12]. **TRELLIS** (Microsoft, CVPR 2025) is the most capable tool, converting an image to 3D Gaussians in approximately one minute with direct .ply export [12]. However, TRELLIS 2 dropped Gaussian output entirely in favor of meshes, signaling an industry trend away from generative 3DGS [12]. **DreamGaussian** (ICLR 2024) and **GaussianDreamer** (CVPR 2024) offer text-to-3DGS but with rough geometry and persistent artifact issues [12].

Scene-level generation tools (DreamScene360, FastScene, DreamScape) exist only as research code with no production deployments [12]. Products often mistaken for Gaussian splat generators -- Stability AI SV3D and Luma AI Genie -- actually output meshes, not Gaussian splats [12]. All production 3DGS workflows in 2026 remain capture-based [12].

The output format (.ply) from generative tools is fully web-compatible through the same conversion pipeline as capture-based splats [12]. The barrier is quality, not format compatibility.

## Analysis

### Cross-Cutting Themes

**The WebGPU ecosystem is immature for Gaussian splats.** While WebGPU itself is well-specified for device sharing, the library ecosystem has not caught up. All mature splat libraries target WebGL2, and the only WebGPU options are full game engines (PlayCanvas, Babylon.js) or research prototypes. This is the single largest gap for this project's architecture.

**Format convergence is happening around SOG and SPZ.** PlayCanvas's SOG format and Google's SPZ format both achieve dramatic compression over raw PLY. SOG is open-source and production-proven; SPZ is targeting glTF standardization. Both are supported by SuperSplat for authoring.

**The training pipeline is solved.** Open-source tools produce results within 1 dB of the best proprietary options, with Apache 2.0 licensing. The license trap of the original INRIA implementation is the main pitfall to avoid.

### Contradictions and Tensions

1. **Engine adoption vs. embeddability**: PlayCanvas and Babylon.js both offer WebGPU splat rendering, but both require adopting the engine's scene graph and render loop. This conflicts with the project's existing custom WebGPU renderer. The lightweight libraries that respect external renderers are all WebGL-only. No contradiction between investigators -- this is a genuine ecosystem gap confirmed by both H2 and H5.

2. **AI generation trajectory**: TRELLIS is the best current tool for generative 3DGS, but TRELLIS 2 dropped Gaussian output. This suggests the industry may be moving away from generative Gaussian splats toward generative meshes, making investment in AI-to-splat pipelines potentially short-lived.

### Confidence Assessment

| Area | Confidence | Rationale |
|------|-----------|-----------|
| PlayCanvas as best renderer | High | Multiple corroborating sources, production case studies |
| WebGPU integration gap | High | Confirmed by source code inspection and spec analysis |
| Training pipeline | High | Benchmarked tools with quantitative comparisons |
| Compositing strategies | Medium-High | Architecturally sound but untested in this specific codebase |
| AI generation immaturity | Medium | Rapidly evolving field; assessment could change within months |

## Open Questions

1. **PlayCanvas engine overhead**: What is the bundle size and runtime overhead of importing PlayCanvas solely for splat rendering in an app that already has its own WebGPU renderer? Can the GSplatComponent be tree-shaken from the rest of the engine?

2. **Unified Rendering stability**: PlayCanvas's Unified Splat Rendering is still in beta. What is the bug surface area, and is it stable enough for production?

3. **Minimal WebGPU splat renderer feasibility**: H5 estimates ~500 lines of WGSL+TS for a minimal renderer accepting an external GPUDevice. Is this estimate realistic, and what sorting algorithm would be used?

4. **SPZ format trajectory**: Will SPZ achieve glTF standardization, and should the project target SPZ over SOG for future-proofing?

5. **Three.js WebGPURenderer + Spark**: Does Spark work with Three.js's experimental WebGPU renderer? This could provide a middle path between full engine adoption and forking research code.

## Methodology

Five hypotheses were investigated across web and hybrid investigation types. H3 (compressed formats) was subsumed by H1 (PlayCanvas ecosystem covers its format story). H7 (SuperSplat editor) was similarly subsumed by H1. H8 (contrarian: splats are the wrong approach) was cut as low-plausibility given explicit interest. All five selected hypotheses produced substantive findings. Investigation covered GitHub repositories, npm packages, official documentation, academic papers, and the existing codebase's source files.

## References

[1] hypotheses/h1-playcanvas/findings.md -- PlayCanvas Engine v2.17.2 capabilities, SOG format, SuperSplat editor, performance benchmarks, standalone usage patterns
[2] hypotheses/h2-lightweight-libs/findings.md -- gsplat.js, Spark, GaussianSplats3D, Babylon.js, WebGPU research implementations, device sharing gap analysis
[5] hypotheses/h5-integration/findings.md -- WebGPU device sharing spec, depth testing constraints, four compositing strategies, codebase integration points
[8] hypotheses/h4-training-tools/findings.md -- COLMAP, gsplat, Nerfstudio, OpenSplat, INRIA license, quality benchmarks, hardware requirements, output pipeline
[12] hypotheses/h6-ai-generation/findings.md -- TRELLIS, DreamGaussian, GaussianDreamer, scene-level research tools, maturity assessment

## Verification

- **Citations checked**: 5/5 valid -- all [1], [2], [5], [8], [12] reference existing findings documents with content matching cited claims
- **Hypotheses covered**: 5/5 (H1, H2, H4, H5, H6 addressed; H3/H7 subsumed by H1 as noted in decomposition; H8 cut with rationale)
- **Unsupported claims**: none -- all factual claims trace to specific findings documents
- **Issues found**: none
- **Verification status**: PASS
