# add-world-model

> **ACTIVE BUILD**

Activated 2026-09-08 (`activate add-gpu-exec & add-world-model`).

**Rigor:** change

Bead `web3d-space-9zr.3`. Depends on `add-browser-renderer` (ADR: glTF-family
world document, HDRI, LOD distances). Weave sibling of `add-gpu-exec`.

## Why

`/splat` scenes are TypeScript closures in `src/lib/splat/scenes.ts`.
There is no document a page can load that names an HDRI, a GLB, a
camera, and LOD cutoffs. Later splat-cache and canvas nodes need that
document, not another hardcoded slug catalog.

## What

- Name capability `world-model`.
- Typed world document + loader: HDRI, imported GLB (photogrammetry
  enters here), cameras, lights, per-entity LOD distances, optional
  splat-cache refs (`KHR_gaussian_splatting` or sidecar).
- Fixture round-trip in unit tests. Missing assets fail visibly.
- Do not rasterize. Do not train NeRF/GS.

## Impact

- Capabilities: ADDED `world-model`
- ADRs: none (follows `ARCHITECTURE.md` call 5)

## User journey & surfaces

Duke, from the splat catalog (`/splat`).

1. **Working** — hardcoded scene slugs load SOG/GLB via PlayCanvas
   assets.
2. **Empty** — no file describes a world with HDRI + GLB + LOD.
3. **Failed** — missing asset must surface as a visible load error,
   not a hung spinner.
4. **Off** — this change does not add a new route. The canvas that
   *uses* the document is `add-browser-canvas`.

`No new UI because` `/splat` already is the entry; this node is the
document the canvas will load.

## Out of scope

- Kernel extract — `add-gpu-exec`
- Streaming splat LOD / SOG load — `add-splat-cache`
- Canvas journey — `add-browser-canvas`
- In-browser photogrammetry / NeRF train — parked (ASG 6000)
- PlayCanvas vs Threlte — already refused
