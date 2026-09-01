# All Systems Go

Local-first AI camera, assistant director, and multi-modal spatial filmmaking suite.

Three boxes: **Jetson Thor** (camera / live AD), **RTX PRO 6000** (quality / generate / reconstruct), **on-site NAS** (vault). This repository is the product ground and the **spatial viewer** (PlayCanvas hybrid mesh + Gaussian splat).

**Read:** [docs/all-systems-go/README.md](docs/all-systems-go/README.md)

## Viewer (this tree)

```sh
npm install
npm run dev
```

- `/` — lab index
- `/splat` — Gaussian splat + mesh scenes
- `/boids` — WebGPU compute heritage
- `/how-it-works` — explainer

```sh
npm test          # unit + e2e
npm run splat:convert
```

Older capture/splat research: `docs/research/`.
