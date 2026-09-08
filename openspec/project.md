# Project context

web3d-space — spatial viewer and browser world renderer. Product ground
for All Systems Go lives in `docs/all-systems-go/`. This OpenSpec tree
is for the **browser renderer** and later viewer behavior.

This file is conventions. It is not a requirements store. Requirements
live in `openspec/specs/` (what is built) and `openspec/changes/` (what
should change). Reasoning that is not a requirement lives in `docs/`
and `ARCHITECTURE.md`.

## Where work lands

| Kind of work | Lands in |
|---|---|
| New or changed behavior | `openspec/changes/<verb-led-id>/` |
| Restore intended behavior, typo, pin, comment, test for existing spec | Direct fix. No change. |
| Why the renderer is shaped this way | `ARCHITECTURE.md` (amend, do not delete) |
| Hard-won fact | `docs/LEARNINGS.md` |
| Work-graph state | beads (`bd`) |

A change is the right landing zone when you can write a `#### Scenario:`
that fails today and passes after.

## Heritage (not living specs)

- Hybrid mesh + Gaussian splat viewer: `src/lib/playcanvas/`, `src/lib/splat/`, `/splat`
- WebGPU compute lab (boids): `src/lib/gpu/`, `/boids`
- Capture / dual-branch research: `docs/research/`
- Filmmaking product: `docs/all-systems-go/`, epic `web3d-space-5ht`
