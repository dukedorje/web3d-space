# H1: PlayCanvas Engine — Most Production-Ready WebGPU Gaussian Splat Renderer

## Summary
**Strongly supported.** PlayCanvas Engine (v2.17.2, MIT license) offers the most complete, actively maintained WebGPU Gaussian splat rendering stack for browsers. Full ecosystem: SplatTransform CLI → SuperSplat Editor → GSplatComponent runtime rendering with LOD Streaming. Usable as a standalone npm library without the PlayCanvas Editor.

## Key Findings

### Engine Capabilities
- Dual graphics backend: WebGL2 fallback + WebGPU primary with compute shaders
- npm: `playcanvas` v2.17.2, MIT license, TypeScript, tree-shakable ESM, ~15K GitHub stars
- GSplatComponent: primary rendering primitive, loads from Assets
- GSplatProcessor: GPU-based splat data processing with custom shaders
- Unified Splat Rendering (beta): global depth sort across all GSplat components, LOD streaming, procedural creation

### File Formats
| Format | Use | Size | Quality |
|--------|-----|------|---------|
| PLY | Source/editing/training | Large (GBs) | Lossless |
| SOG | Runtime/web delivery | 15-20x smaller | Lossy, visually optimized |

SOG introduced in engine v2.11.0 (Sept 2025), open-sourced. Morton order = GPU-ready, no CPU processing on load. Convert: `splat-transform input.ply output.sog`

### SuperSplat Editor
- URL: superspl.at/editor — MIT licensed, open source
- v2.24.4 (March 2026), actively maintained
- Web-based: inspect, trim, optimize, compress, publish splat data
- Built with PlayCanvas engine standalone + Vite

### Standalone Usage (No Editor)
- Officially documented and supported
- SuperSplat itself is proof of concept (engine-standalone + Vite)
- Compatible with SvelteKit via `onMount` + dynamic import pattern

### Performance
- Reflct migration from Three.js: "frame rate nearly doubles, memory usage reduced by 80%"
- SOG vs previous best format: 88-95% memory reduction
- 4M splat budget recommended for high-end desktop
- Fill rate is primary bottleneck (alpha-blended quad overdraw)
- Recommended: disable AA, disable device pixel ratio scaling, use LOD Streaming

### API Example
```javascript
import { Application, Asset, Entity } from 'playcanvas';
const app = new Application(canvas);
app.start();
const asset = new Asset('scene', 'gsplat', { url: 'scene.sog' });
// ... load and create entity with gsplat component
```

## Open Questions
1. No head-to-head benchmark vs current Three.js GaussianSplats3D or Babylon.js
2. Unified Rendering still beta — unknown bug class
3. SvelteKit SSR compatibility needs `onMount` guard (no official guide)
4. `.splat`/`.ksplat` format support status unclear in current version

## Sources
- [1] PlayCanvas GS docs, [2] Engine standalone API example, [3-4] GSplatComponent/Processor API refs, [5] Unified Rendering docs, [6] Performance guide, [7] Format docs, [8] SOG blog post, [9] Reflct developer spotlight, [10] SuperSplat GitHub, [11] npm package, [12] Standalone engine docs
