# Tasks

- [ ] Extract a frame/compute kernel from `animation-loop.ts` that
      does not import `boid-buffers`, `boid-compute`, or `boid-render`
- [ ] Keep `/boids` running on that kernel (plugin wiring)
- [ ] Unit tests: kernel start/stop/dispatch without boid-steering;
      existing `src/lib/gpu/*.test.ts` still pass

Handoffs (not boxes):

- `add-world-model` — weave sibling, disjoint write set
- `add-splat-cache` — may later copy depth; not this change
- `add-browser-canvas` — consumes the kernel
