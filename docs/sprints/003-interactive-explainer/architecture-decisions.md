---
sprint: sprint-003
phase: 2A
created: 2026-04-10
decisions: 5
status: proposed
---

# Architecture Decisions -- Sprint 003

## D-012: Pure Svelte Components (Not mdsvex) for Maximum Interactivity

**Significance**: HIGH

**Context**: The explainer page mixes prose with interactive Canvas 2D demos, sliders, toggles, and dynamic state. mdsvex is configured in the project and could render `.svx` files mixing Markdown with Svelte components. The question is whether sections should be `.svx` files or pure `.svelte` components.

**Options**:

| Option | Pros | Cons |
|--------|------|------|
| **A: Pure Svelte components** -- Each section is a `.svelte` file under `src/lib/components/explainer/`. Prose is written as HTML with Tailwind typography classes. | Full control over interactivity, layout, and state. No Markdown parser in the render path. Component props are fully typed. Easy to co-locate Canvas setup with prose. | More verbose for prose-heavy sections (HTML instead of Markdown). No Markdown shortcuts for lists, code blocks, etc. |
| **B: mdsvex `.svx` files** -- Each section is an `.svx` file that imports interactive Svelte components inline. | Cleaner prose authoring. Markdown shortcuts reduce boilerplate. | Svelte components inside mdsvex have limited reactive context. Difficult to share state between prose and embedded demos. mdsvex compilation adds a build step. Harder to type-check. |

**Decision**: **Option A** -- Pure Svelte components.

The explainer page is demo-first, not prose-first. Every section has interactive elements tightly coupled to component state (Canvas refs, slider values, toggle states). Writing prose as HTML in a Svelte component is slightly more verbose but gives complete control. The Tailwind `prose` class handles typography.

**Consequences**:
- All 10 topic sections are `.svelte` files in `src/lib/components/explainer/`
- mdsvex remains available for other pages but is not used here
- Prose styling uses Tailwind's `@tailwindcss/typography` plugin (Growth tier, can use manual Tailwind classes for MVP)

---

## D-013: Shiki for Syntax Highlighting with WGSL Grammar, Dynamic Import

**Significance**: MEDIUM

**Context**: The explainer page displays WGSL and TypeScript code snippets (FR14, FR32, FR33). These must be syntax-highlighted. Shiki is a popular choice that supports TextMate grammars and produces pre-colored HTML (no runtime JS needed after highlighting).

**Options**:

| Option | Pros | Cons |
|--------|------|------|
| **A: Shiki with dynamic import** -- Load Shiki asynchronously on first code block render. Use built-in WGSL grammar if available, or load GLSL as fallback. | Rich syntax highlighting. No main-bundle cost. Pre-rendered HTML after highlight. Supports WGSL natively (Shiki includes it). | First code block has a loading delay (~200-500ms). ~2MB lazy-loaded. |
| **B: Prism.js** -- Lightweight syntax highlighter with plugin architecture. | Smaller bundle. Familiar API. | No built-in WGSL support. Prism is effectively unmaintained. Requires custom grammar for WGSL. |
| **C: No highlighting (preformatted text)** -- Display code in `<pre><code>` with monospace font only. | Zero dependency. Instant render. | Poor readability for shader code. Does not meet the educational goal. |

**Decision**: **Option A** -- Shiki with dynamic import.

Shiki includes a WGSL grammar in its bundled languages. Dynamic import via `import('shiki')` keeps it out of the initial bundle. Code blocks show a loading skeleton until Shiki resolves, then render highlighted HTML. Use `requestIdleCallback` to pre-warm Shiki after initial page paint.

**Consequences**:
- Create a shared `CodeBlock.svelte` component that accepts `code: string` and `lang: 'wgsl' | 'typescript'`
- Shiki loaded once, cached in module scope
- Loading state shows a `<pre>` with monospace text (still readable, just uncolored)
- WGSL grammar confirmed available in Shiki's bundled languages

---

## D-014: 2D Canvas for All Educational Demos (No WebGPU Dependency)

**Significance**: HIGH

**Context**: The explainer page needs interactive visualizations for boid rules, neighbor queries, memory layout, double buffering, and more. The main simulation uses WebGPU, but the explainer targets readers who may not have WebGPU-capable browsers.

**Options**:

| Option | Pros | Cons |
|--------|------|------|
| **A: Canvas 2D for all demos** -- Every interactive visualization uses the Canvas 2D API. Boid simulations run in JS on the CPU with 30-50 boids. | Works in every modern browser. No GPU initialization overhead. Simple API for 2D diagrams. Keeps demos independent from the main simulation code. | Cannot show 3D effects. Limited to ~100 boids at 60fps in JS. |
| **B: WebGPU for demos** -- Reuse the existing GPU pipeline for explainer demos. | Accurate representation of the real simulation. Could show more boids. | Requires WebGPU browser. Couples the explainer to GPU initialization. Defeats the educational purpose (demos should be simple). |
| **C: SVG for diagrams, Canvas for simulations** -- Static diagrams in SVG, interactive simulations in Canvas 2D. | SVG is resolution-independent and accessible. Good for static diagrams. | Two rendering approaches to maintain. SVG animation performance is poor for boid-like simulations. |

**Decision**: **Option A** -- Canvas 2D for everything.

Canvas 2D is the right tool for educational demos. It is universally supported, has a simple imperative API, and forces the demos to be simple (which is the point). The 30-50 boid limit for interactive demos is a feature, not a constraint -- it keeps the visualizations readable.

**Consequences**:
- All demos use `<canvas>` elements with `getContext('2d')`
- A shared `createCanvasDemo()` utility handles: canvas setup, resize, animation loop start/stop via `$effect`, IntersectionObserver integration
- No `src/lib/gpu/` imports for rendering -- only for type references and `?raw` shader source
- Static diagrams (pipeline, memory layout) are drawn programmatically on Canvas, not SVG

---

## D-015: IntersectionObserver Lazy-Init for All Animated Demos

**Significance**: MEDIUM

**Context**: The explainer page has 7+ animated Canvas demos. Running all animation loops simultaneously wastes CPU and battery. Only visible demos should animate.

**Options**:

| Option | Pros | Cons |
|--------|------|------|
| **A: IntersectionObserver per demo** -- Each demo component observes its own canvas element. Animation loop starts when visible, pauses when not. | Fine-grained control. Each component is self-contained. Standard browser API. | Slightly more code per component (mitigated by shared utility). |
| **B: Global scroll listener** -- A single scroll handler checks all demo positions. | Single listener. | Manual position calculation. Scroll handler fires frequently. Less precise than IntersectionObserver. |

**Decision**: **Option A** -- IntersectionObserver per demo.

Each demo component uses `IntersectionObserver` via the shared `createCanvasDemo()` utility. The observer starts the `requestAnimationFrame` loop when the canvas enters the viewport (with a small margin) and cancels it when it leaves. This enforces NFR1's "no more than 3 simultaneous loops" naturally -- only 2-3 demos are visible at once in a scrolling layout.

**Consequences**:
- `createCanvasDemo()` returns `{ canvas, ctx, start, stop, isVisible }` and manages the observer internally
- Demo components call `start()` with their draw function; the utility handles the rAF loop
- Cleanup in `$effect` teardown destroys the observer and cancels any pending rAF
- NFR1 compliance is achieved by viewport visibility, not by an explicit counter

---

## D-016: Component Structure -- Each Topic as a Svelte Component

**Significance**: MEDIUM

**Context**: The PRD defines 10 topic sections. NFR4 requires each section to be a separate Svelte component under `src/lib/components/explainer/`. The route page composes them.

**Decision**: AUTO-DECIDED per NFR4.

**Component tree**:

```
src/lib/components/explainer/
  TopicGpu.svelte              -- Section 1: What Is a GPU?
  TopicWebgpuPipeline.svelte   -- Section 2: The WebGPU Pipeline
  TopicBoidRules.svelte        -- Section 3: Boid Rules
  TopicMemoryLayout.svelte     -- Section 4: Memory Layout
  TopicDoubleBuffering.svelte  -- Section 5: Double Buffering
  TopicComputeShader.svelte    -- Section 6: The Compute Shader
  TopicNeighborQueries.svelte  -- Section 7: Neighbor Queries
  TopicRendering.svelte        -- Section 8: Rendering
  TopicCamera.svelte           -- Section 9: The Camera
  TopicPersonalities.svelte    -- Section 10: Personalities and Stress
  CodeBlock.svelte             -- Shared: Shiki syntax highlighting wrapper
  StickyNav.svelte             -- Shared: Sticky table-of-contents navigation
  CanvasDemo.svelte            -- Shared: Canvas 2D demo wrapper with IntersectionObserver
```

The route page at `src/routes/how-it-works/+page.svelte` imports all topic components, renders them in order, and passes section metadata to `StickyNav`.

**Consequences**:
- ~13 new Svelte files + 1 route file
- No component exceeds 400 lines (NFR4)
- Shared utilities (`CodeBlock`, `CanvasDemo`, `StickyNav`) are reusable
- Topic components import from `$lib/gpu/` only for types and `?raw` shader source
