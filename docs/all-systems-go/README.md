# All Systems Go

Local-first AI camera, assistant director, and spatial filmmaking suite.

This folder is the product ground. The SvelteKit app in `src/` is the **spatial viewer** (PlayCanvas hybrid mesh + Gaussian splat). Capture, AD, and generation live on the truck: a Jetson Thor camera body, an RTX PRO 6000 coprocessor (optional dual), and an on-site NAS.

| Doc | What it is |
|---|---|
| [VISION.md](VISION.md) | What this is, what it is not, exit test |
| [PIPELINE.md](PIPELINE.md) | Stages from power-on to archive |
| [MODES.md](MODES.md) | Camera-body jobs (live) |
| [MODELS.md](MODELS.md) | Models per job, latency, VRAM, box |
| [HARDWARE.md](HARDWARE.md) | Thor / 6000 / NAS, mode switching |
| [SCENE.md](SCENE.md) | Virtual scene, matchmove, overlay, performance |
| [BRAINSTORM.md](BRAINSTORM.md) | Consult residue and open questions |

Older capture/splat research still applies:

- [capture-to-immersive-pipeline](../research/capture-to-immersive-pipeline/synthesis.md)
- [gaussian-splat-web-tools](../research/gaussian-splat-web-tools/synthesis.md)

**Default stacks (v1):**

- **Thor day (~20–35 GB resident):** encode + cuVSLAM + SAM2 + Depth Anything V2-S + Qwen3.5-9B. Swap in FLUX.2 klein 4B (snap) or mesh AR. 27B only on sticks at 130 W.
- **6000 night:** gsplat + Meshroom; FLUX.2 [dev] FP8; Wan 2.2 / Hunyuan 1.5; Cosmos-Transfer2.5 if it fits. MiniMax H3 behind a license gate (US open-weights excluded).
- **Viewer:** this repo’s PlayCanvas mesh+splat depth composite.

Not in v1: live photoreal splat AR at 4K, H3 on the camera, generative per-frame composite, cloud-required anything.
