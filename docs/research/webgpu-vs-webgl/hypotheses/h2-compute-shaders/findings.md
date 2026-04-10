# Hypothesis: WebGPU compute shaders unlock GPU-compute workloads impossible in WebGL

## Summary

The hypothesis is **confirmed**. WebGPU introduces compute shaders as a first-class pipeline type (`GPUComputePipeline`) that has no equivalent in WebGL. WebGL2's closest analog — transform feedback — is structurally limited: it is confined to outputs from the vertex stage, can only write to linear buffers, and cannot support the general scatter/gather memory access patterns that most real GPGPU workloads require. The gap is binary for some workloads (ML inference, arbitrary parallel compute on structured data) and a severe practical limitation for others (large particle systems, physics sims).

## Evidence

### 1. The binary capability gap

| Type | WebGPU | WebGL | Comment |
|------|--------|-------|---------|
| Compute Shader | Yes | No | |
| Buffer Transform | No | Yes | Depends on TransformFeedback |
| Texture Transform | Yes | Partial | |

Source: luma.gl docs

Chrome developer guide: "Programs running on the GPU that only perform computations (and don't draw triangles) are called compute shaders. They are executed in parallel by hundreds of GPU cores that operate together to crunch data. Their input and output are buffers in WebGPU."

### 2. WebGL's GPGPU workarounds and their limits

**WebGL1 texture-encode hack**: data packed into RGBA float textures, fragment shader runs a full-screen quad, results read via `readPixels`. Lacks arbitrary memory writes, atomics, shared workgroup memory, and scatter operations.

**WebGL2 transform feedback**: vertex shader `out` varyings routed to buffers. Structurally constrained:
- Output indices fixed by vertex ID — no scatter writes
- No shared workgroup memory
- No atomic operations on buffers
- No 2D/3D indexing of output arrays
- Fragment shader must be disabled (`RASTERIZER_DISCARD`); entire graphics pipeline fires anyway

### 3. What compute shaders unlock

**ML inference — WebLLM**: Runs LLMs (Llama-3.2-1B+) entirely in-browser using WebGPU compute shaders. Browser GPU inference ~5x slower than native GPU, but ~15-17x faster than CPU execution. This workload requires random-access storage writes and multi-dimensional workgroup dispatch — not achievable via transform feedback.

**1M+ particle systems**: 1M interactive particles at 60 FPS via WebGPU compute shaders. Zero-copy architecture with positions updated entirely on-GPU without CPU readback each frame.

**Physics simulations**: Compute shaders can read arbitrary particle data, perform neighbor-lookups, and write results back to the same storage buffer — impossible under transform feedback's fixed-index output model.

**Parallel algorithms (bitonic sort, prefix sums, reductions)**: Require shared workgroup memory and inter-element communication. WebGL has no equivalent.

**Cloudflare Workers GPU**: Implemented compute-only WebGPU pipeline (no rendering at all) for server-side GPGPU tasks. Confirms compute is independent of the graphics path.

### 4. WebGPU compute pipeline API

```js
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  // direct storage buffer read/write via bind groups
}

const pipeline = device.createComputePipeline({
  compute: { module, entryPoint: "main" }
});

const passEncoder = commandEncoder.beginComputePass();
passEncoder.setPipeline(pipeline);
passEncoder.dispatchWorkgroups(width, height);
passEncoder.end();
```

### 5. WASM as the practical fallback

When WebGPU is unavailable, WASM-on-CPU is the fallback (not transform feedback). The ~15-17x performance gap makes this viable only for small models or non-realtime use cases.

## Confidence

**Level**: high

Multiple independent sources confirm the binary nature of the gap: W3C spec, Chrome developer docs (Aug 2025), luma.gl framework docs, Cloudflare engineering blog (Oct 2025), and production deployments (WebLLM, particle simulations).

## Sources

1. https://luma.gl/docs/api-guide/engine/transforms — Capability matrix
2. https://developer.chrome.com/docs/capabilities/web-apis/gpu-compute — Chrome compute guide
3. https://surma.dev/things/webgpu/ — WebGL GPGPU limitations
4. https://blog.cloudflare.com/webgpu-in-workers/ — Compute-only WebGPU in production
5. https://webllm.mlc.ai/ — In-browser LLM inference via WebGPU
6. https://developer.chrome.com/blog/io24-webassembly-webgpu-2 — shader-f16 benchmarks
7. https://aicompetence.org/ai-in-browser-with-webgpu/ — GPU vs CPU inference benchmarks
8. https://markaicode.com/webgpu-physics-simulation-1m-particles/ — 1M particles at 60 FPS
9. https://ics.media/en/entry/230426/ — Bitonic sort and compute shader intro
10. https://www.volumeshader.dev/blog/webgl-vs-webgpu — 2026 comparison

## Open Questions

- Transform feedback practical ceiling (no quantified benchmark at specific particle counts)
- iOS Safari WebGPU compute readiness as of 2026
- Whether WASM SIMD closes the gap enough for smaller workloads
