<script lang="ts">
	let taskCount = $state(100);
	let cpuCanvas = $state<HTMLCanvasElement | null>(null);
	let gpuCanvas = $state<HTMLCanvasElement | null>(null);
	let running = $state(false);
	let cpuDone = $state(false);
	let gpuDone = $state(false);

	const PANEL_W = 400;
	const PANEL_H = 200;
	const CELL_PAD = 2;

	function gridDims(count: number): { cols: number; rows: number; cw: number; ch: number } {
		const cols = Math.ceil(Math.sqrt(count * (PANEL_W / PANEL_H)));
		const rows = Math.ceil(count / cols);
		const cw = Math.floor((PANEL_W - CELL_PAD) / cols) - CELL_PAD;
		const ch = Math.floor((PANEL_H - CELL_PAD) / rows) - CELL_PAD;
		return { cols, rows, cw: Math.max(cw, 2), ch: Math.max(ch, 2) };
	}

	function drawCell(
		ctx: CanvasRenderingContext2D,
		i: number,
		cols: number,
		cw: number,
		ch: number,
		color: string
	) {
		const col = i % cols;
		const row = Math.floor(i / cols);
		const x = CELL_PAD + col * (cw + CELL_PAD);
		const y = CELL_PAD + row * (ch + CELL_PAD);
		ctx.fillStyle = color;
		ctx.fillRect(x, y, cw, ch);
	}

	function clearPanel(ctx: CanvasRenderingContext2D, label: string) {
		ctx.fillStyle = '#030712'; // gray-950
		ctx.fillRect(0, 0, PANEL_W, PANEL_H);
		// Draw empty cells
		const { cols, rows, cw, ch } = gridDims(taskCount);
		for (let i = 0; i < taskCount; i++) {
			drawCell(ctx, i, cols, cw, ch, '#1f2937'); // gray-800
		}
		// Label
		ctx.fillStyle = '#9ca3af';
		ctx.font = '11px monospace';
		ctx.fillText(label, 8, PANEL_H - 6);
	}

	let cpuCtx: CanvasRenderingContext2D | null = null;
	let gpuCtx: CanvasRenderingContext2D | null = null;
	let activeGpuRaf: number | null = null;
	let activeCpuRaf: number | null = null;

	$effect(() => {
		if (!cpuCanvas || !gpuCanvas) return;

		cpuCanvas.width = PANEL_W;
		cpuCanvas.height = PANEL_H;
		gpuCanvas.width = PANEL_W;
		gpuCanvas.height = PANEL_H;

		cpuCtx = cpuCanvas.getContext('2d');
		gpuCtx = gpuCanvas.getContext('2d');

		if (cpuCtx) clearPanel(cpuCtx, 'CPU (Sequential)');
		if (gpuCtx) clearPanel(gpuCtx, 'GPU (Parallel)');

		return () => {
			if (activeGpuRaf !== null) { cancelAnimationFrame(activeGpuRaf); activeGpuRaf = null; }
			if (activeCpuRaf !== null) { cancelAnimationFrame(activeCpuRaf); activeCpuRaf = null; }
			cpuCtx = null;
			gpuCtx = null;
		};
	});

	// Redraw empty panels when taskCount changes (but not while running)
	$effect(() => {
		// track taskCount
		taskCount;
		if (running) return;
		if (cpuCtx) clearPanel(cpuCtx, 'CPU (Sequential)');
		if (gpuCtx) clearPanel(gpuCtx, 'GPU (Parallel)');
		cpuDone = false;
		gpuDone = false;
	});

	function run() {
		if (!cpuCtx || !gpuCtx) return;

		// Cancel any in-progress animation before starting a new one
		if (activeGpuRaf !== null) { cancelAnimationFrame(activeGpuRaf); activeGpuRaf = null; }
		if (activeCpuRaf !== null) { cancelAnimationFrame(activeCpuRaf); activeCpuRaf = null; }

		running = true;
		cpuDone = false;
		gpuDone = false;

		clearPanel(cpuCtx, 'CPU (Sequential)');
		clearPanel(gpuCtx, 'GPU (Parallel)');

		const count = taskCount;
		const { cols, cw, ch } = gridDims(count);

		// GPU: fill all tasks in 3 sweeps
		const gpuSweeps = 3;
		let gpuSweep = 0;

		function gpuStep() {
			if (!gpuCtx) return;
			const perSweep = Math.ceil(count / gpuSweeps);
			const start = gpuSweep * perSweep;
			const end = Math.min(start + perSweep, count);
			for (let i = start; i < end; i++) {
				drawCell(gpuCtx, i, cols, cw, ch, '#22c55e'); // green-500
			}
			gpuSweep++;
			if (gpuSweep < gpuSweeps && start < count) {
				activeGpuRaf = requestAnimationFrame(gpuStep);
			} else {
				activeGpuRaf = null;
				// redraw label
				gpuCtx.fillStyle = '#9ca3af';
				gpuCtx.font = '11px monospace';
				gpuCtx.fillText('GPU (Parallel)', 8, PANEL_H - 6);
				gpuDone = true;
				checkAllDone();
			}
		}
		activeGpuRaf = requestAnimationFrame(gpuStep);

		// CPU: fill tasks one at a time with ~5ms delay via rAF batching
		// At 60fps, one frame = ~16ms. We want ~5ms per task visually.
		// We batch tasks per frame: at 60fps, 1 task per frame is ~16ms each.
		// For large counts we do 1 task/frame; for small counts same.
		// Actually spec says 5ms per task via rAF counter — we'll do 1 per rAF.
		let cpuIndex = 0;
		// How many tasks to draw per frame: at 60fps with 5ms budget → 1 task per ~3 frames
		// Keep it simple: 1 per frame for any count. At 1000 tasks that's ~17 seconds which is too long.
		// Scale: target ~3 seconds for max count. 3000ms / 1000 tasks = 3ms per task.
		// At 60fps = 16.7ms per frame → batch = max(1, count/180)
		const framesTarget = 180; // ~3 seconds at 60fps
		const batchSize = Math.max(1, Math.floor(count / framesTarget));

		function cpuStep() {
			if (!cpuCtx) return;
			const end = Math.min(cpuIndex + batchSize, count);
			for (let i = cpuIndex; i < end; i++) {
				drawCell(cpuCtx, i, cols, cw, ch, '#3b82f6'); // blue-500
			}
			cpuIndex = end;
			if (cpuIndex < count) {
				activeCpuRaf = requestAnimationFrame(cpuStep);
			} else {
				activeCpuRaf = null;
				cpuCtx.fillStyle = '#9ca3af';
				cpuCtx.font = '11px monospace';
				cpuCtx.fillText('CPU (Sequential)', 8, PANEL_H - 6);
				cpuDone = true;
				checkAllDone();
			}
		}
		activeCpuRaf = requestAnimationFrame(cpuStep);

		function checkAllDone() {
			if (cpuDone && gpuDone) {
				running = false;
			}
		}
	}
</script>

<section id="what-is-a-gpu" class="mb-20">
	<h2 class="text-3xl font-bold text-white mb-6">What Is a GPU?</h2>

	<div class="prose prose-invert max-w-none space-y-4 mb-10">
		<p class="text-gray-300 leading-relaxed">
			Every computer has a <strong class="text-white"
				>CPU (Central Processing Unit)</strong
			> — the main "brain" of the machine. A CPU is incredibly fast and very smart. It can handle
			complicated decisions, run your operating system, and switch between a dozen different jobs in
			the blink of an eye. But it only has a small number of cores — usually between 4 and 16 —
			meaning it can only work on a handful of tasks at exactly the same moment.
		</p>

		<p class="text-gray-300 leading-relaxed">
			A <strong class="text-white">GPU (Graphics Processing Unit)</strong> works completely differently.
			It was originally invented to draw pixels on your screen, and pixels have a useful property: you
			can color thousands of them at the same time without any of them interfering with each other. So
			engineers built GPUs with <em>thousands</em> of smaller, simpler cores — not as clever as CPU cores,
			but enormous in number. A modern GPU might have 3,000 to 16,000 cores packed inside.
		</p>

		<p class="text-gray-300 leading-relaxed">
			The word for this is <strong class="text-white">parallel</strong> — doing many things
			simultaneously instead of one after another. Think of it like cooking. A CPU is one world-class
			chef who can execute any recipe perfectly but can only cook one dish at a time. A GPU is a
			kitchen with a thousand line cooks, each slightly less skilled, but together they can prepare
			every dish on the menu in the time it takes the lone chef to finish one plate.
		</p>

		<p class="text-gray-300 leading-relaxed">
			For <strong class="text-white">boid</strong> simulations — "boid" is short for "bird-oid,"
			a simulated creature that follows simple flocking rules — every bird needs to look at its
			neighbors and update its position on every single frame, sixty times a second. With 10,000
			birds, that's 600,000 calculations per second. A CPU has to do those one by one; a GPU can
			do all 10,000 at the same moment. That difference is why the simulation runs silky-smooth on
			a GPU and would grind to a halt on a CPU alone.
		</p>
	</div>

	<!-- Interactive demo -->
	<div class="bg-gray-900 rounded-xl p-6 border border-gray-800">
		<h3 class="text-lg font-semibold text-white mb-4">See It Yourself</h3>

		<!-- Controls -->
		<div class="flex flex-wrap items-center gap-6 mb-6">
			<div class="flex flex-col gap-1">
				<label for="task-count-slider" class="text-sm text-gray-400">
					Task Count: <span class="text-white font-mono">{taskCount}</span>
				</label>
				<input
					id="task-count-slider"
					type="range"
					min="1"
					max="1000"
					bind:value={taskCount}
					disabled={running}
					class="w-48 accent-blue-500"
				/>
			</div>

			<button
				onclick={run}
				disabled={running}
				class="px-5 py-2 rounded-lg font-semibold text-sm transition-colors
					{running
					? 'bg-gray-700 text-gray-500 cursor-not-allowed'
					: 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'}"
			>
				{running ? 'Running…' : 'Run'}
			</button>

			{#if cpuDone && gpuDone}
				<span class="text-sm text-green-400">
					GPU finished way faster — notice the difference?
				</span>
			{/if}
		</div>

		<!-- Canvas panels -->
		<div class="flex flex-col sm:flex-row gap-4">
			<div class="flex flex-col items-center gap-2">
				<span class="text-xs text-blue-400 font-mono uppercase tracking-wide"
					>CPU (Sequential)</span
				>
				<canvas
					bind:this={cpuCanvas}
					class="rounded border border-gray-700 w-full max-w-[400px]"
					style="image-rendering: pixelated;"
				></canvas>
			</div>
			<div class="flex flex-col items-center gap-2">
				<span class="text-xs text-green-400 font-mono uppercase tracking-wide"
					>GPU (Parallel)</span
				>
				<canvas
					bind:this={gpuCanvas}
					class="rounded border border-gray-700 w-full max-w-[400px]"
					style="image-rendering: pixelated;"
				></canvas>
			</div>
		</div>

		<p class="text-xs text-gray-500 mt-4">
			Blue squares fill one-by-one (CPU). Green squares fill all at once (GPU). Try sliding to 500
			or 1000 tasks to see how the CPU falls further behind.
		</p>
	</div>
</section>
