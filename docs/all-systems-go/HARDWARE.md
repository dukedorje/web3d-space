# Hardware — four envelopes and how they switch

The live mix is designed **everything resident at 30 fps**. Same software on a local T4000 or a rented PRO 6000. fractal1’s 3090 emulates that path by swapping, slowly. A 6000 30 fps stream is a **lab result**, not a T4000 FACT — no derate from 1792 GB/s to 273. T4000 30 fps stays SPEC until Thor silicon.

## The kit

Envelope id (what the log attributes derates to) and pack id (SMALL / LARGE weights) are separate fields. Defaults below; either is overridable.

| Box | Envelope | Memory | Bandwidth | Power | Pack / residency | Role |
|---|---|---|---|---|---|---|
| **Thor T4000** | `t4000` | 64 GB LPDDR5X unified | **273 GB/s** | 70 W / 90 W throttle | SMALL, **resident** | Production body. 1× NVENC. 30 fps design target (SPEC). |
| **AGX Thor Dev Kit** | `t4000` until measured apart | 128 GB unified | **273 GB/s** | 40–130 W | SMALL, resident | Lab brick (T5000 module). Bandwidth-bound ~1× T4000; TPC-bound ×0.6; NVENC **2** not 1. |
| **fractal1 RTX 3090** | `3090` | 24 GB + 16 GB host | 936 GB/s | 350 W | SMALL, **swap** | Local pipe. Not a T4000. Not a 30 fps host. Derates in AICamera `docs/3090-SIM.md`. |
| **RunPod RTX PRO 6000 Blackwell Server 96 GB** | `6000` | 96 GB GDDR7 ECC | **1792 GB/s** | ~600 W | LARGE, **resident** | 30 fps all-perception-filters lab (~$2.09/hr). Same software as the body. |
| **Truck PRO 6000** | `6000` until measured apart | 96 GB GDDR7 ECC | **1792 GB/s** (~6.6× Thor) | 600 W | not the live mix | Quality, train, gen, offload. |
| Dual 6000 | `6000` | 192 GB as **two pools** | no NVLink | ~1.2 kW | — | Independent cards, not one 192 GB GPU |
| **NAS** | — | takes / splats / USD / ckpts | 10/25/100 GbE | — | — | Source of truth |

T4000 is the default production module. T5000 if satellite encode will not stay camera-side inside the T4000 hybrid budget (1× NVENC, HQ 2× 4Kp30). AGX Thor Developer Kit is the bring-up brick ($3,499–$5,499).

SAM 3.1 + VDA-L do **not** pack on T4000. 273 GB/s, not VRAM. LARGE weights stay on the 6000.

## Thor compute

sm_110 Blackwell, 20 SMs, `tcgen05` + TMEM, 2,560 CUDA cores @ 1.575 GHz. Tensor cores: BF16 / FP16 ~258 TFLOPS, FP8 ~517 dense / 1035 sparse, FP4 ~1035 dense / 2070 sparse, INT8, TF32. FP32 CUDA ~8 TFLOPS. TensorRT CC 11.0 lists all of those precisions as supported.

BF16 is first-class. DiTs still do not belong on the body because of **273 GB/s**, not missing datatypes. No DLA (Orin had it; Thor does not).

## What “full H3” needs

Native BF16, one task (FL2VA **or** Ref2VA): ~108–144 GB weights (DiT 62–66 + encoder 46–67 + VAE 5–11).

- No single non-datacenter GPU holds that resident. Largest workstation card is **96 GB**.
- **One PRO 6000** runs full-quality H3 by **swapping** encoder and DiT (measured: BF16 TE path ~245 s/request at 768²; default 4-bit TE + BF16 DiT ~160–185 s, peak ~92 GB).
- **Two PRO 6000s** can keep encoder + DiT + VAE on GPUs (~144 GB in 192 GB) over PCIe, not NVLink. Not tensor-parallel BF16.
- Thor’s 128 GB unified pool does not hold BF16 H3 resident either (~121 GB usable). H3 stays on the 6000.

H3 open weights currently **exclude US / EU / UK / KR**. For a US artist, default local video is Wan 2.2 + Hunyuan 1.5 + Cosmos. H3 is a license-gated extra (or MiniMax API).

## Mode switching

Thor’s 128 GB is a **capacity** trap. Design the **resident set ≤ ~40 GB** so encode, SLAM, and a VLM never page. Quota by **GB/s**, not GB.

### Thor co-resident (camera day)

Always:

- NVENC/NVDEC + ring buffer + NAS writer
- cuVSLAM + IMU
- SAM2 **or** Maxine body (not both at 4K until measured)
- Depth Anything V2-S on leftover GPU/PVA

Pick **one** optional:

| Profile | Resident extra | Unload |
|---|---|---|
| AD | Qwen3.5-9B (~7–12 GB) | — |
| AD heavy | Qwen3.5-27B (~24 GB) | klein snap |
| Snap | FLUX.2 klein 4B (~10 GB) | 27B |
| AR overlay | mesh occluders + low splat | klein + 27B; keep 9B if AD talks |

**Never resident on Thor:** H3, Wan 14B, Hunyuan, Cosmos-Transfer 65 GB, FLUX.2 [dev] BF16, room-scale gsplat densify, TRELLIS.2 1536³.

### Always offload to the 6000

Any video DiT; FLUX.2 [dev]; gsplat / 4DGS / COLMAP / VGGT-heavy / TRELLIS.2; batch dailies.

Dual 6000: Card A gen/train, card B TE / second job / review. Sequential offload or pipeline split. Not one 192 GB device.

### NAS write-through (every mode)

Takes, proxies, pose JSON, SAM2 ids, prompts, LUT, USD, checkpoints, circled-take flags. Thor NVMe is cache. The 6000 reads the NAS, never Thor’s disk as source of truth.

## Why the 6000 is the quality box

Not because 96 > 128. Because **1792 GB/s**, 4× NVENC, and sm_120 kernels. A 21–66 GB DiT is a compute problem there and a copy problem on Thor.
