# Decomposition: WebGPU vs WebGL for Realtime Web Browser Graphics

## Understanding

The question asks for a comprehensive comparison of WebGPU and WebGL across multiple dimensions — performance characteristics, API design philosophy, compute shader capabilities, browser support status, ecosystem maturity, and decision criteria for choosing between them. A good answer provides concrete, current (2026) facts and actionable guidance for a developer deciding which API to adopt for a new realtime graphics project in the browser.

## Sub-Questions

1. **How do WebGPU and WebGL differ in raw rendering performance and GPU utilization efficiency?**
2. **How do the API designs differ, and what does that mean for developer experience and code architecture?**
3. **What capabilities does WebGPU provide that WebGL cannot (compute shaders, modern GPU features)?**
4. **What is the current (2026) browser support landscape and ecosystem maturity for each?**
5. **Under what project constraints should a developer choose one over the other?**

## Selected Hypotheses (top 5)

1. **H1: WebGPU provides significantly lower CPU overhead per draw call than WebGL due to its pipeline state object model** — investigation_type: web
2. **H2: WebGPU compute shaders unlock GPU-compute workloads impossible in WebGL** — investigation_type: web
3. **H3: WebGL still has materially broader browser/device support than WebGPU in 2026** — investigation_type: web
4. **H4: Major 3D frameworks have mature, production-ready WebGPU backends** — investigation_type: web
5. **H5: WebGPU's explicit model is harder to learn but yields more predictable performance** — investigation_type: analysis

## Cuts

- **H6 (WGSL as adoption barrier)** — overlaps with H5, lower plausibility due to transpiler tooling
- **H7 (performance parity at low complexity)** — answered by H1's quantification of the perf gap
- **H8 (multi-threaded command recording)** — narrow applicability, overlaps with H1
