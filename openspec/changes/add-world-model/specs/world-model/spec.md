## ADDED Requirements

### Requirement: World document

A world SHALL be a glTF-family document that can name an HDRI
environment, at least one imported GLB, a camera, and per-entity LOD
distances. Optional splat caches MAY be `KHR_gaussian_splatting` or
sidecar URLs. Photogrammetry SHALL enter as GLB, not as an in-browser
trainer.

#### Scenario: Fixture names sky and a mesh

- GIVEN a valid world document
- WHEN it is parsed
- THEN it names an HDRI, at least one GLB, a camera, and LOD cutoffs

### Requirement: Missing assets fail visibly

Loading a world whose HDRI or GLB URL cannot be fetched SHALL fail
with an error a page can display. It SHALL NOT hang on a spinner.

#### Scenario: Broken GLB URL

- GIVEN a document that points at a missing GLB
- WHEN the loader runs
- THEN it rejects with a typed missing-asset error

### Requirement: Round-trip

A fixture world document SHALL serialize to an equivalent document
after parse.

#### Scenario: Unit test round-trip

- GIVEN the fixture document
- WHEN it is parsed and serialized
- THEN the reparsed document matches the original names for HDRI,
  GLB, camera, and LOD cutoffs

### Requirement: Not the rasterizer

The world-model module SHALL NOT create a PlayCanvas app or a
WebGPU device. Rasterization stays with PlayCanvas (`/splat`) and
the compute sidecar (`gpu-exec`).

#### Scenario: Loader does not boot GPU

- GIVEN the world-model unit tests
- WHEN they run
- THEN they do not call `initGPU` or `createPlayCanvasApp`
