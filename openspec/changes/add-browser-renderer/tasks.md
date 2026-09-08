# Tasks

- [x] Write `ARCHITECTURE.md` with the six renderer calls (home,
      PlayCanvas raster host, NeRF field / 3DGS cache, no hardware RT,
      glTF-family world document, `$lib/gpu` sidecar)
- [x] Point `docs/all-systems-go/SCENE.md` Viewer section at
      `ARCHITECTURE.md` so the film viewer and the world renderer do
      not drift
- [x] Ignore `.spawns/` in `.gitignore` (advise / spawn scratch)

Handoffs (not boxes):

- `add-gpu-exec` — reusable kernel from `$lib/gpu`
- `add-world-model` — document + GLB + HDRI + LOD radii
- `add-splat-cache` — SOG/SPZ load, distance LOD, depth composite
- `add-browser-canvas` — the page journey
