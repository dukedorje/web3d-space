# add-survey-world-model

> **ACTIVE BUILD**

Bead `mjolnir-mesh-6hn.7`. Human activated 2026-09-10.
Depends on `add-coverage-world-viz`. Device split is
`add-coverage-survey`: AI Camera captures; Compass does not grow lidar.

## Why

As the surveyor moves, cameras and LiDAR should grow a world around
the path, with mesh coverage overlaid. web3d-space already has a typed
world document (`add-world-model`). `/mesh` does not load it.

## What

- Load the existing `world-model` document onto `/mesh` (HDRI, GLB,
  optional splat-cache refs, LOD).
- Capture path is AI Camera (cameras + Ethernet 3D lidar), not the
  LilyGo compass.
- Do not train NeRF in the browser. Photogrammetry enters as GLB.

## Impact

- Capabilities: MODIFIED `world-model` (consumed on `/mesh`);
  MODIFIED `mesh-coverage-viz` (overlay)
- ADRs: none (follows browser-renderer call 5)

## User journey & surfaces

Duke on `/mesh` after a capture (or a fixture GLB).

1. **Working** — `/splat` already loads SOG/GLB via PlayCanvas;
   `add-world-model` has a typed document + fixture round-trip.
2. **Empty** — `/mesh` has no world document, only radio geometry.
3. **Failed** — missing capture / missing asset is a visible load
   error, not a hung spinner.
4. **Off** — coverage paint still works without a world document.

## Out of scope

- In-browser NeRF / GS train
- Compass lidar
- Nanite
- Replacing PlayCanvas
