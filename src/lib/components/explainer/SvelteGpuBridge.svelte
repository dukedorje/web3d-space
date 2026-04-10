<!-- S4.5: Svelte-GPU Bridge Explanation -->

<div class="mt-16">
	<h3 class="text-2xl font-bold text-white mb-6">How Svelte Talks to the GPU</h3>

	<!-- Prose -->
	<div class="prose prose-invert max-w-none mb-8 space-y-4">
		<p class="text-gray-300 leading-relaxed">
			The sliders and controls you see on screen live entirely in Svelte's
			<code class="text-cyan-300 bg-gray-900 px-1 rounded">$state</code> system — reactive values
			that update the DOM instantly when you drag a slider. But the GPU animation loop runs on its
			own clock, firing 60 times per second via
			<code class="text-yellow-300 bg-gray-900 px-1 rounded">requestAnimationFrame</code>. The
			two worlds are connected by a <strong class="text-white">snapshot bridge</strong>: each frame,
			the loop reads a plain JavaScript object called
			<code class="text-yellow-300 bg-gray-900 px-1 rounded">simParams</code> that was last written
			by a Svelte <code class="text-cyan-300 bg-gray-900 px-1 rounded">$effect</code>. This keeps
			reactive Svelte code completely out of the hot path — the GPU loop never touches a rune.
		</p>
		<p class="text-gray-300 leading-relaxed">
			When you change the <strong class="text-white">boid count</strong>, the loop detects that
			<code class="text-yellow-300 bg-gray-900 px-1 rounded">simParams.boidCount</code> no longer
			matches the size of the active buffers. It calls
			<code class="text-yellow-300 bg-gray-900 px-1 rounded">recreateBoidBuffers()</code>, which
			destroys the old position and config buffers on the GPU and allocates fresh ones at the new
			size — a full teardown and rebuild so nothing from the old count leaks into the new simulation.
		</p>
		<p class="text-gray-300 leading-relaxed">
			Changing the <strong class="text-white">personality distribution</strong> is cheaper: the
			boid count stays the same, so the position buffers survive untouched. The loop calls
			<code class="text-yellow-300 bg-gray-900 px-1 rounded">writeConfigBuffer()</code>, which
			streams a new block of per-boid personality parameters directly into the existing config
			buffer. The GPU sees the updated weights on the very next compute pass, no allocation needed.
		</p>
	</div>

	<!-- Data-flow diagram -->
	<h4 class="text-lg font-semibold text-gray-300 mb-4">Data Flow: UI to GPU</h4>

	<!-- Desktop: horizontal flow -->
	<div class="hidden md:block overflow-x-auto pb-4">
		<div class="flex items-center gap-0 min-w-max">
			<!-- Svelte Component -->
			<div class="flex flex-col items-center justify-center w-36 h-24 rounded-lg border-2 border-cyan-500 bg-cyan-900/30 px-2">
				<span class="text-sm font-bold text-cyan-300 text-center leading-tight">Svelte Component</span>
				<span class="text-xs text-gray-400 font-mono mt-1 text-center">slider / input</span>
			</div>

			<!-- Arrow -->
			<div class="flex items-center px-1 flex-shrink-0">
				<div class="w-6 h-px bg-gray-500"></div>
				<div class="w-0 h-0 border-t-4 border-b-4 border-l-transparent border-r-transparent"
					style="border-left: 8px solid rgb(107,114,128); border-top-color: transparent; border-bottom-color: transparent;"></div>
			</div>

			<!-- $state -->
			<div class="flex flex-col items-center justify-center w-36 h-24 rounded-lg border-2 border-cyan-400 bg-cyan-900/20 px-2">
				<span class="text-sm font-bold text-cyan-300 text-center leading-tight font-mono">$state</span>
				<span class="text-xs text-gray-400 mt-1 text-center">reactive value</span>
			</div>

			<!-- Arrow + label -->
			<div class="flex flex-col items-center px-1 flex-shrink-0">
				<span class="text-xs text-gray-500 mb-1">$effect writes</span>
				<div class="flex items-center">
					<div class="w-6 h-px bg-gray-500"></div>
					<div class="w-0 h-0 border-t-transparent border-b-transparent"
						style="border-left: 8px solid rgb(107,114,128); border-top: 4px solid transparent; border-bottom: 4px solid transparent;"></div>
				</div>
			</div>

			<!-- Snapshot -->
			<div class="flex flex-col items-center justify-center w-36 h-24 rounded-lg border-2 border-yellow-500 bg-yellow-900/30 px-2">
				<span class="text-sm font-bold text-yellow-300 text-center leading-tight">Snapshot</span>
				<span class="text-xs text-gray-400 font-mono mt-1 text-center">simParams{'{}'}</span>
			</div>

			<!-- Arrow + label -->
			<div class="flex flex-col items-center px-1 flex-shrink-0">
				<span class="text-xs text-gray-500 mb-1">read each frame</span>
				<div class="flex items-center">
					<div class="w-6 h-px bg-gray-500"></div>
					<div class="w-0 h-0 border-t-transparent border-b-transparent"
						style="border-left: 8px solid rgb(107,114,128); border-top: 4px solid transparent; border-bottom: 4px solid transparent;"></div>
				</div>
			</div>

			<!-- GPU Uniform Buffer -->
			<div class="flex flex-col items-center justify-center w-36 h-24 rounded-lg border-2 border-purple-500 bg-purple-900/30 px-2">
				<span class="text-sm font-bold text-purple-300 text-center leading-tight">Uniform Buffer</span>
				<span class="text-xs text-gray-400 font-mono mt-1 text-center">writeUniforms()</span>
			</div>

			<!-- Arrow -->
			<div class="flex items-center px-1 flex-shrink-0">
				<div class="w-6 h-px bg-gray-500"></div>
				<div class="w-0 h-0 border-t-transparent border-b-transparent"
					style="border-left: 8px solid rgb(107,114,128); border-top: 4px solid transparent; border-bottom: 4px solid transparent;"></div>
			</div>

			<!-- GPU Config Buffer -->
			<div class="flex flex-col items-center justify-center w-36 h-24 rounded-lg border-2 border-green-500 bg-green-900/30 px-2">
				<span class="text-sm font-bold text-green-300 text-center leading-tight">Config Buffer</span>
				<span class="text-xs text-gray-400 font-mono mt-1 text-center">writeConfigBuffer()</span>
			</div>
		</div>
	</div>

	<!-- Mobile: vertical flow -->
	<div class="flex md:hidden flex-col items-center gap-0">
		<div class="w-full max-w-xs flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-cyan-500 bg-cyan-900/30">
			<div class="flex flex-col">
				<span class="text-sm font-bold text-cyan-300">Svelte Component</span>
				<span class="text-xs text-gray-400 font-mono">slider / input</span>
			</div>
		</div>
		<div class="flex flex-col items-center py-1">
			<div class="w-px h-4 bg-gray-500"></div>
			<div class="w-0 h-0" style="border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 8px solid rgb(107,114,128);"></div>
		</div>

		<div class="w-full max-w-xs flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-cyan-400 bg-cyan-900/20">
			<div class="flex flex-col">
				<span class="text-sm font-bold text-cyan-300 font-mono">$state</span>
				<span class="text-xs text-gray-400">reactive value</span>
			</div>
		</div>
		<div class="flex flex-col items-center py-1">
			<div class="w-px h-4 bg-gray-500"></div>
			<span class="text-xs text-gray-500">$effect writes</span>
			<div class="w-0 h-0" style="border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 8px solid rgb(107,114,128);"></div>
		</div>

		<div class="w-full max-w-xs flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-yellow-500 bg-yellow-900/30">
			<div class="flex flex-col">
				<span class="text-sm font-bold text-yellow-300">Snapshot</span>
				<span class="text-xs text-gray-400 font-mono">simParams{'{}'}</span>
			</div>
		</div>
		<div class="flex flex-col items-center py-1">
			<div class="w-px h-4 bg-gray-500"></div>
			<span class="text-xs text-gray-500">read each frame</span>
			<div class="w-0 h-0" style="border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 8px solid rgb(107,114,128);"></div>
		</div>

		<div class="w-full max-w-xs flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-purple-500 bg-purple-900/30">
			<div class="flex flex-col">
				<span class="text-sm font-bold text-purple-300">Uniform Buffer</span>
				<span class="text-xs text-gray-400 font-mono">writeUniforms()</span>
			</div>
		</div>
		<div class="flex flex-col items-center py-1">
			<div class="w-px h-4 bg-gray-500"></div>
			<div class="w-0 h-0" style="border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 8px solid rgb(107,114,128);"></div>
		</div>

		<div class="w-full max-w-xs flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-green-500 bg-green-900/30">
			<div class="flex flex-col">
				<span class="text-sm font-bold text-green-300">Config Buffer</span>
				<span class="text-xs text-gray-400 font-mono">writeConfigBuffer()</span>
			</div>
		</div>
	</div>

	<!-- Code reference callout -->
	<div class="mt-8 rounded-lg border border-gray-700 bg-gray-800/50 px-5 py-4">
		<p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">In the actual code</p>
		<p class="text-gray-300 text-sm leading-relaxed">
			The snapshot object is typed as
			<code class="text-yellow-300 bg-gray-900 px-1 rounded">SimParamsSnapshot</code> in
			<code class="text-yellow-300 bg-gray-900 px-1 rounded">animation-loop.ts</code>. A Svelte
			<code class="text-cyan-300 bg-gray-900 px-1 rounded">$effect</code> writes to it whenever
			<code class="text-cyan-300 bg-gray-900 px-1 rounded">$state</code> changes. The loop's
			<code class="text-yellow-300 bg-gray-900 px-1 rounded">frame()</code> function reads from it
			directly — no callbacks, no events. Buffer lifecycle lives in
			<code class="text-green-300 bg-gray-900 px-1 rounded">boid-buffers.ts</code>:
			<code class="text-green-300 bg-gray-900 px-1 rounded">recreateBoidBuffers()</code> for count
			changes, <code class="text-green-300 bg-gray-900 px-1 rounded">writeConfigBuffer()</code> for
			personality distribution changes.
		</p>
	</div>
</div>
