<script lang="ts">
	import CodeBlock from '$lib/components/explainer/CodeBlock.svelte';
	import shaderSource from '$lib/gpu/shaders/boid-steering.wgsl?raw';

	// Extract line ranges from the shader source for educational excerpts
	const lines = shaderSource.split('\n');

	// Excerpt 1: Entry point + setup (lines 97-118, @compute through accumulators)
	const entryPointCode = lines.slice(96, 118).join('\n');

	// Excerpt 2: Neighbor loop + steering forces (lines 130-166, the O(n) loop)
	const neighborLoopCode = lines.slice(129, 166).join('\n');

	// Excerpt 3: Force application + position update (lines 252-271)
	const positionUpdateCode = lines.slice(251, 271).join('\n');
</script>

<section id="compute-shader" class="mb-20">
	<h2 class="text-3xl font-bold text-white mb-6">The Compute Shader</h2>

	<div class="prose prose-invert max-w-none mb-10">
		<p class="text-gray-300 mb-4">
			A <strong class="text-white">compute shader</strong> is a program that runs on
			the GPU -- not to draw pixels, but to crunch numbers in parallel. Instead of
			processing one boid at a time like a regular CPU loop, the GPU launches
			<em>hundreds of threads at once</em>, each one handling a single boid. That's
			how we update thousands of boids every frame without breaking a sweat.
		</p>
		<p class="text-gray-300 mb-4">
			Our compute shader is written in <strong class="text-white">WGSL</strong>
			(WebGPU Shading Language) -- that's the language WebGPU understands. The GPU
			organizes threads into groups called <strong class="text-white">workgroups</strong>.
			A workgroup is just a batch of threads that run together on the same GPU core.
			Ours uses a workgroup size of 64, which means 64 boids get processed
			simultaneously per group.
		</p>
		<p class="text-gray-300 mb-4">
			Let's walk through the three most important parts of our shader: the entry point
			where each thread figures out which boid it's responsible for, the neighbor loop
			where it calculates steering forces, and the position update where the boid
			actually moves.
		</p>
	</div>

	<!-- Excerpt 1: Entry Point -->
	<div class="mb-8">
		<h3 class="text-xl font-bold text-white mb-3">1. Entry Point</h3>
		<p class="text-gray-300 mb-4">
			The <code class="text-yellow-300 bg-gray-900 px-1 rounded text-sm">@compute @workgroup_size(64)</code>
			line tells the GPU "this is a compute shader, run 64 threads per workgroup." Each
			thread gets a unique ID via
			<code class="text-yellow-300 bg-gray-900 px-1 rounded text-sm">global_invocation_id</code>,
			which we use as the boid index. If the index is past our boid count, that thread
			exits early -- not every workgroup is perfectly full.
		</p>
		<div class="rounded-xl border border-gray-700 bg-gray-900/60 p-5">
			<CodeBlock code={entryPointCode} lang="wgsl" title="boid-steering.wgsl -- Entry point" />
		</div>
	</div>

	<!-- Excerpt 2: Neighbor Loop -->
	<div class="mb-8">
		<h3 class="text-xl font-bold text-white mb-3">2. Neighbor Loop & Steering Forces</h3>
		<p class="text-gray-300 mb-4">
			This is the heart of the shader. Each boid loops through <em>every other boid</em>
			to find its neighbors -- the ones within its
			<strong class="text-white">perception radius</strong> (the maximum distance at which
			a boid can "see" and be influenced by others). For each neighbor it finds,
			it accumulates the three classic forces: separation (push away from close neighbors),
			alignment (match their direction), and cohesion (steer toward their center). It also
			tracks special cases like the nearest predator.
		</p>
		<div class="rounded-xl border border-gray-700 bg-gray-900/60 p-5">
			<CodeBlock code={neighborLoopCode} lang="wgsl" title="boid-steering.wgsl -- Neighbor query loop" />
		</div>
	</div>

	<!-- Excerpt 3: Position Update -->
	<div class="mb-8">
		<h3 class="text-xl font-bold text-white mb-3">3. Position Update</h3>
		<p class="text-gray-300 mb-4">
			After all the forces are calculated, we apply them to the boid's velocity. The
			<code class="text-yellow-300 bg-gray-900 px-1 rounded text-sm">dt * 60.0</code>
			factor keeps the simulation smooth regardless of frame rate. Finally, the new
			position wraps toroidally -- if a boid flies off one edge, it reappears on the
			opposite side. The result gets written to the output buffer (the "write"
			side of double buffering).
		</p>
		<div class="rounded-xl border border-gray-700 bg-gray-900/60 p-5">
			<CodeBlock code={positionUpdateCode} lang="wgsl" title="boid-steering.wgsl -- Velocity & position update" />
		</div>
	</div>

	<div class="prose prose-invert max-w-none">
		<p class="text-gray-400 text-sm">
			The full shader also handles personality-specific behaviors (predator chasing,
			timid fleeing, swirler rotation) and personality transitions -- but the core
			pattern is always the same: find neighbors, calculate forces, update position.
		</p>
	</div>
</section>
