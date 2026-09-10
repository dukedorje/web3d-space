# GPU sim — T4000 live stack on RunPod

Cloud stand-in for the Thor **T4000** body while the SOM is still on order. Not a replacement for the 6000 quality box. Cloud is a button; NAS stays source of truth.

## What we rented (2026-09-03)

| | T4000 (FACT, DS-11945-001) | This sim |
|---|---|---|
| GPU | Blackwell, 1536 CUDA, 6 TPC | **RTX PRO 4500 Blackwell**, sm_120, **82 SMs** (~10k CUDA est.) |
| Tensor | 5th-gen, 1200 FP4 / 600 FP8 sparse TFLOPS | 5th-gen FP4/FP8 (same generation, more of them) |
| Memory | 64 GB LPDDR5X @ 273 GB/s | 32 GB GDDR7 (~32.6 GiB reported) |
| Encode | 1× NVENC | discrete NVENC present |
| Power | 70 W default / 90 W throttle | **200 W cap, 150 W floor** — cannot `nvidia-smi -pl 90` |
| Where | SOM in the body | RunPod Secure **EU-RO-1**, `$0.72/hr` |
| Pod | — | `lduog58vatxh44` (`aicam-sim-t4000`) |

Cheapest Blackwell that was **HIGH** stock and ≥ T4000 on tensor/quant: **PRO 4500**. Cheaper FP4: PRO 4000 ($0.57, MEDIUM, 24 GB). Memory-envelope match (≥64 GB): RTX PRO 6000 Blackwell Server 96 GB at $2.09 (HIGH overall, LOW per DC).

## Local Ampere brick (fractal1)

RTX 3090 24 GB on `ssh fractal1`. HEVC pipe + FP16 nets. **Not** a T4000 TOPS proxy — no FP8/FP4, 936 GB/s vs 273, 24 GB vs 64 GB unified.

Translation table (how to read 3090 numbers as T4000) lives in the hardware repo:

`~/work/ClientProjects/AllSystemsGo/AICamera/docs/3090-SIM.md`

Short form: CUDA-core filters ×0.13 · SAM2/ViT/prefill/decode ×0.30 · FP8/NVFP4 cannot · 24 GB fit ⇒ T4000 fit · 3× 4K NVENC is a T4000 HQ fail.

## Next RunPod SKU (closer to T4000)

No SKU is 6 TPC / 273 GB/s / 70 W. Rent by which lie you are correcting:

| Job | Rent |
|---|---|
| FP8 / NVFP4 kernels (what the 3090 cannot do) | **RTX PRO 4000 Blackwell 24 GB** (~$0.57) or keep this **PRO 4500** |
| 64 GB resident set (9B + klein + SAM2) | **RTX PRO 6000 Blackwell 96 GB** (~$2.09) |
| Do not rent as a T4000 | Tesla T4, Ampere 3090/A40, Ada L40S |

Keep `lduog58vatxh44` for the `/gpu` worker. Next dedicated T4000-shaped run is PRO 4000 (quant) or PRO 6000 (envelope).

## Admin

Local only (`vite dev`). GitHub Pages SSG skips `/gpu`.

```
cd ~/work/Family/web3d-space
# RUNPOD_API_KEY in .env
npm run dev
# open /gpu
```

Copied the splat-viewer cyberpunk chrome (cyan, mono, count widget). Controls map to what RunPod actually exposes:

**REST v1** `https://rest.runpod.io/v1` — create, list, get, stop, start, restart, reset, terminate, patch, billing.

**REST v2** `https://api.runpod.io/v2` — catalog (gpus + datacenters + availability), SSE logs, runtime util on GET pod. v2 catalog 1010s without a browser User-Agent.

**GraphQL** — account balance / spend.

No native pod idle timer (that's Serverless). Auto-off is ours: default **30 min**, only `aicam-` / owned pods. Does **not** stop the negotiated training pod.

## Worker

`sim/worker/server.py` on `:8000` (RunPod HTTP proxy `https://<podId>-8000.proxy.runpod.net`).

- `GET /probes` — nvidia-smi + torch SM count / clocks / power vs T4000 envelope
- `POST /process/image` — Depth Anything V2-S + depth-band matte (rembg optional)
- `POST /process/hevc` — decode one HEVC AU, same jobs

Camera fake: `sim/camera/stream-hevc.sh` (libx265 testsrc2).

Iroh pipe: `sim/iroh-hevc` (`aicam/hevc/1` ALPN). Listen on the GPU, send from the Mac. HTTP is the bring-up path; Iroh is the product transport.

## Do not

- Do not terminate `negotiated-gpu-drafttrain-*` from this console.
- Do not treat this 32 GB card as the 64 GB unified T4000 envelope. Live stack (SAM2 + DA-V2-S + 9B) fits; co-resident 27B does not the way Thor unified would.
