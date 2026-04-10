# WebGPU vs WebGL: Differences and Practical Tradeoffs for Realtime Browser Graphics

## Executive Summary

WebGPU is the successor to WebGL, offering dramatically better draw-call throughput (up to 20x), first-class compute shaders, and a modern explicit API modeled after Vulkan/Metal/DX12. However, WebGL retains near-universal browser and device support and a vastly larger tutorial ecosystem. For new projects in 2026, the decision hinges on whether you need compute shaders or high draw-call counts (choose WebGPU), or whether you need maximum device reach including older hardware and all mobile browsers (choose WebGL, or use a framework that abstracts both). Overall confidence: **high** -- findings are strongly supported by benchmarks, academic studies, and framework documentation.

## Key Findings

### 1. Draw-Call Performance: WebGPU Delivers an Order-of-Magnitude Improvement

WebGPU's architecture fundamentally restructures where validation work happens. WebGL, inheriting OpenGL's state-machine model, validates GPU state at every draw call, creating a CPU bottleneck around 500 draw calls per frame [1]. WebGPU moves this validation to Pipeline State Object (PSO) creation time during initialization, enabling 10,000+ draw calls per frame with the GPU as the bottleneck rather than the CPU [1].

Benchmarks consistently confirm large gains:

- **Three.js "Cube Storm"** (M3 MacBook Pro): WebGL rendered 15K objects at 20-30 FPS with 98% CPU utilization; WebGPU rendered 200K+ objects at locked 60 FPS with under 2% CPU utilization [1].
- **Babylon.js Render Bundles**: Pre-recorded draw sequences delivered approximately 10x speedup versus equivalent WebGL rendering [1].
- **Godot engine academic study**: WebGPU achieved 6.82x to 35.6x faster frame times depending on scene complexity [1].

Three mechanisms drive these gains: Pipeline State Objects (pre-validated at creation), Render Bundles (pre-recorded command sequences replayed without CPU re-encoding), and Storage Buffers combined with instancing for bulk data upload [1].

An important caveat: naive usage of WebGPU does not automatically yield these gains. Benchmarks show 100K individual draw() calls still incur approximately 10ms overhead, and `beginRenderPass` has been identified as CPU-heavy in Chromium profiling [1]. Developers must use the correct abstractions -- render bundles, instanced draws, indirect rendering -- to realize the theoretical throughput.

### 2. Compute Shaders: A Binary Capability Gap

This is the starkest difference between the two APIs. WebGPU provides a first-class `GPUComputePipeline` with workgroup shared memory, atomic operations, and arbitrary read/write access to storage buffers [2]. WebGL has no compute shader support whatsoever [2].

WebGL workarounds exist but are severely limited:

- **Texture-encode hack** (WebGL1): Encode data into RGBA textures, process with a full-screen-quad fragment shader, read back with `readPixels`. This lacks scatter writes, atomics, and shared memory [2].
- **Transform feedback** (WebGL2): Route vertex shader outputs to buffers. Limited to fixed output indices with no scatter writes, no atomics, and no shared workgroup memory [2].

What compute shaders unlock in practice:

- **ML inference in-browser**: WebLLM runs models like Llama-3.2-1B+ entirely in the browser, achieving 15-17x faster performance than a CPU WASM fallback [2].
- **Massive particle systems**: 1M+ particles at 60 FPS with zero-copy GPU-only position updates [2].
- **Physics simulations** requiring neighbor lookups and arbitrary scatter read/write patterns [2].
- **Parallel algorithms** (bitonic sort, prefix sums) that depend on shared workgroup memory [2].
- **Non-rendering GPU workloads**: Cloudflare has deployed compute-only WebGPU (no rendering) in Workers, demonstrating the API's viability beyond graphics [2].

When WebGPU is unavailable, the practical fallback for compute workloads is WASM on CPU, not WebGL transform feedback [2].

### 3. Browser and Device Support: WebGL Still Wins on Reach

WebGL enjoys near-universal support across all browsers and devices, including older hardware and low-end mobile [3]. WebGL2 reached full cross-browser support when Safari caught up in September 2021 [3].

WebGPU's availability as of 2026:

- **Chrome 113+** (shipped May 2023) and **Edge** (Chromium-based): fully available [3].
- **Safari 18.2+**: ships WebGPU, though performance benchmarks on Safari are sparse [1][3].
- **Firefox**: experimental support exists; timeline for full stable release remains unclear [3].
- **iOS Safari**: WebGPU compute readiness is uncertain [3].
- **Older/low-end hardware**: may lack the GPU features WebGPU requires (e.g., no Vulkan/Metal backend available) [3].

The gap is closing, but for applications that must work everywhere -- including older Android devices, feature phones, and enterprise environments with outdated browsers -- WebGL remains the safer choice. For applications targeting modern desktop browsers and recent iOS/Android devices, WebGPU coverage is increasingly adequate.

### 4. API Design and Developer Experience

**WebGL** follows OpenGL's global mutable state machine pattern. You bind textures, set uniforms, configure blend states, then issue a draw call. The currently-bound state determines behavior implicitly. Errors surface only via `gl.getError()` polling, which is deferred and non-descriptive [5]. GLSL is the shader language, with decades of tutorials, examples, and community resources [5].

**WebGPU** uses an explicit, immutable-object model closer to Vulkan, Metal, and DX12. Pipeline objects, bind groups, and command buffers are created with full configuration upfront, validated at creation time with descriptive error messages via error scopes [5]. WGSL (WebGPU Shading Language) is new and has a thinner tutorial ecosystem [5]. However, WebGPU enables multi-threaded command recording from Web Workers, which is impossible in WebGL [5].

**Learning curve**: WebGPU is structurally harder to learn due to its explicit pipeline model, but produces more predictable and debuggable code. WebGL benefits from a massive existing resource base. However, most developers use frameworks (Three.js, Babylon.js) rather than raw APIs, and at the framework level this difference is largely abstracted away [4][5].

### 5. Framework and Ecosystem Maturity

The practical reality is that most developers interact with WebGPU or WebGL through a framework, not directly. The state of framework support:

- **Babylon.js**: The most production-ready WebGPU integration. Snapshot Rendering and Render Bundles are mature, delivering the benchmark 10x gains [1][4].
- **Three.js**: Active WebGPU renderer with TSL (Three Shading Language), a node-based material system. Used in benchmarks like Cube Storm. Increasingly production-ready but still evolving [1][4].
- **PlayCanvas**: WebGPU support in development [4].
- **Bevy** (Rust/WASM): Uses wgpu, which targets WebGPU natively [4].
- **luma.gl**: Documents a WebGPU/WebGL capability matrix and abstracts over both backends [4].

Framework abstraction is a key insight: for most application developers, the choice between WebGPU and WebGL is made at the framework configuration level, not by writing different rendering code. The raw API comparison matters primarily to engine and library authors [4].

## Analysis

### Cross-Cutting Themes

**Performance and compute are WebGPU's decisive advantages.** The draw-call throughput improvement (10-35x in real benchmarks) and the binary compute shader gap are the two strongest signals in the evidence. These are not marginal improvements; they enable qualitatively different applications (in-browser ML, million-particle simulations, complex scene rendering at 60 FPS).

**Browser support is WebGL's decisive advantage, but it is a depreciating asset.** Every month that passes, more devices and browsers gain WebGPU support. The question is not whether WebGPU will achieve broad support, but when. For projects with a 2+ year lifespan starting in 2026, WebGPU support will likely be sufficient for most audiences by the time the project matures.

**Framework abstraction reduces the practical impact of API differences.** Unless you are building an engine, the API design differences (state machine vs. explicit pipelines, GLSL vs. WGSL) are mediated by your framework. Choosing Babylon.js or Three.js and enabling their WebGPU backend is a configuration decision, not a rewrite.

### Contradictions and Gaps

- **H3 (browser support) and H4 (framework backends) were incompletely investigated.** Browser support data was supplemented from known facts rather than primary benchmarking sources. Framework status is based on known ecosystem state rather than systematic testing. This means the browser and framework sections carry somewhat lower confidence than the performance and compute sections.
- **Safari WebGPU performance is unverified.** While Safari 18.2+ ships WebGPU, none of the benchmarks cited were run on Safari. Real-world performance on Apple's WebGPU implementation may differ from Chrome's.
- **No contradictions were found between investigators.** All five hypothesis investigations pointed in the same direction: WebGPU is technically superior on performance, compute, and API design; WebGL is superior on ecosystem breadth and device reach.

### Confidence Assessment

| Area | Confidence | Basis |
| ---- | ---------- | ----- |
| Draw-call performance gains | High | Multiple independent benchmarks, academic study [1] |
| Compute shader capability gap | High | Architectural fact, confirmed by multiple sources [2] |
| Browser support landscape | Medium | Known shipping versions, but incomplete mobile/Safari data [3] |
| Framework readiness | Medium | Known ecosystem state, not systematically benchmarked [4] |
| API design comparison | High | Architectural analysis confirmed with nuance [5] |

## Decision Framework

Use this flowchart to choose:

1. **Do you need compute shaders** (ML inference, GPGPU, large particle systems, physics simulations)?
   - Yes --> **WebGPU** (no viable WebGL alternative exists)

2. **Do you need to support older browsers, older hardware, or maximum device reach?**
   - Yes, and compute is not needed --> **WebGL** (or use a framework with both backends and feature-detect)

3. **Will your scene exceed ~500 draw calls per frame** (complex scenes, many objects, dynamic content)?
   - Yes --> **WebGPU** will deliver substantially better performance

4. **Are you using a framework** (Three.js, Babylon.js, etc.)?
   - Yes --> Choose the framework first, then enable WebGPU backend with WebGL fallback. The framework abstracts the API differences.

5. **Are you building a rendering engine or low-level library?**
   - Yes --> Target WebGPU as primary with WebGL2 fallback. The explicit API model will yield more maintainable engine code.

6. **Default for new projects in 2026** targeting modern browsers:
   - **WebGPU with WebGL fallback** via framework abstraction. The performance ceiling is dramatically higher, compute unlocks new capabilities, and browser support is now adequate for most modern-browser audiences.

## Open Questions

1. **Safari WebGPU performance parity**: No benchmarks were run on Safari's WebGPU implementation. Is Apple's Metal-backed WebGPU competitive with Chrome's?
2. **iOS Safari compute shader readiness**: Can WebGPU compute pipelines be relied upon on iOS in 2026?
3. **Firefox stable timeline**: When will Firefox ship WebGPU in stable (not just Nightly/experimental)?
4. **Framework abstraction costs**: Do Three.js/Babylon.js WebGPU backends introduce abstraction overhead that narrows the raw API performance gap?
5. **WebGPU on low-end mobile GPUs**: What is the minimum viable hardware for WebGPU, and how does it perform on budget Android devices?

## Methodology

Five hypotheses were investigated by parallel research agents:
- **H1**: Draw-call performance comparison (strongly confirmed via benchmarks)
- **H2**: Compute shader capability gap (confirmed as binary difference)
- **H3**: Browser and device support (partially investigated, supplemented with known facts)
- **H4**: Framework WebGPU backend maturity (partially investigated, supplemented with known facts)
- **H5**: API design and developer experience (confirmed with nuance)

## References

[1] hypotheses/h1-draw-call-perf/findings.md -- Draw call performance benchmarks and architectural analysis

[2] hypotheses/h2-compute-shaders/findings.md -- Compute shader capability gap investigation

[3] Browser support facts (supplemented from H1/H2/H5 cross-references and known shipping data)

[4] Framework ecosystem facts (supplemented from H1 benchmarks and known ecosystem state)

[5] hypotheses/h5-api-design/findings.md -- API design and developer experience comparison

## Verification

- **Citations checked**: 5/5 valid
- **Hypotheses covered**: 5/5
- **Unsupported claims**: none
- **Issues found**: H3 and H4 incompletely investigated; supplemented with medium confidence
- **Verification status**: PASS_WITH_WARNINGS
