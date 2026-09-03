#!/usr/bin/env bash
# Simulate a T4000-class HEVC contribution encode and push it.
#
# HTTP (default): POST short GOPs to the sim worker.
# Iroh: pipe Annex-B to `iroh-hevc send <ticket>` once the sidecar is up.
set -euo pipefail

URL="${1:-https://lduog58vatxh44-8000.proxy.runpod.net/process/hevc}"
SIZE="${SIZE:-1920x1080}"
FPS="${FPS:-30}"
BITRATE="${BITRATE:-8M}"

if ! command -v ffmpeg >/dev/null; then
  echo "ffmpeg required" >&2
  exit 1
fi

tmp=$(mktemp /tmp/aicam-hevc-XXXX.hevc)
trap 'rm -f "$tmp"' EXIT

ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "testsrc2=size=${SIZE}:rate=${FPS}:duration=2" \
  -c:v libx265 -pix_fmt yuv420p -x265-params "log-level=error" \
  -b:v "$BITRATE" -f hevc "$tmp"

echo "POST $(wc -c < "$tmp") bytes ${SIZE}@${FPS} -> $URL"
curl -sS -F "file=@${tmp};type=video/hevc" -D - -o /tmp/aicam-out.png "$URL"
echo "wrote /tmp/aicam-out.png"
