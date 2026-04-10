<script lang="ts">
	type Stage = {
		id: string;
		label: string;
		sublabel: string;
		tooltip: string;
		color: string;
		border: string;
		textColor: string;
	};

	const stages: Stage[] = [
		{
			id: 'javascript',
			label: 'JavaScript',
			sublabel: 'animation-loop.ts',
			tooltip:
				'Your JavaScript code runs on the CPU and decides what to draw each frame. It calls the GPU with instructions — like a director telling actors what to do.',
			color: 'bg-yellow-900/40',
			border: 'border-yellow-500',
			textColor: 'text-yellow-300'
		},
		{
			id: 'command-buffers',
			label: 'Command Buffers',
			sublabel: 'boid-compute.ts',
			tooltip:
				'A **command buffer** is a recorded list of instructions that you hand to the GPU all at once. Instead of calling the GPU one step at a time, you write down every step first and then submit the whole list together — much more efficient.',
			color: 'bg-blue-900/40',
			border: 'border-blue-500',
			textColor: 'text-blue-300'
		},
		{
			id: 'gpu-queue',
			label: 'GPU Queue',
			sublabel: 'device.queue.submit()',
			tooltip:
				'The **GPU queue** is the inbox where the GPU picks up your command buffers. When you call `queue.submit()`, the browser places your commands in line and the GPU processes them as fast as it can.',
			color: 'bg-purple-900/40',
			border: 'border-purple-500',
			textColor: 'text-purple-300'
		},
		{
			id: 'compute-pass',
			label: 'Compute Pass',
			sublabel: 'boid-compute.ts',
			tooltip:
				'A **compute pass** is a GPU stage that runs pure math — no drawing involved. For boids, this is where all 500+ boids calculate their new positions and velocities at the same time in parallel.',
			color: 'bg-green-900/40',
			border: 'border-green-500',
			textColor: 'text-green-300'
		},
		{
			id: 'render-pass',
			label: 'Render Pass',
			sublabel: 'boid-render.ts',
			tooltip:
				'A **render pass** is the GPU stage that actually draws pixels to the screen. It takes the boid positions from the compute pass and draws each boid as a triangle pointing in its direction of travel.',
			color: 'bg-orange-900/40',
			border: 'border-orange-500',
			textColor: 'text-orange-300'
		},
		{
			id: 'screen',
			label: 'Screen',
			sublabel: 'canvas element',
			tooltip:
				'The finished frame appears on your screen via the WebGPU canvas. The whole pipeline runs 60 times per second — that\'s why the boids look smooth and alive.',
			color: 'bg-red-900/40',
			border: 'border-red-500',
			textColor: 'text-red-300'
		}
	];

	let activeId = $state<string | null>(null);

	function activate(id: string) {
		activeId = id;
	}

	function deactivate() {
		activeId = null;
	}

	function toggle(id: string) {
		activeId = activeId === id ? null : id;
	}

	const activeStage = $derived(stages.find((s) => s.id === activeId) ?? null);
</script>

<section id="webgpu-pipeline" class="mb-20">
	<h2 class="text-3xl font-bold text-white mb-6">The WebGPU Pipeline</h2>

	<div class="prose prose-invert max-w-none mb-10">
		<p class="text-gray-300 mb-4">
			<strong class="text-white">WebGPU</strong> is the modern browser API that lets JavaScript talk
			directly to your computer's graphics card (GPU). Think of the GPU as a factory with thousands
			of tiny workers — the CPU (where JavaScript runs) is the factory manager. WebGPU is the phone
			line between them.
		</p>
		<p class="text-gray-300 mb-4">
			The boid simulation uses WebGPU because simulating 500 birds at once is exactly the kind of
			task GPUs were built for. Every boid needs to look at its neighbors, calculate steering forces,
			and update its position — and the GPU can do all of that for every boid
			<em>at the same time</em>.
		</p>
		<p class="text-gray-300 mb-4">
			Each frame follows a <strong class="text-white">pipeline</strong> — a fixed sequence of stages
			that data passes through, from JavaScript code all the way to pixels on screen. The CPU side
			records a <strong class="text-white">command buffer</strong> — a written list of instructions
			for the GPU — and submits it to the <strong class="text-white">GPU queue</strong> (the inbox
			where the GPU picks up work). The GPU then runs two stages in order: a
			<strong class="text-white">compute pass</strong> (pure math — updating every boid's position
			in parallel) followed by a <strong class="text-white">render pass</strong> (actually drawing
			the boids as pixels on screen).
		</p>
		<p class="text-gray-300 mb-4">
			Here's how data flows from your browser's JavaScript all the way to the pixels on screen,
			every single frame. Hover or tap any stage to learn more about it.
		</p>
	</div>

	<!-- Pipeline diagram -->
	<div class="relative">
		<!-- Desktop: horizontal flow -->
		<div class="hidden md:flex items-center gap-0 overflow-x-auto pb-4">
			{#each stages as stage, i}
				<!-- Stage box -->
				<button
					class="flex-shrink-0 flex flex-col items-center justify-center w-32 h-24 rounded-lg border-2 cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/50
						{stage.color} {stage.border}
						{activeId === stage.id ? 'scale-105 shadow-lg shadow-black/50 brightness-125' : 'hover:brightness-110 hover:scale-102'}"
					onmouseenter={() => activate(stage.id)}
					onmouseleave={deactivate}
					onclick={() => toggle(stage.id)}
					aria-pressed={activeId === stage.id}
					aria-label="{stage.label}: {stage.tooltip}"
				>
					<span class="text-sm font-bold {stage.textColor} text-center leading-tight px-1">
						{stage.label}
					</span>
					<span class="text-xs text-gray-400 text-center mt-1 px-1 leading-tight font-mono">
						{stage.sublabel}
					</span>
				</button>

				<!-- Arrow between stages -->
				{#if i < stages.length - 1}
					<div class="flex-shrink-0 flex items-center px-1">
						<div class="w-6 h-px bg-gray-500"></div>
						<div class="w-0 h-0 border-t-4 border-b-4 border-l-6 border-t-transparent border-b-transparent border-l-gray-500"
							style="border-left-width: 8px;"></div>
					</div>
				{/if}
			{/each}
		</div>

		<!-- Mobile: vertical flow -->
		<div class="flex md:hidden flex-col items-center gap-0">
			{#each stages as stage, i}
				<button
					class="w-full max-w-xs flex items-center gap-3 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/50
						{stage.color} {stage.border}
						{activeId === stage.id ? 'brightness-125 shadow-lg shadow-black/50' : 'hover:brightness-110'}"
					onclick={() => toggle(stage.id)}
					aria-pressed={activeId === stage.id}
					aria-label="{stage.label}: {stage.tooltip}"
				>
					<div class="flex flex-col items-start">
						<span class="text-sm font-bold {stage.textColor}">{stage.label}</span>
						<span class="text-xs text-gray-400 font-mono">{stage.sublabel}</span>
					</div>
				</button>

				{#if i < stages.length - 1}
					<div class="flex flex-col items-center py-1">
						<div class="w-px h-4 bg-gray-500"></div>
						<div class="w-0 h-0 border-l-4 border-r-4 border-t-6 border-l-transparent border-r-transparent border-t-gray-500"
							style="border-top-width: 8px;"></div>
					</div>
				{/if}
			{/each}
		</div>

		<!-- Tooltip panel -->
		<div class="mt-6 min-h-16">
			{#if activeStage}
				<div
					class="rounded-lg border {activeStage.border} {activeStage.color} px-5 py-4 transition-all duration-150"
				>
					<p class="text-sm font-semibold {activeStage.textColor} mb-1">{activeStage.label}</p>
					<p class="text-gray-200 text-sm leading-relaxed">{activeStage.tooltip}</p>
				</div>
			{:else}
				<div class="rounded-lg border border-gray-700 bg-gray-800/30 px-5 py-4">
					<p class="text-gray-500 text-sm italic">Hover or tap a stage to learn what it does.</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Code flow callout -->
	<div class="mt-8 rounded-lg border border-gray-700 bg-gray-800/50 px-5 py-4">
		<p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">In the actual code</p>
		<p class="text-gray-300 text-sm leading-relaxed">
			Each frame, <code class="text-yellow-300 bg-gray-900 px-1 rounded">animation-loop.ts</code>
			kicks off the pipeline. It calls
			<code class="text-blue-300 bg-gray-900 px-1 rounded">boid-compute.ts</code> to record the compute
			pass (position updates), then
			<code class="text-orange-300 bg-gray-900 px-1 rounded">boid-render.ts</code> to record the render
			pass (drawing). Both are bundled into one command buffer and submitted to the GPU queue together.
		</p>
	</div>
</section>
