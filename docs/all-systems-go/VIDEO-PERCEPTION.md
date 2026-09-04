# Video perception for the AI stream

Research pass 2026-09-04. Goal: take arbitrary footage (YouTube, phone, dailies), emit a **depth field**, a **named-instance map**, and a **background matte**, then shrink the same stack until it can sit on Thor as an EVF overlay. LIVE is still **&lt;33 ms/frame**. Depth-test composite stays the live look; this is perception, not a DiT.

Do not treat monocular depth as LiDAR. LiDAR (or calibrated stereo / Isaac disparity) is metric range. Almost every “video depth” net is **relative / affine**, or **weakly metric after a focal-length scale**. We already write Cooke /i focal in the JSONL sidecar — that is the scale hook.

## The three jobs (keep them separate)

| Job | Output | What it is not |
|---|---|---|
| **Depth** | Per-pixel Z (relative or metres) | Not object IDs |
| **Named instances** | `{id, name, mask, bbox, track}` per object | Not a panoptic ADE20k colormap |
| **Background matte** | Alpha: 0 = bg, 1 = keep | Not “run rembg on every frame” |

Names come from **open-vocab detection**, outlines from **video segmentation / tracking**, locations from **mask × depth**. Reverse lookup (mask → name) is the same table, not a second model.

## Frame-wise vs video-native

Independent stills + a smoother is the wrong default. It flickers, swaps IDs, and still costs a full forward pass every frame.

| Pattern | When | Cost |
|---|---|---|
| **Per-frame still net** (DA-V2, BiRefNet, Grounding DINO) | Offline stills, or a keyframe | Fast per image; **flicker in video** |
| **Video-native temporal** (VDA, SAM2/3 memory, RVM recurrent) | Any stream we will watch | Extra head/memory; **this is the product path** |
| **Diffusion video** (DepthCrafter, ChronoDepth) | Overnight pretty depth | 0.5–1 s/frame on A100. **Never live** |
| **Hybrid (Thor)** | Detect/name on keyframes, **track** in between | The only way three jobs fit in 33 ms |

Keyframe interval is the real design knob: YOLOE / SAM3-detect every 8–15 frames (~2–4 Hz at 30 fps); SAM2-tiny / EdgeTAM / RVM state carries the rest.

## 1. Depth — “LiDAR-like”

### What wins on video (quality × speed)

Measured on **A100, 518²**, Video Depth Anything paper (CVPR 2025):

| Model | Kind | Latency / frame | Notes |
|---|---|---|---|
| **VDA-S** (Video Depth Anything Small) | Feed-forward + temporal head on DA-V2 | **9.1 ms** (~110 fps) | Best live candidate. 28 M params. Beats DepthCrafter on long-video geometry. |
| VDA-L | same, ViT-L | 67 ms | ~10% slower than still DA-V2-L (60 ms), much more consistent |
| DA-V2-L (still) | per-frame | 60 ms | Zigzag temporal profiles (flicker) |
| DepthAnyVideo | video diffusion | 159 ms | Short windows |
| NVDS | flow-aligned | 204 ms | Needs optical flow |
| ChronoDepth | video diffusion | 506 ms | |
| **DepthCrafter** | video diffusion | **910 ms** | Prettiest details; 110-frame windows; **offline only** |

FlashDepth: 24–30 fps at ~924×518, 6 fps at 2K (DAv2-L backbone). CUT3R: streaming 14 fps at 512×288, blurrier. **oVDA** (online VDA, Oct 2025): **42 fps A100, 20 fps Jetson**, low VRAM, sliding window — the closest published **edge** number.

**Depth Anything 3** (ByteDance, ICLR 2026): pose + metric monocular + streaming. DA3-SMALL **0.08 B, Apache**, DeepStream TRT report: **30 fps, 522 MiB**. DA3METRIC-LARGE: metres via `Z = focal_px * net / 300` — we already have `focal_px` from /i. ROS2/TRT nodes exist. This is the **metric** upgrade of the DA-V2-S line already on the MODELS table.

Isaac **stereo disparity** on T5000 is still the only **FACT** Thor LIVE depth (5.8 ms 1080p). Use it when the body has stereo. Mono nets fill the YouTube / single-cam sim.

### Pick

| Surface | Model | Why |
|---|---|---|
| **Thor EVF** | VDA-S or oVDA or DA3-SMALL, TRT FP8/NVFP4 | Video-native, &lt;10–20 ms class on datacenter; Jetson 20 fps already shown |
| **Metric EVF** | VDA-S-Metric or DA3METRIC-SMALL/L + /i focal | LiDAR-shaped numbers without a puck |
| **Sim / 6000** | VDA-L or DA3-L streaming | Long clips, no 110-frame cap |
| **Pretty overnight** | DepthCrafter | Do not put on Thor |

Per-frame DA-V2-S remains a valid **bring-up** (we already ran it on the PRO 4500). Promote to VDA-S before anyone watches a take.

## 2. Named objects — outlines + names + tracks

Closed-set COCO segmentation does not name “hero lamp, 2nd AC’s backpack.” Open-vocab **instances** do.

### Detectors (the names)

| Model | Speed (published) | Role |
|---|---|---|
| **YOLO-World / YOLOE** | YOLO-World ~52 fps V100, ~15 ms/img class; YOLOE-26l-seg ~160 fps T4 @ 640 | **Live names.** Cache text embeddings once. Prompt-free mode exists. |
| Grounding DINO | 100–400 ms/img | Accuracy ceiling. Keyframe / 6000 / sim. Not 30 fps on Thor. |
| **SAM 3 / 3.1** | ~30 ms/image H200 (100+ objs); 16→**32 fps** H100 with 3.1 multiplex (up to 16 objs/pass; 7× at 128 objs) | Detect + segment + track from **text** (“yellow school bus”). **848 M (~3.4 GB)**. Research/gated license. Server-scale until TRT exists. |

YOLO-World license is **CC-BY-NC-SA** — gate it. YOLOE (Ultralytics, YOLOv8/11/26) is the practical live fork.

### Masks + IDs (the outlines)

SAM 2 is already on the MODELS table (Apache). It is a **streaming memory tracker**, not a still net.

| Variant | Published speed | Honest Thor read |
|---|---|---|
| SAM 2.1 Hiera-Tiny | ~91 fps A100 @ 1024² (single object) | Start here |
| SAM 2.1 Large | ~30 fps A100 | Sim / 6000 |
| TIER IV TRT | 123 ms L40S FP16 (~100 boxes); **611 ms Jetson Orin** FP16 | Full SAM2 is **NEAR**, not LIVE, on Orin |
| **NanoSAM** (SAM1 distilled) | **8.1 ms** AGX Orin / **27 ms** Orin Nano full pipeline | Image SAM, not video memory |
| **EdgeTAM** | 16 fps phone; ≫20× vs SAM2 | On-device track-anything |
| TinySAM 2 | 25.6 fps (paper GPU, 1000 frames) | 7% of SAM2.1 tokens |

Pattern that actually hits 30 fps on edge: **detector on keyframes → box/point prompt → tiny tracker every frame.** NVIDIA DeepStream already exports SAM2 encoder / memory-attn / decoder to TRT for MaskTracker.

**Reverse names:** keep a table `track_id → label` written at detect time. Do not run a VLM on every mask. Qwen3.5-9B (already resident in AD mode) can caption a **crop** when the operator asks, or on a 1 Hz sidecar — not in the 33 ms loop.

### Pick

| Surface | Stack |
|---|---|
| **Thor EVF** | YOLOE-small (cached vocab: talent, boom, slate, C-stand, hero prop…) every N frames + SAM2-tiny **or** EdgeTAM. Names from the detector. |
| **Sim / 6000** | SAM 3.1 text prompts on the clip, or Grounding DINO + SAM2-L |
| **AD talk** | 9B reads the instance JSONL, not the pixels |

## 3. Background removal

Two different products:

1. **“Everything that is not a named object”** — invert the union of instance masks. This is the set-piece / virtual-set matte. **No extra net** if (2) is running.
2. **Hair / semi-transparent talent** — needs a **matting** net (alpha, not a binary mask).

| Model | Video? | Speed | Scope | License |
|---|---|---|---|---|
| **RVM** (Robust Video Matting) | Recurrent, native | **HD 104 fps / 4K 76 fps on 1080 Ti**; 172 fps HD FP16 3090 | **Humans only** | Apache-class (paper/code) |
| **SAM2Matting-Tiny** (2026) | Zero-shot on SAM2 tracks | **40 fps 1080p, &lt;5 GB** | Any SAM2/SAM3 target | check paper |
| MatAnyone / **MatAnyone 2** | Memory VOS + matting | Quality; not LIVE | Humans + in-the-wild | NTU S-Lab |
| BiRefNet | Still (some video wrappers) | ~17 fps 1024² on 4090 | General stills | MIT |
| BEN v2 | Video alpha | Hair specialist | General | MIT |
| Per-frame rembg / U2Net | No | Fine for stills | Flickers | — |

RVM is the only matte that is **already LIVE-class on 2017 hardware**. It will not cut a C-stand. For “remove the room, keep talent + hero props,” **union(YOLOE/SAM tracks) → optional RVM/SAM2Matting only on people**.

Live EVF already decided: **depth-test**, not a generated plate. A matte is for privacy blur, virtual-set hole, or the sim viewer — not a 4K 24p key.

## Compute budget on Thor

T4000: 1536 CUDA, 64 GB unified, **273 GB/s**, 70 W (90 W throttle). Resident set designed **≤ ~40 GB** so encode + SLAM + one extra never page. MIG: slice 0 = NVENC + cuVSLAM; slice 1 = overlay. Kill slice 1 before frames drop.

Rough LIVE overlay (720p EVF, TRT, SPEC until measured):

| Piece | Target | Fits? |
|---|---|---|
| VDA-S / DA3-S / oVDA | 8–15 ms | Yes — this is the depth job |
| YOLOE-n/s @ 640, every 8–15 frames amortized | ~2–8 ms average | Yes |
| SAM2-tiny **or** EdgeTAM, few tracks | 5–15 ms | Tight; NanoSAM-class if SAM2 memory blows it |
| RVM MobileNetV3 (talent only) | a few ms @ 0.25 downsample | Yes if we drop SAM2 that frame |
| Qwen 9B | NEAR, not this loop | Unload in overlay-only mode |
| DepthCrafter / SAM 3.1 848 M / MatAnyone 2 | — | **6000 / sim** |

273 GB/s is why we do **not** run SAM 3.1 + VDA-L + 9B together on the body. Bandwidth, not VRAM.

T4000 vs T5000: overlay is a **TPC / NVENC** problem as much as a model problem. Hybrid sat HEVC + one body RAW→NVENC stays.

## Sim pipeline (YouTube → AI stream)

Offline on a PRO 4500 / 6000 / the `/gpu` worker. Not Thor.

```
HEVC in
  → VDA-L or DA3METRIC-stream          # depth video (focal from sidecar or EXIF guess)
  → SAM 3.1  or  YOLOE + SAM2-L        # named masks + ids
  → matte = 1 - ∪(foreground)
  → optional SAM2Matting / RVM on person tracks
  → JSONL 1:1 with picture:
       t, objects[{id,name,bbox,mask,z_median}], depth.mp4, matte.mp4
```

Do **not** independently smooth three per-frame nets. Use the temporal heads those models already have. If a still net must be used (bring-up), run it at 5–10 Hz and warp with the SAM2 memory / optical flow — never naive EMA on labels.

Sources: any clip is fine. Expect YouTube compression to hurt hair mattes and thin depth edges; that is a useful stress test, not a lab failure.

## What is already decided vs what this pass adds

**Keep:** DA-V2-S as the named Thor depth job until VDA-S/DA3-S is measured; SAM2 as the tracker; live overlay is depth-test; 9B is AD not a per-frame namer.

**Add (SPEC until FACT on Thor):**

1. Promote depth from still DA-V2-S → **Video Depth Anything Small** (or **oVDA** / **DA3-SMALL**) for anything we watch as video.
2. Names = **YOLOE** (live) / **SAM 3.1** (sim). Not a dense semantic softmax.
3. Background = **invert instance union**; RVM only for talent hair.
4. Hybrid keyframe/track is the Thor shape. Diffusion depth is NIGHT.

## Sources

- Video Depth Anything, arXiv:2501.12375 (CVPR 2025 Highlight) — VDA-S 9.1 ms A100
- oVDA, arXiv:2510.09182 — 20 fps Jetson
- FlashDepth, arXiv:2504.07093
- DepthCrafter, arXiv:2409.02095 — 910 ms/frame A100
- Depth Anything 3, arXiv:2511.10647; DeepStream TRT 30 fps / 522 MiB (DA3-SMALL)
- SAM 2, arXiv:2408.00714; SAM 3, arXiv:2511.16719; SAM 3.1 multiplex (Meta, 2026-03-27)
- TIER IV SAM2 TRT — 611 ms Orin
- NanoSAM (NVIDIA-AI-IOT) — 8.1 ms AGX Orin
- YOLO-World, arXiv:2401.17270; YOLOE (Ultralytics 2026)
- RVM, arXiv:2108.11515 — HD 104 fps 1080 Ti
- SAM2Matting, arXiv:2606.27339 — 40 fps 1080p Tiny
- MatAnyone 2, arXiv:2512.11782
