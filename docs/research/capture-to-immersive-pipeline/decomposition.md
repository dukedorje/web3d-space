# Decomposition: Full Pipeline from Physical Space Capture to Hybrid Mesh+Splat Web 3D

## Selected Hypotheses (top 5)

1. **H1: COLMAP + 3DGS + SuGaR/2DGS is the practical end-to-end pipeline today** → web
2. **H2: iPhone/iPad LiDAR can replace or supplement COLMAP for structure** → web
3. **H3: PlayCanvas/WebGPU supports hybrid mesh+splat rendering** → hybrid
4. **H7: Traditional photogrammetry produces better meshes than Gaussian extraction** → web
5. **H6: Gaussian-to-mesh methods produce web-compatible output** → web

## Cuts
- H4 (Nerfstudio): overlaps with H1
- H5 (Paired datasets): light lookup, folded into other investigations
- H8 (Client-side mesh extraction): low plausibility
