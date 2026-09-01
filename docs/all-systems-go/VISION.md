# All Systems Go — vision

A filmmaker on a location owns a **camera that thinks with them**, a **box that renders overnight**, and a **disk they can pick up and leave**. Multi-modal, spatial, artist-controlled. No cloud required.

## One line

Thor captures and calls shots. The 6000 generates and reconstructs. The NAS is the vault. This repo is the spatial canvas.

## Three boxes

| Box | Job |
|---|---|
| **Camera body** — Jetson Thor T5000 (128 GB unified, 273 GB/s, 40–130 W) | Sensors, encode, live AD, pose, overlay, snap looks |
| **Coprocessor** — RTX PRO 6000 Blackwell 96 GB (1792 GB/s; optional dual) | H3/Wan/FLUX quality, gsplat train, TRELLIS, VGGT, Cosmos |
| **NAS** | Takes, proxies, pose, prompts, LUTs, USD, splats, checkpoints |

Spark / GB10 is **not** a box in this product. Same 273 GB/s as Thor, no camera I/O, weaker live path, not an H3 quality node.

## Artist control (exit test)

Rent is payment without exit. Convenience, hosted uptime, and the 6000’s speed may go away when you stop paying for hardware. **Keys, takes, prompts, LUTs, and scenes must not.**

- Data lives on the NAS as ordinary files next to picture.
- Cloud is a button (rent a 6000, call a licensed API). Never a path.
- Default model stack prefers Apache/MIT/BSD. Restricted weights sit behind an explicit license screen.
- Unmount the NAS, take the disks, keep working.

## What this repo already is

The browser viewer: WebGPU/PlayCanvas hybrid **mesh + Gaussian splat**, dual-branch capture research (COLMAP → 3DGS appearance + photogrammetry structure), Scaniverse/LiDAR path. That becomes the spatial deliverable and the on-set monitor, not a boids demo.

Heritage of the father–son GPU lab stays in `docs/sprints/` and `docs/research/`. The product is filmmaking.

## What this is not

- Not a cloud video API with a camera glued on.
- Not “one GPU runs everything resident.”
- Not generative overlay as the live EVF (depth-test AR is live; DiTs are minutes).
- Not datacenter hardware on the truck (no H100/H200/GB300).
- Not a replacement for a DP, scripty, or boom op. AD suggests. Humans shoot.

## Success

An evening on a location: walk the space, see the virtual set in the EVF, shoot with an AD that knows the coverage, circle takes to the NAS, overnight the room as splat+mesh, and leave with the disks. If the 6000 is off, you still have picture, pose, and notes.
