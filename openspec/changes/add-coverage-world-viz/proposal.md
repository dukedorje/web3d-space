# add-coverage-world-viz

> **ACTIVE BUILD**

Bead `mjolnir-mesh-6hn.4`. Human activated 2026-09-10.
Depends on lightning-mesh `add-coverage-survey`.

## Why

`/mesh` already draws a simulated Lightning radio world (PlayCanvas,
four-router fixture, radio.json-shaped links). Coverage — covered /
thin / unknown — is not visible. The survey game needs that paint
before live GPS exists.

## What

- Capability `mesh-coverage-viz`.
- `/mesh` shows coverage state a walker can read, distinct from
  link-strength bars.
- Fixture positions are enough; live directory/ball join is later.
- Follow browser-renderer: PlayCanvas raster host. Not myscape. Not
  hello.mesh TopologyPanel.

## Impact

- Capabilities: ADDED `mesh-coverage-viz`
- ADRs: none (follows web3d-space `ARCHITECTURE.md` + lightning-mesh
  coverage survey)

## User journey & surfaces

Duke, from `http://127.0.0.1:5174/mesh`.

1. **Working** — orbit camera, four named routers, animated links.
2. **Empty** — no covered/thin/unknown paint; positions are hardcoded
   metres in `simulate.ts`.
3. **Failed** — missing PlayCanvas adapter is a visible error (already).
4. **Off** — `/splat` and `/boids` unchanged.

## Out of scope

- Live GPS / directory join — `add-node-coordinates` + later feed
- DreamBall data-input wiring — `add-dreamball-coverage` then a join
- Cameras/LiDAR world overlay — `add-survey-world-model`
- Threlte / Three.js rebase (refused by browser-renderer)
