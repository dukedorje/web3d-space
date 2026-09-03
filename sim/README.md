# T4000 sim (camera → RunPod)

Bring-up path is **HEVC over HTTP** to the worker on `:8000`. Product transport is **Iroh** (`sim/iroh-hevc`, ALPN `aicam/hevc/1`).

```sh
# worker is already on the rented PRO 4500 (EU-RO-1)
./camera/stream-hevc.sh https://<podId>-8000.proxy.runpod.net/process/hevc
```

`GET /probes` reports SM count, clocks, power vs the T4000 70/90 W envelope. The PRO 4500 cannot cap below 150 W.

Admin UI: `/gpu` in this app (`vite dev`). Auto-off only runs while that server is up.
