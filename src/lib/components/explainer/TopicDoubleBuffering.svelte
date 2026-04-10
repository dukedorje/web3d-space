<script lang="ts">
	import { fade } from 'svelte/transition';
	import CodeBlock from '$lib/components/explainer/CodeBlock.svelte';

	// Which buffer is currently being READ (0 = A, 1 = B)
	let readIndex = $state(0);
	let frameCount = $state(0);
	let playing = $state(false);
	let intervalId = $state<ReturnType<typeof setInterval> | null>(null);

	const bufferLabels = ['A', 'B'];

	function stepForward() {
		readIndex = readIndex === 0 ? 1 : 0;
		frameCount++;
	}

	function stepBack() {
		if (frameCount === 0) return;
		readIndex = readIndex === 0 ? 1 : 0;
		frameCount--;
	}

	function togglePlay() {
		if (playing) {
			pause();
		} else {
			play();
		}
	}

	function play() {
		playing = true;
		intervalId = setInterval(() => {
			stepForward();
		}, 1000);
	}

	function pause() {
		playing = false;
		if (intervalId !== null) {
			clearInterval(intervalId);
			intervalId = null;
		}
	}

	// Clean up interval on unmount
	$effect(() => {
		return () => {
			if (intervalId !== null) {
				clearInterval(intervalId);
				intervalId = null;
			}
		};
	});

	// Derived: which index is read vs write
	const writeIndex = $derived(readIndex === 0 ? 1 : 0);

	const snapshotCode = `// Each frame in animation-loop.ts:

// 1. Read a snapshot of Svelte $state — a plain JS object copy
const params: SimParams = {
  maxForce: simParams.maxForce,
  worldSize: simParams.worldSize,
};
const boidCount = simParams.boidCount;

// 2. Write the snapshot values to the GPU uniform buffer
writeUniforms(device, buffers.uniform, dt, boidCount, params);

// 3. Swap ping-pong buffer index for next frame
frameIndex++;  // bindGroups[frameIndex % 2] alternates A/B`;
</script>

<section id="double-buffering" class="mb-20">
	<h2 class="text-3xl font-bold text-white mb-6">Double Buffering</h2>

	<!-- Prose explanation -->
	<div class="prose prose-invert max-w-none mb-10">
		<p class="text-gray-300 mb-4">
			Imagine you and a friend are passing notes in class. If you both try to write on the same piece
			of paper at the same time, the message gets garbled. The GPU has the same problem: it needs to
			<em>read</em> boid positions to calculate the next frame while <em>writing</em> new positions
			at the same time. The solution is <strong class="text-white">double buffering</strong> —
			keeping two copies of the data.
		</p>
		<p class="text-gray-300 mb-4">
			Think of it like two whiteboards. On any given frame, you <strong class="text-white">read</strong>
			from Whiteboard A (the old positions) and <strong class="text-white">write</strong> the updated
			positions onto Whiteboard B. Next frame, you flip: read from B, write to A. This swap is called
			<strong class="text-white">ping-pong</strong> — the data bounces back and forth between two buffers.
		</p>
		<p class="text-gray-300 mb-4">
			A <strong class="text-white">snapshot</strong> is a safety technique on top of this: before the
			GPU frame starts, we copy the current Svelte reactive state into a plain JavaScript object. That
			plain object is what the animation loop actually reads — so if the UI updates mid-frame, it
			never corrupts the in-flight calculation.
		</p>
	</div>

	<!-- Ping-pong animated demo -->
	<div class="rounded-xl border border-gray-700 bg-gray-900/60 p-6 mb-10">
		<p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-5">
			Ping-Pong Buffer Demo — Frame {frameCount}
		</p>

		<!-- Buffer visualization -->
		<div class="flex items-center justify-center gap-6 mb-8">
			{#each [0, 1] as idx}
				{@const isRead = idx === readIndex}
				{@const isWrite = idx === writeIndex}
				<div
					class="relative flex flex-col items-center justify-center w-36 h-28 rounded-xl border-2 transition-all duration-500 select-none
						{isRead
						? 'border-blue-400 bg-blue-900/40 shadow-lg shadow-blue-900/40'
						: 'border-orange-400 bg-orange-900/40 shadow-lg shadow-orange-900/40'}"
				>
					<!-- Buffer name -->
					<span class="text-2xl font-bold {isRead ? 'text-blue-200' : 'text-orange-200'}">
						Buffer {bufferLabels[idx]}
					</span>
					<!-- Role badge -->
					<span
						class="mt-2 px-3 py-0.5 rounded-full text-xs font-semibold tracking-wide
							{isRead
							? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
							: 'bg-orange-500/30 text-orange-300 border border-orange-500/50'}"
					>
						{isRead ? 'READ' : 'WRITE'}
					</span>
				</div>

				<!-- Arrow between buffers -->
				{#if idx === 0}
					<div class="flex flex-col items-center gap-1 w-12">
						<!-- Arrow direction: Read → Write -->
						<div class="flex items-center">
							{#if readIndex === 0}
								<!-- A → B -->
								<div class="h-0.5 w-8 bg-gray-500"></div>
								<div
									class="w-0 h-0 border-t-4 border-b-4 border-t-transparent border-b-transparent"
									style="border-left: 8px solid rgb(107 114 128);"
								></div>
							{:else}
								<!-- B → A -->
								<div
									class="w-0 h-0 border-t-4 border-b-4 border-t-transparent border-b-transparent"
									style="border-right: 8px solid rgb(107 114 128);"
								></div>
								<div class="h-0.5 w-8 bg-gray-500"></div>
							{/if}
						</div>
						<span class="text-xs text-gray-500 text-center leading-tight">data<br/>flows</span>
					</div>
				{/if}
			{/each}
		</div>

		<!-- Frame label callout -->
		<div class="flex justify-center mb-6">
			<div class="rounded-lg bg-gray-800/80 border border-gray-700 px-5 py-3 text-center">
				<p class="text-sm text-gray-400">
					Frame <span class="text-white font-mono font-bold">{frameCount}</span>:
					GPU reads from
					<span class="font-bold text-blue-300">Buffer {bufferLabels[readIndex]}</span>,
					writes new positions to
					<span class="font-bold text-orange-300">Buffer {bufferLabels[writeIndex]}</span>.
				</p>
				<p class="text-xs text-gray-500 mt-1">
					bind group index: <span class="font-mono text-gray-400">{frameCount % 2}</span>
					→ <code class="text-yellow-300 text-xs">buffers.bindGroups[frameIndex % 2]</code>
				</p>
			</div>
		</div>

		<!-- Controls -->
		<div class="flex items-center justify-center gap-3">
			<button
				class="px-4 py-2 rounded-lg border border-gray-600 bg-gray-800 text-gray-300 text-sm font-medium
					hover:bg-gray-700 hover:text-white transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
				onclick={stepBack}
				disabled={frameCount === 0 || playing}
				aria-label="Previous frame"
			>
				← Prev Frame
			</button>

			<button
				class="px-5 py-2 rounded-lg border text-sm font-semibold transition-colors duration-150
					{playing
					? 'border-yellow-500 bg-yellow-900/40 text-yellow-300 hover:bg-yellow-900/60'
					: 'border-green-500 bg-green-900/40 text-green-300 hover:bg-green-900/60'}"
				onclick={togglePlay}
				aria-label={playing ? 'Pause auto-play' : 'Play auto-swap'}
			>
				{playing ? '⏸ Pause' : '▶ Play'}
			</button>

			<button
				class="px-4 py-2 rounded-lg border border-gray-600 bg-gray-800 text-gray-300 text-sm font-medium
					hover:bg-gray-700 hover:text-white transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
				onclick={stepForward}
				disabled={playing}
				aria-label="Next frame"
			>
				Next Frame →
			</button>
		</div>

		<p class="text-center text-xs text-gray-600 mt-4">
			Each click of "Next Frame" swaps which buffer is Read and which is Write.
		</p>
	</div>

	<!-- Snapshot bridge section -->
	<div class="mb-6">
		<h3 class="text-xl font-bold text-white mb-3">The Snapshot Bridge</h3>
		<p class="text-gray-300 mb-6">
			There's one more wrinkle: Svelte's reactive
			<code class="text-yellow-300 bg-gray-900 px-1 rounded text-sm">$state</code> variables live
			in the browser's JavaScript thread. The animation loop runs in
			<code class="text-yellow-300 bg-gray-900 px-1 rounded text-sm">requestAnimationFrame</code>
			— which could fire while a slider is being dragged. To keep things consistent, we copy Svelte
			state into a plain JS object (the <strong class="text-white">snapshot</strong>) at the start of
			each frame. The GPU never sees half-updated values.
		</p>

		<!-- Data-flow diagram -->
		<p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Data-flow diagram</p>
		<div class="flex flex-wrap items-center gap-0 mb-8 overflow-x-auto pb-2">
			<!-- Svelte $state -->
			<div class="flex-shrink-0 flex flex-col items-center justify-center w-36 h-20 rounded-lg border-2 border-purple-500 bg-purple-900/40 px-2">
				<span class="text-sm font-bold text-purple-300 text-center">Svelte $state</span>
				<span class="text-xs text-gray-400 font-mono mt-1 text-center">simParams</span>
			</div>
			<!-- arrow -->
			<div class="flex-shrink-0 flex items-center px-1">
				<div class="w-5 h-px bg-gray-500"></div>
				<div class="w-0 h-0 border-t-4 border-b-4 border-t-transparent border-b-transparent" style="border-left: 8px solid rgb(107 114 128);"></div>
			</div>
			<!-- Snapshot copy -->
			<div class="flex-shrink-0 flex flex-col items-center justify-center w-36 h-20 rounded-lg border-2 border-blue-500 bg-blue-900/40 px-2">
				<span class="text-sm font-bold text-blue-300 text-center">Snapshot Copy</span>
				<span class="text-xs text-gray-400 font-mono mt-1 text-center">plain JS object</span>
			</div>
			<!-- arrow -->
			<div class="flex-shrink-0 flex items-center px-1">
				<div class="w-5 h-px bg-gray-500"></div>
				<div class="w-0 h-0 border-t-4 border-b-4 border-t-transparent border-b-transparent" style="border-left: 8px solid rgb(107 114 128);"></div>
			</div>
			<!-- writeUniforms() -->
			<div class="flex-shrink-0 flex flex-col items-center justify-center w-36 h-20 rounded-lg border-2 border-green-500 bg-green-900/40 px-2">
				<span class="text-sm font-bold text-green-300 text-center">writeUniforms()</span>
				<span class="text-xs text-gray-400 font-mono mt-1 text-center">boid-buffers.ts</span>
			</div>
			<!-- arrow -->
			<div class="flex-shrink-0 flex items-center px-1">
				<div class="w-5 h-px bg-gray-500"></div>
				<div class="w-0 h-0 border-t-4 border-b-4 border-t-transparent border-b-transparent" style="border-left: 8px solid rgb(107 114 128);"></div>
			</div>
			<!-- GPU Buffer -->
			<div class="flex-shrink-0 flex flex-col items-center justify-center w-36 h-20 rounded-lg border-2 border-orange-500 bg-orange-900/40 px-2">
				<span class="text-sm font-bold text-orange-300 text-center">GPU Uniform Buffer</span>
				<span class="text-xs text-gray-400 font-mono mt-1 text-center">buffers.uniform</span>
			</div>
		</div>

		<!-- Code snippet -->
		<div class="rounded-xl border border-gray-700 bg-gray-900/60 p-5">
			<p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
				Snapshot pattern — animation-loop.ts
			</p>
			<CodeBlock code={snapshotCode} lang="typescript" />
		</div>
	</div>
</section>
