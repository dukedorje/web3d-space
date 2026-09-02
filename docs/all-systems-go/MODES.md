# Camera-body modes

Modes are **GPU-resident profiles on Thor**, not apps. Encode + metadata always run. Switching unloads one optional resident and loads another (~1–5 s EVF overlay, not a reboot). If thermal or power sags, **drop AI, never record**.

## Always-on substrate (not a mode)

| Job | What | Notes |
|---|---|---|
| **Record / proxy** | HSB / GMSL / USB → 2× NVENC HEVC | Timecode, slate, LUT id, IMU, **Cooke /i–class lens** (focal, T-stop, focus, entrance pupil, serial) as a JSONL sidecar 1:1 with picture — hardware home `AICamera/docs/LENS.md`. NAS write-through; local NVMe ring if the link drops. T5000: up to 6× 4Kp60 H.265 |
| **Pose stream** | Isaac ROS Visual SLAM / cuVSLAM + IMU | Live matchmove backbone. T5000 stereo disparity 1080p ~187 fps / 5.8 ms @ 30 Hz (vendor). Not VGGT |
| **Audio** | Hardware path first (AES67 / Dante / body mics) | Maxine denoise is a helper. Boom op owns the take |

MIG (10 TPCs): slice 0 = encode + SLAM (hard realtime). Slice 1 = VLM / snap / overlay. Kill slice 1 before frames drop.

## Named modes

### 1. Master capture

One operator, one look, **no AI in the optical path**. VLM and overlay are opt-in on a cloned stream. Fail-safe default.

### 2. Creative snap

Still or 1–4 s clip → **FLUX.2 [klein] 4B** with a locked prompt pack (look, lighting, stock, “this set”). Output is a **reference still on the EVF** plus a NAS sidecar. It does not replace the take.

Unload: 27B AD. Keep 9B if you still want talking.

### 3. VLM shot-calling (AD)

Rolling buffer of last N frames + script/beat sheet + coverage map.

Says things like: we don’t have a clean single on her eyeline; jacket was zipped last take; sun is 18 min from the building.

Talks. Does not move the camera unless the operator asks.

- Day: **Qwen3.5-9B** (vision in-model) or Qwen3-VL-8B
- Heavy, camera on sticks, 130 W: **Qwen3.5-27B**

### 4. Live AR / virtual scene overlay

Pre-authored USD + mesh occluders + optional low-count splat, composited with **depth test, not generation**. EVF shows talent in the virtual set.

Honest: LIVE for mesh + sparse splat + cuVSLAM. Photoreal room-scale splat at 4K on 273 GB/s is not a v1 promise; 720p EVF maybe.

Unload: klein 4B and 27B. Keep 9B if AD must talk during overlay.

### 5. Talent tracking

SAM2 (prompted once per person) + Maxine 3D body (34 kpts). Drives focus assist, privacy blur, later performance transfer. Not a VLA.

### 6. Continuity / scripty

VLM + embedding index of takes on NAS. Wardrobe, props, eyeline, weather, lens. Writes a log. Never auto-edits picture.

### 7. Slate / metadata

Scene / take / roll, body id, lens, LUT, prompt-pack id, consent flags. Burn-in + JSON sidecar next to media. OCR of a physical slate is optional.

### 8. Scene scout / blocking

Walk. cuVSLAM sparse map. Optional burst → VGGT on the 6000. AD: this corner is unusable at 35 mm. Coverage heatmap for later 3DGS (you still want 100–300 overlapping frames).

### 9. Performance capture live

Markerless: Maxine body + SAM2 mesh proxy → bone stream to a USD humanoid. Good for blocking and eyeline. Hero transfer is overnight 4DGS / markers on the 6000.

OpenPi π0.5 (~49 ms TRT on Thor) only if the **body is a motion-control head**. Do not confuse VLA with AD VLM.

### 10. Matchmove record

Pose + intrinsics + distortion + IMU + encoder timecode, 1:1 with picture. This file later locks the virtual scene to the plate. Do not wait for COLMAP if you recorded this.

### 11. Multicam / GMSL

Thor: HSB via QSFP (up to 20), MIPI CSI-2 (6 / 32 virtual channels). Industrial carriers: 8× GMSL2. A-cam gets VLM; B-cams encode-only unless MIG isolates a second stream. USB is not genlock.

### 12. Look / grade preview

3D LUT + CDL on the EVF. Optional klein 4B “grade this still like the look board.” Not a live 4K 24p grade. Stills + 1–2 s proxy loop.

### 13. Privacy / consent

Face detect → blur / drop / flag. Consent bits in metadata. Local only. Strip faces **before** a clip hits any generative model, including local Wan/H3.

### 14. Playback / last-take

NVDEC, overlay slate + pose sparkline + AD notes.

### 15. Coverage / splat-readiness

Parallax, overlap, exposure variance, motion blur. Tells the DP: walk left 2 m, we have a hole for the splat.

### 16. Focus / exposure / ND assist

Classical metering + small VLM. Do not put a 27B in the iris loop.

### 17. Audio assist

Maxine denoise / active speaker. Dual-system sound is still the film path.

## Do not put on the body

MiniMax H3, Wan 2.2 14B, Hunyuan, Cosmos-Predict 14B, Cosmos-Transfer (65 GB), TRELLIS.2 at high res, gsplat densify of a room, full BF16 anything over ~20B dense. Those are 6000 / NAS jobs.
