---
sprint: sprint-003
phase: 2B
created: 2026-04-10
epics: 5
stories: 20
status: proposed
---

# Epics & Stories -- Sprint 003: Interactive Explainer Page

---

## Epic 1: Page Foundation & Navigation

**Goal**: Establish the `/how-it-works` route, page layout, shared utilities (Canvas demo wrapper, code block component), and sticky table-of-contents navigation.

**Dependencies**: None (foundational epic)
**FRs**: FR1, FR2, FR3, FR35, FR40 (partial)
**Decisions**: D-012, D-014, D-015, D-016

---

### S1.1: Route Setup, Page Layout, and Shared Canvas Demo Utility

**User story**: As a reader, I want to navigate to `/how-it-works` and see a well-structured page layout with placeholder sections so that the explainer page exists and is reachable.

**FRs**: FR1, FR2 (partial), FR35
**Architecture decisions**: D-012, D-014, D-015, D-016
**Complexity**: Medium
**Test tier**: Thorough

**Acceptance criteria**:

```gherkin
Given a user navigates to /how-it-works
When the page loads
Then 10 section headings are visible in order (What Is a GPU? through Personalities and Stress)
And each section has an HTML id anchor matching its heading slug

Given the page loads in a browser without WebGPU support
When the user scrolls through all sections
Then no errors appear in the console related to WebGPU or GPU initialization

Given a developer imports createCanvasDemo from the shared utility
When they pass a draw function and a canvas element ref
Then the utility returns start/stop controls and manages the rAF loop
And the rAF loop only runs when the canvas is visible (IntersectionObserver)
And cleanup on $effect teardown cancels the rAF and disconnects the observer
```

**Scope boundaries**:
- DOES: Create `src/routes/how-it-works/+page.svelte`, create all 10 topic component stubs under `src/lib/components/explainer/`, create `CanvasDemo.svelte` wrapper or `createCanvasDemo()` utility, set up IntersectionObserver pattern
- DOES NOT: Implement any interactive demos (those are E2-E4), implement sticky nav (S1.2), add Shiki (S1.3)

**Technical notes**:
- Route page imports 10 topic components and renders them in sequence inside a `<main>` container
- Each topic stub has a heading, placeholder prose, and an empty `<section>` with the correct `id`
- `createCanvasDemo()` utility in `src/lib/components/explainer/canvas-utils.ts`:
  - Accepts: `canvas: HTMLCanvasElement`, `draw: (ctx: CanvasRenderingContext2D, dt: number) => void`, `options?: { width?: number, height?: number }`
  - Returns: `{ start(): void, stop(): void, isVisible: boolean }`
  - Manages IntersectionObserver internally with 100px root margin
  - Sets explicit canvas width/height before first draw (NFR5)
- Svelte 5 pattern: `$effect(() => { const demo = createCanvasDemo(...); return () => demo.stop(); })`

---

### S1.2: Sticky Table-of-Contents Navigation

**User story**: As a reader, I want a persistent navigation sidebar so that I can jump to any section and know where I am on the page.

**FRs**: FR3
**Architecture decisions**: D-016
**Complexity**: Medium
**Test tier**: Smoke

**Acceptance criteria**:

```gherkin
Given the user is on /how-it-works on a desktop viewport (>=1024px)
When the page renders
Then a sticky sidebar appears on the left with 10 navigation links (one per section)
And clicking any link scrolls smoothly to the corresponding section

Given the user scrolls past section 3 into section 4
When the sidebar updates
Then the "Memory Layout" link is visually highlighted as the current section

Given the user is on a viewport below 1024px
When the page renders
Then the sidebar collapses into a top-bar or hamburger-accessible navigation
And the navigation links still function correctly
```

**Scope boundaries**:
- DOES: Create `StickyNav.svelte` component, implement scroll-spy via IntersectionObserver on section headings, smooth-scroll on click, responsive collapse
- DOES NOT: Implement reading progress bar (FR4, Growth), add "How It Works" link to the boids page (S5.3)

**Technical notes**:
- `StickyNav` receives `sections: Array<{ id: string, title: string }>` as a prop
- Scroll spy: one IntersectionObserver watches all section elements; the topmost intersecting section is "active"
- Desktop: `position: sticky; top: 2rem` in a CSS grid sidebar column
- Mobile: Tailwind responsive classes to switch from sidebar to collapsible top nav
- Active link styling: bold text + left border accent (Tailwind classes)

---

### S1.3: Shared Code Block Component (Shiki Setup)

**User story**: As a reader, I want code snippets to be syntax-highlighted so that shader and TypeScript code is readable and color-coded.

**FRs**: FR32, FR33
**Architecture decisions**: D-013
**Complexity**: Medium
**Test tier**: Smoke

**Acceptance criteria**:

```gherkin
Given a CodeBlock component receives WGSL source code and lang="wgsl"
When the component renders
Then the code is displayed in a monospace pre block immediately (uncolored)
And Shiki loads asynchronously in the background
And once Shiki resolves, the code block updates to show syntax-highlighted HTML

Given Shiki has not yet loaded
When the user scrolls to a code block
Then the raw code text is visible and readable (not blank)

Given a CodeBlock receives shader source imported via ?raw
When the page builds
Then the code content matches the actual file at build time (no manual copy)
```

**Scope boundaries**:
- DOES: Create `CodeBlock.svelte`, implement Shiki dynamic import with module-level caching, support `wgsl` and `typescript` languages, show loading fallback
- DOES NOT: Implement line-by-line step-through (FR15, Growth), implement render shader annotations (FR19, Growth)

**Technical notes**:
- `CodeBlock.svelte` props: `code: string`, `lang: 'wgsl' | 'typescript'`, `title?: string`
- Shiki loaded once via `import('shiki').then(s => s.createHighlighter({ langs: ['wgsl', 'typescript'], themes: ['github-dark'] }))`, cached in a module-scope promise
- Loading state: render `<pre><code>{code}</code></pre>` with Tailwind monospace classes
- Post-highlight: replace inner HTML with Shiki output using `{@html highlightedHtml}`
- Pre-warm on idle: `requestIdleCallback(() => loadShiki())` called from the route page on mount
- Verify Shiki includes WGSL grammar at implementation time; if not, use `glsl` as fallback

---

## Epic 2: Core Concept Demos -- GPU & Boids

**Goal**: Build the interactive demos for Sections 1-4: CPU vs GPU parallelism, WebGPU pipeline diagram, the star 2D boid demo with toggleable rules, and memory layout diagrams.

**Dependencies**: E1 (route, layout, canvas utility must exist)
**FRs**: FR5, FR6, FR8, FR9, FR10, FR11, FR12, FR29, FR30
**Decisions**: D-014

---

### S2.1: CPU vs GPU Parallelism Visualization (Section 1)

**User story**: As a teenager who has never heard of a GPU, I want to see a visual comparison of doing tasks one-at-a-time vs all-at-once so that I understand why GPUs matter.

**FRs**: FR5, FR34
**Architecture decisions**: D-014
**Complexity**: Medium
**Test tier**: Smoke

**Acceptance criteria**:

```gherkin
Given the Section 1 component renders
When the user sees the demo
Then there is a slider labeled "Task Count" with range 1-1000
And there are two side-by-side Canvas panels labeled "CPU (Sequential)" and "GPU (Parallel)"

Given the user sets task count to 100 and clicks "Run"
When the CPU panel animates
Then tasks complete one at a time in visible sequence (left to right or top to bottom)
And the GPU panel shows all 100 tasks completing simultaneously
And the time difference is visually obvious

Given the user adjusts the slider from 100 to 500
When they click "Run" again
Then the CPU side takes visibly longer while the GPU side takes roughly the same time
```

**Scope boundaries**:
- DOES: Build `TopicGpu.svelte` with prose explaining "What is a GPU?", Canvas 2D demo with task-count slider, sequential vs parallel animation, define "GPU", "CPU", "parallel" on first use
- DOES NOT: Explain WebGPU specifically (that is Section 2), show actual GPU compute timing

**Technical notes**:
- Tasks represented as small colored rectangles in a grid
- CPU animation: fill rectangles one by one with a delay (e.g., 5ms per task via rAF-based counter)
- GPU animation: fill all rectangles in one frame (or a fast sweep of 2-3 frames)
- Use `createCanvasDemo()` for the animation loop; run only when visible
- Canvas size: 400x200 per panel (800x200 total), or stacked on narrow viewports
- Prose section above the demo: 3-4 paragraphs, kid-friendly language, define GPU/CPU on first use

---

### S2.2: WebGPU Pipeline Diagram (Section 2)

**User story**: As a reader, I want to see how data flows from JavaScript to the GPU so that I understand the pipeline the boid simulation uses.

**FRs**: FR6, FR34
**Architecture decisions**: D-014
**Complexity**: Small
**Test tier**: Yolo

**Acceptance criteria**:

```gherkin
Given the Section 2 component renders
When the user views the diagram
Then a labeled data-flow diagram shows: JavaScript -> Command Buffers -> GPU Queue -> Compute Pass -> Render Pass -> Screen
And each stage has a brief label and connecting arrows

Given the user hovers over a pipeline stage
When the tooltip appears
Then it shows a 1-2 sentence explanation of what that stage does

Given the prose section is read
When technical terms "command buffer", "GPU queue", "compute pass", "render pass" appear
Then each term is defined inline on first use
```

**Scope boundaries**:
- DOES: Build `TopicWebgpuPipeline.svelte` with a Canvas 2D or HTML/CSS pipeline diagram, hover tooltips, prose explaining the pipeline, snapshot bridge mention (FR29 partial)
- DOES NOT: Show live WebGPU browser check (FR7, Growth), implement frame loop diagram (FR31, Growth)

**Technical notes**:
- Diagram can be HTML/CSS boxes with Tailwind styling + arrows (simpler than Canvas for a static diagram)
- Alternatively: Canvas 2D with labeled rectangles and arrow paths
- Hover/click on a stage highlights it and shows a tooltip div
- Prose: explain what WebGPU is, why the simulation uses it, what the pipeline stages do
- Reference: the pipeline matches the actual code flow in `animation-loop.ts` -> `boid-compute.ts` -> `boid-render.ts`

---

### S2.3: Interactive 2D Boid Demo with Toggleable Rules (Section 3)

**User story**: As a reader, I want to toggle separation, alignment, and cohesion on and off and watch the boids change behavior so that I understand what each steering rule does.

**FRs**: FR8, FR9, FR10, FR34
**Architecture decisions**: D-014
**Complexity**: Large
**Test tier**: Thorough

**Acceptance criteria**:

```gherkin
Given the Section 3 boid demo renders with ~30 boids
When the user unchecks "Cohesion"
Then boids stop clustering and drift apart over several seconds
And the force vector overlay on the highlighted boid no longer shows a cohesion arrow

Given all three rules are enabled
When the user observes the highlighted boid
Then three labeled force vectors are drawn: a red arrow for separation, a green arrow for alignment, and a blue arrow for cohesion
And each arrow's length reflects the force magnitude

Given the user adjusts the separation weight slider from 1.5 to 5.0
When the simulation updates
Then boids spread out noticeably more
And the separation force vector on the highlighted boid grows longer

Given the user disables all three rules
When the simulation runs
Then boids drift in straight lines without steering (only boundary wrapping)

Given the demo canvas is scrolled out of viewport
When the user scrolls away
Then the animation loop pauses (IntersectionObserver)
And when scrolled back into view, the animation resumes
```

**Scope boundaries**:
- DOES: Implement a complete 2D boid steering simulation in JavaScript/Canvas 2D with ~30 boids, three toggle checkboxes, three weight sliders, force vector overlay on one highlighted boid, boundary wrapping, define "separation", "alignment", "cohesion", "boid", "steering" on first use
- DOES NOT: Implement personality types (that is E4), implement neighbor query visualization (S3.2), exceed 50 boids

**Technical notes**:
- 2D boid state: `{ x, y, vx, vy }` -- simple 2D vectors, no z-axis
- Steering algorithm: standard Reynolds rules adapted to 2D
  - Separation: steer away from nearby boids within separation radius
  - Alignment: steer toward average heading of nearby boids
  - Cohesion: steer toward center of mass of nearby boids
- Perception radius: fixed at ~80px for the demo canvas (adjustable later)
- Force vectors: draw colored arrows from the highlighted boid's center in the direction of each force, scaled by magnitude
- Highlighted boid: boid index 0 (or click-to-select within the demo canvas)
- Canvas size: 500x400 or responsive within container
- Wrap at canvas edges (toroidal)
- Use `createCanvasDemo()` utility for the animation loop

---

### S2.4: Memory Layout Diagrams (Section 4)

**User story**: As a reader, I want to see how boid data is packed into GPU memory so that I understand what a struct is and why byte alignment matters.

**FRs**: FR11, FR12, FR30, FR34
**Architecture decisions**: D-014
**Complexity**: Medium
**Test tier**: Smoke

**Acceptance criteria**:

```gherkin
Given the Section 4 component renders
When the user views the BoidState diagram
Then a horizontal byte-level diagram shows fields: position (vec3f, 12 bytes), _pad0 (4 bytes), velocity (vec3f, 12 bytes), _pad1 (4 bytes), padding (16 bytes)
And each field block displays its byte offset and data type
And hovering a field highlights it and shows a tooltip with the field's purpose

Given the user views the BoidConfig diagram
When all 12 fields are displayed
Then each field shows: name, type (f32 or u32), byte offset (0-44), and a brief description
And the personalityType field is visually marked as u32 (different color from f32 fields)

Given the prose section explains buffer recreation
When the user reads it
Then the explanation covers: why buffers are destroyed when boid count changes, how createBoidBuffers works, and the ping-pong pattern
```

**Scope boundaries**:
- DOES: Build `TopicMemoryLayout.svelte` with two interactive struct diagrams (BoidState + BoidConfig), hover tooltips, prose on buffer lifecycle (FR30), define "struct", "byte offset", "padding", "alignment" on first use
- DOES NOT: Show the actual buffer creation code (that is the compute shader section), implement the double-buffer animation (that is S2.5 / Section 5)

**Technical notes**:
- Struct layouts sourced from `boid-buffers.ts` constants (BYTES_PER_BOID=48, BYTES_PER_CONFIG=48) and comments
- BoidState layout: `[px(f32) py(f32) pz(f32) _pad0(f32) vx(f32) vy(f32) vz(f32) _pad1(u32) _pad2(f32) _pad3(f32) _pad4(f32) _pad5(f32)]`
- BoidConfig layout per D-008: 12 fields at 4-byte intervals, 48 bytes total
- Diagram: horizontal colored blocks, one per field, with byte offsets labeled below
- Hover: highlight the field block, show a popover div with description
- Can be implemented as HTML/CSS blocks with Tailwind (simpler than Canvas for a static diagram)
- Reference source file in a comment: `<!-- Layout matches boid-buffers.ts and D-008 -->`

---

### S2.5: Double Buffering Step-Through & Snapshot Bridge (Section 5)

**User story**: As a reader, I want to step through the ping-pong buffer swap frame by frame so that I understand why the simulation needs two copies of the data.

**FRs**: FR13, FR29, FR34
**Architecture decisions**: D-014
**Complexity**: Medium
**Test tier**: Smoke

**Acceptance criteria**:

```gherkin
Given the Section 5 double-buffer demo renders
When the user sees the initial state
Then two labeled buffers ("Buffer A" and "Buffer B") are shown side by side
And one is highlighted as "Read" and the other as "Write"
And an arrow shows data flow direction from Read to Write

Given the user clicks "Next Frame"
When the animation steps forward
Then the Read and Write labels swap (A becomes Write, B becomes Read)
And a brief animation shows the swap visually (e.g., color transition or slide)

Given the user clicks "Play"
When auto-play is active
Then the buffers swap every ~1 second automatically
And a "Pause" button replaces the "Play" button

Given the prose section explains the snapshot bridge (D-005)
When the user reads it
Then the explanation covers: Svelte $state -> snapshot object -> GPU uniform write per frame
And a data-flow diagram shows: Svelte State -> Snapshot -> writeUniforms() -> GPU Buffer
```

**Scope boundaries**:
- DOES: Build `TopicDoubleBuffering.svelte` with animated ping-pong diagram (Canvas or HTML), prev/next/play controls, snapshot bridge explanation with code snippet and data-flow diagram, define "ping-pong", "double buffer", "snapshot" on first use
- DOES NOT: Show actual shader code (that is Section 6), implement the full frame loop diagram (FR31, Growth)

**Technical notes**:
- Ping-pong animation: two rectangles that swap colors/labels each "frame"
- Can be HTML/CSS with Svelte transitions rather than Canvas (simpler for this)
- Snapshot bridge diagram: HTML boxes showing `Svelte $state` -> `snapshot copy` -> `writeUniforms()` -> `GPU Uniform Buffer`
- Code snippet: small TypeScript excerpt showing the snapshot pattern (can be inline, not necessarily ?raw import)
- Auto-play: `setInterval` or rAF-based timer, toggled by play/pause button

---

## Epic 3: Shader & Rendering Explainers

**Goal**: Build Sections 5-9 content: compute shader display with Shiki, neighbor query visualization, instanced rendering explanation, cone rotation demo, and camera/projection pipeline.

**Dependencies**: E1 (shared utilities), E2 (Shiki CodeBlock component from S1.3)
**FRs**: FR14, FR16, FR17, FR18, FR20
**Decisions**: D-013, D-014

---

### S3.1: Compute Shader Code Display & Neighbor Query Visualization (Sections 6-7)

**User story**: As a reader, I want to see the actual compute shader code and interact with a neighbor query visualization so that I understand how boids find and react to their neighbors.

**FRs**: FR14, FR16, FR33, FR34
**Architecture decisions**: D-013, D-014
**Complexity**: Large
**Test tier**: Thorough

**Acceptance criteria**:

```gherkin
Given the Section 6 component renders
When the user views the compute shader section
Then syntax-highlighted WGSL code from boid-steering.wgsl is displayed via the CodeBlock component
And the displayed code matches the actual file content (imported via ?raw)
And the prose explains what the shader does in plain language

Given the Section 7 neighbor query demo renders with ~15 boids
When the user drags the central boid
Then a circle representing the perception radius moves with the dragged boid
And boids inside the circle are highlighted (e.g., brighter color or ring)
And boids outside the circle are dimmed

Given the user adjusts the perception radius slider
When the radius increases from 60px to 120px
Then more boids fall inside the highlighted circle
And the circle visually grows on the canvas
```

**Scope boundaries**:
- DOES: Build `TopicComputeShader.svelte` with CodeBlock showing boid-steering.wgsl excerpts, build `TopicNeighborQueries.svelte` with draggable boid + perception radius circle + neighbor highlighting + radius slider, define "compute shader", "workgroup", "perception radius", "neighbor" on first use
- DOES NOT: Implement shader line-by-line step-through (FR15, Growth)

**Technical notes**:
- Shader import: `import shaderSource from '$lib/gpu/shaders/boid-steering.wgsl?raw'`
- Show 2-3 excerpts (not the full shader): the main loop, the steering force calculation, the position update
- Extract excerpts by line range or by searching for known function/section markers
- Neighbor demo: static boids (draggable positions, no simulation loop), one "query boid" that the user drags
- Distance check: Euclidean distance in 2D from query boid to each other boid vs. perception radius
- Canvas size: 400x400 for the neighbor demo

---

### S3.2: Instanced Rendering & Cone Rotation Demo (Section 8)

**User story**: As a reader, I want to see how one cone shape gets drawn at many positions with different orientations so that I understand instanced rendering and velocity-based rotation.

**FRs**: FR17, FR18, FR34
**Architecture decisions**: D-014
**Complexity**: Medium
**Test tier**: Smoke

**Acceptance criteria**:

```gherkin
Given the Section 8 instanced rendering diagram renders
When the user views it
Then a diagram shows: one cone mesh template on the left, an arrow labeled "instanced draw", and multiple cones at different positions/orientations on the right
And a label indicates "1 draw call, N instances"

Given the cone rotation demo renders
When a single cone shape is displayed with an adjustable velocity arrow
Then the cone visually rotates to align with the velocity direction
And the user can drag the velocity arrow to change direction
And the cone orientation updates smoothly in real time

Given the prose explains instanced rendering
When the user reads it
Then "instanced rendering", "vertex shader", "instance index" are defined on first use
```

**Scope boundaries**:
- DOES: Build `TopicRendering.svelte` with instanced rendering diagram (HTML/CSS or Canvas), cone rotation Canvas demo with draggable velocity vector, prose explaining instanced rendering and orientation from velocity
- DOES NOT: Show render shader source (FR19, Growth), implement the camera widget (FR21, Growth)

**Technical notes**:
- Instanced rendering diagram: can be HTML/CSS boxes + arrows (simple static diagram)
- Cone rotation demo: Canvas 2D, draw a triangle (2D cone projection), compute rotation angle from velocity vector using `atan2(vy, vx)`, user drags an arrow to set velocity direction
- Velocity arrow: draw from cone center, user click-drags the arrow tip
- Canvas size: 300x300 for the rotation demo

---

### S3.3: Camera & View/Projection Pipeline Diagram (Section 9)

**User story**: As a reader, I want to see how 3D coordinates become pixels on screen so that I understand the camera and projection pipeline.

**FRs**: FR20, FR34
**Architecture decisions**: D-014
**Complexity**: Small
**Test tier**: Yolo

**Acceptance criteria**:

```gherkin
Given the Section 9 component renders
When the user views the pipeline diagram
Then a horizontal flow diagram shows four stages: World Space -> View Space -> Clip Space -> Screen Space
And each stage has a labeled box with a brief description
And arrows connect the stages with matrix operation labels (Model, View, Projection, Viewport)

Given the prose explains the camera
When the user reads it
Then "world space", "view space", "clip space", "projection matrix", "field of view" are defined on first use
And the explanation references the fly-around camera in the boid simulation
```

**Scope boundaries**:
- DOES: Build `TopicCamera.svelte` with a matrix pipeline flow diagram (HTML/CSS or Canvas), prose explaining the camera and coordinate transformations
- DOES NOT: Implement interactive camera FOV widget (FR21, Growth)

**Technical notes**:
- Pipeline diagram: 4 boxes in a row with arrows, implementable as HTML/CSS with Tailwind flex/grid
- Each box: stage name + 1-sentence description + small visual icon (optional)
- Arrow labels: "Model Matrix", "View Matrix", "Projection Matrix", "Viewport Transform"
- Prose references `camera.ts` and the `gl-matrix` lookAt / perspective calls
- This is the lightest section -- mostly prose with one diagram

---

### S3.4: Snapshot Bridge & Double-Buffer Code Snippets

**User story**: As a reader, I want to see real code snippets from the snapshot bridge and buffer lifecycle so that the explainer is grounded in the actual implementation.

**FRs**: FR29, FR33
**Architecture decisions**: D-013
**Complexity**: Small
**Test tier**: Yolo

**Acceptance criteria**:

```gherkin
Given the double buffering section references the snapshot bridge
When code snippets are displayed
Then at least one TypeScript snippet shows the snapshot bridge pattern from animation-loop.ts
And the snippet is syntax-highlighted via the CodeBlock component

Given the code snippets reference actual source files
When the project builds
Then the snippet content matches the source file (imported via ?raw or extracted at build time)
```

**Scope boundaries**:
- DOES: Add TypeScript code snippets to the double-buffering and compute shader sections using CodeBlock, import relevant source via ?raw where practical
- DOES NOT: Add code snippets to every section (only sections with FR33 applicability)

**Technical notes**:
- Snapshot bridge code: excerpt from `animation-loop.ts` showing the snapshot copy pattern
- Buffer lifecycle code: excerpt from `boid-buffers.ts` showing `createBoidBuffers` signature
- For TypeScript excerpts: import full file via `?raw`, extract relevant lines in the component (substring or split-by-line)
- Alternative: manually copy short excerpts if ?raw import of .ts files is impractical (note: .ts ?raw imports work in Vite)

---

## Epic 4: Personality System Explainer

**Goal**: Build Section 10 content: personality type display, comparison widget, mini-simulation with personality distribution, state-transition diagram, and stress time-series graph.

**Dependencies**: E1 (shared utilities)
**FRs**: FR22, FR23, FR24, FR25, FR26
**Decisions**: D-014

---

### S4.1: Personality Type Display & Parameter Table (Section 10 Part 1)

**User story**: As a reader, I want to see all 7 personality types with their colors, shapes, and parameter values so that I understand how each type behaves differently.

**FRs**: FR22, FR34
**Architecture decisions**: D-014
**Complexity**: Medium
**Test tier**: Smoke

**Acceptance criteria**:

```gherkin
Given the Section 10 personality display renders
When the user views the personality grid
Then all 7 types are shown: Flocker, Loner, Predator, Explorer, Swirler, Timid, Mimic
And each type displays: name, canonical color swatch (from PERSONALITY_COLORS), an identifying shape icon
And a parameter table shows the 8 tunable fields from BoidConfigTemplate for each type

Given the parameter table renders
When the user scans the values
Then each row is one parameter (separationWeight, alignmentWeight, etc.)
And each column is one personality type
And values that are notably high or low are visually indicated (e.g., bold or colored)

Given the prose introduces personality types
When the user reads it
Then "personality type", "separation weight", "perception radius" and other config fields are defined on first use
```

**Scope boundaries**:
- DOES: Build the personality grid section of `TopicPersonalities.svelte`, import from `personality-templates.ts` for all data (PERSONALITY_TYPES, PERSONALITY_COLORS, PERSONALITY_NAMES, PERSONALITY_TEMPLATES), render parameter table, define terms
- DOES NOT: Implement comparison widget (S4.2), mini-simulation (S4.3), state-transition diagram (S4.4)

**Technical notes**:
- Import directly: `import { PERSONALITY_TYPES, PERSONALITY_COLORS, PERSONALITY_NAMES, PERSONALITY_TEMPLATES, type BoidConfigTemplate } from '$lib/gpu/personality-templates'`
- Parameter table: HTML `<table>` with Tailwind styling, 8 rows x 7 columns + header
- Color swatches: small `<div>` with background-color from PERSONALITY_COLORS (convert [r,g,b] 0-1 to CSS rgb)
- Shape icons: small Canvas or CSS shapes matching the simulation (cone for flocker, flat delta for loner, etc.)
- High/low value indicators: compare each value to the mean across all 7 types; above mean = green, below = orange

---

### S4.2: Personality Comparison Widget (Section 10 Part 2)

**User story**: As a reader, I want to select two personality types and see their parameters side by side so that I understand how they differ.

**FRs**: FR23, FR34
**Architecture decisions**: D-014
**Complexity**: Medium
**Test tier**: Smoke

**Acceptance criteria**:

```gherkin
Given the comparison widget renders
When the user selects "Flocker" in dropdown A and "Predator" in dropdown B
Then a side-by-side display shows all 8 parameter values for both types
And each parameter row shows a visual indicator: green up-arrow if B > A, red down-arrow if B < A, gray equals if B == A
And the magnitude of difference is shown (e.g., "1.5 vs 0.5, -67%")

Given the user changes dropdown B from "Predator" to "Timid"
When the widget updates
Then all parameter comparisons update to reflect Flocker vs Timid

Given only one type is selected (the other is "None")
When the widget renders
Then it shows the single type's parameters without comparison indicators
```

**Scope boundaries**:
- DOES: Build the comparison section of `TopicPersonalities.svelte` (or a child `PersonalityComparison.svelte`), two dropdown selectors populated from PERSONALITY_NAMES, side-by-side parameter display with diff indicators
- DOES NOT: Show stress/experience fields (those are runtime, not template values), animate transitions between types

**Technical notes**:
- Two `<select>` elements with options from PERSONALITY_NAMES
- Selected types stored in `$state` variables
- Diff calculation: for each of 8 fields, compare `templateA[field]` vs `templateB[field]`
- Visual indicators: Tailwind-colored arrows or bars showing relative difference
- Layout: two columns with parameter name in center, values on left/right

---

### S4.3: Mini-Simulation with Personality Distribution (Section 10 Part 3)

**User story**: As a reader, I want to run a small 2D boid simulation with different personality mixes so that I can see how personality distribution affects emergent behavior.

**FRs**: FR24, FR34
**Architecture decisions**: D-014
**Complexity**: Large
**Test tier**: Thorough

**Acceptance criteria**:

```gherkin
Given the personality mini-simulation renders with 30 boids
When the default "Balanced" preset is active
Then boids are colored by personality type (matching PERSONALITY_COLORS)
And different behaviors are visible: flockers cluster, loners drift, predators chase

Given the user clicks the "Predator Chaos" preset button
When the distribution updates
Then boid types are reassigned to match {Predator: 40%, Timid: 30%, Flocker: 20%, Loner: 10%}
And the simulation visually changes: more red predators chasing yellow timid boids

Given the user adjusts individual personality sliders
When the distribution changes
Then boid type assignments update proportionally
And the total always sums to 100%

Given the mini-simulation canvas is off-screen
When the user scrolls away
Then the animation loop pauses (IntersectionObserver)
```

**Scope boundaries**:
- DOES: Build a 2D Canvas boid mini-simulation with personality-based steering differences, preset buttons from DISTRIBUTION_PRESETS, per-type color rendering, distribution sliders or preset buttons
- DOES NOT: Implement stress accumulation or personality transitions (simplified 2D sim), exceed 50 boids, implement GPU-based simulation

**Technical notes**:
- Reuse the 2D boid steering logic from S2.3 but extend with per-type config values
- Each boid has a `personalityType` and reads its steering weights from a JS-side copy of the personality template
- Simplified special behaviors: predators have higher speed + negative cohesion, timid flee from predators, others use their template weights
- Preset buttons: import `DISTRIBUTION_PRESETS` and `PRESET_NAMES` from personality-templates.ts
- Canvas size: 500x400
- Boid count: fixed at 30 (no slider needed for the mini-sim)
- Color rendering: `ctx.fillStyle = rgbToCSS(PERSONALITY_COLORS[boid.type])`

---

### S4.4: State-Transition Diagram & Stress Graph (Section 10 Part 4)

**User story**: As a reader, I want to see how boids change personality over time and how stress drives those changes so that I understand the dynamic personality system.

**FRs**: FR25, FR26, FR34
**Architecture decisions**: D-014
**Complexity**: Medium
**Test tier**: Smoke

**Acceptance criteria**:

```gherkin
Given the state-transition diagram renders
When the user views it
Then all 7 personality types are shown as nodes
And directed arrows show possible transitions (e.g., Flocker -> Loner under high stress)
And each arrow is labeled with the transition condition (e.g., "stress > 0.8, experience > 5s")

Given the stress time-series graph renders
When the mini-simulation (S4.3) is running
Then a line graph shows the stress level of one tracked boid over time (x-axis: seconds, y-axis: stress 0-1)
And when the tracked boid's stress crosses a threshold, a vertical marker appears
And if the boid changes personality, the line color changes to match the new type

Given the user clicks a different boid in the mini-simulation
When the tracked boid changes
Then the stress graph resets and begins tracking the newly selected boid
```

**Scope boundaries**:
- DOES: Build the state-transition diagram (Canvas or HTML/CSS node graph) with all transition rules from the actual shader, build a real-time stress line graph (Canvas 2D) that tracks one boid from the S4.3 mini-simulation, define "stress", "experience timer", "transition" on first use
- DOES NOT: Implement personality transition visual effects in the mini-sim (FR27, Growth), show the full WGSL transition code

**Technical notes**:
- Transition diagram: nodes arranged in a circle or grid, arrows between them
  - Read actual transition rules from `boid-steering.wgsl` at implementation time
  - Known transitions from sprint 002: Flocker->Loner (high stress), Loner->Explorer (low stress, long exp), Explorer->Timid (high stress), Timid->Flocker (low stress, long exp), Any->Predator (very high stress, rare), Predator->Flocker (low stress, very long exp), Mimic copies nearest
- Stress graph: Canvas 2D line chart
  - X-axis: time (rolling window of ~30 seconds)
  - Y-axis: stress level 0.0 to 1.0
  - Line color: matches tracked boid's current personality color
  - Threshold line: horizontal dashed line at the transition threshold (e.g., 0.8)
  - Update each frame from the mini-simulation's tracked boid state
- Integration with S4.3: the mini-sim exposes a `trackedBoid` reactive reference; the graph reads from it

---

### S4.5: Svelte-GPU Bridge Explanation (Section 10 Part 5)

**User story**: As a reader, I want to understand how the Svelte UI talks to the GPU simulation so that I see the full picture of how the app works.

**FRs**: FR29, FR34
**Architecture decisions**: D-012
**Complexity**: Small
**Test tier**: Yolo

**Acceptance criteria**:

```gherkin
Given the Svelte-GPU bridge section renders
When the user reads the prose
Then the explanation covers: Svelte $state holds UI values, a snapshot copy is made each frame, the snapshot is written to GPU uniform/config buffers
And a diagram shows the data flow: Svelte Component -> $state -> snapshot -> GPU Buffer

Given the explanation references the config buffer lifecycle
When the user reads it
Then it explains: changing boid count destroys old buffers and creates new ones, changing personality distribution rewrites the config buffer without destroying it
```

**Scope boundaries**:
- DOES: Build a subsection within `TopicPersonalities.svelte` (or as prose within Section 5 or 10) explaining the Svelte-GPU bridge pattern, include a data-flow diagram, reference the snapshot bridge from D-005
- DOES NOT: Show full animation loop code, duplicate the Section 5 double-buffer explanation

**Technical notes**:
- This is primarily a prose + diagram section, no Canvas demo
- Data-flow diagram: HTML/CSS boxes with arrows (similar to S2.2 pipeline diagram)
- References: `animation-loop.ts` snapshot pattern, `boid-buffers.ts` writeConfigBuffer and recreateBoidBuffers
- Keep brief -- 2-3 paragraphs + one diagram

---

## Epic 5: Polish & Integration

**Goal**: Final pass -- ensure all demos lazy-init correctly, cross-links work, prose is reviewed for term definitions, and the page reads as a cohesive whole.

**Dependencies**: E2, E3, E4 (all content must exist)
**FRs**: FR34, FR40, FR41
**Decisions**: D-015

---

### S5.1: Lazy-Init All Demos via IntersectionObserver

**User story**: As a reader, I want the page to load fast and not drain my battery so that only visible demos are running at any time.

**FRs**: FR40
**Architecture decisions**: D-015
**Complexity**: Medium
**Test tier**: Thorough

**Acceptance criteria**:

```gherkin
Given the page loads
When only Section 1 is visible in the viewport
Then only the Section 1 demo animation loop is running
And all other Canvas demos are not consuming CPU (no rAF callbacks)

Given the user scrolls from Section 1 to Section 3
When Section 1 leaves the viewport and Section 3 enters
Then the Section 1 demo pauses
And the Section 3 boid demo starts

Given 3 demos are simultaneously partially visible (e.g., scrolling between sections)
When all 3 have animation loops
Then no more than 3 rAF loops are active simultaneously (NFR1)
```

**Scope boundaries**:
- DOES: Audit all demo components to verify they use `createCanvasDemo()` or equivalent IntersectionObserver pattern, fix any that start unconditionally, verify pause/resume behavior, test with browser performance tools
- DOES NOT: Add new demos, modify demo content

**Technical notes**:
- This is primarily an audit and fix story -- the pattern should already be in place from S1.1
- Check each topic component: TopicGpu, TopicBoidRules, TopicNeighborQueries, TopicRendering, TopicPersonalities (mini-sim), stress graph
- Verify: no `requestAnimationFrame` calls outside the `createCanvasDemo()` utility
- Verify: `$effect` teardown properly cancels rAF and disconnects observer
- Test: open browser DevTools Performance tab, scroll through page, confirm only visible demos generate frames

---

### S5.2: Prose Review -- Terms Defined on First Use

**User story**: As a teenage reader, I want every technical term explained the first time I see it so that I never feel lost or stupid.

**FRs**: FR34
**Architecture decisions**: None
**Complexity**: Small
**Test tier**: Yolo

**Acceptance criteria**:

```gherkin
Given the complete page is read top to bottom
When a technical term appears for the first time
Then it is defined inline (e.g., "A **GPU** (Graphics Processing Unit) is a chip designed to...")
And subsequent uses of the same term do not re-define it

Given the reader has no programming background
When they read Section 1 through Section 3
Then they encounter no undefined jargon
And they can understand the prose without external resources

Given the terms "GPU", "CPU", "parallel", "buffer", "shader", "boid", "struct", "compute pass", "render pass", "instanced rendering", "perception radius", "personality type", "stress" appear
When each first appears
Then it has an inline definition
```

**Scope boundaries**:
- DOES: Read through all 10 topic components, verify every technical term is defined on first use, add definitions where missing, ensure definitions are kid-friendly
- DOES NOT: Add a glossary system (FR38, Vision), modify interactive demos

**Technical notes**:
- Create a checklist of all technical terms used across the page
- First-use definition pattern: bold the term, follow with a parenthetical or em-dash definition
- Example: "A **compute shader** -- a small program that runs on the GPU instead of the CPU -- processes all boids simultaneously."
- Terms that need definitions (non-exhaustive): GPU, CPU, parallel, buffer, shader, compute pass, render pass, pipeline, struct, byte, padding, alignment, perception radius, boid, separation, alignment (the rule), cohesion, instanced rendering, vertex, fragment, matrix, world space, view space, clip space, personality type, stress level

---

### S5.3: Cross-Links, Navigation Polish, and "Try the Simulation" CTA

**User story**: As a reader who just learned about boids, I want a clear link to try the real simulation so that I can apply what I learned.

**FRs**: FR41
**Architecture decisions**: None
**Complexity**: Small
**Test tier**: Smoke

**Acceptance criteria**:

```gherkin
Given the user is on /how-it-works
When they look at the page header or footer
Then a prominent "See It Live" or "Try the Simulation" link/button navigates to /boids

Given the user is on /boids
When they look at the navigation or controls panel
Then a "How It Works" link navigates to /how-it-works

Given the user finishes reading Section 10
When they reach the bottom of the page
Then a CTA section says "Ready to see it in action?" with a button linking to /boids
And optionally a brief summary of what they learned
```

**Scope boundaries**:
- DOES: Add cross-link from /how-it-works to /boids (header + footer CTA), add cross-link from /boids to /how-it-works, style the CTA section at the bottom of the explainer page
- DOES NOT: Modify the boid simulation itself, add deep-links to specific sections from the boids page

**Technical notes**:
- Explainer page: add a `<a href="/boids">` link in the StickyNav header area and a CTA `<section>` at the bottom after Section 10
- Boids page: add a small "How It Works" link in the controls panel or page header (minimal change to existing `src/routes/boids/+page.svelte`)
- CTA styling: centered, prominent button with Tailwind classes (e.g., `bg-blue-600 text-white px-6 py-3 rounded-lg`)
