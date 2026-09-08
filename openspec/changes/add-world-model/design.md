# Design — world-model

The ADR pins glTF-family, not USD, not a custom scene graph.

## Document

A JSON (or glTF extras) world lists:

- HDRI environment URL
- entities: GLB mesh and/or splat sidecar / `KHR_gaussian_splatting`
- cameras, lights
- per-entity LOD distance

Photogrammetry is a GLB on an entity, not a trainer.

## Loader

Load by URL. Missing HDRI or GLB fails with a typed error the page
can show. Round-trip: fixture JSON → parse → serialize → equal.

PlayCanvas instantiation stays in splat-cache / canvas. This node
stops at the typed document.
