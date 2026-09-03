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
