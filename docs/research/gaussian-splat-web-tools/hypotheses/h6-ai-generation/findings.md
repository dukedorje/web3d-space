# H6: AI-Based Gaussian Splat Generation from Text/Image Prompts

## Summary
**Partially refuted.** AI-based 3DGS generation works for single objects (prototyping), but falls short of production quality for scene-level content. TRELLIS (Microsoft, CVPR 2025) is the most capable tool. Scene-level generation remains research-only.

## Object-Level Generation Tools

### TRELLIS (Microsoft) — Best Option
- CVPR 2025 Spotlight, GitHub: microsoft/TRELLIS
- Image-to-3D in ~1 minute, outputs **simultaneously**: 3D Gaussians, Radiance Fields, meshes
- Direct `.ply` export for Gaussians + `.glb` mesh
- Text-to-3D less reliable than image-to-3D (data limitations)
- PlayCanvas CEO demoed: Google image → TRELLIS → SuperSplat in ~1 min
- **TRELLIS 2 dropped Gaussian output** — only mesh. Use original TRELLIS for 3DGS.

### DreamGaussian
- ICLR 2024 Oral, 4,312 stars
- Single image → 3DGS in ~2 minutes (10x faster than prior SDS methods)
- Output: `.ply` + mesh
- Quality: competitive but not photorealistic; rough geometry
- 135 open issues suggest ongoing quality problems

### GaussianDreamer
- CVPR 2024, 821 stars
- Text → 3DGS in ~15 minutes
- Bridges 2D + 3D diffusion models
- GaussianDreamerPro (June 2024): enhanced quality
- Fundamental data bottleneck acknowledged in paper

## Scene-Level Generation (Research Only)
- **DreamScene360** (ECCV 2024): 360° immersive scenes from text via panoramic GS — research code only
- **FastScene** (IJCAI 2024): Text-driven indoor scene generation — research only
- **DreamScape**: Scene-level text → 3DGS — research only
- **No commercial/production deployments found** for any scene-level tool

## NOT Gaussian Splat Generators
- **Stability AI (SV3D)**: Outputs meshes via NeRF, not Gaussian splats
- **Luma AI Genie**: Outputs quad meshes (OBJ/GLB), not Gaussian splats
- Both produce 3D content but in mesh format, not 3DGS

## Quality Reality Check
1. **Floaters and artifacts** dominate generative 3DGS vs capture-based
2. **SDS degradation**: Score Distillation Sampling "neglects multi-view correlations, prone to geometric inconsistency"
3. **Single objects only** for production-usable quality
4. **2026 production landscape**: All production workflows are capture-based (DJI Terra, Polycam, Luma capture)
5. AI-generated 3D framed as "next frontier" not current production by industry guides

## Web Compatibility
- Generative tools output standard `.ply` — same format as capture-based
- Full compatibility: `.ply` → SuperSplat / SplatTransform → SOG/SPZ → web viewer
- Format is not a barrier; quality is

## Maturity Verdict
| Use Case | Readiness |
|----------|-----------|
| Single object prototyping | Ready (TRELLIS) |
| Product/asset visualization | Borderline (quality dependent) |
| Scene/environment generation | Research-only |
| Production environments | Not ready |

## Sources
- [1-3] DreamGaussian, [4-5] GaussianDreamer, [6-9] TRELLIS, [10] SV3D, [11-12] Luma Genie, [13-14] DreamScene360/FastScene, [15-16] 2026 industry guides
