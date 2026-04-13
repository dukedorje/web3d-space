# H4: Open-Source 3DGS Training Pipeline

## Summary
**Confirmed with nuances.** A complete open-source pipeline exists: COLMAP (BSD) → gsplat/Nerfstudio (Apache 2.0) → .ply → SplatTransform → SOG/SPZ for web. The original INRIA repo has a **non-commercial** license. Truly open alternatives (gsplat, OpenSplat) match quality within 0.5 dB PSNR.

## Training Tools

### Original 3DGS (graphdeco-inria/gaussian-splatting)
- **License: Non-commercial research only** — NOT OSI open source
- PSNR: 28.4 dB (highest quality)
- Training: ~30 min RTX 3060, ~12 min RTX 4090
- VRAM: ~6 GB
- Output: .ply

### gsplat (nerfstudio-project/gsplat) — **Recommended**
- **License: Apache 2.0** ✓
- 4,787 GitHub stars, PyPI: `pip install gsplat`
- PSNR: 28.1 dB (within 0.3 dB of INRIA)
- Training: ~20 min RTX 3060, ~8 min RTX 4090 — **fastest**
- VRAM: ~4 GB — **lowest**
- 4x less memory, 15% less training time vs INRIA backend

### Nerfstudio (Splatfacto method)
- **License: Apache 2.0** ✓
- 11,432 stars, uses gsplat as backend
- PSNR: 27.9 dB
- Training: ~25 min RTX 3060, ~10 min RTX 4090
- VRAM: ~6 GB (splatfacto), ~12 GB (splatfacto-big)
- Easiest workflow: `ns-process-data` → `ns-train splatfacto` → `ns-export gaussian-splat`
- Built-in web viewer for monitoring training

### OpenSplat
- **License: AGPLv3** (commercial use allowed under AGPL terms)
- 1,900 stars, C++ implementation
- **Only trainer with broad hardware support**: NVIDIA, AMD ROCm, Apple Metal, CPU
- Cross-platform: Windows, Mac, Linux
- Input: COLMAP, OpenSfM, ODM, nerfstudio formats

### Postshot
- **Not open source** — proprietary, Windows-only
- Free tier exists but PLY export requires paid subscription (~$15/month)
- Most beginner-friendly local trainer

## Preprocessing: COLMAP (Structure-from-Motion)
- BSD license, standard SfM preprocessing step
- Unordered photos → feature matching → camera poses → sparse 3D point cloud
- Required input for all training tools
- Nerfstudio wraps COLMAP automatically via `ns-process-data`

## Hardware Requirements
- **NVIDIA GPU required** for Python-based trainers (CUDA)
- Minimum practical VRAM: 4 GB (gsplat) to 12 GB (splatfacto-big)
- Budget GPU: RTX 3060 12GB (~$200-250 used)
- Cloud: Vast.ai from $0.08/hr, RunPod from $0.15/hr — 30-min run costs $0.04-0.12
- Google Colab free tier (T4): 45-90 min

## Quality Comparison (83-photo benchmark, RTX 3060)
| Tool | PSNR | License | Time |
|------|------|---------|------|
| Original 3DGS | 28.4 dB | Non-commercial | 30 min |
| gsplat | 28.1 dB | Apache 2.0 | 20 min |
| Nerfstudio | 27.9 dB | Apache 2.0 | 25 min |
| Luma AI (cloud) | 27.8 dB | Commercial | 20-60 min |
| Polycam (cloud) | 27.5 dB | Commercial | 15-45 min |

PSNR differences under 1 dB are barely perceptible.

## Output Pipeline: Training → Web
1. All trainers output `.ply`
2. Convert to web format:
   - **SOG** (PlayCanvas): `splat-transform input.ply output.sog` — 95% size reduction
   - **SPZ** (Google): ~10x smaller, on track for glTF standardization
   - **KSPLAT** (Three.js): retains spherical harmonics
3. Serve compressed format to browser

## Commercial/Cloud Alternatives (When Worth It)
- **Luma AI**: Free tier, best for outdoor/vegetation scenes
- **Polycam**: $8/month, LiDAR-enhanced on iPhone Pro
- **Scaniverse**: Free, 8 min end-to-end (lowest effort)
- Worth it when: no NVIDIA GPU, non-technical users, time-constrained

## Sources
- [1] INRIA license, [2-7] Benchmark comparison, [3] Nerfstudio docs, [5-6] gsplat docs/paper, [8-9] OpenSplat, [10] COLMAP, [12] Postshot, [16] SOG format blog
