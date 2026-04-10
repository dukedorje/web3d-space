# Hypothesis: WebGPU provides significantly lower CPU overhead per draw call than WebGL

## Summary

**Strongly confirmed**. Multiple independent sources — controlled benchmarks, academic study, real-world profiling from Three.js contributors, and architectural analysis from browser vendors — converge: WebGPU's Pipeline State Object model, command buffer recording, and Render Bundle mechanisms move validation cost from draw time to initialization time, producing measurably lower CPU overhead per draw call at scale. The gains are not incremental; in draw-call-heavy scenes the CPU bottleneck is essentially eliminated. However, the advantage is workload-dependent: small scenes and naive WebGPU implementations can perform worse than optimized WebGL.

## Evidence

### Architectural Mechanism

WebGL: global state machine where every draw call requires the browser driver to re-validate full OpenGL ES state and translate to native GPU commands on the main thread.

WebGPU: Pipeline State Objects bundle all state into an immutable object validated once at creation time. At draw time, the command encoder records a token referencing the already-validated pipeline — no re-validation required. `GPURenderBundle` pre-records complete draw sequences for single-call replay.

### Draw Call Capacity

- **WebGL**: ~500 draw calls/frame before CPU bottleneck
- **WebGPU**: ~10,000+ draw calls/frame, remaining GPU-bound
- **~20x increase** in draw calls before CPU becomes the limiting factor

Source: kaelan.fyi citing MDN/Three.js Roadmap

### Babylon.js Render Bundle Benchmark

GPU Render Bundles: **~10x faster** rendering vs equivalent WebGL draw calls for pre-recorded static scenes.

### "Cube Storm" Benchmark (Jan 2026, M3 MacBook Pro)

| Metric | WebGL | WebGPU + TSL |
|---|---|---|
| Max stable objects | 15,000 | 200,000+ |
| FPS | 20–30 | 60 (locked) |
| CPU usage | 98% (main thread blocked) | <2% (idle) |
| Bottleneck | JavaScript execution | GPU fill rate |

Source: Gonzalo Galante (gjgalante.medium.com)

### Godot Engine Academic Study

WebGPU speedup over WebGL ranged from **6.82x** (Ponder) to **35.6x** (Evader) in frame time. WebGL also showed higher variance — less consistent frame delivery.

### SitePoint GEMM Benchmarks (Feb 2026)

| Matrix Size | Speedup |
|---|---|
| 512×512 | 1.6–1.9x |
| 1024×1024 | 3.5–3.9x |
| 2048×2048 | 5.0–6.9x |
| 4096×4096 | 5.5–8.1x |

LLM token latency (Phi-3-mini, M2): 320ms/token (WebGL) → 85ms/token (WebGPU), **3.8x improvement**.

### Counter-Evidence: Not Automatic

- 100,000 naive `passEncoder.draw()` calls still consume ~10ms in browser-side overhead before GPU work begins
- `beginRenderPass` identified as biggest single CPU user in Chromium profiling
- Uniform buffers vs individual `gl.uniform*` calls can increase bandwidth requirements

The overhead reduction requires using correct abstractions: Render Bundles, indirect draw, storage buffers.

### Three Key Mechanisms

1. **Pipeline State Objects**: Full state pre-validated at creation. Near-zero draw-time validation cost.
2. **Render Bundles**: Pre-record draw commands once. Replay with single call — replaces thousands of re-validated per-frame calls.
3. **Storage Buffers + Instancing**: Pack per-object data into single `GPUBuffer`. Draw all instances in one call via `@builtin(instance_index)`.

## Confidence

**Level**: high

## Sources

1. https://volumeshaderbm.org/blog/webgpu-vs-webgl-architecture-comparison (Sep 2025)
2. https://kaelan.fyi/research/webgpu-vs-webgl/ (Jan 2025)
3. https://discourse.threejs.org/t/the-new-webgl-vs-webgpu-performance-comparison-example/69097 (Aug 2024)
4. https://gjgalante.medium.com/webgl-vs-webgpu-the-performance-gap-fbd121fb221a (Jan 2026)
5. https://www.sitepoint.com/webgpu-vs-webgl-inference-benchmarks/ (Feb 2026)
6. https://www.scribd.com/document/810343310/A-Comparison-of-Performance-on-WebGPU-and-WebGL-in-the-Godot-Game-Engine
7. https://loke.dev/blog/webgpu-render-bundle-performance-analysis (Feb 2026)
8. https://issues.chromium.org/issues/42240211

## Open Questions

- Exact threshold where WebGPU begins showing CPU savings over optimized WebGL (50 draw calls? 200?)
- Safari Metal-backed WebGPU performance characteristics untested
- Render Bundle invalidation cost for highly dynamic scenes
