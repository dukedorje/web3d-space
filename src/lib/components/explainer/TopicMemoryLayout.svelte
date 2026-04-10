<!-- Layout matches boid-buffers.ts and D-008 -->
<script lang="ts">
	// Svelte 5 runes
	let hoveredBoidState = $state<string | null>(null);
	let hoveredBoidConfig = $state<number | null>(null);

	// BoidState struct fields — layout: vec3f(12) + pad(4) + vec3f(12) + pad(4) + padding(16) = 48 bytes
	const boidStateFields = [
		{
			name: 'position',
			type: 'vec3f',
			bytes: 12,
			offset: 0,
			color: 'bg-sky-600',
			hoverColor: 'bg-sky-400',
			purpose: 'X, Y, Z position of the boid in 3D world space. A vec3f is three 32-bit floats — 4 bytes each, 12 bytes total.'
		},
		{
			name: '_pad0',
			type: 'f32',
			bytes: 4,
			offset: 12,
			color: 'bg-gray-600',
			hoverColor: 'bg-gray-400',
			purpose: 'Padding byte added by the GPU driver to keep the next field 16-byte aligned. The GPU requires vec3f fields to start on a 16-byte boundary.'
		},
		{
			name: 'velocity',
			type: 'vec3f',
			bytes: 12,
			offset: 16,
			color: 'bg-emerald-600',
			hoverColor: 'bg-emerald-400',
			purpose: 'X, Y, Z velocity — how fast and in what direction the boid is moving. Same size as position: 12 bytes.'
		},
		{
			name: '_pad1',
			type: 'u32',
			bytes: 4,
			offset: 28,
			color: 'bg-gray-600',
			hoverColor: 'bg-gray-400',
			purpose: 'More alignment padding after velocity. This one stores an unsigned integer (u32) but the value is never read — it just fills the gap.'
		},
		{
			name: 'padding',
			type: '4× f32',
			bytes: 16,
			offset: 32,
			color: 'bg-gray-700',
			hoverColor: 'bg-gray-500',
			purpose: 'Reserved space so each boid occupies exactly 48 bytes. This makes array indexing simple: boid N always starts at byte N × 48.'
		}
	] as const;

	// BoidConfig struct fields — 12 fields × 4 bytes = 48 bytes
	const boidConfigFields = [
		{ name: 'separationWeight', type: 'f32', offset: 0, description: 'How strongly this boid steers away from its neighbors when they get too close.' },
		{ name: 'alignmentWeight', type: 'f32', offset: 4, description: 'How strongly this boid tries to match the flying direction of nearby boids.' },
		{ name: 'cohesionWeight', type: 'f32', offset: 8, description: 'How strongly this boid steers toward the center of its local group.' },
		{ name: 'perceptionRadius', type: 'f32', offset: 12, description: 'Distance (in world units) a boid can "see" — only boids within this radius influence it.' },
		{ name: 'separationRadius', type: 'f32', offset: 16, description: 'Distance at which a boid triggers the separation response — personal space!' },
		{ name: 'maxSpeed', type: 'f32', offset: 20, description: 'Top speed this boid can reach in world units per second.' },
		{ name: 'wanderStrength', type: 'f32', offset: 24, description: 'How much random wandering force is applied each frame — makes movement feel organic.' },
		{ name: 'crowdSpeedBoost', type: 'f32', offset: 28, description: 'Speed multiplier applied when surrounded by many neighbors. Flocking birds speed up in a crowd.' },
		{ name: 'personalityType', type: 'u32', offset: 32, description: 'An integer ID selecting one of 7 personality presets (Flocker, Loner, Predator…). Stored as u32 because it is a whole-number index, not a decimal.' },
		{ name: 'experienceTimer', type: 'f32', offset: 36, description: 'Counts how long this boid has been in its current behavior state, used for timed transitions.' },
		{ name: 'stressLevel', type: 'f32', offset: 40, description: 'A 0–1 value tracking how "stressed" the boid is — high stress can trigger personality shifts.' },
		{ name: '_padding', type: 'f32', offset: 44, description: 'Unused padding to fill the struct to exactly 48 bytes and maintain 16-byte alignment.' }
	] as const;
</script>

<section id="memory-layout" class="mb-20">
	<h2 class="text-3xl font-bold text-white mb-6">Section 4: Memory Layout</h2>

	<!-- Intro prose -->
	<div class="prose prose-invert max-w-none mb-10">
		<p class="text-gray-300 text-lg leading-relaxed mb-4">
			Before the GPU can simulate thousands of boids at once, it needs every boid's data packed
			into memory in a very specific way. Think of it like filling seats on a school bus: everyone
			needs to fit in a numbered seat so the driver can find any student instantly. The GPU works
			the same way — it wants every boid to occupy the <em>same number of bytes</em>, starting at
			a predictable memory address.
		</p>

		<p class="text-gray-300 leading-relaxed mb-4">
			That memory lives inside a <strong class="text-white">buffer</strong> — a fixed-size block of
			memory on the GPU that stores raw bytes. Think of it like a long row of numbered mailboxes:
			the GPU can reach into any mailbox instantly as long as it knows the address.
			A <strong class="text-white">struct</strong> (short for "structure") is a fixed recipe that
			says exactly which fields of data live together and in what order inside that buffer. A
			<strong class="text-white">byte offset</strong> is the distance in bytes from the start of
			the struct to a particular field — like saying "velocity starts 16 bytes in."
		</p>

		<p class="text-gray-300 leading-relaxed mb-4">
			GPUs are picky about <strong class="text-white">alignment</strong> — they require certain
			data types to start at addresses that are multiples of 4, 8, or 16 bytes. When the natural
			layout would violate this rule, the compiler inserts invisible filler bytes called
			<strong class="text-white">padding</strong>. You pay for those bytes even though they store
			nothing useful, but alignment lets the GPU fetch data much faster.
		</p>
	</div>

	<!-- BoidState struct diagram -->
	<div class="mb-14">
		<h3 class="text-xl font-semibold text-white mb-2">BoidState struct <span class="text-gray-400 font-normal text-base ml-2">48 bytes per boid</span></h3>
		<p class="text-gray-400 text-sm mb-4">Hover over a field to see what it does.</p>

		<!-- Byte ruler -->
		<div class="flex mb-1 text-xs text-gray-500 select-none" aria-hidden="true">
			{#each boidStateFields as field}
				<div style="flex: {field.bytes}" class="text-center">{field.offset}</div>
			{/each}
			<div class="text-center pl-1">48</div>
		</div>

		<!-- Field blocks -->
		<div class="flex h-16 rounded-lg overflow-hidden border border-gray-700">
			{#each boidStateFields as field}
				<button
					style="flex: {field.bytes}"
					class="relative flex flex-col items-center justify-center transition-colors duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/50
						{hoveredBoidState === field.name
							? field.hoverColor + ' text-white'
							: field.color + ' text-gray-200'}"
					onmouseenter={() => (hoveredBoidState = field.name)}
					onmouseleave={() => (hoveredBoidState = null)}
					onfocus={() => (hoveredBoidState = field.name)}
					onblur={() => (hoveredBoidState = null)}
					aria-label="{field.name} ({field.type}, {field.bytes} bytes at offset {field.offset})"
				>
					<span class="font-mono text-xs font-semibold leading-tight truncate px-1">{field.name}</span>
					<span class="font-mono text-xs text-gray-300 leading-tight">{field.type}</span>
					<span class="font-mono text-xs text-gray-400 leading-tight">{field.bytes}B</span>
				</button>
			{/each}
		</div>

		<!-- Tooltip -->
		<div class="mt-3 min-h-[3rem]">
			{#if hoveredBoidState}
				{@const field = boidStateFields.find((f) => f.name === hoveredBoidState)}
				{#if field}
					<div class="bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-sm text-gray-200">
						<span class="font-mono font-semibold text-white">{field.name}</span>
						<span class="text-gray-400 ml-2">{field.type} · {field.bytes} bytes · offset {field.offset}</span>
						<p class="mt-1 text-gray-300">{field.purpose}</p>
					</div>
				{/if}
			{:else}
				<p class="text-gray-600 text-sm italic">← hover a field above</p>
			{/if}
		</div>

		<p class="text-gray-500 text-xs mt-3">
			Total: 48 bytes = 12 × f32 slots. The GPU can find boid N at byte offset <code class="font-mono">N × 48</code> instantly, without scanning.
		</p>
	</div>

	<!-- BoidConfig struct diagram -->
	<div class="mb-14">
		<h3 class="text-xl font-semibold text-white mb-2">BoidConfig struct <span class="text-gray-400 font-normal text-base ml-2">48 bytes per boid</span></h3>
		<p class="text-gray-400 text-sm mb-4">
			Every boid carries its own personality configuration in a separate buffer. Hover a field to see what it controls.
		</p>

		<!-- Grid of config fields -->
		<div class="grid grid-cols-4 gap-1 sm:grid-cols-6 lg:grid-cols-12">
			{#each boidConfigFields as field, i}
				<button
					class="relative flex flex-col items-center justify-center p-2 rounded border transition-colors duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/50 text-center
						{hoveredBoidConfig === i
							? field.type === 'u32'
								? 'bg-amber-400 border-amber-300 text-gray-900'
								: 'bg-violet-400 border-violet-300 text-gray-900'
							: field.type === 'u32'
								? 'bg-amber-800 border-amber-600 text-amber-200'
								: 'bg-violet-900 border-violet-700 text-violet-200'}"
					onmouseenter={() => (hoveredBoidConfig = i)}
					onmouseleave={() => (hoveredBoidConfig = null)}
					onfocus={() => (hoveredBoidConfig = i)}
					onblur={() => (hoveredBoidConfig = null)}
					aria-label="{field.name} ({field.type}, offset {field.offset})"
				>
					<span class="font-mono text-xs font-semibold leading-tight break-all">{field.name}</span>
					<span class="font-mono text-xs mt-1 leading-tight opacity-75">{field.type}</span>
					<span class="font-mono text-xs leading-tight opacity-60">+{field.offset}</span>
				</button>
			{/each}
		</div>

		<!-- Color legend -->
		<div class="flex gap-4 mt-3 text-xs text-gray-400">
			<span class="flex items-center gap-1.5">
				<span class="inline-block w-3 h-3 rounded bg-violet-700 border border-violet-600"></span>
				f32 (32-bit float)
			</span>
			<span class="flex items-center gap-1.5">
				<span class="inline-block w-3 h-3 rounded bg-amber-800 border border-amber-600"></span>
				u32 (32-bit unsigned integer)
			</span>
		</div>

		<!-- Config tooltip -->
		<div class="mt-3 min-h-[3rem]">
			{#if hoveredBoidConfig !== null}
				{@const field = boidConfigFields[hoveredBoidConfig]}
				<div class="bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-sm text-gray-200">
					<span class="font-mono font-semibold text-white">{field.name}</span>
					<span class="text-gray-400 ml-2">{field.type} · offset {field.offset}</span>
					<p class="mt-1 text-gray-300">{field.description}</p>
				</div>
			{:else}
				<p class="text-gray-600 text-sm italic">← hover a field above</p>
			{/if}
		</div>

		<p class="text-gray-500 text-xs mt-3">
			<code class="font-mono">personalityType</code> is stored as <code class="font-mono">u32</code>
			(amber) because personality IDs are whole numbers. All other fields are <code class="font-mono">f32</code> floating-point values.
		</p>
	</div>

	<!-- Buffer lifecycle prose -->
	<div class="prose prose-invert max-w-none">
		<h3 class="text-xl font-semibold text-white mb-4">Buffer Lifecycle</h3>

		<p class="text-gray-300 leading-relaxed mb-4">
			When the simulation starts, <code class="font-mono text-sky-400">createBoidBuffers()</code>
			allocates GPU memory for every boid at once. It creates two identical storage buffers —
			call them <strong class="text-white">Buffer A</strong> and <strong class="text-white">Buffer B</strong>
			— along with a config buffer and a uniform buffer. This is called the
			<strong class="text-white">ping-pong pattern</strong>: on even frames the compute shader
			reads from A and writes new positions into B; on odd frames it reads from B and writes into A.
			Neither buffer is overwritten while it's being read, which lets thousands of shader threads
			run safely in parallel.
		</p>

		<p class="text-gray-300 leading-relaxed mb-4">
			GPU buffers are fixed in size at creation time — you can't resize them the way you'd
			append to a JavaScript array. When you drag the boid-count slider,
			<code class="font-mono text-sky-400">recreateBoidBuffers()</code> is called: it
			<em>destroys</em> the old buffers (releasing <strong class="text-white">VRAM</strong> —
			Video RAM, the dedicated memory built into the GPU — back to the GPU), then calls
			<code class="font-mono text-sky-400">createBoidBuffers()</code> again with the new count.
			This is intentionally cheap — creating a few GPU buffers takes microseconds, and the
			alternative (pre-allocating for the maximum possible count) wastes memory for nothing.
		</p>

		<p class="text-gray-300 leading-relaxed">
			The config buffer follows the same lifecycle. It stores one 48-byte
			<code class="font-mono text-sky-400">BoidConfig</code> struct per boid, so it scales
			directly with boid count. When personality distributions change at runtime
			(without a count change), only the config buffer data is rewritten via
			<code class="font-mono text-sky-400">writeConfigBuffer()</code> — no destruction needed.
		</p>
	</div>
</section>
