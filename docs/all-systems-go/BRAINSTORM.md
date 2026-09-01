# Brainstorm residue

Planning consult ran 2026-09-01 as a **plan-shape Grok subagent**. Fable 5.1 was requested; this harness cannot spawn that slug (`spawn_subagent` only accepts grok-4.5 / grok-4.6). The consult is the brainstorming partner pass. Hardware facts also come from the MiniMax H3 / Thor shopping thread in this session.

## Decisions already taken (do not re-litigate without new evidence)

1. **Thor is the camera body.** 128 GB @ 273 GB/s, BF16 first-class, HSB/GMSL, NVENC, PVA, 40–130 W.
2. **PRO 6000 is the quality/render box.**
3. **Full BF16 H3 is not resident on one non-datacenter GPU.** One 96 GB card runs it with encoder↔DiT swap. Dual 6000 is the “both big modules on GPU” buy.
4. **H3 is not a capture model** and is **license-gated in the US** for open weights.
5. **Rooms are captured, not generated.** TRELLIS is props. Repo H6 still holds.
6. **Live overlay is depth-test, not a DiT.**
7. **NAS is source of truth.** Thor NVMe is cache.
8. **Mode switch unloads AI, never record.**

## Open questions (need measurement or a human call)

1. **sm_110 kernels.** OpenPi ships Thor TRT NVFP4 (FACT). Community H3 NVFP4 is often SM 10.0. Wan/H3 TensorRT engines are 6000-first until a Thor engine is timed.
2. **Live overlay fill-rate.** Pose is milliseconds. Composite + LPDDR contention are not measured on this kit. 720p EVF vs 4K is the first test.
3. **Audio sync.** PTP vs SMPTE vs camera TC. Product choice, not a model choice.
4. **Thermal.** 130 W body in sun, AD + overlay + 4K60 encode. SPEC whether it holds. Switcher must prefer dropping slice 1.
5. **Dual 6000 vs one 6000 + time.** 192 GB is two pools. For v1, one 96 GB card + NAS is enough to start; dual is the H3-residency / parallel dailies upgrade.
6. **Qwen3.5 vs Qwen3-VL on Jetson TensorRT.** 3.5 is the 2026 default; keep VL-8B as fallback if 3.5 TRT is late.
7. **Coordinate alignment** between Scaniverse iPhone LiDAR and Thor GMSL (repo open question).
8. **SOG vs SPZ vs `KHR_gaussian_splatting`.** PlayCanvas/SOG now; PLY as interchange.
9. **MiniMax H3 for a US artist.** API vs wait for a territorial grant vs never. Do not download weights into the NAS as a default.
10. **This repo’s name (`web3d-space`).** Product is All Systems Go. Rename is a later human call; docs already use the product name.

## Hardware thread (short)

- Comfy full H3 BF16 ~123.6 GB on disk; unconstrained serving ~112 GB host. Official resident = multi-GPU datacenter.
- Comfy local recipe ~42.5 GB quantized; 3060-class with offload.
- PRO 6000 measured (Diffusers): default 4-bit TE + BF16 DiT peak ~92 GB / ~160–185 s per 5 s 768²; true BF16 TE swap ~245 s.
- SGLang 96 GB recipe: DiT resident, encoder streamed — **unverified**.
- Thor LLM decode hits ~80–86% of 273 GB/s on Qwen3.5-27B BF16 — the hose is the wall.
