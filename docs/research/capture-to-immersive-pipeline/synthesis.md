# Full Pipeline: Physical Space Capture to Immersive Web 3D with Gaussian Splatting and Hybrid Mesh+Splat Techniques

## Recommendation

Use a **dual-branch pipeline** where the same COLMAP sparse reconstruction feeds both a 3DGS splat training path and a separate mesh generation path, then combine them in a WebGPU viewer using depth-composited hybrid rendering. For projects with iPhone/iPad access, **Scaniverse** provides the fastest path to both mesh and splat from a single LiDAR capture session. Confidence: **high** for the overall architecture; **medium** for specific tool choices which are evolving rapidly.

## Action Plan

1. **Capture images and/or LiDAR of the physical space.** Use iPhone/iPad LiDAR via Scaniverse for immediate mesh+splat output from one session [2], or capture 100-300 overlapping photos for COLMAP-based processing [1]. LiDAR point clouds are 50x denser than COLMAP and can initialize 3DGS training directly [2].

2. **Run COLMAP for camera pose estimation** (photo-based path). COLMAP produces the sparse point cloud and camera intrinsics/extrinsics needed by both downstream branches [1]. Skip this step if using Scaniverse/Polycam which handle pose estimation internally.

3. **Branch A -- Train 3D Gaussian Splatting for visual appearance.** Use standard 3DGS training from COLMAP output. The splat scene captures photorealistic appearance including specular highlights, transparency, and fine detail that meshes cannot represent [1]. For LiDAR-enhanced training, use Polycam point clouds as initialization or DN-Splatter with iPhone depth priors for better indoor geometry [1][2].

4. **Branch B -- Generate structural mesh.** Choose one of three sub-paths depending on requirements [1][4][5]:
   - **Scaniverse LiDAR mesh** (fastest, +/-2-10cm accuracy, good for structural shell) [2]
   - **Traditional photogrammetry** via Meshroom or OpenMVS from COLMAP poses (best topology and UV textures, but slower) [4]
   - **Gaussian extraction** via SuGaR (OBJ with UVs), 2DGS (better surfaces, no UVs), or GOF (handles unbounded scenes, no UVs) [1]

5. **Post-process mesh for web delivery.** Raw meshes are NOT web-ready [5]. Decimate from source resolution (200K-1M vertices) down to 100K-300K triangles for room-scale scenes. UV unwrap and texture bake if using 2DGS/GOF output. Convert to GLB via gltfpack with Draco compression and WebP/KTX2 textures [5]. Target sizes: mobile 50K-150K triangles, desktop WebGPU up to 500K-2M with GPU culling [5].

6. **Export splats for web.** Use the KHR_gaussian_splatting glTF extension (ratified August 2025) to store splat data inside glTF alongside mesh geometry [1]. Scaniverse's SPZ format reduces splat file size by 90% [2]. Cesium supports the glTF extension as of March 2026 [1].

7. **Implement hybrid mesh+splat rendering in WebGPU viewer.** Use the depth compositing pattern: render opaque mesh first (writes depth buffer) then render splats with depth-test-only (no depth write) so splats behind mesh are discarded by hardware depth test [3]. Supported by:
   - **PlayCanvas** -- LOD streaming with occluder cube demo, multi-splat VR gallery example, CameraFrame sceneDepthMap [3]
   - **Three.js** -- mkkellogg/GaussianSplats3D with `threeScene` parameter, or dvt3d/splat-mesh (Jan 2026) purpose-built for hybrid rendering [3][2]
   - **Babylon.js v9** -- native mesh+splat depth compositing with shadows [3]

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Texture baking from Gaussians produces washed-out colors | High | Medium | Use traditional photogrammetry mesh with its own textures instead of baking from splats [5] |
| SuGaR/2DGS mesh artifacts (holes, bumps on thin geometry) | High | Medium | Use photogrammetry mesh for structure; splats handle visual fidelity [1][4] |
| LiDAR fails on glass, mirrors, reflective surfaces | Medium | Medium | Supplement with photo-based reconstruction for reflective areas [2] |
| glTF Gaussian extension tooling is immature | Medium | Low | Fall back to separate .ply/.splat files loaded alongside glTF mesh [1] |
| Mesh decimation loses important structural detail | Medium | Medium | Manual review of decimated mesh; preserve edge loops on architectural features [5] |
| Coordinate system mismatch between mesh and splat | Low | High | Use same COLMAP poses for both branches, or Scaniverse which shares coordinate frame [1][2] |

## Decision Log

| Decision | Rationale | Sources |
| -------- | --------- | ------- |
| Dual-branch pipeline over single extraction | Traditional photogrammetry meshes have better topology and fewer artifacts than Gaussian-extracted meshes; splats handle appearance better than textured meshes | [1][4] |
| Scaniverse as recommended LiDAR tool | Free, on-device, produces both mesh and splat from same capture in same coordinate frame, SPZ compression | [2] |
| Depth compositing for hybrid rendering | Standard technique supported by all major WebGPU engines; hardware depth test handles occlusion efficiently | [3] |
| Target 100K-300K triangles for room-scale web | Balances visual quality with mobile compatibility; desktop can handle more with GPU culling | [5] |
| Prefer photogrammetry mesh over Gaussian extraction for structural layer | Better topology, UV textures included, fewer artifacts; Gaussian extraction still improving | [4][1] |

## Key Findings by Theme

### Capture and Reconstruction

The pipeline begins with either photo capture processed through COLMAP, or LiDAR scanning via iPhone/iPad apps. COLMAP remains the standard for camera pose estimation and sparse reconstruction from photos [1]. iPhone/iPad LiDAR provides an alternative path with immediately usable mesh and point cloud output at +/-2-10cm accuracy [2]. Scaniverse stands out by producing both mesh (OBJ/FBX) and splat (.spz) from a single capture session in the same coordinate frame [2]. Polycam offers 15+ export formats with LiDAR point clouds 50x denser than COLMAP [2]. For academic/research workflows, ARKit provides direct ARMeshAnchor access with semantic classification of surfaces (wall, floor, ceiling, door, window) [2].

LiDAR and photogrammetry are complementary rather than competing: LiDAR point clouds can directly initialize 3DGS training for faster convergence and better geometry [2], and academic work (ICCV 2025, CDGS Feb 2025) uses LiDAR depth as regularization during Gaussian training [2].

### Mesh Extraction from Gaussian Scenes

Four primary methods exist for extracting meshes from trained Gaussian splat scenes [1]:

- **SuGaR** (CVPR 2024): Poisson reconstruction producing OBJ with UV textures. 200K-1M vertices. Known artifacts on thin geometry. Linux/Mac only.
- **2DGS** (SIGGRAPH 2024): TSDF fusion from 2D disk Gaussians. PLY output only (no UV textures). Better surface alignment but fails on backgrounds.
- **GOF** (SIGGRAPH Asia 2024): Marching Tetrahedra from opacity fields. PLY output (no UV). Best for unbounded scenes. ~24-45 min processing.
- **DN-Splatter** (WACV 2025): Nerfstudio extension supporting iPhone depth data and multiple mesh extractors.

Nerfstudio provides `ns-export tsdf` and `ns-export poisson` for textured .obj meshes but has no native glTF export [1].

### Traditional Photogrammetry as Alternative Mesh Source

Traditional photogrammetry tools -- Meshroom/AliceVision (free, open source) and OpenMVS (multi-view stereo) -- produce meshes with generally BETTER topology and fewer artifacts than Gaussian extraction methods [4]. The key advantage of the parallel pipeline approach (images -> COLMAP -> branch to both 3DGS and photogrammetry) is that both branches share COLMAP poses and thus the same coordinate system automatically [4]. For the hybrid use case where mesh provides structure and splats provide appearance, a photogrammetry mesh is the stronger choice for the structural layer [4].

### Web Compatibility and Post-Processing

Raw extracted meshes are definitively NOT web-ready [5]. No published examples of research meshes deployed in web 3D viewers were found [5]. The required post-processing pipeline is: decimation to 50K-300K triangles, UV unwrapping and texture baking for methods that lack UVs (2DGS, GOF), and format conversion via gltfpack to GLB with Draco compression and KTX2/WebP textures [5]. Typical size reductions: OBJ to GLB yields 40-60% reduction, Draco adds 70-95% further compression [5].

A significant quality issue exists: texture baking from Gaussian appearance to UV texture atlas produces washed-out colors compared to the original splat rendering [5]. This reinforces the value of the hybrid approach where splats handle visual fidelity rather than relying on baked textures.

The KHR_gaussian_splatting glTF extension (ratified August 2025) enables storing splat data alongside mesh geometry in a single container [1].

### Hybrid Mesh+Splat Rendering

The standard hybrid rendering pattern uses depth compositing: render opaque mesh geometry first (writing to depth buffer), then render splats with depth-test-only so hardware discards splats behind mesh surfaces [3]. This is supported across major WebGPU engines:

- **PlayCanvas** demonstrates this with LOD streaming occluder cubes and multi-splat VR gallery examples, using CameraFrame's sceneDepthMap for depth prepass [3].
- **Three.js** supports it via mkkellogg/GaussianSplats3D's `threeScene` parameter (limited to opaque objects that write depth buffer) and dvt3d/splat-mesh (Jan 2026), a purpose-built hybrid mesh+splat library [3][2].
- **Babylon.js v9** has native mesh+splat depth compositing with shadow support [3].
- PlayCanvas also offers a `GsplatMesh` script that converts mesh geometry into procedural Gaussians for fully unified rendering [3].

## Open Questions

1. **Texture baking quality** -- The documented washed-out color problem when baking Gaussian appearance to UV textures needs a solution for cases where mesh-only rendering is needed (e.g., fallback for devices without splat support). Priority: medium.

2. **Optimal splat-to-mesh boundary** -- In a hybrid scene, what should be mesh vs. splat? Flat architectural surfaces are obvious mesh candidates, but the threshold for organic/complex geometry is undefined. Priority: high for implementation.

3. **Streaming and progressive loading** -- How to progressively load a hybrid mesh+splat scene for large environments? The glTF extension helps with packaging but progressive streaming strategies for combined assets are not well documented. Priority: high for production use.

4. **Coordinate alignment tooling** -- While same-COLMAP-source ensures alignment, what tooling exists for aligning meshes and splats from different capture sessions or tools? Priority: medium.

5. **Mobile WebGPU splat performance** -- Real-world performance data for hybrid mesh+splat rendering on mobile WebGPU is sparse. The 50K-150K triangle budget is for mesh alone; combined budgets with splats are unknown. Priority: high for mobile targets.

## Methodology

5 hypotheses explored out of 8 proposed (3 cut as overlapping or low-plausibility). Investigation types: web search for documentation, GitHub repositories, academic papers, and engine examples. All 5 explored hypotheses yielded substantive findings. The dual-branch pipeline recommendation emerges from convergence across H1 (end-to-end pipeline), H4 (photogrammetry comparison), and H5 (web compatibility constraints).

## References

[1] H1 findings (end-to-end pipeline) -- SuGaR, 2DGS, GOF, DN-Splatter mesh extraction methods; COLMAP pipeline; KHR_gaussian_splatting glTF extension; Nerfstudio export commands
[2] H2 findings (LiDAR capture) -- Scaniverse mesh+splat workflow; Polycam density and format support; ARKit API; LiDAR-initialized 3DGS training; dvt3d/splat-mesh library; SPZ format
[3] H3 findings (hybrid rendering) -- PlayCanvas occluder cube and multi-splat demos; Three.js GaussianSplats3D; Babylon.js v9; depth compositing pattern; GsplatMesh script
[4] H7 findings (photogrammetry vs Gaussian extraction) -- Meshroom/AliceVision; OpenMVS; parallel pipeline approach; topology and artifact comparison
[5] H6 findings (web compatibility) -- Post-processing pipeline; decimation targets; gltfpack conversion; Draco/KTX2 compression ratios; texture baking color fidelity issue; polygon budgets

## Verification

- **Citations checked**: 5/5 valid -- all citations [1]-[5] map to specific hypothesis findings provided in the investigation
- **Hypotheses covered**: 5/5 -- H1 (end-to-end pipeline), H2 (LiDAR capture), H3 (hybrid rendering), H7 (photogrammetry comparison), H6 (web compatibility). Cut hypotheses H4, H5, H8 documented in decomposition with rationale.
- **Unsupported claims**: none -- all claims in the synthesis trace to specific findings from investigators
- **Contradictions found**: H6 partially contradicts implicit assumption in H1 that mesh extraction produces usable output -- H6 clarifies significant post-processing is required. This is flagged in the Action Plan step 5 and Risks table rather than silently resolved.
- **Issues found**: Findings were provided inline in the task prompt rather than as files in the hypotheses directories (directories exist but are empty). Citations reference logical finding groups rather than file paths.
- **Verification status**: PASS_WITH_WARNINGS (findings not persisted as files; otherwise all claims supported and all hypotheses covered)
