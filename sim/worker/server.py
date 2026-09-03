#!/usr/bin/env python3
"""T4000-class live-stack sim worker.

Probes NVIDIA SMI / torch, then runs the first two Thor-day vision jobs:
Depth Anything V2-S and a depth-gated background matte (rembg if installed).

HTTP:
  GET  /health
  GET  /probes
  POST /process/image   multipart file=frame  optional near_m far_m
  POST /process/hevc    raw HEVC Annex-B (one AU or short GOP)
  POST /power-cap       json {watts}
"""

from __future__ import annotations

import io
import json
import os
import subprocess
import time
from typing import Any

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import JSONResponse, Response
from PIL import Image

T4000 = {
    "cuda_cores": 1536,
    "sm_clock_ghz": 1.53,
    "memory_gb": 64,
    "bandwidth_gbs": 273,
    "tdp_w": 70,
    "throttle_w": 90,
    "tensor": "5th-gen FP4/FP8",
    "nvenc": 1,
    "nvdec": 1,
}

app = FastAPI(title="aicam-t4000-sim")
_models: dict[str, Any] = {}
_last_job: dict[str, Any] = {}


def _smi_query(query: str) -> str:
    out = subprocess.check_output(
        ["nvidia-smi", f"--query-gpu={query}", "--format=csv,noheader,nounits"],
        text=True,
    )
    return out.strip().splitlines()[0].strip()


def _smi_q() -> dict[str, Any]:
    fields = (
        "name,uuid,compute_cap,utilization.gpu,utilization.memory,"
        "memory.used,memory.total,temperature.gpu,power.draw,power.limit,"
        "power.min_limit,power.max_limit,clocks.sm,clocks.max.sm,"
        "clocks.mem,encoder.stats.sessionCount,clocks.gr"
    )
    keys = [
        "name",
        "uuid",
        "compute_cap",
        "util_gpu",
        "util_mem",
        "mem_used_mb",
        "mem_total_mb",
        "temp_c",
        "power_w",
        "power_limit_w",
        "power_min_w",
        "power_max_w",
        "clock_sm_mhz",
        "clock_sm_max_mhz",
        "clock_mem_mhz",
        "encoder_sessions",
        "clock_gr_mhz",
    ]
    vals = [v.strip() for v in _smi_query(fields).split(",")]
    row = dict(zip(keys, vals, strict=False))
    for k in (
        "util_gpu",
        "util_mem",
        "mem_used_mb",
        "mem_total_mb",
        "temp_c",
        "power_w",
        "power_limit_w",
        "power_min_w",
        "power_max_w",
        "clock_sm_mhz",
        "clock_sm_max_mhz",
        "clock_mem_mhz",
        "encoder_sessions",
        "clock_gr_mhz",
    ):
        try:
            row[k] = float(row[k])
        except (KeyError, ValueError):
            pass
    return row


def _torch_props() -> dict[str, Any]:
    import torch

    if not torch.cuda.is_available():
        return {"cuda": False}
    p = torch.cuda.get_device_properties(0)
    return {
        "cuda": True,
        "torch": torch.__version__,
        "name": p.name,
        "compute_capability": f"{p.major}.{p.minor}",
        "total_memory_bytes": p.total_memory,
        "multi_processor_count": p.multi_processor_count,
        "max_threads_per_sm": p.max_threads_per_multi_processor,
        "warp_size": p.warp_size,
        "fp16": True,
        "bf16": torch.cuda.is_bf16_supported(),
        # sm_120 / sm_110 expose FP8/FP4 tensor cores; torch does not count them.
        "tensor_cores": "5th-gen (Blackwell) — FP4/FP8 present",
        "cuda_cores_est": p.multi_processor_count * 128,
    }


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "role": os.environ.get("AICAM_ROLE", "t4000-sim")}


@app.get("/probes")
def probes() -> dict[str, Any]:
    smi = _smi_q()
    torch_p = _torch_props()
    power_min = smi.get("power_min_w")
    return {
        "t4000": T4000,
        "smi": smi,
        "torch": torch_p,
        "envelope": {
            "t4000_tdp_w": T4000["tdp_w"],
            "t4000_throttle_w": T4000["throttle_w"],
            "card_min_w": power_min,
            "can_cap_to_t4000": isinstance(power_min, (int, float)) and power_min <= T4000["throttle_w"],
            "note": "PRO 4500 floors at 150 W; cannot nvidia-smi -pl 90.",
        },
        "last_job": _last_job,
        "models_loaded": list(_models),
    }


@app.post("/power-cap")
def power_cap(body: dict[str, Any]) -> dict[str, Any]:
    watts = int(body.get("watts", 150))
    try:
        subprocess.check_output(["nvidia-smi", "-pl", str(watts)], text=True)
        return {"ok": True, "watts": watts, "smi": _smi_q()}
    except subprocess.CalledProcessError as e:
        return JSONResponse({"ok": False, "error": e.output or str(e)}, status_code=400)


def _load_depth():
    if "depth" in _models:
        return _models["depth"]
    import torch
    from transformers import AutoImageProcessor, AutoModelForDepthEstimation

    name = os.environ.get("DEPTH_MODEL", "depth-anything/Depth-Anything-V2-Small-hf")
    proc = AutoImageProcessor.from_pretrained(name)
    model = AutoModelForDepthEstimation.from_pretrained(name).to("cuda" if torch.cuda.is_available() else "cpu")
    model.eval()
    _models["depth"] = (proc, model)
    return _models["depth"]


def _depth(img: Image.Image) -> Image.Image:
    import torch
    import numpy as np

    proc, model = _load_depth()
    device = next(model.parameters()).device
    inputs = proc(images=img, return_tensors="pt")
    inputs = {k: v.to(device) for k, v in inputs.items()}
    with torch.no_grad():
        out = model(**inputs)
        pred = out.predicted_depth
    pred = torch.nn.functional.interpolate(
        pred.unsqueeze(1),
        size=img.size[::-1],
        mode="bicubic",
        align_corners=False,
    ).squeeze()
    arr = pred.float().cpu().numpy()
    arr = (arr - arr.min()) / (arr.max() - arr.min() + 1e-8)
    return Image.fromarray((arr * 255).astype(np.uint8))


def _matte(img: Image.Image, depth: Image.Image, near: float, far: float) -> Image.Image:
    import numpy as np

    d = np.array(depth).astype("float32") / 255.0
    mask = ((d >= near) & (d <= far)).astype("uint8") * 255
    rgba = img.convert("RGBA")
    rgba.putalpha(Image.fromarray(mask))
    return rgba


def _rembg(img: Image.Image) -> Image.Image | None:
    try:
        from rembg import remove
    except ImportError:
        return None
    out = remove(img)
    if isinstance(out, Image.Image):
        return out
    return Image.open(io.BytesIO(out)).convert("RGBA")


@app.post("/process/image")
async def process_image(
    file: UploadFile = File(...),
    near: float = Form(0.15),
    far: float = Form(0.85),
):
    t0 = time.perf_counter()
    raw = await file.read()
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    depth = _depth(img)
    selected = _matte(img, depth, near, far)
    bg = _rembg(img)
    buf = io.BytesIO()
    (bg or selected).save(buf, format="PNG")
    elapsed_ms = (time.perf_counter() - t0) * 1000
    _last_job.update(
        {
            "kind": "image",
            "ms": round(elapsed_ms, 2),
            "size": img.size,
            "near": near,
            "far": far,
            "rembg": bg is not None,
            "smi": _smi_q(),
        }
    )
    return Response(
        content=buf.getvalue(),
        media_type="image/png",
        headers={"X-Aicam-Ms": f"{elapsed_ms:.1f}", "X-Aicam-Rembg": str(bg is not None).lower()},
    )


def _decode_hevc(blob: bytes) -> Image.Image:
    import av

    container = av.open(io.BytesIO(blob), format="hevc")
    for frame in container.decode(video=0):
        return frame.to_image()
    raise RuntimeError("no video frame in HEVC blob")


@app.post("/process/hevc")
async def process_hevc(file: UploadFile = File(...), near: float = Form(0.15), far: float = Form(0.85)):
    blob = await file.read()
    t0 = time.perf_counter()
    img = _decode_hevc(blob)
    depth = _depth(img)
    selected = _matte(img, depth, near, far)
    buf = io.BytesIO()
    selected.save(buf, format="PNG")
    elapsed_ms = (time.perf_counter() - t0) * 1000
    _last_job.update({"kind": "hevc", "bytes": len(blob), "ms": round(elapsed_ms, 2), "smi": _smi_q()})
    return Response(content=buf.getvalue(), media_type="image/png", headers={"X-Aicam-Ms": f"{elapsed_ms:.1f}"})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
