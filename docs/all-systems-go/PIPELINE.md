# Pipeline — power-on to archive

Traditional picture and spatial picture share stages 0–9. Spatial adds reconstruction, dual-branch scene authoring, and plate↔scene. Generative inserts are optional at every quality tier.

Latency: **LIVE** &lt;33 ms/frame · **NEAR** 1–30 s · **MIN** minutes · **NIGHT** hours.

| # | Stage | Artist | Machine | Box |
|---|---|---|---|---|
| 0 | **Power-on / rig** | Mounts, genlock, slate clock, LUT pack, consent list, NAS | Load resident stack (encode + SLAM + 9B or klein). Thermal check | Thor |
| 1 | **Scout** | Walks location, marks hero angles, sun | Sparse map (cuVSLAM). Optional LiDAR (phone) or photo burst → VGGT | Thor + 6000 |
| 2 | **Previs / block** | Blocks talent against virtual set on EVF | USD + mesh occluders, live pose overlay | Thor |
| 3 | **Light / look** | Lights, LUT, optional snap-look | Creative snap (klein 4B); grade preview | Thor |
| 4 | **Slate** | Calls scene / take / roll | Sidecar JSON + burn-in | Thor |
| 5 | **Capture** | Directs; A-cam operator | Encode all cams, pose, audio, tracks, AD notes. NAS write-through | Thor |
| 6 | **Live AD** | Accepts or ignores suggestions | Qwen3.5 on rolling buffer + script + coverage | Thor (or 6000) |
| 7 | **Live AR** | Acts in the virtual set | Depth-composite mesh/low-splat to EVF using live pose | Thor |
| 8 | **Playback / continuity** | Picks circled takes | NVDEC last-take; continuity index | Thor + NAS |
| 9 | **Dailies / proxy** | Watches on-set monitor | Proxies, thumbs, waveform, sync | 6000 + NAS |
| 10 | **Reconstruct** | Approves the capture set | COLMAP **or** VGGT poses. Shared frame for both branches | 6000 |
| 11 | **Branch A — appearance** | Trims floaters (SuperSplat) | **gsplat** (Apache). 7k MIN / 30k MIN–NIGHT | 6000 |
| 12 | **Branch B — structure** | Decimates architecture | Meshroom / OpenMVS **or** Scaniverse LiDAR mesh | 6000 / phone |
| 13 | **Author virtual scene** | Composes USD: mesh floors, splat foliage, lights, characters | SOG/SPZ + GLB + `KHR_gaussian_splatting` | 6000 + this repo |
| 14 | **Matchmove lock** | Supervises | Prefer live pose sidecar. Else VGGT/COLMAP on the plate | Thor record / 6000 solve |
| 15 | **Performance transfer** | Directs; may reshoot | Live: Maxine/SAM2 rig. Hero: 4DGS overnight | Thor live / 6000 night |
| 16 | **Plate ↔ scene** | Chooses direction | Depth-test composite LIVE/NEAR. Generative (Cosmos-Transfer, Wan) MIN | Thor live / 6000 gen |
| 17 | **Generative insert** | Writes prompts; never required | FLUX.2 stills; Wan / Hunyuan clips; H3 if licensed | 6000 |
| 18 | **Grade / mix / deliver** | Finishes | ProRes/EXR + audio **and/or** SOG + GLB + USD + WebGPU viewer | 6000 + this repo |
| 19 | **Archive / exit** | Pulls drives | NAS holds keys, takes, prompts, LUTs, scenes | NAS |

Traditional film skips 10–13 and spatial 16, still uses 0–9, 14 if VFX, 17–19.

## Two products, one spine

```
sensors ─ encode ─ pose ─ NAS
                │
                ├─ live AD / overlay / snap     (Thor, LIVE–NEAR)
                │
                └─ night: reconstruct / gen     (6000, MIN–NIGHT)
                           │
                           └─ viewer (this repo)
```

If the 6000 is off, stages 0–8 and 19 still complete. You have picture, pose, and notes. You do not have a new splat or an H3 clip until the box is back.
