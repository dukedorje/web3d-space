# Hypothesis: WebGPU's explicit resource management and validation model makes it harder to learn but produces more predictable performance than WebGL's implicit state machine

## Summary

This hypothesis is **confirmed with nuance**. WebGPU's explicit pipeline objects, bind groups, and command buffers do impose a steeper initial learning curve compared to WebGL's procedural, globally-mutable state machine. However, this explicitness directly yields more predictable GPU performance by eliminating driver-side state reconciliation, enabling upfront validation, and supporting multi-threaded command recording.

## Evidence

### API Design: State Machine vs. Explicit Resources

WebGL inherits OpenGL's design: a single global context with mutable bound state. Drawing requires setting dozens of implicit "current" bindings before issuing a draw call. The driver must reconcile this state at draw time, which creates opportunities for driver divergence and performance unpredictability across vendors.

A minimal WebGL draw setup requires imperative state mutation:

```javascript
// WebGL — implicit global state
gl.useProgram(program);
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(posLoc);
gl.bindTexture(gl.TEXTURE_2D, texture);
gl.uniform1i(samplerLoc, 0);
gl.drawArrays(gl.TRIANGLES, 0, 3);
```

Any of these bindings can be accidentally left over from a prior draw call, silently corrupting subsequent draws. WebGL has no built-in mechanism to detect stale state.

WebGPU requires all state to be baked into immutable objects before recording:

```javascript
// WebGPU — explicit, validated at creation time
const pipeline = device.createRenderPipeline({
  vertex: { module: shaderModule, entryPoint: 'vs_main', buffers: [vertexLayout] },
  fragment: { module: shaderModule, entryPoint: 'fs_main', targets: [{ format }] },
  primitive: { topology: 'triangle-list' },
  depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
});

const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [{ binding: 0, resource: texture.createView() }],
});

const encoder = device.createCommandEncoder();
const pass = encoder.beginRenderPass(renderPassDescriptor);
pass.setPipeline(pipeline);
pass.setBindGroup(0, bindGroup);
pass.setVertexBuffer(0, vertexBuffer);
pass.draw(3);
pass.end();
device.queue.submit([encoder.finish()]);
```

The pipeline and bind group encode ALL state. The command buffer is a pure sequence of validated, immutable instructions.

### Validation and Error Handling

WebGL errors are deferred: `gl.getError()` must be polled explicitly. Errors give minimal context (e.g., `INVALID_OPERATION` with no stack trace).

WebGPU validates resources at creation time with descriptive errors:

```javascript
device.pushErrorScope('validation');
const pipeline = device.createRenderPipeline({ /* ... */ });
const error = await device.popErrorScope();
if (error) console.error(error.message); // precise field-level message
```

### WGSL vs. GLSL

WGSL is statically typed with explicit binding decorators validated against the pipeline's bind group layout at creation time:

```wgsl
@group(0) @binding(0) var<uniform> transform: mat4x4<f32>;
@group(0) @binding(1) var albedo: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;

@vertex fn vs_main(@location(0) pos: vec3<f32>) -> @builtin(position) vec4<f32> {
  return transform * vec4<f32>(pos, 1.0);
}
```

GLSL has decades of tutorials and resources. WGSL is new and has a thinner tutorial corpus.

### Performance Predictability

WebGL's implicit state machine requires the driver to diff current vs. desired GPU state at draw time — different vendors implement this differently, producing opaque frame time variance.

WebGPU eliminates driver-side state reconciliation. Pipeline objects map 1:1 to compiled GPU programs. Switching pipelines is an explicit, measurable cost. The W3C design rationale explicitly cites "reducing implicit GPU state" as a goal.

### Multi-Threaded Command Recording

WebGL contexts cannot be shared across threads — all draw call recording happens on the main thread.

WebGPU supports command recording from Workers: multiple Workers can record `GPUCommandBuffer` objects in parallel and submit them to a shared queue. For scenes with thousands of objects, this is a structural performance advantage.

## Confidence

**Level**: high

## Sources

1. https://gpuweb.github.io/gpuweb/ — W3C WebGPU specification
2. https://webgpufundamentals.org/ — WebGPU Fundamentals
3. https://webglfundamentals.org/ — WebGL Fundamentals
4. https://gpuweb.github.io/gpuweb/explainer/ — WebGPU Explainer (design rationale)
5. https://developer.chrome.com/docs/web-platform/webgpu — Chrome WebGPU docs

## Sub-Hypotheses

- **Framework abstraction**: Three.js/Babylon.js WebGPU backends may abstract away the explicit resource model, nullifying the learning curve differential for framework users.
- **Pipeline compilation jank**: Pipeline compilation cost in WebGPU may introduce shader compilation stutters that WebGL's lazy model avoids, partially offsetting the performance predictability advantage.
