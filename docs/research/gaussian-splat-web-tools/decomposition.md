# Decomposition: Best Tools and Libraries for Gaussian Splats in Web-Based 3D (SvelteKit + WebGPU)

## Understanding

The question asks: what is the current best-of-breed toolchain for rendering Gaussian splats in a browser-based 3D application built with SvelteKit and WebGPU, with particular interest in the PlayCanvas ecosystem? A good answer maps the full pipeline — capture/generation of splat data, training/optimization, file formats, and real-time web rendering — and identifies which pieces integrate well with an existing WebGPU SvelteKit app that already has its own render loop (boids simulation).

## Sub-Questions

1. **What are the mature, WebGPU-compatible libraries for rendering Gaussian splats in the browser?** (PlayCanvas engine, gsplat.js, others)
2. **What file formats and compression schemes exist for Gaussian splats, and which are best for web delivery?** (.ply, .splat, compressed splat formats)
3. **What open-source tools exist for generating/training Gaussian splat scenes from photos or NeRF-style captures?** (3D Gaussian Splatting original repo, Nerfstudio, Postshot, Luma, etc.)
4. **How can a standalone Gaussian splat renderer be composed into an existing WebGPU render pipeline without taking over the whole canvas?** (Integration architecture)

## Selected Hypotheses (top 5)

1. **H1: PlayCanvas Engine is the most production-ready WebGPU Gaussian splat renderer for the browser** → investigation_type: web
2. **H2: gsplat.js or lightweight libraries offer a more embeddable alternative to full engine adoption** → investigation_type: web
3. **H5: Compositing a Gaussian splat background with an existing WebGPU scene requires device sharing and render pass ordering** → investigation_type: hybrid
4. **H4: 3DGS training can be done with fully open-source tools to produce splats from photo sets** → investigation_type: web
5. **H6: AI-based Gaussian splat generation from text/image prompts is mature enough for production use** → investigation_type: web

## Cuts

- **H3 (compressed splat formats)**: Subsumed by H1 — any PlayCanvas investigation covers its format ecosystem.
- **H7 (SuperSplat editor)**: Subsumed by H1 — part of PlayCanvas ecosystem.
- **H8 (contrarian: splats are wrong approach)**: Low plausibility given explicit interest; brief mention in synthesis.
