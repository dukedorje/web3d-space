# Virtual scene loop

The product’s spine. This repo already implements the **viewer** half: PlayCanvas depth composite (mesh writes depth, splats depth-test-only) in `src/lib/splat/scenes.ts`.

```
Scout / capture
    │
    ├─ live pose (cuVSLAM) ──────────────► EVF overlay (mesh occluders)
    │
    ├─ photos / LiDAR ─ COLMAP/VGGT ─┬─ gsplat ── splat appearance
    │                                 └─ Meshroom ─ structural mesh
    ▼
USD scene (mesh + splat + lights + characters)
    │
    ├─ LIVE:  pose + depth-test composite onto camera
    ├─ NEAR:  VGGT refine, SuperSplat trim
    ├─ MIN:   Cosmos-Transfer / Wan “plate looks like scene”
    └─ NIGHT: 4DGS performance, Wan/H3 hero inserts
```

## Author

Capture (photo set or Scaniverse) → **shared poses** → dual branch:

- Photogrammetry / LiDAR **mesh** for structure (floors, walls, architecture).
- **3DGS** for appearance (foliage, specular, mess).

Do not bake washed-out Gaussian textures onto the mesh (repo synthesis). SuperSplat trim. Package SOG/SPZ + GLB. TRELLIS.2 for *props* (mesh), not rooms.

## Live camera pose

cuVSLAM + IMU + optional AprilTag on set pieces (T5000 AprilTag ~3.7 ms vendor). Relocalize against the scout map.

**VGGT is a burst reconstructor, not a 24 fps tracker.** Record the pose sidecar on every take (mode: Matchmove record).

## Overlay composite

| Path | When | How |
|---|---|---|
| **Live depth-test** | EVF, blocking, “talent in the set” | Render USD mesh to depth; draw low-count splats / GLB characters with depth test; plate as background or mesh card. Same pattern as this repo’s hybrid viewer |
| **Generative** | Post, lighting interaction depth-test cannot do | Cosmos-Transfer2.5 (depth/seg/edge) or Wan I2V. Minutes per shot |
| **Not a compositor** | — | H3 is a generator. Do not run it per frame |

Live failures: glass, hair, smoke, thin chairs — same as any AR.

Photoreal splat fill-rate at 4K on 273 GB/s is not a v1 claim. Mesh occluders + 720p splat proxy is the honest live target.

## Performance → virtual character

- **Live:** Maxine 34 kpts or SAM2 silhouette → retarget to a USD humanoid. Blocking and eyeline.
- **Hero:** markers or 4DGS of the performer, trained overnight on the 6000, played back as a 4D asset.

## Video matched to scene (and vice versa)

**Video → scene.** Recorded pose (or VGGT/COLMAP solve) → camera in USD → plate as a textured card or projected on a depth mesh → optional generative fill of disocclusions (MIN).

**Scene → video (the ideal).** Live overlay while recording, so the take *is* the composite. If pose drifts: relocalize, or fall back to “record clean plate + pose, composite in stage 16.”

## Honest latency

| Loop | Reality |
|---|---|
| Pose on EVF, mesh occluders, LUT | LIVE if resident set is small |
| Photoreal splat environment in EVF at 4K | Not v1 on 273 GB/s |
| Klein still of “this frame in the virtual set” | NEAR |
| Locked matchmove + depth composite in post | NEAR–MIN |
| Cosmos/Wan/H3 “make the plate the scene” | MIN–NIGHT |
| Room-scale 3DGS + mesh | MIN–NIGHT on the 6000 |
| 4DGS performance hero | NIGHT |

## Viewer (this repo)

Adopt PlayCanvas for the film viewer (already on `/splat`). Do not fork a 500-line WGSL rasterizer for the spatial deliverable. Camera-body EVF is native Vulkan/GL on Jetson, not the browser.
