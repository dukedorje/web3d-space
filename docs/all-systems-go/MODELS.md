# Models — what runs where

VRAM figures are weights + working set from vendor or community reports. Thor numbers are **SPEC** unless marked FACT (Isaac / OpenPi / TensorRT Edge-LLM).

Latency: **LIVE** &lt;33 ms · **NEAR** 1–30 s · **MIN** minutes · **NIGHT** hours.

## Perception / live (Thor-first)

| Job | Model | Latency | VRAM | Box |
|---|---|---|---|---|
| Pose / VO | Isaac ROS Visual SLAM / cuVSLAM | LIVE 5.8 ms stereo 1080p T5000 FACT | small | **Thor always** |
| Dense stereo | Isaac disparity / OFA | LIVE | accelerator | Thor |
| Depth (mono) | Depth Anything V2-S | LIVE | &lt;1–2 GB | Thor |
| Segment / track | SAM2 (TensorRT) | LIVE–NEAR | 1–4 GB + bank | Thor |
| Face / body | NVIDIA Maxine AR | LIVE | small | Thor; 6000 if many streams |
| Audio | Maxine Audio / ASD | LIVE | small | Thor |
| Shot-calling | **Qwen3.5-9B** or Qwen3-VL-8B | NEAR | ~7–12 GB | **Thor resident** |
| AD heavy | Qwen3.5-27B Q6 or 35B-A3B Q4 | NEAR | ~23 GB | Thor *or* 6000; unload klein |
| Camera-as-robot | OpenPi π0.5 TRT FP8+NVFP4 | LIVE ~49 ms FACT Thor | FP4-friendly | Thor only if actuated |

## Image

| Job | Model | Latency | VRAM | Box |
|---|---|---|---|---|
| On-set snap | **FLUX.2 [klein] 4B** Apache 2.0 | NEAR | 8–13 GB | **Thor resident** in snap mode |
| Better local still | FLUX.2 [klein] 9B | NEAR | ~15–20 GB | Thor or 6000; **non-commercial** |
| Quality still / multi-ref | **FLUX.2 [dev] 32B** | NEAR–MIN | ~19 GB Q4 … 64 GB BF16 | **6000** (FP8 fits 96 GB) |

## Video gen / transfer (never live)

| Job | Model | Latency | VRAM | Box |
|---|---|---|---|---|
| Fast I2V / T2V | **Wan 2.2 TI2V-5B** Apache 2.0 | MIN | 8–20 GB | **6000** |
| Quality I2V | Wan 2.2 A14B | MIN | 16 GB offload … 80 GB FP16 | 6000 FP8 |
| Quality T2V | HunyuanVideo 1.5 | MIN | ~14–47 GB | 6000 |
| World | Cosmos-Predict2.5 2B / 14B | MIN | 2B on 6000; 14B offload | 6000 |
| Control (depth/seg/edge → video) | Cosmos-Transfer2.5-2B | MIN (~5 min / 5 s 720p class) | **65.4 GB** FACT | **6000** (tight) |
| Flagship omni + audio | **MiniMax H3** | MIN (turbo ~44 s on 48+20 GB FACT; 7–17 min on 12 GB offload) | BF16 ~108–144 GB; pruned INT8 ~43 GB files | **6000 sequential offload**. Thor: no. **US open-weights blocked** |

## Spatial (this repo)

| Job | Model | Latency | VRAM | Box |
|---|---|---|---|---|
| SfM | COLMAP | MIN | CPU+GPU | 6000 |
| Feed-forward recon | VGGT / MASt3R | NEAR–MIN | several–12 GB | **6000**; Thor scout burst SPEC |
| 3DGS train | **gsplat** Apache 2.0 | 7k ~minutes / 30k tens of minutes | 4–6 GB small; 24–80 GB large | **6000** |
| LiDAR fast path | Scaniverse | MIN | on-device | Phone → NAS |
| Mesh | Meshroom / OpenMVS | MIN–NIGHT | CPU+GPU | 6000 / NAS |
| Object gen | TRELLIS.2 4B | NEAR | several GB | 6000. **Mesh, not Gaussians** (use TRELLIS 1 for .ply GS) |
| Dynamic | 4DGS | train NIGHT; render LIVE for baked assets | 8–80 GB train | 6000 train; Thor render SPEC |
| Web view | PlayCanvas GSplat + mesh depth composite | LIVE | client GPU | This repo / laptop |

Do not use INRIA 3DGS (non-commercial) as the default train path.

## Reconstruction vs generation (keep these straight)

- **Rooms / locations:** capture. AI scene-level 3DGS is research (repo H6).
- **Props / hero objects:** TRELLIS.2 mesh is production-usable.
- **Looks / inserts:** FLUX stills, Wan/Hunyuan/H3 video, Cosmos-Transfer for plate→look.
- **Live EVF:** pose + depth-test mesh. Not a DiT.

## License hygiene (ship defaults)

**Clean local defaults:** gsplat, COLMAP, Wan 2.2, FLUX.2 klein 4B, Isaac ROS, PlayCanvas (MIT), SAM2 (check Meta terms), Qwen3.5 (check current Qwen terms).

**Gate behind a screen:** FLUX.2 [dev] / klein 9B, INRIA 3DGS, Hunyuan community, **MiniMax H3** (territorial open-weights).
