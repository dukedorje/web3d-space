# Hardware — three boxes and how they switch

## The kit

| Box | Memory | Bandwidth | Power | Role |
|---|---|---|---|---|
| **Jetson Thor T5000** | 128 GB LPDDR5X unified | **273 GB/s** | 40–130 W | Camera, AD, live overlay, encode |
| **RTX PRO 6000 Blackwell** | 96 GB GDDR7 ECC | **1792 GB/s** (~6.6× Thor) | 600 W | Quality, train, gen, offload |
| Dual 6000 | 192 GB as **two pools** | no NVLink | ~1.2 kW | Independent cards, not one 192 GB GPU |
| **NAS** | takes / splats / USD / ckpts | 10/25/100 GbE | — | Source of truth |

T4000 is the same **273 GB/s**, 64 GB, 70 W, 1× NVENC. Use it if the AD is 8–32B and the body must stay cooler. T5000 if you want 70B-class AD and 2× NVENC.

AGX Thor Developer Kit is the bring-up brick ($3,499–$5,499). Production is a T5000 SOM on a carrier with GMSL/HSB.

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
